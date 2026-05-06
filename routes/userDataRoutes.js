const express = require("express");
const { z } = require("zod");

const { requireAuth } = require("../middleware/authMiddleware");
const { AppError } = require("../middleware/errorHandler");
const { isAdminEmail } = require("../services/adminService");
const profileStore = require("../services/profileStore");
const subscriptionStore = require("../services/subscriptionStore");
const quotaService = require("../services/quotaService");
const historyStore = require("../services/historyStore");
const { generatePdfBuffer } = require("../services/pdfService");
const { generateDocxBuffer } = require("../services/docxService");

const router = express.Router();

const profilePatchSchema = z.object({
  phone: z.string().max(40).optional(),
  linkedinUrl: z.string().max(500).optional(),
});

const subscriptionStubPatchSchema = z.object({
  plan: z.enum(["free", "pro_1m", "pro_3m"]),
});

router.get("/profile", requireAuth, (req, res) => {
  const profile = profileStore.getProfile(req.user.id);
  res.json({ profile });
});

router.patch("/profile", requireAuth, (req, res, next) => {
  try {
    const parsed = profilePatchSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0]?.message || "Invalid input", 400);
    }
    const profile = profileStore.updateProfile(req.user.id, parsed.data);
    res.json({ profile });
  } catch (e) {
    next(e);
  }
});

router.get("/subscription", requireAuth, async (req, res, next) => {
  try {
    const payload = await quotaService.buildAccountQuotaPayload(req.user);
    res.json(payload);
  } catch (e) {
    next(e);
  }
});

router.patch("/subscription", requireAuth, async (req, res, next) => {
  try {
    if (process.env.SUBSCRIPTION_STUB !== "true") {
      throw new AppError(
        "Payment is not wired yet. Upgrade options are shown here for reference only.",
        403,
      );
    }

    const parsed = subscriptionStubPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0]?.message || "Invalid input", 400);
    }

    const { plan } = parsed.data;
    let expiresAt = null;
    let renewsAt = null;

    if (plan === "pro_1m") {
      const d = new Date();
      d.setMonth(d.getMonth() + 1);
      expiresAt = d.toISOString();
      renewsAt = expiresAt;
    } else if (plan === "pro_3m") {
      const d = new Date();
      d.setMonth(d.getMonth() + 3);
      expiresAt = d.toISOString();
      renewsAt = expiresAt;
    }

    await subscriptionStore.setSubscription(req.user.id, {
      plan,
      status: "active",
      expiresAt,
      renewsAt,
    });

    const payload = await quotaService.buildAccountQuotaPayload(req.user);
    res.json(payload);
  } catch (e) {
    next(e);
  }
});

router.get("/history", requireAuth, async (req, res, next) => {
  try {
    const entries = await historyStore.listForUser(req.user.id);
    res.json({ entries });
  } catch (e) {
    next(e);
  }
});

async function historyPayloadForRequest(req, historyId) {
  const meta = await historyStore.findMetaByHistoryId(historyId);
  if (!meta) return null;
  if (meta.userId !== req.user.id && !isAdminEmail(req.user.email)) return null;
  return historyStore.readPayloadByHistoryId(historyId);
}

router.get("/history/:historyId/download/pdf", requireAuth, async (req, res, next) => {
  try {
    const full = await historyPayloadForRequest(req, req.params.historyId);
    if (!full?.html) {
      throw new AppError("History entry not found.", 404);
    }
    const pdfBuffer = await generatePdfBuffer(full.html);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="resume.pdf"');
    res.status(200).send(pdfBuffer);
  } catch (e) {
    next(e);
  }
});

router.get("/history/:historyId/download/docx", requireAuth, async (req, res, next) => {
  try {
    const full = await historyPayloadForRequest(req, req.params.historyId);
    if (!full?.resumeJson) {
      throw new AppError("History entry not found.", 404);
    }
    const docxBuffer = await generateDocxBuffer(full.resumeJson);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    res.setHeader("Content-Disposition", 'attachment; filename="resume.docx"');
    res.status(200).send(docxBuffer);
  } catch (e) {
    next(e);
  }
});

router.get("/history/:historyId", requireAuth, async (req, res, next) => {
  try {
    const full = await historyPayloadForRequest(req, req.params.historyId);
    if (!full) {
      throw new AppError("History entry not found.", 404);
    }
    res.json({
      historyId: full.id,
      createdAt: full.createdAt,
      resumeTitle: full.resumeTitle,
      jdPreview: full.jdPreview,
      atsScore: full.atsScore,
    });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
