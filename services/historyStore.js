const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const INDEX_PATH = path.join(__dirname, "..", "data", "resume_history.json");
const ITEMS_DIR = path.join(__dirname, "..", "data", "history_items");

function ensureIndex() {
  const dir = path.dirname(INDEX_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(INDEX_PATH)) {
    fs.writeFileSync(INDEX_PATH, JSON.stringify({ entries: [] }, null, 2), "utf8");
  }
}

function loadIndex() {
  ensureIndex();
  try {
    return JSON.parse(fs.readFileSync(INDEX_PATH, "utf8"));
  } catch (_e) {
    return { entries: [] };
  }
}

function saveIndex(data) {
  ensureIndex();
  fs.writeFileSync(INDEX_PATH, JSON.stringify(data, null, 2), "utf8");
}

/**
 * Persist a generated resume for history / re-download after session TTL.
 */
function appendEntry({ userId, resumeJson, html, job_description, resume_text, atsScore }) {
  ensureIndex();
  fs.mkdirSync(ITEMS_DIR, { recursive: true });

  const id = crypto.randomUUID();
  const rawJd = String(job_description || "");
  const jdPreview =
    rawJd.slice(0, 160).replace(/\s+/g, " ").trim() + (rawJd.length > 160 ? "…" : "");
  const resumeTitle = resumeJson?.title || resumeJson?.name || "Tailored resume";

  const meta = {
    id,
    userId,
    createdAt: new Date().toISOString(),
    jdPreview,
    resumeTitle,
    atsOverall: typeof atsScore?.overall === "number" ? atsScore.overall : null,
  };

  const payload = {
    ...meta,
    resumeJson,
    html,
    job_description,
    resume_text,
    atsScore,
  };

  fs.writeFileSync(path.join(ITEMS_DIR, `${id}.json`), JSON.stringify(payload), "utf8");

  const db = loadIndex();
  db.entries.push(meta);
  saveIndex(db);

  return meta;
}

function listForUser(userId) {
  return loadIndex()
    .entries.filter((e) => e.userId === userId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function findMetaByHistoryId(historyId) {
  if (!historyId) return null;
  return loadIndex().entries.find((e) => e.id === historyId) || null;
}

function readPayloadByHistoryId(historyId) {
  const fp = path.join(ITEMS_DIR, `${historyId}.json`);
  if (!fs.existsSync(fp)) return null;
  try {
    return JSON.parse(fs.readFileSync(fp, "utf8"));
  } catch (_e) {
    return null;
  }
}

/** Count persisted resumes per user id (for admin dashboard). */
function resumeCountsByUser() {
  const db = loadIndex();
  const counts = {};
  for (const e of db.entries) {
    const uid = e.userId;
    if (!uid) continue;
    counts[uid] = (counts[uid] || 0) + 1;
  }
  return counts;
}

function getFullEntry(userId, historyId) {
  if (!historyId) return null;
  const meta = findMetaByHistoryId(historyId);
  if (!meta || meta.userId !== userId) return null;
  return readPayloadByHistoryId(historyId);
}

module.exports = {
  appendEntry,
  listForUser,
  findMetaByHistoryId,
  readPayloadByHistoryId,
  resumeCountsByUser,
  getFullEntry,
};
