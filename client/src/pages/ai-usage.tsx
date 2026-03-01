import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import { AlertCircle, Loader2, CreditCard, Activity, Clock, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import type { AiUsageData, AiDailyUsage, AiRecentCall } from "@shared/schema";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(amount);
}

function formatTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return n.toString();
}

export default function AiUsagePage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editingBalance, setEditingBalance] = useState(false);
  const [balanceInput, setBalanceInput] = useState("");

  const { data: usage, isLoading: usageLoading, error: usageError } = useQuery<AiUsageData>({
    queryKey: ["/ai/usage"],
    queryFn: () => apiRequest<AiUsageData>("GET", "/ai/usage"),
    staleTime: 60_000,
  });

  const { data: daily, isLoading: dailyLoading } = useQuery<AiDailyUsage[]>({
    queryKey: ["/ai/usage/daily"],
    queryFn: () => apiRequest<AiDailyUsage[]>("GET", "/ai/usage/daily?days=7"),
    staleTime: 60_000,
  });

  const { data: recent, isLoading: recentLoading } = useQuery<AiRecentCall[]>({
    queryKey: ["/ai/usage/recent"],
    queryFn: () => apiRequest<AiRecentCall[]>("GET", "/ai/usage/recent?limit=20"),
    staleTime: 60_000,
  });

  const balanceMutation = useMutation({
    mutationFn: (balance_usd: number) => apiRequest("PATCH", "/ai/usage/balance", { balance_usd }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/ai/usage"] });
      toast({ title: "Balance updated" });
      setEditingBalance(false);
    },
    onError: (err: Error) => {
      toast({ title: "Failed to update balance", description: err.message, variant: "destructive" });
    },
  });

  const handleSaveBalance = () => {
    const val = parseFloat(balanceInput);
    if (isNaN(val) || val < 0) {
      toast({ title: "Enter a valid amount", variant: "destructive" });
      return;
    }
    balanceMutation.mutate(val);
  };

  const startEditBalance = () => {
    setBalanceInput(usage?.balance?.toFixed(2) ?? "0.00");
    setEditingBalance(true);
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-5 py-3 border-b border-border bg-background sticky top-0 z-10">
        <h1 className="text-base font-semibold text-foreground">AI Usage &amp; Billing</h1>
      </div>

      <div className="p-5 space-y-5 max-w-5xl">
        {usageError && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>Could not load AI usage data.</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-card border border-card-border rounded-md p-4" data-testid="panel-credit-balance">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Remaining Credit</span>
              </div>
              {!editingBalance && (
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={startEditBalance} data-testid="button-edit-balance">
                  <Pencil className="w-3 h-3" />
                </Button>
              )}
            </div>
            {usageLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : editingBalance ? (
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-foreground">$</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={balanceInput}
                  onChange={(e) => setBalanceInput(e.target.value)}
                  className="h-8 w-28 text-sm"
                  autoFocus
                  data-testid="input-balance"
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-emerald-500"
                  onClick={handleSaveBalance}
                  disabled={balanceMutation.isPending}
                  data-testid="button-save-balance"
                >
                  {balanceMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => setEditingBalance(false)}
                  data-testid="button-cancel-balance"
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            ) : (
              <p className="text-2xl font-bold text-foreground" data-testid="text-remaining-credit">
                {usage ? formatCurrency(usage.balance) : "—"}
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
            ) : usage ? (
              <div>
                <p className="text-2xl font-bold text-foreground" data-testid="text-usage-this-month">
                  {formatCurrency(usage.thisMonth.cost)}
                </p>
                <div className="flex gap-3 mt-1.5 text-xs text-muted-foreground">
                  <span>{usage.thisMonth.calls.toLocaleString()} calls</span>
                  <span>{formatTokens(usage.thisMonth.input + usage.thisMonth.output)} tokens</span>
                </div>
              </div>
            ) : (
              <p className="text-2xl font-bold text-foreground">—</p>
            )}
          </div>

          <div className="bg-card border border-card-border rounded-md p-4" data-testid="panel-usage-last-month">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Last Month</span>
            </div>
            {usageLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : usage ? (
              <div>
                <p className="text-2xl font-bold text-foreground" data-testid="text-usage-last-month">
                  {formatCurrency(usage.lastMonth.cost)}
                </p>
                <div className="flex gap-3 mt-1.5 text-xs text-muted-foreground">
                  <span>{usage.lastMonth.calls.toLocaleString()} calls</span>
                  <span>{formatTokens(usage.lastMonth.input + usage.lastMonth.output)} tokens</span>
                </div>
              </div>
            ) : (
              <p className="text-2xl font-bold text-foreground">—</p>
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
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
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
                  formatter={(v: number, name: string) => [formatTokens(v), name === "input_tokens" ? "Input" : "Output"]}
                  labelFormatter={(l) => l}
                />
                <Legend
                  formatter={(value) => value === "input_tokens" ? "Input Tokens" : "Output Tokens"}
                  wrapperStyle={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}
                />
                <Bar dataKey="input_tokens" fill="hsl(var(--chart-1))" radius={[3, 3, 0, 0]} />
                <Bar dataKey="output_tokens" fill="hsl(var(--chart-2))" radius={[3, 3, 0, 0]} />
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
                    <th className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((call, i) => (
                    <tr
                      key={i}
                      className={`border-b border-card-border last:border-0 ${i % 2 === 0 ? "" : "bg-muted/20"}`}
                      data-testid={`row-ai-call-${i}`}
                    >
                      <td className="px-4 py-2.5 text-muted-foreground text-xs whitespace-nowrap">
                        {(() => { try { return format(new Date(call.created_at), "d MMM yyyy, HH:mm"); } catch { return call.created_at; } })()}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-foreground">{call.model}</td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground">{call.input_tokens.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground">{call.output_tokens.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right text-foreground font-medium text-xs">{formatCurrency(call.cost_usd)}</td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">{call.source}</td>
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
