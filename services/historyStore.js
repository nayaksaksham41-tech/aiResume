const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const { getDataRoot } = require("./dataRoot");
const { getRedisClient } = require("./redisClient");

const HISTORY_INDEX_KEY = "cva:history:index:v1";

function historyItemKey(id) {
  return `cva:history:item:${id}`;
}

function indexPath() {
  return path.join(getDataRoot(), "resume_history.json");
}

function itemsDir() {
  return path.join(getDataRoot(), "history_items");
}

function ensureIndexFs() {
  const INDEX_PATH = indexPath();
  const dir = path.dirname(INDEX_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(INDEX_PATH)) {
    fs.writeFileSync(INDEX_PATH, JSON.stringify({ entries: [] }, null, 2), "utf8");
  }
  fs.mkdirSync(itemsDir(), { recursive: true });
}

function loadIndexFs() {
  ensureIndexFs();
  try {
    return JSON.parse(fs.readFileSync(indexPath(), "utf8"));
  } catch (_e) {
    return { entries: [] };
  }
}

function saveIndexFs(data) {
  ensureIndexFs();
  fs.writeFileSync(indexPath(), JSON.stringify(data, null, 2), "utf8");
}

function normalizeHistoryIndex(raw) {
  if (raw == null) return null;
  let obj = raw;
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw);
    } catch (_e) {
      return null;
    }
  }
  if (obj && typeof obj === "object" && Array.isArray(obj.entries)) return obj;
  return null;
}

async function loadIndex() {
  const redis = getRedisClient();
  if (redis) {
    try {
      const raw = await redis.get(HISTORY_INDEX_KEY);
      if (raw === null || raw === undefined) return { entries: [] };
      const normalized = normalizeHistoryIndex(raw);
      if (normalized) return normalized;
      console.error("[historyStore] Invalid Redis history index payload");
      return { entries: [] };
    } catch (e) {
      console.error("[historyStore] Redis loadIndex failed:", e?.message || e);
      return { entries: [] };
    }
  }
  return loadIndexFs();
}

async function saveIndex(data) {
  const redis = getRedisClient();
  if (redis) {
    try {
      await redis.set(HISTORY_INDEX_KEY, JSON.stringify(data));
      return;
    } catch (e) {
      console.error("[historyStore] Redis saveIndex failed:", e?.message || e);
      return;
    }
  }
  saveIndexFs(data);
}

/**
 * Persist a generated resume for history / re-download after session TTL.
 * On Redis: index + per-item keys (shared across Vercel instances). Locally: filesystem.
 */
async function appendEntry({
  userId,
  resumeJson,
  html,
  job_description,
  resume_text,
  atsScore,
  careerExtras,
  interviewJdPreview,
}) {
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
    careerExtras,
    interviewJdPreview,
  };

  const redis = getRedisClient();

  if (redis) {
    await redis.set(historyItemKey(id), JSON.stringify(payload));
    const db = await loadIndex();
    db.entries.push(meta);
    await saveIndex(db);
    return meta;
  }

  ensureIndexFs();
  fs.mkdirSync(itemsDir(), { recursive: true });
  fs.writeFileSync(path.join(itemsDir(), `${id}.json`), JSON.stringify(payload), "utf8");

  const db = loadIndexFs();
  db.entries.push(meta);
  saveIndexFs(db);

  return meta;
}

async function listForUser(userId) {
  const db = await loadIndex();
  return db.entries
    .filter((e) => e.userId === userId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

async function findMetaByHistoryId(historyId) {
  if (!historyId) return null;
  const db = await loadIndex();
  return db.entries.find((e) => e.id === historyId) || null;
}

async function readPayloadByHistoryId(historyId) {
  const redis = getRedisClient();

  if (redis) {
    try {
      const raw = await redis.get(historyItemKey(historyId));
      if (raw == null) return null;
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch (_e) {
      return null;
    }
  }

  const fp = path.join(itemsDir(), `${historyId}.json`);
  if (!fs.existsSync(fp)) return null;
  try {
    return JSON.parse(fs.readFileSync(fp, "utf8"));
  } catch (_e) {
    return null;
  }
}

/** Count persisted resumes per user id (for admin dashboard). */
async function resumeCountsByUser() {
  const db = await loadIndex();
  const counts = {};
  for (const e of db.entries) {
    const uid = e.userId;
    if (!uid) continue;
    counts[uid] = (counts[uid] || 0) + 1;
  }
  return counts;
}

async function getFullEntry(userId, historyId) {
  const meta = await findMetaByHistoryId(historyId);
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
