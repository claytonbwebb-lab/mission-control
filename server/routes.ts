import type { Express } from "express";
import { createServer, type Server } from "http";
import { randomUUID } from "crypto";

interface DemoTask {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  label: string;
  assignee: string;
  createdAt: string;
}

interface DemoPost {
  id: string;
  platform: string;
  pageId: string;
  pageName: string;
  content: string;
  scheduledAt?: number;
  status: string;
  createdAt: number;
}

const demoPages = [
  { id: "p1", platform: "facebook", name: "Bright Stack Labs", pageId: "BSL-FB-001", status: "connected" },
  { id: "p2", platform: "instagram", name: "Life Coach Steven", pageId: "LCS-IG-002", status: "connected" },
  { id: "p3", platform: "twitter", name: "BSL Official", pageId: "BSL-TW-003", status: "connected" },
  { id: "p4", platform: "facebook", name: "WeSayIDo Weddings", pageId: "WSI-FB-004", status: "expired" },
  { id: "p5", platform: "instagram", name: "InvoiceWizard", pageId: "IW-IG-005", status: "connected" },
];

const now = Math.floor(Date.now() / 1000);
const day = 86400;

let demoTasks: DemoTask[] = [
  { id: randomUUID(), title: "Design new onboarding flow for InvoiceWizard", description: "Create wireframes for the first-time user experience. Focus on reducing steps to first invoice.", status: "ideas", priority: "high", label: "invoice_wizard", assignee: "steve", createdAt: "2026-02-20T09:00:00Z" },
  { id: randomUUID(), title: "Add Stripe recurring billing support", description: "Allow users to set up monthly recurring invoices with automatic Stripe charges.", status: "ideas", priority: "medium", label: "invoice_wizard", assignee: "clawbot", createdAt: "2026-02-18T14:30:00Z" },
  { id: randomUUID(), title: "Weekly motivation email sequence", description: "Build 5-email drip campaign for new coaching clients. Personal tone, actionable steps.", status: "ideas", priority: "low", label: "life_coach_steven", assignee: "steve", createdAt: "2026-02-22T11:00:00Z" },
  { id: randomUUID(), title: "Build vendor comparison feature", status: "in_progress", priority: "high", label: "wesayido", assignee: "clawbot", createdAt: "2026-02-15T10:00:00Z" },
  { id: randomUUID(), title: "Implement form validation for guest RSVP", description: "Add proper Zod validation, error messages, and dietary requirements field.", status: "in_progress", priority: "medium", label: "wesayido", assignee: "clawbot", createdAt: "2026-02-19T16:00:00Z" },
  { id: randomUUID(), title: "Real-time odds API integration", description: "Connect to Betfair Exchange API for live horse racing odds. Cache with 30s TTL.", status: "in_progress", priority: "urgent", label: "horse_race", assignee: "clawbot", createdAt: "2026-02-17T08:30:00Z" },
  { id: randomUUID(), title: "Landing page copy refresh", description: "Update hero section, feature cards, and testimonials. More conversational tone.", status: "review", priority: "medium", label: "bright_stack_labs", assignee: "steve", createdAt: "2026-02-14T13:00:00Z" },
  { id: randomUUID(), title: "Invoice PDF export", description: "Generate branded PDF invoices with company logo, line items, and payment link.", status: "review", priority: "high", label: "invoice_wizard", assignee: "clawbot", createdAt: "2026-02-12T09:00:00Z" },
  { id: randomUUID(), title: "Set up CI/CD pipeline", status: "complete", priority: "medium", label: "bright_stack_labs", assignee: "clawbot", createdAt: "2026-02-10T10:00:00Z" },
  { id: randomUUID(), title: "Client dashboard MVP", description: "Basic dashboard showing upcoming sessions, past notes, and goal progress tracker.", status: "complete", priority: "high", label: "life_coach_steven", assignee: "clawbot", createdAt: "2026-02-08T14:00:00Z" },
  { id: randomUUID(), title: "Race day alerting system", description: "SMS + push alerts 15 mins before race start for watched horses.", status: "complete", priority: "urgent", label: "horse_race", assignee: "clawbot", createdAt: "2026-02-05T11:00:00Z" },
];

