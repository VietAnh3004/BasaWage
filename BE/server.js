require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const crypto = require('crypto');
const net = require('net');
const tls = require('tls');
const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ dest: 'uploads/' });
const sseClients = new Map();

const addSseClient = (companyId, res) => {
  const key = String(companyId);
  if (!sseClients.has(key)) sseClients.set(key, new Set());
  sseClients.get(key).add(res);
};

const removeSseClient = (companyId, res) => {
  const key = String(companyId);
  const clients = sseClients.get(key);
  if (!clients) return;
  clients.delete(res);
  if (clients.size === 0) sseClients.delete(key);
};

const toNotificationPayload = (row) => ({
  id: String(row.id),
  companyId: row.company_id,
  type: row.type,
  title: row.title,
  message: row.message,
  actorId: row.actor_id,
  data: row.data || {},
  createdAt: row.created_at,
});

const emitCompanyEvent = async (companyId, event) => {
  const saved = await db.query(
    `
      INSERT INTO Notifications (company_id, type, title, message, actor_id, data)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `,
    [
      companyId,
      event.type,
      event.title,
      event.message,
      event.actorId || null,
      JSON.stringify(event.data || {}),
    ]
  );
  const payload = JSON.stringify(toNotificationPayload(saved.rows[0]));
  const clients = sseClients.get(String(companyId));
  if (!clients || clients.size === 0) return;

  clients.forEach(client => {
    client.write(`event: notification\n`);
    client.write(`data: ${payload}\n\n`);
  });
};

const getMemberships = async (userId) => {
  const result = await db.query(`
    SELECT cm.company_id, c.name as company_name, c.join_code, c.work_start_time, c.work_end_time,
           c.flexible_minutes,
           c.max_leave_days, c.leave_request_deadline_days, c.leave_request_deadline_hours,
           cm.role, cm.status, cm.linked_enno
    FROM CompanyMembers cm
    JOIN Companies c ON c.id = cm.company_id
    WHERE cm.user_id = $1
    ORDER BY cm.id ASC
  `, [userId]);
  return result.rows;
};

const buildUserState = async (userId) => {
  const result = await db.query('SELECT id, email, username, selected_company_id FROM Users WHERE id = $1', [userId]);
  if (result.rows.length === 0) return null;

  const user = result.rows[0];
  const memberships = await getMemberships(user.id);
  const selectedCompany = memberships.find(m => m.company_id === user.selected_company_id) || memberships[0] || null;

  return {
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      memberships,
    },
    company: selectedCompany,
  };
};

const createSession = async (userId) => {
  const token = crypto.randomUUID();
  await db.query('INSERT INTO Sessions (token, user_id) VALUES ($1, $2)', [token, userId]);
  return token;
};

const hashPassword = (password) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `pbkdf2$${salt}$${hash}`;
};

const verifyPassword = (password, storedPassword) => {
  if (!storedPassword?.startsWith('pbkdf2$')) {
    return password === storedPassword;
  }

  const [, salt, hash] = storedPassword.split('$');
  if (!salt || !hash) return false;
  const candidate = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  const candidateBuffer = Buffer.from(candidate, 'hex');
  const storedBuffer = Buffer.from(hash, 'hex');
  if (candidateBuffer.length !== storedBuffer.length) return false;
  return crypto.timingSafeEqual(candidateBuffer, storedBuffer);
};

const createVerificationToken = () => crypto.randomBytes(32).toString('hex');
const createRandomPassword = (length = 8) => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += alphabet[crypto.randomInt(0, alphabet.length)];
  }
  return password;
};

const escapeHtml = (text) => String(text)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const smtpRead = (socket) => new Promise((resolve, reject) => {
  let buffer = '';
  const onData = (chunk) => {
    buffer += chunk.toString('utf8');
    const lines = buffer.split(/\r?\n/).filter(Boolean);
    const lastLine = lines[lines.length - 1] || '';
    if (/^\d{3} /.test(lastLine)) {
      socket.off('data', onData);
      socket.off('error', reject);
      resolve(buffer);
    }
  };
  socket.on('data', onData);
  socket.once('error', reject);
});

const smtpCommand = async (socket, command, expectedCodes = ['250']) => {
  socket.write(`${command}\r\n`);
  const response = await smtpRead(socket);
  const code = response.slice(0, 3);
  if (!expectedCodes.includes(code)) {
    throw new Error(`SMTP command failed (${command}): ${response.trim()}`);
  }
  return response;
};

const sendMail = async ({ to, subject, text, html }) => {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.MAIL_FROM || user;

  if (!host || !from) {
    throw new Error('SMTP is not configured');
  }

  let socket = secure ? tls.connect({ host, port, servername: host }) : net.connect({ host, port });
  await new Promise((resolve, reject) => {
    socket.once(secure ? 'secureConnect' : 'connect', resolve);
    socket.once('error', reject);
  });
  await smtpRead(socket);
  await smtpCommand(socket, `EHLO ${process.env.SMTP_HELO || 'localhost'}`);

  if (!secure && process.env.SMTP_STARTTLS !== 'false') {
    await smtpCommand(socket, 'STARTTLS', ['220']);
    socket = tls.connect({ socket, servername: host });
    await new Promise((resolve, reject) => {
      socket.once('secureConnect', resolve);
      socket.once('error', reject);
    });
    await smtpCommand(socket, `EHLO ${process.env.SMTP_HELO || 'localhost'}`);
  }

  if (user && pass) {
    await smtpCommand(socket, 'AUTH LOGIN', ['334']);
    await smtpCommand(socket, Buffer.from(user).toString('base64'), ['334']);
    await smtpCommand(socket, Buffer.from(pass).toString('base64'), ['235']);
  }

  const encodedSubject = `=?UTF-8?B?${Buffer.from(subject, 'utf8').toString('base64')}?=`;
  const message = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encodedSubject}`,
    'MIME-Version: 1.0',
    'Content-Type: multipart/alternative; boundary="chamcong_boundary"',
    '',
    '--chamcong_boundary',
    'Content-Type: text/plain; charset=UTF-8',
    '',
    text,
    '',
    '--chamcong_boundary',
    'Content-Type: text/html; charset=UTF-8',
    '',
    html,
    '',
    '--chamcong_boundary--',
  ].join('\r\n').replace(/\r?\n\./g, '\r\n..');

  await smtpCommand(socket, `MAIL FROM:<${from}>`);
  await smtpCommand(socket, `RCPT TO:<${to}>`, ['250', '251']);
  await smtpCommand(socket, 'DATA', ['354']);
  socket.write(`${message}\r\n.\r\n`);
  await smtpRead(socket);
  await smtpCommand(socket, 'QUIT', ['221']);
};

const buildVerificationLink = (token) => {
  const baseUrl = process.env.API_PUBLIC_URL || `http://localhost:${process.env.PORT || 3001}`;
  return `${baseUrl.replace(/\/$/, '')}/api/verify-email?token=${encodeURIComponent(token)}`;
};

