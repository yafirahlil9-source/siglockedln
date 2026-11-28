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

test('new registration creates an admin notification that can be read', { timeout: 30000 }, async () => {
  const port = await findFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edusmart-notification-'));
  const databaseName = uniqueDatabaseName();
  const adminEmail = 'admin@edusmart-test.example.com';
  const adminPassword = `Admin-${crypto.randomBytes(18).toString('hex')}-7A`;
  const studentEmail = `student-${crypto.randomUUID()}@edusmart-test.example.com`;
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
      AUTO_ACTIVATE_ACCOUNTS: 'false',
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

    let result = await api(baseUrl, '/api/auth/login', {
      method: 'POST', body: { email: adminEmail, password: adminPassword }
    });
    assert.equal(result.response.status, 200);
    const adminCookie = sessionCookie(result.response);

    result = await api(baseUrl, '/api/attendance/settings', { cookie: adminCookie });
    assert.equal(result.response.status, 200);
    assert.equal(Number(result.data.settings.latitude), -7.163754437737142);
    assert.equal(Number(result.data.settings.longitude), 112.64748517486774);
    assert.equal(result.data.settings.locationLocked, true);
    assert.equal(Number(result.data.settings.radiusMeters), 100);

    // Security: even admin cannot alter permanently locked school coordinates
    result = await api(baseUrl, '/api/admin/attendance/settings', {
      method: 'PUT',
      cookie: adminCookie,
      body: {
        latitude: -7.164,
        longitude: 112.647,
        radiusMeters: 75,
        openTime: '07:00',
        closeTime: '17:00',
        lateAfter: '07:30'
      }
    });
    assert.equal(result.response.status, 403);

    const updatedSettings = {
      radiusMeters: 75,
      openTime: '07:00',
      closeTime: '17:00',
      lateAfter: '07:30'
    };
    result = await api(baseUrl, '/api/admin/attendance/settings', {
      method: 'PUT', cookie: adminCookie, body: updatedSettings
    });
    assert.equal(result.response.status, 200);
    result = await api(baseUrl, '/api/attendance/settings', { cookie: adminCookie });
    assert.equal(Number(result.data.settings.latitude), -7.163754437737142);
    assert.equal(Number(result.data.settings.longitude), 112.64748517486774);
    assert.equal(Number(result.data.settings.radiusMeters), updatedSettings.radiusMeters);
    assert.equal(result.data.settings.closeTime, updatedSettings.closeTime);

    result = await api(baseUrl, '/api/admin/attendance/settings', {
      method: 'PUT', cookie: adminCookie, body: { ...updatedSettings, radiusMeters: 10 }
    });
    assert.equal(result.response.status, 422);

    result = await api(baseUrl, '/api/admin/attendance/settings', {
      method: 'PUT', cookie: adminCookie, body: { ...updatedSettings, closeTime: '06:00' }
    });
    assert.equal(result.response.status, 422);
    result = await api(baseUrl, '/api/admin/attendance/settings', {
      method: 'PUT', cookie: adminCookie, body: { ...updatedSettings, lateAfter: '18:00' }
    });
    assert.equal(result.response.status, 422);
    result = await api(baseUrl, '/api/admin/attendance/settings', {
      method: 'PUT', cookie: adminCookie, body: { ...updatedSettings, openTime: '25:00' }
    });
    assert.equal(result.response.status, 422);

    result = await api(baseUrl, '/api/auth/register', {
      method: 'POST',
      body: {
        name: 'Pendaftar Uji',
        email: studentEmail,
        password: 'Sekolah123',
        role: 'SISWA',
        identityNumber: `NIS-${crypto.randomUUID().slice(0, 12)}`,
        detail: 'X IPA 2'
      }
    });
    assert.equal(result.response.status, 201, JSON.stringify(result.data));

    result = await api(baseUrl, '/api/notifications', { cookie: adminCookie });
    assert.equal(result.response.status, 200);
    const registrationNotification = result.data.notifications.find(notification => notification.title === 'Pendaftaran akun baru');
    assert.ok(registrationNotification);
    assert.match(registrationNotification.message, /Pendaftar Uji/);
    assert.equal(registrationNotification.isRead, 0);

    result = await api(baseUrl, '/api/notifications/read-all', { method: 'PATCH', body: {}, cookie: adminCookie });
    assert.equal(result.response.status, 200);
    result = await api(baseUrl, '/api/notifications', { cookie: adminCookie });
    assert.equal(result.data.notifications.find(notification => notification.id === registrationNotification.id).isRead, 1);

    result = await api(baseUrl, '/api/auth/login', { method: 'POST', body: { email: studentEmail, password: 'Sekolah123' } });
    assert.equal(result.response.status, 403, 'The account should remain pending until admin approval');
  } finally {
    child.kill();
    if (child.exitCode === null) await new Promise(resolve => child.once('exit', resolve));
    try {
      await dropDatabase(databaseName);
    } finally {
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  }
});

