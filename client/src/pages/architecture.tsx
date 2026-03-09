import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { getToken } from "@/lib/auth";

export default function ArchitecturePage() {
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchArchitecture = async () => {
      try {
        const token = getToken();
        const res = await fetch("/api/architecture", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
        const text = await res.text();
        setHtml(text);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };
    fetchArchitecture();
  }, []);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center" data-testid="loading-architecture">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 text-sm text-destructive" data-testid="error-architecture">
          Failed to load architecture page: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full" data-testid="architecture-page">
      <iframe
        srcDoc={html ?? ""}
        title="Architecture"
        className="w-full h-full border-0"
        sandbox="allow-same-origin"
        data-testid="iframe-architecture"
      />
    </div>
  );
}
