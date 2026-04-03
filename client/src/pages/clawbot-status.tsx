import { useQuery } from "@tanstack/react-query";
import { RefreshCw, Server, Calendar, MessageSquare, Shield, AlertTriangle, ChevronDown, ChevronUp, Database, Cpu } from "lucide-react";
import { useState } from "react";
import { apiRequest } from "@/lib/auth";

interface SecurityFinding {
  checkId: string;
  severity: "critical" | "warn" | "info";
  title: string;
  detail: string;
  remediation?: string;
}

interface ClawbotStatus {
  runtimeVersion: string;
  os: { label: string };
  gateway: { mode: string; url: string; reachable: boolean; error?: string };
  gatewayService: { label: string; runtimeShort: string };
  agents: { totalSessions: number; agents: { id: string; sessionsCount: number; lastActiveAgeMs: number }[] };
  heartbeat: { defaultAgentId: string; agents: { agentId: string; enabled: boolean; every: string }[] };
  channelSummary: string[];
  memory: { files: number; chunks: number; backend: string };
  securityAudit: {
    summary: { critical: number; warn: number; info: number };
    findings: SecurityFinding[];
  };
  update: { registry: { latestVersion: string } };
  sessions: {
    count: number;
    recent: { key: string; model: string; percentUsed: number | null; updatedAt: number; kind: string }[];
  };
}

const DISCORD_CHANNEL_NAMES: Record<string, string> = {
  "1489529875818745959": "mission-control",
  "1489530391818670160": "campsite-outreach",
  "1489549880656658452": "openclaw",
  "1489346950699421716": "world-cup-predictor",
};

function formatSessionKey(key: string): string {
  // discord:channel:<id> → #channel-name
  const discordMatch = key.match(/^discord:channel:(\d+)$/);
  if (discordMatch) {
    const name = DISCORD_CHANNEL_NAMES[discordMatch[1]];
    return name ? `#${name}` : `#${discordMatch[1]}`;
  }
  // telegram:<id> → telegram
  if (key.startsWith("telegram:")) return "telegram";
  // cron:<guid> → cron
  if (key.startsWith("cron:")) return "cron";
  // main
  if (key === "main") return "main";
  return key;
}

function severityColor(s: string) {
  if (s === "critical") return "text-red-500";
  if (s === "warn") return "text-yellow-500";
  return "text-blue-500";
}

function severityBg(s: string) {
  if (s === "critical") return "border-red-500/30 bg-red-500/5";
  if (s === "warn") return "border-yellow-500/30 bg-yellow-500/5";
  return "border-blue-500/30 bg-blue-500/5";
}

