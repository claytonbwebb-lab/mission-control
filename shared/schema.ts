import { pgTable, text, varchar, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type TaskStatus = "ideas" | "in_progress" | "review" | "complete";
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type TaskLabel =
  | "invoice_wizard"
  | "life_coach_steven"
  | "wesayido"
  | "horse_race"
  | "bright_stack_labs"
  | "other";
export type TaskAssignee = "steve" | "clawbot";

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  label: TaskLabel;
  assignee: TaskAssignee;
  createdAt: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  label: TaskLabel;
  assignee: TaskAssignee;
}

export interface SocialPage {
  id: string;
  platform: "facebook" | "instagram" | "twitter";
  name: string;
  pageId: string;
  status: "connected" | "expired";
}

export interface SocialPost {
  id: string;
  platform: "facebook" | "instagram" | "twitter";
  pageId: string;
  pageName: string;
  content: string;
  imageUrl?: string;
  scheduledAt?: number | string;
  status: "draft" | "approved" | "scheduled" | "published" | "failed";
  createdAt: number | string;
}

export interface CreatePostInput {
  platform: "facebook" | "instagram" | "twitter";
  pageId: string;
  content: string;
  scheduledAt?: number;
  status: "draft" | "approved" | "scheduled" | "published" | "failed";
}

export interface AiMonthUsage {
  input: number;
  output: number;
  cost: number;
  calls: number;
}

export interface AiUsageData {
  balance: number;
  thisMonth: AiMonthUsage;
  lastMonth: AiMonthUsage;
}

export interface AiDailyUsage {
  date: string;
  label: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
}

export interface AiRecentCall {
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  source: string;
  created_at: string;
}
