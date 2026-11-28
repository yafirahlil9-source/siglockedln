require('dotenv').config();

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { rateLimit } = require('express-rate-limit');
const helmet = require('helmet');
const ExcelJS = require('exceljs');
const { z } = require('zod');
const multer = require('multer');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const dataDir = path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data'));
const publicDir = path.join(__dirname, 'public');
const photoDir = path.join(dataDir, 'attendance-photos');
const submissionDir = path.join(dataDir, 'submissions');
const profileMediaDir = path.join(dataDir, 'profile-media');
const postImageDir = path.join(dataDir, 'post-images');
const assignmentAttachmentDir = path.join(dataDir, 'assignment-attachments');
const materialDir = path.join(dataDir, 'materials');
const isProduction = process.env.NODE_ENV === 'production';
const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
const autoActivateAccounts = process.env.AUTO_ACTIVATE_ACCOUNTS === 'true';
const photoUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } });
const submissionUpload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: 25 * 1024 * 1024, files: 1 }
});

const postImageUpload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: 10 * 1024 * 1024, files: 1 }
});

const assignmentUpload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: 25 * 1024 * 1024, files: 1 }
});

const materialUpload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: 25 * 1024 * 1024, files: 1 }
});

if (isProduction) {
	const appUrl = process.env.APP_URL ? new URL(process.env.APP_URL) : null;
	const sessionSecret = process.env.SESSION_SECRET || '';
	const seedAdminEmail = process.env.SEED_ADMIN_EMAIL || '';
	const seedAdminPassword = process.env.SEED_ADMIN_PASSWORD || '';
	if (!appUrl || appUrl.protocol !== 'https:' || sessionSecret.length < 32 || /replace|change|development-only/i.test(sessionSecret)) {
		throw new Error('Production requires an HTTPS APP_URL and a unique SESSION_SECRET with at least 32 characters.');
	}
	if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
		throw new Error('Production requires Google OAuth credentials because Google login is part of the configured sign-in flow.');
	}
	if (!seedAdminEmail || /(^|[.@])example([.@]|$)/i.test(seedAdminEmail) || !seedAdminPassword || seedAdminPassword.length < 12 || /replace-with|change-this/i.test(seedAdminPassword)) {
		throw new Error('Production requires a unique initial admin email and a strong password of at least 12 characters.');
	}
	if (process.env.AUTO_ACTIVATE_ACCOUNTS === 'true') {
		throw new Error('Production requires manual account activation. Set AUTO_ACTIVATE_ACCOUNTS=false.');
	}
}

fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(photoDir, { recursive: true });
fs.mkdirSync(submissionDir, { recursive: true });
fs.mkdirSync(profileMediaDir, { recursive: true });
fs.mkdirSync(postImageDir, { recursive: true });
fs.mkdirSync(assignmentAttachmentDir, { recursive: true });
fs.mkdirSync(materialDir, { recursive: true });

async function writeFileAtomic(filePath, buffer, overwrite = false) {
	const tempPath = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${process.pid}.${crypto.randomUUID()}.tmp`);
	try {
		const handle = await fs.promises.open(tempPath, 'wx', 0o600);
		try {
			await handle.writeFile(buffer);
			await handle.sync();
		} finally {
			await handle.close();
		}
		if (overwrite) await fs.promises.rename(tempPath, filePath);
		else await fs.promises.link(tempPath, filePath);
	} finally {
		await fs.promises.unlink(tempPath).catch(() => {});
	}
}

const pool = mysql.createPool({
	host: process.env.DB_HOST || 'localhost',
	user: process.env.DB_USER || 'root',
	password: process.env.DB_PASSWORD || '',
	database: process.env.DB_NAME || 'sekolah_hub',
	port: Number(process.env.DB_PORT || 3306),
	waitForConnections: true,
	connectionLimit: 10
});

class MysqlSessionStore extends session.Store {
	async _init() {
		await pool.execute('CREATE TABLE IF NOT EXISTS sesi (sid VARCHAR(255) PRIMARY KEY, sess TEXT NOT NULL, expire BIGINT NOT NULL) ENGINE=InnoDB');
	}
	get(sid, callback) {
		pool.execute('SELECT sess, expire FROM sesi WHERE sid=?', [sid]).then(([rows]) => {
			if (!rows.length) return callback(null, null);
			if (rows[0].expire <= Date.now()) {
				pool.execute('DELETE FROM sesi WHERE sid=?', [sid]).catch(() => {});
				return callback(null, null);
			}
			callback(null, JSON.parse(rows[0].sess));
		}).catch(error => callback(error));
	}
	set(sid, value, callback = () => {}) {
		const expiresAt = value.cookie?.expires ? new Date(value.cookie.expires).getTime() : Date.now() + 7 * 24 * 60 * 60 * 1000;
		pool.execute('INSERT INTO sesi (sid, sess, expire) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE sess=VALUES(sess), expire=VALUES(expire)', [sid, JSON.stringify(value), expiresAt])
			.then(() => callback(null)).catch(error => callback(error));
	}
	destroy(sid, callback = () => {}) {
		pool.execute('DELETE FROM sesi WHERE sid=?', [sid])
			.then(() => callback(null)).catch(error => callback(error));
	}
	touch(sid, value, callback = () => {}) { this.set(sid, value, callback); }
}

const sessionStore = new MysqlSessionStore();

app.disable('x-powered-by');
app.set('trust proxy', isProduction ? 1 : false);
app.use(helmet({
	contentSecurityPolicy: {
		directives: {
			defaultSrc: ["'self'"],
			scriptSrc: ["'self'", "'unsafe-eval'"],
			styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
			fontSrc: ["'self'", 'https://fonts.gstatic.com'],
			imgSrc: ["'self'", 'data:', 'blob:'],
			connectSrc: ["'self'", 'https://accounts.google.com', 'data:', 'blob:'],
			objectSrc: ["'none'"],
			frameAncestors: ["'none'"]
		}
	},
	crossOriginEmbedderPolicy: false
}));
app.use(express.json({ limit: '64kb' }));
app.use(express.urlencoded({ extended: false, limit: '16kb' }));
app.use(session({
	name: 'edusmart.sid',
	secret: process.env.SESSION_SECRET || 'development-only-change-before-deploy-please',
	store: sessionStore,
	resave: false,
	saveUninitialized: false,
	cookie: { httpOnly: true, secure: isProduction, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

const db = {
	get: async (sql, ...params) => {
		const [rows] = await pool.execute(sql, params);
		return rows[0] || null;
	},
	all: async (sql, ...params) => {
		const [rows] = await pool.execute(sql, params);
		return rows;
	},
	run: async (sql, ...params) => {
		const [result] = await pool.execute(sql, params);
		return { changes: result.affectedRows, lastID: result.insertId };
	}
};

const databasePromise = (async () => {
	const initConn = await mysql.createConnection({
		host: process.env.DB_HOST || 'localhost',
		user: process.env.DB_USER || 'root',
		password: process.env.DB_PASSWORD || '',
		port: Number(process.env.DB_PORT || 3306)
	});
	await initConn.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME || 'sekolah_hub'}\``);
	const [migrationLock] = await initConn.query("SELECT GET_LOCK('sekolah_hub_schema_migration', 60) AS acquired");
	if (migrationLock[0].acquired !== 1) throw new Error('Database migration lock could not be acquired.');
	try {
	const tableRenames = {
		sessions: 'sesi',
		users: 'pengguna',
		school_settings: 'pengaturan_sekolah',
		posts: 'postingan',
		post_likes: 'suka_postingan',
		comments: 'komentar',
		classes: 'kelas',
		assignments: 'tugas',
		submissions: 'pengumpulan',
		attendance: 'kehadiran',
		notifications: 'notifikasi'
	};
	const [existingTables] = await pool.execute(
		'SELECT TABLE_NAME AS tableName FROM information_schema.tables WHERE TABLE_SCHEMA = DATABASE()'
	);
	const existingTableNames = new Set(existingTables.map(table => table.tableName));
	const conflicts = Object.entries(tableRenames).filter(([legacy, target]) =>
		existingTableNames.has(legacy) && existingTableNames.has(target)
	);
	if (conflicts.length > 0) {
		throw new Error(`Database migration aborted: both legacy and target tables exist (${conflicts.map(([legacy, target]) => `${legacy} -> ${target}`).join(', ')}). No tables were renamed.`);
	}
	const renames = Object.entries(tableRenames)
		.filter(([legacy, target]) => existingTableNames.has(legacy) && !existingTableNames.has(target))
		.map(([legacy, target]) => `\`${legacy}\` TO \`${target}\``);
	if (renames.length > 0) await pool.execute(`RENAME TABLE ${renames.join(', ')}`);

	await sessionStore._init();

	await pool.execute(`CREATE TABLE IF NOT EXISTS pengguna (
		id VARCHAR(36) PRIMARY KEY, full_name VARCHAR(120) NOT NULL, email VARCHAR(120) NOT NULL UNIQUE,
		password_hash VARCHAR(255), role ENUM('SISWA','GURU','STAF','ADMIN') NOT NULL,
		identity_number VARCHAR(30) NOT NULL UNIQUE, detail TEXT NOT NULL, bio VARCHAR(300) NOT NULL DEFAULT '', google_id VARCHAR(100) UNIQUE,
		status ENUM('PENDING','AKTIF','NONAKTIF') NOT NULL DEFAULT 'PENDING',
		created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
	) ENGINE=InnoDB`);
	const [detailColumns] = await pool.execute("SELECT DATA_TYPE AS dataType FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='pengguna' AND COLUMN_NAME='detail'");
	if (detailColumns[0] && detailColumns[0].dataType !== 'text') await pool.execute('ALTER TABLE pengguna MODIFY detail TEXT NOT NULL');
	try {
		await pool.execute("ALTER TABLE pengguna ADD COLUMN face_descriptor MEDIUMTEXT DEFAULT NULL");
	} catch (_) {}
	try {
		await pool.execute("ALTER TABLE pengguna ADD COLUMN avatar_name VARCHAR(160) DEFAULT NULL");
	} catch (_) {}
	try {
		await pool.execute("ALTER TABLE pengguna ADD COLUMN cover_name VARCHAR(160) DEFAULT NULL");
	} catch (_) {}

	await pool.execute(`CREATE TABLE IF NOT EXISTS pengaturan_sekolah (
		id INT PRIMARY KEY, latitude DOUBLE NOT NULL, longitude DOUBLE NOT NULL,
		radius_meters INT NOT NULL, open_time VARCHAR(5) NOT NULL, close_time VARCHAR(5) NOT NULL,
		late_after VARCHAR(5) NOT NULL
	) ENGINE=InnoDB`);

	await pool.execute(`CREATE TABLE IF NOT EXISTS postingan (
		id VARCHAR(36) PRIMARY KEY, author_id VARCHAR(36) NOT NULL, title VARCHAR(200) NOT NULL,
		body TEXT NOT NULL, image_name VARCHAR(255) DEFAULT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (author_id) REFERENCES pengguna(id)
	) ENGINE=InnoDB`);
	try {
		await pool.execute("ALTER TABLE postingan ADD COLUMN image_name VARCHAR(255) DEFAULT NULL");
	} catch (_) {}

	await pool.execute(`CREATE TABLE IF NOT EXISTS suka_postingan (
		post_id VARCHAR(36) NOT NULL, user_id VARCHAR(36) NOT NULL,
		PRIMARY KEY(post_id, user_id),
		FOREIGN KEY (post_id) REFERENCES postingan(id) ON DELETE CASCADE,
		FOREIGN KEY (user_id) REFERENCES pengguna(id) ON DELETE CASCADE
	) ENGINE=InnoDB`);

	await pool.execute(`CREATE TABLE IF NOT EXISTS komentar (
		id VARCHAR(36) PRIMARY KEY, post_id VARCHAR(36) NOT NULL,
		author_id VARCHAR(36) NOT NULL, body VARCHAR(500) NOT NULL,
		is_anonymous TINYINT NOT NULL DEFAULT 1, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (post_id) REFERENCES postingan(id) ON DELETE CASCADE,
		FOREIGN KEY (author_id) REFERENCES pengguna(id)
	) ENGINE=InnoDB`);

	await pool.execute(`CREATE TABLE IF NOT EXISTS kelas (
		id INT AUTO_INCREMENT PRIMARY KEY,
		name VARCHAR(60) NOT NULL UNIQUE,
		created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
	) ENGINE=InnoDB`);
	try {
		const [existingClasses] = await pool.execute('SELECT COUNT(*) AS count FROM kelas');
		if (existingClasses[0].count === 0) {
			const defaultClasses = [
				'X RPL 1', 'X RPL 2', 'XI RPL 1', 'XI RPL 2', 'XII RPL 1', 'XII RPL 2',
				'X TKJ 1', 'XI TKJ 1', 'XII TKJ 1'
			];
			for (const cls of defaultClasses) {
				await pool.execute('INSERT IGNORE INTO kelas (name) VALUES (?)', [cls]);
			}
			const [userClasses] = await pool.execute("SELECT DISTINCT detail FROM pengguna WHERE role='SISWA' AND detail != ''");
			for (const row of userClasses) {
				const cName = (row.detail || '').trim();
				if (cName) await pool.execute('INSERT IGNORE INTO kelas (name) VALUES (?)', [cName]);
			}
		}
	} catch (_) {}

	await pool.execute(`CREATE TABLE IF NOT EXISTS tugas (
		id VARCHAR(36) PRIMARY KEY, title VARCHAR(150) NOT NULL, instructions TEXT NOT NULL,
		subject VARCHAR(80) NOT NULL, class_name VARCHAR(60) NOT NULL,
		category ENUM('Teori','Bengkel') NOT NULL DEFAULT 'Teori',
		due_at VARCHAR(30) NOT NULL,
		max_score DOUBLE NOT NULL DEFAULT 100, created_by VARCHAR(36) NOT NULL,
		attachment_name VARCHAR(255) DEFAULT NULL,
		attachment_original_name VARCHAR(255) DEFAULT NULL,
		created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (created_by) REFERENCES pengguna(id)
	) ENGINE=InnoDB`);
	try {
		await pool.execute("ALTER TABLE tugas ADD COLUMN category ENUM('Teori','Bengkel') NOT NULL DEFAULT 'Teori'");
	} catch (_) {}
	try {
		await pool.execute("ALTER TABLE tugas ADD COLUMN attachment_name VARCHAR(255) DEFAULT NULL");
	} catch (_) {}
	try {
		await pool.execute("ALTER TABLE tugas ADD COLUMN attachment_original_name VARCHAR(255) DEFAULT NULL");
	} catch (_) {}

	await pool.execute(`CREATE TABLE IF NOT EXISTS mata_pelajaran (
		id INT AUTO_INCREMENT PRIMARY KEY,
		name VARCHAR(80) NOT NULL UNIQUE,
		created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
	) ENGINE=InnoDB`);
	const defaultSubjects = [
		'Matematika', 'Bahasa Indonesia', 'Bahasa Inggris', 'Pemrograman Web',
		'Administrasi Jaringan', 'Produktif RPL'
	];
	for (const subject of defaultSubjects) {
		await pool.execute('INSERT IGNORE INTO mata_pelajaran (name) VALUES (?)', [subject]);
	}
	const [legacyTeacherDetails] = await pool.execute("SELECT DISTINCT detail FROM pengguna WHERE role='GURU' AND detail != ''");
	for (const row of legacyTeacherDetails) {
		for (const name of String(row.detail || '').split(/\s*,\s*/).map(value => value.trim()).filter(Boolean)) {
			await pool.execute('INSERT IGNORE INTO mata_pelajaran (name) VALUES (?)', [name.slice(0, 80)]);
		}
	}
	const [legacyAssignmentSubjects] = await pool.execute("SELECT DISTINCT subject FROM tugas WHERE subject != ''");
	for (const row of legacyAssignmentSubjects) {
		await pool.execute('INSERT IGNORE INTO mata_pelajaran (name) VALUES (?)', [String(row.subject).trim().slice(0, 80)]);
	}

	await pool.execute(`CREATE TABLE IF NOT EXISTS materi (
		id VARCHAR(36) PRIMARY KEY,
		subject_id INT NOT NULL,
		title VARCHAR(150) NOT NULL,
		content TEXT NOT NULL,
		url VARCHAR(500) DEFAULT NULL,
		file_name VARCHAR(255) DEFAULT NULL,
		file_original_name VARCHAR(255) DEFAULT NULL,
		created_by VARCHAR(36) NOT NULL,
		created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (subject_id) REFERENCES mata_pelajaran(id),
		FOREIGN KEY (created_by) REFERENCES pengguna(id) ON DELETE CASCADE
	) ENGINE=InnoDB`);

	await pool.execute(`CREATE TABLE IF NOT EXISTS guru_mata_pelajaran (
		teacher_id VARCHAR(36) NOT NULL,
		subject_id INT NOT NULL,
		PRIMARY KEY(teacher_id, subject_id),
		FOREIGN KEY (teacher_id) REFERENCES pengguna(id) ON DELETE CASCADE,
		FOREIGN KEY (subject_id) REFERENCES mata_pelajaran(id) ON DELETE CASCADE
	) ENGINE=InnoDB`);

	await pool.execute(`CREATE TABLE IF NOT EXISTS guru_kelas (
		teacher_id VARCHAR(36) NOT NULL,
		class_id INT NOT NULL,
		PRIMARY KEY(teacher_id, class_id),
		FOREIGN KEY (teacher_id) REFERENCES pengguna(id) ON DELETE CASCADE,
		FOREIGN KEY (class_id) REFERENCES kelas(id) ON DELETE CASCADE
	) ENGINE=InnoDB`);

	const [legacyTeachers] = await pool.execute("SELECT id, detail FROM pengguna WHERE role='GURU'");
	for (const teacher of legacyTeachers) {
		for (const name of String(teacher.detail || '').split(/\s*,\s*/).map(value => value.trim()).filter(Boolean)) {
			const subject = await db.get('SELECT id FROM mata_pelajaran WHERE LOWER(name)=LOWER(?)', name);
			if (subject) await pool.execute('INSERT IGNORE INTO guru_mata_pelajaran (teacher_id,subject_id) VALUES (?,?)', [teacher.id, subject.id]);
		}
	}
	const [legacyTeacherAssignments] = await pool.execute(`
		SELECT DISTINCT t.created_by, t.subject, t.class_name
		FROM tugas t JOIN pengguna u ON u.id=t.created_by
		WHERE u.role='GURU'
	`);
	for (const row of legacyTeacherAssignments) {
		const subject = await db.get('SELECT id FROM mata_pelajaran WHERE LOWER(name)=LOWER(?)', String(row.subject).trim());
		if (subject) await pool.execute('INSERT IGNORE INTO guru_mata_pelajaran (teacher_id,subject_id) VALUES (?,?)', [row.created_by, subject.id]);
		const className = String(row.class_name || '').trim();
		if (className && !/^semua( kelas)?$/i.test(className)) {
			await pool.execute('INSERT IGNORE INTO kelas (name) VALUES (?)', [className.slice(0, 60)]);
			const cls = await db.get('SELECT id FROM kelas WHERE LOWER(name)=LOWER(?)', className);
			if (cls) await pool.execute('INSERT IGNORE INTO guru_kelas (teacher_id,class_id) VALUES (?,?)', [row.created_by, cls.id]);
		}
	}

	try {
		await pool.execute('ALTER TABLE tugas ADD COLUMN subject_id INT DEFAULT NULL');
	} catch (_) {}
	try {
		await pool.execute('ALTER TABLE tugas ADD COLUMN material_id VARCHAR(36) DEFAULT NULL');
	} catch (_) {}
	try {
		await pool.execute('ALTER TABLE tugas ADD CONSTRAINT fk_tugas_subject FOREIGN KEY (subject_id) REFERENCES mata_pelajaran(id) ON DELETE SET NULL');
	} catch (_) {}
	try {
		await pool.execute('ALTER TABLE tugas ADD CONSTRAINT fk_tugas_material FOREIGN KEY (material_id) REFERENCES materi(id) ON DELETE SET NULL');
	} catch (_) {}

	await pool.execute(`CREATE TABLE IF NOT EXISTS pengumpulan (
		id VARCHAR(36) PRIMARY KEY, assignment_id VARCHAR(36) NOT NULL,
		student_id VARCHAR(36) NOT NULL,
		answer_text TEXT NOT NULL,
		file_name VARCHAR(255) DEFAULT NULL,
		file_original_name VARCHAR(255) DEFAULT NULL,
		score DOUBLE DEFAULT NULL,
		feedback TEXT NOT NULL, submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
		UNIQUE(assignment_id, student_id),
		FOREIGN KEY (assignment_id) REFERENCES tugas(id) ON DELETE CASCADE,
		FOREIGN KEY (student_id) REFERENCES pengguna(id) ON DELETE CASCADE
	) ENGINE=InnoDB`);
	try {
		await pool.execute("ALTER TABLE pengumpulan ADD COLUMN file_name VARCHAR(255) DEFAULT NULL");
	} catch (_) {}
	try {
		await pool.execute("ALTER TABLE pengumpulan ADD COLUMN file_original_name VARCHAR(255) DEFAULT NULL");
	} catch (_) {}

	await pool.execute(`CREATE TABLE IF NOT EXISTS kehadiran (
		id VARCHAR(36) PRIMARY KEY, user_id VARCHAR(36) NOT NULL, day VARCHAR(10) NOT NULL,
		photo_name VARCHAR(100) NOT NULL, latitude DOUBLE NOT NULL, longitude DOUBLE NOT NULL,
		accuracy DOUBLE NOT NULL, captured_at VARCHAR(30) NOT NULL,
		verification ENUM('MENUNGGU','DISETUJUI','DITOLAK') NOT NULL DEFAULT 'MENUNGGU',
		UNIQUE(user_id, day),
		FOREIGN KEY (user_id) REFERENCES pengguna(id)
	) ENGINE=InnoDB`);

	await pool.execute(`CREATE TABLE IF NOT EXISTS notifikasi (
		id VARCHAR(36) PRIMARY KEY, user_id VARCHAR(36) NOT NULL,
		title VARCHAR(200) NOT NULL, message TEXT NOT NULL, is_read TINYINT NOT NULL DEFAULT 0,
		created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (user_id) REFERENCES pengguna(id)
	) ENGINE=InnoDB`);

	await pool.execute(`INSERT INTO pengaturan_sekolah (id, latitude, longitude, radius_meters, open_time, close_time, late_after)
		VALUES (1, -7.164041847763249, 112.64734569558635, 100, '06:30', '23:59', '07:15')
		ON DUPLICATE KEY UPDATE close_time = IF(close_time = '10:00', '23:59', close_time)`);
	await pool.execute(`UPDATE pengaturan_sekolah SET latitude=?,longitude=?,radius_meters=?
		WHERE id=1 AND latitude=-6.2 AND longitude=106.816666`,
	[-7.164041847763249, 112.64734569558635, 100]);

	if (autoActivateAccounts) await db.run("UPDATE pengguna SET status='AKTIF' WHERE status='PENDING'");
	const [legacyFaceRows] = await pool.execute('SELECT id,face_descriptor FROM pengguna WHERE face_descriptor IS NOT NULL');
	for (const row of legacyFaceRows) {
		if (typeof row.face_descriptor === 'string' && row.face_descriptor.startsWith('v1.')) continue;
		const descriptor = parseFaceDescriptor(row.face_descriptor);
		await pool.execute('UPDATE pengguna SET face_descriptor=? WHERE id=?', [descriptor ? encryptFaceDescriptor(descriptor) : null, row.id]);
	}
	console.log('Database MySQL (sekolah_hub) siap.');
	return db;
	} finally {
		await initConn.query("SELECT RELEASE_LOCK('sekolah_hub_schema_migration')").catch(() => {});
		await initConn.end().catch(() => {});
	}
})().catch(error => {
	console.error('Database gagal disiapkan:', error.message || error.code || error);
	throw error;
});

