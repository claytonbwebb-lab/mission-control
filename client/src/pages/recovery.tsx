import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, ShieldCheck, Copy, Check } from "lucide-react";
import { marked } from "marked";

const BASE = import.meta.env.VITE_API_URL || "/api";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="absolute top-2 right-2 p-1.5 rounded-md bg-white/10 hover:bg-white/20 text-muted-foreground hover:text-foreground transition-colors"
      data-testid="button-copy-code"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function RenderedMarkdown({ content }: { content: string }) {
  const renderer = new marked.Renderer();

  renderer.code = function ({ text, lang }: { text: string; lang?: string }) {
    const id = `code-${Math.random().toString(36).slice(2, 9)}`;
    return `<div class="code-block-wrapper relative group" data-code-id="${id}" data-code-text="${encodeURIComponent(text)}">
      <div class="code-copy-target"></div>
      <pre class="bg-zinc-900 dark:bg-zinc-950 border border-zinc-700 rounded-lg p-4 pr-12 overflow-x-auto my-3"><code class="text-sm font-mono text-zinc-200 leading-relaxed ${lang ? `language-${lang}` : ""}">${text.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code></pre>
    </div>`;
  };

  marked.setOptions({ breaks: true });
  const html = marked.parse(content, { renderer, async: false }) as string;
  const sanitized = html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/on\w+="[^"]*"/gi, "").replace(/on\w+='[^']*'/gi, "");

  const parts: { type: "html" | "code"; content: string }[] = [];
  const codeBlockRegex = /<div class="code-block-wrapper[^"]*"[^>]*data-code-text="([^"]*)">\s*<div class="code-copy-target"><\/div>\s*([\s\S]*?)<\/div>/g;
  let lastIndex = 0;
  let match;
  while ((match = codeBlockRegex.exec(sanitized)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "html", content: sanitized.slice(lastIndex, match.index) });
    }
    parts.push({ type: "code", content: decodeURIComponent(match[1]) });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < sanitized.length) {
    parts.push({ type: "html", content: sanitized.slice(lastIndex) });
  }

  if (parts.length === 0) {
    parts.push({ type: "html", content: sanitized });
  }

  return (
    <div className="prose prose-invert prose-sm max-w-none
      prose-headings:text-foreground prose-headings:font-semibold prose-headings:border-b prose-headings:border-border prose-headings:pb-2 prose-headings:mb-4
      prose-h1:text-xl prose-h2:text-lg prose-h3:text-base
      prose-p:text-muted-foreground prose-p:leading-relaxed
      prose-a:text-primary prose-a:no-underline hover:prose-a:underline
      prose-strong:text-foreground
      prose-li:text-muted-foreground
      prose-code:text-amber-400 prose-code:bg-zinc-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:font-mono
      prose-pre:bg-transparent prose-pre:p-0
      prose-blockquote:border-l-primary prose-blockquote:text-muted-foreground
      prose-table:text-sm prose-th:text-foreground prose-td:text-muted-foreground
    ">
      {parts.map((part, i) =>
        part.type === "code" ? (
          <div key={i} className="relative group my-3">
            <CopyButton text={part.content} />
            <pre className="bg-zinc-900 dark:bg-zinc-950 border border-zinc-700 rounded-lg p-4 pr-12 overflow-x-auto">
              <code className="text-sm font-mono text-zinc-200 leading-relaxed">{part.content}</code>
            </pre>
          </div>
        ) : (
          <div key={i} dangerouslySetInnerHTML={{ __html: part.content }} />
        )
      )}
    </div>
  );
}

export default function RecoveryPage() {
  const { data, isLoading, error } = useQuery<{ content: string }>({
    queryKey: ["/docs/recovery"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/docs/recovery`);
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return res.json();
    },
  });

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <ShieldCheck className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground" data-testid="text-page-title">Emergency Recovery</h1>
            <p className="text-xs text-muted-foreground">Internal recovery procedures and documentation</p>
          </div>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-20" data-testid="loading-recovery">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 text-sm text-destructive" data-testid="error-recovery">
            Failed to load recovery document: {(error as Error).message}
          </div>
        )}

        {data?.content && <RenderedMarkdown content={data.content} />}
      </div>
    </div>
  );
}
