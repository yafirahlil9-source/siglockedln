const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const mysql = require('mysql2/promise');
const ExcelJS = require('exceljs');
const { test } = require('node:test');

const projectRoot = path.resolve(__dirname, '..');
require('dotenv').config({ path: path.join(projectRoot, '.env') });
const mysqlConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || ''
};
const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');

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

function sessionCookie(response) {
  const cookie = response.headers.getSetCookie().find(value => value.startsWith('edusmart.sid='));
  assert.ok(cookie, 'Expected a session cookie');
  return cookie.split(';', 1)[0];
}

async function api(baseUrl, endpoint, { method = 'GET', body, cookie, headers = {} } = {}) {
  const requestHeaders = { Origin: baseUrl, ...headers };
  if (cookie) requestHeaders.Cookie = cookie;
  if (body !== undefined) requestHeaders['Content-Type'] = 'application/json';
  const response = await fetch(`${baseUrl}${endpoint}`, {
    method,
    headers: requestHeaders,
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body)
  });
  const data = await response.json();
  return { response, data };
}

async function postForm(baseUrl, endpoint, fields, cookie, file, fileField = 'file') {
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    if (value !== undefined && value !== null && value !== '') form.append(name, String(value));
  }
  if (file) form.append(fileField, new Blob([file.buffer], { type: file.type || 'application/octet-stream' }), file.name);
  const response = await fetch(`${baseUrl}${endpoint}`, {
    method: 'POST',
    headers: { Origin: baseUrl, Cookie: cookie },
    body: form
  });
  return { response, data: await response.json() };
}