const registerSchema = z.object({
	name: z.string().trim().min(2).max(120),
	email: z.string().trim().email().max(120),
	password: z.string().min(8).max(128).regex(/[A-Za-z]/).regex(/[0-9]/),
	role: z.enum(['SISWA', 'GURU', 'STAF']),
	identityNumber: z.string().trim().max(30).default('').optional(),
	detail: z.string().trim().max(120).default('').optional(),
	subjectIds: z.array(z.coerce.number().int().positive()).max(20).default([])
});
const loginSchema = z.object({ email: z.string().trim().email().max(120), password: z.string().min(1).max(128) });
const googleIntentSchema = registerSchema.omit({ password: true });
const accountStatusSchema = z.object({ status: z.enum(['AKTIF', 'NONAKTIF']) });
const postSchema = z.object({ title: z.string().trim().min(2).max(120), body: z.string().trim().min(2).max(2000) });
const commentSchema = z.object({ body: z.string().trim().min(1).max(500) });
const assignmentSchema = z.object({ title: z.string().trim().min(3).max(150), instructions: z.string().trim().min(5).max(5000), subject: z.string().trim().max(80).optional().default(''), subjectId: z.coerce.number().int().positive(), className: z.string().trim().min(2).max(60), materialId: z.string().uuid().nullable().optional(), category: z.enum(['Teori', 'Bengkel']).default('Teori'), dueAt: z.string().datetime(), maxScore: z.number().min(1).max(1000).default(100) });
const subjectSchema = z.object({ name: z.string().trim().min(2).max(80) });
const teacherAssignmentSchema = z.object({
	subjectIds: z.array(z.coerce.number().int().positive()).max(20),
	classIds: z.array(z.coerce.number().int().positive()).max(50)
});
const materialSchema = z.object({
	subjectId: z.coerce.number().int().positive(),
	title: z.string().trim().min(3).max(150),
	content: z.string().trim().min(5).max(20000),
	url: z.string().trim().max(500).optional().default('')
});
const settingsSchema = z.object({ latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180), radiusMeters: z.number().int().min(30).max(500), openTime: z.string().regex(/^\d{2}:\d{2}$/), closeTime: z.string().regex(/^\d{2}:\d{2}$/), lateAfter: z.string().regex(/^\d{2}:\d{2}$/) }).refine(data => {
	const minutes = value => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
	const valid = [data.openTime, data.closeTime, data.lateAfter].every(value => Number(value.slice(0, 2)) < 24 && Number(value.slice(3, 5)) < 60);
	return valid && minutes(data.openTime) < minutes(data.closeTime) && minutes(data.openTime) <= minutes(data.lateAfter) && minutes(data.lateAfter) <= minutes(data.closeTime);
}, { message: 'Jam buka, batas terlambat, dan jam tutup tidak valid.' });
const attendanceDecisionSchema = z.object({ verification: z.enum(['DISETUJUI', 'DITOLAK']) });
const authLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	limit: isProduction ? 15 : 200,
	standardHeaders: 'draft-8',
	legacyHeaders: false,
	handler: (req, res) => {
		res.status(429).json({ error: 'Terlalu banyak permintaan pendaftaran. Silakan tunggu beberapa saat.' });
	}
});
const loginLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	limit: isProduction ? 10 : 200,
	standardHeaders: 'draft-8',
	legacyHeaders: false,
	handler: (req, res) => {
		res.status(429).json({ error: 'Terlalu banyak percobaan masuk (rate limit). Silakan tunggu beberapa saat atau muat ulang halaman.' });
	}
});

const postLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	limit: isProduction ? 10 : 200,
	standardHeaders: 'draft-8',
	legacyHeaders: false,
	handler: (req, res) => res.status(429).json({ error: 'Terlalu banyak topik dibuat. Silakan tunggu beberapa saat.' })
});

const commentLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	limit: isProduction ? 30 : 500,
	standardHeaders: 'draft-8',
	legacyHeaders: false,
	handler: (req, res) => res.status(429).json({ error: 'Terlalu banyak komentar dikirim. Silakan tunggu beberapa saat.' })
});

const faceCheckLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	limit: isProduction ? 120 : 1000,
	standardHeaders: 'draft-8',
	legacyHeaders: false,
	handler: (req, res) => res.status(429).json({ error: 'Terlalu banyak pemeriksaan wajah. Silakan tunggu beberapa saat.' })
});

function sameOrigin(req, res, next) {
	if (req.get('sec-fetch-site') === 'cross-site') return res.status(403).json({ error: 'Permintaan lintas situs ditolak.' });
	const host = req.get('host');
	const allowedOrigins = new Set();
	if (process.env.APP_URL) {
		try { allowedOrigins.add(new URL(process.env.APP_URL).origin); } catch {}
	}
	if (host) {
		allowedOrigins.add(`${req.protocol}://${host}`);
		if (!isProduction) {
			allowedOrigins.add(`http://${host}`);
			allowedOrigins.add(`https://${host}`);
		}
	}
	if (!isProduction) {
		allowedOrigins.add('http://localhost:3000');
		allowedOrigins.add('http://127.0.0.1:3000');
		allowedOrigins.add('http://localhost:' + (process.env.PORT || 3000));
		allowedOrigins.add('http://127.0.0.1:' + (process.env.PORT || 3000));
	}
	const origin = req.get('origin');
	if (!origin) {
		const referer = req.get('referer');
		if (referer) {
			try {
				if (allowedOrigins.has(new URL(referer).origin)) return next();
			} catch {}
		}
		if (!isProduction) return next();
		return res.status(403).json({ error: 'Header Origin wajib untuk permintaan ini.' });
	}
	try {
		if (!allowedOrigins.has(new URL(origin).origin)) {
			return res.status(403).json({ error: 'Permintaan lintas situs ditolak.' });
		}
	} catch {
		return res.status(403).json({ error: 'Origin tidak valid.' });
	}
	next();
}

function publicUser(user) {
	return {
		id: user.id,
		name: user.full_name,
		email: user.email,
		role: user.role.toLowerCase(),
		status: user.status,
		detail: user.detail,
		hasFaceRegistered: Boolean(user.face_descriptor)
	};
}

async function notifyAllAdmins(db, title, message) {
	const admins = await db.all("SELECT id FROM pengguna WHERE role='ADMIN' AND status='AKTIF'");
	for (const admin of admins) {
		await db.run('INSERT INTO notifikasi (id,user_id,title,message) VALUES (?,?,?,?)', crypto.randomUUID(), admin.id, title, message);
	}
}

