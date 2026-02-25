import type { Express } from "express";
import { createServer, type Server } from "http";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.get("/api/ai/usage", async (req, res) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ error: "ANTHROPIC_API_KEY not configured" });
    }

    try {
      const response = await fetch("https://api.anthropic.com/v1/usage", {
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
      });

      if (!response.ok) {
        const body = await response.text();
        return res.status(response.status).json({ error: body });
      }

      const data = await response.json();

      return res.json({
        remainingCredit: data.remaining_credit ?? 0,
        usageThisMonth: data.usage_this_month ?? 0,
        usageLastMonth: data.usage_last_month ?? 0,
        currency: data.currency ?? "USD",
      });
    } catch (err) {
      console.error("AI usage fetch error:", err);
      return res.status(500).json({ error: "Failed to fetch AI usage" });
    }
  });

  app.get("/api/ai/usage/daily", async (req, res) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ error: "ANTHROPIC_API_KEY not configured" });
    }

    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 6);

      const fmt = (d: Date) => d.toISOString().split("T")[0];

      const response = await fetch(
        `https://api.anthropic.com/v1/usage/daily?start_date=${fmt(startDate)}&end_date=${fmt(endDate)}`,
        {
          headers: {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const body = await response.text();
        return res.status(response.status).json({ error: body });
      }

      const data = await response.json();
      const entries = data.data ?? data.usage ?? [];

      const result = entries.map((entry: Record<string, unknown>) => ({
        date: entry.date ?? entry.start_date,
        inputTokens: entry.input_tokens ?? 0,
        outputTokens: entry.output_tokens ?? 0,
      }));

      return res.json(result);
    } catch (err) {
      console.error("AI daily usage fetch error:", err);
      return res.status(500).json({ error: "Failed to fetch daily AI usage" });
    }
  });

  app.get("/api/ai/usage/recent", async (req, res) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ error: "ANTHROPIC_API_KEY not configured" });
    }

    try {
      const response = await fetch(
        "https://api.anthropic.com/v1/usage/messages?limit=20",
        {
          headers: {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const body = await response.text();
        return res.status(response.status).json({ error: body });
      }

      const data = await response.json();
      const entries = data.data ?? [];

      const result = entries.map((entry: Record<string, unknown>) => ({
        id: entry.id ?? crypto.randomUUID(),
        date: entry.created_at ?? new Date().toISOString(),
        model: entry.model ?? "unknown",
        inputTokens: (entry.usage as Record<string, number>)?.input_tokens ?? entry.input_tokens ?? 0,
        outputTokens: (entry.usage as Record<string, number>)?.output_tokens ?? entry.output_tokens ?? 0,
        estimatedCost: entry.cost ?? 0,
      }));

      return res.json(result);
    } catch (err) {
      console.error("AI recent usage fetch error:", err);
      return res.status(500).json({ error: "Failed to fetch recent AI usage" });
    }
  });

  return httpServer;
}