test('configured account auto-activation preserves academic metrics and profile features', { timeout: 30000 }, async () => {
  const port = await findFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edusmart-auto-activate-'));
  const databaseName = uniqueDatabaseName();
  const adminEmail = 'admin-auto@edusmart-test.example.com';
  const adminPassword = `Admin-${crypto.randomBytes(18).toString('hex')}-7A`;
  const studentEmail = `student-${crypto.randomUUID()}@edusmart-test.example.com`;
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
      try { ready = (await fetch(`${baseUrl}/api/health`)).ok; } catch {}
      if (!ready) await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(ready, 'Server should start before the smoke-test timeout');

    const result = await api(baseUrl, '/api/auth/register', {
      method: 'POST',
      body: {
        name: 'Pendaftar Otomatis',
        email: studentEmail,
        password: 'Sekolah123',
        role: 'SISWA',
        identityNumber: `NIS-${crypto.randomUUID().slice(0, 12)}`,
        detail: 'X IPA 2'
      }
    });
    assert.equal(result.response.status, 201);
    assert.equal(result.data.autoActivated, true);
    assert.match(result.data.message, /sudah aktif/);

    const login = await api(baseUrl, '/api/auth/login', {
      method: 'POST', body: { email: studentEmail, password: 'Sekolah123' }
    });
    assert.equal(login.response.status, 200);
    assert.equal(login.data.user.status, 'AKTIF');
    const studentCookie = sessionCookie(login.response);

    const secondStudentEmail = `student-${crypto.randomUUID()}@edusmart-test.example.com`;
    const secondRegistration = await api(baseUrl, '/api/auth/register', {
      method: 'POST',
      body: {
        name: 'Pendaftar Kedua',
        email: secondStudentEmail,
        password: 'Sekolah123',
        role: 'SISWA',
        identityNumber: `NIS-${crypto.randomUUID().slice(0, 12)}`,
        detail: 'X IPA 2'
      }
    });
    assert.equal(secondRegistration.response.status, 201);
    const scoreDb = await mysql.createConnection({ ...mysqlConfig, database: databaseName });
    const [[admin]] = await scoreDb.execute('SELECT id FROM pengguna WHERE email=?', [adminEmail]);
    const [[secondStudent]] = await scoreDb.execute('SELECT id FROM pengguna WHERE email=?', [secondStudentEmail]);
    assert.ok(admin);
    assert.ok(secondStudent);
    const assignmentOne = crypto.randomUUID(), assignmentTwo = crypto.randomUUID();
    const dueAt = new Date(Date.now() + 86400000).toISOString();
    try {
      const insertAssignment = 'INSERT INTO tugas (id,title,instructions,subject,class_name,due_at,max_score,created_by) VALUES (?,?,?,?,?,?,?,?)';
      await scoreDb.execute(insertAssignment, [assignmentOne, 'Tes Nilai Satu', 'Instruksi tes satu.', 'Matematika', 'X IPA 2', dueAt, 100, admin.id]);
      await scoreDb.execute(insertAssignment, [assignmentTwo, 'Tes Nilai Dua', 'Instruksi tes dua.', 'Matematika', 'X IPA 2', dueAt, 200, admin.id]);
      const insertSubmission = 'INSERT INTO pengumpulan (id,assignment_id,student_id,answer_text,score,feedback) VALUES (?,?,?,?,?,?)';
      await scoreDb.execute(insertSubmission, [crypto.randomUUID(), assignmentOne, login.data.user.id, 'Jawaban siswa.', 80, '']);
      await scoreDb.execute(insertSubmission, [crypto.randomUUID(), assignmentTwo, login.data.user.id, 'Jawaban siswa.', 160, '']);
      await scoreDb.execute(insertSubmission, [crypto.randomUUID(), assignmentOne, secondStudent.id, 'Jawaban siswa.', 90, '']);
      await scoreDb.execute(insertSubmission, [crypto.randomUUID(), assignmentTwo, secondStudent.id, 'Jawaban siswa.', 180, '']);
    } finally {
      await scoreDb.end();
    }

    const ownMetrics = await api(baseUrl, `/api/search/${login.data.user.id}/profile`, { cookie: studentCookie });
    assert.equal(ownMetrics.response.status, 200, JSON.stringify(ownMetrics.data));
    assert.equal(ownMetrics.data.averageScore, 80);
    assert.equal(ownMetrics.data.rank, 2);
    assert.equal(ownMetrics.data.approvedAttendance, 0);

    const secondLogin = await api(baseUrl, '/api/auth/login', {
      method: 'POST', body: { email: secondStudentEmail, password: 'Sekolah123' }
    });
    const secondStudentCookie = sessionCookie(secondLogin.response);
    const privateMetrics = await api(baseUrl, `/api/search/${login.data.user.id}/profile`, { cookie: secondStudentCookie });
    assert.equal(privateMetrics.data.canSeeAcademicMetrics, false);
    assert.equal(privateMetrics.data.averageScore, null);
    assert.equal(privateMetrics.data.rank, null);
    assert.equal(privateMetrics.data.approvedAttendance, null);

    const profile = await api(baseUrl, '/api/profile/me', { cookie: studentCookie });
    assert.equal(profile.data.user.name, 'Pendaftar Otomatis');
    assert.equal(profile.data.user.detail, 'X IPA 2');

    const savedBio = await api(baseUrl, '/api/profile/me', {
      method: 'PUT', body: { bio: 'Senang belajar bersama.' }, cookie: studentCookie
    });
    assert.equal(savedBio.response.status, 200);
    const profileAfterEdit = await api(baseUrl, '/api/profile/me', { cookie: studentCookie });
    assert.equal(profileAfterEdit.data.user.bio, 'Senang belajar bersama.');

    const search = await api(baseUrl, '/api/search?q=Pendaftar%20Otomatis', { cookie: studentCookie });
    assert.equal(search.response.status, 200);
    assert.ok(search.data.people.some(person => person.email === undefined && person.name === 'Pendaftar Otomatis'));
  } finally {
    child.kill();
    if (child.exitCode === null) await new Promise(resolve => child.once('exit', resolve));
    try {
      await dropDatabase(databaseName);
    } finally {
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  }
});