function normalizeClassName(value) {
	return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function isAllClasses(value) {
	const normalized = normalizeClassName(value);
	return normalized === 'semua' || normalized === 'semua kelas';
}

function classMatches(studentClass, targetClass) {
	const target = normalizeClassName(targetClass);
	return Boolean(target) && (isAllClasses(target) || normalizeClassName(studentClass) === target);
}

async function notifyClassStudents(db, className, title, message) {
	try {
		const students = isAllClasses(className)
			? await db.all("SELECT id FROM pengguna WHERE role='SISWA' AND status='AKTIF'")
			: await db.all("SELECT id FROM pengguna WHERE role='SISWA' AND status='AKTIF' AND LOWER(TRIM(detail))=LOWER(TRIM(?))", className);
		for (const student of students) {
			await db.run('INSERT INTO notifikasi (id,user_id,title,message) VALUES (?,?,?,?)', crypto.randomUUID(), student.id, title, message);
		}
	} catch (e) {
		console.error('Gagal mengirim notifikasi siswa:', e.message);
	}
}

async function resolveSubjects(connection, subjectIds) {
	const uniqueIds = [...new Set(subjectIds.map(Number))];
	if (uniqueIds.length === 0) return [];
	const placeholders = uniqueIds.map(() => '?').join(',');
	const [subjects] = await connection.execute(`SELECT id,name FROM mata_pelajaran WHERE id IN (${placeholders}) ORDER BY name`, uniqueIds);
	if (subjects.length !== uniqueIds.length) {
		const error = new Error('Mata pelajaran yang dipilih tidak ditemukan.');
		error.statusCode = 422;
		throw error;
	}
	return subjects;
}

async function insertAccountWithTeaching(connection, account) {
	const subjects = account.role === 'GURU' ? await resolveSubjects(connection, account.subjectIds || []) : [];
	if (account.role === 'GURU' && subjects.length === 0) {
		const error = new Error('Guru harus memilih minimal satu mata pelajaran.');
		error.statusCode = 422;
		throw error;
	}
	const detailText = account.role === 'GURU' ? subjects.map(subject => subject.name).join(', ') : (account.detail || '');
	await connection.execute(
		'INSERT INTO pengguna (id,full_name,email,password_hash,role,identity_number,detail,google_id,status) VALUES (?,?,?,?,?,?,?,?,?)',
		[account.id, account.name, account.email, account.passwordHash || null, account.role, account.identityNumber, detailText, account.googleId || null, account.status]
	);
	for (const subject of subjects) {
		await connection.execute('INSERT INTO guru_mata_pelajaran (teacher_id,subject_id) VALUES (?,?)', [account.id, subject.id]);
	}
	return detailText;
}

function haversineMeters(latitude1, longitude1, latitude2, longitude2) {
	const radians = value => value * Math.PI / 180;
	const latDelta = radians(latitude2 - latitude1);
	const lonDelta = radians(longitude2 - longitude1);
	const value = Math.sin(latDelta / 2) ** 2 + Math.cos(radians(latitude1)) * Math.cos(radians(latitude2)) * Math.sin(lonDelta / 2) ** 2;
	return 6371000 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function getImageExtension(buffer, mimeType) {
	if (mimeType === 'image/jpeg' && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return '.jpg';
	if (mimeType === 'image/png' && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return '.png';
	if (mimeType === 'image/webp' && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return '.webp';
	return null;
}

function getImageMimeType(buffer) {
	if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
	if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
	if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
	return null;
}

async function sendImageResponse(res, filePath) {
	const handle = await fs.promises.open(filePath, 'r');
	try {
		const header = Buffer.alloc(12);
		await handle.read(header, 0, header.length, 0);
		const mimeType = getImageMimeType(header);
		if (!mimeType) return res.status(415).json({ error: 'File gambar tidak valid.' });
		res.set({ 'Content-Type': mimeType, 'Cache-Control': 'private, max-age=300', 'X-Content-Type-Options': 'nosniff' });
		res.sendFile(filePath);
	} finally {
		await handle.close();
	}
}

function htmlEscape(value = '') {
	return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

function configureGoogle() {
	if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) return;
	passport.use(new GoogleStrategy({
		clientID: process.env.GOOGLE_CLIENT_ID,
		clientSecret: process.env.GOOGLE_CLIENT_SECRET,
		callbackURL: `${process.env.APP_URL || `http://localhost:${PORT}`}/auth/google/callback`,
		passReqToCallback: true
	}, async (req, accessToken, refreshToken, profile, done) => {
		try {
			const db = await databasePromise;
			const email = profile.emails?.[0]?.value?.trim().toLowerCase();
			if (!email || profile._json?.email_verified !== true) return done(null, false);
			let user = await db.get('SELECT * FROM pengguna WHERE google_id = ? OR LOWER(email) = LOWER(?)', profile.id, email);
			if (!user && req.session.googleRegistration) {
				const intent = req.session.googleRegistration;
				if (intent.email !== email) return done(null, false);
				const id = crypto.randomUUID();
				const status = autoActivateAccounts ? 'AKTIF' : 'PENDING';
				const identityNum = (intent.identityNumber && intent.identityNumber.trim().length > 0)
					? intent.identityNumber.trim()
					: `${intent.role}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`;
				const connection = await pool.getConnection();
				try {
					await connection.beginTransaction();
					await insertAccountWithTeaching(connection, {
						id, name: intent.name, email, role: intent.role, identityNumber: identityNum,
						googleId: profile.id, status, subjectIds: intent.subjectIds || [], detail: intent.detail || ''
					});
					await connection.commit();
				} catch (error) {
					await connection.rollback();
					throw error;
				} finally {
					connection.release();
				}
				user = await db.get('SELECT * FROM pengguna WHERE id = ?', id);
				await notifyAllAdmins(db, 'Pendaftaran akun baru', `${intent.name} (${intent.role}) mendaftar dengan Google${autoActivateAccounts ? ' dan sudah aktif otomatis.' : ' dan menunggu aktivasi.'}`);
			} else if (user && !user.google_id) {
				return done(null, false);
			} else if (user && user.google_id !== profile.id) {
				return done(null, false);
			}
			if (!user) return done(null, false);
			req.session.googleRegistration = null;
			done(null, user);
		} catch (error) {
			done(error);
		}
	}));
}

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
	try {
		const db = await databasePromise;
		done(null, await db.get('SELECT * FROM pengguna WHERE id = ?', id) || false);
	} catch (error) {
		done(error);
	}
});
configureGoogle();
app.use(passport.initialize());
app.use(passport.session());

function requireActiveUser(req, res, next) {
	if (!req.isAuthenticated?.() || req.user?.status !== 'AKTIF') return res.status(401).json({ error: 'Silakan masuk dengan akun yang sudah aktif.' });
	next();
}

function requireAdmin(req, res, next) {
	if (req.user?.role !== 'ADMIN') return res.status(403).json({ error: 'Akses khusus admin.' });
	next();
}

async function safeLogin(req, user) {
	await destroyUserSessions(user.id);
	return new Promise((resolve, reject) => req.session.regenerate(error => {
		if (error) return reject(error);
		req.logIn(user, loginError => loginError ? reject(loginError) : resolve());
	}));
}

async function destroyUserSessions(userId) {
	const [rows] = await pool.execute('SELECT sid, sess FROM sesi');
	await Promise.all(rows.map(async row => {
		try {
			if (JSON.parse(row.sess).passport?.user === userId) {
				await pool.execute('DELETE FROM sesi WHERE sid=?', [row.sid]);
			}
		} catch (_) {}
	}));
}

app.get('/api/health', (_, res) => res.json({ ok: true, app: 'EduSmart', googleLoginEnabled: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) }));
app.get('/api/auth/session', (req, res) => {
	if (req.isAuthenticated?.() && req.user.status === 'AKTIF') return res.json({ user: publicUser(req.user), googleLoginEnabled: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) });
	res.json({ user: null, googleLoginEnabled: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) });
});

app.post('/api/auth/register', sameOrigin, authLimiter, async (req, res, next) => {
	const parsed = registerSchema.safeParse(req.body);
	if (!parsed.success) return res.status(422).json({ error: 'Periksa data dan gunakan password minimal 8 karakter, berisi huruf serta angka.' });
	try {
		const data = parsed.data, db = await databasePromise;
		const hash = await bcrypt.hash(data.password, Number(process.env.BCRYPT_COST || 12));
		const id = crypto.randomUUID();
		const status = autoActivateAccounts ? 'AKTIF' : 'PENDING';
		const identityNum = (data.identityNumber && data.identityNumber.trim().length > 0)
			? data.identityNumber.trim()
			: `${data.role}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`;
		const connection = await pool.getConnection();
		try {
			await connection.beginTransaction();
			await insertAccountWithTeaching(connection, {
				id, name: data.name, email: data.email.toLowerCase(), passwordHash: hash,
				role: data.role, identityNumber: identityNum, status,
				subjectIds: data.subjectIds, detail: data.detail || ''
			});
			await connection.commit();
		} catch (error) {
			await connection.rollback();
			if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
			throw error;
		} finally {
			connection.release();
		}
		await notifyAllAdmins(db, 'Pendaftaran akun baru', `${data.name} (${data.role})${autoActivateAccounts ? ' sudah aktif otomatis.' : ' menunggu aktivasi admin.'}`);
		res.status(201).json({ autoActivated: autoActivateAccounts, message: autoActivateAccounts ? 'Pendaftaran berhasil. Akun Anda sudah aktif, silakan masuk.' : 'Pendaftaran berhasil. Akun menunggu aktivasi admin sekolah.' });
	} catch (error) {
		if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Email atau nomor induk sudah digunakan.' });
		next(error);
	}
});

app.post('/api/auth/login', sameOrigin, loginLimiter, async (req, res, next) => {
	const parsed = loginSchema.safeParse(req.body);
	if (!parsed.success) return res.status(422).json({ error: 'Email atau kata sandi tidak valid.' });
	try {
		const db = await databasePromise;
		const user = await db.get('SELECT * FROM pengguna WHERE LOWER(email) = LOWER(?)', parsed.data.email);
		const matches = user?.password_hash ? await bcrypt.compare(parsed.data.password, user.password_hash) : false;
		if (!user || !matches) return res.status(401).json({ error: 'Email atau kata sandi salah.' });
		if (user.status !== 'AKTIF') return res.status(403).json({ error: 'Akun menunggu aktivasi admin atau telah dinonaktifkan.' });
		await safeLogin(req, user);
		res.json({ user: publicUser(user) });
	} catch (error) {
		next(error);
	}
});

app.post('/api/auth/logout', sameOrigin, (req, res, next) => {
	req.logout(error => {
		if (error) return next(error);
		req.session.destroy(sessionError => {
			if (sessionError) return next(sessionError);
			res.clearCookie('edusmart.sid', { httpOnly: true, secure: isProduction, sameSite: 'lax' });
			res.json({ ok: true });
		});
	});
});

app.post('/api/auth/google-intent', sameOrigin, authLimiter, (req, res) => {
	if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) return res.status(503).json({ error: 'Login Google belum dikonfigurasi oleh pengelola sekolah.' });
	const parsed = googleIntentSchema.safeParse(req.body);
	if (!parsed.success) return res.status(422).json({ error: 'Lengkapi data pendaftaran sebelum melanjutkan ke Google.' });
	req.session.googleRegistration = { ...parsed.data, email: parsed.data.email.toLowerCase() };
	res.json({ url: '/auth/google' });
});

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
	app.get('/auth/google', passport.authenticate('google', { scope: ['email', 'profile'], state: true }));
	app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/?auth=google-failed' }), (req, res) => {
		if (req.user.status !== 'AKTIF') return req.logout(() => res.redirect('/?auth=pending'));
		res.redirect('/');
	});
}

app.get('/api/admin/accounts', requireActiveUser, requireAdmin, async (_, res, next) => {
	try {
		const db = await databasePromise;
		const accounts = await db.all('SELECT id, full_name AS name, email, role, identity_number AS identityNumber, detail, status, created_at AS createdAt FROM pengguna ORDER BY created_at DESC');
		res.json({ accounts });
	} catch (error) {
		next(error);
	}
});

app.patch('/api/admin/accounts/:id/status', sameOrigin, requireActiveUser, requireAdmin, async (req, res, next) => {
	const parsed = accountStatusSchema.safeParse(req.body);
	if (!parsed.success) return res.status(422).json({ error: 'Status akun tidak valid.' });
	try {
		const db = await databasePromise;
		const result = await db.run('UPDATE pengguna SET status = ? WHERE id = ? AND role != ?', parsed.data.status, req.params.id, 'ADMIN');
		if (!result.changes) return res.status(404).json({ error: 'Akun tidak ditemukan.' });
		await db.run('INSERT INTO notifikasi (id,user_id,title,message) VALUES (?,?,?,?)',
			crypto.randomUUID(), req.params.id, 'Status Akun Diperbarui',
			`Status akun Anda telah diubah oleh admin menjadi ${parsed.data.status}.`);
		if (parsed.data.status !== 'AKTIF') await destroyUserSessions(req.params.id);
		res.json({ ok: true });
	} catch (error) {
		next(error);
	}
});

app.patch('/api/admin/accounts/:id/password', sameOrigin, requireActiveUser, requireAdmin, async (req, res, next) => {
	try {
		const db = await databasePromise;
		const target = await db.get('SELECT id,full_name,role FROM pengguna WHERE id=?', req.params.id);
		if (!target) return res.status(404).json({ error: 'Akun tidak ditemukan.' });
		if (target.role === 'ADMIN') return res.status(403).json({ error: 'Kata sandi admin tidak dapat direset dari menu ini.' });
		const temporaryPassword = `Edu${crypto.randomBytes(12).toString('base64url')}9`;
		const passwordHash = await bcrypt.hash(temporaryPassword, Number(process.env.BCRYPT_COST || 12));
		await db.run('UPDATE pengguna SET password_hash=? WHERE id=?', passwordHash, target.id);
		await db.run('INSERT INTO notifikasi (id,user_id,title,message) VALUES (?,?,?,?)',
			crypto.randomUUID(), target.id, 'Kata Sandi Direset', 'Admin sekolah mereset kata sandi akun Anda. Gunakan kata sandi sementara yang diberikan secara langsung.');
		await destroyUserSessions(target.id);
		res.json({ ok: true, temporaryPassword });
	} catch (error) {
		next(error);
	}
});