function msToRelative(ms: number) {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export default function ClawbotStatusPage() {
  const [expandedFinding, setExpandedFinding] = useState<string | null>(null);

  const { data, isLoading, error, refetch, dataUpdatedAt } = useQuery<ClawbotStatus>({
    queryKey: ["/clawbot/status"],
    queryFn: () => apiRequest<ClawbotStatus>("GET", "/clawbot/status"),
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="text-red-500">Failed to load status: {(error as Error).message}</div>
      </div>
    );
  }

  const lastUpdate = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : "N/A";
  const currentVersion = data?.runtimeVersion ?? "";
  const latestVersion = data?.update.registry.latestVersion ?? "";
  const updateAvailable = currentVersion !== latestVersion;

  return (
    <div className="p-6 space-y-6 overflow-auto h-full">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Server className="w-6 h-6" />
          Clawbot Status
        </h1>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Updated: {lastUpdate}</span>
          <RefreshCw className="w-3.5 h-3.5 cursor-pointer hover:text-foreground" onClick={() => refetch()} />
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 border rounded-lg">
          <div className="text-xs text-muted-foreground mb-1">Runtime</div>
          <div className="font-mono text-sm">{data?.runtimeVersion}</div>
          {updateAvailable && (
            <div className="text-xs text-yellow-500 mt-1">→ {latestVersion} available</div>
          )}
        </div>
        <div className="p-4 border rounded-lg">
          <div className="text-xs text-muted-foreground mb-1">OS</div>
          <div className="font-mono text-xs truncate">{data?.os.label}</div>
        </div>
        <div className="p-4 border rounded-lg">
          <div className="text-xs text-muted-foreground mb-1">Sessions</div>
          <div className="font-mono text-sm">{data?.agents.totalSessions}</div>
        </div>
        <div className="p-4 border rounded-lg">
          <div className="text-xs text-muted-foreground mb-1">Gateway</div>
          <div className="font-mono text-sm">{data?.gateway.mode}</div>
          <div className={`text-xs mt-1 ${data?.gateway.reachable ? "text-green-500" : "text-red-400"}`}>
            {data?.gateway.reachable ? "reachable" : data?.gateway.error ?? "unreachable"}
          </div>
        </div>
      </div>

      {/* Security Audit */}
      <div className="border rounded-lg p-4">
        <h2 className="text-sm font-semibold flex items-center gap-2 mb-3">
          <Shield className="w-4 h-4" />
          Security Audit
          <span className="ml-auto flex gap-3 text-sm">
            <span className="text-red-500">{data?.securityAudit?.summary?.critical ?? '—'} critical</span>
            <span className="text-yellow-500">{data?.securityAudit?.summary?.warn ?? '—'} warn</span>
            <span className="text-blue-500">{data?.securityAudit?.summary?.info ?? '—'} info</span>
          </span>
        </h2>
        <div className="space-y-2">
          {!data?.securityAudit && <p className="text-xs text-muted-foreground">Security audit not available in this runtime version.</p>}
          {data?.securityAudit?.findings?.map((f) => (
            <div key={f.checkId} className={`border rounded p-3 ${severityBg(f.severity)}`}>
              <button
                className="w-full text-left flex items-start justify-between gap-2"
                onClick={() => setExpandedFinding(expandedFinding === f.checkId ? null : f.checkId)}
              >
                <div>
                  <span className={`text-xs font-bold uppercase mr-2 ${severityColor(f.severity)}`}>{f.severity}</span>
                  <span className="text-sm">{f.title}</span>
                </div>
                {expandedFinding === f.checkId ? <ChevronUp className="w-4 h-4 shrink-0 mt-0.5" /> : <ChevronDown className="w-4 h-4 shrink-0 mt-0.5" />}
              </button>
              {expandedFinding === f.checkId && (
                <div className="mt-2 space-y-2">
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap">{f.detail}</p>
                  {f.remediation && (
                    <div className="text-xs border-t border-border pt-2">
                      <span className="font-semibold">Remediation: </span>{f.remediation}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Channels */}
      <div className="border rounded-lg p-4">
        <h2 className="text-sm font-semibold flex items-center gap-2 mb-3">
          <MessageSquare className="w-4 h-4" />
          Channels
        </h2>
        {data?.channelSummary && data.channelSummary.length > 0 ? (
          <div className="space-y-0.5 text-sm font-mono">
            {data.channelSummary.map((line, i) => (
              <div key={i} className={line.startsWith("  ") ? "text-muted-foreground pl-4 text-xs" : ""}>{line}</div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">No channels configured</div>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Gateway & Service */}
        <div className="border rounded-lg p-4">
          <h2 className="text-sm font-semibold flex items-center gap-2 mb-3">
            <Server className="w-4 h-4" />
            Gateway
          </h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">URL</span>
              <span className="font-mono text-xs">{data?.gateway.url}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Service</span>
              <span className="font-mono text-xs">{data?.gatewayService.runtimeShort}</span>
            </div>
          </div>
        </div>

        {/* Heartbeat */}
        <div className="border rounded-lg p-4">
          <h2 className="text-sm font-semibold flex items-center gap-2 mb-3">
            <Calendar className="w-4 h-4" />
            Heartbeat
          </h2>
          <div className="space-y-2 text-sm">
            {data?.heartbeat.agents.map((h) => (
              <div key={h.agentId} className="flex justify-between">
                <span className="text-muted-foreground">{h.agentId}</span>
                <span className={h.enabled ? "text-green-500" : "text-red-500"}>
                  {h.enabled ? `✓ every ${h.every}` : "disabled"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Memory */}
      <div className="border rounded-lg p-4">
        <h2 className="text-sm font-semibold flex items-center gap-2 mb-3">
          <Database className="w-4 h-4" />
          Memory
        </h2>
        <div className="flex gap-6 text-sm">
          <div><span className="text-muted-foreground">Backend: </span>{data?.memory?.backend ?? '—'}</div>
          <div><span className="text-muted-foreground">Files: </span>{data?.memory?.files ?? '—'}</div>
          <div><span className="text-muted-foreground">Chunks: </span>{data?.memory?.chunks ?? '—'}</div>
        </div>
      </div>

      {/* Recent Sessions */}
      {data?.sessions?.recent && (
        <div className="border rounded-lg p-4">
          <h2 className="text-sm font-semibold flex items-center gap-2 mb-3">
            <Cpu className="w-4 h-4" />
            Recent Sessions
          </h2>
          <div className="space-y-1">
            {data?.sessions?.recent?.slice(0, 6).map((s, i) => (
              <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-border last:border-0">
                <span className="font-mono text-muted-foreground truncate max-w-[50%]">{formatSessionKey(s.key.replace("agent:main:", ""))}</span>
                <div className="flex gap-3 shrink-0">
                  <span className="text-muted-foreground">{s.model?.split("/").pop()}</span>
                  {s.percentUsed !== null && (
                    <span className={s.percentUsed > 80 ? "text-red-500" : "text-muted-foreground"}>{s.percentUsed}%</span>
                  )}
                  <span className="text-muted-foreground">{msToRelative(s.updatedAt ? Date.now() - s.updatedAt : 0)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
