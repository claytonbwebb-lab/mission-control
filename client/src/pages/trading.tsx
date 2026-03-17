import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, TrendingUp, TrendingDown, DollarSign, Loader2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/auth";

interface Holding {
  symbol: string;
  qty: number;
  market_value: number;
  avg_entry: number;
  current_price: number;
  unrealized_pl: number;
  unrealized_plpc: string;
}

interface TradingStatus {
  equity: number;
  cash: number;
  initial: number;
  total_pl: number;
  total_pl_pct: string;
  holdings: Holding[];
  chart: { timestamps: number[]; equity: number[] };
}

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function TradingPage() {
  const qc = useQueryClient();
  const [rebalanceOutput, setRebalanceOutput] = useState<string | null>(null);

  const { data, isLoading, error, dataUpdatedAt } = useQuery<TradingStatus>({
    queryKey: ["/trading/status"],
    queryFn: () => apiRequest<TradingStatus>("GET", "/trading/status"),
    refetchInterval: 60000,
  });

  const rebalanceMutation = useMutation({
    mutationFn: () => apiRequest<{ success: boolean; output: string }>("POST", "/trading/rebalance"),
    onSuccess: (res) => {
      setRebalanceOutput(res.output);
      qc.invalidateQueries({ queryKey: ["/trading/status"] });
    },
  });

  const pl = data?.total_pl ?? 0;
  const plPct = parseFloat(data?.total_pl_pct ?? "0");
  const isUp = pl >= 0;

  return (
    <div className="h-full flex flex-col overflow-auto">
      <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-background">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-semibold text-foreground">Trading Dashboard</h1>
          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 font-medium">⚠️ Paper Trading</span>
        </div>
        <div className="flex items-center gap-2">
          {dataUpdatedAt > 0 && (
            <span className="text-xs text-muted-foreground/70">
              Updated: {new Date(dataUpdatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          <button
            onClick={() => qc.invalidateQueries({ queryKey: ["/trading/status"] })}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {isLoading && (
          <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading account data...
          </div>
        )}

        {error && (
          <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm">
            Failed to load trading data. Check the backend is running.
          </div>
        )}

        {data && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-card border border-border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground uppercase tracking-wide">Portfolio Value</span>
                </div>
                <div className="text-xl font-bold">${fmt(data.equity)}</div>
              </div>

              <div className="bg-card border border-border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground uppercase tracking-wide">Cash</span>
                </div>
                <div className="text-xl font-bold">${fmt(data.cash)}</div>
              </div>

              <div className={`bg-card border rounded-lg p-4 ${isUp ? "border-green-500/30" : "border-red-500/30"}`}>
                <div className="flex items-center gap-2 mb-1">
                  {isUp ? <TrendingUp className="w-3.5 h-3.5 text-green-500" /> : <TrendingDown className="w-3.5 h-3.5 text-red-500" />}
                  <span className="text-xs text-muted-foreground uppercase tracking-wide">Total P&L</span>
                </div>
                <div className={`text-xl font-bold ${isUp ? "text-green-500" : "text-red-500"}`}>
                  {isUp ? "+" : ""}${fmt(pl)}
                </div>
              </div>

              <div className={`bg-card border rounded-lg p-4 ${isUp ? "border-green-500/30" : "border-red-500/30"}`}>
                <div className="flex items-center gap-2 mb-1">
                  {isUp ? <TrendingUp className="w-3.5 h-3.5 text-green-500" /> : <TrendingDown className="w-3.5 h-3.5 text-red-500" />}
                  <span className="text-xs text-muted-foreground uppercase tracking-wide">Return %</span>
                </div>
                <div className={`text-xl font-bold ${isUp ? "text-green-500" : "text-red-500"}`}>
                  {isUp ? "+" : ""}{plPct}%
                </div>
              </div>
            </div>

            {/* Holdings */}
            <div className="bg-card border border-border rounded-lg">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <h2 className="text-sm font-semibold">Current Holdings</h2>
                <span className="text-xs text-muted-foreground">{data.holdings.length} positions</span>
              </div>
              {data.holdings.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No open positions. Next rebalance: Friday.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {data.holdings.map(h => {
                    const up = h.unrealized_pl >= 0;
                    return (
                      <div key={h.symbol} className="px-4 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                            {h.symbol.slice(0, 4)}
                          </div>
                          <div>
                            <div className="text-sm font-semibold">{h.symbol}</div>
                            <div className="text-xs text-muted-foreground">{h.qty.toFixed(4)} shares @ ${fmt(h.avg_entry)}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-semibold">${fmt(h.market_value)}</div>
                          <div className={`text-xs font-medium ${up ? "text-green-500" : "text-red-500"}`}>
                            {up ? "+" : ""}${fmt(h.unrealized_pl)} ({up ? "+" : ""}{h.unrealized_plpc}%)
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Strategy info */}
            <div className="bg-card border border-border rounded-lg p-4">
              <h2 className="text-sm font-semibold mb-2">Strategy</h2>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>📈 <strong>Momentum + Trend Following</strong> — weekly rebalance every Friday at 2:30pm UK</p>
                <p>🔍 Universe: 20 large-cap US stocks (S&amp;P 500)</p>
                <p>⚖️ Top 5 by 12-1 month momentum, above 200-day MA, equal weight (20% each)</p>
                <p>📊 Backtest (2022–2026): +137.9% vs SPY +48.1%</p>
              </div>
            </div>

            {/* Manual rebalance */}
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold">Manual Rebalance</h2>
                <span className="text-xs text-muted-foreground">Auto-runs every Friday</span>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Force a rebalance now — sells current positions and buys the top 5 momentum stocks.
              </p>
              <Button
                size="sm"
                onClick={() => { setRebalanceOutput(null); rebalanceMutation.mutate(); }}
                disabled={rebalanceMutation.isPending}
                className="gap-2"
              >
                {rebalanceMutation.isPending
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Rebalancing...</>
                  : <><Zap className="w-3.5 h-3.5" /> Run Rebalance Now</>
                }
              </Button>
              {rebalanceOutput && (
                <pre className="mt-3 text-xs bg-muted/50 rounded p-3 overflow-auto max-h-48 text-muted-foreground whitespace-pre-wrap">
                  {rebalanceOutput}
                </pre>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
