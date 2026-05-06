const axios = require("axios");
const { z } = require("zod");

const { AppError } = require("../middleware/errorHandler");

const nonEmptyString = z.string().trim().min(1);

function wordCount(text) {
  return String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

const aiResponseSchema = z
  .object({
    name: nonEmptyString,
    title: nonEmptyString,
    summary: nonEmptyString,
    contact: z.object({
      email: z.string().trim().optional().default(""),
      phone: z.string().trim().optional().default(""),
      location: z.string().trim().optional().default(""),
      linkedin: z.string().trim().optional().default(""),
      website: z.string().trim().optional().default(""),
    }),
    skills: z.array(nonEmptyString).min(14),
    experience: z
      .array(
        z.object({
          role: nonEmptyString,
          company: nonEmptyString,
          location: z.string().trim().optional().default(""),
          duration: nonEmptyString,
          points: z.array(nonEmptyString).min(4),
        }),
      )
      .min(1),
    education: z
      .array(
        z.object({
          degree: nonEmptyString,
          institution: nonEmptyString,
          duration: z.string().trim().optional().default(""),
          score: z.string().trim().optional().default(""),
        }),
      )
      .min(1),
    projects: z
      .array(
        z.object({
          name: nonEmptyString,
          description: z.string().trim().min(160),
          technologies: z.array(nonEmptyString).optional().default([]),
        }),
      )
      .min(4),
    certifications: z.array(nonEmptyString).min(3),
  })
  .superRefine((data, ctx) => {
    const wc = wordCount(data.summary);
    if (wc < 110) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Summary must be at least 110 words (got ${wc}).`,
        path: ["summary"],
      });
    }

    const roles = data.experience;
    const bulletTotal = roles.reduce((sum, job) => sum + job.points.length, 0);

    if (roles.length === 1) {
      if (roles[0].points.length < 8) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Single role must have at least 8 bullet points.",
          path: ["experience", 0, "points"],
        });
      }
    } else {
      if (bulletTotal < 8) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Combined experience bullets must be at least 8 (got ${bulletTotal}).`,
          path: ["experience"],
        });
      }
    }

    const projectChars = data.projects.reduce((sum, project) => sum + project.description.length, 0);
    if (projectChars < 900) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Project descriptions combined are too short; expand each project.",
        path: ["projects"],
      });
    }
  });

const SYSTEM_PROMPT =
  "You are an expert ATS resume writer. Your job is to TARGET the Job Description: rewrite and reposition the candidate's real experience using JD vocabulary and priorities—never dump or lightly edit their pasted text. Facts must stay truthful; wording must be freshly composed for the role. Return only strict JSON with no markdown and no extra commentary.";

