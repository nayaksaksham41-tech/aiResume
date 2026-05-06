const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const { getDataRoot } = require("./dataRoot");
const { getRedisClient } = require("./redisClient");

const USERS_CACHE_KEY = "cva:users:v1";

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

function loadFromFile() {
  ensureFile();
  const DATA_PATH = usersPath();
  const raw = fs.readFileSync(DATA_PATH, "utf8");
  try {
    return JSON.parse(raw);
  } catch (_e) {
    return { users: [] };
  }
}

function saveToFile(data) {
  ensureFile();
  fs.writeFileSync(usersPath(), JSON.stringify(data, null, 2), "utf8");
}

async function load() {
  const redis = getRedisClient();
  if (!redis) return loadFromFile();

  try {
    const data = await redis.get(USERS_CACHE_KEY);
    if (data && Array.isArray(data.users)) return data;
    const initial = { users: [] };
    await redis.set(USERS_CACHE_KEY, initial);
    return initial;
  } catch (_e) {
    // Fallback for local/dev or transient Redis issues.
    return loadFromFile();
  }
}

async function save(data) {
  const redis = getRedisClient();
  if (!redis) {
    saveToFile(data);
    return;
  }
  try {
    await redis.set(USERS_CACHE_KEY, data);
  } catch (_e) {
    saveToFile(data);
  }
}

/**
 * File-based user store (JSON). Fine for a single-process dev/small deploy.
 * Password hashes only — never store plaintext passwords.
 */
async function createUser({ email, passwordHash }) {
  const db = await load();
  const user = {
    id: crypto.randomUUID(),
    email,
    passwordHash,
    createdAt: new Date().toISOString(),
  };
  db.users.push(user);
  await save(db);
  return { id: user.id, email: user.email, createdAt: user.createdAt };
}

async function findByEmail(email) {
  const db = await load();
  return db.users.find((u) => u.email === email) || null;
}

async function findById(id) {
  const db = await load();
  return db.users.find((u) => u.id === id) || null;
}

/** Public fields only — never expose passwordHash. */
async function listUsers() {
  const db = await load();
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
