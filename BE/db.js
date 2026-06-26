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
        password TEXT NOT NULL
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
        join_code TEXT UNIQUE NOT NULL
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
        enno TEXT
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
        reason TEXT
      )
    `);

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
