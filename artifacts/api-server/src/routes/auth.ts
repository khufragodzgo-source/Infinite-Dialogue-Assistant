import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod/v4";

const router = Router();

const LoginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// POST /api/auth/login
router.post("/auth/login", async (req, res) => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid email or password" });
    return;
  }

  const { email, password } = parsed.data;
  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase().trim()));

    if (!user) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    req.session.userId = user.id;
    req.session.isAdmin = user.isAdmin;
    req.session.email = user.email;

    res.json({ user: { id: user.id, email: user.email, isAdmin: user.isAdmin } });
  } catch (err) {
    req.log.error({ err }, "Login error");
    res.status(500).json({ error: "Login failed" });
  }
});

// POST /api/auth/register
router.post("/auth/register", async (req, res) => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid email or password" });
    return;
  }
  const { email, password } = parsed.data;
  try {
    const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase().trim()));
    if (existing) {
      res.status(409).json({ error: "Email already registered" });
      return;
    }
    const hash = await bcrypt.hash(password, 10);
    const [user] = await db
      .insert(usersTable)
      .values({ email: email.toLowerCase().trim(), passwordHash: hash, isAdmin: false })
      .returning();
    req.session.userId = user!.id;
    req.session.isAdmin = false;
    req.session.email = user!.email;
    res.status(201).json({ user: { id: user!.id, email: user!.email, isAdmin: false } });
  } catch (err) {
    req.log.error({ err }, "Register error");
    res.status(500).json({ error: "Registration failed" });
  }
});

// POST /api/auth/logout
router.post("/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("mani.sid");
    res.status(204).end();
  });
});

// GET /api/auth/me
router.get("/auth/me", (req, res) => {
  if (!req.session.userId) {
    res.json({ user: null });
    return;
  }
  res.json({
    user: {
      id: req.session.userId,
      email: req.session.email ?? "",
      isAdmin: req.session.isAdmin ?? false,
    },
  });
});

export default router;
