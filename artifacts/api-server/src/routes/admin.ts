import { Router, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { usersTable, chatMessagesTable, apiConfigTable } from "@workspace/db";
import { eq, desc, count, sql } from "drizzle-orm";
import { invalidateOpenAICache } from "../lib/openai-dynamic";

const router = Router();

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.session?.isAdmin) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
}

router.use("/admin", requireAdmin);

// GET /api/admin/users
router.get("/admin/users", async (req, res) => {
  try {
    const users = await db
      .select()
      .from(usersTable)
      .orderBy(desc(usersTable.createdAt));

    const msgCounts = await db
      .select({
        userId: chatMessagesTable.userId,
        cnt: count(),
      })
      .from(chatMessagesTable)
      .groupBy(chatMessagesTable.userId);

    const countMap: Record<number, number> = {};
    for (const r of msgCounts) {
      if (r.userId != null) countMap[r.userId] = Number(r.cnt);
    }

    res.json(
      users.map((u) => ({
        id: u.id,
        email: u.email,
        isAdmin: u.isAdmin,
        createdAt: u.createdAt,
        messageCount: countMap[u.id] ?? 0,
      }))
    );
  } catch (err) {
    req.log.error({ err }, "Error fetching users");
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// GET /api/admin/users/:id/messages
router.get("/admin/users/:id/messages", async (req, res) => {
  const userId = Number(req.params.id);
  if (Number.isNaN(userId)) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }
  try {
    const messages = await db
      .select()
      .from(chatMessagesTable)
      .where(eq(chatMessagesTable.userId, userId))
      .orderBy(chatMessagesTable.createdAt)
      .limit(500);
    res.json(messages);
  } catch (err) {
    req.log.error({ err }, "Error fetching messages");
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

// GET /api/admin/config/openai
router.get("/admin/config/openai", async (req, res) => {
  try {
    const [config] = await db
      .select()
      .from(apiConfigTable)
      .where(eq(apiConfigTable.keyName, "openai_api_key"));

    res.json({
      hasCustomKey: !!config,
      keyPreview: config
        ? `${config.keyValue.slice(0, 7)}...${config.keyValue.slice(-4)}`
        : null,
      updatedAt: config?.updatedAt ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "Error fetching openai config");
    res.status(500).json({ error: "Failed to fetch config" });
  }
});

// PUT /api/admin/config/openai
router.put("/admin/config/openai", async (req, res) => {
  const { apiKey } = req.body as { apiKey?: string };

  try {
    if (!apiKey?.trim()) {
      await db
        .delete(apiConfigTable)
        .where(eq(apiConfigTable.keyName, "openai_api_key"));
      invalidateOpenAICache();
      res.json({ success: true, hasCustomKey: false });
      return;
    }

    const existing = await db
      .select()
      .from(apiConfigTable)
      .where(eq(apiConfigTable.keyName, "openai_api_key"));

    if (existing.length > 0) {
      await db
        .update(apiConfigTable)
        .set({ keyValue: apiKey.trim(), updatedAt: sql`now()` })
        .where(eq(apiConfigTable.keyName, "openai_api_key"));
    } else {
      await db
        .insert(apiConfigTable)
        .values({ keyName: "openai_api_key", keyValue: apiKey.trim() });
    }

    invalidateOpenAICache();
    res.json({ success: true, hasCustomKey: true });
  } catch (err) {
    req.log.error({ err }, "Error updating openai config");
    res.status(500).json({ error: "Failed to update config" });
  }
});

export default router;
