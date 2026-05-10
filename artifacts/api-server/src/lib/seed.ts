import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

export async function seedAdmin(): Promise<void> {
  try {
    const adminEmail = "shrisaithangjam127@gmail.com";
    const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, adminEmail));
    if (!existing) {
      const hash = await bcrypt.hash("Gungun123", 10);
      await db.insert(usersTable).values({
        email: adminEmail,
        passwordHash: hash,
        isAdmin: true,
      });
      logger.info({ email: adminEmail }, "Admin user created");
    }
  } catch (err) {
    logger.warn({ err }, "Could not seed admin user");
  }
}
