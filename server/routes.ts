import express, { type Express, type Request, type Response, type NextFunction } from "express";
import { createServer, type Server } from "http";
import path from "path";

const BACKEND = "https://mission.brightstacklabs.co.uk";
const BACKEND_TOKEN = "BrightStack2026!";

const backendHeaders = {
  "Authorization": `Bearer ${BACKEND_TOKEN}`,
  "Content-Type": "application/json",
};

async function proxy(
  res: Response,
  method: string,
  path: string,
  body?: unknown,
  queryString?: string
) {
  try {
    const url = `${BACKEND}${path}${queryString ? "?" + queryString : ""}`;
    const opts: RequestInit = {
      method,
      headers: backendHeaders,
    };
    if (body !== undefined) opts.body = JSON.stringify(body);
    const r = await fetch(url, opts);
    const text = await r.text();
    let data: unknown;
    try { data = JSON.parse(text); } catch { data = { error: text }; }
    return res.status(r.status).json(data);
  } catch (err) {
    console.error(`[proxy] ${method} ${path}:`, (err as Error).message);
    return res.status(502).json({ error: (err as Error).message });
  }
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = (req.headers.authorization || "").replace("Bearer ", "");
  if (!token || token.length < 10) return res.status(401).json({ error: "Unauthorized" });
  next();
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // ── Auth — no auth required ───────────────────────────────────────────────
  app.post("/api/auth/login", async (req, res) => {
    return proxy(res, "POST", "/auth/login", req.body);
  });

  // ── All other /api/* routes require auth ──────────────────────────────────
  app.use("/api", requireAuth);

  // ── Pages ─────────────────────────────────────────────────────────────────
  app.get("/api/pages", (_req, res) => proxy(res, "GET", "/pages"));
  app.post("/api/pages", (req, res) => proxy(res, "POST", "/pages", req.body));
  app.patch("/api/pages/:page_id/context", (req, res) =>
    proxy(res, "PATCH", `/pages/${req.params.page_id}/context`, req.body)
  );

  // ── Posts ─────────────────────────────────────────────────────────────────
  app.get("/api/posts", (req, res) => {
    const qs = new URLSearchParams(req.query as Record<string, string>).toString();
    return proxy(res, "GET", "/posts", undefined, qs || undefined);
  });

  app.get("/api/posts/calendar", (req, res) => {
    const qs = new URLSearchParams(req.query as Record<string, string>).toString();
    return proxy(res, "GET", "/posts/calendar", undefined, qs || undefined);
  });

  app.post("/api/posts", (req, res) => proxy(res, "POST", "/posts", req.body));

  app.get("/api/posts/:id", (req, res) =>
    proxy(res, "GET", `/posts/${req.params.id}`)
  );

  app.patch("/api/posts/:id", (req, res) =>
    proxy(res, "PATCH", `/posts/${req.params.id}`, req.body)
  );

  app.delete("/api/posts/:id", (req, res) =>
    proxy(res, "DELETE", `/posts/${req.params.id}`)
  );

  app.post("/api/posts/:id/approve", (req, res) =>
    proxy(res, "POST", `/posts/${req.params.id}/approve`)
  );

  app.post("/api/posts/:id/reject", (req, res) =>
    proxy(res, "POST", `/posts/${req.params.id}/reject`)
  );

  app.post("/api/posts/:id/publish", (req, res) =>
    proxy(res, "POST", `/posts/${req.params.id}/publish`)
  );

  // ── Generate ──────────────────────────────────────────────────────────────
  app.post("/api/generate", (req, res) =>
    proxy(res, "POST", "/posts/generate", req.body)
  );

  app.post("/api/generate/week", (req, res) =>
    proxy(res, "POST", "/posts/generate-week", req.body)
  );

  // ── Tasks (Kanban) ────────────────────────────────────────────────────────
  app.get("/api/tasks", (req, res) => {
    const qs = new URLSearchParams(req.query as Record<string, string>).toString();
    return proxy(res, "GET", "/tasks", undefined, qs || undefined);
  });

  app.post("/api/tasks", (req, res) => proxy(res, "POST", "/tasks", req.body));

  app.get("/api/tasks/:id", (req, res) =>
    proxy(res, "GET", `/tasks/${req.params.id}`)
  );

  app.patch("/api/tasks/:id", (req, res) =>
    proxy(res, "PATCH", `/tasks/${req.params.id}`, req.body)
  );

  app.delete("/api/tasks/:id", (req, res) =>
    proxy(res, "DELETE", `/tasks/${req.params.id}`)
  );

  app.post("/api/tasks/:id/activity", (req, res) =>
    proxy(res, "POST", `/tasks/${req.params.id}/activity`, req.body)
  );

  app.post("/api/tasks/:id/images", (req, res) =>
    proxy(res, "POST", `/tasks/${req.params.id}/images`, req.body)
  );

  // ── Clawbot check trigger ─────────────────────────────────────────────────
  app.post("/api/clawbot/check-tasks", (_req, res) =>
    proxy(res, "POST", "/clawbot/check-tasks")
  );

  // ── Clawbot status ────────────────────────────────────────────────────────
  app.get("/api/clawbot/status", (_req, res) =>
    proxy(res, "GET", "/clawbot/status")
  );

  // ── Cron jobs ─────────────────────────────────────────────────────────────
  app.get("/api/cron/jobs", (_req, res) => proxy(res, "GET", "/cron/jobs"));

  // ── Trading ───────────────────────────────────────────────────────────────
  app.get("/api/trading/status",    (_req, res) => proxy(res, "GET",  "/trading/status"));
  app.post("/api/trading/rebalance", (_req, res) => proxy(res, "POST", "/trading/rebalance"));

  // ── Campaigns ─────────────────────────────────────────────────────────────
  app.get("/api/campaigns",      (_req, res) => proxy(res, "GET", "/campaigns"));
  app.get("/api/campaigns/:id",  (req, res)  => proxy(res, "GET", `/campaigns/${req.params.id}`));

  // ── Architecture (served via proxy, auth enforced above) ──────────────────
  app.get("/api/architecture", (_req, res) => {
    return proxy(res, "GET", "/architecture");
  });

  // ── Public demos (no auth) ────────────────────────────────────────────────
  app.use("/demos", express.static(path.resolve(process.cwd(), "server", "public", "demos")));

  // ── Client proposals (no auth) ────────────────────────────────────────────────
  app.use("/client", express.static(path.resolve(process.cwd(), "server", "public", "client")));

  return httpServer;
}
