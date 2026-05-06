function getOrigin() {
  if (window.location.protocol === "file:") return null;
  return window.location.origin;
}

function getSessionIdFromQuery() {
  const params = new URLSearchParams(window.location.search);
  return params.get("session") || params.get("id") || "";
}

function getHistoryIdFromQuery() {
  return new URLSearchParams(window.location.search).get("history") || "";
}

function showError(message) {
  const banner = document.getElementById("errorBanner");
  banner.textContent = message;
  banner.classList.remove("hidden");
}

function setLoading(button, loading) {
  button.disabled = loading;
  button.dataset.originalText = button.dataset.originalText || button.textContent;
  button.textContent = loading ? "Please wait…" : button.dataset.originalText;
}

async function assertPdfBlob(blob) {
  const head = await blob.slice(0, 8).text();
  if (!head.startsWith("%PDF")) {
    throw new Error(
      "This file is not a valid PDF (often JSON error text saved as .pdf). Hard-reload the site (Ctrl+Shift+R), generate again, then download only from the results page.",
    );
  }
}

async function assertDocxBlob(blob) {
  const buf = await blob.slice(0, 4).arrayBuffer();
  const u = new Uint8Array(buf);
  const isZip = u[0] === 0x50 && u[1] === 0x4b;
  if (!isZip) {
    throw new Error("This file is not a valid Word document. Try generating again from the home page.");
  }
}

function triggerBlobDownload(blob, filename) {
  const objUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objUrl;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(objUrl), 2500);
}

function fillAtsPanel(sc) {
  const atsPanel = document.getElementById("atsPanel");
  if (!sc) return;

  document.getElementById("atsScoreValue").textContent =
    typeof sc.overall === "number" ? `${sc.overall}` : "—";
  document.getElementById("atsKeywordsLine").textContent =
    sc.totalKeywords > 0
      ? `Keywords matched from job description: ${sc.matchedKeywords} / ${sc.totalKeywords} (${sc.matchPercent}% overlap)`
      : "";
  document.getElementById("atsNote").textContent = sc.note || "";

  const missingWrap = document.getElementById("atsMissing");
  if (sc.missingSample?.length) {
    missingWrap.innerHTML = `<strong>Sample terms not found on resume (consider if truthful):</strong> ${sc.missingSample.join(", ")}`;
    missingWrap.classList.remove("hidden");
  }
  atsPanel.classList.remove("hidden");
}

