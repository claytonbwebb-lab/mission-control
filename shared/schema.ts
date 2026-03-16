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

export type TaskStatus = "ideas" | "inprogress" | "review" | "complete";
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type TaskLabel = string;
export type TaskAssignee = string;

export interface TaskImage {
  id: number;
  task_id: number;
  filename: string;
  url: string;
  created_at: number;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  label: TaskLabel;
  assignee: TaskAssignee;
  position?: number;
  is_repeatable?: number;
  cadence?: "daily" | "weekly" | "monthly";
  reminder_at?: number | null; // Unix timestamp for reminder
  reminder_notified?: number; // 1 if notification sent
  images?: TaskImage[];
  createdAt: string;
  updatedAt?: string;
}

export interface ActivityEntry {
  id: number;
  task_id: number;
  author: string;
  type: "status_change" | "field_change" | "comment";
  content: string;
  field?: string;
  old_value?: string;
  new_value?: string;
  image_url?: string;
  created_at: number;
}

export interface TaskDetail extends Task {
  activity: ActivityEntry[];
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  project: string;
  assigned_to: string;
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
