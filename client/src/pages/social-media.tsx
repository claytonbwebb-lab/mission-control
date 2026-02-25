import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, startOfWeek, addDays, parseISO } from "date-fns";
import {
  ChevronLeft, ChevronRight, Plus, Edit2, Check, X, Clock,
  Send, Trash2, AlertCircle, Loader2, Sparkles, Calendar,
  List, Users, Zap, ImageIcon, Upload, Wand2
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
import { Switch } from "@/components/ui/switch";
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

function normalizePost(raw: Record<string, unknown>): SocialPost {
  return {
    id: (raw.id ?? raw._id ?? "") as string,
    platform: (raw.platform ?? "facebook") as SocialPost["platform"],
    pageId: (raw.pageId ?? raw.page_id ?? "") as string,
    pageName: (raw.pageName ?? raw.page_name ?? "") as string,
    content: (raw.content_text ?? raw.content ?? "") as string,
    imageUrl: (raw.image_url ?? raw.imageUrl ?? undefined) as string | undefined,
    scheduledAt: raw.scheduledAt ?? raw.scheduled_at ?? undefined,
    status: (raw.status ?? "draft") as SocialPost["status"],
    createdAt: raw.createdAt ?? raw.created_at ?? Date.now(),
  } as SocialPost;
}

function normalizePage(raw: Record<string, unknown>): SocialPage {
  return {
    id: (raw.id ?? raw._id ?? "") as string,
    platform: (raw.platform ?? "facebook") as SocialPage["platform"],
    name: (raw.name ?? "") as string,
    pageId: (raw.pageId ?? raw.page_id ?? "") as string,
    status: (raw.status ?? "connected") as SocialPage["status"],
  };
}

function formatSchedule(val: unknown): string {
  if (!val) return "";
  if (typeof val === "string") {
    try { return format(parseISO(val), "d MMM HH:mm"); } catch { return val; }
  }
  if (typeof val === "number") {
    try { return format(new Date(val > 1e12 ? val : val * 1000), "d MMM HH:mm"); } catch { return ""; }
  }
  return "";
}

function scheduledToDatetimeLocal(val: unknown): string {
  if (!val) return "";
  try {
    const d = typeof val === "string" ? parseISO(val) : new Date(typeof val === "number" && val < 1e12 ? val * 1000 : val as number);
    return format(d, "yyyy-MM-dd'T'HH:mm");
  } catch {
    return "";
  }
}

function scheduledToDateStr(val: unknown): string {
  if (!val) return "";
  try {
    const d = typeof val === "string" ? parseISO(val) : new Date(typeof val === "number" && val < 1e12 ? val * 1000 : val as number);
    return format(d, "yyyy-MM-dd");
  } catch {
    return "";
  }
}

function PlatformIcon({ platform, className = "w-4 h-4" }: { platform: string; className?: string }) {
  const Icon = PLATFORM_ICON[platform];
  if (!Icon) return null;
  return <Icon className={className} />;
}

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

interface ImageUploadSectionProps {
  imageUrl: string;
  onChange: (url: string) => void;
  testIdPrefix: string;
  generatePromptDefault?: string;
  showGenerate?: boolean;
}

function ImageUploadSection({ imageUrl, onChange, testIdPrefix, generatePromptDefault, showGenerate }: ImageUploadSectionProps) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [generatingImg, setGeneratingImg] = useState(false);
  const [genPromptOpen, setGenPromptOpen] = useState(false);
  const [genPrompt, setGenPrompt] = useState("");

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      toast({ title: "Invalid file type", description: "Allowed: JPEG, PNG, WebP, GIF", variant: "destructive" });
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast({ title: "File too large", description: "Maximum size is 5 MB", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await apiRequest<{ url: string }>("POST", "/media/upload", { data: dataUrl });
      onChange(res.url);
      toast({ title: "Image uploaded" });
    } catch (err) {
      toast({ title: "Upload failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleGenerateImage = async () => {
    if (!genPrompt.trim()) {
      toast({ title: "Enter a prompt", variant: "destructive" });
      return;
    }
    setGeneratingImg(true);
    try {
      const res = await apiRequest<{ url: string }>("POST", "/media/generate", { prompt: genPrompt.trim() });
      onChange(res.url);
      toast({ title: "Image generated" });
      setGenPromptOpen(false);
    } catch (err) {
      toast({ title: "Image generation failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setGeneratingImg(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground uppercase tracking-wide">Image</Label>
      <div className="flex gap-2">
        <Input
          value={imageUrl}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Image URL"
          className="flex-1"
          data-testid={`${testIdPrefix}-image-url`}
        />
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="flex-shrink-0"
          disabled={uploading}
          data-testid={`${testIdPrefix}-upload-file`}
          onClick={() => document.getElementById(`${testIdPrefix}-file-input`)?.click()}
        >
          {uploading ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Upload className="w-3.5 h-3.5 mr-1" />}
          Upload
        </Button>
        {showGenerate && (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="flex-shrink-0"
            disabled={generatingImg}
            data-testid={`${testIdPrefix}-generate-image`}
            onClick={() => {
              setGenPrompt(generatePromptDefault ?? "");
              setGenPromptOpen(!genPromptOpen);
            }}
          >
            <Wand2 className="w-3.5 h-3.5 mr-1" />
            Generate
          </Button>
        )}
        <input
          id={`${testIdPrefix}-file-input`}
          type="file"
          accept=".jpg,.jpeg,.png,.webp,.gif"
          className="hidden"
          onChange={handleFileUpload}
        />
      </div>
      {showGenerate && genPromptOpen && (
        <div className="flex gap-2 mt-1.5">
          <Input
            value={genPrompt}
            onChange={(e) => setGenPrompt(e.target.value)}
            placeholder="Describe the image to generate..."
            className="flex-1"
            data-testid={`${testIdPrefix}-gen-prompt`}
          />
          <Button
            size="sm"
            onClick={handleGenerateImage}
            disabled={generatingImg || !genPrompt.trim()}
            data-testid={`${testIdPrefix}-gen-prompt-submit`}
          >
            {generatingImg ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Wand2 className="w-3.5 h-3.5 mr-1" />}
            Go
          </Button>
        </div>
      )}
      {imageUrl && (
        <div className="mt-2 relative inline-block">
          <img
            src={imageUrl}
            alt="Preview"
            className="h-20 w-auto rounded border border-border object-cover"
            data-testid={`${testIdPrefix}-image-preview`}
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        </div>
      )}
    </div>
  );
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
  const [content, setContent] = useState("");
  const [platform, setPlatform] = useState<string>("facebook");
  const [pageId, setPageId] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  useEffect(() => {
    if (post) {
      setContent(post.content ?? "");
      setPlatform(post.platform ?? "facebook");
      setPageId(post.pageId ?? "");
      setScheduledAt(scheduledToDatetimeLocal(post.scheduledAt));
      setImageUrl(post.imageUrl ?? "");
    }
  }, [post]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["/posts"] });
    qc.invalidateQueries({ queryKey: ["/posts/calendar"] });
  };

  const buildPayload = (extra?: Record<string, unknown>) => ({
    content_text: content,
    platform,
    page_id: pageId,
    image_url: imageUrl || undefined,
    scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
    ...extra,
  });

  const saveMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", `/posts/${post?.id}`, buildPayload()),
    onSuccess: () => { invalidate(); toast({ title: "Post saved" }); onClose(); },
    onError: (err: Error) => { toast({ title: "Save failed", description: err.message, variant: "destructive" }); },
  });

  const statusMutation = useMutation({
    mutationFn: (newStatus: string) => apiRequest("PATCH", `/posts/${post?.id}`, buildPayload({ status: newStatus })),
    onSuccess: (_, newStatus) => {
      invalidate();
      toast({ title: `Post ${newStatus}` });
      onClose();
    },
    onError: (err: Error) => { toast({ title: "Action failed", description: err.message, variant: "destructive" }); },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/posts/${post?.id}`),
    onSuccess: () => { invalidate(); toast({ title: "Post deleted" }); onClose(); },
    onError: (err: Error) => { toast({ title: "Delete failed", description: err.message, variant: "destructive" }); },
  });

  if (!post) return null;

  const filteredPages = pages.filter(p => p.platform === platform);
  const statusMeta = STATUS_META[post.status] ?? STATUS_META.draft;

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

          <ImageUploadSection
            imageUrl={imageUrl}
            onChange={setImageUrl}
            testIdPrefix="modal"
            showGenerate
            generatePromptDefault={content ? `Social media image for: ${content.substring(0, 120)}` : ""}
          />

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Platform</Label>
              <Select value={platform} onValueChange={setPlatform}>
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
              {saveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : null}
              Save
            </Button>
            {(post.status === "draft") && (
              <Button size="sm" variant="secondary" onClick={() => statusMutation.mutate("approved")} disabled={statusMutation.isPending} data-testid="button-approve-post">
                <Check className="w-3.5 h-3.5 mr-1" /> Approve
              </Button>
            )}
            {(post.status === "draft" || post.status === "approved") && (
              <Button size="sm" variant="secondary" onClick={() => statusMutation.mutate("draft")} disabled={statusMutation.isPending} data-testid="button-reject-post">
                <X className="w-3.5 h-3.5 mr-1" /> Reject
              </Button>
            )}
            {post.status === "approved" && (
              <Button size="sm" variant="secondary" onClick={() => statusMutation.mutate("published")} disabled={statusMutation.isPending} data-testid="button-publish-post">
                <Send className="w-3.5 h-3.5 mr-1" /> Publish Now
              </Button>
            )}
            <Button
              size="sm"
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
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
  const { toast } = useToast();
  const { data: pages, isLoading, error } = useQuery<SocialPage[]>({
    queryKey: ["/pages"],
    queryFn: async () => {
      const raw = await apiRequest<Record<string, unknown>[]>("GET", "/pages");
      return (Array.isArray(raw) ? raw : []).map(normalizePage);
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Connected Accounts</h2>
        <Button size="sm" variant="secondary" data-testid="button-add-account">
          <Plus className="w-3.5 h-3.5 mr-1" /> Add Account
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>Failed to load accounts: {(error as Error).message}</span>
        </div>
      )}

      {isLoading ? (
        Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-md" />)
      ) : !pages?.length && !error ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Users className="w-10 h-10 mb-3 opacity-40" />
          <p className="text-sm">No accounts connected</p>
        </div>
      ) : pages?.length ? (
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
                    <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded ${PLATFORM_COLORS[page.platform] ?? "bg-muted text-muted-foreground"}`}>
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
      ) : null}
    </div>
  );
}

