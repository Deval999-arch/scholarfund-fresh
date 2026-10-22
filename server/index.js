import express from 'express';
import session from 'express-session';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 4000;

const dataDir = path.join(__dirname, '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'scholarfund.sqlite'));

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('student', 'sponsor', 'admin')),
    university TEXT,
    bio TEXT,
    photo TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS campaigns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    goal REAL NOT NULL,
    raised REAL NOT NULL DEFAULT 0,
    story TEXT NOT NULL,
    image TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS payment_methods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    label TEXT NOT NULL,
    type TEXT NOT NULL,
    last4 TEXT,
    holder TEXT NOT NULL,
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS donations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    method TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'completed',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    message TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

function ensureSeedAdmin() {
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@scholarfund.org');
  if (!existing) {
    const password = bcrypt.hashSync('Admin@2025', 10);
    db.prepare(`
      INSERT INTO users (name, email, password, role, university, bio)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('Platform Admin', 'admin@scholarfund.org', password, 'admin', 'ScholarFund', 'Operations and platform oversight');
  }
}

ensureSeedAdmin();

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:5173');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'scholarfund-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
    },
  })
);

function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: 'ScholarFund API is live' });
});

app.post('/api/register', async (req, res) => {
  const { name, email, password, role, university, bio, photo } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email and password are required.' });
  }

  const cleanRole = role === 'sponsor' ? 'sponsor' : 'student';

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.trim().toLowerCase());
  if (existing) {
    return res.status(409).json({ error: 'An account with that email already exists.' });
  }

  const hashed = await bcrypt.hash(password, 10);

  const result = db.prepare(`
    INSERT INTO users (name, email, password, role, university, bio, photo)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    name.trim(),
    email.trim().toLowerCase(),
    hashed,
    cleanRole,
    university || '',
    bio || '',
    photo || ''
  );

  const user = db.prepare(`
    SELECT id, name, email, role, university, bio, photo
    FROM users
    WHERE id = ?
  `).get(result.lastInsertRowid);

  req.session.user = user;
  res.status(201).json({ user });
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase());

  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials.' });
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials.' });
  }

  const safeUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    university: user.university,
    bio: user.bio,
    photo: user.photo,
  };

  req.session.user = safeUser;
  res.json({ user: safeUser });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

app.get('/api/session', (req, res) => {
  res.json({ user: req.session.user || null });
});

app.get('/api/dashboard', requireAuth, (req, res) => {
  const user = req.session.user;

  if (user.role === 'student') {
    const campaigns = db.prepare(`
      SELECT *
      FROM campaigns
      WHERE user_id = ?
      ORDER BY created_at DESC
    `).all(user.id);

    const applications = db.prepare(`
      SELECT a.*, c.title AS campaign_title
      FROM applications a
      JOIN campaigns c ON c.id = a.campaign_id
      WHERE a.user_id = ?
      ORDER BY a.created_at DESC
    `).all(user.id);

    return res.json({
      user,
      campaigns,
      applications,
      methods: [],
      donations: [],
    });
  }

  if (user.role === 'sponsor') {
    const campaigns = db.prepare(`
      SELECT c.*, u.name AS student_name, u.photo AS student_photo
      FROM campaigns c
      JOIN users u ON u.id = c.user_id
      ORDER BY c.created_at DESC
    `).all();

    const methods = db.prepare(`
      SELECT *
      FROM payment_methods
      WHERE user_id = ?
      ORDER BY is_default DESC, created_at DESC
    `).all(user.id);

    const donations = db.prepare(`
      SELECT d.*, c.title AS campaign_title
      FROM donations d
      JOIN campaigns c ON c.id = d.campaign_id
      WHERE d.user_id = ?
      ORDER BY d.created_at DESC
    `).all(user.id);

    return res.json({
      user,
      campaigns,
      methods,
      donations,
      applications: [],
    });
  }

  const campaigns = db.prepare(`
    SELECT c.*, u.name AS student_name, u.photo AS student_photo
    FROM campaigns c
    JOIN users u ON u.id = c.user_id
    ORDER BY c.created_at DESC
  `).all();

  return res.json({
    user,
    campaigns,
    methods: [],
    donations: [],
    applications: [],
  });
});

app.post('/api/campaigns', requireAuth, (req, res) => {
  const { title, category, goal, story, image } = req.body;
  const user = req.session.user;

  if (user.role !== 'student') {
    return res.status(403).json({ error: 'Only students can publish campaigns.' });
  }

  if (!title || !category || !goal || !story) {
    return res.status(400).json({ error: 'All campaign fields are required.' });
  }

  const result = db.prepare(`
    INSERT INTO campaigns (user_id, title, category, goal, story, image)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(user.id, title.trim(), category.trim(), Number(goal), story.trim(), image || '');

  const campaign = db.prepare(`
    SELECT *
    FROM campaigns
    WHERE id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json({ campaign });
});

app.post('/api/payment-methods', requireAuth, (req, res) => {
  const { label, type, last4, holder } = req.body;
  const user = req.session.user;

  if (!label || !type || !holder) {
    return res.status(400).json({ error: 'Payment method details are incomplete.' });
  }

  const existing = db.prepare('SELECT id FROM payment_methods WHERE user_id = ?').get(user.id);

  const result = db.prepare(`
    INSERT INTO payment_methods (user_id, label, type, last4, holder, is_default)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(user.id, label.trim(), type, last4 || '0000', holder.trim(), existing ? 0 : 1);

  const method = db.prepare(`
    SELECT *
    FROM payment_methods
    WHERE id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json({ method });
});

app.post('/api/donations', requireAuth, (req, res) => {
  const { campaignId, amount, method } = req.body;
  const user = req.session.user;

  if (!campaignId || !amount || !method) {
    return res.status(400).json({ error: 'Donation details are required.' });
  }

  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(campaignId);
  if (!campaign) {
    return res.status(404).json({ error: 'Campaign not found.' });
  }

  const result = db.prepare(`
    INSERT INTO donations (campaign_id, user_id, amount, method, status)
    VALUES (?, ?, ?, ?, 'completed')
  `).run(campaignId, user.id, Number(amount), method);

  db.prepare(`
    UPDATE campaigns
    SET raised = raised + ?
    WHERE id = ?
  `).run(Number(amount), campaignId);

  const donation = db.prepare(`
    SELECT *
    FROM donations
    WHERE id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json({ donation });
});

app.post('/api/apply', requireAuth, (req, res) => {
  const { campaignId, message } = req.body;
  const user = req.session.user;

  if (!campaignId) {
    return res.status(400).json({ error: 'A campaign is required.' });
  }

  const existing = db.prepare(`
    SELECT id
    FROM applications
    WHERE campaign_id = ? AND user_id = ?
  `).get(campaignId, user.id);

  if (existing) {
    return res.status(409).json({ error: 'You have already applied to this campaign.' });
  }

  const result = db.prepare(`
    INSERT INTO applications (campaign_id, user_id, message, status)
    VALUES (?, ?, ?, 'pending')
  `).run(campaignId, user.id, message || '');

  const application = db.prepare(`
    SELECT *
    FROM applications
    WHERE id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json({ application });
});

app.listen(PORT, () => {
  console.log(`ScholarFund API is running on http://localhost:${PORT}`);
});
