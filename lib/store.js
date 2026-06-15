// User store.
//  - If DATABASE_URL (or POSTGRES_URL) is set  -> Postgres  (persists online; for hosting)
//  - Otherwise                                 -> local JSON file (works on your PC)
// All functions are async so both backends behave the same way to callers.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const DB_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
const useDb = !!DB_URL;

/* ----------------------------- Postgres mode ----------------------------- */
let _pool, _ready;
async function pool() {
  if (!_pool) {
    const { default: pg } = await import('pg');
    _pool = new pg.Pool({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  }
  if (!_ready) {
    _ready = _pool.query(`CREATE TABLE IF NOT EXISTS users (
      email         TEXT PRIMARY KEY,
      role          TEXT NOT NULL,
      salt          TEXT,
      password_hash TEXT,
      created_at    BIGINT,
      created_by    TEXT
    )`);
  }
  await _ready;
  return _pool;
}
const rowToUser = (r) => (r ? {
  email: r.email, role: r.role, salt: r.salt, passwordHash: r.password_hash,
  createdAt: Number(r.created_at) || 0, createdBy: r.created_by || undefined,
} : null);

/* ------------------------------- File mode -------------------------------- */
const DATA_FILE = resolve(process.cwd(), 'data', 'users.json');
function fileLoad() {
  if (!existsSync(DATA_FILE)) return { users: [] };
  try { return JSON.parse(readFileSync(DATA_FILE, 'utf8')); } catch { return { users: [] }; }
}
function fileSave(db) {
  mkdirSync(dirname(DATA_FILE), { recursive: true });
  writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

/* --------------------------------- API ------------------------------------ */
export async function getUser(email) {
  const key = String(email || '').toLowerCase();
  if (useDb) {
    const p = await pool();
    const { rows } = await p.query('SELECT * FROM users WHERE LOWER(email)=$1', [key]);
    return rowToUser(rows[0]);
  }
  return fileLoad().users.find((u) => u.email.toLowerCase() === key) || null;
}

export async function listClients() {
  if (useDb) {
    const p = await pool();
    const { rows } = await p.query(
      "SELECT email, role, created_at, created_by FROM users WHERE role='client' ORDER BY created_at DESC");
    return rows.map((r) => ({
      email: r.email, role: r.role,
      createdAt: Number(r.created_at) || 0, createdBy: r.created_by || undefined,
    }));
  }
  return fileLoad().users.filter((u) => u.role === 'client')
    .map(({ passwordHash, salt, ...u }) => u);
}

export async function upsertUser(user) {
  if (useDb) {
    const p = await pool();
    await p.query(
      `INSERT INTO users (email, role, salt, password_hash, created_at, created_by)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (email) DO UPDATE SET
         role=EXCLUDED.role, salt=EXCLUDED.salt, password_hash=EXCLUDED.password_hash,
         created_by=COALESCE(EXCLUDED.created_by, users.created_by)`,
      [user.email, user.role, user.salt, user.passwordHash, user.createdAt || Date.now(), user.createdBy || null]);
    return user;
  }
  const db = fileLoad();
  const i = db.users.findIndex((u) => u.email.toLowerCase() === user.email.toLowerCase());
  if (i >= 0) db.users[i] = { ...db.users[i], ...user }; else db.users.push(user);
  fileSave(db);
  return user;
}

export async function removeUser(email) {
  if (useDb) {
    const p = await pool();
    await p.query('DELETE FROM users WHERE LOWER(email)=$1', [String(email).toLowerCase()]);
    return;
  }
  const db = fileLoad();
  db.users = db.users.filter((u) => u.email.toLowerCase() !== String(email).toLowerCase());
  fileSave(db);
}
