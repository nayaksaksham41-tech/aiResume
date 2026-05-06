const express = require("express");
const { z } = require("zod");

const { generateResumeJson, generateCareerExtras } = require("../services/aiService");
const { buildResumeHtml } = require("../services/resumeHtmlService");
const { buildInterviewGuideHtml } = require("../services/interviewGuideHtmlService");
const { generatePdfBuffer } = require("../services/pdfService");
const { generateDocxBuffer } = require("../services/docxService");
const { computeAtsScore } = require("../services/atsScoreService");
const sessionStore = require("../services/sessionStore");
const historyStore = require("../services/historyStore");
const { AppError } = require("../middleware/errorHandler");
const { requireAuth } = require("../middleware/authMiddleware");
const quotaService = require("../services/quotaService");

const router = express.Router();

const requestSchema = z.object({
  job_description: z.string().min(1, "job_description is required"),
  resume_text: z.string().min(1, "resume_text is required"),
});

router.post("/generate-resume", requireAuth, async (req, res, next) => {
  try {
    const parsed = requestSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0]?.message || "Invalid payload", 400);
    }

    const { job_description, resume_text } = parsed.data;
    const streamFormat = String(req.query.format || "").toLowerCase();

    await quotaService.assertCanGenerateResume(req.user);

    const [resumeJson, careerExtras] = await Promise.all([
      generateResumeJson({ job_description, resume_text }),
      generateCareerExtras({ job_description, resume_text }),
    ]);

    const html = await buildResumeHtml(resumeJson);

    if (streamFormat === "pdf") {
      const pdfBuffer = await generatePdfBuffer(html);
      await quotaService.recordSuccessfulGeneration(req.user);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", 'attachment; filename="resume.pdf"');
      res.status(200).send(pdfBuffer);
      return;
    }

    if (streamFormat === "html") {
      await quotaService.recordSuccessfulGeneration(req.user);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="resume-editable.html"');
      res.status(200).send(html);
      return;
    }

    const atsScore = computeAtsScore(job_description, resumeJson);
    const jdPreviewInterview =
      String(job_description || "")
        .slice(0, 480)
        .replace(/\s+/g, " ")
        .trim() + (String(job_description || "").length > 480 ? "…" : "");

    const sessionId = await sessionStore.createSession({
      resumeJson,
      html,
      job_description,
      resume_text,
      atsScore,
      careerExtras,
      interviewJdPreview: jdPreviewInterview,
    });

    let historyId = null;
    try {
      const meta = await historyStore.appendEntry({
        userId: req.user.id,
        resumeJson,
        html,
        job_description,
        resume_text,
        atsScore,
        careerExtras,
        interviewJdPreview: jdPreviewInterview,
      });
      historyId = meta.id;
    } catch (e) {
      console.error("history append failed:", e);
    }

    await quotaService.recordSuccessfulGeneration(req.user);

    res.status(200).json({
      sessionId,
      historyId,
      atsScore,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/resume-session/:sessionId", requireAuth, async (req, res, next) => {
  try {
    const session = await sessionStore.getSession(req.params.sessionId);
    if (!session) {
      throw new AppError("Session expired or not found. Generate your resume again.", 404);
    }
    res.status(200).json({
      atsScore: session.atsScore,
      careerExtras: session.careerExtras || null,
      sessionId: req.params.sessionId,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/download/:sessionId/pdf", requireAuth, async (req, res, next) => {
  try {
    const session = await sessionStore.getSession(req.params.sessionId);
    if (!session) {
      throw new AppError("Session expired or not found. Generate your resume again.", 404);
    }
    const pdfBuffer = await generatePdfBuffer(session.html);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="resume.pdf"');
    res.status(200).send(pdfBuffer);
  } catch (error) {
    next(error);
  }
});

router.get("/download/:sessionId/docx", requireAuth, async (req, res, next) => {
  try {
    const session = await sessionStore.getSession(req.params.sessionId);
    if (!session) {
      throw new AppError("Session expired or not found. Generate your resume again.", 404);
    }
    const docxBuffer = await generateDocxBuffer(session.resumeJson);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    res.setHeader("Content-Disposition", 'attachment; filename="resume.docx"');
    res.status(200).send(docxBuffer);
  } catch (error) {
    next(error);
  }
});

router.get("/download/:sessionId/interview-pdf", requireAuth, async (req, res, next) => {
  try {
    const session = await sessionStore.getSession(req.params.sessionId);
    if (!session) {
      throw new AppError("Session expired or not found. Generate your resume again.", 404);
    }
    const extra = session.careerExtras;
    if (!extra?.interviewQa?.length) {
      throw new AppError("Interview guide not available for this session.", 404);
    }
    const guideHtml = buildInterviewGuideHtml({
      jobDescriptionPreview: session.interviewJdPreview || "",
      interviewQa: extra.interviewQa,
    });
    const pdfBuffer = await generatePdfBuffer(guideHtml);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="interview-guide-25-qa.pdf"');
    res.status(200).send(pdfBuffer);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
