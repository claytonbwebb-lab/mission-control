import express, { type Express, type Request, type Response, type NextFunction } from "express";
import { createServer, type Server } from "http";
import path from "path";
import Database from "better-sqlite3";

const campsiteDb = new Database('/home/ubuntu/.openclaw/workspace/outreach/campsite-campaign/leads.db', { readonly: true });

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

  // ── Campsite Campaign ────────────────────────────────────────────────────
  app.get("/api/campsite/stats", (_req, res) => {
    try {
      const total = campsiteDb.prepare("SELECT COUNT(*) as count FROM leads").get() as { count: number };
      const byStatus = campsiteDb.prepare("SELECT status, COUNT(*) as count FROM leads GROUP BY status").all() as Array<{ status: string; count: number }>;
      const qmSynced = campsiteDb.prepare("SELECT SUM(CASE WHEN qm_synced = 1 THEN 1 ELSE 0 END) as synced, SUM(CASE WHEN qm_synced = 0 THEN 1 ELSE 0 END) as not_synced FROM leads").get() as { synced: number; not_synced: number };

      const stats: Record<string, number> = { total: total.count, new: 0, demo_built: 0, cancelled: 0, unqualified: 0, qm_synced: qmSynced.synced, not_synced: qmSynced.not_synced };
      byStatus.forEach(s => { stats[s.status] = s.count; });

      res.json(stats);
    } catch (err) {
      console.error("[campsite/stats]", (err as Error).message);
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get("/api/campsite/leads", (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
      const status = req.query.status as string;
      const qmSynced = req.query.qm_synced;
      const search = req.query.search as string;

      let where = "1=1";
      const params: unknown[] = [];

      if (status && status !== "all") {
        where += " AND status = ?";
        params.push(status);
      }
      if (qmSynced !== undefined && qmSynced !== "") {
        where += " AND qm_synced = ?";
        params.push(parseInt(qmSynced as string));
      }
      if (search) {
        where += " AND (site_name LIKE ? OR email LIKE ? OR website LIKE ?)";
        const searchPattern = `%${search}%`;
        params.push(searchPattern, searchPattern, searchPattern);
      }

      const countStmt = campsiteDb.prepare(`SELECT COUNT(*) as total FROM leads WHERE ${where}`);
      const total = (countStmt.get(...params) as { total: number }).total;
      const pages = Math.ceil(total / limit);
      const offset = (page - 1) * limit;

      const stmt = campsiteDb.prepare(`
        SELECT id, site_name, website, email, region, status, demo_url, qm_synced, email1_sent_at, email2_sent_at, created_at
        FROM leads WHERE ${where}
        ORDER BY id DESC
        LIMIT ? OFFSET ?
      `);
      const leads = stmt.all(...params, limit, offset);

      res.json({ leads, total, page, pages });
    } catch (err) {
      console.error("[campsite/leads]", (err as Error).message);
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get("/api/campsite/leads/export", (req, res) => {
    try {
      const status = req.query.status as string;
      const qmSynced = req.query.qm_synced;
      const search = req.query.search as string;

      let where = "1=1";
      const params: unknown[] = [];

      if (status && status !== "all") {
        where += " AND status = ?";
        params.push(status);
      }
      if (qmSynced !== undefined && qmSynced !== "") {
        where += " AND qm_synced = ?";
        params.push(parseInt(qmSynced as string));
      }
      if (search) {
        where += " AND (site_name LIKE ? OR email LIKE ? OR website LIKE ?)";
        const searchPattern = `%${search}%`;
        params.push(searchPattern, searchPattern, searchPattern);
      }

      const stmt = campsiteDb.prepare(`
        SELECT id, site_name, website, email, region, status, demo_url, qm_synced, email1_sent_at, email2_sent_at, created_at
        FROM leads WHERE ${where} ORDER BY id DESC
      `);
      const leads = stmt.all(...params) as Array<Record<string, unknown>>;

      const headers = ["id", "site_name", "website", "email", "region", "status", "demo_url", "qm_synced", "email1_sent_at", "email2_sent_at", "created_at"];
      const csv = [
        headers.join(","),
        ...leads.map(row => headers.map(h => {
          const val = row[h];
          if (val === null || val === undefined) return "";
          const str = String(val);
          return str.includes(",") || str.includes('"') || str.includes("\n") ? `"${str.replace(/"/g, '""')}"` : str;
        }).join(","))
      ].join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=campsite-leads.csv");
      res.send(csv);
    } catch (err) {
      console.error("[campsite/leads/export]", (err as Error).message);
      res.status(500).json({ error: (err as Error).message });
    }
  });

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