test('manual activation, session invalidation, origin checks, and account cleanup', { timeout: 30000 }, async () => {
  const port = await findFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edusmart-account-security-'));
  const databaseName = uniqueDatabaseName();
  const adminEmail = `admin-${crypto.randomUUID()}@example.com`;
  const adminPassword = `Admin-${crypto.randomBytes(18).toString('hex')}-7A`;
  const studentEmail = `student-${crypto.randomUUID()}@example.com`;
  const studentPassword = 'Sekolah123';
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
      AUTO_ACTIVATE_ACCOUNTS: '',
      GOOGLE_CLIENT_ID: '',
      GOOGLE_CLIENT_SECRET: ''
    },
    stdio: 'ignore'
  });

  try {
    let ready = false;
    for (let attempt = 0; attempt < 100 && !ready; attempt++) {
      if (child.exitCode !== null) throw new Error(`Server exited with code ${child.exitCode}`);
      try { ready = (await fetch(`${baseUrl}/api/health`)).ok; } catch {}
      if (!ready) await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(ready, 'Server should start before the smoke-test timeout');

    const adminLogin = await api(baseUrl, '/api/auth/login', {
      method: 'POST', body: { email: adminEmail, password: adminPassword }
    });
    assert.equal(adminLogin.response.status, 200);
    const adminCookie = sessionCookie(adminLogin.response);

    const registration = await api(baseUrl, '/api/auth/register', {
      method: 'POST',
      body: {
        name: 'Siswa Manual', email: studentEmail, password: studentPassword,
        role: 'SISWA', identityNumber: `NIS-${crypto.randomUUID().slice(0, 12)}`, detail: 'X RPL 1'
      }
    });
    assert.equal(registration.response.status, 201);
    assert.equal(registration.data.autoActivated, false);
    const pendingLogin = await api(baseUrl, '/api/auth/login', {
      method: 'POST', body: { email: studentEmail, password: studentPassword }
    });
    assert.equal(pendingLogin.response.status, 403);

    let accounts = await api(baseUrl, '/api/admin/accounts', { cookie: adminCookie });
    const account = accounts.data.accounts.find(item => item.email === studentEmail);
    assert.equal(account.status, 'PENDING');

    const crossOrigin = await fetch(`${baseUrl}/api/admin/accounts/${account.id}/status`, {
      method: 'PATCH',
      headers: { Origin: 'https://attacker.example', Cookie: adminCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'AKTIF' })
    });
    assert.equal(crossOrigin.status, 403);
    const invalidStatus = await api(baseUrl, `/api/admin/accounts/${account.id}/status`, {
      method: 'PATCH', cookie: adminCookie, body: { status: 'DIHAPUS' }
    });
    assert.equal(invalidStatus.response.status, 422);

    const activation = await api(baseUrl, `/api/admin/accounts/${account.id}/status`, {
      method: 'PATCH', cookie: adminCookie, body: { status: 'AKTIF' }
    });
    assert.equal(activation.response.status, 200);
    const firstLogin = await api(baseUrl, '/api/auth/login', {
      method: 'POST', body: { email: studentEmail, password: studentPassword }
    });
    const firstCookie = sessionCookie(firstLogin.response);
    const secondLogin = await api(baseUrl, '/api/auth/login', {
      method: 'POST', body: { email: studentEmail, password: studentPassword }
    });
    const studentCookie = sessionCookie(secondLogin.response);
    const oldSession = await api(baseUrl, '/api/profile/me', { cookie: firstCookie });
    assert.equal(oldSession.response.status, 401, 'A new login must invalidate the previous session');

    const forbiddenAdminList = await api(baseUrl, '/api/admin/accounts', { cookie: studentCookie });
    assert.equal(forbiddenAdminList.response.status, 403);
    const malformedJson = await fetch(`${baseUrl}/api/profile/me`, {
      method: 'PUT',
      headers: { Origin: baseUrl, Cookie: studentCookie, 'Content-Type': 'application/json' },
      body: '{'
    });
    assert.equal(malformedJson.status, 400);

    const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
    const avatarForm = new FormData();
    avatarForm.append('image', new Blob([tinyPng], { type: 'image/png' }), 'avatar.png');
    const avatarUpload = await fetch(`${baseUrl}/api/profile/media/avatar`, {
      method: 'POST', headers: { Origin: baseUrl, Cookie: studentCookie }, body: avatarForm
    });
    assert.equal(avatarUpload.status, 200);
    assert.equal(fs.readdirSync(path.join(dataDir, 'profile-media')).length, 1);

    const reset = await api(baseUrl, `/api/admin/accounts/${account.id}/password`, {
      method: 'PATCH', cookie: adminCookie, body: {}
    });
    assert.equal(reset.response.status, 200);
    assert.ok(reset.data.temporaryPassword);
    const resetSession = await api(baseUrl, '/api/profile/me', { cookie: studentCookie });
    assert.equal(resetSession.response.status, 401, 'Password reset must invalidate existing sessions');
    const oldPasswordLogin = await api(baseUrl, '/api/auth/login', {
      method: 'POST', body: { email: studentEmail, password: studentPassword }
    });
    assert.equal(oldPasswordLogin.response.status, 401);
    const temporaryLogin = await api(baseUrl, '/api/auth/login', {
      method: 'POST', body: { email: studentEmail, password: reset.data.temporaryPassword }
    });
    assert.equal(temporaryLogin.response.status, 200);
    const temporaryCookie = sessionCookie(temporaryLogin.response);

    const deactivation = await api(baseUrl, `/api/admin/accounts/${account.id}/status`, {
      method: 'PATCH', cookie: adminCookie, body: { status: 'NONAKTIF' }
    });
    assert.equal(deactivation.response.status, 200);
    const deactivatedSession = await api(baseUrl, '/api/profile/me', { cookie: temporaryCookie });
    assert.equal(deactivatedSession.response.status, 401, 'Deactivation must invalidate existing sessions');
    const deactivatedLogin = await api(baseUrl, '/api/auth/login', {
      method: 'POST', body: { email: studentEmail, password: reset.data.temporaryPassword }
    });
    assert.equal(deactivatedLogin.response.status, 403);

    await api(baseUrl, `/api/admin/accounts/${account.id}/status`, {
      method: 'PATCH', cookie: adminCookie, body: { status: 'AKTIF' }
    });
    const selfDelete = await api(baseUrl, `/api/admin/accounts/${adminLogin.data.user.id}`, {
      method: 'DELETE', cookie: adminCookie
    });
    assert.equal(selfDelete.response.status, 400);
    const deletion = await api(baseUrl, `/api/admin/accounts/${account.id}`, {
      method: 'DELETE', cookie: adminCookie
    });
    assert.equal(deletion.response.status, 200);
    accounts = await api(baseUrl, '/api/admin/accounts', { cookie: adminCookie });
    assert.equal(accounts.data.accounts.some(item => item.id === account.id), false);
    assert.equal(fs.readdirSync(path.join(dataDir, 'profile-media')).length, 0);
  } finally {
    child.kill();
    if (child.exitCode === null) await new Promise(resolve => child.once('exit', resolve));
    try {
      await dropDatabase(databaseName);
    } finally {
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  }
});
