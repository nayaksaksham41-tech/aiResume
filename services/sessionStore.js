const crypto = require("crypto");

const TTL_MS = 30 * 60 * 1000;
const sessions = new Map();

function createSession(payload) {
  const id = crypto.randomUUID();
  sessions.set(id, { ...payload, createdAt: Date.now() });
  return id;
}

function getSession(id) {
  if (!id || typeof id !== "string") return null;
  const row = sessions.get(id);
  if (!row) return null;
  if (Date.now() - row.createdAt > TTL_MS) {
    sessions.delete(id);
    return null;
  }
  return row;
}

function deleteSession(id) {
  sessions.delete(id);
}

module.exports = { createSession, getSession, deleteSession };
