import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import { AlertCircle, Loader2, CreditCard, Activity, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { AiUsageData, AiDailyUsage, AiRecentCall } from "@shared/schema";

async function fetchLocal<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) {
    const text = await res.text().catch(() => "Error");
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json();
}

function formatCurrency(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency, minimumFractionDigits: 2 }).format(amount);
}

function formatTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return n.toString();
}

export default function AiUsagePage() {
  const { data: usage, isLoading: usageLoading, error: usageError } = useQuery<AiUsageData>({
    queryKey: ["/api/ai/usage"],
    queryFn: () => fetchLocal<AiUsageData>("/api/ai/usage"),
    staleTime: 60_000,
  });

  const { data: daily, isLoading: dailyLoading } = useQuery<AiDailyUsage[]>({
    queryKey: ["/api/ai/usage/daily"],
    queryFn: () => fetchLocal<AiDailyUsage[]>("/api/ai/usage/daily"),
    staleTime: 60_000,
  });

  const { data: recent, isLoading: recentLoading } = useQuery<AiRecentCall[]>({
    queryKey: ["/api/ai/usage/recent"],
    queryFn: () => fetchLocal<AiRecentCall[]>("/api/ai/usage/recent"),
    staleTime: 60_000,
  });

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-5 py-3 border-b border-border bg-background sticky top-0 z-10">
        <h1 className="text-base font-semibold text-foreground">AI Usage &amp; Billing</h1>
      </div>

      <div className="p-5 space-y-5 max-w-5xl">
        {usageError && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>Could not load AI usage data. Check your Anthropic API key configuration.</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-card border border-card-border rounded-md p-4" data-testid="panel-credit-balance">
            <div className="flex items-center gap-2 mb-3">
              <CreditCard className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Remaining Credit</span>
            </div>
            {usageLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <p className="text-2xl font-bold text-foreground" data-testid="text-remaining-credit">
                {usage ? formatCurrency(usage.remainingCredit, usage.currency) : "—"}
              </p>
            )}
          </div>

          <div className="bg-card border border-card-border rounded-md p-4" data-testid="panel-usage-this-month">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">This Month</span>
            </div>
            {usageLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <p className="text-2xl font-bold text-foreground" data-testid="text-usage-this-month">
                {usage ? formatCurrency(usage.usageThisMonth, usage.currency) : "—"}
              </p>
            )}
          </div>

          <div className="bg-card border border-card-border rounded-md p-4" data-testid="panel-usage-last-month">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Last Month</span>
            </div>
            {usageLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <p className="text-2xl font-bold text-foreground" data-testid="text-usage-last-month">
                {usage ? formatCurrency(usage.usageLastMonth, usage.currency) : "—"}
              </p>
            )}
          </div>
        </div>

        <div className="bg-card border border-card-border rounded-md p-4" data-testid="panel-usage-chart">
          <h2 className="text-sm font-semibold text-foreground mb-4">Token Usage — Last 7 Days</h2>
          {dailyLoading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : !daily?.length ? (
            <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">No data available</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={daily} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  tickFormatter={(v) => {
                    try { return format(new Date(v), "d MMM"); } catch { return v; }
                  }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  tickFormatter={formatTokens}
                  width={45}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--popover-border))",
                    borderRadius: "6px",
                    fontSize: 12,
                    color: "hsl(var(--popover-foreground))",
                  }}
                  formatter={(v: number, name: string) => [formatTokens(v), name === "inputTokens" ? "Input" : "Output"]}
                  labelFormatter={(l) => { try { return format(new Date(l), "d MMMM yyyy"); } catch { return l; } }}
                />
                <Legend
                  formatter={(value) => value === "inputTokens" ? "Input Tokens" : "Output Tokens"}
                  wrapperStyle={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}
                />
                <Bar dataKey="inputTokens" fill="hsl(var(--chart-1))" radius={[3, 3, 0, 0]} />
                <Bar dataKey="outputTokens" fill="hsl(var(--chart-2))" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-card border border-card-border rounded-md" data-testid="panel-recent-activity">
          <div className="px-4 py-3 border-b border-card-border">
            <h2 className="text-sm font-semibold text-foreground">Recent Activity</h2>
          </div>
          {recentLoading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 rounded" />)}
            </div>
          ) : !recent?.length ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">No recent activity</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-card-border bg-muted/30">
                    <th className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium">Date</th>
                    <th className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium">Model</th>
                    <th className="text-right px-4 py-2.5 text-xs text-muted-foreground font-medium">Input Tokens</th>
                    <th className="text-right px-4 py-2.5 text-xs text-muted-foreground font-medium">Output Tokens</th>
                    <th className="text-right px-4 py-2.5 text-xs text-muted-foreground font-medium">Est. Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.slice(0, 20).map((call, i) => (
                    <tr
                      key={call.id}
                      className={`border-b border-card-border last:border-0 ${i % 2 === 0 ? "" : "bg-muted/20"}`}
                      data-testid={`row-ai-call-${call.id}`}
                    >
                      <td className="px-4 py-2.5 text-muted-foreground text-xs">
                        {(() => { try { return format(new Date(call.date), "d MMM yyyy, HH:mm"); } catch { return call.date; } })()}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-foreground">{call.model}</td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground">{call.inputTokens.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground">{call.outputTokens.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right text-foreground font-medium text-xs">{formatCurrency(call.estimatedCost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