function CalendarTab({ pages }: { pages: SocialPage[] }) {
  const { toast } = useToast();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [selectedPost, setSelectedPost] = useState<SocialPost | null>(null);

  const weekEnd = addDays(weekStart, 6);
  const fromStr = format(weekStart, "yyyy-MM-dd");
  const toStr = format(weekEnd, "yyyy-MM-dd");

  const { data: posts, isLoading, error } = useQuery<SocialPost[]>({
    queryKey: ["/posts/calendar", fromStr, toStr],
    queryFn: async () => {
      const raw = await apiRequest<Record<string, unknown>[]>("GET", `/posts/calendar?from=${fromStr}&to=${toStr}`);
      return (Array.isArray(raw) ? raw : []).map(normalizePost);
    },
  });

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const postsByDay = (day: Date) => {
    const dayStr = format(day, "yyyy-MM-dd");
    return (posts ?? []).filter(p => {
      if (!p.scheduledAt) return false;
      const postDayStr = scheduledToDateStr(p.scheduledAt);
      return postDayStr === dayStr;
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button size="icon" variant="ghost" onClick={() => setWeekStart(d => addDays(d, -7))} data-testid="button-prev-week">
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <span className="text-sm font-medium text-foreground flex-1 text-center">
          {format(weekStart, "d MMM")} - {format(addDays(weekStart, 6), "d MMM yyyy")}
        </span>
        <Button size="icon" variant="ghost" onClick={() => setWeekStart(d => addDays(d, 7))} data-testid="button-next-week">
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>Failed to load calendar: {(error as Error).message}</span>
        </div>
      )}

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
                    className={`w-full text-left text-xs px-1.5 py-0.5 rounded mb-1 truncate flex items-center gap-1 ${PLATFORM_CHIP_COLORS[p.platform] ?? "bg-muted text-foreground"}`}
                    onClick={() => setSelectedPost(p)}
                    data-testid={`chip-post-${p.id}`}
                  >
                    <PlatformIcon platform={p.platform} className="w-2.5 h-2.5 flex-shrink-0" />
                    {p.imageUrl && <ImageIcon className="w-2.5 h-2.5 flex-shrink-0 opacity-70" />}
                    <span className="truncate">{(p.content ?? "").substring(0, 25)}</span>
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

  const { data: posts, isLoading, error } = useQuery<SocialPost[]>({
    queryKey: ["/posts"],
    queryFn: async () => {
      const raw = await apiRequest<Record<string, unknown>[]>("GET", "/posts?status=draft,approved,scheduled");
      return (Array.isArray(raw) ? raw : []).map(normalizePost);
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["/posts"] });
    qc.invalidateQueries({ queryKey: ["/posts/calendar"] });
  };

  const statusMutation = useMutation({
    mutationFn: ({ id, status, scheduled_at }: { id: string; status: string; scheduled_at?: string }) =>
      apiRequest("PATCH", `/posts/${id}`, { status, ...(scheduled_at ? { scheduled_at } : {}), }),
    onSuccess: (_, { status }) => {
      invalidate();
      toast({ title: `Post ${status}` });
    },
    onError: (err: Error) => { toast({ title: "Action failed", description: err.message, variant: "destructive" }); },
  });

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>Failed to load posts: {(error as Error).message}</span>
        </div>
      )}

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
                    <div className={`inline-flex items-center justify-center w-7 h-7 rounded ${PLATFORM_COLORS[post.platform] ?? "bg-muted"}`}>
                      <PlatformIcon platform={post.platform} />
                    </div>
                    {post.imageUrl && (
                      <img
                        src={post.imageUrl}
                        alt=""
                        className="w-10 h-10 rounded border border-border object-cover flex-shrink-0"
                        data-testid={`thumb-image-${post.id}`}
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">{(post.content ?? "").substring(0, 60)}{(post.content ?? "").length > 60 ? "..." : ""}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs text-muted-foreground">{post.pageName}</span>
                        {post.scheduledAt && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            {formatSchedule(post.scheduledAt)}
                          </span>
                        )}
                        {post.imageUrl && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1" data-testid={`icon-image-${post.id}`}>
                            <ImageIcon className="w-2.5 h-2.5" />
                          </span>
                        )}
                        {post.status && (
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${(STATUS_META[post.status] ?? STATUS_META.draft).className}`}>
                            {(STATUS_META[post.status] ?? STATUS_META.draft).label}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <Button size="sm" variant="ghost" onClick={() => setSelectedPost(post)} data-testid={`button-edit-post-${post.id}`}>
                        <Edit2 className="w-3 h-3" />
                      </Button>
                      {post.status === "draft" && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => statusMutation.mutate({ id: post.id, status: "approved" })}
                          disabled={statusMutation.isPending}
                          data-testid={`button-approve-post-${post.id}`}
                        >
                          <Check className="w-3 h-3 mr-1" /> Approve
                        </Button>
                      )}
                      {post.status === "draft" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => statusMutation.mutate({ id: post.id, status: "draft" })}
                          disabled={statusMutation.isPending}
                          data-testid={`button-reject-post-${post.id}`}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      )}
                      {post.status === "approved" && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => statusMutation.mutate({ id: post.id, status: "published" })}
                          disabled={statusMutation.isPending}
                          data-testid={`button-publish-post-${post.id}`}
                        >
                          <Send className="w-3 h-3 mr-1" /> Publish
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}
      {!isLoading && !error && (posts ?? []).length === 0 && (
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
  scheduled_time?: string;
}

function GenerateTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [project, setProject] = useState("");
  const [theme, setTheme] = useState("");
  const [formatOpt, setFormatOpt] = useState("");
  const [guidance, setGuidance] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [autoImage, setAutoImage] = useState(true);
  const [imagePrompt, setImagePrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [weekGenerating, setWeekGenerating] = useState(false);
  const [result, setResult] = useState("");
  const [resultImageUrl, setResultImageUrl] = useState("");
  const [weekPosts, setWeekPosts] = useState<GeneratedPost[]>([]);
  const [savingDraft, setSavingDraft] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    setResult("");
    setResultImageUrl("");
    try {
      const body: Record<string, unknown> = { project, theme, format: formatOpt, guidance, auto_image: autoImage };
      if (imagePrompt.trim()) body.image_prompt = imagePrompt.trim();
      if (imageUrl) body.image_url = imageUrl;
      const res = await apiRequest<Record<string, unknown>>("POST", "/posts/generate", body);
      setResult((res.content ?? res.text ?? res.result ?? "") as string);
      const returnedImg = (res.image_url ?? res.imageUrl ?? "") as string;
      if (returnedImg) {
        setResultImageUrl(returnedImg);
        if (!imageUrl) setImageUrl(returnedImg);
      }
    } catch (err) {
      toast({ title: "Failed to generate content", description: (err as Error).message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateWeek = async () => {
    setWeekGenerating(true);
    setWeekPosts([]);
    try {
      const body: Record<string, unknown> = { project, theme, format: formatOpt, guidance, auto_image: autoImage };
      if (imagePrompt.trim()) body.image_prompt = imagePrompt.trim();
      const res = await apiRequest<Record<string, unknown>>("POST", "/posts/generate/week", body);
      const posts = (res.posts ?? res.drafts ?? res.results ?? []) as GeneratedPost[];
      setWeekPosts(posts);
    } catch (err) {
      toast({ title: "Failed to generate week", description: (err as Error).message, variant: "destructive" });
    } finally {
      setWeekGenerating(false);
    }
  };

  const handleSaveDraft = async () => {
    setSavingDraft(true);
    try {
      const finalImage = imageUrl || resultImageUrl;
      await apiRequest("POST", "/posts", {
        content_text: result,
        status: "draft",
        platform: "facebook",
        ...(finalImage ? { image_url: finalImage } : {}),
      });
      toast({ title: "Saved as draft" });
      setResult("");
      setImageUrl("");
      setResultImageUrl("");
      qc.invalidateQueries({ queryKey: ["/posts"] });
    } catch (err) {
      toast({ title: "Failed to save draft", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSavingDraft(false);
    }
  };

  const handleSaveAllDrafts = async () => {
    setSavingDraft(true);
    try {
      await Promise.all(weekPosts.map(p =>
        apiRequest("POST", "/posts", {
          content_text: p.content,
          status: "draft",
          platform: "facebook",
          scheduled_at: p.scheduledTime ?? p.scheduled_time ?? undefined,
          ...((p as Record<string, unknown>).image_url ? { image_url: (p as Record<string, unknown>).image_url } : {}),
        })
      ));
      toast({ title: `${weekPosts.length} posts saved as drafts` });
      setWeekPosts([]);
      qc.invalidateQueries({ queryKey: ["/posts"] });
    } catch (err) {
      toast({ title: "Failed to save drafts", description: (err as Error).message, variant: "destructive" });
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

      <div className="space-y-3 border border-border rounded-md p-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide">Image Generation</Label>
          <div className="flex items-center gap-2">
            <Label htmlFor="auto-image-toggle" className="text-xs text-muted-foreground">Auto image</Label>
            <Switch
              id="auto-image-toggle"
              checked={autoImage}
              onCheckedChange={setAutoImage}
              data-testid="switch-auto-image"
            />
          </div>
        </div>
        {autoImage && (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Image Prompt (optional)</Label>
            <Input
              value={imagePrompt}
              onChange={(e) => setImagePrompt(e.target.value)}
              placeholder={theme && formatOpt ? `${theme} - ${formatOpt}` : "Describe the image style or subject..."}
              data-testid="input-image-prompt"
            />
          </div>
        )}
        <ImageUploadSection imageUrl={imageUrl} onChange={setImageUrl} testIdPrefix="gen" />
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
          Generate Full Week (Mon-Fri)
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
          {resultImageUrl && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Generated Image</Label>
              <img
                src={resultImageUrl}
                alt="Generated"
                className="h-24 w-auto rounded border border-border object-cover"
                data-testid="img-gen-result"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            </div>
          )}
          <Button size="sm" variant="secondary" onClick={handleSaveDraft} disabled={savingDraft} data-testid="button-save-draft">
            {savingDraft ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : null}
            Save as Draft
          </Button>
        </div>
      )}

      {weekPosts.length > 0 && (
        <div className="space-y-3">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide">Generated Week ({weekPosts.length} posts)</Label>
          {weekPosts.map((p, i) => {
            const wpImg = (p as Record<string, unknown>).image_url as string | undefined;
            return (
              <div key={p.id ?? i} className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground font-medium">
                    {(p.scheduledTime ?? p.scheduled_time) ? (() => { try { return format(new Date(p.scheduledTime ?? p.scheduled_time!), "EEE d MMM, HH:mm"); } catch { return `Post ${i + 1}`; } })() : `Post ${i + 1}`}
                  </span>
                  {wpImg && <ImageIcon className="w-3 h-3 text-muted-foreground" />}
                </div>
                <Textarea
                  value={p.content}
                  onChange={(e) => setWeekPosts(prev => prev.map((pp, j) => j === i ? { ...pp, content: e.target.value } : pp))}
                  rows={3}
                  className="resize-none"
                  data-testid={`textarea-week-post-${i}`}
                />
                {wpImg && (
                  <img src={wpImg} alt="" className="h-16 w-auto rounded border border-border object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                )}
              </div>
            );
          })}
          <Button size="sm" variant="secondary" onClick={handleSaveAllDrafts} disabled={savingDraft} data-testid="button-save-all-drafts">
            {savingDraft ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : null}
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
    queryFn: async () => {
      const raw = await apiRequest<Record<string, unknown>[]>("GET", "/pages");
      return (Array.isArray(raw) ? raw : []).map(normalizePage);
    },
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
