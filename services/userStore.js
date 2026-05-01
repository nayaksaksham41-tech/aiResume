const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const { getDataRoot } = require("./dataRoot");

function usersPath() {
  return path.join(getDataRoot(), "users.json");
}

function ensureFile() {
  const DATA_PATH = usersPath();
  const dir = path.dirname(DATA_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(DATA_PATH)) {
    fs.writeFileSync(DATA_PATH, JSON.stringify({ users: [] }, null, 2), "utf8");
  }
}

function load() {
  ensureFile();
  const DATA_PATH = usersPath();
  const raw = fs.readFileSync(DATA_PATH, "utf8");
  try {
    return JSON.parse(raw);
  } catch (_e) {
    return { users: [] };
  }
}

function save(data) {
  ensureFile();
  fs.writeFileSync(usersPath(), JSON.stringify(data, null, 2), "utf8");
}

/**
 * File-based user store (JSON). Fine for a single-process dev/small deploy.
 * Password hashes only — never store plaintext passwords.
 */
function createUser({ email, passwordHash }) {
  const db = load();
  const user = {
    id: crypto.randomUUID(),
    email,
    passwordHash,
    createdAt: new Date().toISOString(),
  };
  db.users.push(user);
  save(db);
  return { id: user.id, email: user.email, createdAt: user.createdAt };
}

function findByEmail(email) {
  const db = load();
  return db.users.find((u) => u.email === email) || null;
}

function findById(id) {
  const db = load();
  return db.users.find((u) => u.id === id) || null;
}

/** Public fields only — never expose passwordHash. */
function listUsers() {
  const db = load();
  return db.users.map((u) => ({
    id: u.id,
    email: u.email,
    createdAt: u.createdAt,
  }));
}

module.exports = {
  createUser,
  findByEmail,
  findById,
  listUsers,
};