app.delete('/api/admin/accounts/:id', sameOrigin, requireActiveUser, requireAdmin, async (req, res, next) => {
	const targetId = req.params.id;
	if (targetId === req.user.id) {
		return res.status(400).json({ error: 'Anda tidak dapat menghapus akun Anda sendiri.' });
	}

	const connection = await pool.getConnection();
	const filesToDelete = new Set();
	let targetUser;
	const collectFile = (directory, fileName) => {
		if (fileName) filesToDelete.add(path.join(directory, path.basename(fileName)));
	};
	try {
		const db = await databasePromise;
		targetUser = await db.get('SELECT id, full_name, role, avatar_name, cover_name FROM pengguna WHERE id = ?', targetId);
		if (!targetUser) return res.status(404).json({ error: 'Akun warga sekolah tidak ditemukan.' });
		if (targetUser.role === 'ADMIN') return res.status(403).json({ error: 'Akun admin tidak dapat dihapus.' });

		const attendance = await db.all('SELECT photo_name FROM kehadiran WHERE user_id=?', targetId);
		const ownSubmissions = await db.all('SELECT file_name FROM pengumpulan WHERE student_id=?', targetId);
		const assignments = await db.all('SELECT id, attachment_name FROM tugas WHERE created_by=?', targetId);
		const assignmentIds = assignments.map(assignment => assignment.id);
		const assignmentSubmissions = assignmentIds.length
			? await db.all(`SELECT file_name FROM pengumpulan WHERE assignment_id IN (${assignmentIds.map(() => '?').join(',')})`, ...assignmentIds)
			: [];
		const materials = await db.all('SELECT file_name FROM materi WHERE created_by=?', targetId);
		const posts = await db.all('SELECT image_name FROM postingan WHERE author_id=?', targetId);

		attendance.forEach(row => collectFile(photoDir, row.photo_name));
		ownSubmissions.forEach(row => collectFile(submissionDir, row.file_name));
		assignmentSubmissions.forEach(row => collectFile(submissionDir, row.file_name));
		assignments.forEach(row => collectFile(assignmentAttachmentDir, row.attachment_name));
		materials.forEach(row => collectFile(materialDir, row.file_name));
		posts.forEach(row => collectFile(postImageDir, row.image_name));
		collectFile(profileMediaDir, targetUser.avatar_name);
		collectFile(profileMediaDir, targetUser.cover_name);

		await connection.beginTransaction();
		await connection.execute('DELETE FROM suka_postingan WHERE user_id=?', [targetId]);
		await connection.execute('DELETE FROM komentar WHERE author_id=?', [targetId]);
		const [ownedPosts] = await connection.execute('SELECT id FROM postingan WHERE author_id=?', [targetId]);
		for (const post of ownedPosts) {
			await connection.execute('DELETE FROM suka_postingan WHERE post_id=?', [post.id]);
			await connection.execute('DELETE FROM komentar WHERE post_id=?', [post.id]);
		}
		await connection.execute('DELETE FROM postingan WHERE author_id=?', [targetId]);
		await connection.execute('DELETE FROM pengumpulan WHERE student_id=?', [targetId]);
		for (const assignmentId of assignmentIds) {
			await connection.execute('DELETE FROM pengumpulan WHERE assignment_id=?', [assignmentId]);
		}
		await connection.execute('DELETE FROM tugas WHERE created_by=?', [targetId]);
		await connection.execute('DELETE FROM materi WHERE created_by=?', [targetId]);
		await connection.execute('DELETE FROM kehadiran WHERE user_id=?', [targetId]);
		await connection.execute('DELETE FROM notifikasi WHERE user_id=?', [targetId]);
		await connection.execute('DELETE FROM guru_mata_pelajaran WHERE teacher_id=?', [targetId]);
		await connection.execute('DELETE FROM guru_kelas WHERE teacher_id=?', [targetId]);
		await connection.execute('DELETE FROM pengguna WHERE id=?', [targetId]);
		await connection.commit();
	} catch (error) {
		await connection.rollback().catch(() => {});
		throw error;
	} finally {
		connection.release();
	}

	await destroyUserSessions(targetId).catch(error => console.error('Session cleanup after account deletion failed:', error));
	await Promise.all([...filesToDelete].map(filePath => fs.promises.unlink(filePath).catch(() => {})));
	res.json({ ok: true, message: `Akun warga sekolah "${targetUser.full_name}" berhasil dihapus.` });
});

app.get('/api/subjects', async (req, res, next) => {
	try {
		const db = await databasePromise;
		res.json({ subjects: await db.all('SELECT id,name FROM mata_pelajaran ORDER BY name ASC') });
	} catch (error) {
		next(error);
	}
});

app.post('/api/admin/subjects', sameOrigin, requireActiveUser, requireAdmin, async (req, res, next) => {
	const parsed = subjectSchema.safeParse(req.body);
	if (!parsed.success) return res.status(422).json({ error: 'Nama mata pelajaran minimal 2 dan maksimal 80 karakter.' });
	try {
		const db = await databasePromise;
		const existing = await db.get('SELECT id FROM mata_pelajaran WHERE LOWER(name)=LOWER(?)', parsed.data.name);
		if (existing) return res.status(409).json({ error: 'Mata pelajaran sudah ada.' });
		const matchingClass = await db.get('SELECT id FROM kelas WHERE LOWER(name)=LOWER(?)', parsed.data.name);
		if (matchingClass) return res.status(409).json({ error: 'Nama kelas tidak dapat digunakan sebagai mata pelajaran.' });
		const result = await db.run('INSERT INTO mata_pelajaran (name) VALUES (?)', parsed.data.name);
		res.status(201).json({ id: result.lastID, name: parsed.data.name });
	} catch (error) {
		next(error);
	}
});

app.delete('/api/admin/subjects/:id', sameOrigin, requireActiveUser, requireAdmin, async (req, res, next) => {
	try {
		const db = await databasePromise;
		const subject = await db.get('SELECT id,name FROM mata_pelajaran WHERE id=?', req.params.id);
		if (!subject) return res.status(404).json({ error: 'Mata pelajaran tidak ditemukan.' });
		const [teacherCount, materialCount, taskCount] = await Promise.all([
			db.get('SELECT COUNT(*) AS count FROM guru_mata_pelajaran WHERE subject_id=?', req.params.id),
			db.get('SELECT COUNT(*) AS count FROM materi WHERE subject_id=?', req.params.id),
			db.get('SELECT COUNT(*) AS count FROM tugas WHERE subject_id=?', req.params.id)
		]);
		if (teacherCount.count || materialCount.count || taskCount.count) {
			return res.status(409).json({ error: 'Mata pelajaran masih digunakan oleh guru, materi, atau tugas.' });
		}
		await db.run('DELETE FROM mata_pelajaran WHERE id=?', req.params.id);
		res.json({ ok: true });
	} catch (error) {
		next(error);
	}
});

app.get('/api/teaching/me', requireActiveUser, async (req, res, next) => {
	try {
		const db = await databasePromise;
		let subjects = await db.all('SELECT id,name FROM mata_pelajaran ORDER BY name ASC');
		const classes = await db.all('SELECT id,name FROM kelas ORDER BY name ASC');
		let materials = await db.all(`SELECT m.id,m.subject_id AS subjectId,mp.name AS subject,m.title,m.content,m.url,
			m.file_name AS fileName,m.file_original_name AS fileOriginalName,m.created_by AS createdBy,
			u.full_name AS teacherName,m.created_at AS createdAt,(m.file_name IS NOT NULL) AS hasFile
			FROM materi m JOIN mata_pelajaran mp ON mp.id=m.subject_id JOIN pengguna u ON u.id=m.created_by
			ORDER BY m.created_at DESC LIMIT 200`);
		if (req.user.role === 'GURU') {
			subjects = await db.all(`SELECT mp.id,mp.name FROM guru_mata_pelajaran g
				JOIN mata_pelajaran mp ON mp.id=g.subject_id WHERE g.teacher_id=? ORDER BY mp.name`, req.user.id);
			materials = materials.filter(material => material.createdBy === req.user.id);
		}
		res.json({ subjects, classes, materials });
	} catch (error) {
		next(error);
	}
});

app.get('/api/admin/teachers', requireActiveUser, requireAdmin, async (req, res, next) => {
	try {
		const db = await databasePromise;
		const teachers = await db.all("SELECT id,full_name AS name,email,identity_number AS identityNumber,detail,status FROM pengguna WHERE role='GURU' ORDER BY full_name");
		const [subjectLinks, classLinks, subjects, classes] = await Promise.all([
			db.all('SELECT teacher_id,subject_id FROM guru_mata_pelajaran'),
			db.all('SELECT teacher_id,class_id FROM guru_kelas'),
			db.all('SELECT id,name FROM mata_pelajaran ORDER BY name'),
			db.all('SELECT id,name FROM kelas ORDER BY name')
		]);
		for (const teacher of teachers) {
			teacher.subjectIds = subjectLinks.filter(link => link.teacher_id === teacher.id).map(link => link.subject_id);
			teacher.classIds = classLinks.filter(link => link.teacher_id === teacher.id).map(link => link.class_id);
		}
		res.json({ teachers, subjects, classes });
	} catch (error) {
		next(error);
	}
});

app.get('/api/materials', requireActiveUser, async (req, res, next) => {
	try {
		const db = await databasePromise;
		const subjectId = Number(req.query.subjectId || 0);
		const mine = req.query.mine === '1';
		const conditions = [];
		const params = [];
		if (subjectId > 0) {
			conditions.push('m.subject_id=?');
			params.push(subjectId);
		}
		if (mine && req.user.role === 'GURU') {
			conditions.push('m.created_by=?');
			params.push(req.user.id);
		}
		const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
		const materials = await db.all(`SELECT m.id,m.subject_id AS subjectId,mp.name AS subject,m.title,m.content,m.url,
			m.file_name AS fileName,m.file_original_name AS fileOriginalName,m.created_by AS createdBy,
			u.full_name AS teacherName,m.created_at AS createdAt,(m.file_name IS NOT NULL) AS hasFile
			FROM materi m JOIN mata_pelajaran mp ON mp.id=m.subject_id JOIN pengguna u ON u.id=m.created_by
			${where} ORDER BY m.created_at DESC LIMIT 200`, ...params);
		res.json({ materials });
	} catch (error) {
		next(error);
	}
});

app.post('/api/materials', sameOrigin, requireActiveUser, materialUpload.single('file'), async (req, res, next) => {
	if (req.user.role !== 'GURU') return res.status(403).json({ error: 'Hanya guru yang dapat membuat materi.' });
	const parsed = materialSchema.safeParse({
		subjectId: req.body.subjectId,
		title: req.body.title,
		content: req.body.content,
		url: req.body.url || ''
	});
	if (!parsed.success) return res.status(422).json({ error: 'Judul, isi materi, atau mata pelajaran tidak valid.' });
	if (parsed.data.url) {
		try {
			const url = new URL(parsed.data.url);
			if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
		} catch {
			return res.status(422).json({ error: 'Tautan materi harus menggunakan http atau https.' });
		}
	}
	let fileName = null, inserted = false;
	try {
		const db = await databasePromise;
		const subject = await db.get('SELECT id,name FROM mata_pelajaran WHERE id=?', parsed.data.subjectId);
		if (!subject) return res.status(404).json({ error: 'Mata pelajaran tidak ditemukan.' });
		if (req.user.role === 'GURU') {
			const assigned = await db.get('SELECT 1 FROM guru_mata_pelajaran WHERE teacher_id=? AND subject_id=?', req.user.id, subject.id);
			if (!assigned) return res.status(403).json({ error: 'Materi hanya dapat dibuat untuk mata pelajaran yang Anda ampu.' });
		}
		const id = crypto.randomUUID();
		if (req.file) {
			const ext = path.extname(req.file.originalname).toLowerCase().replace(/[^a-zA-Z0-9.]/g, '').slice(0, 12) || '.bin';
			fileName = `${id}${ext}`;
			await writeFileAtomic(path.join(materialDir, fileName), req.file.buffer);
		}
		await db.run('INSERT INTO materi (id,subject_id,title,content,url,file_name,file_original_name,created_by) VALUES (?,?,?,?,?,?,?,?)',
			id, subject.id, parsed.data.title, parsed.data.content, parsed.data.url || null, fileName, req.file?.originalname || null, req.user.id);
		inserted = true;
		res.status(201).json({ id, subject: subject.name, fileName, fileOriginalName: req.file?.originalname || null });
	} catch (error) {
		if (fileName && !inserted) await fs.promises.unlink(path.join(materialDir, fileName)).catch(() => {});
		next(error);
	}
});

app.get('/api/materials/:id/file', requireActiveUser, async (req, res, next) => {
	try {
		const db = await databasePromise;
		const material = await db.get('SELECT file_name,file_original_name FROM materi WHERE id=?', req.params.id);
		if (!material?.file_name) return res.status(404).json({ error: 'Lampiran materi tidak ditemukan.' });
		const filePath = path.join(materialDir, path.basename(material.file_name));
		if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File materi tidak ditemukan di server.' });
		res.download(filePath, material.file_original_name || 'materi');
	} catch (error) {
		next(error);
	}
});

app.delete('/api/materials/:id', sameOrigin, requireActiveUser, async (req, res, next) => {
	try {
		const db = await databasePromise;
		if (req.user.role !== 'GURU') return res.status(403).json({ error: 'Hanya guru yang dapat menghapus materi.' });
		const material = await db.get('SELECT id,created_by,file_name FROM materi WHERE id=?', req.params.id);
		if (!material) return res.status(404).json({ error: 'Materi tidak ditemukan.' });
		if (material.created_by !== req.user.id) return res.status(403).json({ error: 'Anda hanya dapat menghapus materi sendiri.' });
		await db.run('DELETE FROM materi WHERE id=?', req.params.id);
		if (material.file_name) await fs.promises.unlink(path.join(materialDir, path.basename(material.file_name))).catch(() => {});
		res.json({ ok: true });
	} catch (error) {
		next(error);
	}
});

app.get('/api/profile/me', requireActiveUser, async (req, res, next) => {
	try {
		const db = await databasePromise;
		const row = await db.get('SELECT id,full_name AS name,role,detail,bio,avatar_name,cover_name,(face_descriptor IS NOT NULL) AS hasFaceRegistered FROM pengguna WHERE id=?', req.user.id);
		const user = row ? {
			id: row.id,
			name: row.name,
			role: row.role,
			detail: row.detail,
			bio: row.bio,
			hasFaceRegistered: Boolean(row.hasFaceRegistered),
			avatarUrl: row.avatar_name ? `/api/profile/media/${encodeURIComponent(row.id)}/avatar?v=${encodeURIComponent(row.avatar_name)}` : null,
			coverUrl: row.cover_name ? `/api/profile/media/${encodeURIComponent(row.id)}/cover?v=${encodeURIComponent(row.cover_name)}` : null
		} : null;
		const approvedAttendance = await db.get("SELECT COUNT(*) AS count FROM kehadiran WHERE user_id=? AND verification='DISETUJUI'", req.user.id);
		let assignmentCount = 0;
		if (req.user.role === 'ADMIN') assignmentCount = (await db.get('SELECT COUNT(*) AS count FROM tugas')).count;
		else if (req.user.role === 'GURU') assignmentCount = (await db.get('SELECT COUNT(*) AS count FROM tugas WHERE created_by=?', req.user.id)).count;
		else if (req.user.role === 'SISWA') {
			const studentClass = (req.user.detail || '').trim();
			assignmentCount = (await db.get(`
				SELECT COUNT(*) AS count FROM tugas
				WHERE LOWER(TRIM(class_name)) = LOWER(TRIM(?))
				   OR LOWER(TRIM(class_name)) = 'semua'
				   OR LOWER(TRIM(class_name)) = 'semua kelas'
			`, studentClass)).count;
		}
		res.json({ user, assignmentCount, approvedAttendance: approvedAttendance.count });
	} catch (error) {
		next(error);
	}
});

app.put('/api/profile/me', sameOrigin, requireActiveUser, async (req, res, next) => {
	const parsed = z.object({ bio: z.string().trim().max(300) }).safeParse(req.body);
	if (!parsed.success) return res.status(422).json({ error: 'Bio maksimal 300 karakter.' });
	try {
		const db = await databasePromise;
		await db.run('UPDATE pengguna SET bio=? WHERE id=?', parsed.data.bio, req.user.id);
		res.json({ bio: parsed.data.bio });
	} catch (error) {
		next(error);
	}
});

app.post('/api/profile/media/:type', sameOrigin, requireActiveUser, photoUpload.single('image'), async (req, res, next) => {
	const type = req.params.type;
	if (!['avatar', 'cover'].includes(type)) return res.status(400).json({ error: 'Tipe media tidak valid.' });
	if (!req.file) return res.status(422).json({ error: 'Pilih file gambar terlebih dahulu.' });
	const extension = getImageExtension(req.file.buffer, req.file.mimetype);
	if (!extension) return res.status(422).json({ error: 'Format gambar harus JPEG, PNG, atau WebP yang valid.' });
	const col = type === 'avatar' ? 'avatar_name' : 'cover_name';
	try {
		const db = await databasePromise;
		const prev = await db.get(`SELECT ${col} AS fileName FROM pengguna WHERE id=?`, req.user.id);
		const fileName = `${req.user.id}-${type}-${crypto.randomUUID()}${extension}`;
		await writeFileAtomic(path.join(profileMediaDir, fileName), req.file.buffer);
		await db.run(`UPDATE pengguna SET ${col}=? WHERE id=?`, fileName, req.user.id);
		if (prev?.fileName) {
			await fs.promises.unlink(path.join(profileMediaDir, path.basename(prev.fileName))).catch(() => {});
		}
		res.json({
			ok: true,
			url: `/api/profile/media/${encodeURIComponent(req.user.id)}/${type}?v=${encodeURIComponent(fileName)}`,
			message: type === 'avatar' ? 'Foto profil berhasil diperbarui.' : 'Foto latar belakang berhasil diperbarui.'
		});
	} catch (error) {
		next(error);
	}
});

