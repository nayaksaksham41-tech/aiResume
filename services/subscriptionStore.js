const fs = require("fs");
const path = require("path");

const DATA_PATH = path.join(__dirname, "..", "data", "subscriptions.json");

function ensureFile() {
  const dir = path.dirname(DATA_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DATA_PATH)) {
    fs.writeFileSync(DATA_PATH, JSON.stringify({ subscriptions: {} }, null, 2), "utf8");
  }
}

function load() {
  ensureFile();
  try {
    return JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
  } catch (_e) {
    return { subscriptions: {} };
  }
}

function save(data) {
  ensureFile();
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), "utf8");
}

/** Default: free plan (stored on first read/write). */
function getSubscription(userId) {
  const db = load();
  const row = db.subscriptions[userId];
  if (row) {
    return {
      plan: row.plan || "free",
      status: row.status || "active",
      renewsAt: row.renewsAt ?? null,
      updatedAt: row.updatedAt ?? null,
    };
  }
  return {
    plan: "free",
    status: "active",
    renewsAt: null,
    updatedAt: null,
  };
}

function setSubscription(userId, patch) {
  const db = load();
  const prev = db.subscriptions[userId] || {};
  db.subscriptions[userId] = {
    ...prev,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  save(db);
  return getSubscription(userId);
}

module.exports = { getSubscription, setSubscription };
