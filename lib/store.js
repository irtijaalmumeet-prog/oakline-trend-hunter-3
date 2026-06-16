// User + device store.
//  - If DATABASE_URL (or POSTGRES_URL) is set -> Postgres (persists online)
//  - Otherwise -> local JSON files (works on your PC)
// All functions are async so both backends behave the same to callers.
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
    _ready = (async () => {
      await _pool.query(`CREATE TABLE IF NOT EXISTS users (
        email TEXT PRIMARY KEY, role TEXT NOT NULL, salt TEXT,
        password_hash TEXT, created_at BIGINT, created_by TEXT )`);
      await _pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS expires_at BIGINT`);
      await _pool.query(`CREATE TABLE IF NOT EXISTS devices (
        email TEXT, device_id TEXT, status TEXT, label TEXT,
        created_at BIGINT, last_seen BIGINT,
        PRIMARY KEY (email, device_id) )`);
    })();
  }
  await _ready;
  return _pool;
}
const rowToUser = (r) => (r ? {
  email: r.email, role: r.role, salt: r.salt, passwordHash: r.password_hash,
  createdAt: Number(r.created_at) || 0, createdBy: r.created_by || undefined,
  expiresAt: Number(r.expires_at) || 0,
} : null);
const rowToDevice = (r) => (r ? {
  email: r.email, deviceId: r.device_id, status: r.status, label: r.label || '',
  createdAt: Number(r.created_at) || 0, lastSeen: Number(r.last_seen) || 0,
} : null);

/* ------------------------------- File mode -------------------------------- */
const USERS_FILE = resolve(process.cwd(), 'data', 'users.json');
const DEVICES_FILE = resolve(process.cwd(), 'data', 'devices.json');
function jload(file, fallback) {
  if (!existsSync(file)) return fallback;
  try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return fallback; }
}
function jsave(file, obj) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(obj, null, 2));
}

/* -------------------------------- Users ---------------------------------- */
export async function getUser(email) {
  const key = String(email || '').toLowerCase();
  if (useDb) {
    const p = await pool();
    const { rows } = await p.query('SELECT * FROM users WHERE LOWER(email)=$1', [key]);
    return rowToUser(rows[0]);
  }
  return jload(USERS_FILE, { users: [] }).users.find((u) => u.email.toLowerCase() === key) || null;
}
export async function listClients() {
  if (useDb) {
    const p = await pool();
    const { rows } = await p.query(
      "SELECT email, role, created_at, created_by, expires_at FROM users WHERE role='client' ORDER BY created_at DESC");
    return rows.map((r) => ({ email: r.email, role: r.role, createdAt: Number(r.created_at) || 0, createdBy: r.created_by || undefined, expiresAt: Number(r.expires_at) || 0 }));
  }
  return jload(USERS_FILE, { users: [] }).users.filter((u) => u.role === 'client').map(({ passwordHash, salt, ...u }) => u);
}
export async function upsertUser(user) {
  if (useDb) {
    const p = await pool();
    await p.query(
      `INSERT INTO users (email, role, salt, password_hash, created_at, created_by, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (email) DO UPDATE SET role=EXCLUDED.role, salt=EXCLUDED.salt,
         password_hash=EXCLUDED.password_hash, created_by=COALESCE(EXCLUDED.created_by, users.created_by),
         expires_at=COALESCE(EXCLUDED.expires_at, users.expires_at)`,
      [user.email, user.role, user.salt, user.passwordHash, user.createdAt || Date.now(), user.createdBy || null, user.expiresAt || null]);
    return user;
  }
  const db = jload(USERS_FILE, { users: [] });
  const i = db.users.findIndex((u) => u.email.toLowerCase() === user.email.toLowerCase());
  if (i >= 0) db.users[i] = { ...db.users[i], ...user }; else db.users.push(user);
  jsave(USERS_FILE, db);
  return user;
}
export async function removeUser(email) {
  const key = String(email).toLowerCase();
  if (useDb) {
    const p = await pool();
    await p.query('DELETE FROM users WHERE LOWER(email)=$1', [key]);
    await p.query('DELETE FROM devices WHERE LOWER(email)=$1', [key]);
    return;
  }
  const du = jload(USERS_FILE, { users: [] });
  du.users = du.users.filter((u) => u.email.toLowerCase() !== key);
  jsave(USERS_FILE, du);
  const dd = jload(DEVICES_FILE, { devices: [] });
  dd.devices = dd.devices.filter((d) => d.email.toLowerCase() !== key);
  jsave(DEVICES_FILE, dd);
}

export async function setUserPassword(email, salt, passwordHash) {
  const key = String(email || '').toLowerCase();
  if (useDb) {
    const p = await pool();
    await p.query('UPDATE users SET salt=$2, password_hash=$3 WHERE LOWER(email)=$1', [key, salt, passwordHash]);
    return;
  }
  const db = jload(USERS_FILE, { users: [] });
  const u = db.users.find((x) => x.email.toLowerCase() === key);
  if (u) { u.salt = salt; u.passwordHash = passwordHash; jsave(USERS_FILE, db); }
}
export async function setUserExpiry(email, expiresAt) {
  const key = String(email || '').toLowerCase();
  const val = expiresAt && expiresAt > 0 ? expiresAt : null;
  if (useDb) {
    const p = await pool();
    await p.query('UPDATE users SET expires_at=$2 WHERE LOWER(email)=$1', [key, val]);
    return;
  }
  const db = jload(USERS_FILE, { users: [] });
  const u = db.users.find((x) => x.email.toLowerCase() === key);
  if (u) { u.expiresAt = val || 0; jsave(USERS_FILE, db); }
}

/* -------------------------------- Devices -------------------------------- */
export async function getDevice(email, deviceId) {
  const key = String(email || '').toLowerCase();
  if (useDb) {
    const p = await pool();
    const { rows } = await p.query('SELECT * FROM devices WHERE LOWER(email)=$1 AND device_id=$2', [key, deviceId]);
    return rowToDevice(rows[0]);
  }
  return jload(DEVICES_FILE, { devices: [] }).devices.find((d) => d.email.toLowerCase() === key && d.deviceId === deviceId) || null;
}
export async function listDevices() {
  if (useDb) {
    const p = await pool();
    const { rows } = await p.query('SELECT * FROM devices ORDER BY last_seen DESC');
    return rows.map(rowToDevice);
  }
  return jload(DEVICES_FILE, { devices: [] }).devices.slice().sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0));
}
export async function upsertDevice(dev) {
  if (useDb) {
    const p = await pool();
    await p.query(
      `INSERT INTO devices (email, device_id, status, label, created_at, last_seen)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (email, device_id) DO UPDATE SET status=EXCLUDED.status,
         label=COALESCE(EXCLUDED.label, devices.label), last_seen=EXCLUDED.last_seen`,
      [dev.email, dev.deviceId, dev.status, dev.label || '', dev.createdAt || Date.now(), dev.lastSeen || Date.now()]);
    return dev;
  }
  const db = jload(DEVICES_FILE, { devices: [] });
  const i = db.devices.findIndex((d) => d.email.toLowerCase() === dev.email.toLowerCase() && d.deviceId === dev.deviceId);
  if (i >= 0) db.devices[i] = { ...db.devices[i], ...dev }; else db.devices.push(dev);
  jsave(DEVICES_FILE, db);
  return dev;
}
export async function setDeviceStatus(email, deviceId, status) {
  const key = String(email || '').toLowerCase();
  if (useDb) {
    const p = await pool();
    await p.query('UPDATE devices SET status=$3 WHERE LOWER(email)=$1 AND device_id=$2', [key, deviceId, status]);
    return;
  }
  const db = jload(DEVICES_FILE, { devices: [] });
  const d = db.devices.find((x) => x.email.toLowerCase() === key && x.deviceId === deviceId);
  if (d) { d.status = status; jsave(DEVICES_FILE, db); }
}
export async function touchDevice(email, deviceId) {
  const key = String(email || '').toLowerCase();
  if (useDb) {
    const p = await pool();
    await p.query('UPDATE devices SET last_seen=$3 WHERE LOWER(email)=$1 AND device_id=$2', [key, deviceId, Date.now()]);
    return;
  }
  const db = jload(DEVICES_FILE, { devices: [] });
  const d = db.devices.find((x) => x.email.toLowerCase() === key && x.deviceId === deviceId);
  if (d) { d.lastSeen = Date.now(); jsave(DEVICES_FILE, db); }
}
export async function removeDevice(email, deviceId) {
  const key = String(email || '').toLowerCase();
  if (useDb) {
    const p = await pool();
    await p.query('DELETE FROM devices WHERE LOWER(email)=$1 AND device_id=$2', [key, deviceId]);
    return;
  }
  const db = jload(DEVICES_FILE, { devices: [] });
  db.devices = db.devices.filter((x) => !(x.email.toLowerCase() === key && x.deviceId === deviceId));
  jsave(DEVICES_FILE, db);
}
