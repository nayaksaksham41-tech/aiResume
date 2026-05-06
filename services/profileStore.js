const fs = require("fs");
const path = require("path");

const { getDataRoot } = require("./dataRoot");

function profilesPath() {
  return path.join(getDataRoot(), "profiles.json");
}

function ensureFile() {
  const DATA_PATH = profilesPath();
  const dir = path.dirname(DATA_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DATA_PATH)) {
    fs.writeFileSync(DATA_PATH, JSON.stringify({ profiles: {} }, null, 2), "utf8");
  }
}

function load() {
  ensureFile();
  const DATA_PATH = profilesPath();
  try {
    return JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
  } catch (_e) {
    return { profiles: {} };
  }
}

function save(data) {
  ensureFile();
  fs.writeFileSync(profilesPath(), JSON.stringify(data, null, 2), "utf8");
}

function getProfile(userId) {
  const db = load();
  const row = db.profiles[userId];
  return {
    displayName: row?.displayName ?? "",
    headline: row?.headline ?? "",
    phone: row?.phone ?? "",
    linkedinUrl: row?.linkedinUrl ?? "",
    updatedAt: row?.updatedAt ?? null,
  };
}

function updateProfile(userId, patch) {
  const db = load();
  const prev = db.profiles[userId] || {};
  db.profiles[userId] = {
    ...prev,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  save(db);
  return getProfile(userId);
}

module.exports = { getProfile, updateProfile };
