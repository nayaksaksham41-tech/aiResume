const express = require("express");

const { requireAuth } = require("../middleware/authMiddleware");
const { requireAdmin } = require("../middleware/adminMiddleware");
const { AppError } = require("../middleware/errorHandler");
const userStore = require("../services/userStore");
const historyStore = require("../services/historyStore");

const router = express.Router();

router.use(requireAuth);
router.use(requireAdmin);

router.get("/users", (_req, res) => {
  const counts = historyStore.resumeCountsByUser();
  const users = userStore.listUsers().map((u) => ({
    ...u,
    resumeCount: counts[u.id] ?? 0,
  }));
  users.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ users });
});

router.get("/users/:userId/history", (req, res, next) => {
  try {
    const target = userStore.findById(req.params.userId);
    if (!target) {
      throw new AppError("User not found.", 404);
    }
    const entries = historyStore.listForUser(req.params.userId);
    res.json({
      user: { id: target.id, email: target.email, createdAt: target.createdAt },
      entries,
    });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