app.delete('/api/profile/media/:type', sameOrigin, requireActiveUser, async (req, res, next) => {
	const type = req.params.type;
	if (!['avatar', 'cover'].includes(type)) return res.status(400).json({ error: 'Tipe media tidak valid.' });
	const col = type === 'avatar' ? 'avatar_name' : 'cover_name';
	try {
		const db = await databasePromise;
		const prev = await db.get(`SELECT ${col} AS fileName FROM pengguna WHERE id=?`, req.user.id);
		await db.run(`UPDATE pengguna SET ${col}=NULL WHERE id=?`, req.user.id);
		if (prev?.fileName) {
			await fs.promises.unlink(path.join(profileMediaDir, path.basename(prev.fileName))).catch(() => {});
		}
		res.json({ ok: true, message: type === 'avatar' ? 'Foto profil dihapus.' : 'Foto latar belakang dihapus.' });
	} catch (error) {
		next(error);
	}
});

app.get('/api/profile/media/:userId/:type', requireActiveUser, async (req, res, next) => {
	const type = req.params.type;
	if (!['avatar', 'cover'].includes(type)) return res.status(404).end();
	const col = type === 'avatar' ? 'avatar_name' : 'cover_name';
	try {
		const db = await databasePromise;
		const row = await db.get(`SELECT ${col} AS fileName FROM pengguna WHERE id=?`, req.params.userId);
		if (!row?.fileName) return res.status(404).end();
		const filePath = path.join(profileMediaDir, path.basename(row.fileName));
		if (!fs.existsSync(filePath)) return res.status(404).end();
		await sendImageResponse(res, filePath);
	} catch (error) {
		next(error);
	}
});

app.get('/api/profile/face', requireActiveUser, async (req, res, next) => {
	try {
		const db = await databasePromise;
		const row = await db.get('SELECT full_name AS name, face_descriptor FROM pengguna WHERE id=?', req.user.id);
		const descriptor = parseFaceDescriptor(row?.face_descriptor);
		res.json({ hasFace: Boolean(descriptor), name: row?.name || req.user.name });
	} catch (error) {
		next(error);
	}
});

const FACE_MATCH_THRESHOLD = 0.48;
const biometricEncryptionKey = crypto.createHash('sha256')
	.update(process.env.BIOMETRIC_KEY || process.env.SESSION_SECRET || 'development-only-biometric-key')
	.digest();

function encryptFaceDescriptor(descriptor) {
	const iv = crypto.randomBytes(12);
	const cipher = crypto.createCipheriv('aes-256-gcm', biometricEncryptionKey, iv);
	const encrypted = Buffer.concat([cipher.update(JSON.stringify(descriptor), 'utf8'), cipher.final()]);
	return `v1.${iv.toString('base64')}.${cipher.getAuthTag().toString('base64')}.${encrypted.toString('base64')}`;
}