const USER_PROMPT_TEMPLATE = `
You are preparing a TARGETED resume for ONE specific role (below). The "Candidate Resume Text" is raw material only—not wording to copy.

STEP A — Understand the role:
1) Read the Job Description and list mentally: required tech, responsibilities, seniority, domain (e.g. backend/APIs/databases/system design).
2) Pick 10–15 JD phrases or keywords that should appear in an ATS-strong resume for this posting.

STEP B — Tailor (this is mandatory):
- "title": Set to a realistic target title aligned with the JD AND the candidate's experience (e.g. job says "Back End Developer" → use that or the closest honest variant; do not use an unrelated title).
- "summary": MUST explicitly bridge the candidate to THIS role: mention JD themes (e.g. scalable APIs, DB work, system design) using facts from the resume. Do not write a generic summary—it must read like you are answering "why hire them for THIS job".
- "skills": Order skills by relevance to the JD (must-haves first). Include JD terms only where the candidate actually used those tools/skills in the resume. Add synonyms where honest (e.g. JD says PostgreSQL, resume says SQL → include PostgreSQL only if Postgres experience is stated).
- "experience" bullets: REWRITE each bullet for JD fit—lead with outcomes JD cares about; weave JD keywords naturally; keep real metrics and employer names. Do NOT paste bullet text verbatim from the candidate block—paraphrase every line while preserving truth.
- "projects": Reframe descriptions toward JD themes (APIs, scale, reliability, security, etc.) using real project facts—again, no copy-paste paragraphs from the paste.
- "education": Phrase each degree for ATS clarity where truthful—use standard degree words (e.g. Bachelor, Master, degree) alongside abbreviations the candidate actually earned (e.g. "Bachelor of Technology (B.Tech)" when B.Tech is real); do not invent credentials.
- JD domain terms: When the JD names concepts (agentic AI, Gen AI, LLMs, etc.) and the candidate's work genuinely aligns, weave those exact phrases into summary or bullets—never claim tools or outcomes they did not have.
- Work arrangement: If the JD mentions remote/WFH/hybrid and the candidate's roles support it, reflect that in location/summary/bullets; do not claim remote if unsupported.
- Forbidden: large unchanged chunks of the candidate paste; repeating their summary paragraph word-for-word; leaving bullets identical to source lines.

Truth rules:
1) Do not invent employers, dates, degrees, certifications, or tools never mentioned in the candidate resume.
2) You MAY reorder, rephrase, emphasize, and align wording to the JD.
3) Keep all numbers/metrics accurate if they appear in the resume.

FULL ONE-PAGE DENSITY (mandatory):
- summary: MINIMUM 110 words, two paragraphs separated by a newline; paragraph 1 = fit for THIS JD; paragraph 2 = strongest proof points from resume.
- skills: MINIMUM 14 strings, JD-relevant order.
- experience: EVERY role from resume; latest role: aim for 8–10+ rewritten bullets; each role: at least 4 bullets; if 2+ roles combined bullets must be ≥8 (e.g. 5+4=9 is fine).
- projects: MINIMUM 4; each description 160+ chars, rewritten for JD—not raw paste.
- certifications: MINIMUM 3 items from resume (awards/badges ok).

Return valid JSON only (no markdown/code fences/no prose).

Return exactly this JSON shape:
{
  "name": "string",
  "title": "string",
  "summary": "string",
  "contact": {
    "email": "string",
    "phone": "string",
    "location": "string",
    "linkedin": "string",
    "website": "string"
  },
  "skills": ["string", "string"],
  "experience": [
    {
      "role": "string",
      "company": "string",
      "location": "string",
      "duration": "string",
      "points": ["string", "string"]
    }
  ],
  "education": [
    {
      "degree": "string",
      "institution": "string",
      "duration": "string",
      "score": "string"
    }
  ],
  "projects": [
    {
      "name": "string",
      "description": "string",
      "technologies": ["string"]
    }
  ],
  "certifications": ["string"]
}

Job Description:
{{JOB_DESCRIPTION}}

Candidate Resume Text:
{{RESUME_TEXT}}
`;

const DENSITY_RETRY_HINT = `
RETRY — previous JSON failed validation OR was too thin / too close to raw paste.
Fix BOTH: (1) meet ALL numeric density rules, AND (2) JD tailoring — weave Job Description keywords into summary + most bullets; rewrite wording (no verbatim paste).
- summary ≥110 words (two paragraphs with newline).
- latest role ≥8 bullets when possible; each role ≥4 bullets; combined ≥8 if multiple roles.
- ≥14 skills (JD order); ≥4 projects (long descriptions); ≥3 certifications.
Facts only from candidate resume; phrasing must be new and JD-targeted.
`;

function getAiConfig() {
  const provider = (process.env.AI_PROVIDER || "openrouter").toLowerCase();

  if (provider === "gemini") {
    if (!process.env.GEMINI_API_KEY) {
      throw new AppError("Missing GEMINI_API_KEY environment variable", 500);
    }

    const geminiBaseUrl =
      process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta/openai";
    const geminiUrl = geminiBaseUrl.endsWith("/chat/completions")
      ? geminiBaseUrl
      : `${geminiBaseUrl.replace(/\/$/, "")}/chat/completions`;

    return {
      url: geminiUrl,
      model: process.env.GEMINI_MODEL || "gemini-2.0-flash",
      headers: {
        Authorization: `Bearer ${process.env.GEMINI_API_KEY}`,
        "Content-Type": "application/json",
      },
    };
  }

  if (provider === "groq") {
    if (!process.env.GROQ_API_KEY) {
      throw new AppError("Missing GROQ_API_KEY environment variable", 500);
    }

    return {
      url: "https://api.groq.com/openai/v1/chat/completions",
      model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
    };
  }

  if (!process.env.OPENROUTER_API_KEY) {
    throw new AppError(
      "Missing OPENROUTER_API_KEY environment variable (or set AI_PROVIDER=gemini/groq)",
      500,
    );
  }

  return {
    url: "https://openrouter.ai/api/v1/chat/completions",
    model: process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.OPENROUTER_HTTP_REFERER || "http://localhost:3000",
      "X-Title": process.env.OPENROUTER_APP_NAME || "SN Algora AI",
    },
  };
}

