import { useQuery } from "@tanstack/react-query";
import { RefreshCw, Server, Cpu, MemoryStick, Calendar, MessageSquare, Shield, AlertTriangle } from "lucide-react";
import { apiRequest } from "@/lib/auth";

interface ClawbotStatus {
  runtimeVersion: string;
  os: { label: string };
  gateway: { mode: string; url: string };
  gatewayService: { label: string; runtimeShort: string };
  agents: { totalSessions: number; agents: { id: string; sessionsCount: number }[] };
  heartbeat: { defaultAgentId: string; agents: { agentId: string; enabled: boolean; every: string }[] };
  channelSummary: { channel: string; config: string }[];
  memory: { files: number; chunks: number };
  securityAudit: { summary: { critical: number; warn: number; info: number } };
  update: { registry: { latestVersion: string } };
}

export default function ClawbotStatusPage() {
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

  return (
    <div className="p-6 space-y-6 overflow-auto h-full">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Server className="w-6 h-6" />
          Clawbot Status
        </h1>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Last updated: {lastUpdate}</span>
          <RefreshCw className="w-4 h-4 cursor-pointer" onClick={() => refetch()} />
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 border rounded-lg">
          <div className="text-xs text-muted-foreground">Runtime</div>
          <div className="font-mono text-sm">{data?.runtimeVersion}</div>
        </div>
        <div className="p-4 border rounded-lg">
          <div className="text-xs text-muted-foreground">OS</div>
          <div className="font-mono text-sm truncate">{data?.os.label}</div>
        </div>
        <div className="p-4 border rounded-lg">
          <div className="text-xs text-muted-foreground">Sessions</div>
          <div className="font-mono text-sm">{data?.agents.totalSessions}</div>
        </div>
        <div className="p-4 border rounded-lg">
          <div className="text-xs text-muted-foreground">Gateway</div>
          <div className="font-mono text-sm">{data?.gateway.mode}</div>
        </div>
      </div>

      {/* Security */}
      {data?.securityAudit && (
        <div className="border rounded-lg p-4">
          <h2 className="text-sm font-semibold flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4" />
            Security Audit
          </h2>
          <div className="flex gap-4 text-sm">
            <span className="text-red-500">Critical: {data.securityAudit.summary.critical}</span>
            <span className="text-yellow-500">Warn: {data.securityAudit.summary.warn}</span>
            <span className="text-blue-500">Info: {data.securityAudit.summary.info}</span>
          </div>
        </div>
      )}

      {/* Gateway & Service */}
      <div className="grid md:grid-cols-2 gap-4">
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

        <div className="border rounded-lg p-4">
          <h2 className="text-sm font-semibold flex items-center gap-2 mb-3">
            <Calendar className="w-4 h-4" />
            Heartbeat
          </h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Agent</span>
              <span>{data?.heartbeat.defaultAgentId}</span>
            </div>
            {data?.heartbeat.agents.map((h) => (
              <div key={h.agentId} className="flex justify-between">
                <span className="text-muted-foreground">{h.agentId}</span>
                <span className={h.enabled ? "text-green-500" : "text-red-500"}>
                  {h.enabled ? "enabled" : "disabled"} ({h.every})
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Channels */}
      <div className="border rounded-lg p-4">
        <h2 className="text-sm font-semibold flex items-center gap-2 mb-3">
          <MessageSquare className="w-4 h-4" />
          Channels
        </h2>
        <div className="space-y-1 text-sm font-mono">
          {data?.channelSummary.map((ch, i) => (
            <div key={i}>{ch.channel}: {ch.config}</div>
          ))}
        </div>
      </div>

      {/* Update */}
      <div className="border rounded-lg p-4">
        <h2 className="text-sm font-semibold flex items-center gap-2 mb-3">
          <AlertTriangle className="w-4 h-4" />
          Updates
        </h2>
        <div className="text-sm">
          Current: <span className="font-mono">{data?.runtimeVersion}</span> → Latest:{" "}
          <span className="font-mono">{data?.update.registry.latestVersion}</span>
        </div>
      </div>
    </div>
  );
}