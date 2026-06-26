require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ dest: 'uploads/' });

// --- AUTH API ---
app.post('/api/register', async (req, res) => {
  const { email, username, password } = req.body;
  try {
    const result = await db.query('INSERT INTO Users (email, username, password) VALUES ($1, $2, $3) RETURNING id, email, username', [email, username, password]);
    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Email already exists' });
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await db.query('SELECT * FROM Users WHERE email = $1 AND password = $2', [email, password]);
    if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
    
    const user = result.rows[0];
    // Find if user is in any company
    const members = await db.query(`
      SELECT cm.company_id, c.name as company_name, c.join_code, cm.role, cm.status, cm.linked_enno 
      FROM CompanyMembers cm 
      JOIN Companies c ON c.id = cm.company_id 
      WHERE cm.user_id = $1
    `, [user.id]);

    res.json({ success: true, user: { id: user.id, email: user.email, username: user.username, memberships: members.rows } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- COMPANY API ---
const generateJoinCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

app.post('/api/companies/create', async (req, res) => {
  const { name, user_id } = req.body;
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const code = generateJoinCode();
    const cRes = await client.query('INSERT INTO Companies (name, join_code) VALUES ($1, $2) RETURNING id', [name, code]);
    const companyId = cRes.rows[0].id;
    
    await client.query('INSERT INTO CompanyMembers (user_id, company_id, role, status) VALUES ($1, $2, $3, $4)', [user_id, companyId, 'owner', 'active']);
    
    await client.query('COMMIT');
    res.json({ success: true, company: { id: companyId, name, join_code: code, role: 'owner' } });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

app.get('/api/companies/search', async (req, res) => {
  const { code } = req.query;
  try {
    const result = await db.query('SELECT id, name FROM Companies WHERE join_code = $1', [code.toUpperCase()]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Company not found' });
    res.json({ company: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/companies/join', async (req, res) => {
  const { user_id, company_id } = req.body;
  try {
    await db.query('INSERT INTO CompanyMembers (user_id, company_id, role, status) VALUES ($1, $2, $3, $4)', [user_id, company_id, 'employee', 'pending']);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- HR MANAGEMENT API ---
app.get('/api/boss/members', async (req, res) => {
  const { company_id } = req.query;
  try {
    const result = await db.query(`
      SELECT cm.user_id, u.username, cm.role, cm.status, cm.linked_enno 
      FROM CompanyMembers cm
      JOIN Users u ON u.id = cm.user_id
      WHERE cm.company_id = $1
    `, [company_id]);
    res.json({ members: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/boss/members/approve', async (req, res) => {
  const { company_id, user_id } = req.body;
  try {
    await db.query('UPDATE CompanyMembers SET status = $1 WHERE company_id = $2 AND user_id = $3', ['active', company_id, user_id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/boss/members/role', async (req, res) => {
  const { company_id, user_id, role } = req.body;
  try {
    await db.query('UPDATE CompanyMembers SET role = $1 WHERE company_id = $2 AND user_id = $3', [role, company_id, user_id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/boss/members/link', async (req, res) => {
  const { company_id, user_id, linked_enno } = req.body;
  try {
    await db.query('UPDATE CompanyMembers SET linked_enno = $1 WHERE company_id = $2 AND user_id = $3', [linked_enno, company_id, user_id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// --- LEAVE API ---
app.post('/api/leave', async (req, res) => {
  const { user_id, company_id, date, reason } = req.body;
  try {
    await db.query('INSERT INTO LeaveRequests (user_id, company_id, date, reason) VALUES ($1, $2, $3, $4)', [user_id, company_id, date, reason]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/leave', async (req, res) => {
  const { company_id, user_id, role } = req.query;
  try {
    let q = `
      SELECT l.*, u.username, cm.linked_enno 
      FROM LeaveRequests l 
      JOIN Users u ON u.id = l.user_id 
      LEFT JOIN CompanyMembers cm ON cm.user_id = l.user_id AND cm.company_id = l.company_id
      WHERE l.company_id = $1
    `;
    const params = [company_id];
    if (role === 'employee') {
      q += ` AND l.user_id = $2`;
      params.push(user_id);
    }
    const result = await db.query(q, params);
    res.json({ leaveRequests: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});


// --- ATTENDANCE LOGIC ---
const getRandomColor = () => {
  const letters = '0123456789ABCDEF';
  let color = '#';
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
};

const parseFile = (filePath) => {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/);
  const records = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const parts = line.split('\t');
    if (parts.length < 7) continue;

    const enNo = parts[2].trim();
    const name = parts[3].trim();
    const mode = parts[5].trim();
    const dateTimeStr = parts[6].trim();

    if (mode === '0') continue;
    if (!name) continue;

    const [date, time] = dateTimeStr.split(' ');
    const formattedDate = date.replace(/\//g, '-'); 
    records.push({ enNo, name, date: formattedDate, time });
  }
  return records;
};

app.post('/api/upload', upload.single('file'), async (req, res) => {
  const company_id = req.body.company_id;
  if (!req.file || !company_id) return res.status(400).json({ error: 'Missing file or company_id' });

  const client = await db.pool.connect();
  try {
    const records = parseFile(req.file.path);
    const grouped = {};
    const employeesMap = {};

    records.forEach(r => {
      employeesMap[r.enNo] = r.name;
      const key = `${r.enNo}_${r.date}`;
      if (!grouped[key]) {
        grouped[key] = { enNo: r.enNo, date: r.date, times: [] };
      }
      grouped[key].times.push(r.time);
    });

    await client.query('BEGIN');

    // Insert employees for this company
    for (const [enNo, name] of Object.entries(employeesMap)) {
      await client.query(
        'INSERT INTO Employees (enNo, company_id, name, color) VALUES ($1, $2, $3, $4) ON CONFLICT (enNo, company_id) DO NOTHING',
        [enNo, company_id, name, getRandomColor()]
      );
    }

    for (const group of Object.values(grouped)) {
      const resExisting = await client.query('SELECT firstCheckIn, lastCheckOut FROM Attendance WHERE enNo = $1 AND company_id = $2 AND date = $3', [group.enNo, company_id, group.date]);
      if (resExisting.rows.length > 0) {
        const existing = resExisting.rows[0];
        if (existing.firstcheckin) group.times.push(existing.firstcheckin);
        if (existing.lastcheckout) group.times.push(existing.lastcheckout);
      }

      group.times.sort((a, b) => {
        const parseT = (t) => t.split(':').map(Number).reduce((acc, val, i) => acc + val * Math.pow(60, 2 - i), 0);
        return parseT(a) - parseT(b);
      });
      const firstCheckIn = group.times[0];
      const lastCheckOut = group.times[group.times.length - 1];
      
      const parseTime = (timeStr) => {
        const parts = timeStr.split(':').map(Number);
        return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
      };
      const isLate = parseTime(firstCheckIn) > 9 * 3600;

      await client.query(`
        INSERT INTO Attendance (enNo, company_id, date, firstCheckIn, lastCheckOut, isLate)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT(enNo, company_id, date) DO UPDATE SET 
          firstCheckIn = excluded.firstCheckIn,
          lastCheckOut = excluded.lastCheckOut,
          isLate = excluded.isLate
      `, [group.enNo, company_id, group.date, firstCheckIn, lastCheckOut, isLate]);
    }

    await client.query('COMMIT');
    fs.unlinkSync(req.file.path);
    res.json({ success: true, message: 'File processed' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

app.get('/api/attendance', async (req, res) => {
  const { company_id, linked_enno, role } = req.query;
  try {
    // Return all employees in the company
    const employeesRes = await db.query('SELECT * FROM Employees WHERE company_id = $1', [company_id]);
    
    // Return attendance logs
    let q = 'SELECT * FROM Attendance WHERE company_id = $1';
    const params = [company_id];
    
    // If employee, only return their logs
    if (role === 'employee') {
      if (!linked_enno) {
        return res.json({ employees: employeesRes.rows, attendanceLogs: [] });
      }
      q += ' AND enNo = $2';
      params.push(linked_enno);
    }
    
    const attendanceLogsRes = await db.query(q, params);
    
    const attendanceLogs = attendanceLogsRes.rows.map(row => ({
      id: row.id,
      enNo: row.enno,
      date: row.date,
      firstCheckIn: row.firstcheckin,
      lastCheckOut: row.lastcheckout,
      isLate: row.islate
    }));

    const employees = employeesRes.rows.map(row => ({
      enNo: row.enno,
      name: row.name,
      color: row.color
    }));

    res.json({ employees, attendanceLogs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB Error' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