const sendVerificationEmail = async (email, username, token) => {
  const link = buildVerificationLink(token);
  const safeName = escapeHtml(username || email);

  await sendMail({
    to: email,
    subject: 'Xác thực tài khoản chấm công',
    text: `Xin chào ${username || email},\n\nVui lòng mở link sau để xác thực tài khoản:\n${link}\n\nLink có hiệu lực trong 24 giờ.`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#222">
        <h2>Xác thực tài khoản chấm công</h2>
        <p>Xin chào ${safeName},</p>
        <p>Vui lòng bấm nút bên dưới để xác thực tài khoản.</p>
        <p><a href="${link}" style="display:inline-block;background:#4a72b5;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Xác thực tài khoản</a></p>
        <p>Nếu nút không hoạt động, hãy mở link này:</p>
        <p><a href="${link}">${link}</a></p>
        <p>Link có hiệu lực trong 24 giờ.</p>
      </div>
    `,
  });
};

const sendEmployeeAccountEmail = async (email, username, password, token) => {
  const link = buildVerificationLink(token);
  const safeName = escapeHtml(username || email);
  const safeEmail = escapeHtml(email);
  const safePassword = escapeHtml(password);

  await sendMail({
    to: email,
    subject: 'Tài khoản chấm công của bạn',
    text: `Xin chào ${username || email},\n\nCông ty đã tạo tài khoản chấm công cho bạn.\nEmail đăng nhập: ${email}\nMật khẩu: ${password}\n\nVui lòng xác thực tài khoản trước khi đăng nhập:\n${link}\n\nLink có hiệu lực trong 24 giờ.`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#222">
        <h2>Tài khoản chấm công của bạn</h2>
        <p>Xin chào ${safeName},</p>
        <p>Công ty đã tạo tài khoản chấm công cho bạn.</p>
        <div style="background:#f5f8fd;border:1px solid #dbe6f5;border-radius:8px;padding:12px;margin:12px 0">
          <p><strong>Email đăng nhập:</strong> ${safeEmail}</p>
          <p><strong>Mật khẩu:</strong> ${safePassword}</p>
        </div>
        <p>Vui lòng bấm nút bên dưới để xác thực tài khoản trước khi đăng nhập.</p>
        <p><a href="${link}" style="display:inline-block;background:#4a72b5;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Xác thực tài khoản</a></p>
        <p>Nếu nút không hoạt động, hãy mở link này:</p>
        <p><a href="${link}">${link}</a></p>
        <p>Link có hiệu lực trong 24 giờ.</p>
      </div>
    `,
  });
};

const getBearerToken = (req) => {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : req.query.token || null;
};