function stripCodeFences(content) {
  if (!content) return "";
  return content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
}

function extractContent(responseData) {
  return responseData?.choices?.[0]?.message?.content || "";
}

function extractJsonObject(raw) {
  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) return "";
  return raw.slice(firstBrace, lastBrace + 1);
}

function parseAiJson(rawContent) {
  const cleaned = stripCodeFences(rawContent);

  try {
    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (_jsonError) {
      const extracted = extractJsonObject(cleaned);
      if (!extracted) {
        throw new AppError("Failed to parse AI JSON response", 502);
      }
      parsed = JSON.parse(extracted);
    }

    if (typeof parsed === "string") {
      parsed = JSON.parse(parsed);
    }

    const validated = aiResponseSchema.safeParse(parsed);
    if (!validated.success) {
      const detail = validated.error?.issues?.[0]?.message || "validation failed";
      throw new AppError(`AI response JSON format is invalid or incomplete: ${detail}`, 502);
    }
    return validated.data;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError("Failed to parse AI JSON response", 502);
  }
}

async function generateResumeJson({ job_description, resume_text }) {
  const config = getAiConfig();
  const baseUserPrompt = USER_PROMPT_TEMPLATE.replace("{{JOB_DESCRIPTION}}", job_description).replace(
    "{{RESUME_TEXT}}",
    resume_text,
  );

  let lastError = null;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const suffix = attempt === 1 ? "" : `\n${DENSITY_RETRY_HINT}`;
    const userPrompt = `${baseUserPrompt}${suffix}`;

    try {
      const response = await axios.post(
        config.url,
        {
          model: config.model,
          temperature: attempt === 1 ? 0.35 : 0.32,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
          max_tokens: 7500,
        },
        { headers: config.headers, timeout: 180000 },
      );

      const content = extractContent(response.data);
      if (!content) {
        throw new AppError("Empty response returned by AI provider", 502);
      }

      return parseAiJson(content);
    } catch (error) {
      lastError = error;

      const retryable =
        attempt < 3 &&
        error instanceof AppError &&
        error.statusCode === 502 &&
        (error.message.includes("invalid") ||
          error.message.includes("incomplete") ||
          error.message.includes("parse"));

      if (!retryable) {
        if (error instanceof AppError) {
          throw error;
        }

        const providerMessage =
          error.response?.data?.error?.message ||
          error.response?.data?.message ||
          error.message ||
          "AI provider request failed";

        throw new AppError(`AI provider error: ${providerMessage}`, 502);
      }
    }
  }

  if (lastError instanceof AppError) {
    throw lastError;
  }
  throw new AppError("Failed to generate resume after retries", 502);
}

/* --- Career extras: cover letter, HR email, interview Q&A (parallel to resume) --- */

const qaPairSchema = z.object({
  question: z.string().trim().min(4),
  answer: z.string().trim().min(16),
});

const careerExtrasSchema = z.object({
  coverLetter: z.string().trim().min(120),
  hrEmailSubject: z.string().trim().min(4),
  hrEmailBody: z.string().trim().min(80),
  interviewQa: z.array(qaPairSchema).length(25),
});

const CAREER_EXTRAS_SYSTEM =
  "You are an expert careers coach for job seekers. Produce truthful, compelling application copy grounded in the candidate's resume facts—never invent employers, dates, degrees, or skills. Output strict JSON only (no markdown, no commentary).";

