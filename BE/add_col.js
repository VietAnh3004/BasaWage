const db = require('./db.js');

async function run() {
  const client = await db.pool.connect();
  try {
    await client.query(`ALTER TABLE Personnel ADD COLUMN status VARCHAR(20) DEFAULT 'active'`);
    console.log('Column added');
  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    process.exit(0);
  }
}

run();
