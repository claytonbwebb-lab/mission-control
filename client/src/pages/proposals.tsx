import { useState } from "react";
import { Link2, ExternalLink, Building2, User, PoundSterling, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Proposal {
  id: string;
  client: string;
  business: string;
  url: string;
  status: "draft" | "sent" | "accepted" | "rejected";
  value?: string;
  notes?: string;
  sentDate?: string;
  acceptedDate?: string;
  created: string;
}

const proposals: Proposal[] = [
  {
    id: "kingswood",
    client: "Dave Barron",
    business: "Kingswood Appliance Repairs",
    url: "https://proposals.brightstacklabs.co.uk/client/kingswood",
    status: "accepted",
    value: "£750 one-off",
    notes: "50% deposit paid (£375)",
    created: "2026-03-06",
  },
  {
    id: "autotech",
    client: "Stewart Oates",
    business: "Auto Tech Services",
    url: "https://proposals.brightstacklabs.co.uk/client/autotech-garage",
    status: "sent",
    value: "£750+",
    notes: "Website £750, +£275/mo management, +£29/mo AI receptionist",
    created: "2026-03-24",
  },
  {
    id: "berry",
    client: "Craig Berry",
    business: "Berry Bespoke Joinery",
    url: "https://proposals.brightstacklabs.co.uk/client/berry-bespoke-joinery",
    status: "accepted",
    value: "£750 one-off",
    notes: "£750 one-off or £39/mo | Agreed via WhatsApp",
    sentDate: "2026-03-22",
    acceptedDate: "2026-03-23",
    created: "2026-03-22",
  },
];

function getStatusColor(status: Proposal["status"]) {
  switch (status) {
    case "accepted": return "bg-green-500/20 text-green-400 border-green-500/30";
    case "sent": return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    case "draft": return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    case "rejected": return "bg-red-500/20 text-red-400 border-red-500/30";
    default: return "bg-gray-500/20 text-gray-400";
  }
}

export default function ProposalsPage() {
  const [refreshing, setRefreshing] = useState(false);

  const totalValue = proposals.filter(p => p.status === "accepted").reduce((acc, p) => {
    const match = p.value?.match(/£([0-9,]+)/);
    return acc + (match ? parseInt(match[1].replace(",", "")) : 0);
  }, 0);

  const pendingValue = proposals.filter(p => p.status === "sent").reduce((acc, p) => {
    const match = p.value?.match(/(?:From |£)?([0-9,]+)/);
    return acc + (match ? parseInt(match[1].replace(",", "")) : 0);
  }, 0);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Link2 className="w-6 h-6" />
            Proposals
          </h1>
          <p className="text-muted-foreground mt-1">
            Track client proposals and values
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => { setRefreshing(true); setTimeout(() => setRefreshing(false), 500); }}
          disabled={refreshing}
        >
          {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Refresh"}
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-card border rounded-lg p-4">
          <div className="text-muted-foreground text-sm">Total Proposals</div>
          <div className="text-2xl font-bold">{proposals.length}</div>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="text-muted-foreground text-sm">Accepted</div>
          <div className="text-2xl font-bold text-green-400">
            {proposals.filter(p => p.status === "accepted").length}
          </div>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="text-muted-foreground text-sm">Won Value</div>
          <div className="text-2xl font-bold text-green-400">£{totalValue.toLocaleString()}</div>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="text-muted-foreground text-sm">Pending Value</div>
          <div className="text-2xl font-bold text-blue-400">£{pendingValue.toLocaleString()}</div>
        </div>
      </div>

      {/* Proposals Table */}
      <div className="bg-card border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3 font-medium">Client</th>
              <th className="text-left p-3 font-medium">Business</th>
              <th className="text-left p-3 font-medium">Value</th>
              <th className="text-left p-3 font-medium">Status</th>
              <th className="text-left p-3 font-medium">Date</th>
              <th className="text-right p-3 font-medium">Link</th>
            </tr>
          </thead>
          <tbody>
            {proposals.map((proposal) => (
              <tr key={proposal.id} className="border-t hover:bg-muted/30">
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    {proposal.client}
                  </div>
                  {proposal.notes && (
                    <div className="text-xs text-muted-foreground mt-1 max-w-[200px]">
                      {proposal.notes}
                    </div>
                  )}
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-muted-foreground" />
                    {proposal.business}
                  </div>
                </td>
                <td className="p-3">
                  {proposal.value ? (
                    <div className="text-green-400 font-medium">
                      {proposal.value.includes("£") ? proposal.value : (
                        <><PoundSterling className="w-4 h-4 inline" /> {proposal.value}</>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="p-3">
                  <span className={`px-2 py-1 rounded-full text-xs border ${getStatusColor(proposal.status)}`}>
                    {proposal.status}
                  </span>
                </td>
                <td className="p-3 text-muted-foreground text-sm">
                  {proposal.status === "accepted" && proposal.acceptedDate 
                    ? proposal.acceptedDate 
                    : proposal.sentDate || proposal.created}
                </td>
                <td className="p-3 text-right">
                  <a
                    href={proposal.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 text-sm"
                  >
                    View <ExternalLink className="w-3 h-3" />
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}