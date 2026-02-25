import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, startOfWeek, addDays, fromUnixTime, getUnixTime } from "date-fns";
import {
  ChevronLeft, ChevronRight, Plus, Edit2, Check, X, Clock,
  Send, Trash2, AlertCircle, Loader2, Sparkles, Calendar,
  List, Users, Zap
} from "lucide-react";
import { SiFacebook, SiInstagram, SiX } from "react-icons/si";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest } from "@/lib/auth";
import type { SocialPage, SocialPost } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

const PLATFORM_ICON: Record<string, React.ElementType> = {
  facebook: SiFacebook,
  instagram: SiInstagram,
  twitter: SiX,
};

const PLATFORM_COLORS: Record<string, string> = {
  facebook: "bg-blue-600/20 text-blue-400",
  instagram: "bg-pink-600/20 text-pink-400",
  twitter: "bg-foreground/10 text-foreground",
};

const PLATFORM_CHIP_COLORS: Record<string, string> = {
  facebook: "bg-blue-600 text-white",
  instagram: "bg-gradient-to-r from-pink-500 to-purple-500 text-white",
  twitter: "bg-neutral-800 text-white",
};

const STATUS_META: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-muted text-muted-foreground" },
  approved: { label: "Approved", className: "bg-emerald-500/15 text-emerald-500 dark:text-emerald-300" },
  scheduled: { label: "Scheduled", className: "bg-blue-500/15 text-blue-500 dark:text-blue-300" },
  published: { label: "Published", className: "bg-primary/15 text-primary" },
  failed: { label: "Failed", className: "bg-destructive/15 text-destructive" },
};

const POST_GROUPS = ["draft", "approved", "scheduled", "published", "failed"] as const;
const GROUP_LABELS: Record<string, string> = {
  draft: "Drafts",
  approved: "Approved",
  scheduled: "Scheduled",
  published: "Published",
  failed: "Failed",
};

const THEME_OPTIONS = ["Educational", "Promotional", "Engagement", "Behind the Scenes", "Tips & Tricks", "Success Stories", "Announcements"];
const FORMAT_OPTIONS = ["Short post (under 100 words)", "Medium post (150-200 words)", "Long form (300+ words)", "Thread/carousel", "Story/reel caption", "Poll post"];
const PROJECT_OPTIONS = ["InvoiceWizard", "Life Coach Steven", "WeSayIDo", "Horse Race System", "Bright Stack Labs"];

function PlatformIcon({ platform, className = "w-4 h-4" }: { platform: string; className?: string }) {
  const Icon = PLATFORM_ICON[platform];
  if (!Icon) return null;
  return <Icon className={className} />;
}

interface PostDetailModalProps {
  post: SocialPost | null;
  open: boolean;
  onClose: () => void;
  pages: SocialPage[];
}