function decodeFaceDescriptor(raw) {
	if (typeof raw !== 'string') return raw;
	if (!raw.startsWith('v1.')) return raw;
	try {
		const [, iv, tag, data] = raw.split('.');
		const decipher = crypto.createDecipheriv('aes-256-gcm', biometricEncryptionKey, Buffer.from(iv, 'base64'));
		decipher.setAuthTag(Buffer.from(tag, 'base64'));
		return JSON.parse(Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8'));
	} catch (_) {
		return null;
	}
}

function parseFaceDescriptor(raw) {
	let arr = decodeFaceDescriptor(raw);
	if (typeof arr === 'string') {
		try {
			arr = JSON.parse(arr);
		} catch (_) {
			return null;
		}
	}
	if (!Array.isArray(arr) || arr.length !== 128) return null;
	if (!arr.every(v => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 10)) return null;
	return arr;
}

function euclideanDistance(a, b) {
	if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return Infinity;
	let sum = 0;
	for (let i = 0; i < a.length; i++) {
		const diff = a[i] - b[i];
		sum += diff * diff;
	}
	return Math.sqrt(sum);
}

app.post('/api/profile/face', sameOrigin, requireActiveUser, async (req, res, next) => {
	try {
		const descriptor = parseFaceDescriptor(req.body?.descriptor);
		if (!descriptor) {
			return res.status(422).json({ error: 'Data biometrik wajah tidak valid atau tidak terbaca dengan jelas.' });
		}
		const db = await databasePromise;
		await db.run('UPDATE pengguna SET face_descriptor=? WHERE id=?', encryptFaceDescriptor(descriptor), req.user.id);
		await db.run('INSERT INTO notifikasi (id,user_id,title,message) VALUES (?,?,?,?)',
			crypto.randomUUID(), req.user.id, 'Biometrik Wajah Aktif',
			'Data biometrik wajah berhasil didaftarkan untuk pemeriksaan awal saat absensi. Admin tetap memverifikasi foto kehadiran.');
		res.json({ ok: true, message: 'Wajah berhasil didaftarkan untuk pemeriksaan awal absensi.' });
	} catch (error) {
		next(error);
	}
});

app.post('/api/profile/face/check', sameOrigin, faceCheckLimiter, requireActiveUser, async (req, res, next) => {
	try {
		const submittedDescriptor = parseFaceDescriptor(req.body?.descriptor);
		if (!submittedDescriptor) return res.status(422).json({ error: 'Data pemeriksaan wajah tidak valid.' });
		const db = await databasePromise;
		const row = await db.get('SELECT face_descriptor FROM pengguna WHERE id=?', req.user.id);
		const storedDescriptor = parseFaceDescriptor(row?.face_descriptor);
		if (!storedDescriptor) return res.status(403).json({ error: 'Data wajah akun belum terdaftar.' });
		const matched = euclideanDistance(submittedDescriptor, storedDescriptor) < FACE_MATCH_THRESHOLD;
		res.json({ matched });
	} catch (error) {
		next(error);
	}
});

app.delete('/api/profile/face', sameOrigin, requireActiveUser, async (req, res, next) => {
	try {
		const db = await databasePromise;
		await db.run('UPDATE pengguna SET face_descriptor=NULL WHERE id=?', req.user.id);
		res.json({ ok: true, message: 'Data wajah biometrik berhasil dihapus. Anda dapat mendaftarkan ulang kapan saja.' });
	} catch (error) {
		next(error);
	}
});

app.get('/api/search', requireActiveUser, async (req, res, next) => {
	const query = String(req.query.q || '').trim().slice(0, 80);
	const role = String(req.query.role || '').toUpperCase();
	const className = String(req.query.className || req.query.class || '').trim();
	if (query.length === 1) return res.status(422).json({ error: 'Masukkan minimal 2 karakter.' });
	if (role && !['SISWA', 'GURU', 'STAF', 'ADMIN'].includes(role)) return res.status(422).json({ error: 'Filter peran tidak valid.' });
	try {
		const db = await databasePromise;
		const escapedQuery = query.replace(/[%_]/g, '');
		const pattern = `%${escapedQuery}%`;
		const isCurrentAdmin = req.user.role === 'ADMIN';

		let sql = `SELECT id,full_name AS name,role,detail,bio
			FROM pengguna WHERE status='AKTIF'
			AND (?='' OR full_name LIKE ? OR detail LIKE ?)
			AND (?='' OR role=?)`;
		const params = [query ? escapedQuery : '', pattern, pattern, role, role];

		// Profil admin tidak ditampilkan di user siswa & guru
		if (!isCurrentAdmin) {
			sql += " AND role != 'ADMIN'";
		}

		// Filter kelas untuk siswa
		if (className && className !== 'Semua Kelas' && className !== 'Semua') {
			sql += " AND (LOWER(TRIM(detail)) = LOWER(TRIM(?)) OR LOWER(detail) LIKE CONCAT('%', LOWER(TRIM(?)), '%'))";
			params.push(className, className);
		}

		sql += " ORDER BY full_name LIMIT 50";
		const people = await db.all(sql, ...params);
		res.json({ people });
	} catch (error) {
		next(error);
	}
});

app.get('/api/search/:id/profile', requireActiveUser, async (req, res, next) => {
	try {
		const db = await databasePromise;
		const person = await db.get("SELECT id,full_name AS name,role,detail,bio FROM pengguna WHERE id=? AND status='AKTIF'", req.params.id);
		if (!person) return res.status(404).json({ error: 'Profil tidak ditemukan.' });
		// Profil admin tidak ditampilkan di user siswa & guru
		if (person.role === 'ADMIN' && req.user.role !== 'ADMIN') {
			return res.status(404).json({ error: 'Profil admin dirahasiakan.' });
		}
		let canSeeAcademicMetrics = person.id === req.user.id || req.user.role === 'ADMIN';
		if (!canSeeAcademicMetrics && req.user.role === 'GURU' && person.role === 'SISWA') {
			canSeeAcademicMetrics = Boolean(await db.get('SELECT 1 FROM tugas WHERE created_by=? AND class_name=? LIMIT 1', req.user.id, person.detail));
		}
		const approvedAttendance = await db.get("SELECT COUNT(*) AS count FROM kehadiran WHERE user_id=? AND verification='DISETUJUI'", person.id);
		let averageScore = null, rank = null;
		if (canSeeAcademicMetrics && person.role === 'SISWA') {
			const score = await db.get(`SELECT SUM(s.score) * 100.0 / NULLIF(SUM(a.max_score),0) AS average
				FROM pengumpulan s JOIN tugas a ON a.id=s.assignment_id
				WHERE s.student_id=? AND s.score IS NOT NULL`, person.id);
			averageScore = score.average === null ? null : Math.round(score.average * 10) / 10;
			if (averageScore !== null) {
				const ranking = await db.get(`WITH averages AS (
					SELECT u.id, SUM(s.score) * 100.0 / NULLIF(SUM(a.max_score),0) AS average_score
					FROM pengguna u LEFT JOIN pengumpulan s ON s.student_id=u.id
					LEFT JOIN tugas a ON a.id=s.assignment_id
					WHERE u.status='AKTIF' AND u.role='SISWA' AND u.detail=?
					GROUP BY u.id
				), ranked AS (
					SELECT id, RANK() OVER (ORDER BY average_score DESC) AS class_rank
					FROM averages WHERE average_score IS NOT NULL
				)
				SELECT class_rank FROM ranked WHERE id=?`, person.detail, person.id);
				rank = ranking?.class_rank ?? null;
			}
		}
		res.json({ person, canSeeAcademicMetrics, averageScore, rank, approvedAttendance: canSeeAcademicMetrics ? approvedAttendance.count : null });
	} catch (error) {
		next(error);
	}
});

app.get('/api/notifications', requireActiveUser, async (req, res, next) => {
	try {
		const db = await databasePromise;
		const notifications = await db.all('SELECT id,title,message,created_at AS createdAt,is_read AS isRead FROM notifikasi WHERE user_id=? ORDER BY created_at DESC LIMIT 100', req.user.id);
		res.json({ notifications });
	} catch (error) {
		next(error);
	}
});

app.patch('/api/notifications/read-all', sameOrigin, requireActiveUser, async (req, res, next) => {
	try {
		const db = await databasePromise;
		await db.run('UPDATE notifikasi SET is_read=1 WHERE user_id=?', req.user.id);
		res.json({ ok: true });
	} catch (error) {
		next(error);
	}
});

app.patch('/api/notifications/:id/read', sameOrigin, requireActiveUser, async (req, res, next) => {
	try {
		const db = await databasePromise;
		const result = await db.run('UPDATE notifikasi SET is_read=1 WHERE id=? AND user_id=?', req.params.id, req.user.id);
		if (!result.changes) return res.status(404).json({ error: 'Notifikasi tidak ditemukan.' });
		res.json({ ok: true });
	} catch (error) {
		next(error);
	}
});

app.get('/api/posts', requireActiveUser, async (req, res, next) => {
	try {
		const db = await databasePromise;
		const isAdmin = req.user.role === 'ADMIN';
		const rows = await db.all(`SELECT p.id,p.title,p.body,p.image_name AS imageName,p.created_at AS createdAt,
			u.role AS authorRole,
			u.full_name AS realAuthorName,
			u.email AS realAuthorEmail,
			u.detail AS realAuthorDetail,
			u.identity_number AS realAuthorIdentity,
			(p.author_id=?) AS isOwner,
			(SELECT COUNT(*) FROM suka_postingan l WHERE l.post_id=p.id) AS likes,
			EXISTS(SELECT 1 FROM suka_postingan l WHERE l.post_id=p.id AND l.user_id=?) AS liked
			FROM postingan p JOIN pengguna u ON u.id=p.author_id ORDER BY p.created_at DESC LIMIT 50`, req.user.id, req.user.id);

		for (const post of rows) {
			post.canDelete = Boolean(post.isOwner || isAdmin);
			if (isAdmin) {
				post.authorName = post.realAuthorName;
				post.authorEmail = post.realAuthorEmail;
				post.authorDetail = post.realAuthorDetail;
				post.authorIdentity = post.realAuthorIdentity;
			} else {
				post.authorName = null;
				post.authorEmail = null;
				post.authorDetail = null;
				post.authorIdentity = null;
			}
			delete post.realAuthorName;
			delete post.realAuthorEmail;
			delete post.realAuthorDetail;
			delete post.realAuthorIdentity;

			const comments = await db.all(`SELECT c.id,c.body,c.created_at AS createdAt,
				cu.full_name AS realAuthorName, cu.role AS authorRole, cu.detail AS realAuthorDetail
				FROM komentar c JOIN pengguna cu ON cu.id=c.author_id WHERE c.post_id=? ORDER BY c.created_at ASC`, post.id);

			post.comments = comments.map(c => {
				const item = { id: c.id, body: c.body, createdAt: c.createdAt };
				if (isAdmin) {
					item.authorName = c.realAuthorName;
					item.authorRole = c.authorRole;
					item.authorDetail = c.realAuthorDetail;
				}
				return item;
			});
		}
		res.json({ posts: rows });
	} catch (error) {
		next(error);
	}
});

app.post('/api/posts', sameOrigin, postLimiter, requireActiveUser, postImageUpload.single('image'), async (req, res, next) => {
	const title = (req.body.title || '').trim();
	const body = (req.body.body || '').trim();
	const parsed = postSchema.safeParse({ title, body });
	if (!parsed.success) return res.status(422).json({ error: 'Judul atau isi topik tidak memenuhi batas karakter.' });
	let imageName = null, postInserted = false;
	try {
		const db = await databasePromise, id = crypto.randomUUID();
		if (req.file) {
			const extension = getImageExtension(req.file.buffer, req.file.mimetype);
			if (!extension) return res.status(422).json({ error: 'Format gambar harus JPEG, PNG, atau WebP yang valid.' });
			imageName = `${id}${extension}`;
			await writeFileAtomic(path.join(postImageDir, imageName), req.file.buffer);
		}
		await db.run('INSERT INTO postingan (id, author_id, title, body, image_name) VALUES (?, ?, ?, ?, ?)', id, req.user.id, parsed.data.title, parsed.data.body, imageName);
		postInserted = true;
		const otherUsers = await db.all("SELECT id FROM pengguna WHERE status='AKTIF' AND id<>?", req.user.id);
		const snippet = parsed.data.body.length > 100 ? parsed.data.body.slice(0, 97) + '...' : parsed.data.body;
		for (const u of otherUsers) {
			await db.run('INSERT INTO notifikasi (id,user_id,title,message) VALUES (?,?,?,?)',
				crypto.randomUUID(), u.id, `Pesan Baru: ${parsed.data.title}`, snippet);
		}
		res.status(201).json({ id, imageName });
	} catch (error) {
		if (imageName && !postInserted) fs.promises.unlink(path.join(postImageDir, imageName)).catch(() => {});
		next(error);
	}
});

app.get('/api/posts/:id/image', requireActiveUser, async (req, res, next) => {
	try {
		const db = await databasePromise;
		const post = await db.get('SELECT image_name FROM postingan WHERE id=?', req.params.id);
		if (!post || !post.image_name) return res.status(404).json({ error: 'Gambar tidak ditemukan.' });
		const filePath = path.join(postImageDir, path.basename(post.image_name));
		if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File gambar tidak ditemukan di server.' });
		await sendImageResponse(res, filePath);
	} catch (error) {
		next(error);
	}
});

app.post('/api/posts/:id/like', sameOrigin, requireActiveUser, async (req, res, next) => {
	try {
		const db = await databasePromise;
		const post = await db.get('SELECT id, author_id, title FROM postingan WHERE id=?', req.params.id);
		if (!post) return res.status(404).json({ error: 'Topik tidak ditemukan.' });
		const existing = await db.get('SELECT 1 FROM suka_postingan WHERE post_id=? AND user_id=?', req.params.id, req.user.id);
		if (existing) await db.run('DELETE FROM suka_postingan WHERE post_id=? AND user_id=?', req.params.id, req.user.id);
		else {
			await db.run('INSERT INTO suka_postingan (post_id,user_id) VALUES (?,?)', req.params.id, req.user.id);
			if (post.author_id && post.author_id !== req.user.id) {
				await db.run('INSERT INTO notifikasi (id,user_id,title,message) VALUES (?,?,?,?)',
					crypto.randomUUID(), post.author_id, 'Suka Baru pada Topik',
					`Seseorang menyukai topik Anda "${post.title}".`);
			}
		}
		res.json({ liked: !existing });
	} catch (error) {
		next(error);
	}
});

app.post('/api/posts/:id/comments', sameOrigin, commentLimiter, requireActiveUser, async (req, res, next) => {
	const parsed = commentSchema.safeParse(req.body);
	if (!parsed.success) return res.status(422).json({ error: 'Komentar wajib diisi dan maksimal 500 karakter.' });
	try {
		const db = await databasePromise;
		const post = await db.get('SELECT id, author_id, title FROM postingan WHERE id=?', req.params.id);
		if (!post) return res.status(404).json({ error: 'Topik tidak ditemukan.' });
		await db.run('INSERT INTO komentar (id,post_id,author_id,body,is_anonymous) VALUES (?,?,?,?,1)', crypto.randomUUID(), req.params.id, req.user.id, parsed.data.body);
		const snippet = parsed.data.body.length > 100 ? parsed.data.body.slice(0, 97) + '...' : parsed.data.body;
		if (post.author_id && post.author_id !== req.user.id) {
			await db.run('INSERT INTO notifikasi (id,user_id,title,message) VALUES (?,?,?,?)',
				crypto.randomUUID(), post.author_id, `Komentar Baru: ${post.title}`, snippet);
		}
		const participants = await db.all('SELECT DISTINCT author_id FROM komentar WHERE post_id=? AND author_id<>? AND author_id<>?',
			req.params.id, req.user.id, post.author_id || '');
		for (const p of participants) {
			await db.run('INSERT INTO notifikasi (id,user_id,title,message) VALUES (?,?,?,?)',
				crypto.randomUUID(), p.author_id, `Balasan Komentar: ${post.title}`, snippet);
		}
		res.status(201).json({ ok: true });
	} catch (error) {
		next(error);
	}
});

app.delete('/api/posts/:id', sameOrigin, requireActiveUser, async (req, res, next) => {
	try {
		const db = await databasePromise;
		const post = await db.get('SELECT author_id,created_at,image_name FROM postingan WHERE id=?', req.params.id);
		if (!post) return res.status(404).json({ error: 'Topik tidak ditemukan.' });
		
		let createdAtMs = 0;
		if (post.created_at instanceof Date) {
			createdAtMs = post.created_at.getTime();
		} else if (typeof post.created_at === 'string') {
			createdAtMs = new Date(post.created_at.includes('T') ? post.created_at : `${post.created_at.replace(' ', 'T')}Z`).getTime();
		} else {
			createdAtMs = new Date(post.created_at).getTime();
		}
		const age = Date.now() - createdAtMs;

		if (req.user.role !== 'ADMIN' && (post.author_id !== req.user.id || age > 24 * 60 * 60 * 1000)) {
			return res.status(403).json({ error: 'Topik ini tidak dapat dihapus oleh akun Anda.' });
		}
		await db.run('DELETE FROM komentar WHERE post_id=?', req.params.id);
		await db.run('DELETE FROM suka_postingan WHERE post_id=?', req.params.id);
		await db.run('DELETE FROM postingan WHERE id=?', req.params.id);
		if (post.image_name) {
			fs.unlink(path.join(postImageDir, path.basename(post.image_name)), () => {});
		}
		res.json({ ok: true });
	} catch (error) {
		next(error);
	}
});

app.get('/api/assignments', requireActiveUser, async (req, res, next) => {
	try {
		const db = await databasePromise;
		let assignments = [];
		const classRows = await db.all("SELECT name FROM kelas ORDER BY name ASC");
		const availableClasses = req.user.role === 'ADMIN'
			? ['Semua Kelas', ...classRows.map(r => r.name)]
			: classRows.map(row => row.name);

		if (req.user.role === 'ADMIN') {
			assignments = await db.all(`
				SELECT a.id, a.title, a.instructions AS description, COALESCE(mp.name,a.subject) AS subject, a.subject_id AS subjectId, a.material_id AS materialId, m.title AS materialTitle, a.class_name AS class, a.category, a.due_at AS due, a.max_score AS maxScore, u.full_name AS teacherName,
				       a.attachment_name AS attachmentName, a.attachment_original_name AS attachmentOriginalName,
				       (SELECT COUNT(*) FROM pengumpulan s WHERE s.assignment_id = a.id) AS submissionCount
				FROM tugas a
				LEFT JOIN pengguna u ON u.id = a.created_by
				LEFT JOIN mata_pelajaran mp ON mp.id = a.subject_id
				LEFT JOIN materi m ON m.id = a.material_id
				ORDER BY a.due_at ASC
			`);
		} else if (req.user.role === 'GURU') {
			assignments = await db.all(`
				SELECT a.id, a.title, a.instructions AS description, COALESCE(mp.name,a.subject) AS subject, a.subject_id AS subjectId, a.material_id AS materialId, m.title AS materialTitle, a.class_name AS class, a.category, a.due_at AS due, a.max_score AS maxScore, u.full_name AS teacherName,
				       a.attachment_name AS attachmentName, a.attachment_original_name AS attachmentOriginalName,
				       (SELECT COUNT(*) FROM pengumpulan s WHERE s.assignment_id = a.id) AS submissionCount
				FROM tugas a
				LEFT JOIN pengguna u ON u.id = a.created_by
				LEFT JOIN mata_pelajaran mp ON mp.id = a.subject_id
				LEFT JOIN materi m ON m.id = a.material_id
				WHERE a.created_by=?
				ORDER BY a.due_at ASC
			`, req.user.id);
		} else if (req.user.role === 'SISWA') {
			const studentClass = (req.user.detail || '').trim();
			assignments = await db.all(`
				SELECT a.id, a.title, a.instructions AS description, COALESCE(mp.name,a.subject) AS subject, a.subject_id AS subjectId, a.material_id AS materialId, m.title AS materialTitle, a.class_name AS class, a.category, a.due_at AS due, a.max_score AS maxScore, u.full_name AS teacherName,
				       a.attachment_name AS attachmentName, a.attachment_original_name AS attachmentOriginalName,
				       s.id AS submissionId, s.submitted_at AS submittedAt, s.file_name AS fileName, s.file_original_name AS fileOriginalName,
				       s.score, s.feedback, s.answer_text AS answerText
				FROM tugas a
				LEFT JOIN pengguna u ON u.id = a.created_by
				LEFT JOIN mata_pelajaran mp ON mp.id = a.subject_id
				LEFT JOIN materi m ON m.id = a.material_id
				LEFT JOIN pengumpulan s ON s.assignment_id = a.id AND s.student_id = ?
				WHERE LOWER(TRIM(a.class_name)) = LOWER(TRIM(?))
				   OR LOWER(TRIM(a.class_name)) = 'semua'
				   OR LOWER(TRIM(a.class_name)) = 'semua kelas'
				ORDER BY a.due_at ASC
			`, req.user.id, studentClass);
		}
		res.json({ assignments, availableClasses });
	} catch (error) {
		next(error);
	}
});

app.post('/api/assignments', sameOrigin, requireActiveUser, assignmentUpload.single('attachment'), async (req, res, next) => {
	if (req.user.role !== 'GURU') {
		return res.status(403).json({ error: 'Hanya guru yang dapat membuat tugas.' });
	}
	const taskPayload = {
		title: req.body.title,
		instructions: req.body.instructions,
		subject: req.body.subject || '',
		subjectId: req.body.subjectId,
		className: req.body.className,
		materialId: req.body.materialId || null,
		category: req.body.category || 'Teori',
		dueAt: req.body.dueAt,
		maxScore: Number(req.body.maxScore || 100)
	};
	const parsed = assignmentSchema.safeParse(taskPayload);
	if (!parsed.success) {
		return res.status(422).json({ error: 'Data tugas tidak valid.' });
	}
	let attachmentName = null, taskInserted = false;
	try {
		const task = parsed.data, id = crypto.randomUUID(), db = await databasePromise;
		const subject = await db.get('SELECT id,name FROM mata_pelajaran WHERE id=?', task.subjectId);
		if (!subject) return res.status(404).json({ error: 'Mata pelajaran tidak ditemukan.' });
		if (req.user.role === 'GURU') {
			const assignedSubject = await db.get('SELECT 1 FROM guru_mata_pelajaran WHERE teacher_id=? AND subject_id=?', req.user.id, subject.id);
			if (!assignedSubject) return res.status(403).json({ error: 'Tugas hanya dapat dibuat untuk mata pelajaran yang Anda ampu.' });
		}
		const cls = await db.get('SELECT id,name FROM kelas WHERE LOWER(name)=LOWER(?)', task.className);
		if (!cls) return res.status(404).json({ error: 'Kelas tujuan tidak ditemukan.' });
		if (req.user.role === 'GURU' && !task.materialId) {
			return res.status(422).json({ error: 'Pilih materi terlebih dahulu. Buat materi jika belum tersedia.' });
		}
		let material = null;
		if (task.materialId) {
			material = await db.get('SELECT id,subject_id,created_by FROM materi WHERE id=?', task.materialId);
			if (!material) return res.status(404).json({ error: 'Materi tidak ditemukan.' });
			if (material.subject_id !== subject.id) return res.status(422).json({ error: 'Materi harus sesuai dengan mata pelajaran yang dipilih.' });
			if (req.user.role === 'GURU' && material.created_by !== req.user.id) {
				return res.status(403).json({ error: 'Guru hanya dapat memilih materi yang dibuat sendiri.' });
			}
		}
		const attachmentOriginalName = req.file ? req.file.originalname : null;
		if (req.file) {
			const ext = path.extname(req.file.originalname).toLowerCase().replace(/[^a-zA-Z0-9.]/g, '').slice(0, 12);
			attachmentName = `${id}${ext}`;
			await writeFileAtomic(path.join(assignmentAttachmentDir, attachmentName), req.file.buffer);
		}
		await db.run('INSERT INTO tugas (id,title,instructions,subject,subject_id,material_id,class_name,category,due_at,max_score,created_by,attachment_name,attachment_original_name) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
			id, task.title, task.instructions, subject.name, subject.id, material?.id || null, cls.name, task.category, task.dueAt, task.maxScore, req.user.id, attachmentName, attachmentOriginalName);
		taskInserted = true;
		await notifyClassStudents(db, cls.name, `Tugas Baru: ${task.title}`, `${subject.name} (${task.category}) untuk ${cls.name}. Tenggat: ${task.dueAt.slice(0, 10)}`);
		res.status(201).json({ id, attachmentName, attachmentOriginalName });
	} catch (error) {
		if (attachmentName && !taskInserted) fs.promises.unlink(path.join(assignmentAttachmentDir, attachmentName)).catch(() => {});
		next(error);
	}
});

app.get('/api/assignments/:id/attachment', requireActiveUser, async (req, res, next) => {
	try {
		const db = await databasePromise;
		const assignment = await db.get('SELECT attachment_name, attachment_original_name, created_by, class_name FROM tugas WHERE id=?', req.params.id);
		if (!assignment || !assignment.attachment_name) return res.status(404).json({ error: 'Lampiran berkas tidak ditemukan.' });
		if (req.user.role === 'GURU' && assignment.created_by !== req.user.id) return res.status(403).json({ error: 'Anda hanya dapat mengunduh lampiran tugas yang Anda buat.' });
		if (req.user.role === 'SISWA' && !classMatches(req.user.detail, assignment.class_name)) return res.status(403).json({ error: 'Tugas ini bukan untuk kelas Anda.' });
		if (!['ADMIN', 'GURU', 'SISWA'].includes(req.user.role)) return res.status(403).json({ error: 'Akses ditolak.' });
		const filePath = path.join(assignmentAttachmentDir, path.basename(assignment.attachment_name));
		if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File lampiran tidak ditemukan di server.' });
		res.download(filePath, assignment.attachment_original_name || 'lampiran_tugas');
	} catch (error) {
		next(error);
	}
});

app.delete('/api/assignments/:id', sameOrigin, requireActiveUser, async (req, res, next) => {
	if (req.user.role !== 'GURU') {
		return res.status(403).json({ error: 'Hanya guru pemilik yang dapat menghapus tugas.' });
	}
	try {
		const db = await databasePromise;
		const assignment = await db.get('SELECT id, created_by, attachment_name FROM tugas WHERE id=?', req.params.id);
		if (!assignment) return res.status(404).json({ error: 'Tugas tidak ditemukan.' });
		if (assignment.created_by !== req.user.id) return res.status(403).json({ error: 'Anda hanya dapat menghapus tugas yang Anda buat.' });

		const subs = await db.all('SELECT file_name FROM pengumpulan WHERE assignment_id=?', req.params.id);
		await db.run('DELETE FROM pengumpulan WHERE assignment_id=?', req.params.id);
		await db.run('DELETE FROM tugas WHERE id=?', req.params.id);

		if (assignment.attachment_name) {
			await fs.promises.unlink(path.join(assignmentAttachmentDir, path.basename(assignment.attachment_name))).catch(() => {});
		}
		for (const sub of subs) {
			if (sub.file_name) {
				await fs.promises.unlink(path.join(submissionDir, path.basename(sub.file_name))).catch(() => {});
			}
		}

		res.json({ ok: true, message: 'Tugas berhasil dihapus.' });
	} catch (error) {
		next(error);
	}
});

app.post('/api/assignments/:id/submit', sameOrigin, requireActiveUser, submissionUpload.single('file'), async (req, res, next) => {
	if (req.user.role !== 'SISWA') return res.status(403).json({ error: 'Hanya siswa yang dapat mengumpulkan tugas.' });
	const assignmentId = req.params.id;
	const answerText = (req.body.answerText || '').trim();
	const file = req.file;

	if (!file && !answerText) {
		return res.status(422).json({ error: 'Harap lampirkan file tugas atau tulis catatan pengerjaan.' });
	}

	let fileName = null, submissionSaved = false;
	try {
		const db = await databasePromise;
		const assignment = await db.get('SELECT id, title, created_by, class_name, due_at FROM tugas WHERE id = ?', assignmentId);
		if (!assignment) return res.status(404).json({ error: 'Tugas tidak ditemukan.' });
		if (!classMatches(req.user.detail, assignment.class_name)) return res.status(403).json({ error: 'Tugas ini bukan untuk kelas Anda.' });
		if (!Number.isFinite(Date.parse(assignment.due_at)) || Date.parse(assignment.due_at) <= Date.now()) {
			return res.status(403).json({ error: 'Tenggat pengumpulan tugas telah berakhir.' });
		}

		const existing = await db.get('SELECT id, file_name FROM pengumpulan WHERE assignment_id = ? AND student_id = ?', assignmentId, req.user.id);
		let fileOriginalName = null;
		if (file) {
			const ext = path.extname(file.originalname).toLowerCase().replace(/[^a-zA-Z0-9.]/g, '').slice(0, 12);
			fileName = `${crypto.randomUUID()}${ext}`;
			fileOriginalName = file.originalname;
			await writeFileAtomic(path.join(submissionDir, fileName), file.buffer);
		}

		if (existing) {
			if (file) {
				await db.run('UPDATE pengumpulan SET answer_text = ?, file_name = ?, file_original_name = ?, submitted_at = CURRENT_TIMESTAMP WHERE id = ?', answerText, fileName, fileOriginalName, existing.id);
			} else {
				await db.run('UPDATE pengumpulan SET answer_text = ?, submitted_at = CURRENT_TIMESTAMP WHERE id = ?', answerText, existing.id);
			}
		} else {
			const id = crypto.randomUUID();
			await db.run('INSERT INTO pengumpulan (id, assignment_id, student_id, answer_text, file_name, file_original_name, feedback) VALUES (?,?,?,?,?,?,?)',
				id, assignmentId, req.user.id, answerText, fileName, fileOriginalName, '');
		}
		submissionSaved = true;
		if (file && existing?.file_name && existing.file_name !== fileName) {
			await fs.promises.unlink(path.join(submissionDir, path.basename(existing.file_name))).catch(() => {});
		}

		if (assignment.created_by) {
			await db.run('INSERT INTO notifikasi (id,user_id,title,message) VALUES (?,?,?,?)',
				crypto.randomUUID(), assignment.created_by, 'Pengumpulan tugas baru', `${req.user.full_name || req.user.name || 'Siswa'} (${req.user.detail || 'Siswa'}) telah mengumpulkan tugas: ${assignment.title}`);
		}

		res.json({ ok: true, message: 'Tugas berhasil dikumpulkan.' });
	} catch (error) {
		if (fileName && !submissionSaved) fs.promises.unlink(path.join(submissionDir, fileName)).catch(() => {});
		next(error);
	}
});

app.get('/api/assignments/:id/submissions', requireActiveUser, async (req, res, next) => {
	if (req.user.role !== 'GURU' && req.user.role !== 'ADMIN') {
		return res.status(403).json({ error: 'Hanya guru atau admin yang dapat melihat daftar pengumpulan.' });
	}
	try {
		const db = await databasePromise;
		const assignment = await db.get('SELECT id, title, created_by, max_score, class_name FROM tugas WHERE id = ?', req.params.id);
		if (!assignment) return res.status(404).json({ error: 'Tugas tidak ditemukan.' });
		if (req.user.role === 'GURU' && assignment.created_by !== req.user.id) {
			return res.status(403).json({ error: 'Anda hanya dapat melihat pengumpulan tugas yang Anda buat.' });
		}

		const submissions = await db.all(`
			SELECT s.id, s.assignment_id AS assignmentId, s.student_id AS studentId,
			       u.full_name AS studentName, u.email AS studentEmail, u.detail AS studentClass, u.identity_number AS identityNumber,
			       s.answer_text AS answerText, s.file_name AS fileName, s.file_original_name AS fileOriginalName,
			       s.score, s.feedback, s.submitted_at AS submittedAt
			FROM pengumpulan s
			JOIN pengguna u ON u.id = s.student_id
			WHERE s.assignment_id = ?
			ORDER BY s.submitted_at DESC
		`, req.params.id);

		res.json({ assignment, submissions });
	} catch (error) {
		next(error);
	}
});

app.get('/api/submissions/:id/file', requireActiveUser, async (req, res, next) => {
	try {
		const db = await databasePromise;
		const sub = await db.get(`
			SELECT s.file_name, s.file_original_name, s.student_id, a.created_by
			FROM pengumpulan s
			JOIN tugas a ON a.id = s.assignment_id
			WHERE s.id = ?
		`, req.params.id);

		if (!sub || !sub.file_name) return res.status(404).json({ error: 'File tugas tidak ditemukan.' });

		if (req.user.role !== 'ADMIN' && req.user.id !== sub.student_id && req.user.id !== sub.created_by) {
			return res.status(403).json({ error: 'Anda tidak memiliki hak untuk mengunduh file ini.' });
		}

		const filePath = path.join(submissionDir, sub.file_name);
		if (!fs.existsSync(filePath)) {
			return res.status(404).json({ error: 'File fisik di server tidak ditemukan.' });
		}

		res.download(filePath, sub.file_original_name || 'tugas-siswa');
	} catch (error) {
		next(error);
	}
});

app.patch('/api/submissions/:id/grade', sameOrigin, requireActiveUser, async (req, res, next) => {
	if (req.user.role !== 'GURU') {
		return res.status(403).json({ error: 'Hanya guru pemilik yang dapat memberi nilai.' });
	}
	const score = req.body.score !== null && req.body.score !== '' ? Number(req.body.score) : null;
	const feedback = String(req.body.feedback || '').trim();

	if (feedback.length > 2000 || (score !== null && (!Number.isFinite(score) || score < 0 || score > 1000))) {
		return res.status(422).json({ error: 'Nilai atau catatan tidak valid.' });
	}

	try {
		const db = await databasePromise;
		const sub = await db.get(`
			SELECT s.id, s.student_id, a.created_by, a.title, a.max_score
			FROM pengumpulan s
			JOIN tugas a ON a.id = s.assignment_id
			WHERE s.id = ?
		`, req.params.id);

		if (!sub) return res.status(404).json({ error: 'Pengumpulan tidak ditemukan.' });
		if (sub.created_by !== req.user.id) {
			return res.status(403).json({ error: 'Anda tidak memiliki hak menilai tugas ini.' });
		}
		if (score !== null && score > Number(sub.max_score)) {
			return res.status(422).json({ error: `Nilai tidak boleh melebihi ${sub.max_score}.` });
		}

		await db.run('UPDATE pengumpulan SET score = ?, feedback = ? WHERE id = ?', score, feedback, req.params.id);

		if (score !== null) {
			await db.run('INSERT INTO notifikasi (id,user_id,title,message) VALUES (?,?,?,?)',
				crypto.randomUUID(), sub.student_id, 'Tugas telah dinilai', `Tugas "${sub.title}" dinilai ${score}. Catatan guru: ${feedback || 'Tidak ada catatan.'}`);
		}

		res.json({ ok: true });
	} catch (error) {
		next(error);
	}
});

app.get('/api/admin/attendance/export', requireActiveUser, requireAdmin, async (req, res, next) => {
	try {
		const db = await databasePromise;
		const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
		const startDate = String(req.query.startDate || `${today.slice(0, 8)}01`);
		const endDate = String(req.query.endDate || today);
		const className = String(req.query.className || '').trim().slice(0, 60);
		const status = String(req.query.status || '').trim().toUpperCase();
		const format = String(req.query.format || 'xlsx').toLowerCase();
		const datePattern = /^\d{4}-\d{2}-\d{2}$/;
		if (!datePattern.test(startDate) || !datePattern.test(endDate) || startDate > endDate) {
			return res.status(422).json({ error: 'Rentang tanggal laporan tidak valid.' });
		}
		if (status && !['DISETUJUI', 'MENUNGGU', 'DITOLAK'].includes(status)) {
			return res.status(422).json({ error: 'Status kehadiran tidak valid.' });
		}
		if (!['xlsx', 'doc'].includes(format)) return res.status(422).json({ error: 'Format laporan harus xlsx atau doc.' });
		const conditions = ['a.day BETWEEN ? AND ?'];
		const params = [startDate, endDate];
		if (className) {
			conditions.push('LOWER(TRIM(u.detail))=LOWER(TRIM(?))');
			params.push(className);
		}
		if (status) {
			conditions.push('a.verification=?');
			params.push(status);
		}
		const settings = await db.get('SELECT latitude,longitude FROM pengaturan_sekolah WHERE id=1');
		const rows = await db.all(`SELECT a.day,a.captured_at AS capturedAt,a.verification,a.latitude,a.longitude,a.accuracy,
			u.full_name AS name,u.identity_number AS identityNumber,u.detail AS className
			FROM kehadiran a JOIN pengguna u ON u.id=a.user_id
			WHERE ${conditions.join(' AND ')}
			ORDER BY a.day DESC,u.full_name ASC LIMIT 20000`, ...params);
		const counts = { DISETUJUI: 0, MENUNGGU: 0, DITOLAK: 0 };
		for (const row of rows) counts[row.verification] = (counts[row.verification] || 0) + 1;
		const generatedAt = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'long', timeStyle: 'short' }).format(new Date());
		const period = `${startDate} s/d ${endDate}`;
		const fileBase = `laporan-kehadiran-${startDate}-${endDate}`;
		const headers = ['Tanggal', 'Nama', 'NIS / NIP', 'Kelas', 'Waktu (WIB)', 'Status', 'Jarak dari Titik (m)', 'Akurasi GPS (m)'];
		const data = rows.map(row => {
			const captured = new Date(row.capturedAt);
			const time = Number.isNaN(captured.getTime()) ? '' : new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(captured);
			const distance = Math.round(haversineMeters(row.latitude, row.longitude, settings.latitude, settings.longitude));
			return [row.day, row.name, row.identityNumber, row.className || '-', time, row.verification, distance, Math.round(row.accuracy)];
		});
		if (format === 'xlsx') {
			const workbook = new ExcelJS.Workbook();
			workbook.creator = 'Siglockedin';
			workbook.created = new Date();
			const summary = workbook.addWorksheet('Ringkasan');
			summary.columns = [{ width: 28 }, { width: 55 }];
			summary.addRow(['Laporan Kehadiran', 'Siglockedin']);
			summary.addRow(['Periode', period]);
			summary.addRow(['Kelas', className || 'Semua kelas']);
			summary.addRow(['Status', status || 'Semua status']);
			summary.addRow(['Dibuat', generatedAt]);
			summary.addRow(['Total catatan', rows.length]);
			summary.addRow(['Disetujui', counts.DISETUJUI]);
			summary.addRow(['Menunggu', counts.MENUNGGU]);
			summary.addRow(['Ditolak', counts.DITOLAK]);
			summary.getRow(1).font = { bold: true, size: 16, color: { argb: 'FF065F46' } };
			const detail = workbook.addWorksheet('Kehadiran');
			detail.columns = [{ width: 13 }, { width: 28 }, { width: 20 }, { width: 16 }, { width: 14 }, { width: 15 }, { width: 22 }, { width: 20 }];
			detail.addRow(headers);
			detail.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
			detail.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF047857' } };
			detail.getRow(1).alignment = { vertical: 'middle', wrapText: true };
			detail.freezePanes = 2;
			for (const values of data) {
				detail.addRow(values.map(value => typeof value === 'string' && /^[=+\-@]/.test(value) ? `'${value}` : value));
			}
			detail.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, detail.rowCount), column: headers.length } };
			const buffer = await workbook.xlsx.writeBuffer();
			res.set('Cache-Control', 'private, no-store');
			return res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').attachment(`${fileBase}.xlsx`).send(Buffer.from(buffer));
		}
		const tableRows = data.map(values => `<tr>${values.map(value => `<td>${htmlEscape(value)}</td>`).join('')}</tr>`).join('');
		const docHtml = `<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" lang="id"><head><meta charset="utf-8"><title>Laporan Kehadiran</title><style>body{font-family:Calibri,Arial,sans-serif;color:#1f2937;padding:24px}h1{font-size:20px;color:#065f46;margin-bottom:4px}p{font-size:12px;color:#6b7280}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border:1px solid #d1d5db;padding:7px 9px;font-size:11px;text-align:left}th{background:#ecfdf5;color:#065f46}</style></head><body><h1>Laporan Kehadiran — Siglockedin</h1><p>Periode: ${htmlEscape(period)} · Kelas: ${htmlEscape(className || 'Semua kelas')} · Status: ${htmlEscape(status || 'Semua status')}</p><p>Dibuat: ${htmlEscape(generatedAt)} · Total: ${rows.length} · Disetujui: ${counts.DISETUJUI} · Menunggu: ${counts.MENUNGGU} · Ditolak: ${counts.DITOLAK}</p><table><thead><tr>${headers.map(header => `<th>${htmlEscape(header)}</th>`).join('')}</tr></thead><tbody>${tableRows || '<tr><td colspan="8">Tidak ada data.</td></tr>'}</tbody></table></body></html>`;
		res.set('Cache-Control', 'private, no-store');
		return res.type('application/msword;charset=utf-8').attachment(`${fileBase}.doc`).send('\ufeff' + docHtml);
	} catch (error) {
		next(error);
	}
});