async function startServer(databaseName, dataDir, adminEmail, adminPassword) {
  const port = 30000 + crypto.randomInt(20000);
  const baseUrl = `http://127.0.0.1:${port}`;
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
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let output = '';
  child.stdout.on('data', chunk => { output += chunk.toString(); });
  child.stderr.on('data', chunk => { output += chunk.toString(); });
  let ready = false;
  for (let attempt = 0; attempt < 120 && !ready; attempt++) {
    if (child.exitCode !== null) throw new Error(`Server exited before startup: ${output}`);
    try {
      ready = (await fetch(`${baseUrl}/api/health`)).ok;
    } catch {}
    if (!ready) await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(ready, `Server should start: ${output}`);
  return {
    baseUrl,
    async stop() {
      if (child.exitCode === null && child.signalCode === null) {
        await new Promise(resolve => {
          child.once('exit', resolve);
          child.kill();
        });
      }
    }
  };
}

async function login(baseUrl, email, password) {
  const result = await api(baseUrl, '/api/auth/login', { method: 'POST', body: { email, password } });
  assert.equal(result.response.status, 200, JSON.stringify(result.data));
  return { cookie: sessionCookie(result.response), user: result.data.user };
}

async function seedLegacyAcademicData(databaseName) {
  const connection = await mysql.createConnection(mysqlConfig);
  const teacherId = crypto.randomUUID();
  const studentId = crypto.randomUUID();
  try {
    await connection.query(`CREATE DATABASE \`${databaseName}\``);
    await connection.query('USE `' + databaseName + '`');
    await connection.query(`CREATE TABLE pengguna (
      id VARCHAR(36) PRIMARY KEY, full_name VARCHAR(120) NOT NULL, email VARCHAR(120) NOT NULL UNIQUE,
      password_hash VARCHAR(255), role ENUM('SISWA','GURU','STAF','ADMIN') NOT NULL,
      identity_number VARCHAR(30) NOT NULL UNIQUE, detail VARCHAR(80) NOT NULL DEFAULT '', bio VARCHAR(300) NOT NULL DEFAULT '',
      google_id VARCHAR(100) UNIQUE, status ENUM('PENDING','AKTIF','NONAKTIF') NOT NULL DEFAULT 'PENDING',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB`);
    await connection.query(`CREATE TABLE tugas (
      id VARCHAR(36) PRIMARY KEY, title VARCHAR(150) NOT NULL, instructions TEXT NOT NULL,
      subject VARCHAR(80) NOT NULL, class_name VARCHAR(60) NOT NULL, due_at VARCHAR(30) NOT NULL,
      max_score DOUBLE NOT NULL DEFAULT 100, created_by VARCHAR(36) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES pengguna(id)
    ) ENGINE=InnoDB`);
    await connection.execute(
      'INSERT INTO pengguna (id,full_name,email,role,identity_number,detail,status) VALUES (?,?,?,?,?,?,?)',
      [teacherId, 'Guru Lama', `legacy-${crypto.randomUUID()}@example.com`, 'GURU', `NIP-${crypto.randomUUID()}`, 'Matematika, Bahasa Inggris', 'AKTIF']
    );
    await connection.execute(
      'INSERT INTO pengguna (id,full_name,email,role,identity_number,detail,status) VALUES (?,?,?,?,?,?,?)',
      [studentId, 'Siswa Lama', `legacy-student-${crypto.randomUUID()}@example.com`, 'SISWA', `NIS-${crypto.randomUUID()}`, 'X RPL 9', 'AKTIF']
    );
    await connection.execute(
      'INSERT INTO tugas (id,title,instructions,subject,class_name,due_at,created_by) VALUES (?,?,?,?,?,?,?)',
      [crypto.randomUUID(), 'Tugas Lama', 'Instruksi tugas lama.', 'Fisika Lama', 'X RPL 9', new Date(Date.now() + 86400000).toISOString(), teacherId]
    );
    return teacherId;
  } finally {
    await connection.end();
  }
}

test('legacy teacher subjects and classes are migrated into academic links', { timeout: 30000 }, async () => {
  const databaseName = uniqueDatabaseName();
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edusmart-academic-legacy-'));
  const adminEmail = `admin-${crypto.randomUUID()}@example.com`;
  const adminPassword = `Admin-${crypto.randomBytes(18).toString('hex')}-7A`;
  let server;
  try {
    const teacherId = await seedLegacyAcademicData(databaseName);
    server = await startServer(databaseName, dataDir, adminEmail, adminPassword);
    const { cookie } = await login(server.baseUrl, adminEmail, adminPassword);
    const result = await api(server.baseUrl, '/api/admin/teachers', { cookie });
    assert.equal(result.response.status, 200);
    const teacher = result.data.teachers.find(item => item.id === teacherId);
    assert.ok(teacher);
    const names = result.data.subjects.filter(subject => teacher.subjectIds.includes(subject.id)).map(subject => subject.name);
    assert.deepEqual(names.sort(), ['Bahasa Inggris', 'Fisika Lama', 'Matematika'].sort());
    const classNames = result.data.classes.filter(cls => teacher.classIds.includes(cls.id)).map(cls => cls.name);
    assert.deepEqual(classNames, ['X RPL 9']);
    assert.ok(result.data.subjects.some(subject => subject.name === 'Fisika Lama'));
  } finally {
    await server?.stop();
    await dropDatabase(databaseName);
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});

test('academic administration, materials, tasks, attendance exports, and photo MIME detection', { timeout: 60000 }, async () => {
  const databaseName = uniqueDatabaseName();
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edusmart-academic-workflow-'));
  const adminEmail = `admin-${crypto.randomUUID()}@example.com`;
  const adminPassword = `Admin-${crypto.randomBytes(18).toString('hex')}-7A`;
  const teacherEmail = `teacher-${crypto.randomUUID()}@example.com`;
  const teacherPassword = 'Sekolah123';
  const studentEmail = `student-${crypto.randomUUID()}@example.com`;
  const studentPassword = 'Sekolah123';
  let server;
  try {
    server = await startServer(databaseName, dataDir, adminEmail, adminPassword);
    const admin = await login(server.baseUrl, adminEmail, adminPassword);
    let result = await api(server.baseUrl, '/api/subjects');
    assert.equal(result.response.status, 200);
    const subjects = result.data.subjects;
    const math = subjects.find(subject => subject.name === 'Matematika');
    const english = subjects.find(subject => subject.name === 'Bahasa Inggris');
    assert.ok(math && english);

    result = await api(server.baseUrl, '/api/admin/subjects', {
      method: 'POST', cookie: admin.cookie, body: { name: 'Seni Budaya' }
    });
    assert.equal(result.response.status, 201, JSON.stringify(result.data));
    const artId = result.data.id;
    const longSubjectIds = [math.id, artId];
    for (let index = 0; index < 12; index++) {
      result = await api(server.baseUrl, '/api/admin/subjects', {
        method: 'POST', cookie: admin.cookie, body: { name: `Mapel Panjang ${index}` }
      });
      assert.equal(result.response.status, 201);
      longSubjectIds.push(result.data.id);
    }
    result = await api(server.baseUrl, '/api/admin/subjects', {
      method: 'POST', cookie: admin.cookie, body: { name: 'Seni Budaya' }
    });
    assert.equal(result.response.status, 409);
    result = await api(server.baseUrl, '/api/admin/subjects', {
      method: 'POST', cookie: admin.cookie, body: { name: 'X RPL 1' }
    });
    assert.equal(result.response.status, 409);

    result = await api(server.baseUrl, '/api/auth/register', {
      method: 'POST',
      body: {
        name: 'Guru Multi Mapel', email: teacherEmail, password: teacherPassword,
        role: 'GURU', identityNumber: `NIP-${crypto.randomUUID().slice(0, 12)}`, subjectIds: []
      }
    });
    assert.equal(result.response.status, 422);
    result = await api(server.baseUrl, '/api/auth/register', {
      method: 'POST',
      body: {
        name: 'Guru Multi Mapel', email: teacherEmail, password: teacherPassword,
        role: 'GURU', identityNumber: `NIP-${crypto.randomUUID().slice(0, 12)}`, subjectIds: [math.id, artId, math.id]
      }
    });
    assert.equal(result.response.status, 201, JSON.stringify(result.data));
    const teacher = await login(server.baseUrl, teacherEmail, teacherPassword);

    const longTeacherEmail = `teacher-long-${crypto.randomUUID()}@example.com`;
    result = await api(server.baseUrl, '/api/auth/register', {
      method: 'POST',
      body: {
        name: 'Guru Banyak Mapel', email: longTeacherEmail, password: teacherPassword,
        role: 'GURU', identityNumber: `NIP-${crypto.randomUUID().slice(0, 12)}`, subjectIds: longSubjectIds
      }
    });
    assert.equal(result.response.status, 201, JSON.stringify(result.data));
    const longTeacher = await login(server.baseUrl, longTeacherEmail, teacherPassword);
    assert.ok(longTeacher.user.detail.length > 80, 'Long subject lists must not be truncated by the database column');
    const longTeacherProfile = await api(server.baseUrl, '/api/profile/me', { cookie: longTeacher.cookie });
    assert.equal(longTeacherProfile.data.user.detail, longTeacher.user.detail);
    const longTeaching = await api(server.baseUrl, '/api/teaching/me', { cookie: longTeacher.cookie });
    assert.equal(longTeaching.data.subjects.length, longSubjectIds.length);

    const classesResult = await api(server.baseUrl, '/api/classes', { cookie: admin.cookie });
    const targetClass = classesResult.data.classes.find(cls => cls.name === 'X RPL 1');
    assert.ok(targetClass);
    assert.equal(teacher.user.detail, 'Matematika, Seni Budaya');

    result = await api(server.baseUrl, '/api/teaching/me', { cookie: teacher.cookie });
    assert.equal(result.response.status, 200);
    assert.equal(result.data.subjects.length, 2);
    assert.deepEqual(result.data.classes.map(cls => cls.name), classesResult.data.classes.map(cls => cls.name));

    const secondTeacherEmail = `teacher-second-${crypto.randomUUID()}@example.com`;
    result = await api(server.baseUrl, '/api/auth/register', {
      method: 'POST',
      body: {
        name: 'Guru Kedua', email: secondTeacherEmail, password: teacherPassword,
        role: 'GURU', identityNumber: `NIP-${crypto.randomUUID().slice(0, 12)}`, subjectIds: [english.id]
      }
    });
    assert.equal(result.response.status, 201);
    const secondTeacher = await login(server.baseUrl, secondTeacherEmail, teacherPassword);

    result = await postForm(server.baseUrl, '/api/materials', {
      subjectId: english.id, title: 'Materi Tidak Diampu', content: 'Isi materi yang tidak diampu guru.'
    }, teacher.cookie);
    assert.equal(result.response.status, 403);

    result = await postForm(server.baseUrl, '/api/materials', {
      subjectId: artId, title: 'Materi Seni', content: 'Materi dasar seni budaya.', url: 'https://example.com/materi'
    }, teacher.cookie, { name: 'materi.txt', type: 'text/plain', buffer: Buffer.from('Isi berkas materi') });
    assert.equal(result.response.status, 201, JSON.stringify(result.data));
    const artMaterialId = result.data.id;
    result = await postForm(server.baseUrl, '/api/materials', {
      subjectId: math.id, title: 'Materi Matematika', content: 'Materi dasar matematika.'
    }, teacher.cookie, { name: 'matematika.txt', type: 'text/plain', buffer: Buffer.from('Isi matematika') });
    assert.equal(result.response.status, 201, JSON.stringify(result.data));
    const mathMaterialId = result.data.id;

    result = await api(server.baseUrl, `/api/materials/${artMaterialId}`, { method: 'DELETE', cookie: secondTeacher.cookie });
    assert.equal(result.response.status, 403);
    result = await api(server.baseUrl, `/api/materials/${artMaterialId}`, { method: 'DELETE', cookie: admin.cookie });
    assert.equal(result.response.status, 403);

    const fileResponse = await fetch(`${server.baseUrl}/api/materials/${artMaterialId}/file`, { headers: { Cookie: teacher.cookie } });
    assert.equal(fileResponse.status, 200);
    assert.equal(await fileResponse.text(), 'Isi berkas materi');

    const dueAt = new Date(Date.now() + 86400000).toISOString();
    const taskFields = {
      title: 'Tugas Seni Budaya', instructions: 'Kerjakan tugas sesuai materi.',
      subjectId: artId, className: targetClass.name, category: 'Teori', dueAt, maxScore: 100
    };
    result = await postForm(server.baseUrl, '/api/assignments', taskFields, teacher.cookie);
    assert.equal(result.response.status, 422);
    result = await postForm(server.baseUrl, '/api/assignments', {
      ...taskFields, materialId: artMaterialId, className: 'XII RPL 1'
    }, teacher.cookie);
    assert.equal(result.response.status, 201, JSON.stringify(result.data));
    result = await postForm(server.baseUrl, '/api/assignments', {
      ...taskFields, materialId: mathMaterialId
    }, teacher.cookie);
    assert.equal(result.response.status, 422);
    result = await postForm(server.baseUrl, '/api/assignments', {
      ...taskFields, materialId: artMaterialId
    }, teacher.cookie);
    assert.equal(result.response.status, 201, JSON.stringify(result.data));
    const assignmentId = result.data.id;

    result = await api(server.baseUrl, '/api/assignments', { cookie: teacher.cookie });
    const assignment = result.data.assignments.find(item => item.id === assignmentId);
    assert.equal(assignment.subjectId, artId);
    assert.equal(assignment.materialId, artMaterialId);
    assert.equal(assignment.materialTitle, 'Materi Seni');
    assert.deepEqual(result.data.availableClasses, classesResult.data.classes.map(cls => cls.name));

    result = await api(server.baseUrl, `/api/assignments/${assignmentId}`, { method: 'DELETE', cookie: secondTeacher.cookie });
    assert.equal(result.response.status, 403);
    result = await api(server.baseUrl, `/api/assignments/${assignmentId}`, { method: 'DELETE', cookie: admin.cookie });
    assert.equal(result.response.status, 403);

    result = await api(server.baseUrl, '/api/auth/register', {
      method: 'POST',
      body: {
        name: 'Siswa Ekspor', email: studentEmail, password: studentPassword, role: 'SISWA',
        identityNumber: '=1+1', detail: targetClass.name
      }
    });
    assert.equal(result.response.status, 201);
    const student = await login(server.baseUrl, studentEmail, studentPassword);
    result = await api(server.baseUrl, '/api/assignments', { cookie: student.cookie });
    assert.ok(result.data.assignments.some(item => item.id === assignmentId));

    const db = await mysql.createConnection({ ...mysqlConfig, database: databaseName });
    const photoIds = [];
    try {
      const expiredTaskFields = {
        ...taskFields, materialId: artMaterialId,
        title: 'Tugas Kedaluwarsa', dueAt: new Date(Date.now() - 3600000).toISOString()
      };
      result = await postForm(server.baseUrl, '/api/assignments', expiredTaskFields, teacher.cookie);
      assert.equal(result.response.status, 201);
      const expiredAssignmentId = result.data.id;
      result = await postForm(server.baseUrl, `/api/assignments/${expiredAssignmentId}/submit`, {
        answerText: 'Jawaban terlambat'
      }, student.cookie);
      assert.equal(result.response.status, 403);

      const otherClass = classesResult.data.classes.find(cls => cls.name !== targetClass.name);
      const wrongClassEmail = `student-other-${crypto.randomUUID()}@example.com`;
      result = await api(server.baseUrl, '/api/auth/register', {
        method: 'POST',
        body: {
          name: 'Siswa Kelas Lain', email: wrongClassEmail, password: studentPassword,
          role: 'SISWA', identityNumber: 'NIS-other-class', detail: otherClass.name
        }
      });
      assert.equal(result.response.status, 201);
      const wrongClassStudent = await login(server.baseUrl, wrongClassEmail, studentPassword);
      result = await postForm(server.baseUrl, `/api/assignments/${assignmentId}/submit`, {
        answerText: 'Jawaban salah kelas'
      }, wrongClassStudent.cookie);
      assert.equal(result.response.status, 403);

      result = await postForm(server.baseUrl, `/api/assignments/${assignmentId}/submit`, {
        answerText: 'Jawaban siswa'
      }, student.cookie);
      assert.equal(result.response.status, 200);
      const submissionList = await api(server.baseUrl, `/api/assignments/${assignmentId}/submissions`, { cookie: teacher.cookie });
      assert.equal(submissionList.response.status, 200);
      const submission = submissionList.data.submissions.find(item => item.studentId === student.user.id);
      assert.ok(submission);
      result = await api(server.baseUrl, `/api/submissions/${submission.id}/grade`, {
        method: 'PATCH', cookie: teacher.cookie, body: { score: 101, feedback: 'Nilai terlalu tinggi' }
      });
      assert.equal(result.response.status, 422);
      result = await api(server.baseUrl, `/api/submissions/${submission.id}/grade`, {
        method: 'PATCH', cookie: admin.cookie, body: { score: 90 }
      });
      assert.equal(result.response.status, 403);
      result = await api(server.baseUrl, `/api/submissions/${submission.id}/grade`, {
        method: 'PATCH', cookie: secondTeacher.cookie, body: { score: 90 }
      });
      assert.equal(result.response.status, 403);
      result = await api(server.baseUrl, `/api/submissions/${submission.id}/grade`, {
        method: 'PATCH', cookie: teacher.cookie, body: { score: 90, feedback: 'Baik' }
      });
      assert.equal(result.response.status, 200);

      result = await postForm(server.baseUrl, '/api/posts', {
        title: 'Unggahan gambar palsu', body: 'HTML tidak boleh diperlakukan sebagai gambar.'
      }, student.cookie, {
        name: 'palsu.html', type: 'image/png', buffer: Buffer.from('<script>alert(1)</script>')
      }, 'image');
      assert.equal(result.response.status, 422);
      const legacyPostId = crypto.randomUUID();
      await db.execute('INSERT INTO postingan (id,author_id,title,body,image_name) VALUES (?,?,?,?,?)',
        [legacyPostId, student.user.id, 'Gambar lama rusak', 'Foto lama', 'legacy-post.html']);
      fs.writeFileSync(path.join(dataDir, 'post-images', 'legacy-post.html'), '<script>alert(1)</script>');
      const legacyImageResponse = await fetch(`${server.baseUrl}/api/posts/${legacyPostId}/image`, { headers: { Cookie: student.cookie } });
      assert.equal(legacyImageResponse.status, 415);

      const rows = [
        { id: crypto.randomUUID(), day: '2026-11-01', photoName: 'legacy-photo.jpg', verification: 'DISETUJUI' },
        { id: crypto.randomUUID(), day: '2026-11-02', photoName: 'corrupt-photo.jpg', verification: 'DITOLAK' }
      ];
      for (const row of rows) {
        photoIds.push(row.id);
        await db.execute(
          'INSERT INTO kehadiran (id,user_id,day,photo_name,latitude,longitude,accuracy,captured_at,verification) VALUES (?,?,?,?,?,?,?,?,?)',
          [row.id, student.user.id, row.day, row.photoName, -7.164041847763249, 112.64734569558635, 12, `${row.day}T01:00:00.000Z`, row.verification]
        );
      }
      const [[{ file_name: mathFileName }]] = await db.execute('SELECT file_name FROM materi WHERE id=?', [mathMaterialId]);
      result = await api(server.baseUrl, `/api/materials/${mathMaterialId}`, { method: 'DELETE', cookie: teacher.cookie });
      assert.equal(result.response.status, 200);
      assert.equal(fs.existsSync(path.join(dataDir, 'materials', mathFileName)), false);
    } finally {
      await db.end();
    }
    fs.writeFileSync(path.join(dataDir, 'attendance-photos', 'legacy-photo.jpg'), tinyPng);
    fs.writeFileSync(path.join(dataDir, 'attendance-photos', 'corrupt-photo.jpg'), 'bukan gambar');

    const exportParams = new URLSearchParams({
      startDate: '2026-11-01', endDate: '2026-11-02', className: targetClass.name,
      status: 'DISETUJUI', format: 'xlsx'
    });
    let exportResponse = await fetch(`${server.baseUrl}/api/admin/attendance/export?${exportParams}`, { headers: { Cookie: admin.cookie } });
    assert.equal(exportResponse.status, 200);
    assert.match(exportResponse.headers.get('content-type'), /spreadsheetml/);
    const workbookBuffer = Buffer.from(await exportResponse.arrayBuffer());
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(workbookBuffer);
    assert.deepEqual(workbook.worksheets.map(sheet => sheet.name), ['Ringkasan', 'Kehadiran']);
    const detail = workbook.getWorksheet('Kehadiran');
    assert.equal(detail.rowCount, 2);
    assert.equal(detail.getCell('C2').value, "'=1+1");

    exportParams.set('format', 'doc');
    exportResponse = await fetch(`${server.baseUrl}/api/admin/attendance/export?${exportParams}`, { headers: { Cookie: admin.cookie } });
    assert.equal(exportResponse.status, 200);
    assert.match(exportResponse.headers.get('content-type'), /msword/);
    assert.match(await exportResponse.text(), /Laporan Kehadiran/);

    let summaryExport = await fetch(`${server.baseUrl}/api/admin/reports/export?format=xlsx`, { headers: { Cookie: admin.cookie } });
    assert.equal(summaryExport.status, 200);
    assert.match(summaryExport.headers.get('content-type'), /spreadsheetml/);
    const summaryBook = new ExcelJS.Workbook();
    await summaryBook.xlsx.load(Buffer.from(await summaryExport.arrayBuffer()));
    assert.deepEqual(summaryBook.worksheets.map(sheet => sheet.name), ['Ringkasan Sekolah']);
    assert.ok(summaryBook.getWorksheet('Ringkasan Sekolah').rowCount >= 14);

    summaryExport = await fetch(`${server.baseUrl}/api/admin/reports/export?format=doc`, { headers: { Cookie: admin.cookie } });
    assert.equal(summaryExport.status, 200);
    assert.match(summaryExport.headers.get('content-type'), /msword/);
    assert.match(await summaryExport.text(), /Laporan Ringkasan Sekolah/);

    summaryExport = await fetch(`${server.baseUrl}/api/admin/reports/export?format=pdf`, { headers: { Cookie: admin.cookie } });
    assert.equal(summaryExport.status, 422);

    let photoResponse = await fetch(`${server.baseUrl}/api/attendance/${photoIds[0]}/photo`, { headers: { Cookie: admin.cookie } });
    assert.equal(photoResponse.status, 200);
    assert.equal(photoResponse.headers.get('content-type'), 'image/png');
    assert.deepEqual(Buffer.from(await photoResponse.arrayBuffer()), tinyPng);
    photoResponse = await fetch(`${server.baseUrl}/api/attendance/${photoIds[1]}/photo`, { headers: { Cookie: admin.cookie } });
    assert.equal(photoResponse.status, 415);

    result = await api(server.baseUrl, `/api/admin/subjects/${artId}`, { method: 'DELETE', cookie: admin.cookie });
    assert.equal(result.response.status, 409);
    result = await api(server.baseUrl, '/api/admin/subjects', {
      method: 'POST', cookie: admin.cookie, body: { name: 'Mapel Sementara' }
    });
    assert.equal(result.response.status, 201);
    result = await api(server.baseUrl, `/api/admin/subjects/${result.data.id}`, { method: 'DELETE', cookie: admin.cookie });
    assert.equal(result.response.status, 200);
  } finally {
    await server?.stop();
    await dropDatabase(databaseName);
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});
