const express = require("express");
const { z } = require("zod");
const bcrypt = require("bcryptjs");

const userStore = require("../services/userStore");
const { isAdminEmail } = require("../services/adminService");
const { signToken, verifyToken } = require("../services/authTokens");
const { AppError } = require("../middleware/errorHandler");

const router = express.Router();

const credentialsSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

function authCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  };
}

function publicUser(user) {
  return { id: user.id, email: user.email };
}

router.post("/signup", async (req, res, next) => {
  try {
    const parsed = credentialsSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0]?.message || "Invalid input", 400);
    }
    const email = parsed.data.email.trim().toLowerCase();
    const { password } = parsed.data;

    if (await userStore.findByEmail(email)) {
      throw new AppError("An account with this email already exists.", 409);
    }

    const passwordHash = bcrypt.hashSync(password, 12);
    const user = await userStore.createUser({ email, passwordHash });
    let token;
    try {
      token = signToken(user);
    } catch (e) {
      if (String(e?.message || "").includes("JWT_SECRET")) {
        throw new AppError(
          "Server auth is not configured. Set JWT_SECRET in deployment environment.",
          500,
        );
      }
      throw e;
    }
    res.cookie("auth_token", token, authCookieOptions());
    res.status(201).json({
      user: publicUser(user),
      isAdmin: isAdminEmail(user.email),
    });
  } catch (err) {
    next(err);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const parsed = credentialsSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0]?.message || "Invalid input", 400);
    }
    const email = parsed.data.email.trim().toLowerCase();
    const { password } = parsed.data;

    const row = await userStore.findByEmail(email);
    let passwordMatches = false;
    if (row && typeof row.passwordHash === "string" && row.passwordHash.length > 0) {
      try {
        passwordMatches = bcrypt.compareSync(password, row.passwordHash);
      } catch (_e) {
        passwordMatches = false;
      }
    }

    if (!row || !passwordMatches) {
      throw new AppError("Incorrect email or password.", 401);
    }

    let token;
    try {
      token = signToken({ id: row.id, email: row.email });
    } catch (e) {
      if (String(e?.message || "").includes("JWT_SECRET")) {
        throw new AppError(
          "Server auth is not configured. Set JWT_SECRET in deployment environment.",
          500,
        );
      }
      throw e;
    }
    res.cookie("auth_token", token, authCookieOptions());
    res.status(200).json({
      user: publicUser(row),
      isAdmin: isAdminEmail(row.email),
    });
  } catch (err) {
    next(err);
  }
});

router.post("/logout", (_req, res) => {
  res.clearCookie("auth_token", { path: "/" });
  res.status(200).json({ ok: true });
});

router.get("/me", (req, res) => {
  const token = req.cookies?.auth_token;
  if (!token) {
    return res.status(401).json({ error: "Not signed in." });
  }
  try {
    const payload = verifyToken(token);
    res.status(200).json({
      user: { id: payload.sub, email: payload.email },
      isAdmin: isAdminEmail(payload.email),
    });
  } catch (_e) {
    res.status(401).json({ error: "Invalid or expired session." });
  }
});

module.exports = router;
