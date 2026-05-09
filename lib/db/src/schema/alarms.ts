import { pgTable, serial, text, boolean, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const alarmsTable = pgTable("alarms", {
  id: serial("id").primaryKey(),
  label: text("label").notNull(),
  time: text("time").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  days: integer("days").array().notNull().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAlarmSchema = createInsertSchema(alarmsTable).omit({ id: true, createdAt: true });
export type InsertAlarm = z.infer<typeof insertAlarmSchema>;
export type Alarm = typeof alarmsTable.$inferSelect;
