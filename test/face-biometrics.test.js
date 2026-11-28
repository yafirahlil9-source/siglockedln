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

async function postAttendance(baseUrl, cookie, faceDescriptor, coordinates = {}, accuracy = 15) {
  const form = new FormData();
  form.append('photo', new Blob([TINY_JPEG], { type: 'image/jpeg' }), 'attendance.jpg');
  form.append('latitude', String(coordinates.latitude ?? -7.164041847763249));
  form.append('longitude', String(coordinates.longitude ?? 112.64734569558635));
  form.append('accuracy', String(accuracy));
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

test('legacy plaintext biometric templates are encrypted during startup migration', { timeout: 30000 }, async () => {
  const port = await findFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edusmart-face-migration-'));
  const databaseName = uniqueDatabaseName();
  const adminEmail = `admin-${crypto.randomUUID()}@edusmart-test.example.com`;
  const adminPassword = 'AdminPassword123';
  const descriptor = Array.from({ length: 128 }, (_, index) => Math.sin(index));
  const validId = crypto.randomUUID();
  const corruptId = crypto.randomUUID();
  let child;
  try {
    const connection = await mysql.createConnection(mysqlConfig);
    try {
      await connection.query(`CREATE DATABASE \`${databaseName}\``);
      await connection.query(`USE \`${databaseName}\``);
      await connection.query(`CREATE TABLE pengguna (
        id VARCHAR(36) PRIMARY KEY, full_name VARCHAR(120) NOT NULL, email VARCHAR(120) NOT NULL UNIQUE,
        password_hash VARCHAR(255), role ENUM('SISWA','GURU','STAF','ADMIN') NOT NULL,
        identity_number VARCHAR(30) NOT NULL UNIQUE, detail TEXT NOT NULL, bio VARCHAR(300) NOT NULL DEFAULT '',
        google_id VARCHAR(100) UNIQUE, status ENUM('PENDING','AKTIF','NONAKTIF') NOT NULL DEFAULT 'PENDING',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, face_descriptor MEDIUMTEXT DEFAULT NULL
      ) ENGINE=InnoDB`);
      await connection.execute('INSERT INTO pengguna (id,full_name,email,role,identity_number,detail,status,face_descriptor) VALUES (?,?,?,?,?,?,?,?)',
        [validId, 'Wajah Lama', `legacy-face-${crypto.randomUUID()}@example.com`, 'SISWA', 'NIS-LEGACY-FACE', 'X RPL 1', 'AKTIF', JSON.stringify(descriptor)]);
      await connection.execute('INSERT INTO pengguna (id,full_name,email,role,identity_number,detail,status,face_descriptor) VALUES (?,?,?,?,?,?,?,?)',
        [corruptId, 'Wajah Rusak', `corrupt-face-${crypto.randomUUID()}@example.com`, 'SISWA', 'NIS-CORRUPT-FACE', 'X RPL 1', 'AKTIF', 'bukan deskriptor']);
    } finally {
      await connection.end();
    }

    child = spawn(process.execPath, [path.join(projectRoot, 'server.js')], {
      cwd: projectRoot,
      env: {
        ...process.env, NODE_ENV: 'test', PORT: String(port), APP_URL: baseUrl, DATA_DIR: dataDir,
        DB_NAME: databaseName, SESSION_SECRET: crypto.randomBytes(40).toString('hex'),
        SEED_ADMIN_EMAIL: adminEmail, SEED_ADMIN_PASSWORD: adminPassword, BCRYPT_COST: '4',
        AUTO_ACTIVATE_ACCOUNTS: 'true', GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: ''
      },
      stdio: 'ignore'
    });
    let ready = false;
    for (let attempt = 0; attempt < 100 && !ready; attempt++) {
      if (child.exitCode !== null) throw new Error(`Server exited with code ${child.exitCode}`);
      try { ready = (await fetch(`${baseUrl}/api/health`)).ok; } catch {}
      if (!ready) await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(ready, 'Server should start before the smoke-test timeout');
    const db = await mysql.createConnection({ ...mysqlConfig, database: databaseName });
    try {
      const [[validRow]] = await db.execute('SELECT face_descriptor FROM pengguna WHERE id=?', [validId]);
      assert.match(validRow.face_descriptor, /^v1\./);
      assert.notEqual(validRow.face_descriptor, JSON.stringify(descriptor));
      const [[corruptRow]] = await db.execute('SELECT face_descriptor FROM pengguna WHERE id=?', [corruptId]);
      assert.equal(corruptRow.face_descriptor, null);
    } finally {
      await db.end();
    }
  } finally {
    if (child && child.exitCode === null && child.signalCode === null) {
      await new Promise(resolve => { child.once('exit', resolve); child.kill(); });
    }
    fs.rmSync(dataDir, { recursive: true, force: true });
    await dropDatabase(databaseName);
  }
});

test('encrypted face enrollment, attendance prechecks, manual review, and deletion', { timeout: 30000 }, async () => {
  const port = await findFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edusmart-face-'));
  const databaseName = uniqueDatabaseName();
  const studentEmail = `student-${crypto.randomUUID()}@edusmart-test.example.com`;
  const studentPassword = 'Password123';
  const adminEmail = `admin-${crypto.randomUUID()}@edusmart-test.example.com`;
  const adminPassword = 'AdminPassword123';

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

    const faceStatus = await api(baseUrl, '/api/profile/face', { cookie });
    assert.equal(faceStatus.response.status, 200);
    assert.equal(faceStatus.data.hasFace, true);
    assert.equal(faceStatus.data.descriptor, undefined, 'Registered biometric templates must not be returned to the browser');

    const intruderDescriptor = Array.from({ length: 128 }, (_, i) => Math.cos(i));
    const matchingCheck = await api(baseUrl, '/api/profile/face/check', {
        method: 'POST', cookie, body: { descriptor: ownerDescriptor }
    });
    assert.equal(matchingCheck.response.status, 200);
    assert.equal(matchingCheck.data.matched, true);
    const mismatchingCheck = await api(baseUrl, '/api/profile/face/check', {
        method: 'POST', cookie, body: { descriptor: intruderDescriptor }
    });
    assert.equal(mismatchingCheck.response.status, 200);
    assert.equal(mismatchingCheck.data.matched, false);

    const db = await mysql.createConnection({ ...mysqlConfig, database: databaseName });
    try {
      const [[{ face_descriptor: storedDescriptor }]] = await db.execute('SELECT face_descriptor FROM pengguna WHERE id=(SELECT id FROM pengguna WHERE email=?)', [studentEmail]);
      assert.match(storedDescriptor, /^v1\./);
      assert.notEqual(storedDescriptor, JSON.stringify(ownerDescriptor));
    } finally {
      await db.end();
    }

    // 5. Reject attendance without descriptor or with mismatched descriptor (titip absen)
    const missingDescAtt = await postAttendance(baseUrl, cookie);
    assert.equal(missingDescAtt.response.status, 403);

    const mismatchAtt = await postAttendance(baseUrl, cookie, intruderDescriptor);
    assert.equal(mismatchAtt.response.status, 403);

    // 6. Reject attendance outside the school radius and with inaccurate GPS
    const liveOwnerDescriptor = ownerDescriptor.map(v => Number((v + 0.01).toFixed(4)));
    const outsideAtt = await postAttendance(baseUrl, cookie, liveOwnerDescriptor, {
      latitude: -7.164041847763249,
      longitude: 112.65734569558635
    });
    assert.equal(outsideAtt.response.status, 403);
    assert.match(outsideAtt.data.error, /Di luar radius sekolah/);

    const inaccurateAtt = await postAttendance(baseUrl, cookie, liveOwnerDescriptor, {}, 101);
    assert.equal(inaccurateAtt.response.status, 422);

    const accuracyBoundaryAtt = await postAttendance(baseUrl, cookie, liveOwnerDescriptor, {}, 100);
    assert.equal(accuracyBoundaryAtt.response.status, 201, JSON.stringify(accuracyBoundaryAtt.data));
    assert.equal(accuracyBoundaryAtt.data.verification, 'MENUNGGU');

    // 7. Attendance inside the school radius is recorded for admin review
    const matchAtt = await postAttendance(baseUrl, cookie, liveOwnerDescriptor);
    assert.equal(matchAtt.response.status, 200);
    assert.equal(matchAtt.data.verification, 'MENUNGGU');

    const adminLogin = await api(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: { email: adminEmail, password: adminPassword }
    });
    assert.equal(adminLogin.response.status, 200);
    const decision = await api(baseUrl, `/api/admin/attendance/${matchAtt.data.id}`, {
      method: 'PATCH',
      cookie: sessionCookie(adminLogin.response),
      body: { verification: 'DISETUJUI' }
    });
    assert.equal(decision.response.status, 200);
    assert.equal(decision.data.verification, 'DISETUJUI');

    // 8. Delete face descriptor and verify
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