app.get('/api/admin/reports', requireActiveUser, requireAdmin, async (req, res, next) => {
	try {
		const db = await databasePromise;
		const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

		const [usersRow, attTodayRows, attAllRow, tasksRow, subsRow, postsRow, commentsRow] = await Promise.all([
			db.get(`SELECT
				COUNT(*) AS totalUsers,
				SUM(CASE WHEN role='SISWA' AND status='AKTIF' THEN 1 ELSE 0 END) AS activeStudents,
				SUM(CASE WHEN role='GURU' AND status='AKTIF' THEN 1 ELSE 0 END) AS activeTeachers,
				SUM(CASE WHEN role='STAF' AND status='AKTIF' THEN 1 ELSE 0 END) AS activeStaff,
				SUM(CASE WHEN face_descriptor IS NOT NULL THEN 1 ELSE 0 END) AS faceRegistered
				FROM pengguna`),
			db.all('SELECT verification, COUNT(*) AS total FROM kehadiran WHERE day=? GROUP BY verification', today),
			db.get('SELECT COUNT(*) AS total FROM kehadiran'),
			db.get(`SELECT
				COUNT(*) AS totalTasks,
				SUM(CASE WHEN due_at >= NOW() THEN 1 ELSE 0 END) AS activeTasks,
				SUM(CASE WHEN due_at < NOW() THEN 1 ELSE 0 END) AS overdueTasks
				FROM tugas`),
			db.get('SELECT COUNT(*) AS totalSubmissions, SUM(CASE WHEN score IS NOT NULL THEN 1 ELSE 0 END) AS gradedSubmissions FROM pengumpulan'),
			db.get('SELECT COUNT(*) AS totalPosts FROM postingan'),
			db.get('SELECT COUNT(*) AS totalComments FROM komentar')
		]);

		const attMap = { DISETUJUI: 0, MENUNGGU: 0, DITOLAK: 0 };
		for (const r of attTodayRows) {
			if (r.verification in attMap) attMap[r.verification] = Number(r.total || 0);
		}
		const activeStudents = Number(usersRow?.activeStudents || 0);
		const recordedToday = attMap.DISETUJUI + attMap.MENUNGGU + attMap.DITOLAK;
		const notYetToday = Math.max(0, activeStudents - recordedToday);

		res.json({
			today,
			users: {
				total: Number(usersRow?.totalUsers || 0),
				students: activeStudents,
				teachers: Number(usersRow?.activeTeachers || 0),
				staff: Number(usersRow?.activeStaff || 0),
				faceRegistered: Number(usersRow?.faceRegistered || 0)
			},
			attendance: {
				approvedToday: attMap.DISETUJUI,
				pendingToday: attMap.MENUNGGU,
				rejectedToday: attMap.DITOLAK,
				notYetToday,
				totalRecords: Number(attAllRow?.total || 0)
			},
			assignments: {
				total: Number(tasksRow?.totalTasks || 0),
				active: Number(tasksRow?.activeTasks || 0),
				overdue: Number(tasksRow?.overdueTasks || 0),
				submissions: Number(subsRow?.totalSubmissions || 0),
				graded: Number(subsRow?.gradedSubmissions || 0)
			},
			community: {
				posts: Number(postsRow?.totalPosts || 0),
				comments: Number(commentsRow?.totalComments || 0)
			}
		});
	} catch (error) {
		next(error);
	}
});

