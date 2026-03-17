import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Mail, Users, CheckCircle2, ArrowLeft, Loader2, Play, Pause, ChevronRight, Send, X } from "lucide-react";
import { apiRequest } from "@/lib/auth";

interface Campaign {
  id: string;
  name: string;
  active: boolean;
  product: string;
  target: string;
  total_leads: number;
  contacted: number;
  emails_sent: number;
  completed_sequence: number;
  email_count: number;
  paused_reason?: string;
}

interface CampaignEmail {
  step: number;
  subject: string;
  preview: string;
  body?: string;
}

interface CampaignDetail extends Campaign {
  emails: CampaignEmail[];
  by_step?: Record<string, number>;
  by_status?: Record<string, number>;
  daily_limit?: number;
  last_sent?: string;
  error?: string;
}

function EmailModal({ email, onClose }: { email: CampaignEmail; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg bg-background border border-border rounded-t-2xl sm:rounded-xl shadow-xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-start justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="pr-8">
            <div className="text-xs text-muted-foreground mb-0.5">Email {email.step}</div>
            <div className="text-sm font-semibold leading-snug">{email.subject}</div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
        {/* Body */}
        <div className="overflow-y-auto p-4">
          <pre className="text-sm text-foreground whitespace-pre-wrap font-sans leading-relaxed">
            {email.body || email.preview}
          </pre>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, icon }: { label: string; value: string | number; sub?: string; icon: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-xs text-muted-foreground uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-xl font-bold">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

function CampaignDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const [openEmail, setOpenEmail] = useState<CampaignEmail | null>(null);

  const { data, isLoading } = useQuery<CampaignDetail>({
    queryKey: [`/campaigns/${id}`],
    queryFn: () => apiRequest<CampaignDetail>("GET", `/campaigns/${id}`),
  });

  if (isLoading) return (
    <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
      <Loader2 className="w-5 h-5 animate-spin" /> Loading...
    </div>
  );

  if (!data) return null;



  const pct = data.total_leads > 0 ? Math.round((data.contacted / data.total_leads) * 100) : 0;

  return (
    <div className="space-y-5">
      {openEmail && <EmailModal email={openEmail} onClose={() => setOpenEmail(null)} />}
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h2 className="text-base font-semibold">{data.name}</h2>
          <p className="text-xs text-muted-foreground">{data.target}</p>
        </div>
        <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${data.active ? "bg-green-500/15 text-green-600" : "bg-amber-500/15 text-amber-600"}`}>
          {data.active ? "● Active" : "⏸ Paused"}
        </span>
      </div>

      {data.paused_reason && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-md text-xs text-amber-700">{data.paused_reason}</div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total Leads" value={data.total_leads} icon={<Users className="w-3.5 h-3.5" />} />
        <StatCard label="Contacted" value={data.contacted} sub={`${pct}% of list`} icon={<Send className="w-3.5 h-3.5" />} />
        <StatCard label="Emails Sent" value={data.emails_sent} sub={data.daily_limit ? `${data.daily_limit}/day limit` : undefined} icon={<Mail className="w-3.5 h-3.5" />} />
        <StatCard label="Completed" value={data.completed_sequence ?? 0} sub="Full sequence" icon={<CheckCircle2 className="w-3.5 h-3.5" />} />
      </div>

      {/* Progress bar */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium">List Progress</span>
          <span className="text-xs text-muted-foreground">{data.contacted} / {data.total_leads} leads contacted</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <span>{pct}% contacted</span>
          <span>{data.total_leads - data.contacted} remaining</span>
        </div>
      </div>

      {/* By step breakdown */}
      {data.by_step && (
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-sm font-semibold mb-3">Sends by Email Step</h3>
          <div className="space-y-1.5">
            {Object.entries(data.by_step).sort((a,b) => Number(a[0])-Number(b[0])).map(([step, count]) => {
              const email = data.emails?.find(e => e.step === Number(step));
              return (
                <div key={step} className="flex items-center gap-3 text-xs">
                  <span className="w-16 shrink-0 text-muted-foreground">Email {step}</span>
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary/60 rounded-full" style={{ width: `${Math.min(100, (count / data.emails_sent) * 100)}%` }} />
                  </div>
                  <span className="w-8 text-right font-medium">{count}</span>
                  {email && <span className="text-muted-foreground truncate max-w-[200px]">{email.subject}</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* By status (campsite) */}
      {data.by_status && (
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="text-sm font-semibold mb-3">Leads by Status</h3>
          <div className="space-y-1.5">
            {Object.entries(data.by_status).sort((a,b) => b[1]-a[1]).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between text-xs">
                <span className="capitalize text-muted-foreground">{status.replace(/_/g, ' ')}</span>
                <span className="font-medium">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Email sequence */}
      <div className="bg-card border border-border rounded-lg">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold">Email Sequence ({data.email_count} emails)</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Tap any email to read the full template</p>
        </div>
        <div className="divide-y divide-border">
          {(data.emails || []).map((email, i) => (
            <button
              key={email.step}
              onClick={() => setOpenEmail(email)}
              className="w-full px-4 py-3 text-left hover:bg-muted/30 transition-colors group"
            >
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0 mt-0.5">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium group-hover:text-primary transition-colors">{email.subject}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 truncate">{email.preview}</div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-1 group-hover:text-foreground" />
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function CampaignsPage() {
  const [selected, setSelected] = useState<string | null>(null);

  const { data: campaigns, isLoading } = useQuery<Campaign[]>({
    queryKey: ["/campaigns"],
    queryFn: () => apiRequest<Campaign[]>("GET", "/campaigns"),
  });

  return (
    <div className="h-full flex flex-col overflow-auto">
      <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-background">
        <h1 className="text-base font-semibold text-foreground">Outreach Campaigns</h1>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {campaigns ? `${campaigns.filter(c => c.active).length} active` : ""}
          </span>
        </div>
      </div>

      <div className="p-5">
        {isLoading && (
          <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading campaigns...
          </div>
        )}

        {selected ? (
          <CampaignDetail id={selected} onBack={() => setSelected(null)} />
        ) : (
          <div className="space-y-3">
            {(campaigns || []).map(c => {
              const pct = c.total_leads > 0 ? Math.round((c.contacted / c.total_leads) * 100) : 0;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelected(c.id)}
                  className="w-full bg-card border border-border rounded-lg p-4 text-left hover:bg-muted/30 transition-colors group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold truncate">{c.name}</span>
                        <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded-full font-medium ${c.active ? "bg-green-500/15 text-green-600" : "bg-amber-500/15 text-amber-600"}`}>
                          {c.active ? <><Play className="w-2.5 h-2.5 inline mr-0.5" />Active</> : <><Pause className="w-2.5 h-2.5 inline mr-0.5" />Paused</>}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mb-3">{c.target}</p>
                      <div className="grid grid-cols-3 gap-4 mb-3">
                        <div>
                          <div className="text-lg font-bold">{c.total_leads}</div>
                          <div className="text-xs text-muted-foreground">Total leads</div>
                        </div>
                        <div>
                          <div className="text-lg font-bold">{c.emails_sent}</div>
                          <div className="text-xs text-muted-foreground">Emails sent</div>
                        </div>
                        <div>
                          <div className="text-lg font-bold">{c.email_count}</div>
                          <div className="text-xs text-muted-foreground">Step sequence</div>
                        </div>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">{pct}% of list contacted</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-1 group-hover:text-foreground transition-colors" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
