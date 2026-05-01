const form = document.getElementById("authForm");
const tabLogin = document.getElementById("tabLogin");
const tabSignup = document.getElementById("tabSignup");
const submitLabel = document.getElementById("submitLabel");
const submitBtn = document.getElementById("submitBtn");
const authStatus = document.getElementById("authStatus");

let mode = "login";

function setMode(next) {
  mode = next;
  tabLogin.classList.toggle("active", mode === "login");
  tabSignup.classList.toggle("active", mode === "signup");
  submitLabel.textContent = mode === "login" ? "Log in" : "Create account";
  document.getElementById("password").autocomplete = mode === "login" ? "current-password" : "new-password";
}

tabLogin.addEventListener("click", () => setMode("login"));
tabSignup.addEventListener("click", () => setMode("signup"));

function setStatus(message, type = "") {
  authStatus.textContent = message;
  authStatus.className = `status ${type}`.trim();
}

async function parseError(response) {
  try {
    const data = await response.json();
    return data?.error || `Request failed (${response.status})`;
  } catch (_e) {
    return `Request failed (${response.status})`;
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(form);
  const email = String(fd.get("email") || "").trim();
  const password = String(fd.get("password") || "");

  if (!email || !password) {
    setStatus("Enter email and password.", "error");
    return;
  }

  const endpoint =
    mode === "login"
      ? `${window.location.origin}/svc/auth/login`
      : `${window.location.origin}/svc/auth/signup`;

  submitBtn.disabled = true;
  setStatus(mode === "login" ? "Signing you in…" : "Creating your account…", "");

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ email, password }),
      credentials: "include",
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(await parseError(response));
    }

    setStatus("Success — redirecting…", "");
    window.location.href = `${window.location.origin}/`;
  } catch (err) {
    setStatus(err.message || "Something went wrong.", "error");
  } finally {
    submitBtn.disabled = false;
  }
});

(async function redirectIfAuthed() {
  if (window.location.protocol === "file:") return;
  try {
    const r = await fetch(`${window.location.origin}/svc/auth/me`, {
      credentials: "include",
      cache: "no-store",
    });
    if (r.ok) {
      window.location.href = `${window.location.origin}/`;
    }
  } catch (_e) {
    // stay on auth page
  }
})();