app.get('/api/attendance/settings', requireActiveUser, async (_, res, next) => {
	try {
		const db = await databasePromise;
		res.json({ settings: await db.get('SELECT latitude,longitude,radius_meters AS radiusMeters,open_time AS openTime,close_time AS closeTime,late_after AS lateAfter FROM pengaturan_sekolah WHERE id=1') });
	} catch (error) {
		next(error);
	}
});

app.put('/api/admin/attendance/settings', sameOrigin, requireActiveUser, requireAdmin, async (req, res, next) => {
	const parsed = settingsSchema.safeParse(req.body);
	if (!parsed.success) return res.status(422).json({ error: 'Pengaturan lokasi/jam tidak valid.' });
	try {
		const value = parsed.data, db = await databasePromise;
		await db.run('UPDATE pengaturan_sekolah SET latitude=?,longitude=?,radius_meters=?,open_time=?,close_time=?,late_after=? WHERE id=1', value.latitude, value.longitude, value.radiusMeters, value.openTime, value.closeTime, value.lateAfter);
		res.json({ ok: true });
	} catch (error) {
		next(error);
	}
});

app.post('/api/attendance/photo', sameOrigin, requireActiveUser, photoUpload.single('photo'), async (req, res, next) => {
	if (!req.file) return res.status(422).json({ error: 'Pilih foto kehadiran terlebih dahulu.' });
	const extension = getImageExtension(req.file.buffer, req.file.mimetype);
	if (!extension) return res.status(422).json({ error: 'Isi file bukan foto JPEG, PNG, atau WebP yang valid.' });
	const latitude = Number(req.body.latitude), longitude = Number(req.body.longitude), accuracy = Number(req.body.accuracy);
	if (![latitude, longitude, accuracy].every(Number.isFinite) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180 || accuracy > 100 || accuracy < 0) {
		return res.status(422).json({ error: 'Lokasi tidak valid atau akurasi GPS melebihi 100 meter.' });
	}
	try {
		const db = await databasePromise, settings = await db.get('SELECT * FROM pengaturan_sekolah WHERE id=1');
		const userFace = await db.get('SELECT face_descriptor FROM pengguna WHERE id=?', req.user.id);
		const storedDescriptor = parseFaceDescriptor(userFace?.face_descriptor);
		if (!storedDescriptor) {
			return res.status(403).json({ error: 'Data wajah biometrik akun Anda belum terdaftar. Harap daftarkan wajah di menu Profil terlebih dahulu agar kehadiran dapat diverifikasi.' });
		}
		const submittedDescriptor = parseFaceDescriptor(req.body?.faceDescriptor);
		if (!submittedDescriptor) {
			return res.status(403).json({ error: 'Verifikasi biometrik wajah wajib dilakukan melalui kamera sebelum mengirim absensi.' });
		}
		const faceDistance = euclideanDistance(submittedDescriptor, storedDescriptor);
		if (faceDistance >= FACE_MATCH_THRESHOLD) {
			return res.status(403).json({ error: 'Pemeriksaan awal wajah tidak cocok dengan data akun. Silakan ulangi di depan kamera.' });
		}
		const distance = haversineMeters(latitude, longitude, settings.latitude, settings.longitude);
		if (distance + accuracy > settings.radius_meters) return res.status(403).json({ error: `Di luar radius sekolah (${Math.round(distance)} meter, akurasi GPS ${Math.round(accuracy)} meter).` });
		const now = new Date(), localTime = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now);
		if (isProduction && (localTime < settings.open_time || localTime > settings.close_time)) return res.status(403).json({ error: `Absen dibuka pukul ${settings.open_time}–${settings.close_time} WIB.` });
		const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
		const existing = await db.get('SELECT id, photo_name FROM kehadiran WHERE user_id=? AND day=?', req.user.id, day);
		if (existing) {
			const photoName = `${existing.id}${extension}`;
			await writeFileAtomic(path.join(photoDir, photoName), req.file.buffer, true);
			await db.run('UPDATE kehadiran SET photo_name=?, latitude=?, longitude=?, accuracy=?, captured_at=?, verification="MENUNGGU" WHERE id=?', photoName, latitude, longitude, accuracy, now.toISOString(), existing.id);
			if (existing.photo_name && existing.photo_name !== photoName) {
				await fs.promises.unlink(path.join(photoDir, path.basename(existing.photo_name))).catch(() => {});
			}
			await db.run('INSERT INTO notifikasi (id,user_id,title,message) VALUES (?,?,?,?)',
				crypto.randomUUID(), req.user.id, 'Kehadiran Menunggu Verifikasi',
				`Foto kehadiran untuk tanggal ${day} berhasil diperbarui dan menunggu pemeriksaan admin.`);
			return res.status(200).json({ id: existing.id, verification: 'MENUNGGU', capturedAt: now.toISOString(), message: 'Foto kehadiran berhasil diperbarui dan menunggu verifikasi admin.' });
		}
		const id = crypto.randomUUID(), photoName = `${id}${extension}`;
		await writeFileAtomic(path.join(photoDir, photoName), req.file.buffer);
		try {
			await db.run('INSERT INTO kehadiran (id,user_id,day,photo_name,latitude,longitude,accuracy,captured_at,verification) VALUES (?,?,?,?,?,?,?,?,?)', id, req.user.id, day, photoName, latitude, longitude, accuracy, now.toISOString(), 'MENUNGGU');
		} catch (error) {
			await fs.promises.unlink(path.join(photoDir, photoName)).catch(() => {});
			if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Foto kehadiran hari ini sudah tercatat.' });
			throw error;
		}
		await db.run('INSERT INTO notifikasi (id,user_id,title,message) VALUES (?,?,?,?)',
			crypto.randomUUID(), req.user.id, 'Kehadiran Menunggu Verifikasi',
			`Foto kehadiran untuk tanggal ${day} telah dicatat dan menunggu pemeriksaan admin.`);
		res.status(201).json({ id, verification: 'MENUNGGU', capturedAt: now.toISOString(), message: 'Foto kehadiran berhasil dicatat dan menunggu verifikasi admin.' });
	} catch (error) {
		next(error);
	}
});

app.get('/api/attendance/mine', requireActiveUser, async (req, res, next) => {
	try {
		const db = await databasePromise;
		res.json({ attendance: await db.all('SELECT id,day,captured_at AS capturedAt,verification FROM kehadiran WHERE user_id=? ORDER BY captured_at DESC LIMIT 60', req.user.id) });
	} catch (error) {
		next(error);
	}
});

app.get('/api/attendance/:id/photo', requireActiveUser, async (req, res, next) => {
	try {
		const db = await databasePromise, record = await db.get('SELECT user_id,photo_name FROM kehadiran WHERE id=?', req.params.id);
		if (!record || (record.user_id !== req.user.id && req.user.role !== 'ADMIN')) return res.status(404).json({ error: 'Foto tidak ditemukan.' });
		if (!record.photo_name) return res.status(404).json({ error: 'File foto tidak ditemukan.' });
		const photoPath = path.join(photoDir, path.basename(record.photo_name));
		if (!fs.existsSync(photoPath)) return res.status(404).json({ error: 'File foto tidak ditemukan.' });
		const buffer = await fs.promises.readFile(photoPath);
		const mimeType = getImageMimeType(buffer);
		if (!mimeType) return res.status(415).json({ error: 'Format file foto rusak atau tidak didukung.' });
		res.set('Cache-Control', 'private, no-store');
		res.type(mimeType).send(buffer);
	} catch (error) {
		next(error);
	}
});

app.delete('/api/attendance/:id', sameOrigin, requireActiveUser, async (req, res, next) => {
	try {
		const db = await databasePromise, record = await db.get('SELECT user_id,photo_name,verification FROM kehadiran WHERE id=?', req.params.id);
		if (!record || record.user_id !== req.user.id || record.verification !== 'MENUNGGU') return res.status(404).json({ error: 'Foto tidak dapat dihapus.' });
		await db.run('DELETE FROM kehadiran WHERE id=?', req.params.id);
		await fs.promises.unlink(path.join(photoDir, path.basename(record.photo_name))).catch(() => {});
		res.json({ ok: true });
	} catch (error) {
		next(error);
	}
});

app.get('/api/admin/attendance', requireActiveUser, requireAdmin, async (_, res, next) => {
	try {
		const db = await databasePromise;
		res.json({ attendance: await db.all(`SELECT a.id,a.day,a.captured_at AS capturedAt,a.verification,a.latitude,a.longitude,a.accuracy,u.full_name AS name,u.email,u.role,u.detail AS detail
			FROM kehadiran a JOIN pengguna u ON u.id=a.user_id ORDER BY a.captured_at DESC LIMIT 500`) });
	} catch (error) {
		next(error);
	}
});

app.patch('/api/admin/attendance/:id', sameOrigin, requireActiveUser, requireAdmin, async (req, res, next) => {
	const parsed = attendanceDecisionSchema.safeParse(req.body);
	if (!parsed.success) return res.status(422).json({ error: 'Keputusan tidak valid.' });
	try {
		const db = await databasePromise;
		const record = await db.get('SELECT user_id, day FROM kehadiran WHERE id=?', req.params.id);
		if (!record) return res.status(404).json({ error: 'Pengajuan kehadiran tidak ditemukan.' });
		const result = await db.run('UPDATE kehadiran SET verification=? WHERE id=?', parsed.data.verification, req.params.id);
		if (!result.changes) return res.status(404).json({ error: 'Pengajuan tidak ditemukan atau sudah diputuskan.' });
		await db.run('INSERT INTO notifikasi (id,user_id,title,message) VALUES (?,?,?,?)',
			crypto.randomUUID(), record.user_id, 'Status Kehadiran',
			`Foto kehadiran Anda tanggal ${record.day} telah diverifikasi dengan status: ${parsed.data.verification}.`
		);
		res.json({ ok: true, verification: parsed.data.verification });
	} catch (error) {
		next(error);
	}
});

// Classes Management API
app.get('/api/classes', async (req, res, next) => {
	try {
		const db = await databasePromise;
		const rows = await db.all('SELECT id, name FROM kelas ORDER BY name ASC');
		res.json({ classes: rows, classNames: rows.map(r => r.name) });
	} catch (error) {
		next(error);
	}
});

app.post('/api/classes', sameOrigin, requireActiveUser, requireAdmin, async (req, res, next) => {
	const name = String(req.body.name || '').trim();
	if (name.length < 2 || name.length > 60) return res.status(422).json({ error: 'Nama kelas minimal 2 dan maksimal 60 karakter.' });
	try {
		const db = await databasePromise;
		const existing = await db.get('SELECT id FROM kelas WHERE LOWER(name) = LOWER(?)', name);
		if (existing) return res.status(409).json({ error: 'Kelas sudah ada di dalam sistem.' });
		const result = await db.run('INSERT INTO kelas (name) VALUES (?)', name);
		res.status(201).json({ id: result.lastID, name });
	} catch (error) {
		next(error);
	}
});

app.delete('/api/classes/:id', sameOrigin, requireActiveUser, requireAdmin, async (req, res, next) => {
	try {
		const db = await databasePromise;
		const cls = await db.get('SELECT id, name FROM kelas WHERE id=?', req.params.id);
		if (!cls) return res.status(404).json({ error: 'Kelas tidak ditemukan.' });
		await db.run('DELETE FROM kelas WHERE id=?', req.params.id);
		res.json({ ok: true, message: `Kelas ${cls.name} berhasil dihapus.` });
	} catch (error) {
		next(error);
	}
});

app.use(express.static(publicDir, {
	index: 'index.html',
	maxAge: isProduction ? '1h' : 0,
	setHeaders(res, filePath) {
		if (filePath.endsWith('.html') || filePath.endsWith('.css') || filePath.endsWith('.js')) {
			res.set('Cache-Control', 'no-cache');
		}
	}
}));
app.use((error, req, res, next) => {
	console.error('Request gagal:', error.message);
	if (res.headersSent) return next(error);
	const status = error instanceof multer.MulterError || error.type === 'entity.too.large' ? 413 : error.type === 'entity.parse.failed' ? 400 : 500;
	const message = status === 413 ? 'Ukuran berkas melebihi batas maksimal yang diizinkan.' : status === 400 ? 'Format data permintaan tidak valid.' : 'Terjadi kesalahan pada server.';
	res.status(status).json({ error: message });
});

async function start() {
	const db = await databasePromise;
	const adminEmail = (process.env.SEED_ADMIN_EMAIL || (isProduction ? '' : 'admin@edusmart.example')).trim().toLowerCase();
	const adminPassword = process.env.SEED_ADMIN_PASSWORD || (isProduction ? '' : crypto.randomBytes(24).toString('base64url'));
	if (isProduction && (!adminEmail || !adminPassword || !process.env.SESSION_SECRET || !process.env.APP_URL)) {
		throw new Error('Production needs APP_URL, SESSION_SECRET, and initial admin credentials.');
	}
	const existing = adminEmail ? await db.get('SELECT id FROM pengguna WHERE LOWER(email) = LOWER(?)', adminEmail) : null;
	if (!existing) {
		const id = crypto.randomUUID(), hash = await bcrypt.hash(adminPassword, Number(process.env.BCRYPT_COST || 12));
		await db.run('INSERT INTO pengguna (id,full_name,email,password_hash,role,identity_number,detail,status) VALUES (?,?,?,?,?,?,?,?)', id, 'Admin Sekolah', adminEmail, hash, 'ADMIN', `ADMIN-${id.slice(0, 8)}`, 'Administrasi sekolah', 'AKTIF');
		if (process.env.SEED_ADMIN_PASSWORD) console.log(`Admin awal dibuat: ${adminEmail}`);
		else console.log(`Admin lokal pertama kali: ${adminEmail} | kata sandi sementara: ${adminPassword}`);
	}
	app.listen(PORT, () => console.log(`EduSmart berjalan di http://localhost:${PORT}`));
}

start().catch(error => {
	console.error('Server gagal dimulai:', error.message || error.code || error);
	process.exit(1);
});