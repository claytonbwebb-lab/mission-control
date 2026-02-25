import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  RefreshCw, AlertCircle, Clock, CheckCircle2, XCircle,
  Loader2, Timer
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

interface CronJobState {
  nextRunAtMs?: number;
  lastRunAtMs?: number;
  lastRunStatus?: string;
}

interface CronJobDelivery {
  channel?: string;
  recipient?: string;
}

interface CronJob {
  id: string;
  name: string;
  enabled: boolean;
  cron: string;
  timezone?: string;
  state?: CronJobState;
  delivery?: CronJobDelivery;
}

function cronToHuman(expr: string): string {
  const parts = expr.trim().split(/\s+/);
  if (parts.length < 5) return expr;
  const [min, hour, dom, mon, dow] = parts;

  const dowNames: Record<string, string> = { "0": "Sun", "1": "Mon", "2": "Tue", "3": "Wed", "4": "Thu", "5": "Fri", "6": "Sat", "7": "Sun" };

  let timeStr = "";
  if (hour !== "*" && min !== "*") {
    timeStr = `at ${hour.padStart(2, "0")}:${min.padStart(2, "0")}`;
  } else if (hour !== "*") {
    timeStr = `at hour ${hour}`;
  } else {
    timeStr = `every minute`;
  }

  let dayStr = "";
  if (dow !== "*" && dow !== "?") {
    const days = dow.split(",").map(d => dowNames[d] ?? d).join(", ");
    dayStr = `on ${days}`;
  }
  if (dom !== "*" && dom !== "?") {
    dayStr = `on day ${dom}`;
  }

  let monStr = "";
  if (mon !== "*") {
    monStr = `in month ${mon}`;
  }

  return [timeStr, dayStr, monStr].filter(Boolean).join(" ");
}

function formatMs(ms?: number): string {
  if (!ms) return "-";
  try {
    return format(new Date(ms), "d MMM yyyy, HH:mm:ss");
  } catch {
    return "-";
  }
}

function normalizeJob(raw: Record<string, unknown>): CronJob {
  const state = (raw.state ?? {}) as Record<string, unknown>;
  const delivery = (raw.delivery ?? {}) as Record<string, unknown>;
  return {
    id: String(raw.id ?? raw._id ?? raw.name ?? ""),
    name: String(raw.name ?? ""),
    enabled: Boolean(raw.enabled ?? true),
    cron: String(raw.cron ?? raw.schedule ?? raw.expression ?? ""),
    timezone: String(raw.timezone ?? raw.tz ?? ""),
    state: {
      nextRunAtMs: (state.nextRunAtMs ?? state.next_run_at_ms) as number | undefined,
      lastRunAtMs: (state.lastRunAtMs ?? state.last_run_at_ms) as number | undefined,
      lastRunStatus: String(state.lastRunStatus ?? state.last_run_status ?? ""),
    },
    delivery: {
      channel: String(delivery.channel ?? ""),
      recipient: String(delivery.recipient ?? delivery.target ?? ""),
    },
  };
}

export default function CronJobsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [refreshing, setRefreshing] = useState(false);

  const { data: jobs, isLoading, error } = useQuery<CronJob[]>({
    queryKey: ["/cron/jobs"],
    queryFn: async () => {
      const raw = await apiRequest<Record<string, unknown>[]>("GET", "/cron/jobs");
      return (Array.isArray(raw) ? raw : []).map(normalizeJob);
    },
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await qc.invalidateQueries({ queryKey: ["/cron/jobs"] });
    toast({ title: "Refreshed" });
    setRefreshing(false);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-5 py-3 border-b border-border bg-background">
        <div className="flex items-center justify-between">
          <h1 className="text-base font-semibold text-foreground">Cron Jobs</h1>
          <Button
            size="sm"
            variant="secondary"
            onClick={handleRefresh}
            disabled={refreshing || isLoading}
            data-testid="button-refresh-cron"
          >
            {refreshing || isLoading ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1" />}
            Refresh
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-5">
        {error && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm mb-4">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>Failed to load cron jobs: {(error as Error).message}</span>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-md" />)}
          </div>
        ) : !jobs?.length && !error ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Timer className="w-10 h-10 mb-3 opacity-40" />
            <p className="text-sm">No cron jobs found</p>
          </div>
        ) : jobs?.length ? (
          <div className="border border-border rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium">Status</th>
                  <th className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium">Name</th>
                  <th className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium">Schedule</th>
                  <th className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium">Next Run</th>
                  <th className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium">Last Run</th>
                  <th className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium">Delivery</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job, i) => {
                  const lastStatus = job.state?.lastRunStatus;
                  const isSuccess = lastStatus === "success" || lastStatus === "ok";
                  const isFailed = lastStatus === "failed" || lastStatus === "error";
                  return (
                    <tr
                      key={job.id || i}
                      className={`border-b border-border last:border-0 ${!job.enabled ? "opacity-50" : ""} ${i % 2 === 0 ? "" : "bg-muted/20"}`}
                      data-testid={`row-cron-${job.id}`}
                    >
                      <td className="px-4 py-3">
                        {job.enabled ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/15 text-emerald-500 dark:text-emerald-300" data-testid={`badge-enabled-${job.id}`}>
                            Enabled
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-500/15 text-amber-500 dark:text-amber-300" data-testid={`badge-disabled-${job.id}`}>
                            Disabled
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground">{job.name}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-0.5">
                          <code className="text-xs font-mono text-muted-foreground">{job.cron}</code>
                          <span className="text-xs text-muted-foreground">{cronToHuman(job.cron)}</span>
                          {job.timezone && (
                            <span className="text-xs text-muted-foreground/60">{job.timezone}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3 flex-shrink-0" />
                          <span>{formatMs(job.state?.nextRunAtMs)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5 text-xs">
                            {isSuccess && <CheckCircle2 className="w-3 h-3 text-emerald-500 flex-shrink-0" />}
                            {isFailed && <XCircle className="w-3 h-3 text-destructive flex-shrink-0" />}
                            {!isSuccess && !isFailed && lastStatus && <Clock className="w-3 h-3 text-muted-foreground flex-shrink-0" />}
                            <span className={`font-medium ${isSuccess ? "text-emerald-500 dark:text-emerald-300" : isFailed ? "text-destructive" : "text-muted-foreground"}`}>
                              {lastStatus || "-"}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground">{formatMs(job.state?.lastRunAtMs)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {(job.delivery?.channel || job.delivery?.recipient) ? (
                          <div className="flex flex-col gap-0.5">
                            {job.delivery.channel && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground capitalize">
                                {job.delivery.channel}
                              </span>
                            )}
                            {job.delivery.recipient && (
                              <span className="text-xs text-muted-foreground truncate max-w-32" title={job.delivery.recipient}>
                                {job.delivery.recipient}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
}
