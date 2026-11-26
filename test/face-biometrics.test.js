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

// Minimal valid 1x1 JPEG bytes (SOI + APP0 + EOI passes magic-byte check)
const TINY_JPEG = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
  0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9
]);

function uniqueDatabaseName() {
  return `sekolah_hub_test_${crypto.randomBytes(12).toString('hex')}`;
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
  const cookie = response.headers.getSetCookie().find(value => value.startsWith('edusmart.sid='));
  assert.ok(cookie, 'Expected the login response to set a session cookie');
  return cookie.split(';', 1)[0];
}

async function api(baseUrl, endpoint, { method = 'GET', body, cookie } = {}) {
  const headers = { Origin: baseUrl };
  if (cookie) headers.Cookie = cookie;
  if (body) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${baseUrl}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  return { response, data: await response.json() };
}

async function postAttendance(baseUrl, cookie, faceDescriptor) {
  const form = new FormData();
  form.append('photo', new Blob([TINY_JPEG], { type: 'image/jpeg' }), 'attendance.jpg');
  form.append('latitude', '-6.2');
  form.append('longitude', '106.816666');
  form.append('accuracy', '15');
  if (faceDescriptor !== undefined) {
    form.append('faceDescriptor', JSON.stringify(faceDescriptor));
  }
  const response = await fetch(`${baseUrl}/api/attendance/photo`, {
    method: 'POST',
    headers: { Origin: baseUrl, Cookie: cookie },
    body: form
  });
  return { response, data: await response.json() };
}

test('face biometric registration, server-side attendance enforcement, and deletion', { timeout: 30000 }, async () => {
  const port = await findFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edusmart-face-'));
  const databaseName = uniqueDatabaseName();
  const studentEmail = `student-${crypto.randomUUID()}@edusmart-test.example.com`;
  const studentPassword = 'Password123';

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
      BCRYPT_COST: '4',
      AUTO_ACTIVATE_ACCOUNTS: 'true',
      GOOGLE_CLIENT_ID: '',
      GOOGLE_CLIENT_SECRET: ''
    },
    stdio: 'ignore'
  });

  try {
    let ready = false;
    for (let attempt = 0; attempt < 100 && !ready; attempt++) {
      if (child.exitCode !== null) throw new Error(`Server exited with code ${child.exitCode}`);
      try {
        ready = (await fetch(`${baseUrl}/api/health`)).ok;
      } catch {}
      if (!ready) await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(ready, 'Server should start before the smoke-test timeout');

    // 1. Register and login
    const regRes = await api(baseUrl, '/api/auth/register', {
      method: 'POST',
      body: {
        name: 'Siswa Percobaan',
        email: studentEmail,
        password: studentPassword,
        role: 'SISWA',
        identityNumber: 'NIS-' + Date.now(),
        detail: 'X RPL 1'
      }
    });
    assert.equal(regRes.response.status, 201);

    const loginRes = await api(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: { email: studentEmail, password: studentPassword }
    });
    assert.equal(loginRes.response.status, 200);
    const cookie = sessionCookie(loginRes.response);

    // 2. Attendance must be blocked before face registration
    const unregAtt = await postAttendance(baseUrl, cookie);
    assert.equal(unregAtt.response.status, 403);

    // 3. Reject invalid descriptor
    const invalidSave = await api(baseUrl, '/api/profile/face', {
      method: 'POST',
      cookie,
      body: { descriptor: [1, 2, 3] }
    });
    assert.equal(invalidSave.response.status, 422);

    // 4. Register valid 128-float face descriptor
    const ownerDescriptor = Array.from({ length: 128 }, (_, i) => Math.sin(i));
    const validSave = await api(baseUrl, '/api/profile/face', {
      method: 'POST',
      cookie,
      body: { descriptor: ownerDescriptor }
    });
    assert.equal(validSave.response.status, 200);
    assert.equal(validSave.data.ok, true);

    // 5. Reject attendance without descriptor or with mismatched descriptor (titip absen)
    const missingDescAtt = await postAttendance(baseUrl, cookie);
    assert.equal(missingDescAtt.response.status, 403);

    const intruderDescriptor = Array.from({ length: 128 }, (_, i) => Math.cos(i));
    const mismatchAtt = await postAttendance(baseUrl, cookie, intruderDescriptor);
    assert.equal(mismatchAtt.response.status, 403);

    // 6. Accept attendance when descriptor matches owner (with slight realistic noise)
    const liveOwnerDescriptor = ownerDescriptor.map(v => Number((v + 0.01).toFixed(4)));
    const matchAtt = await postAttendance(baseUrl, cookie, liveOwnerDescriptor);
    assert.equal(matchAtt.response.status, 201);
    assert.equal(matchAtt.data.verification, 'DISETUJUI');

    // 7. Delete face descriptor and verify
    const deleteRes = await api(baseUrl, '/api/profile/face', {
      method: 'DELETE',
      cookie
    });
    assert.equal(deleteRes.response.status, 200);

    const finalFace = await api(baseUrl, '/api/profile/face', { cookie });
    assert.equal(finalFace.response.status, 200);
    assert.equal(finalFace.data.hasFace, false);
  } finally {
    child.kill();
    fs.rmSync(dataDir, { recursive: true, force: true });
    await dropDatabase(databaseName);
  }
});
