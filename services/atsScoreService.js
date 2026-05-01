const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "are",
  "but",
  "not",
  "you",
  "all",
  "can",
  "her",
  "was",
  "one",
  "our",
  "out",
  "day",
  "get",
  "has",
  "him",
  "his",
  "how",
  "its",
  "may",
  "new",
  "now",
  "old",
  "see",
  "two",
  "way",
  "who",
  "boy",
  "did",
  "let",
  "put",
  "say",
  "she",
  "too",
  "use",
  "with",
  "from",
  "that",
  "this",
  "will",
  "your",
  "have",
  "been",
  "more",
  "when",
  "what",
  "which",
  "their",
  "about",
  "after",
  "before",
  "other",
  "some",
  "such",
  "than",
  "then",
  "these",
  "they",
  "well",
  "work",
  "must",
  "also",
  "back",
  "here",
  "just",
  "like",
  "long",
  "make",
  "many",
  "most",
  "much",
  "only",
  "over",
  "same",
  "come",
  "each",
  "even",
  "good",
  "into",
  "know",
  "last",
  "next",
  "part",
  "show",
  "take",
  "time",
  "very",
  "year",
  "years",
  "job",
  "role",
  "team",
  "looking",
  "seeking",
  "candidate",
  "experience",
  "skills",
  "ability",
  "strong",
  "excellent",
  // Generic JD filler — hurts signal if scored like technical terms
  "background",
  "based",
  "including",
  "please",
  "apply",
  "click",
  "here",
  "send",
  "email",
]);

/** JD tokens that rarely change hire decisions — down-weight, don't inflate missing list noise */
const LOW_SIGNAL = new Set(["permanent", "wfh", "onsite", "hybrid", "full", "time", "part"]);

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function keywordMatches(resumeText, kw) {
  if (!kw) return false;
  if (kw === "degree") {
    return (
      /\bdegree\b/i.test(resumeText) ||
      /\b(bachelor|master|doctorate|ph\.?d|b\.?tech|m\.?tech|mba|b\.?e|m\.?e)\b/i.test(resumeText)
    );
  }
  if (kw === "bachelor") {
    return (
      /\bbachelor\b/i.test(resumeText) ||
      /\bb\.?tech\b/i.test(resumeText) ||
      /\bb\.?e\b/i.test(resumeText) ||
      /\bundergraduate\b/i.test(resumeText)
    );
  }
  if (kw === "master") {
    return (
      /\bmaster\b/i.test(resumeText) ||
      /\bm\.?tech\b/i.test(resumeText) ||
      /\bm\.?s\b/i.test(resumeText) ||
      /\bmba\b/i.test(resumeText)
    );
  }
  // Short tokens: require word boundaries so "gen" does not match inside "agentic" incorrectly
  if (kw.length <= 4) {
    try {
      return new RegExp(`\\b${escapeRegex(kw)}\\b`, "i").test(resumeText);
    } catch (_e) {
      return resumeText.includes(kw);
    }
  }
  return resumeText.includes(kw);
}

function tokenizeJobDescription(text) {
  const raw = String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s/]/g, " ");
  const parts = raw.split(/\s+/).filter(Boolean);
  const seen = new Set();
  const out = [];
  for (const p of parts) {
    if (p.length < 3) continue;
    if (STOPWORDS.has(p)) continue;
    if (seen.has(p)) continue;
    seen.add(p);
    out.push(p);
  }
  // Prefer longer / more specific tokens first when trimming (better ATS signal)
  out.sort((a, b) => b.length - a.length);
  return out.slice(0, 70);
}

function flattenResume(resumeJson) {
  const chunks = [];
  if (!resumeJson || typeof resumeJson !== "object") return "";
  chunks.push(resumeJson.title || "", resumeJson.summary || "");
  if (resumeJson.skills?.length) chunks.push(resumeJson.skills.join(" "));
  if (resumeJson.experience?.length) {
    for (const job of resumeJson.experience) {
      chunks.push(job.role, job.company, job.location || "", ...(job.points || []));
    }
  }
  if (resumeJson.education?.length) {
    for (const ed of resumeJson.education) {
      chunks.push(ed.degree || "", ed.institution || "", ed.duration || "", ed.score || "");
    }
  }
  if (resumeJson.projects?.length) {
    for (const p of resumeJson.projects) {
      chunks.push(p.name, p.description, ...(p.technologies || []));
    }
  }
  if (resumeJson.certifications?.length) chunks.push(resumeJson.certifications.join(" "));
  return chunks.join(" ").toLowerCase();
}

/**
 * Heuristic ATS-style score: JD keyword coverage on generated resume text (0–100).
 * Calibrated so strong overlap reads in the 75–90 range for typical good tailoring.
 */
function computeAtsScore(jobDescription, resumeJson) {
  const keywords = tokenizeJobDescription(jobDescription);
  const resumeText = flattenResume(resumeJson);

  if (!keywords.length) {
    return {
      overall: 0,
      matchedKeywords: 0,
      totalKeywords: 0,
      matchPercent: 0,
      missingSample: [],
      note: "Could not extract keywords from the job description.",
    };
  }

  const matched = [];
  const missing = [];

  for (const kw of keywords) {
    if (keywordMatches(resumeText, kw)) {
      matched.push(kw);
    } else {
      missing.push(kw);
    }
  }

  const matchRatio = matched.length / keywords.length;

  // Weighted ratio: low-signal HR tokens count half toward "miss" stress only, not denominator shrink
  let weightedHits = 0;
  let weightedTotal = 0;
  for (const kw of keywords) {
    const w = LOW_SIGNAL.has(kw) ? 0.5 : 1;
    weightedTotal += w;
    if (matched.includes(kw)) weightedHits += w;
  }
  const weightedRatio = weightedTotal > 0 ? weightedHits / weightedTotal : matchRatio;

  // Curve: baseline lift so honest strong tailoring lands ~80+ when overlap is good
  let overall = Math.round(Math.min(100, 34 + 66 * weightedRatio));

  if (matched.length >= 35) overall = Math.min(100, overall + 4);
  if (matched.length >= 45) overall = Math.min(100, overall + 4);
  if (weightedRatio >= 0.62) overall = Math.min(100, overall + 3);

  if (matched.length === 0) overall = Math.min(25, overall);

  const missingForUi = missing.filter((k) => !LOW_SIGNAL.has(k));

  return {
    overall,
    matchedKeywords: matched.length,
    totalKeywords: keywords.length,
    matchPercent: Math.round(matchRatio * 100),
    missingSample: missingForUi.slice(0, 10),
    note:
      "Estimate based on keyword overlap (including education and skills). Real ATS tools use proprietary rules; use this to sanity-check JD alignment.",
  };
}

module.exports = { computeAtsScore, tokenizeJobDescription, flattenResume };