// --- AUTH API ---
app.post('/api/register', async (req, res) => {
  const { email, username, password } = req.body;
  if (!email || !username || !password) return res.status(400).json({ error: 'Missing required fields' });
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const verificationToken = createVerificationToken();
    const result = await client.query(`
      INSERT INTO Users (email, username, password, email_verified, email_verification_token, email_verification_expires)
      VALUES ($1, $2, $3, false, $4, NOW() + INTERVAL '24 hours')
      RETURNING id, email, username
    `, [email, username, hashPassword(password), verificationToken]);
    await sendVerificationEmail(email, username, verificationToken);
    await client.query('COMMIT');
    res.json({ success: true, verificationRequired: true, user: result.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') return res.status(400).json({ error: 'Email already exists' });
    if (err.message === 'SMTP is not configured') return res.status(500).json({ error: 'Chưa cấu hình SMTP để gửi email xác thực' });
    if (err.code === 'ERR_SSL_WRONG_VERSION_NUMBER') {
      return res.status(500).json({ error: 'Cấu hình SMTP_SECURE/SMTP_PORT chưa đúng. Với port 587 hãy dùng SMTP_SECURE=false; với port 465 hãy dùng SMTP_SECURE=true.' });
    }
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

app.get('/api/verify-email', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).send('Thiếu token xác thực.');

  try {
    const result = await db.query(`
      UPDATE Users
      SET email_verified = true,
          email_verification_token = NULL,
          email_verification_expires = NULL
      WHERE email_verification_token = $1
        AND email_verification_expires > NOW()
      RETURNING email
    `, [token]);

    if (result.rows.length === 0) {
      return res.status(400).send(`
        <html><body style="font-family:Arial,sans-serif;padding:32px">
          <h2>Link xác thực không hợp lệ hoặc đã hết hạn</h2>
          <p>Vui lòng đăng ký lại hoặc liên hệ quản trị viên.</p>
        </body></html>
      `);
    }

    res.send(`
      <html><body style="font-family:Arial,sans-serif;padding:32px">
        <h2>Xác thực email thành công</h2>
        <p>Tài khoản ${escapeHtml(result.rows[0].email)} đã có thể đăng nhập.</p>
      </body></html>
    `);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Missing email or password' });
  try {
    const result = await db.query('SELECT * FROM Users WHERE email = $1', [email]);
    if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });

    const user = result.rows[0];
    if (!verifyPassword(password, user.password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    if (!user.email_verified) {
      return res.status(403).json({ error: 'Vui lòng xác thực email trước khi đăng nhập' });
    }
    if (!user.password.startsWith('pbkdf2$')) {
      await db.query('UPDATE Users SET password = $1 WHERE id = $2', [hashPassword(password), user.id]);
    }

    const token = await createSession(user.id);
    const state = await buildUserState(user.id);

    res.json({ success: true, token, ...state });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/session', async (req, res) => {
  const token = getBearerToken(req);
  if (!token) return res.status(401).json({ error: 'Missing session token' });

  try {
    const session = await db.query('SELECT user_id FROM Sessions WHERE token = $1', [token]);
    if (session.rows.length === 0) return res.status(401).json({ error: 'Invalid session token' });

    const state = await buildUserState(session.rows[0].user_id);
    if (!state) return res.status(401).json({ error: 'Invalid session user' });

    res.json({ success: true, ...state });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/session', async (req, res) => {
  const token = getBearerToken(req);
  if (token) {
    try {
      await db.query('DELETE FROM Sessions WHERE token = $1', [token]);
    } catch (err) {
      console.error(err);
    }
  }
  res.json({ success: true });
});

app.get('/api/notifications/stream', async (req, res) => {
  const token = getBearerToken(req);
  const { company_id } = req.query;
  if (!token || !company_id) return res.status(400).json({ error: 'Missing token or company_id' });

  try {
    const session = await db.query('SELECT user_id FROM Sessions WHERE token = $1', [token]);
    if (session.rows.length === 0) return res.status(401).json({ error: 'Invalid session token' });

    const member = await db.query(
      'SELECT id FROM CompanyMembers WHERE user_id = $1 AND company_id = $2',
      [session.rows[0].user_id, company_id]
    );
    if (member.rows.length === 0) return res.status(403).json({ error: 'Forbidden' });

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write(`event: connected\n`);
    res.write(`data: ${JSON.stringify({ ok: true })}\n\n`);

    addSseClient(company_id, res);
    const heartbeat = setInterval(() => {
      res.write(`: heartbeat\n\n`);
    }, 25000);

    req.on('close', () => {
      clearInterval(heartbeat);
      removeSseClient(company_id, res);
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/notifications', async (req, res) => {
  const token = getBearerToken(req);
  const { company_id, limit = 10, before_id } = req.query;
  if (!token || !company_id) return res.status(400).json({ error: 'Missing token or company_id' });

  try {
    const session = await db.query('SELECT user_id FROM Sessions WHERE token = $1', [token]);
    if (session.rows.length === 0) return res.status(401).json({ error: 'Invalid session token' });

    const member = await db.query(
      'SELECT id FROM CompanyMembers WHERE user_id = $1 AND company_id = $2',
      [session.rows[0].user_id, company_id]
    );
    if (member.rows.length === 0) return res.status(403).json({ error: 'Forbidden' });

    const latest = await db.query(
      'SELECT COALESCE(MAX(id), 0)::int AS latest_id FROM Notifications WHERE company_id = $1',
      [company_id]
    );
    const latestId = latest.rows[0]?.latest_id || 0;
    const readState = await db.query(
      'SELECT last_read_notification_id FROM NotificationReadStates WHERE user_id = $1 AND company_id = $2',
      [session.rows[0].user_id, company_id]
    );
    let lastReadNotificationId = readState.rows[0]?.last_read_notification_id;
    if (lastReadNotificationId === undefined) {
      lastReadNotificationId = latestId;
      await db.query(
        `
          INSERT INTO NotificationReadStates (user_id, company_id, last_read_notification_id, updated_at)
          VALUES ($1, $2, $3, NOW())
          ON CONFLICT (user_id, company_id) DO NOTHING
        `,
        [session.rows[0].user_id, company_id, latestId]
      );
    }
    const unread = await db.query(
      'SELECT COUNT(*)::int AS unread_count FROM Notifications WHERE company_id = $1 AND id > $2',
      [company_id, lastReadNotificationId]
    );
    const pageSize = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 50);
    const beforeId = parseInt(before_id, 10);
    const params = [company_id];
    let q = `
      SELECT *
      FROM Notifications
      WHERE company_id = $1
    `;
    if (!Number.isNaN(beforeId) && beforeId > 0) {
      params.push(beforeId);
      q += ` AND id < $${params.length}`;
    }
    params.push(pageSize + 1);
    q += ` ORDER BY id DESC LIMIT $${params.length}`;

    const result = await db.query(q, params);
    const rows = result.rows.slice(0, pageSize);
    res.json({
      notifications: rows.map(toNotificationPayload),
      unreadCount: unread.rows[0]?.unread_count || 0,
      lastReadNotificationId,
      hasMore: result.rows.length > pageSize,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/notifications/read', async (req, res) => {
  const token = getBearerToken(req);
  const { company_id } = req.body;
  if (!token || !company_id) return res.status(400).json({ error: 'Missing token or company_id' });

  try {
    const session = await db.query('SELECT user_id FROM Sessions WHERE token = $1', [token]);
    if (session.rows.length === 0) return res.status(401).json({ error: 'Invalid session token' });

    const member = await db.query(
      'SELECT id FROM CompanyMembers WHERE user_id = $1 AND company_id = $2',
      [session.rows[0].user_id, company_id]
    );
    if (member.rows.length === 0) return res.status(403).json({ error: 'Forbidden' });

    const latest = await db.query('SELECT COALESCE(MAX(id), 0)::int AS latest_id FROM Notifications WHERE company_id = $1', [company_id]);
    const latestId = latest.rows[0]?.latest_id || 0;
    await db.query(
      `
        INSERT INTO NotificationReadStates (user_id, company_id, last_read_notification_id, updated_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (user_id, company_id)
        DO UPDATE SET last_read_notification_id = EXCLUDED.last_read_notification_id, updated_at = NOW()
      `,
      [session.rows[0].user_id, company_id, latestId]
    );

    res.json({ success: true, unreadCount: 0, lastReadNotificationId: latestId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/notifications/custom', async (req, res) => {
  const token = getBearerToken(req);
  const { company_id, title, message } = req.body;
  const cleanTitle = String(title || '').trim();
  const cleanMessage = String(message || '').trim();
  if (!token || !company_id || !cleanTitle || !cleanMessage) {
    return res.status(400).json({ error: 'Thiếu tiêu đề hoặc nội dung thông báo' });
  }

  try {
    const session = await db.query('SELECT user_id FROM Sessions WHERE token = $1', [token]);
    if (session.rows.length === 0) return res.status(401).json({ error: 'Invalid session token' });

    const member = await db.query(
      `
        SELECT cm.role, cm.status, u.username
        FROM CompanyMembers cm
        JOIN Users u ON u.id = cm.user_id
        WHERE cm.user_id = $1 AND cm.company_id = $2
      `,
      [session.rows[0].user_id, company_id]
    );
    if (
      member.rows.length === 0 ||
      member.rows[0].status !== 'active' ||
      !['owner', 'manager'].includes(member.rows[0].role)
    ) {
      return res.status(403).json({ error: 'Không có quyền tạo thông báo công ty' });
    }

    await emitCompanyEvent(company_id, {
      type: 'custom_announcement',
      title: cleanTitle,
      message: cleanMessage,
      actorId: session.rows[0].user_id,
      data: {
        author_name: member.rows[0].username || 'Người quản lý',
        author_role: member.rows[0].role,
      },
    });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/users/profile', async (req, res) => {
  const { user_id, username, current_password, new_password } = req.body;
  if (!user_id) return res.status(400).json({ error: 'Missing user_id' });

  try {
    const result = await db.query('SELECT id, password FROM Users WHERE id = $1', [user_id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const updates = [];
    const params = [];

    if (username !== undefined) {
      const trimmedUsername = String(username).trim();
      if (!trimmedUsername) return res.status(400).json({ error: 'Tên không được để trống' });
      params.push(trimmedUsername);
      updates.push(`username = $${params.length}`);
    }

    if (new_password) {
      if (!current_password) return res.status(400).json({ error: 'Vui lòng nhập mật khẩu hiện tại' });
      if (!verifyPassword(current_password, result.rows[0].password)) {
        return res.status(400).json({ error: 'Mật khẩu hiện tại không đúng' });
      }
      if (String(new_password).length < 6) {
        return res.status(400).json({ error: 'Mật khẩu mới phải có ít nhất 6 ký tự' });
      }
      params.push(hashPassword(new_password));
      updates.push(`password = $${params.length}`);
    }

    if (updates.length === 0) return res.status(400).json({ error: 'Không có thông tin để cập nhật' });

    params.push(user_id);
    await db.query(`UPDATE Users SET ${updates.join(', ')} WHERE id = $${params.length}`, params);

    const state = await buildUserState(user_id);
    res.json({ success: true, ...state });
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
    await client.query('UPDATE Users SET selected_company_id = $1 WHERE id = $2', [companyId, user_id]);

    await client.query('COMMIT');
    const state = await buildUserState(user_id);
    res.json({ success: true, ...state });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

app.get('/api/companies/search', async (req, res) => {
  return res.status(410).json({ error: 'Tính năng tự gia nhập công ty đã bị tắt. Tài khoản nhân viên sẽ do công ty cung cấp.' });
});

app.post('/api/companies/join', async (req, res) => {
  return res.status(410).json({ error: 'Tính năng tự gia nhập công ty đã bị tắt. Tài khoản nhân viên sẽ do công ty cung cấp.' });
});

app.post('/api/users/selected-company', async (req, res) => {
  const { user_id, company_id } = req.body;
  try {
    const member = await db.query(
      'SELECT id FROM CompanyMembers WHERE user_id = $1 AND company_id = $2',
      [user_id, company_id]
    );
    if (member.rows.length === 0) return res.status(403).json({ error: 'Forbidden' });

    await db.query('UPDATE Users SET selected_company_id = $1 WHERE id = $2', [company_id, user_id]);
    const state = await buildUserState(user_id);
    res.json({ success: true, ...state });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- COMPANY SETTINGS API ---
app.put('/api/boss/settings', async (req, res) => {
  const {
    company_id,
    user_id,
    work_start_time,
    work_end_time,
    flexible_minutes,
    max_leave_days,
    leave_request_deadline_days,
    leave_request_deadline_hours,
  } = req.body;
  const flexibleMinutes = Math.max(0, parseInt(flexible_minutes, 10) || 0);
  const deadlineDays = Math.max(0, parseInt(leave_request_deadline_days, 10) || 0);
  const deadlineHours = Math.max(0, parseInt(leave_request_deadline_hours, 10) || 0);
  try {
    // Verify owner role
    const memberCheck = await db.query('SELECT role FROM CompanyMembers WHERE company_id = $1 AND user_id = $2', [company_id, user_id]);
    if (memberCheck.rows.length === 0 || memberCheck.rows[0].role !== 'owner') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await db.query(
      `
        UPDATE Companies
        SET work_start_time = $1,
            work_end_time = $2,
            flexible_minutes = $3,
            max_leave_days = $4,
            leave_request_deadline_days = $5,
            leave_request_deadline_hours = $6
        WHERE id = $7
      `,
      [work_start_time, work_end_time, flexibleMinutes, max_leave_days, deadlineDays, deadlineHours, company_id]
    );
    const state = await buildUserState(user_id);
    await emitCompanyEvent(company_id, {
      type: 'company_settings_changed',
      title: 'Cài đặt công ty đã thay đổi',
      message: 'Quy định làm việc của công ty đã được cập nhật.',
      actorId: user_id,
      data: {
        work_start_time,
        work_end_time,
        work_hours_label: `${String(work_start_time).slice(0, 5)} - ${String(work_end_time).slice(0, 5)}`,
        flexible_minutes: flexibleMinutes,
        max_leave_days,
        leave_request_deadline_days: deadlineDays,
        leave_request_deadline_hours: deadlineHours,
      },
    });
    res.json({ success: true, ...state });
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
      SELECT cm.user_id, u.username, u.email as user_email, cm.role, cm.status, cm.linked_enno 
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
    const approvedUser = await db.query('SELECT username, email FROM Users WHERE id = $1', [user_id]);
    const username = approvedUser.rows[0]?.username || `User #${user_id}`;
    await emitCompanyEvent(company_id, {
      type: 'member_approved',
      title: 'Tài khoản nhân viên mới đã được duyệt',
      message: `${username} đã được duyệt vào công ty.`,
      actorId: user_id,
      data: { user_id, username, email: approvedUser.rows[0]?.email || null },
    });
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

app.delete('/api/boss/members/:user_id', async (req, res) => {
  const { user_id } = req.params;
  const { company_id, requester_id } = req.body;
  if (!company_id || !requester_id || !user_id) {
    return res.status(400).json({ error: 'Missing company_id, requester_id or user_id' });
  }
  if (String(user_id) === String(requester_id)) {
    return res.status(400).json({ error: 'Không thể tự kick chính mình khỏi công ty' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const requester = await client.query(
      'SELECT role, status FROM CompanyMembers WHERE company_id = $1 AND user_id = $2',
      [company_id, requester_id]
    );
    if (
      requester.rows.length === 0 ||
      requester.rows[0].status !== 'active' ||
      !['owner', 'manager'].includes(requester.rows[0].role)
    ) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Không có quyền kick tài khoản khỏi công ty' });
    }

    const target = await client.query(
      `
        SELECT cm.user_id, cm.role, cm.status, u.username, u.email
        FROM CompanyMembers cm
        JOIN Users u ON u.id = cm.user_id
        WHERE cm.company_id = $1 AND cm.user_id = $2
      `,
      [company_id, user_id]
    );
    if (target.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Tài khoản không thuộc công ty này' });
    }
    if (target.rows[0].role !== 'employee') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Chỉ có thể kick tài khoản nhân viên' });
    }

    await client.query(
      'UPDATE Personnel SET user_id = NULL WHERE company_id = $1 AND user_id = $2',
      [company_id, user_id]
    );
    await client.query(
      'DELETE FROM CompanyMembers WHERE company_id = $1 AND user_id = $2',
      [company_id, user_id]
    );
    await client.query(
      'UPDATE Users SET selected_company_id = NULL WHERE id = $1 AND selected_company_id = $2',
      [user_id, company_id]
    );

    await client.query('COMMIT');

    const username = target.rows[0].username || `User #${user_id}`;
    try {
      await emitCompanyEvent(company_id, {
        type: 'member_removed',
        title: 'Tài khoản nhân viên đã bị kick khỏi công ty',
        message: `${username} đã bị xóa khỏi danh sách tài khoản của công ty.`,
        actorId: requester_id,
        data: { user_id, username, email: target.rows[0].email || null },
      });
    } catch (notifyErr) {
      console.error('Member removal notification failed:', notifyErr);
    }

    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
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

// --- DEPARTMENTS API ---
app.get('/api/boss/departments', async (req, res) => {
  const { company_id } = req.query;
  try {
    const result = await db.query('SELECT * FROM Departments WHERE company_id = $1', [company_id]);
    res.json({ departments: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/boss/departments', async (req, res) => {
  const { company_id, name } = req.body;
  try {
    const result = await db.query('INSERT INTO Departments (company_id, name) VALUES ($1, $2) RETURNING *', [company_id, name]);
    res.json({ success: true, department: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// --- PERSONNEL API ---
app.get('/api/boss/personnel', async (req, res) => {
  const { company_id } = req.query;
  try {
    const result = await db.query(`
      SELECT p.*, d.name as department_name, u.email as user_email, u.username as user_username,
             cm.role as user_role
      FROM Personnel p
      LEFT JOIN Departments d ON p.department_id = d.id
      LEFT JOIN Users u ON p.user_id = u.id
      LEFT JOIN CompanyMembers cm ON cm.user_id = p.user_id AND cm.company_id = p.company_id
      WHERE p.company_id = $1
      ORDER BY p.id DESC
    `, [company_id]);
    res.json({ personnel: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/boss/personnel', async (req, res) => {
  const { company_id, name, email, department_id } = req.body;
  if (!company_id || !name || !email) return res.status(400).json({ error: 'Missing company_id, name or email' });
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const cleanEmail = String(email).trim().toLowerCase();
    const cleanName = String(name).trim();
    const password = createRandomPassword(8);
    const verificationToken = createVerificationToken();

    const userResult = await client.query(
      `
        INSERT INTO Users (email, username, password, email_verified, email_verification_token, email_verification_expires, selected_company_id)
        VALUES ($1, $2, $3, false, $4, NOW() + INTERVAL '24 hours', $5)
        RETURNING id, email, username
      `,
      [cleanEmail, cleanName, hashPassword(password), verificationToken, company_id]
    );
    const employeeUser = userResult.rows[0];

    await client.query(
      'INSERT INTO CompanyMembers (user_id, company_id, role, status) VALUES ($1, $2, $3, $4)',
      [employeeUser.id, company_id, 'employee', 'active']
    );

    const result = await client.query(
      'INSERT INTO Personnel (company_id, name, department_id, user_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [company_id, cleanName, department_id || null, employeeUser.id]
    );
    const department = department_id
      ? await client.query('SELECT name FROM Departments WHERE id = $1 AND company_id = $2', [department_id, company_id])
      : { rows: [] };
    const departmentName = department.rows[0]?.name || 'Chưa có bộ phận';
    const personnelPayload = {
      ...result.rows[0],
      department_name: departmentName,
      user_email: employeeUser.email,
      user_username: employeeUser.username,
      user_role: 'employee',
    };

    await sendEmployeeAccountEmail(cleanEmail, cleanName, password, verificationToken);
    await client.query('COMMIT');

    await emitCompanyEvent(company_id, {
      type: 'personnel_created',
      title: 'Nhân sự mới đã được thêm',
      message: `${result.rows[0].name} đã được thêm vào danh sách nhân sự.`,
      data: personnelPayload,
    });
    res.json({ success: true, personnel: personnelPayload });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') return res.status(400).json({ error: 'Email already exists' });
    if (err.message === 'SMTP is not configured') return res.status(500).json({ error: 'Chưa cấu hình SMTP để gửi email tài khoản nhân viên' });
    if (err.code === 'ERR_SSL_WRONG_VERSION_NUMBER') {
      return res.status(500).json({ error: 'Cấu hình SMTP_SECURE/SMTP_PORT chưa đúng. Với port 587 hãy dùng SMTP_SECURE=false; với port 465 hãy dùng SMTP_SECURE=true.' });
    }
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

app.put('/api/boss/personnel/:id', async (req, res) => {
  const { id } = req.params;
  const { name, department_id } = req.body;
  try {
    await db.query(
      'UPDATE Personnel SET name = $1, department_id = $2 WHERE id = $3',
      [name, department_id || null, id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/boss/personnel/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    await db.query(
      'UPDATE Personnel SET status = $1 WHERE id = $2',
      [status, id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/boss/personnel/:id', async (req, res) => {
  const { id } = req.params;
  const { company_id, delete_linked_account = true } = req.body || {};
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const personnelRes = await client.query(
      `
        SELECT p.id, p.company_id, p.user_id, cm.role, u.username, u.email
        FROM Personnel p
        LEFT JOIN CompanyMembers cm ON cm.company_id = p.company_id AND cm.user_id = p.user_id
        LEFT JOIN Users u ON u.id = p.user_id
        WHERE p.id = $1
      `,
      [id]
    );
    if (personnelRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Không tìm thấy nhân sự' });
    }

    const person = personnelRes.rows[0];
    if (company_id && String(person.company_id) !== String(company_id)) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Nhân sự không thuộc công ty này' });
    }

    await client.query('DELETE FROM Personnel WHERE id = $1', [id]);

    let deletedUserId = null;
    if (delete_linked_account && person.user_id && person.role === 'employee') {
      await client.query('DELETE FROM Users WHERE id = $1', [person.user_id]);
      deletedUserId = person.user_id;
    }

    await client.query('COMMIT');
    res.json({ success: true, deletedUserId });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

app.post('/api/boss/personnel/connect', async (req, res) => {
  const { company_id, personnel_id, user_id, enno } = req.body;
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const personnelRes = await client.query(
      'SELECT id, user_id, enno FROM Personnel WHERE id = $1 AND company_id = $2',
      [personnel_id, company_id]
    );
    if (personnelRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Không tìm thấy nhân sự' });
    }
    const currentPersonnel = personnelRes.rows[0];

    if (user_id) {
      const memberRes = await client.query(
        'SELECT user_id FROM CompanyMembers WHERE company_id = $1 AND user_id = $2',
        [company_id, user_id]
      );
      if (memberRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Tài khoản không thuộc công ty này' });
      }

      const userLinkedElsewhere = await client.query(
        'SELECT id FROM Personnel WHERE company_id = $1 AND user_id = $2 AND id <> $3',
        [company_id, user_id, personnel_id]
      );
      if (userLinkedElsewhere.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Tài khoản này đã được kết nối với nhân sự khác' });
      }
    }

    if (enno) {
      const machineRes = await client.query(
        'SELECT enNo FROM Employees WHERE company_id = $1 AND enNo = $2',
        [company_id, enno]
      );
      if (machineRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'ID máy chấm công không tồn tại' });
      }

      const ennoLinkedElsewhere = await client.query(
        'SELECT id FROM Personnel WHERE company_id = $1 AND enno = $2 AND id <> $3',
        [company_id, enno, personnel_id]
      );
      if (ennoLinkedElsewhere.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'ID máy chấm công này đã được kết nối với nhân sự khác' });
      }

      const accountLinkedElsewhere = await client.query(
        `
          SELECT user_id
          FROM CompanyMembers
          WHERE company_id = $1
            AND linked_enno = $2
            AND ($3::integer IS NULL OR user_id <> $3)
        `,
        [company_id, enno, user_id || null]
      );
      if (accountLinkedElsewhere.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'ID máy chấm công này đã được kết nối với tài khoản khác' });
      }
    }

    if (currentPersonnel.user_id && String(currentPersonnel.user_id) !== String(user_id || '')) {
      await client.query(
        'UPDATE CompanyMembers SET linked_enno = NULL WHERE user_id = $1 AND company_id = $2',
        [currentPersonnel.user_id, company_id]
      );
    }
    
    // Update personnel record
    await client.query(
      'UPDATE Personnel SET user_id = $1, enno = $2 WHERE id = $3 AND company_id = $4',
      [user_id || null, enno || null, personnel_id, company_id]
    );

    // Sync CompanyMembers linked_enno so attendance logic still works
    if (user_id) {
      await client.query(
        'UPDATE CompanyMembers SET linked_enno = $1 WHERE user_id = $2 AND company_id = $3',
        [enno || null, user_id, company_id]
      );
    }
    
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

app.post('/api/boss/personnel/disconnect', async (req, res) => {
  const { company_id, personnel_id } = req.body;
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const personnelRes = await client.query(
      'SELECT user_id FROM Personnel WHERE id = $1 AND company_id = $2',
      [personnel_id, company_id]
    );
    if (personnelRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Không tìm thấy nhân sự' });
    }
    const userId = personnelRes.rows[0].user_id;

    await client.query(
      'UPDATE Personnel SET enno = NULL WHERE id = $1 AND company_id = $2',
      [personnel_id, company_id]
    );

    if (userId) {
      await client.query(
        'UPDATE CompanyMembers SET linked_enno = NULL WHERE user_id = $1 AND company_id = $2',
        [userId, company_id]
      );
    }
    
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

app.delete('/api/boss/machine-employees/:enno', async (req, res) => {
  const { enno } = req.params;
  const { company_id } = req.query;
  if (!company_id || !enno) return res.status(400).json({ error: 'Missing company_id or enno' });

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      'UPDATE Personnel SET enno = NULL WHERE company_id = $1 AND enno = $2',
      [company_id, enno]
    );
    await client.query(
      'UPDATE CompanyMembers SET linked_enno = NULL WHERE company_id = $1 AND linked_enno = $2',
      [company_id, enno]
    );
    const result = await client.query(
      'DELETE FROM Employees WHERE company_id = $1 AND enNo = $2',
      [company_id, enno]
    );

    await client.query('COMMIT');
    res.json({ success: true, deleted: result.rowCount });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

const notifyManagersAboutLeave = async (leaveRequest) => {
  const [companyRes, submitterRes, recipientsRes] = await Promise.all([
    db.query('SELECT name FROM Companies WHERE id = $1', [leaveRequest.company_id]),
    db.query('SELECT email, username FROM Users WHERE id = $1', [leaveRequest.user_id]),
    db.query(`
      SELECT DISTINCT u.email, u.username, cm.role
      FROM CompanyMembers cm
      JOIN Users u ON u.id = cm.user_id
      WHERE cm.company_id = $1
        AND cm.status = 'active'
        AND cm.role IN ('owner', 'manager')
    `, [leaveRequest.company_id]),
  ]);

  const companyName = companyRes.rows[0]?.name || `Công ty #${leaveRequest.company_id}`;
  const submitter = submitterRes.rows[0] || {};
  const recipients = recipientsRes.rows.filter(r => r.email);
  if (recipients.length === 0) return;

  const statusLabel = {
    approved: 'Đã duyệt',
    pending: 'Chờ duyệt',
    rejected: 'Từ chối',
  }[leaveRequest.approval_status] || leaveRequest.approval_status;

  const lines = [
    `Công ty: ${companyName}`,
    `Người gửi: ${submitter.username || 'Không rõ'}`,
    `Email người gửi: ${submitter.email || '-'}`,
    `Ngày nghỉ: ${leaveRequest.date}`,
    `Loại đơn: ${leaveRequest.leave_type || '-'}`,
    `Lý do: ${leaveRequest.reason || '-'}`,
    `Trạng thái: ${statusLabel}`,
  ];

  const htmlRows = [
    ['Công ty', companyName],
    ['Người gửi', submitter.username || 'Không rõ'],
    ['Email người gửi', submitter.email || '-'],
    ['Ngày nghỉ', leaveRequest.date],
    ['Loại đơn', leaveRequest.leave_type || '-'],
    ['Lý do', leaveRequest.reason || '-'],
    ['Trạng thái', statusLabel],
  ].map(([label, value]) => `
    <tr>
      <td style="padding:8px 12px;border:1px solid #e5e7eb;font-weight:600;background:#f9fafb">${escapeHtml(label)}</td>
      <td style="padding:8px 12px;border:1px solid #e5e7eb">${escapeHtml(value)}</td>
    </tr>
  `).join('');

  const results = await Promise.allSettled(recipients.map(recipient => sendMail({
    to: recipient.email,
    subject: `Đơn nghỉ phép mới - ${submitter.username || submitter.email || 'Nhân viên'}`,
    text: `Có đơn nghỉ phép mới.\n\n${lines.join('\n')}`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#222">
        <h2>Có đơn nghỉ phép mới</h2>
        <table style="border-collapse:collapse;border:1px solid #e5e7eb">${htmlRows}</table>
      </div>
    `,
  })));

  const failed = results.filter(result => result.status === 'rejected');
  if (failed.length > 0) {
    throw new Error(`Failed to send ${failed.length}/${recipients.length} leave notification emails`);
  }
};

// --- LEAVE API ---
const getLeaveSubmissionDeadline = (leaveDate, daysBefore = 0, hoursBefore = 0) => {
  const advanceMs = ((Number(daysBefore) || 0) * 24 + (Number(hoursBefore) || 0)) * 60 * 60 * 1000;
  if (advanceMs <= 0) return null;

  const leaveStart = new Date(`${leaveDate}T00:00:00`);
  if (Number.isNaN(leaveStart.getTime())) return 'invalid';
  return new Date(leaveStart.getTime() - advanceMs);
};

const formatDateTime = (dateValue) => dateValue.toLocaleString('vi-VN', {
  hour: '2-digit',
  minute: '2-digit',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

app.post('/api/leave', async (req, res) => {
  const { user_id, company_id, date, reason, leave_type, submitter_role } = req.body;
  const normalizedLeaveType = leave_type || 'Nghỉ phép';
  try {
    const member = await db.query(
      'SELECT role FROM CompanyMembers WHERE user_id = $1 AND company_id = $2 AND status = $3',
      [user_id, company_id, 'active']
    );
    if (member.rows.length === 0) {
      return res.status(403).json({ error: 'Không có quyền tạo đơn cho công ty này' });
    }
    const actualSubmitterRole = member.rows[0].role;
    const approval_status = actualSubmitterRole === 'owner' || normalizedLeaveType === 'Nghỉ phép' ? 'approved' : 'pending';

    const companySettings = await db.query(
      'SELECT max_leave_days, leave_request_deadline_days, leave_request_deadline_hours FROM Companies WHERE id = $1',
      [company_id]
    );
    const settings = companySettings.rows[0] || {};
    const submitDeadline = getLeaveSubmissionDeadline(
      date,
      settings.leave_request_deadline_days || 0,
      settings.leave_request_deadline_hours || 0
    );
    if (submitDeadline === 'invalid') {
      return res.status(400).json({ error: 'Ngày nghỉ không hợp lệ' });
    }
    if (submitDeadline && new Date() > submitDeadline) {
      return res.status(400).json({
        error: `Đã quá hạn gửi đơn. Đơn cho ngày ${date} phải được gửi muộn nhất lúc ${formatDateTime(submitDeadline)}.`,
      });
    }

    if (normalizedLeaveType === 'Nghỉ phép') {
      const maxLeaveDays = settings.max_leave_days || 12;
      const used = await db.query(`
        SELECT COUNT(*)::int AS used_days
        FROM LeaveRequests
        WHERE user_id = $1
          AND company_id = $2
          AND leave_type = $3
          AND approval_status = 'approved'
      `, [user_id, company_id, 'Nghỉ phép']);

      if ((used.rows[0]?.used_days || 0) >= maxLeaveDays) {
        return res.status(400).json({ error: 'Đã hết quỹ nghỉ phép' });
      }
    }

    const inserted = await db.query(
      'INSERT INTO LeaveRequests (user_id, company_id, date, reason, leave_type, approval_status, submitter_role) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [user_id, company_id, date, reason, normalizedLeaveType, approval_status, actualSubmitterRole]
    );
    const submitter = await db.query('SELECT username, email FROM Users WHERE id = $1', [user_id]);
    const submitterName = submitter.rows[0]?.username || `User #${user_id}`;

    await emitCompanyEvent(company_id, {
      type: 'leave_request_created',
      title: 'Có đơn nghỉ phép mới',
      message: `${submitterName} vừa tạo đơn ${normalizedLeaveType} ngày ${date}.`,
      actorId: user_id,
      data: {
        ...inserted.rows[0],
        username: submitterName,
        email: submitter.rows[0]?.email || null,
      },
    });

    try {
      await notifyManagersAboutLeave(inserted.rows[0]);
      res.json({ success: true });
    } catch (mailErr) {
      console.error('Leave notification email failed:', mailErr);
      res.json({ success: true, mailWarning: 'Đã tạo đơn nhưng gửi email thông báo thất bại' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/leave/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM LeaveRequests WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/leave/:id/approve', async (req, res) => {
  const { id } = req.params;
  const { approval_status } = req.body; // 'approved' or 'rejected'
  try {
    await db.query('UPDATE LeaveRequests SET approval_status = $1 WHERE id = $2', [approval_status, id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/leave', async (req, res) => {
  const { company_id, user_id, role } = req.query;
  try {
    let q = `
      SELECT l.*, u.username, cm.linked_enno, cm.role as submitter_role
      FROM LeaveRequests l 
      JOIN Users u ON u.id = l.user_id 
      LEFT JOIN CompanyMembers cm ON cm.user_id = l.user_id AND cm.company_id = l.company_id
      WHERE l.company_id = $1
    `;
    const params = [company_id];
    if (role === 'employee') {
      q += ` AND l.user_id = $2`;
      params.push(user_id);
    } else if (role === 'manager') {
      // Manager sees all (their own + employees), but NOT other managers' private data
      // We still return all but FE handles approve button visibility
    }
    q += ' ORDER BY l.id DESC';
    const result = await db.query(q, params);
    res.json({ leaveRequests: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// --- LEAVE TYPES API ---
const ensureDefaultLeaveTypes = async (companyId) => {
  const defaultTypes = ['Nghỉ phép', 'Công tác'];
  await Promise.all(defaultTypes.map(name => db.query(
    'INSERT INTO LeaveTypes (company_id, name) VALUES ($1, $2) ON CONFLICT (company_id, name) DO NOTHING',
    [companyId, name]
  )));
};

app.get('/api/leave-types', async (req, res) => {
  const { company_id } = req.query;
  try {
    await ensureDefaultLeaveTypes(company_id);
    const result = await db.query('SELECT * FROM LeaveTypes WHERE company_id = $1 ORDER BY id ASC', [company_id]);
    res.json({ leaveTypes: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/leave-types', async (req, res) => {
  const { company_id, name } = req.body;
  try {
    await ensureDefaultLeaveTypes(company_id);
    const result = await db.query(
      'INSERT INTO LeaveTypes (company_id, name) VALUES ($1, $2) ON CONFLICT (company_id, name) DO NOTHING RETURNING *',
      [company_id, name]
    );
    res.json({ success: true, leaveType: result.rows[0] });
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
    const companySettings = await client.query('SELECT work_start_time, flexible_minutes FROM Companies WHERE id = $1', [company_id]);
    const workStartTime = companySettings.rows[0]?.work_start_time || '09:00:00';
    const flexibleMinutes = Math.max(0, parseInt(companySettings.rows[0]?.flexible_minutes, 10) || 0);
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
      const isLate = parseTime(firstCheckIn) > parseTime(workStartTime) + flexibleMinutes * 60;

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
