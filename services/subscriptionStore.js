const fs = require("fs");
const path = require("path");

const { getDataRoot } = require("./dataRoot");
const { getRedisClient } = require("./redisClient");

const SUBSCRIPTIONS_CACHE_KEY = "cva:subscriptions:v1";

function subscriptionsPath() {
  return path.join(getDataRoot(), "subscriptions.json");
}

function ensureFile() {
  const DATA_PATH = subscriptionsPath();
  const dir = path.dirname(DATA_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DATA_PATH)) {
    fs.writeFileSync(DATA_PATH, JSON.stringify({ subscriptions: {} }, null, 2), "utf8");
  }
}

function loadFromFile() {
  ensureFile();
  try {
    return JSON.parse(fs.readFileSync(subscriptionsPath(), "utf8"));
  } catch (_e) {
    return { subscriptions: {} };
  }
}

function saveToFile(data) {
  ensureFile();
  fs.writeFileSync(subscriptionsPath(), JSON.stringify(data, null, 2), "utf8");
}

function normalizeRedisSubscriptions(raw) {
  if (raw == null) return null;
  let obj = raw;
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw);
    } catch (_e) {
      return null;
    }
  }
  if (obj && typeof obj === "object" && obj.subscriptions && typeof obj.subscriptions === "object") {
    return obj;
  }
  return null;
}

async function load() {
  const redis = getRedisClient();
  if (redis) {
    try {
      const raw = await redis.get(SUBSCRIPTIONS_CACHE_KEY);
      if (raw === null || raw === undefined) {
        const initial = { subscriptions: {} };
        await redis.set(SUBSCRIPTIONS_CACHE_KEY, JSON.stringify(initial));
        return initial;
      }
      const normalized = normalizeRedisSubscriptions(raw);
      if (normalized) return normalized;
      console.error("[subscriptionStore] Invalid Redis payload; refusing to wipe.");
      return { subscriptions: {} };
    } catch (e) {
      console.error("[subscriptionStore] Redis load failed:", e?.message || e);
      return loadFromFile();
    }
  }
  return loadFromFile();
}

async function save(data) {
  const redis = getRedisClient();
  if (!redis) {
    saveToFile(data);
    return;
  }
  try {
    await redis.set(SUBSCRIPTIONS_CACHE_KEY, JSON.stringify(data));
  } catch (_e) {
    saveToFile(data);
  }
}

function rowFromDb(row) {
  if (!row) {
    return {
      plan: "free",
      status: "active",
      expiresAt: null,
      renewsAt: null,
      updatedAt: null,
    };
  }
  return {
    plan: row.plan || "free",
    status: row.status || "active",
    expiresAt: row.expiresAt ?? row.renewsAt ?? null,
    renewsAt: row.renewsAt ?? null,
    updatedAt: row.updatedAt ?? null,
  };
}

/** Default: free plan (persisted lazily via setSubscription or GET enrichment only). */
async function getSubscription(userId) {
  const db = await load();
  return rowFromDb(db.subscriptions[userId]);
}

async function setSubscription(userId, patch) {
  const db = await load();
  const prev = db.subscriptions[userId] || {};
  db.subscriptions[userId] = {
    ...prev,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  await save(db);
  return rowFromDb(db.subscriptions[userId]);
}

module.exports = { getSubscription, setSubscription };