async function copyToClipboard(text, button) {
  const t = String(text || "");
  const original = button?.textContent;
  try {
    await navigator.clipboard.writeText(t);
  } catch (_e) {
    const ta = document.createElement("textarea");
    ta.value = t;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
  if (button && original != null) {
    button.textContent = "Copied!";
    setTimeout(() => {
      button.textContent = original;
    }, 1600);
  }
}

function applyCareerExtras(careerExtras) {
  const pack = document.getElementById("careerPack");
  const miss = document.getElementById("careerPackUnavailable");
  const interviewBtn = document.getElementById("btnInterviewPdf");

  if (!careerExtras?.coverLetter || !careerExtras?.interviewQa?.length) {
    pack.classList.add("hidden");
    miss.classList.remove("hidden");
    if (interviewBtn) interviewBtn.disabled = true;
    return;
  }

  miss.classList.add("hidden");
  pack.classList.remove("hidden");

  document.getElementById("coverLetterOut").value = careerExtras.coverLetter;
  document.getElementById("hrEmailSubjectOut").value = careerExtras.hrEmailSubject || "";
  document.getElementById("hrEmailBodyOut").value = careerExtras.hrEmailBody || "";
  if (interviewBtn) interviewBtn.disabled = false;
}

document.addEventListener("DOMContentLoaded", async () => {
  const origin = getOrigin();
  const sessionId = getSessionIdFromQuery();
  const historyId = getHistoryIdFromQuery();

  const btnPdf = document.getElementById("btnPdf");
  const btnDocx = document.getElementById("btnDocx");
  const btnInterviewPdf = document.getElementById("btnInterviewPdf");
  const atsPanel = document.getElementById("atsPanel");
  const downloadGrid = document.getElementById("downloadGrid");
  const btnCopyCover = document.getElementById("btnCopyCover");
  const btnCopySubject = document.getElementById("btnCopySubject");
  const btnCopyEmailBody = document.getElementById("btnCopyEmailBody");
  const btnCopyEmailAll = document.getElementById("btnCopyEmailAll");

  if (!origin) {
    showError("Open this app via http://localhost:3000 (not a local file path).");
    downloadGrid.classList.add("hidden");
    return;
  }

  try {
    const authRes = await fetch(`${origin}/svc/auth/me`, {
      credentials: "include",
      cache: "no-store",
    });
    if (authRes.status === 401 || authRes.status === 403 || authRes.status === 404) {
      window.location.href = `${origin}/auth.html`;
      return;
    }
    if (!authRes.ok) {
      showError("Could not verify your session. Try refreshing or signing in again.");
      downloadGrid.classList.add("hidden");
      return;
    }
  } catch (_e) {
    window.location.href = `${origin}/auth.html`;
    return;
  }

  if (!sessionId && !historyId) {
    showError("Missing session or history id. Go back and generate a resume, or open an item from History.");
    downloadGrid.classList.add("hidden");
    return;
  }

  let loadedAts = false;
  let careerExtras = null;

  try {
    if (sessionId) {
      const res = await fetch(`${origin}/resume-session/${encodeURIComponent(sessionId)}`, {
        cache: "no-store",
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        if (data.atsScore) {
          fillAtsPanel(data.atsScore);
          loadedAts = true;
        }
        if (data.careerExtras) {
          careerExtras = data.careerExtras;
        }
      }
    }

    if ((!careerExtras || !loadedAts) && historyId) {
      const res = await fetch(`${origin}/svc/history/${encodeURIComponent(historyId)}`, {
        cache: "no-store",
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Could not load history (${res.status}).`);
      }
      const data = await res.json();
      if (!loadedAts && data.atsScore) {
        fillAtsPanel(data.atsScore);
        loadedAts = true;
      }
      if (!careerExtras && data.careerExtras) {
        careerExtras = data.careerExtras;
      }
    }

    if (!loadedAts) {
      atsPanel.classList.add("hidden");
    }

    applyCareerExtras(careerExtras);
  } catch (e) {
    showError(e.message || "Failed to load result details.");
    downloadGrid.classList.add("hidden");
    btnPdf.disabled = true;
    btnDocx.disabled = true;
    if (btnInterviewPdf) btnInterviewPdf.disabled = true;
    return;
  }

  btnCopyCover?.addEventListener("click", () => {
    const v = document.getElementById("coverLetterOut").value;
    copyToClipboard(v, btnCopyCover);
  });

  btnCopySubject?.addEventListener("click", () => {
    const v = document.getElementById("hrEmailSubjectOut").value;
    copyToClipboard(v, btnCopySubject);
  });

  btnCopyEmailBody?.addEventListener("click", () => {
    const v = document.getElementById("hrEmailBodyOut").value;
    copyToClipboard(v, btnCopyEmailBody);
  });

  btnCopyEmailAll?.addEventListener("click", () => {
    const sub = document.getElementById("hrEmailSubjectOut").value.trim();
    const body = document.getElementById("hrEmailBodyOut").value.trim();
    copyToClipboard(`${sub}\n\n${body}`, btnCopyEmailAll);
  });

  btnPdf.addEventListener("click", async () => {
    setLoading(btnPdf, true);
    try {
      let url = sessionId ? `${origin}/download/${encodeURIComponent(sessionId)}/pdf` : null;
      let res = url
        ? await fetch(url, { cache: "no-store", credentials: "include" })
        : { ok: false, status: 0 };

      if (!res.ok && historyId) {
        url = `${origin}/svc/history/${encodeURIComponent(historyId)}/download/pdf`;
        res = await fetch(url, { cache: "no-store", credentials: "include" });
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "PDF download failed.");
      }

      const blob = await res.blob();
      await assertPdfBlob(blob);
      triggerBlobDownload(blob, "resume.pdf");
    } catch (e) {
      showError(e.message || "PDF download failed.");
    } finally {
      setLoading(btnPdf, false);
    }
  });

  btnDocx.addEventListener("click", async () => {
    setLoading(btnDocx, true);
    try {
      let url = sessionId ? `${origin}/download/${encodeURIComponent(sessionId)}/docx` : null;
      let res = url
        ? await fetch(url, { cache: "no-store", credentials: "include" })
        : { ok: false, status: 0 };

      if (!res.ok && historyId) {
        url = `${origin}/svc/history/${encodeURIComponent(historyId)}/download/docx`;
        res = await fetch(url, { cache: "no-store", credentials: "include" });
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Word download failed.");
      }

      const blob = await res.blob();
      await assertDocxBlob(blob);
      triggerBlobDownload(blob, "resume.docx");
    } catch (e) {
      showError(e.message || "Word download failed.");
    } finally {
      setLoading(btnDocx, false);
    }
  });

  btnInterviewPdf?.addEventListener("click", async () => {
    setLoading(btnInterviewPdf, true);
    try {
      let url = sessionId ? `${origin}/download/${encodeURIComponent(sessionId)}/interview-pdf` : null;
      let res = url
        ? await fetch(url, { cache: "no-store", credentials: "include" })
        : { ok: false, status: 0 };

      if (!res.ok && historyId) {
        url = `${origin}/svc/history/${encodeURIComponent(historyId)}/download/interview-pdf`;
        res = await fetch(url, { cache: "no-store", credentials: "include" });
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Interview PDF download failed.");
      }

      const blob = await res.blob();
      await assertPdfBlob(blob);
      triggerBlobDownload(blob, "interview-guide-25-qa.pdf");
    } catch (e) {
      showError(e.message || "Interview PDF download failed.");
    } finally {
      setLoading(btnInterviewPdf, false);
    }
  });
});
