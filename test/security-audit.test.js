const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const mysql = require('mysql2/promise');
const { test } = require('node:test');

const projectRoot = path.resolve(__dirname, '..');
require('dotenv').config({ path: path.join(projectRoot, '.env') });

const mysqlConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || ''
};

const TINY_JPEG = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
  0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9
]);

function uniqueDatabaseName() {
  return `sekolah_hub_sec_${crypto.randomBytes(10).toString('hex')}`;
}

async function dropDatabase(databaseName) {
  const connection = await mysql.createConnection(mysqlConfig);
  try {
    await connection.query(`DROP DATABASE IF EXISTS \`${databaseName}\``);
  } finally {
    await connection.end();
  }
}

async function findFreePort() {
  const server = http.createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return port;
}

function sessionCookie(response) {
  const cookie = response.headers.getSetCookie().find(v => v.startsWith('edusmart.sid='));
  assert.ok(cookie, 'Expected session cookie');
  return cookie.split(';', 1)[0];
}

test('security audit: auth guards, CSRF origin checks, GPS bounds, path traversal, and role isolation', { timeout: 30000 }, async () => {
  const port = await findFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edusmart-sec-'));
  const databaseName = uniqueDatabaseName();
  const adminEmail = `sec-admin-${crypto.randomUUID()}@example.com`;
  const adminPassword = 'SecAdminPassword123!';
  const studentEmail = `sec-student-${crypto.randomUUID()}@example.com`;
  const studentPassword = 'SecStudent123!';

  const child = spawn(process.execPath, [path.join(projectRoot, 'server.js')], {
    cwd: projectRoot,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(port),
      APP_URL: baseUrl,
      DATA_DIR: dataDir,
      DB_NAME: databaseName,
      SESSION_SECRET: crypto.randomBytes(40).toString('hex'),
      SEED_ADMIN_EMAIL: adminEmail,
      SEED_ADMIN_PASSWORD: adminPassword,
      BCRYPT_COST: '4',
      AUTO_ACTIVATE_ACCOUNTS: 'true',
      GOOGLE_CLIENT_ID: '',
      GOOGLE_CLIENT_SECRET: ''
    },
    stdio: 'ignore'
  });

  try {
    let ready = false;
    for (let i = 0; i < 100 && !ready; i++) {
      if (child.exitCode !== null) throw new Error(`Server exited with code ${child.exitCode}`);
      try { ready = (await fetch(`${baseUrl}/api/health`)).ok; } catch {}
      if (!ready) await new Promise(r => setTimeout(r, 100));
    }
    assert.ok(ready, 'Server should be healthy');

    // 1. Unauthenticated requests must be rejected (401)
    for (const endpoint of ['/api/materials', '/api/admin/attendance', '/api/admin/reports/export', '/api/attendance/mine']) {
      const res = await fetch(`${baseUrl}${endpoint}`);
      assert.equal(res.status, 401, `${endpoint} must require authentication`);
    }

    // 2. Register & login student + login admin
    let res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { Origin: baseUrl, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: '<script>alert(1)</script>',
        email: studentEmail,
        password: studentPassword,
        role: 'SISWA',
        identityNumber: 'SEC-001',
        detail: 'X RPL 1'
      })
    });
    assert.equal(res.status, 201);

    const adminLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { Origin: baseUrl, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminEmail, password: adminPassword })
    });
    const adminCookie = sessionCookie(adminLogin);

    const studentLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { Origin: baseUrl, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: studentEmail, password: studentPassword })
    });
    const studentCookie = sessionCookie(studentLogin);

    // 3. Cross-site CSRF Origin rejection (403)
    const csrfAttempt = await fetch(`${baseUrl}/api/admin/attendance/settings`, {
      method: 'PUT',
      headers: { Origin: 'https://evil.example', Cookie: adminCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ radiusMeters: 100, openTime: '06:30', closeTime: '23:59', lateAfter: '07:15' })
    });
    assert.equal(csrfAttempt.status, 403);

    // 4. Role escalation blocks (student calling admin/teacher endpoints)
    for (const [method, endpoint, body] of [
      ['GET', '/api/admin/attendance', null],
      ['POST', '/api/admin/attendance/reminders', {}],
      ['PUT', '/api/admin/attendance/settings', { radiusMeters: 100, openTime: '06:30', closeTime: '23:59', lateAfter: '07:15' }],
      ['GET', '/api/admin/reports/export?format=xlsx', null],
      ['POST', '/api/admin/subjects', { name: 'Hack Mapel' }]
    ]) {
      const r = await fetch(`${baseUrl}${endpoint}`, {
        method,
        headers: { Origin: baseUrl, Cookie: studentCookie, ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined
      });
      assert.equal(r.status, 403, `Student must be blocked from ${method} ${endpoint}`);
    }

    // 5. GPS coordinate tampering & negative accuracy validation (422)
    for (const [lat, lng, acc] of [['NaN', '112.64', '10'], ['-7.16', '112.64', '-5'], ['95', '112.64', '10'], ['-7.16', '200', '10']]) {
      const form = new FormData();
      form.append('photo', new Blob([TINY_JPEG], { type: 'image/jpeg' }), 'a.jpg');
      form.append('latitude', lat);
      form.append('longitude', lng);
      form.append('accuracy', acc);
      const gpsRes = await fetch(`${baseUrl}/api/attendance/photo`, {
        method: 'POST',
        headers: { Origin: baseUrl, Cookie: studentCookie },
        body: form
      });
      assert.equal(gpsRes.status, 422, `Invalid GPS (${lat},${lng},${acc}) must return 422`);
    }

    // 6. Path traversal attempts must not read host files
    for (const payload of ['../../.env', '..%2f..%2fpackage.json']) {
      const travRes = await fetch(`${baseUrl}/api/materials/${encodeURIComponent(payload)}/file`, {
        headers: { Cookie: studentCookie }
      });
      assert.equal(travRes.status, 404);
    }

    // 7. XSS escaping in Word export HTML
    const docRes = await fetch(`${baseUrl}/api/admin/reports/export?format=doc`, {
      headers: { Cookie: adminCookie }
    });
    assert.equal(docRes.status, 200);
    const docText = await docRes.text();
    assert.equal(docText.includes('<script>alert(1)</script>'), false);

    // 8. Security headers present (Helmet + x-powered-by disabled)
    const healthRes = await fetch(`${baseUrl}/api/health`);
    assert.equal(healthRes.headers.get('x-powered-by'), null);
    assert.equal(healthRes.headers.get('x-content-type-options'), 'nosniff');
  } finally {
    child.kill();
    fs.rmSync(dataDir, { recursive: true, force: true });
    await dropDatabase(databaseName);
  }
});
