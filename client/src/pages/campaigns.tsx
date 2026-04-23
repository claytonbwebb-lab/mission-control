import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Download, Search, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { apiRequest } from "@/lib/auth";

interface Stats {
  total: number;
  new: number;
  demo_built: number;
  cancelled: number;
  unqualified: number;
  qm_synced: number;
  not_synced: number;
}

interface Lead {
  id: number;
  site_name: string;
  website: string;
  email: string;
  region: string;
  status: string;
  demo_url: string | null;
  qm_synced: number;
  email1_sent_at: number | null;
  email2_sent_at: number | null;
  created_at: number;
}

interface LeadsResponse {
  leads: Lead[];
  total: number;
  page: number;
  pages: number;
}

const STATUS_COLOURS: Record<string, string> = {
  new:          "bg-blue-500/15 text-blue-600",
  demo_built:   "bg-green-500/15 text-green-600",
  cancelled:    "bg-red-500/15 text-red-600",
  unqualified:  "bg-amber-500/15 text-amber-600",
};

function StatCard({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{label}</div>
      <div className="text-2xl font-bold">{value.toLocaleString()}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

export default function CampaignsPage() {
  const [status, setStatus]     = useState("");
  const [synced, setSynced]     = useState("");
  const [search, setSearch]     = useState("");
  const [page, setPage]         = useState(1);

  const { data: stats } = useQuery<Stats>({
    queryKey: ["/api/campsite/stats"],
    queryFn: () => apiRequest<Stats>("GET", "/campsite/stats"),
  });

  const { data: leads, isLoading } = useQuery<LeadsResponse>({
    queryKey: ["/api/campsite/leads", status, synced, search, page],
    queryFn: () => {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (synced) params.set("qm_synced", synced);
      if (search) params.set("search", search);
      params.set("page", String(page));
      params.set("limit", "50");
      return apiRequest<LeadsResponse>("GET", `/campsite/leads?${params}`);
    },
  });

  function handleExport() {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (synced) params.set("qm_synced", synced);
    if (search) params.set("search", search);
    const token = localStorage.getItem("mc_token") || sessionStorage.getItem("mc_token") || "";
    const url = `/api/campsite/leads/export?${params}`;
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "campsite-leads.csv";
        a.click();
      });
  }

  function resetFilters() {
    setStatus(""); setSynced(""); setSearch(""); setPage(1);
  }

  const from = leads ? (leads.page - 1) * 50 + 1 : 0;
  const to   = leads ? Math.min(leads.page * 50, leads.total) : 0;

  return (
    <div className="h-full flex flex-col overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-background shrink-0">
        <div>
          <h1 className="text-base font-semibold text-foreground">Campsite Campaign</h1>
          <p className="text-xs text-muted-foreground">CampBook outreach — UK campsites</p>
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-500/15 text-green-600">● Active</span>
      </div>

      <div className="p-5 space-y-5">
        {/* Stats */}
        {stats ? (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <StatCard label="Total Scraped" value={stats.total} />
            <StatCard label="Demo Built"    value={stats.demo_built} sub={`${Math.round(stats.demo_built / stats.total * 100)}% of total`} />
            <StatCard label="QM Synced"     value={stats.qm_synced} sub={`${stats.not_synced} not uploaded`} />
            <StatCard label="Remaining"     value={stats.new} sub="No demo yet" />
            <StatCard label="Cancelled"     value={stats.cancelled} />
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[...Array(5)].map((_, i) => <div key={i} className="bg-card border border-border rounded-lg p-4 h-20 animate-pulse" />)}
          </div>
        )}

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search site or email..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="pl-8 pr-3 py-1.5 text-sm bg-background border border-border rounded-md w-52 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <select
            value={status}
            onChange={e => { setStatus(e.target.value); setPage(1); }}
            className="py-1.5 px-2.5 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">All Statuses</option>
            <option value="new">New</option>
            <option value="demo_built">Demo Built</option>
            <option value="cancelled">Cancelled</option>
            <option value="unqualified">Unqualified</option>
          </select>
          <select
            value={synced}
            onChange={e => { setSynced(e.target.value); setPage(1); }}
            className="py-1.5 px-2.5 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">All QM Status</option>
            <option value="1">Synced to QM</option>
            <option value="0">Not Synced</option>
          </select>
          {(status || synced || search) && (
            <button onClick={resetFilters} className="text-xs text-muted-foreground hover:text-foreground underline">Clear</button>
          )}
          <div className="ml-auto">
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
              <Loader2 className="w-5 h-5 animate-spin" /> Loading leads...
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30 text-xs text-muted-foreground">
                      <th className="text-left px-4 py-2.5 font-medium">Site Name</th>
                      <th className="text-left px-4 py-2.5 font-medium">Email</th>
                      <th className="text-left px-4 py-2.5 font-medium">Region</th>
                      <th className="text-left px-4 py-2.5 font-medium">Status</th>
                      <th className="text-center px-4 py-2.5 font-medium">QM</th>
                      <th className="text-center px-4 py-2.5 font-medium">Demo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {(leads?.leads || []).map(lead => (
                      <tr key={lead.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-foreground truncate max-w-[200px]">{lead.site_name}</span>
                            {lead.website && (
                              <a href={lead.website} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground shrink-0">
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground text-xs">{lead.email}</td>
                        <td className="px-4 py-2.5 text-muted-foreground text-xs">{lead.region}</td>
                        <td className="px-4 py-2.5">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOURS[lead.status] || "bg-muted text-muted-foreground"}`}>
                            {lead.status.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {lead.qm_synced ? (
                            <span className="text-green-500 font-bold">✓</span>
                          ) : (
                            <span className="text-muted-foreground">–</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <div className="flex items-center justify-center gap-2">
                            {lead.demo_url ? (
                              <a href={lead.demo_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80" title="View demo">
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            ) : (
                              <span className="text-muted-foreground text-xs">–</span>
                            )}
                            {lead.website && (
                              <a href={lead.website} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground" title="Visit website">
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {leads?.leads.length === 0 && (
                      <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground text-sm">No leads match your filters</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {leads && leads.pages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/20 text-xs text-muted-foreground">
                  <span>Showing {from}–{to} of {leads.total.toLocaleString()}</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="p-1 rounded hover:bg-muted disabled:opacity-30"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="px-2">Page {page} of {leads.pages}</span>
                    <button
                      onClick={() => setPage(p => Math.min(leads.pages, p + 1))}
                      disabled={page === leads.pages}
                      className="p-1 rounded hover:bg-muted disabled:opacity-30"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