const CAREER_EXTRAS_USER = `
Using the JOB DESCRIPTION and CANDIDATE RESUME TEXT below, return ONE JSON object with exactly these keys:

1) coverLetter — 3–4 short paragraphs (plain text with \\n\\n between paragraphs). Tailored to THIS role and company themes from the JD. Highlight 2–3 concrete achievements from the resume (metrics when present). Warm, confident, not generic fluff.

2) hrEmailSubject — one line, professional, specific to this application (avoid "application for position").

3) hrEmailBody — a polished outreach email (plain text, use \\n for line breaks). Include clear placeholders where the applicant must personalize: exactly use these bracket tokens where appropriate: [Your Name], [Your Phone], [Your Email], [Company Name], [Role Title], [Recruiter Name if known], [Job ID or link if any]. The body should be ready to send after the user replaces placeholders; do not use real PII from the resume inside the body except what fits naturally in sentences (optional). Keep under ~220 words.

4) interviewQa — array of EXACTLY 25 objects, each { "question": "...", "answer": "..." }.
   - Questions must be the most useful interview questions for THIS job description (mix: behavioral, role-specific technical/functional, company/scenario, seniority-appropriate).
   - Answers must be STAR-style when relevant, grounded in the resume; if the resume lacks detail for a topic, say how to frame honestly and what to prepare, without inventing false experience.
   - Order from high-impact / likely-first to more specialized.

Job Description:
{{JOB_DESCRIPTION}}

Candidate Resume Text:
{{RESUME_TEXT}}

Return JSON shape exactly:
{
  "coverLetter": "string",
  "hrEmailSubject": "string",
  "hrEmailBody": "string",
  "interviewQa": [ { "question": "string", "answer": "string" } ]
}
`;

const CAREER_EXTRAS_RETRY = `
RETRY: previous output failed validation. Fix and return valid JSON only.
- coverLetter at least ~120 characters, multiple paragraphs separated by \\n\\n.
- hrEmailBody at least ~80 characters with [Your Name] [Company Name] [Role Title] placeholders.
- interviewQa must be exactly 25 {question, answer} pairs; answers substantive (not one-liners).
`;

function parseCareerExtrasJson(rawContent) {
  const cleaned = stripCodeFences(rawContent);
  try {
    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (_jsonError) {
      const extracted = extractJsonObject(cleaned);
      if (!extracted) {
        throw new AppError("Failed to parse career extras JSON response", 502);
      }
      parsed = JSON.parse(extracted);
    }
    if (typeof parsed === "string") {
      parsed = JSON.parse(parsed);
    }
    const validated = careerExtrasSchema.safeParse(parsed);
    if (!validated.success) {
      const detail = validated.error?.issues?.[0]?.message || "validation failed";
      throw new AppError(`Career extras JSON invalid: ${detail}`, 502);
    }
    return validated.data;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError("Failed to parse career extras JSON response", 502);
  }
}

async function generateCareerExtras({ job_description, resume_text }) {
  const config = getAiConfig();
  const baseUser = CAREER_EXTRAS_USER.replace("{{JOB_DESCRIPTION}}", job_description).replace(
    "{{RESUME_TEXT}}",
    resume_text,
  );

  let lastError = null;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const suffix = attempt === 1 ? "" : `\n${CAREER_EXTRAS_RETRY}`;
    const userPrompt = `${baseUser}${suffix}`;

    try {
      const response = await axios.post(
        config.url,
        {
          model: config.model,
          temperature: attempt === 1 ? 0.42 : 0.35,
          messages: [
            { role: "system", content: CAREER_EXTRAS_SYSTEM },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
          max_tokens: 14000,
        },
        { headers: config.headers, timeout: 180000 },
      );

      const content = extractContent(response.data);
      if (!content) {
        throw new AppError("Empty career extras response from AI provider", 502);
      }
      return parseCareerExtrasJson(content);
    } catch (error) {
      lastError = error;
      const retryable =
        attempt < 3 &&
        error instanceof AppError &&
        error.statusCode === 502 &&
        (error.message.includes("invalid") ||
          error.message.includes("parse") ||
          error.message.includes("Failed to parse"));

      if (!retryable) {
        if (error instanceof AppError) {
          throw error;
        }
        const providerMessage =
          error.response?.data?.error?.message ||
          error.response?.data?.message ||
          error.message ||
          "AI provider request failed";
        throw new AppError(`Career extras AI error: ${providerMessage}`, 502);
      }
    }
  }

  if (lastError instanceof AppError) {
    throw lastError;
  }
  throw new AppError("Failed to generate career extras after retries", 502);
}

module.exports = { generateResumeJson, generateCareerExtras };
