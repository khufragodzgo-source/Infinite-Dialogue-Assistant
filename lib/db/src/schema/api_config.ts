import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const apiConfigTable = pgTable("api_config", {
  id: serial("id").primaryKey(),
  keyName: text("key_name").notNull().unique(),
  keyValue: text("key_value").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type ApiConfig = typeof apiConfigTable.$inferSelect;
