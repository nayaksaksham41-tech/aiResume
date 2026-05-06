(async function boot() {
  const form = document.getElementById("resumeForm");
  const statusText = document.getElementById("statusText");
  const loadingOverlay = document.getElementById("loadingOverlay");
  const generateBtn = document.getElementById("generateBtn");
  const loaderTipEl = document.getElementById("loaderTip");

  const LOADER_TIPS = [
    "Mapping keywords to your experience…",
    "Tailoring bullet points to the job description…",
    "Scoring keyword overlap (ATS-style estimate)…",
    "Structuring sections for clarity and impact…",
    "Polishing phrasing — almost ready…",
  ];

  let loaderTipInterval = null;
  let loaderTipIndex = 0;

  function setLoading(isLoading) {
    loadingOverlay.classList.toggle("hidden", !isLoading);
    loadingOverlay.setAttribute("aria-hidden", String(!isLoading));
    generateBtn.disabled = isLoading;

    if (loaderTipEl) {
      if (loaderTipInterval) {
        clearInterval(loaderTipInterval);
        loaderTipInterval = null;
      }
      if (isLoading) {
        loaderTipIndex = 0;
        loaderTipEl.textContent = LOADER_TIPS[0];
        loaderTipEl.style.opacity = "1";
        loaderTipInterval = setInterval(() => {
          loaderTipIndex = (loaderTipIndex + 1) % LOADER_TIPS.length;
          loaderTipEl.style.opacity = "0";
          setTimeout(() => {
            loaderTipEl.textContent = LOADER_TIPS[loaderTipIndex];
            loaderTipEl.style.opacity = "1";
          }, 200);
        }, 2800);
      }
    }
  }

  function setStatus(message, type = "") {
    statusText.textContent = message;
    statusText.className = `status ${type}`.trim();
  }

  async function parseErrorResponse(response) {
    try {
      const data = await response.json();
      const err = data?.error;
      if (typeof err === "string") return err;
      if (err && typeof err === "object" && typeof err.message === "string") return err.message;
      if (err != null && typeof err !== "object") return String(err);
      return `Request failed with status ${response.status}`;
    } catch (_error) {
      return `Request failed with status ${response.status}`;
    }
  }

  function getGenerateResumeUrl() {
    if (window.location.protocol === "file:") {
      return null;
    }
    return `${window.location.origin}/generate-resume`;
  }

  function assertJsonResponse(response) {
    const ct = (response.headers.get("content-type") || "").toLowerCase();
    if (!ct.includes("application/json")) {
      throw new Error(
        "Stale browser cache may be loading old JavaScript that expects a PDF from this step. Press Ctrl+Shift+R (hard reload), then generate again.",
      );
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const jobDescription = String(formData.get("job_description") || "").trim();
    const resumeText = String(formData.get("resume_text") || "").trim();

    if (!jobDescription || !resumeText) {
      setStatus("Please fill both fields before generating.", "error");
      return;
    }

    const endpoint = getGenerateResumeUrl();
    if (!endpoint) {
      setStatus(
        "Open this app in the browser at http://localhost:3000 (run npm run dev). Do not open the HTML file directly from your folder.",
        "error",
      );
      return;
    }

    setLoading(true);
    setStatus("Drafting resume, cover letter, HR email & interview guide (this can take a couple of minutes)…", "");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300000);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          job_description: jobDescription,
          resume_text: resumeText,
        }),
        signal: controller.signal,
        cache: "no-store",
        credentials: "include",
      });

      if (response.status === 402) {
        window.location.href = `${window.location.origin}/subscription.html`;
        return;
      }

      if (response.status === 401 || response.status === 403 || response.status === 404) {
        window.location.href = `${window.location.origin}/auth.html`;
        return;
      }

      if (!response.ok) {
        throw new Error(await parseErrorResponse(response));
      }

      assertJsonResponse(response);

      const data = await response.json();
      const sessionId = data.sessionId;
      if (!sessionId) {
        throw new Error("Unexpected server response: missing session.");
      }

      const query = new URLSearchParams({ session: sessionId });
      if (data.historyId) {
        query.set("history", data.historyId);
      }
      window.location.href = `${window.location.origin}/results.html?${query.toString()}`;
    } catch (error) {
      if (error.name === "AbortError") {
        setStatus(
          "Request timed out (5 min). The model may still be drafting your resume, cover letter, and interview guide — try again with a slightly shorter JD or resume, or retry.",
          "error",
        );
      } else if (error instanceof TypeError) {
        setStatus(
          "Cannot reach the API. Start the server (npm run dev), then use http://localhost:3000 — not a saved/offline page.",
          "error",
        );
      } else {
        setStatus(error.message || "Failed to generate resume. Please try again.", "error");
      }
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  });
})();