let demoPosts: DemoPost[] = [
  { id: randomUUID(), platform: "facebook", pageId: "p1", pageName: "Bright Stack Labs", content: "Excited to announce our latest project is live! We've been working hard behind the scenes to bring you something special. Stay tuned for the full reveal this week.", scheduledAt: now + day * 1, status: "scheduled", createdAt: now - day * 2 },
  { id: randomUUID(), platform: "instagram", pageId: "p2", pageName: "Life Coach Steven", content: "Monday motivation: Your goals don't care about your excuses. Show up, put in the work, and watch your life transform. What's ONE thing you'll commit to this week?", scheduledAt: now + day * 2, status: "approved", createdAt: now - day * 1 },
  { id: randomUUID(), platform: "twitter", pageId: "p3", pageName: "BSL Official", content: "Hot take: The best code is the code you don't write. Simplify, automate, ship.", status: "draft", createdAt: now - day * 1 },
  { id: randomUUID(), platform: "facebook", pageId: "p4", pageName: "WeSayIDo Weddings", content: "Planning a 2026 wedding? Here are 5 vendor booking mistakes that could cost you thousands (and how to avoid them). Thread below.", scheduledAt: now + day * 3, status: "draft", createdAt: now },
  { id: randomUUID(), platform: "instagram", pageId: "p5", pageName: "InvoiceWizard", content: "Stop chasing payments. With InvoiceWizard, your invoices practically collect themselves. Free trial - link in bio.", scheduledAt: now - day * 3, status: "published", createdAt: now - day * 5 },
  { id: randomUUID(), platform: "twitter", pageId: "p3", pageName: "BSL Official", content: "New blog post: Why we chose React + Vite for our latest project (and what we'd do differently). Link in replies.", scheduledAt: now - day * 1, status: "published", createdAt: now - day * 3 },
  { id: randomUUID(), platform: "facebook", pageId: "p1", pageName: "Bright Stack Labs", content: "We're hiring! Looking for a senior full-stack dev who loves clean code and fast shipping. Remote-friendly. DM us.", scheduledAt: now - day * 2, status: "failed", createdAt: now - day * 4 },
];

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.post("/api/auth/login", (req, res) => {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: "Password required" });
    return res.json({ token: "demo-token-" + Date.now() });
  });

  app.get("/api/tasks", (_req, res) => res.json(demoTasks));

  app.post("/api/tasks", (req, res) => {
    const task: DemoTask = {
      id: randomUUID(),
      title: req.body.title || "Untitled",
      description: req.body.description,
      status: req.body.status || "ideas",
      priority: req.body.priority || "medium",
      label: req.body.label || "other",
      assignee: req.body.assignee || "clawbot",
      createdAt: req.body.createdAt || new Date().toISOString(),
    };
    demoTasks.push(task);
    return res.json(task);
  });

  app.patch("/api/tasks/:id", (req, res) => {
    const idx = demoTasks.findIndex(t => t.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Not found" });
    demoTasks[idx] = { ...demoTasks[idx], ...req.body };
    return res.json(demoTasks[idx]);
  });

  app.delete("/api/tasks/:id", (req, res) => {
    demoTasks = demoTasks.filter(t => t.id !== req.params.id);
    return res.json({ ok: true });
  });

  app.get("/api/pages", (_req, res) => res.json(demoPages));

  app.get("/api/posts", (_req, res) => res.json(demoPosts));

  app.get("/api/posts/calendar", (req, res) => {
    const from = Number(req.query.from) || 0;
    const to = Number(req.query.to) || Infinity;
    const filtered = demoPosts.filter(p => p.scheduledAt && p.scheduledAt >= from && p.scheduledAt < to);
    return res.json(filtered);
  });

  app.post("/api/posts", (req, res) => {
    const post: DemoPost = {
      id: randomUUID(),
      platform: req.body.platform || "facebook",
      pageId: req.body.pageId || "p1",
      pageName: demoPages.find(p => p.id === req.body.pageId)?.name || "Unknown",
      content: req.body.content || "",
      scheduledAt: req.body.scheduledAt,
      status: req.body.status || "draft",
      createdAt: Math.floor(Date.now() / 1000),
    };
    demoPosts.push(post);
    return res.json(post);
  });

  app.patch("/api/posts/:id", (req, res) => {
    const idx = demoPosts.findIndex(p => p.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Not found" });
    demoPosts[idx] = { ...demoPosts[idx], ...req.body };
    return res.json(demoPosts[idx]);
  });

  app.delete("/api/posts/:id", (req, res) => {
    demoPosts = demoPosts.filter(p => p.id !== req.params.id);
    return res.json({ ok: true });
  });

  app.post("/api/posts/:id/approve", (req, res) => {
    const idx = demoPosts.findIndex(p => p.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Not found" });
    demoPosts[idx].status = "approved";
    return res.json(demoPosts[idx]);
  });

  app.post("/api/posts/:id/reject", (req, res) => {
    const idx = demoPosts.findIndex(p => p.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Not found" });
    demoPosts[idx].status = "draft";
    return res.json(demoPosts[idx]);
  });

  app.post("/api/posts/:id/publish", (req, res) => {
    const idx = demoPosts.findIndex(p => p.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Not found" });
    demoPosts[idx].status = "published";
    return res.json(demoPosts[idx]);
  });

  app.post("/api/generate", (req, res) => {
    const { project, theme, format: fmt, guidance } = req.body;
    const content = `Here's a ${fmt || "short post"} for ${project || "your brand"} with a ${theme || "promotional"} theme:\n\nReady to level up? At ${project || "our company"}, we believe in building tools that actually make a difference. No fluff, no filler — just results.\n\n${guidance ? `Note: ${guidance}` : "Try it today and see the difference for yourself."}`;
    return res.json({ content });
  });

  app.post("/api/generate/week", (req, res) => {
    const { project } = req.body;
    const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
    const posts = dayNames.map((d, i) => ({
      id: randomUUID(),
      content: `${d} post for ${project || "your brand"}: Great things are built one day at a time. Today's focus: delivering value that matters. What's your focus for the day? #${project?.replace(/\s+/g, "") || "BuildInPublic"}`,
      scheduledTime: new Date(Date.now() + (i + 1) * day * 1000).toISOString().replace(/T.*/, "T09:00:00Z"),
    }));
    return res.json({ posts });
  });

  return httpServer;
}
