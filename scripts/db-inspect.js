require('dotenv').config();

const mysql = require('mysql2/promise');

async function inspectDatabase() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'sekolah_hub'
  });

  try {
    const [tables] = await connection.query(
      'SELECT table_name AS name FROM information_schema.tables WHERE table_schema = DATABASE() ORDER BY table_name'
    );
    console.log(`Database: ${process.env.DB_NAME || 'sekolah_hub'}`);
    console.log('\nTables:');
    console.table(tables);

    const tableNames = new Set(tables.map(table => table.name));
    if (tableNames.has('users')) {
      const [accounts] = await connection.query(
        'SELECT full_name AS name, email, role, status, created_at AS createdAt FROM users ORDER BY created_at'
      );
      console.log('\nAccounts:');
      console.table(accounts);
    }

    for (const table of ['posts', 'comments', 'assignments', 'attendance', 'notifications']) {
      if (!tableNames.has(table)) continue;
      const [[{ count }]] = await connection.query(`SELECT COUNT(*) AS count FROM \`${table}\``);
      console.log(`${table}: ${count} rows`);
    }

    if (tableNames.has('attendance')) {
      const [attendance] = await connection.query(
        'SELECT verification, COUNT(*) AS count FROM attendance GROUP BY verification ORDER BY verification'
      );
      console.log('\nAttendance by verification state:');
      console.table(attendance);
    }
  } finally {
    await connection.end();
  }
}

inspectDatabase().catch(error => {
  console.error('Database inspection failed:', error.message || error.code || error);
  process.exitCode = 1;
});
