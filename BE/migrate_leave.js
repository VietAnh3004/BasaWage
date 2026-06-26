const db = require('./db.js');

async function run() {
  const client = await db.pool.connect();
  try {
    // Add columns to LeaveRequests
    await client.query(`
      ALTER TABLE LeaveRequests 
      ADD COLUMN IF NOT EXISTS leave_type VARCHAR(100) DEFAULT 'Nghỉ phép',
      ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) DEFAULT 'approved'
    `);
    console.log('Columns added to LeaveRequests');

    // Create LeaveTypes table
    await client.query(`
      CREATE TABLE IF NOT EXISTS LeaveTypes (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES Companies(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        UNIQUE(company_id, name)
      )
    `);
    console.log('LeaveTypes table created');

    // Seed default leave types for all existing companies
    await client.query(`
      INSERT INTO LeaveTypes (company_id, name)
      SELECT id, 'Nghỉ phép' FROM Companies
      ON CONFLICT (company_id, name) DO NOTHING
    `);
    await client.query(`
      INSERT INTO LeaveTypes (company_id, name)
      SELECT id, 'Công tác' FROM Companies
      ON CONFLICT (company_id, name) DO NOTHING
    `);
    console.log('Default leave types seeded');

  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    process.exit(0);
  }
}

run();