function PostDetailModal({ post, open, onClose, pages }: PostDetailModalProps) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [content, setContent] = useState(post?.content ?? "");
  const [platform, setPlatform] = useState(post?.platform ?? "facebook");
  const [pageId, setPageId] = useState(post?.pageId ?? "");
  const [scheduledAt, setScheduledAt] = useState(
    post?.scheduledAt ? format(fromUnixTime(post.scheduledAt), "yyyy-MM-dd'T'HH:mm") : ""
  );

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["/posts"] });
    qc.invalidateQueries({ queryKey: ["/posts/calendar"] });
  };

  const saveMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", `/posts/${post?.id}`, {
      content, platform, pageId,
      scheduledAt: scheduledAt ? getUnixTime(new Date(scheduledAt)) : undefined,
    }),
    onSuccess: () => { invalidate(); toast({ title: "Post saved" }); onClose(); },
  });

  const actionMutation = useMutation({
    mutationFn: (action: string) => apiRequest("POST", `/posts/${post?.id}/${action}`),
    onSuccess: (_, action) => {
      invalidate();
      toast({ title: `Post ${action}d` });
      onClose();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/posts/${post?.id}`),
    onSuccess: () => { invalidate(); toast({ title: "Post deleted" }); onClose(); },
  });

  if (!post) return null;

  const filteredPages = pages.filter(p => p.platform === platform);
  const statusMeta = STATUS_META[post.status];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg" data-testid="modal-post">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle className="text-base">Post Details</DialogTitle>
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusMeta.className}`}>
              {statusMeta.label}
            </span>
          </div>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Content</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              className="resize-none"
              data-testid="input-post-content"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Platform</Label>
              <Select value={platform} onValueChange={(v) => setPlatform(v as "facebook" | "instagram" | "twitter")}>
                <SelectTrigger data-testid="select-post-platform">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="facebook">Facebook</SelectItem>
                  <SelectItem value="instagram">Instagram</SelectItem>
                  <SelectItem value="twitter">X / Twitter</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Page</Label>
              <Select value={pageId} onValueChange={setPageId}>
                <SelectTrigger data-testid="select-post-page">
                  <SelectValue placeholder="Select page" />
                </SelectTrigger>
                <SelectContent>
                  {filteredPages.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Schedule (UK Time)</Label>
            <Input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              data-testid="input-post-schedule"
            />
          </div>

          <div className="flex flex-wrap gap-2 pt-1 border-t border-border">
            <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} data-testid="button-save-post">
              Save
            </Button>
            {(post.status === "draft" || post.status === "approved") && (
              <Button size="sm" variant="secondary" onClick={() => actionMutation.mutate("approve")} data-testid="button-approve-post">
                <Check className="w-3.5 h-3.5 mr-1" /> Approve
              </Button>
            )}
            {(post.status === "draft" || post.status === "approved") && (
              <Button size="sm" variant="secondary" onClick={() => actionMutation.mutate("reject")} data-testid="button-reject-post">
                <X className="w-3.5 h-3.5 mr-1" /> Reject
              </Button>
            )}
            {post.status === "approved" && (
              <Button size="sm" variant="secondary" onClick={() => actionMutation.mutate("publish")} data-testid="button-publish-post">
                <Send className="w-3.5 h-3.5 mr-1" /> Publish Now
              </Button>
            )}
            <Button
              size="sm"
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
              className="ml-auto"
              data-testid="button-delete-post"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AccountsTab() {
  const { data: pages, isLoading } = useQuery<SocialPage[]>({
    queryKey: ["/pages"],
    queryFn: () => apiRequest<SocialPage[]>("GET", "/pages"),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Connected Accounts</h2>
        <Button size="sm" variant="secondary" data-testid="button-add-account">
          <Plus className="w-3.5 h-3.5 mr-1" /> Add Account
        </Button>
      </div>

      {isLoading ? (
        Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-md" />)
      ) : !pages?.length ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Users className="w-10 h-10 mb-3 opacity-40" />
          <p className="text-sm">No accounts connected</p>
        </div>
      ) : (
        <div className="border border-border rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium">Platform</th>
                <th className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium">Page Name</th>
                <th className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium">Page ID</th>
                <th className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {pages.map((page, i) => (
                <tr key={page.id} className={`border-b border-border last:border-0 ${i % 2 === 0 ? "" : "bg-muted/20"}`} data-testid={`row-account-${page.id}`}>
                  <td className="px-4 py-3">
                    <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded ${PLATFORM_COLORS[page.platform]}`}>
                      <PlatformIcon platform={page.platform} />
                      <span className="text-xs font-medium capitalize">{page.platform}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground">{page.name}</td>
                  <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{page.pageId}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${page.status === "connected" ? "bg-emerald-500/15 text-emerald-500 dark:text-emerald-300" : "bg-destructive/15 text-destructive"}`}>
                      {page.status === "connected" ? "Connected" : "Token Expired"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CalendarTab({ pages }: { pages: SocialPage[] }) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [selectedPost, setSelectedPost] = useState<SocialPost | null>(null);

  const weekEnd = addDays(weekStart, 7);
  const { data: posts, isLoading } = useQuery<SocialPost[]>({
    queryKey: ["/posts/calendar", getUnixTime(weekStart), getUnixTime(weekEnd)],
    queryFn: () => apiRequest<SocialPost[]>("GET", `/posts/calendar?from=${getUnixTime(weekStart)}&to=${getUnixTime(weekEnd)}`),
  });

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const postsByDay = (day: Date) => {
    const ts = getUnixTime(day);
    const tsEnd = ts + 86400;
    return (posts ?? []).filter(p => p.scheduledAt && p.scheduledAt >= ts && p.scheduledAt < tsEnd);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button size="icon" variant="ghost" onClick={() => setWeekStart(d => addDays(d, -7))} data-testid="button-prev-week">
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <span className="text-sm font-medium text-foreground flex-1 text-center">
          {format(weekStart, "d MMM")} – {format(addDays(weekStart, 6), "d MMM yyyy")}
        </span>
        <Button size="icon" variant="ghost" onClick={() => setWeekStart(d => addDays(d, 7))} data-testid="button-next-week">
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {days.map(day => {
          const dayPosts = postsByDay(day);
          const isToday = format(day, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");
          return (
            <div key={day.toISOString()} className={`min-h-32 rounded-md border p-2 ${isToday ? "border-primary/40 bg-primary/5" : "border-border bg-card"}`} data-testid={`cal-day-${format(day, "yyyy-MM-dd")}`}>
              <div className="flex items-center gap-1 mb-2">
                <span className="text-xs font-medium text-muted-foreground">{format(day, "EEE")}</span>
                <span className={`text-xs font-bold ${isToday ? "text-primary" : "text-foreground"}`}>{format(day, "d")}</span>
              </div>
              {isLoading ? (
                <Skeleton className="h-5 rounded" />
              ) : (
                dayPosts.map(p => (
                  <button
                    key={p.id}
                    className={`w-full text-left text-xs px-1.5 py-0.5 rounded mb-1 truncate flex items-center gap-1 ${PLATFORM_CHIP_COLORS[p.platform]}`}
                    onClick={() => setSelectedPost(p)}
                    data-testid={`chip-post-${p.id}`}
                  >
                    <PlatformIcon platform={p.platform} className="w-2.5 h-2.5 flex-shrink-0" />
                    <span className="truncate">{p.content.substring(0, 25)}</span>
                  </button>
                ))
              )}
            </div>
          );
        })}
      </div>

      <PostDetailModal
        post={selectedPost}
        open={!!selectedPost}
        onClose={() => setSelectedPost(null)}
        pages={pages}
      />
    </div>
  );
}

function QueueTab({ pages }: { pages: SocialPage[] }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [selectedPost, setSelectedPost] = useState<SocialPost | null>(null);

  const { data: posts, isLoading } = useQuery<SocialPost[]>({
    queryKey: ["/posts"],
    queryFn: () => apiRequest<SocialPost[]>("GET", "/posts"),
  });

  const actionMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) =>
      apiRequest("POST", `/posts/${id}/${action}`),
    onSuccess: (_, { action }) => {
      qc.invalidateQueries({ queryKey: ["/posts"] });
      toast({ title: `Post ${action}d` });
    },
  });

  return (
    <div className="space-y-6">
      {isLoading ? (
        Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-md" />)
      ) : (
        POST_GROUPS.map(group => {
          const groupPosts = (posts ?? []).filter(p => p.status === group);
          if (groupPosts.length === 0) return null;
          return (
            <div key={group}>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                {GROUP_LABELS[group]} ({groupPosts.length})
              </h3>
              <div className="space-y-2">
                {groupPosts.map(post => (
                  <div
                    key={post.id}
                    className="bg-card border border-card-border rounded-md px-4 py-3 flex items-center gap-3"
                    data-testid={`row-post-${post.id}`}
                  >
                    <div className={`inline-flex items-center justify-center w-7 h-7 rounded ${PLATFORM_COLORS[post.platform]}`}>
                      <PlatformIcon platform={post.platform} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">{post.content.substring(0, 60)}{post.content.length > 60 ? "..." : ""}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground">{post.pageName}</span>
                        {post.scheduledAt && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            {format(fromUnixTime(post.scheduledAt), "d MMM HH:mm")}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <Button size="sm" variant="ghost" onClick={() => setSelectedPost(post)} data-testid={`button-edit-post-${post.id}`}>
                        <Edit2 className="w-3 h-3" />
                      </Button>
                      {post.status === "draft" && (
                        <Button size="sm" variant="secondary" onClick={() => actionMutation.mutate({ id: post.id, action: "approve" })} data-testid={`button-approve-post-${post.id}`}>
                          <Check className="w-3 h-3 mr-1" /> Approve
                        </Button>
                      )}
                      {post.status === "approved" && (
                        <>
                          <Button size="sm" variant="secondary" onClick={() => actionMutation.mutate({ id: post.id, action: "publish" })} data-testid={`button-publish-post-${post.id}`}>
                            <Send className="w-3 h-3 mr-1" /> Publish
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}
      {!isLoading && (posts ?? []).length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <List className="w-10 h-10 mb-3 opacity-40" />
          <p className="text-sm">No posts in queue</p>
        </div>
      )}

      <PostDetailModal
        post={selectedPost}
        open={!!selectedPost}
        onClose={() => setSelectedPost(null)}
        pages={pages}
      />
    </div>
  );
}

interface GeneratedPost {
  id: string;
  content: string;
  scheduledTime?: string;
}

function GenerateTab() {
  const { toast } = useToast();
  const [project, setProject] = useState("");
  const [theme, setTheme] = useState("");
  const [formatOpt, setFormatOpt] = useState("");
  const [guidance, setGuidance] = useState("");
  const [generating, setGenerating] = useState(false);
  const [weekGenerating, setWeekGenerating] = useState(false);
  const [result, setResult] = useState("");
  const [weekPosts, setWeekPosts] = useState<GeneratedPost[]>([]);
  const [savingDraft, setSavingDraft] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await apiRequest<{ content: string }>("POST", "/generate", { project, theme, format: formatOpt, guidance });
      setResult(res.content ?? "");
    } catch {
      toast({ title: "Failed to generate content", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateWeek = async () => {
    setWeekGenerating(true);
    try {
      const res = await apiRequest<{ posts: GeneratedPost[] }>("POST", "/generate/week", { project, theme, format: formatOpt, guidance });
      setWeekPosts(res.posts ?? []);
    } catch {
      toast({ title: "Failed to generate week content", variant: "destructive" });
    } finally {
      setWeekGenerating(false);
    }
  };

  const handleSaveDraft = async () => {
    setSavingDraft(true);
    try {
      await apiRequest("POST", "/posts", { content: result, status: "draft", platform: "facebook" });
      toast({ title: "Saved as draft" });
      setResult("");
    } catch {
      toast({ title: "Failed to save draft", variant: "destructive" });
    } finally {
      setSavingDraft(false);
    }
  };

  const handleSaveAllDrafts = async () => {
    setSavingDraft(true);
    try {
      await Promise.all(weekPosts.map(p =>
        apiRequest("POST", "/posts", { content: p.content, status: "draft", platform: "facebook", scheduledAt: p.scheduledTime ? getUnixTime(new Date(p.scheduledTime)) : undefined })
      ));
      toast({ title: `${weekPosts.length} posts saved as drafts` });
      setWeekPosts([]);
    } catch {
      toast({ title: "Failed to save drafts", variant: "destructive" });
    } finally {
      setSavingDraft(false);
    }
  };

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide">Project / Brand</Label>
          <Select value={project} onValueChange={setProject}>
            <SelectTrigger data-testid="select-gen-project">
              <SelectValue placeholder="Select project" />
            </SelectTrigger>
            <SelectContent>
              {PROJECT_OPTIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide">Theme</Label>
          <Select value={theme} onValueChange={setTheme}>
            <SelectTrigger data-testid="select-gen-theme">
              <SelectValue placeholder="Select theme" />
            </SelectTrigger>
            <SelectContent>
              {THEME_OPTIONS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 col-span-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide">Format</Label>
          <Select value={formatOpt} onValueChange={setFormatOpt}>
            <SelectTrigger data-testid="select-gen-format">
              <SelectValue placeholder="Select format" />
            </SelectTrigger>
            <SelectContent>
              {FORMAT_OPTIONS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 col-span-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide">Extra Guidance</Label>
          <Textarea
            value={guidance}
            onChange={(e) => setGuidance(e.target.value)}
            placeholder="Any specific instructions, tone, or key messages..."
            rows={3}
            className="resize-none"
            data-testid="input-gen-guidance"
          />
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Button
          onClick={handleGenerate}
          disabled={generating || !project}
          data-testid="button-generate"
        >
          {generating ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1.5" />}
          Generate
        </Button>
        <Button
          variant="secondary"
          onClick={handleGenerateWeek}
          disabled={weekGenerating || !project}
          data-testid="button-generate-week"
        >
          {weekGenerating ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 mr-1.5" />}
          Generate Full Week (Mon–Fri)
        </Button>
      </div>

      {result && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide">Generated Content</Label>
          <Textarea
            value={result}
            onChange={(e) => setResult(e.target.value)}
            rows={6}
            className="resize-none"
            data-testid="textarea-gen-result"
          />
          <Button size="sm" variant="secondary" onClick={handleSaveDraft} disabled={savingDraft} data-testid="button-save-draft">
            Save as Draft
          </Button>
        </div>
      )}

      {weekPosts.length > 0 && (
        <div className="space-y-3">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide">Generated Week ({weekPosts.length} posts)</Label>
          {weekPosts.map((p, i) => (
            <div key={p.id} className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-medium">
                  {p.scheduledTime ? format(new Date(p.scheduledTime), "EEE d MMM, HH:mm") : `Post ${i + 1}`}
                </span>
              </div>
              <Textarea
                value={p.content}
                onChange={(e) => setWeekPosts(prev => prev.map((pp, j) => j === i ? { ...pp, content: e.target.value } : pp))}
                rows={3}
                className="resize-none"
                data-testid={`textarea-week-post-${i}`}
              />
            </div>
          ))}
          <Button size="sm" variant="secondary" onClick={handleSaveAllDrafts} disabled={savingDraft} data-testid="button-save-all-drafts">
            Save All as Drafts
          </Button>
        </div>
      )}
    </div>
  );
}

export default function SocialMediaPage() {
  const { data: pages = [] } = useQuery<SocialPage[]>({
    queryKey: ["/pages"],
    queryFn: () => apiRequest<SocialPage[]>("GET", "/pages"),
  });

  return (
    <div className="h-full flex flex-col">
      <div className="px-5 py-3 border-b border-border bg-background">
        <h1 className="text-base font-semibold text-foreground">Social Media</h1>
      </div>
      <div className="flex-1 overflow-y-auto p-5">
        <Tabs defaultValue="accounts">
          <TabsList className="mb-5" data-testid="tabs-social">
            <TabsTrigger value="accounts" data-testid="tab-accounts">
              <Users className="w-3.5 h-3.5 mr-1.5" />Accounts
            </TabsTrigger>
            <TabsTrigger value="calendar" data-testid="tab-calendar">
              <Calendar className="w-3.5 h-3.5 mr-1.5" />Calendar
            </TabsTrigger>
            <TabsTrigger value="queue" data-testid="tab-queue">
              <List className="w-3.5 h-3.5 mr-1.5" />Queue
            </TabsTrigger>
            <TabsTrigger value="generate" data-testid="tab-generate">
              <Sparkles className="w-3.5 h-3.5 mr-1.5" />Generate
            </TabsTrigger>
          </TabsList>
          <TabsContent value="accounts"><AccountsTab /></TabsContent>
          <TabsContent value="calendar"><CalendarTab pages={pages} /></TabsContent>
          <TabsContent value="queue"><QueueTab pages={pages} /></TabsContent>
          <TabsContent value="generate"><GenerateTab /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
