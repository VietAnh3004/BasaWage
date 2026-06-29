const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.POSTGRES_USER || 'admin',
  password: process.env.POSTGRES_PASSWORD || 'admin',
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB || 'chamcong',
});

// Test connection
pool.connect()
  .then(client => {
    console.log('Connected to PostgreSQL successfully');
    client.release();
  })
  .catch(err => console.error('Error connecting to PostgreSQL', err.stack));

const initDb = async () => {
  try {
    // Users (No role, just auth)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS Users (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        username TEXT,
        password TEXT NOT NULL,
        selected_company_id INTEGER,
        email_verified BOOLEAN DEFAULT TRUE,
        email_verification_token TEXT,
        email_verification_expires TIMESTAMP
      )
    `);

    // Migration logic for existing installations where 'username' was unique and 'email' didn't exist
    try {
      const colCheck = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name='users' AND column_name='email'
      `);
      if (colCheck.rows.length === 0) {
        // Run migration
        console.log("Migrating Users table to email authentication...");
        await pool.query('ALTER TABLE Users RENAME COLUMN username TO email');
        await pool.query('ALTER TABLE Users ADD COLUMN username TEXT');
        await pool.query('UPDATE Users SET username = email');
        console.log("Migration complete.");
      }
    } catch (e) {
      console.log("Migration check skipped or failed:", e.message);
    }

    // Companies
    await pool.query(`
      CREATE TABLE IF NOT EXISTS Companies (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        join_code TEXT UNIQUE NOT NULL,
        work_start_time TEXT DEFAULT '09:00:00',
        work_end_time TEXT DEFAULT '18:00:00',
        flexible_minutes INTEGER DEFAULT 0,
        max_leave_days INTEGER DEFAULT 12,
        leave_request_deadline_days INTEGER DEFAULT 0,
        leave_request_deadline_hours INTEGER DEFAULT 0
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS Sessions (
        token TEXT PRIMARY KEY,
        user_id INTEGER REFERENCES Users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Company Members (Multi-tenant relation & RBAC)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS CompanyMembers (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES Users(id) ON DELETE CASCADE,
        company_id INTEGER REFERENCES Companies(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK (role IN ('owner', 'manager', 'employee')),
        status TEXT NOT NULL CHECK (status IN ('pending', 'active')),
        linked_enno TEXT,
        UNIQUE(user_id, company_id)
      )
    `);

    // Departments
    await pool.query(`
      CREATE TABLE IF NOT EXISTS Departments (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES Companies(id) ON DELETE CASCADE,
        name TEXT NOT NULL
      )
    `);

    // Personnel (Real life employees)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS Personnel (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES Companies(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        department_id INTEGER REFERENCES Departments(id) ON DELETE SET NULL,
        user_id INTEGER REFERENCES Users(id) ON DELETE SET NULL,
        enno TEXT,
        status VARCHAR(20) DEFAULT 'active'
      )
    `);

    // Employees (Imported from device)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS Employees (
        enNo TEXT,
        company_id INTEGER REFERENCES Companies(id) ON DELETE CASCADE,
        name TEXT,
        color TEXT,
        PRIMARY KEY (enNo, company_id)
      )
    `);

    // Attendance (Imported)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS Attendance (
        id SERIAL PRIMARY KEY,
        enNo TEXT,
        company_id INTEGER REFERENCES Companies(id) ON DELETE CASCADE,
        date TEXT,
        firstCheckIn TEXT,
        lastCheckOut TEXT,
        isLate BOOLEAN,
        UNIQUE(enNo, company_id, date),
        FOREIGN KEY (enNo, company_id) REFERENCES Employees(enNo, company_id) ON DELETE CASCADE
      )
    `);

    // LeaveRequests
    await pool.query(`
      CREATE TABLE IF NOT EXISTS LeaveRequests (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES Users(id) ON DELETE CASCADE,
        company_id INTEGER REFERENCES Companies(id) ON DELETE CASCADE,
        date TEXT NOT NULL,
        reason TEXT,
        leave_type VARCHAR(100) DEFAULT 'Nghỉ phép',
        approval_status VARCHAR(20) DEFAULT 'approved'
      )
    `);

    // LeaveTypes
    await pool.query(`
      CREATE TABLE IF NOT EXISTS LeaveTypes (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES Companies(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        UNIQUE(company_id, name)
      )
    `);

    // Notifications
    await pool.query(`
      CREATE TABLE IF NOT EXISTS Notifications (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES Companies(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        actor_id INTEGER REFERENCES Users(id) ON DELETE SET NULL,
        data JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS NotificationReadStates (
        user_id INTEGER REFERENCES Users(id) ON DELETE CASCADE,
        company_id INTEGER REFERENCES Companies(id) ON DELETE CASCADE,
        last_read_notification_id INTEGER DEFAULT 0,
        updated_at TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (user_id, company_id)
      )
    `);

    // Migration: add submitter_role to LeaveRequests if not exists
    try {
      await pool.query(`ALTER TABLE Users ADD COLUMN IF NOT EXISTS selected_company_id INTEGER`);
      await pool.query(`ALTER TABLE Users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT TRUE`);
      await pool.query(`ALTER TABLE Users ADD COLUMN IF NOT EXISTS email_verification_token TEXT`);
      await pool.query(`ALTER TABLE Users ADD COLUMN IF NOT EXISTS email_verification_expires TIMESTAMP`);
      await pool.query(`ALTER TABLE Companies ADD COLUMN IF NOT EXISTS work_start_time TEXT DEFAULT '09:00:00'`);
      await pool.query(`ALTER TABLE Companies ADD COLUMN IF NOT EXISTS work_end_time TEXT DEFAULT '18:00:00'`);
      await pool.query(`ALTER TABLE Companies ADD COLUMN IF NOT EXISTS flexible_minutes INTEGER DEFAULT 0`);
      await pool.query(`ALTER TABLE Companies ADD COLUMN IF NOT EXISTS max_leave_days INTEGER DEFAULT 12`);
      await pool.query(`ALTER TABLE Companies ADD COLUMN IF NOT EXISTS leave_request_deadline_days INTEGER DEFAULT 0`);
      await pool.query(`ALTER TABLE Companies ADD COLUMN IF NOT EXISTS leave_request_deadline_hours INTEGER DEFAULT 0`);
      await pool.query(`ALTER TABLE Personnel ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active'`);
      await pool.query(`ALTER TABLE LeaveRequests ADD COLUMN IF NOT EXISTS leave_type VARCHAR(100) DEFAULT 'Nghỉ phép'`);
      await pool.query(`ALTER TABLE LeaveRequests ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) DEFAULT 'approved'`);
      const legacyAnnualLeave = 'Ngh\u00e1\u00bb\u2030 ph\u00c3\u00a9p';
      const legacyBusinessTrip = 'C\u00c3\u00b4ng t\u00c3\u00a1c';
      await pool.query(`UPDATE LeaveRequests SET leave_type = $1 WHERE leave_type = $2`, ['Nghỉ phép', legacyAnnualLeave]);
      await pool.query(`UPDATE LeaveTypes SET name = $1 WHERE name = $2`, ['Nghỉ phép', legacyAnnualLeave]);
      await pool.query(`UPDATE LeaveTypes SET name = $1 WHERE name = $2`, ['Công tác', legacyBusinessTrip]);

      const col = await pool.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name='leaverequests' AND column_name='submitter_role'
      `);
      if (col.rows.length === 0) {
        await pool.query(`ALTER TABLE LeaveRequests ADD COLUMN submitter_role VARCHAR(20) DEFAULT 'employee'`);
        console.log('Migration: added submitter_role to LeaveRequests');
      }
    } catch (e) {
      console.log('Migration submitter_role skipped:', e.message);
    }

    console.log("PostgreSQL Database schema updated for Multi-tenant SaaS.");
  } catch (error) {
    console.error("Error initializing PostgreSQL schema:", error);
  }
};

initDb();

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
