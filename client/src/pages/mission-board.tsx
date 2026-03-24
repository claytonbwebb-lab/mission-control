import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import {
  Plus, X, ChevronDown, ChevronUp, Lightbulb, Wrench, Eye, CheckCircle2,
  AlertCircle, MessageSquare, ArrowRight, Send, Loader2, User, Repeat,
  ImageIcon, Upload, Trash2, RefreshCw, Pencil, Check, Search, Bell
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { apiRequest } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import type { Task, TaskStatus, TaskPriority, TaskLabel, TaskAssignee, ActivityEntry, TaskImage } from "@shared/schema";

const COLUMNS: { id: TaskStatus; label: string; icon: React.ElementType }[] = [
  { id: "ideas", label: "Ideas", icon: Lightbulb },
  { id: "inprogress", label: "In Progress", icon: Wrench },
  { id: "review", label: "Review", icon: Eye },
  { id: "complete", label: "Complete", icon: CheckCircle2 },
];

const ALL_PROJECTS = [
  "invoicewizard", "lifecoach", "wesayido", "horserace",
  "brightstacklabs", "mission-control", "personal", "other",
] as const;

const LABEL_META: Record<string, { label: string; className: string }> = {
  "invoicewizard": { label: "InvoiceWizard", className: "bg-blue-500/15 text-blue-400 dark:text-blue-300" },
  "lifecoach": { label: "Life Coach Steven", className: "bg-emerald-500/15 text-emerald-500 dark:text-emerald-300" },
  "wesayido": { label: "WeSayIDo", className: "bg-pink-500/15 text-pink-500 dark:text-pink-300" },
  "horserace": { label: "Horse Race System", className: "bg-amber-500/15 text-amber-500 dark:text-amber-300" },
  "brightstacklabs": { label: "Bright Stack Labs", className: "bg-violet-500/15 text-violet-500 dark:text-violet-300" },
  "mission-control": { label: "Mission Control", className: "bg-cyan-500/15 text-cyan-500 dark:text-cyan-300" },
  "personal": { label: "Personal", className: "bg-slate-500/15 text-slate-400 dark:text-slate-300" },
  "other": { label: "Other", className: "bg-muted text-muted-foreground" },
};

const PRIORITY_META: Record<TaskPriority, { label: string; className: string }> = {
  low: { label: "Low", className: "bg-muted text-muted-foreground" },
  medium: { label: "Medium", className: "bg-amber-500/15 text-amber-500 dark:text-amber-300" },
  high: { label: "High", className: "bg-orange-500/15 text-orange-500 dark:text-orange-300" },
  urgent: { label: "Urgent", className: "bg-destructive/15 text-destructive" },
};

const ASSIGNEE_META: Record<string, { label: string; className: string }> = {
  steve: { label: "Steve", className: "bg-sky-500/15 text-sky-500 dark:text-sky-300" },
  clawbot: { label: "Clawbot", className: "bg-violet-500/15 text-violet-500 dark:text-violet-300" },
};

const ALL_PRIORITIES: TaskPriority[] = ["low", "medium", "high", "urgent"];
const ALL_STATUSES: TaskStatus[] = ["ideas", "inprogress", "review", "complete"];
const ALL_ASSIGNEES: string[] = ["steve", "clawbot"];

function normalizeTask(raw: Record<string, unknown>): Task {
  const status = String(raw.status ?? "ideas");
  return {
    id: String(raw.id ?? ""),
    title: String(raw.title ?? ""),
    description: (raw.description ?? "") as string,
    status: (ALL_STATUSES.includes(status as TaskStatus) ? status : "ideas") as TaskStatus,
    priority: String(raw.priority ?? "medium") as TaskPriority,
    label: String(raw.project ?? raw.label ?? "other"),
    assignee: String(raw.assigned_to ?? raw.assignee ?? "clawbot"),
    position: (raw.position ?? 0) as number,
    is_repeatable: (raw.is_repeatable ?? 0) as number,
    cadence: (raw.cadence ?? undefined) as Task["cadence"],
    reminder_at: (raw.reminder_at ?? undefined) as number | undefined,
    reminder_notified: (raw.reminder_notified ?? 0) as number,
    images: (Array.isArray(raw.images) ? raw.images : []) as TaskImage[],
    createdAt: String(raw.created_at ?? raw.createdAt ?? ""),
    updatedAt: (raw.updated_at ?? raw.updatedAt ?? undefined) as string | undefined,
  };
}

function toApiPayload(updates: Partial<Task>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (updates.title !== undefined) payload.title = updates.title;
  if (updates.description !== undefined) payload.description = updates.description;
  if (updates.status !== undefined) payload.status = updates.status;
  if (updates.priority !== undefined) payload.priority = updates.priority;
  if (updates.label !== undefined) payload.project = updates.label;
  if (updates.assignee !== undefined) payload.assigned_to = updates.assignee;
  if (updates.is_repeatable !== undefined) payload.is_repeatable = updates.is_repeatable;
  if (updates.cadence !== undefined) payload.cadence = updates.cadence;
  if (updates.reminder_at !== undefined) payload.reminder_at = updates.reminder_at ?? null;
  return payload;
}

function formatDate(dateStr: string) {
  if (!dateStr) return "";
  const ts = Number(dateStr);
  const d = !isNaN(ts) && ts > 1e9 ? new Date(ts * 1000) : new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function timeAgo(epochSeconds: number): string {
  const now = Date.now() / 1000;
  const diff = Math.max(0, now - epochSeconds);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  const d = new Date(epochSeconds * 1000);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

interface TaskCardProps {
  task: Task;
  index: number;
  onClick: () => void;
}

function TaskCard({ task, index, onClick }: TaskCardProps) {
  const [expanded, setExpanded] = useState(false);
  const labelMeta = LABEL_META[task.label] ?? LABEL_META.other;
  const priorityMeta = PRIORITY_META[task.priority] ?? PRIORITY_META.medium;
  const assigneeMeta = ASSIGNEE_META[task.assignee] ?? ASSIGNEE_META.steve;
  
  // Only show bell if backend has a future reminder set
  const hasReminder = !!task.reminder_at;

  return (
    <Draggable draggableId={String(task.id)} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`bg-card border border-card-border rounded-md p-3 mb-2 cursor-pointer select-none transition-shadow ${snapshot.isDragging ? "shadow-lg ring-1 ring-primary/30" : "hover-elevate"}`}
          onClick={onClick}
          data-testid={`card-task-${task.id}`}
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            <p className="text-sm font-medium text-card-foreground leading-snug flex-1">
              <span className="text-[10px] font-mono text-muted-foreground/60 mr-1.5">#{task.id}</span>
              {task.title}
            </p>
            <div className="flex items-center gap-1">
              {(task.images?.length ?? 0) > 0 && (
                <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-xs bg-sky-500/10 text-sky-500" data-testid={`badge-images-${task.id}`}>
                  <ImageIcon className="w-3 h-3" />
                  <span className="text-[10px]">{task.images!.length}</span>
                </span>
              )}
              {!!task.is_repeatable && (
                <span className="inline-flex items-center px-1 py-0.5 rounded text-xs bg-violet-500/10 text-violet-500" title={`Repeats ${task.cadence ?? ""}`.trim()} data-testid={`badge-repeat-${task.id}`}>
                  <Repeat className="w-3 h-3" />
                </span>
              )}
              {hasReminder && (
                <span className="inline-flex items-center px-1 py-0.5 rounded text-xs bg-amber-500/10 text-amber-500" title={`Reminder set`} data-testid={`badge-reminder-${task.id}`}>
                  <Bell className="w-3 h-3" />
                </span>
              )}
              <div className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium whitespace-nowrap ${priorityMeta.className}`}>
                {priorityMeta.label}
              </div>
            </div>
          </div>

          {task.description && (
            <div className="mb-2">
              <button
                className="flex items-center gap-1 text-xs text-muted-foreground"
                onClick={(e) => { e.stopPropagation(); setExpanded(v => !v); }}
                data-testid={`button-expand-${task.id}`}
              >
                {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {expanded ? "Hide" : "Details"}
              </button>
              {expanded && (
                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{task.description}</p>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${labelMeta.className}`}>
              {labelMeta.label}
            </span>
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${assigneeMeta.className}`}>
              {assigneeMeta.label}
            </span>
          </div>
        </div>
      )}
    </Draggable>
  );
}

function linkify(text: string): React.ReactNode[] {
  const urlRegex = /(https?:\/\/[^\s]+|(?<![a-zA-Z0-9@])(?:[a-zA-Z0-9-]+\.)+(?:com|co\.uk|org|net|io|app|co|uk|dev|ai)[^\s]*)/g;
  const parts: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = urlRegex.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const href = m[0].startsWith("http") ? m[0] : `https://${m[0]}`;
    parts.push(<a key={m.index} href={href} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline hover:text-blue-400 break-all">{m[0]}</a>);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function CommentContent({ content, entryId, fallbackImageUrl }: { content: string; entryId: number; fallbackImageUrl?: string }) {
  const mdImageRegex = /!\[\]\(([^)]+)\)/g;
  const parts: { type: "text" | "image"; value: string }[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = mdImageRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", value: content.slice(lastIndex, match.index) });
    }
    parts.push({ type: "image", value: match[1] });
    lastIndex = mdImageRegex.lastIndex;
  }
  if (lastIndex < content.length) {
    parts.push({ type: "text", value: content.slice(lastIndex) });
  }

  const hasInlineImages = parts.some(p => p.type === "image");

  if (parts.length === 0 && !fallbackImageUrl) return null;

  return (
    <>
      {parts.map((p, i) =>
        p.type === "text" ? (
          p.value.trim() ? <p key={i} className="text-sm text-foreground whitespace-pre-wrap">{linkify(p.value.trim())}</p> : null
        ) : (
          <a key={i} href={p.value} target="_blank" rel="noopener noreferrer" className="block mt-1.5" data-testid={`comment-image-${entryId}-${i}`}>
            <img src={p.value} alt="Comment attachment" className="max-w-full max-h-48 rounded-md border border-border/50 object-contain cursor-pointer hover:opacity-90 transition-opacity" />
          </a>
        )
      )}
      {!hasInlineImages && fallbackImageUrl && (
        <a href={fallbackImageUrl} target="_blank" rel="noopener noreferrer" className="block mt-1.5" data-testid={`comment-image-${entryId}`}>
          <img src={fallbackImageUrl} alt="Comment attachment" className="max-w-full max-h-48 rounded-md border border-border/50 object-contain cursor-pointer hover:opacity-90 transition-opacity" />
        </a>
      )}
    </>
  );
}

function ActivityItem({ entry, taskId, onEdited }: { entry: ActivityEntry; taskId?: string; onEdited?: () => void }) {
  const authorMeta = ASSIGNEE_META[entry.author] ?? { label: entry.author, className: "bg-muted text-muted-foreground" };
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);

  const startEdit = () => {
    const textOnly = entry.content.replace(/!\[\]\([^)]+\)
?/g, "").trim();
    setEditContent(textOnly);
    setEditing(true);
  };

  const cancelEdit = () => { setEditing(false); setEditContent(""); };

  const saveEdit = async () => {
    if (!taskId) return;
    setSaving(true);
    try {
      const base = import.meta.env.VITE_API_URL || "/api";
      const token = localStorage.getItem("bsl_mc_token");
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const imageRefs = entry.content.match(/!\[\]\([^)]+\)/g) || [];
      let newContent = editContent.trim();
      if (imageRefs.length > 0) {
        newContent = newContent ? `${newContent}
${imageRefs.join("
")}` : imageRefs.join("
");
      }
      await fetch(`${base}/tasks/${taskId}/activity/${entry.id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ content: newContent, author: "steve" }),
      });
      setEditing(false);
      onEdited?.();
    } catch (err) {
      console.error("Failed to edit comment:", err);
    } finally {
      setSaving(false);
    }
  };

  if (entry.type === "comment") {
    return (
      <div className="flex gap-2.5 group/comment" data-testid={`activity-comment-${entry.id}`}>
        <div className={`flex items-center justify-center w-6 h-6 rounded-full flex-shrink-0 mt-0.5 ${authorMeta.className}`}>
          <User className="w-3 h-3" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs font-medium text-foreground">{authorMeta.label}</span>
            <span className="text-xs text-muted-foreground/60">{timeAgo(entry.created_at)}</span>
            {entry.content.includes("(edited)") ? null : !editing && (
              <>
                <button
                  onClick={startEdit}
                  className="opacity-0 group-hover/comment:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted"
                  data-testid={`button-edit-comment-${entry.id}`}
                >
                  <Pencil className="w-3 h-3 text-muted-foreground" />
                </button>
                <button
                  onClick={async () => {
                    if (!confirm("Delete this comment?")) return;
                    try {
                      await apiRequest("DELETE", `/tasks/${taskId}/activity/${entry.id}`, {});
                      onEdited?.();
                    } catch (err) { console.error("Delete failed:", err); }
                  }}
                  className="opacity-0 group-hover/comment:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted"
                  data-testid={`button-delete-comment-${entry.id}`}
                >
                  <Trash2 className="w-3 h-3 text-muted-foreground hover:text-red-500" />
                </button>
              </>
            )}
          </div>
          {editing ? (
            <div className="space-y-2">
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="text-sm min-h-[60px]"
                data-testid={`textarea-edit-comment-${entry.id}`}
                autoFocus
              />
              <div className="flex gap-1.5">
                <Button size="sm" className="h-6 text-xs px-2" onClick={saveEdit} disabled={saving || !editContent.trim()} data-testid={`button-save-comment-${entry.id}`}>
                  {saving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Check className="w-3 h-3 mr-1" />}
                  Save
                </Button>
                <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={cancelEdit} disabled={saving} data-testid={`button-cancel-edit-${entry.id}`}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="bg-muted/50 border border-border rounded-lg rounded-tl-none px-3 py-2">
              <CommentContent content={entry.content} entryId={entry.id} fallbackImageUrl={entry.image_url} />
            </div>
          )}
        </div>
      </div>
    );
  }

  if (entry.type === "status_change") {
    const newLabel = COLUMNS.find(c => c.id === entry.new_value)?.label ?? entry.new_value;
    return (
      <div className="flex items-center gap-2 py-1" data-testid={`activity-status-${entry.id}`}>
        <ArrowRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
        <span className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground/80">{authorMeta.label}</span>
          {" moved to "}
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">
            {newLabel}
          </span>
        </span>
        <span className="text-xs text-muted-foreground/50 ml-auto flex-shrink-0">{timeAgo(entry.created_at)}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 py-1" data-testid={`activity-field-${entry.id}`}>
      <span className="w-3 h-3 flex-shrink-0" />
      <span className="text-xs text-muted-foreground/70">
        <span className="font-medium text-muted-foreground">{authorMeta.label}</span>
        {" "}
        {entry.content}
      </span>
      <span className="text-xs text-muted-foreground/50 ml-auto flex-shrink-0">{timeAgo(entry.created_at)}</span>
    </div>
  );
}

interface TaskModalProps {
  task: Task | null;
  open: boolean;
  onClose: () => void;
  onSave: (updates: Partial<Task>) => void;
  onDelete: (id: string) => void;
  projectOptions: string[];
}

function getFiredReminderKeys(): Set<string> {
  try {
    const stored = localStorage.getItem("fired_reminder_keys");
    return new Set(stored ? JSON.parse(stored) : []);
  } catch { return new Set(); }
}

function markReminderFired(key: string) {
  const keys = getFiredReminderKeys();
  keys.add(key);
  // keep last 200
  const arr = Array.from(keys).slice(-200);
  localStorage.setItem("fired_reminder_keys", JSON.stringify(arr));
}

function getLocalReminders(): Record<string, number> {
  try {
    const stored = localStorage.getItem("task_reminders");
    return stored ? JSON.parse(stored) : {};
  } catch { return {}; }
}

function setLocalReminder(taskId: string, timestamp: number | undefined) {
  const reminders = getLocalReminders();
  if (timestamp) {
    reminders[taskId] = timestamp;
  } else {
    delete reminders[taskId];
  }
  localStorage.setItem("task_reminders", JSON.stringify(reminders));
}

// --- Reminder History ---
export interface ReminderHistoryEntry {
  id: string; // unique
  taskId: string;
  taskTitle: string;
  firedAt: number; // unix seconds
  status: "fired" | "snoozed" | "dismissed";
  snoozedUntil?: number;
}

function getReminderHistory(): ReminderHistoryEntry[] {
  try {
    const stored = localStorage.getItem("reminder_history");
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
}

function addReminderHistory(entry: ReminderHistoryEntry) {
  const history = getReminderHistory();
  // avoid duplicates for same task fired within 2 min
  const recent = history.find(h => h.taskId === entry.taskId && Math.abs(h.firedAt - entry.firedAt) < 120);
  if (!recent) {
    history.unshift(entry);
    if (history.length > 50) history.splice(50);
    localStorage.setItem("reminder_history", JSON.stringify(history));
  }
}

function updateReminderHistoryStatus(id: string, status: ReminderHistoryEntry["status"], snoozedUntil?: number) {
  const history = getReminderHistory();
  const entry = history.find(h => h.id === id);
  if (entry) {
    entry.status = status;
    if (snoozedUntil) entry.snoozedUntil = snoozedUntil;
    localStorage.setItem("reminder_history", JSON.stringify(history));
  }
}

function TaskModal({ task, open, onClose, onSave, onDelete, projectOptions }: TaskModalProps) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>("ideas");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [label, setLabel] = useState<TaskLabel>("other");
  const [assignee, setAssignee] = useState<TaskAssignee>("steve");
  const [isRepeatable, setIsRepeatable] = useState(false);
  const [cadence, setCadence] = useState<"daily" | "weekly" | "monthly">("weekly");
  const [reminderDate, setReminderDate] = useState<Date | undefined>(undefined);
  const [reminderChanged, setReminderChanged] = useState(false);
  const defaultReminderTime = () => {
    const d = new Date(Date.now() + 60 * 60 * 1000);
    d.setMinutes(0, 0, 0);
    return format(d, "HH:mm");
  };
  const [reminderTime, setReminderTime] = useState(defaultReminderTime);
  const [comment, setComment] = useState("");
  const [commentImages, setCommentImages] = useState<{ data: string; filename: string }[]>([]);
  const [submittingComment, setSubmittingComment] = useState(false);
  const activityEndRef = useRef<HTMLDivElement>(null);
  const commentFileRef = useRef<HTMLInputElement>(null);

  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const { data: taskDetail, isLoading: detailLoading } = useQuery<{ activity: ActivityEntry[]; images: TaskImage[] }>({
    queryKey: ["/tasks", task?.id],
    queryFn: async () => {
      const raw = await apiRequest<Record<string, unknown>>("GET", `/tasks/${task!.id}`);
      const activity = (Array.isArray(raw.activity) ? raw.activity : []) as ActivityEntry[];
      const images = (Array.isArray(raw.images) ? raw.images : []) as TaskImage[];
      return { activity, images };
    },
    enabled: !!task && open,
    staleTime: 10_000,
  });

  useEffect(() => {
    if (task) {
      setTitle(task.title ?? "");
      setDescription(task.description ?? "");
      setStatus(task.status ?? "ideas");
      setPriority(task.priority ?? "medium");
      setLabel(task.label ?? "other");
      setAssignee(task.assignee ?? "steve");
      setIsRepeatable(!!task.is_repeatable);
      setCadence(task.cadence ?? "weekly");
      if (task.reminder_at && task.reminder_at * 1000 > Date.now()) {
        const d = new Date(task.reminder_at * 1000);
        setReminderDate(d);
        setReminderTime(format(d, "HH:mm"));
      } else {
        // Check localStorage as fallback
        try {
          const stored = localStorage.getItem("task_reminders");
          const reminders = stored ? JSON.parse(stored) : {};
          const localReminder = reminders[task.id];
          if (localReminder && localReminder * 1000 > Date.now()) {
            const d = new Date(localReminder * 1000);
            setReminderDate(d);
            setReminderTime(format(d, "HH:mm"));
          } else {
            setReminderDate(undefined);
            setReminderTime(defaultReminderTime());
          }
        } catch {
          setReminderDate(undefined);
          setReminderTime(defaultReminderTime());
        }
      }
      setReminderChanged(false);
      setComment("");
      setCommentImages([]);
    }
  }, [task]);

  useEffect(() => {
    if (taskDetail?.activity?.length) {
      setTimeout(() => activityEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  }, [taskDetail?.activity?.length]);

  const handleSave = () => {
    let reminderAt: number | undefined;
    if (reminderDate) {
      const [hours, minutes] = reminderTime.split(":").map(Number);
      const d = new Date(reminderDate);
      d.setHours(hours, minutes, 0, 0);
      reminderAt = Math.floor(d.getTime() / 1000);
    }
    // Save to localStorage as fallback (works without backend column)
    if (task) {
      setLocalReminder(task.id, reminderAt);
    }
    onSave({
      title, description, status, priority, label, assignee,
      is_repeatable: isRepeatable ? 1 : 0,
      cadence: isRepeatable ? cadence : undefined,
      ...(reminderChanged ? { reminder_at: reminderAt ?? null } : {}),
    });
  };

  const handleSubmitComment = async () => {
    if ((!comment.trim() && commentImages.length === 0) || !task) return;
    setSubmittingComment(true);
    try {
      const uploadedUrls: string[] = [];
      for (const img of commentImages) {
        const uploadRes = await apiRequest<{ url: string }>("POST", `/tasks/${task.id}/images`, {
          data: img.data,
          filename: img.filename,
        });
        uploadedUrls.push(uploadRes.url);
      }
      let content = comment.trim();
      if (uploadedUrls.length > 0) {
        const mdImages = uploadedUrls.map(u => `![](${u})`).join("\
");
        content = content ? `${content}\
${mdImages}` : mdImages;
      }
      const body: Record<string, string> = {
        author: "steve",
        type: "comment",
        content: content || "Attached images",
      };
      if (uploadedUrls.length > 0) {
        body.image_url = uploadedUrls[0];
      }
      await apiRequest("POST", `/tasks/${task.id}/activity`, body);
      setComment("");
      setCommentImages([]);
      qc.invalidateQueries({ queryKey: ["/tasks", task.id] });
      qc.invalidateQueries({ queryKey: ["/tasks"], exact: false });
    } catch (err) {
      toast({ title: "Failed to post comment", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleCommentImageSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const newImages: { data: string; filename: string }[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      const dataUri = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      newImages.push({ data: dataUri, filename: file.name });
    }
    if (newImages.length > 0) {
      setCommentImages(prev => [...prev, ...newImages]);
    }
  };

  const handleFileUpload = async (files: FileList | File[]) => {
    if (!task || uploading) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) continue;
        const dataUri = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        await apiRequest("POST", `/tasks/${task.id}/images`, {
          data: dataUri,
          filename: file.name,
        });
      }
      qc.invalidateQueries({ queryKey: ["/tasks", task.id] });
      qc.invalidateQueries({ queryKey: ["/tasks"], exact: false });
      toast({ title: "Image uploaded" });
    } catch (err) {
      toast({ title: "Upload failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteImage = async (imageId: number) => {
    if (!task) return;
    if (!window.confirm("Delete this image?")) return;
    try {
      await apiRequest("DELETE", `/tasks/${task.id}/images/${imageId}`);
      qc.invalidateQueries({ queryKey: ["/tasks", task.id] });
      qc.invalidateQueries({ queryKey: ["/tasks"], exact: false });
      toast({ title: "Image deleted" });
    } catch (err) {
      toast({ title: "Delete failed", description: (err as Error).message, variant: "destructive" });
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) handleFileUpload(e.dataTransfer.files);
  };

  if (!task) return null;

  const activity = taskDetail?.activity ?? [];
  const images = taskDetail?.images ?? task.images ?? [];

  return (
    <>
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className=\"max-w-lg max-h-[85vh] flex flex-col\" data-testid=\"modal-task\">
        <DialogHeader>
          <DialogTitle className=\"text-base\">Edit Task</DialogTitle>
          <DialogDescription className=\"sr-only\">View and edit task details, and see activity log</DialogDescription>
        </DialogHeader>
        <div className=\"flex-1 overflow-y-auto space-y-4 pt-1 pr-1\">
          <div className=\"space-y-1.5\">
            <Label className=\"text-xs text-muted-foreground uppercase tracking-wide\">Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              data-testid=\"input-task-title\"
              placeholder=\"Task title\"
            />
          </div>
          <div className=\"space-y-1.5\">
            <Label className=\"text-xs text-muted-foreground uppercase tracking-wide\">Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              data-testid=\"input-task-description\"
              placeholder=\"Optional description...\"
              className=\"resize-none\"
              rows={3}
            />
          </div>
          <div className=\"grid grid-cols-2 gap-3\">
            <div className=\"space-y-1.5\">
              <Label className=\"text-xs text-muted-foreground uppercase tracking-wide\">Column</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
                <SelectTrigger data-testid=\"select-task-status\">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALL_STATUSES.map(s => (
                    <SelectItem key={s} value={s}>{COLUMNS.find(c => c.id === s)?.label ?? s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className=\"space-y-1.5\">
              <Label className=\"text-xs text-muted-foreground uppercase tracking-wide\">Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                <SelectTrigger data-testid=\"select-task-priority\">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALL_PRIORITIES.map(p => (
                    <SelectItem key={p} value={p}>{PRIORITY_META[p].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className=\"space-y-1.5\">
              <Label className=\"text-xs text-muted-foreground uppercase tracking-wide\">Project</Label>
              <Select value={label} onValueChange={(v) => setLabel(v)}>
                <SelectTrigger data-testid=\"select-task-label\">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {projectOptions.map(l => (
                    <SelectItem key={l} value={l}>{(LABEL_META[l] ?? { label: l }).label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className=\"space-y-1.5\">
              <Label className=\"text-xs text-muted-foreground uppercase tracking-wide\">Assigned To</Label>
              <Select value={assignee} onValueChange={(v) => setAssignee(v)}>
                <SelectTrigger data-testid=\"select-task-assignee\">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALL_ASSIGNEES.map(a => (
                    <SelectItem key={a} value={a}>{(ASSIGNEE_META[a] ?? { label: a }).label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className=\"space-y-3 pt-1\">
            <div className=\"flex items-center justify-between\">
              <Label className=\"text-xs text-muted-foreground uppercase tracking-wide\">Repeatable</Label>
              <Switch checked={isRepeatable} onCheckedChange={setIsRepeatable} data-testid=\"switch-repeatable\" />
            </div>
            {isRepeatable && (
              <div className=\"space-y-1.5\">
                <Label className=\"text-xs text-muted-foreground uppercase tracking-wide\">Cadence</Label>
                <Select value={cadence} onValueChange={(v) => setCadence(v as \"daily\" | \"weekly\" | \"monthly\")}>
                  <SelectTrigger data-testid=\"select-cadence\">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value=\"daily\">Daily</SelectItem>
                    <SelectItem value=\"weekly\">Weekly</SelectItem>
                    <SelectItem value=\"monthly\">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className=\"space-y-3 pt-1\">
            <div className=\"flex items-center justify-between\">
              <Label className=\"text-xs text-muted-foreground uppercase tracking-wide\">Reminder</Label>
              <Switch checked={!!reminderDate} onCheckedChange={(checked) => { setReminderDate(checked ? new Date() : undefined); setReminderChanged(true); }} />
            </div>
            {reminderDate && (
              <div className=\"flex gap-2\">
                <div className=\"flex-1\">
                  <Calendar
                    mode=\"single\"
                    selected={reminderDate}
                    onSelect={(d) => { setReminderDate(d); setReminderChanged(true); }}
                    fromDate={new Date()}
                    className=\"rounded-md border\"
                  />
                </div>
                <div className=\"space-y-1.5\">
                  <Label className=\"text-xs text-muted-foreground\">Time</Label>
                  <Input
                    type=\"time\"
                    value={reminderTime}
                    onChange={(e) => { setReminderTime(e.target.value); setReminderChanged(true); }}
                    className=\"w-24\"
                  />
                  {reminderDate && (
                    <Button
                      variant=\"ghost\"
                      size=\"sm\"
                      onClick={() => setReminderDate(undefined)}
                      className=\"w-full text-xs text-destructive\"
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className=\"border-t border-border pt-3\">
            <div className=\"flex items-center gap-2 mb-2\">
              <ImageIcon className=\"w-3.5 h-3.5 text-muted-foreground\" />
              <Label className=\"text-xs text-muted-foreground uppercase tracking-wide\">Images</Label>
              {images.length > 0 && (
                <span className=\"text-xs text-muted-foreground/60\">({images.length})</span>
              )}
            </div>
            {images.length > 0 && (
              <div className=\"grid grid-cols-4 gap-2 mb-2\">
                {images.map(img => (
                  <div key={img.id} className=\"relative group\" data-testid={`image-thumb-${img.id}`}>
                    <button
                      onClick={() => setLightboxUrl(img.url)}
                      className=\"w-full aspect-square rounded-md overflow-hidden border border-border bg-muted\"
                    >
                      <img src={img.url} alt={img.filename} className=\"w-full h-full object-cover\" />
                    </button>
                    <button
                      onClick={() => handleDeleteImage(img.id)}
                      className=\"absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity\"
                      data-testid={`button-delete-image-${img.id}`}
                    >
                      <X className=\"w-3 h-3\" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`flex items-center justify-center gap-2 p-3 rounded-md border-2 border-dashed cursor-pointer transition-colors
                ${dragOver ? \"border-primary bg-primary/5\" : \"border-border hover:border-primary/40\"}`}
              data-testid=\"dropzone-images\"
            >
              {uploading ? (
                <Loader2 className=\"w-4 h-4 animate-spin text-muted-foreground\" />
              ) : (
                <Upload className=\"w-4 h-4 text-muted-foreground\" />
              )}
              <span className=\"text-xs text-muted-foreground\">
                {uploading ? \"Uploading...\" : \"Drop image or click to browse\"}
              </span>
              <input
                ref={fileInputRef}
                type=\"file\"
                accept=\"image/*\"
                multiple
                className=\"hidden\"
                onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
                data-testid=\"input-file-images\"
              />
            </div>
          </div>

          <div className=\"flex items-center justify-between pt-1\">
            <Button
              variant=\"destructive\"
              size=\"sm\"
              onClick={() => onDelete(task.id)}
              data-testid=\"button-delete-task\"
            >
              Delete
            </Button>
            <div className=\"flex gap-2\">
              <Button variant=\"ghost\" size=\"sm\" onClick={onClose} data-testid=\"button-cancel-task\">
                Cancel
              </Button>
              <Button size=\"sm\" onClick={handleSave} data-testid=\"button-save-task\">
                Save Changes
              </Button>
            </div>
          </div>

          <div className=\"border-t border-border pt-3\">
            <div className=\"flex items-center gap-2 mb-3\">
              <MessageSquare className=\"w-3.5 h-3.5 text-muted-foreground\" />
              <Label className=\"text-xs text-muted-foreground uppercase tracking-wide\">Activity</Label>
            </div>
            {detailLoading ? (
              <div className=\"space-y-2\">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className=\"h-8 rounded\" />)}
              </div>
            ) : activity.length === 0 ? (
              <p className=\"text-xs text-muted-foreground/60 py-4 text-center\">No activity yet</p>
            ) : (
              <div className=\"space-y-2.5 mb-3\">
                {activity.map(entry => (
                  <ActivityItem key={entry.id} entry={entry} taskId={task?.id} onEdited={() => qc.invalidateQueries({ queryKey: [\"/tasks\", task?.id] })} />
                ))}
                <div ref={activityEndRef} />
              </div>
            )}

            {commentImages.length > 0 && (
              <div className=\"flex gap-2 mb-2 flex-wrap\">
                {commentImages.map((img, i) => (
                  <div key={i} className=\"relative group\">
                    <img src={img.data} alt={img.filename} className=\"w-14 h-14 object-cover rounded border border-border\" />
                    <button
                      onClick={() => setCommentImages(prev => prev.filter((_, j) => j !== i))}
                      className=\"absolute -top-1.5 -right-1.5 w-4 h-4 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity\"
                      data-testid={`button-remove-comment-image-${i}`}
                    >
                      <X className=\"w-2.5 h-2.5\" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className=\"flex gap-2\">
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder=\"Add a comment... (Shift+Enter for new line)\"
                className=\"text-sm min-h-[40px] max-h-[120px] resize-none\"
                data-testid=\"input-comment\"
                onKeyDown={(e) => { if (e.key === \"Enter\" && !e.shiftKey) { e.preventDefault(); handleSubmitComment(); } }}
                rows={1}
              />
              <Button
                size=\"icon\"
                variant=\"ghost\"
                onClick={() => commentFileRef.current?.click()}
                className=\"flex-shrink-0\"
                data-testid=\"button-attach-comment-image\"
              >
                <ImageIcon className=\"w-3.5 h-3.5\" />
              </Button>
              <input
                ref={commentFileRef}
                type=\"file\"
                accept=\"image/*\"
                multiple
                className=\"hidden\"
                onChange={(e) => { handleCommentImageSelect(e.target.files); e.target.value = \"\"; }}
              />
              <Button
                size=\"icon\"
                variant=\"secondary\"
                onClick={handleSubmitComment}
                disabled={(!comment.trim() && commentImages.length === 0) || submittingComment}
                data-testid=\"button-submit-comment\"
                className=\"flex-shrink-0\"
              >
                {submittingComment ? <Loader2 className=\"w-3.5 h-3.5 animate-spin\" /> : <Send className=\"w-3.5 h-3.5\" />}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {lightboxUrl && (
      <Dialog open onOpenChange={() => setLightboxUrl(null)}>
        <DialogContent className=\"max-w-3xl p-2 bg-black/90 border-none\" data-testid=\"lightbox\">
          <DialogHeader className=\"sr-only\">
            <DialogTitle>Image Preview</DialogTitle>
            <DialogDescription>Full size image</DialogDescription>
          </DialogHeader>
          <img
            src={lightboxUrl}
            alt=\"Full size\"
            className=\"w-full h-auto max-h-[80vh] object-contain rounded\"
          />
        </DialogContent>
      </Dialog>
    )}
    </>
  );
}

interface AddCardFormProps {
  columnId: TaskStatus;
  onAdd: (title: string, status: TaskStatus) => void;
  onCancel: () => void;
}

function AddCardForm({ columnId, onAdd, onCancel }: AddCardFormProps) {
  const [title, setTitle] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim()) onAdd(title.trim(), columnId);
  };

  return (
    <form onSubmit={handleSubmit} className=\"mt-2\">
      <Input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder=\"Card title...\"
        className=\"mb-2 text-sm\"
        data-testid={`input-new-card-${columnId}`}
        onKeyDown={(e) => e.key === \"Escape\" && onCancel()}
      />
      <div className=\"flex gap-2\">
        <Button type=\"submit\" size=\"sm\" disabled={!title.trim()} data-testid={`button-add-card-${columnId}`}>
          Add
        </Button>
        <Button type=\"button\" variant=\"ghost\" size=\"sm\" onClick={onCancel} data-testid={`button-cancel-add-${columnId}`}>
          <X className=\"w-3.5 h-3.5\" />
        </Button>
      </div>
    </form>
  );\
}

export default function MissionBoard() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [filterLabel, setFilterLabel] = useState<TaskLabel | \"all\">(\"all\");
  const [filterAssignee, setFilterAssignee] = useState<string>(\"all\");
  const [hideWithReminder, setHideWithReminder] = useState(false);
  const [addingColumn, setAddingColumn] = useState<TaskStatus | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [checkingTasks, setCheckingTasks] = useState(false);
  const [searchInput, setSearchInput] = useState(\"\");
  const [searchQuery, setSearchQuery] = useState(\"\");

  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data: tasks, isLoading, error, dataUpdatedAt } = useQuery<Task[]>({
    queryKey: ["/tasks", searchQuery],
    queryFn: async ({ queryKey }) => {
      const q = queryKey[1] as string;
      const url = q ? `/tasks?q=${encodeURIComponent(q)}` : "/tasks";
      const raw = await apiRequest<Record<string, unknown>[]>(\"GET\", url);
      return (Array.isArray(raw) ? raw : []) as Task[];
    },
    staleTime: 30000,
  });

  useEffect(() => {
    if (dataUpdatedAt) setLastUpdated(new Date(dataUpdatedAt));
  }, [dataUpdatedAt]);

  useEffect(() => {
    const poll = () => {
      if (document.visibilityState === \"visible\") {
        qc.invalidateQueries({ queryKey: ["/tasks"], exact: false });
      }
    };
    const id = setInterval(poll, 30000);
    const onVisChange = () => {
      if (document.visibilityState === \"visible\") {
        qc.invalidateQueries({ queryKey: ["/tasks"], exact: false });
      }
    };
    document.addEventListener(\"visibilitychange\", onVisChange);
    return () => { clearInterval(id); document.removeEventListener(\"visibilitychange\", onVisChange); };
  }, [qc]);

    // Reminder notifications
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | \"checking\">(\"checking\");
  const [reminderHistory, setReminderHistory] = useState<ReminderHistoryEntry[]>(() => {
    // purge any entries from the 1970s (caused by localStorage seconds/ms unit bug)
    const history = getReminderHistory().filter(h => h.firedAt > 1000000000);
    localStorage.setItem("reminder_history", JSON.stringify(history));
    return history;
  });
  const [reminderPanelOpen, setReminderPanelOpen] = useState(false);
  const unreadReminderCount = reminderHistory.filter(h => h.status === "fired").length;

  const refreshReminderHistory = () => setReminderHistory(getReminderHistory());

  const handleSnooze = (entry: ReminderHistoryEntry, minutes: number) => {
    const snoozedUntil = Math.floor(Date.now() / 1000) + minutes * 60;
    updateReminderHistoryStatus(entry.id, "snoozed", snoozedUntil);
    setLocalReminder(entry.taskId, snoozedUntil);
    // also patch backend
    apiRequest("PATCH", `/tasks/${entry.taskId}`, { reminder_at: snoozedUntil }).catch(() => {});
    refreshReminderHistory();
  };

  const handleDismissReminder = (entry: ReminderHistoryEntry) => {
    updateReminderHistoryStatus(entry.id, "dismissed");
    setLocalReminder(entry.taskId, undefined);
    apiRequest("PATCH", `/tasks/${entry.taskId}`, { reminder_at: null }).catch(() => {});
    refreshReminderHistory();
  };

  useEffect(() => {
    if (!("Notification" in window)) {
      setNotificationPermission("denied");
      return;
    }
    if (Notification.permission !== "default") {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  useEffect(() => {
    const checkReminders = () => {
      const now = Date.now();
      const localReminders = getLocalReminders();
      const firedKeys = getFiredReminderKeys();
      const allTasks = tasks || [];
      allTasks.forEach(task => {
        const reminderTime = task.reminder_at ? task.reminder_at * 1000 : (localReminders[task.id] ? localReminders[task.id] * 1000 : null);
        if (!reminderTime || reminderTime > now) return; // not yet due
        const key = `${task.id}-${Math.floor(reminderTime / 1000)}`;
        if (firedKeys.has(key)) return; // already fired this session
        markReminderFired(key);
        const entry: ReminderHistoryEntry = {
          id: key,
          taskId: String(task.id),
          taskTitle: task.title,
          firedAt: Math.floor(reminderTime / 1000),
          status: "fired",
        };
        addReminderHistory(entry);
        refreshReminderHistory();
        if (Notification.permission === "granted") {
          const notif = new Notification(`Reminder: ${task.title}`, {
            body: task.description?.slice(0, 100) || "Task reminder",
            icon: "/favicon.ico",
            tag: `task-${task.id}`,
            requireInteraction: true,
          });
          notif.onclick = () => { window.focus(); notif.close(); };
        }
      });
    };
    const id = setInterval(checkReminders, 30000);
    checkReminders();
    return () => clearInterval(id);
  }, [tasks]);

  const handleManualRefresh = async () => {
    setRefreshing(true);
    await qc.invalidateQueries({ queryKey: ["/tasks"], exact: false });
    setRefreshing(false);
  };

  const handleCheckTasks = async () => {
    setCheckingTasks(true);
    try {
      const base = import.meta.env.VITE_API_URL || "/api";
      const token = localStorage.getItem("bsl_mc_token");
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      let res: Response;
      try {
        res = await fetch(`${base}/clawbot/check-tasks`, { method: "POST", headers });
      } catch (_networkErr) {
        toast({ title: "Failed to reach Clawbot", variant: "destructive" });
        setCheckingTasks(false);
        return;
      }
      if (res.ok) {

        toast({ title: "🦞 Clawbot is on it!", className: "bg-emerald-600 text-white border-emerald-700" });
      } else {
        toast({ title: "Failed to reach Clawbot", variant: "destructive" });
      }
    } catch (err) {
      console.error("Check tasks error:", err);
      toast({ title: "Failed to reach Clawbot", variant: "destructive" });
    }
    setCheckingTasks(false);
  };

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiRequest<Task>("POST", "/tasks", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/tasks"], exact: false }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: Record<string, unknown> & { id: string }) =>
      apiRequest<Task>("PATCH", `/tasks/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/tasks"], exact: false }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/tasks/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/tasks"], exact: false }),
  });

  const handleDragEnd = useCallback((result: DropResult) => {
    if (!result.destination) return;
    const taskId = result.draggableId;
    const newStatus = result.destination.droppableId as TaskStatus;
    updateMutation.mutate({ id: taskId, status: newStatus, author: "steve" });
  }, [updateMutation]);

  const handleAddCard = (title: string, status: TaskStatus) => {
    createMutation.mutate({
      title,
      status,
      priority: "medium",
      project: "other",
      assigned_to: "steve",
    });
    setAddingColumn(null);
  };

  const handleSaveTask = async (updates: Partial<Task>) => {
    if (!selectedTask) return;
    const apiData = toApiPayload(updates);
    try {
      await updateMutation.mutateAsync({ id: selectedTask.id, ...apiData, author: "steve" });
      // Directly update the exact query key used by the tasks list
      qc.setQueryData(["/tasks", searchQuery], (old: unknown) => {
        if (!Array.isArray(old)) return old;
        return old.map((t: Task) => t.id === selectedTask.id ? { ...t, ...updates } : t);
      });
    } catch (err) {
      console.error("Save task failed:", err);
    }
    setModalOpen(false);
    setSelectedTask(null);
  };

  const handleDeleteTask = async (id: string) => {
    await deleteMutation.mutateAsync(id);
    await qc.refetchQueries({ queryKey: ["/tasks"], exact: false });
    setModalOpen(false);
    setSelectedTask(null);
  };

  const repeatableTasks = (tasks ?? []).filter(t => !!t.is_repeatable &&
    (filterLabel === "all" || t.label === filterLabel) &&
    (filterAssignee === "all" || t.assignee === filterAssignee)
  );

  const filteredTasks = (tasks ?? []).filter(
    t => (filterLabel === "all" || t.label === filterLabel) &&
         (filterAssignee === "all" || t.assignee === filterAssignee) &&
         (!hideWithReminder || !t.reminder_at)
  );

  const tasksByColumn = (status: TaskStatus) =>
    filteredTasks.filter(t => t.status === status && !t.is_repeatable);

  const columnColors: Record<TaskStatus, string> = {
    ideas: "text-amber-500 dark:text-amber-400",
    inprogress: "text-blue-500 dark:text-blue-400",
    review: "text-violet-500 dark:text-violet-400",
    complete: "text-emerald-500 dark:text-emerald-400",
  };

  return (
    <div className=\"h-full flex flex-col\">
      <div className=\"flex items-center justify-between px-5 py-3 border-b border-border bg-background flex-wrap gap-2\">
        <div className=\"flex items-center gap-3\">
          <h1 className=\"text-base font-semibold text-foreground\">Mission Board</h1>
          <Button
            size=\"sm\"
            onClick={handleCheckTasks}
            disabled={checkingTasks}
            className=\"h-7 text-xs\"
            data-testid=\"button-check-tasks\"
          >
            {checkingTasks ? <Loader2 className=\"w-3.5 h-3.5 animate-spin mr-1.5\" /> : <span className=\"mr-1.5\">🦞</span>}
            {checkingTasks ? \"Checking…\" : \"Check Tasks\"}
          </Button>

        </div>
        <div className=\"relative\">
          <Search className=\"absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none\" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder=\"Search tasks…\"
            className=\"h-7 text-xs pl-8 pr-7 w-48\"
            data-testid=\"input-search-tasks\"
          />
          {searchInput && (
            <button
              onClick={() => setSearchInput(\"\")}
              className=\"absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground\"
              data-testid=\"button-clear-search\"
            >
              <X className=\"w-3.5 h-3.5\" />
            </button>
          )}
        </div>
        <div className=\"flex items-center gap-2 flex-wrap\">
          <span className=\"text-xs text-muted-foreground\">Filter:</span>
          <div className=\"flex gap-1.5 flex-wrap\">
            <button
              className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${filterLabel === "all" ? "bg-primary text-primary-foreground border-primary" : "bg-card border-card-border text-muted-foreground"}`}
              onClick={() => setFilterLabel("all")}
              data-testid=\"filter-all\"
            >
              All
            </button>
            {ALL_PROJECTS.map(l => (
              <button
                key={l}
                className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${filterLabel === l ? "bg-primary text-primary-foreground border-primary" : "bg-card border-card-border text-muted-foreground"}`}
                onClick={() => setFilterLabel(l)}
                data-testid={`filter-${l}`}
              >
                {LABEL_META[l].label}
              </button>
            ))}
          </div>
        </div>
        <div className=\"flex items-center gap-2 flex-wrap\">
          <span className=\"text-xs text-muted-foreground\">Assignee:</span>
          <div className=\"flex gap-1.5\">
            {[{ value: "all", label: "All" }, { value: "steve", label: "Steve" }, { value: "clawbot", label: "Clawbot" }].map(opt => (
              <button
                key={opt.value}
                className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${filterAssignee === opt.value ? "bg-primary text-primary-foreground border-primary" : "bg-card border-card-border text-muted-foreground"}`}
                onClick={() => setFilterAssignee(opt.value)}
                data-testid={`filter-assignee-${opt.value}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className=\"flex items-center gap-2 flex-wrap\">
          <span className=\"text-xs text-muted-foreground\">Hide:</span>
          <button
            className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${hideWithReminder ? "bg-primary text-primary-foreground border-primary" : "bg-card border-card-border text-muted-foreground"}`}
            onClick={() => setHideWithReminder(!hideWithReminder)}
            data-testid=\"filter-hide-reminder\"
          >
            With Reminder
          </button>
        </div>
        <div className=\"flex items-center gap-1.5\">
          {lastUpdated && (
            <span className=\"text-xs text-muted-foreground/70\" data-testid=\"text-last-updated\">
              Last updated: {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          )}
          <button
            onClick={handleManualRefresh}
            disabled={refreshing}
            className=\"p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-50\"
            data-testid=\"button-refresh\"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          </button>

          {/* Reminder history bell */}
          <Popover open={reminderPanelOpen} onOpenChange={setReminderPanelOpen}>
            <PopoverTrigger asChild>
              <button
                className=\"relative p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors\"
                title=\"Reminder history\"
                onClick={() => { refreshReminderHistory(); setReminderPanelOpen(v => !v); }}
              >
                <Bell className=\"w-3.5 h-3.5\" />
                {unreadReminderCount > 0 && (
                  <span className=\"absolute -top-0.5 -right-0.5 w-3.5 h-3.5 flex items-center justify-center rounded-full bg-amber-500 text-white text-[9px] font-bold leading-none\">
                    {unreadReminderCount > 9 ? "9+" : unreadReminderCount}
                  </span>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent align=\"end\" className=\"w-80 p-0 max-h-[420px] flex flex-col\">
              <div className=\"flex items-center justify-between px-3 py-2 border-b border-border\">
                <span className=\"text-sm font-semibold\">Reminder History</span>
                {reminderHistory.length > 0 && (
                  <button
                    className=\"text-xs text-muted-foreground hover:text-foreground\"
                    onClick={() => { localStorage.removeItem("reminder_history"); refreshReminderHistory(); }}
                  >
                    Clear all
                  </button>
                )}
              </div>
              <div className=\"overflow-y-auto flex-1\">
                {reminderHistory.length === 0 ? (
                  <div className=\"px-3 py-6 text-center text-xs text-muted-foreground\">No reminders yet</div>
                ) : (
                  reminderHistory.map(entry => {
                    const linkedTask = tasks?.find(t => String(t.id) === entry.taskId);
                    return (
                      <div
                        key={entry.id}
                        className={`px-3 py-2 border-b border-border last:border-0 hover:bg-muted/30 ${linkedTask ? 'cursor-pointer' : ''}`}
                        onClick={() => {
                          if (linkedTask) {
                            setSelectedTask(linkedTask);
                            setModalOpen(true);
                            setReminderPanelOpen(false);
                          }
                        }}>
                        <div className=\"flex items-start justify-between gap-2\">
                          <div className=\"flex-1 min-w-0\">
                            <p className={`text-xs font-medium truncate ${linkedTask ? 'text-primary hover:underline' : ''}`}>{entry.taskTitle}</p>
                          <p className=\"text-[10px] text-muted-foreground mt-0.5\">
                            {format(new Date(entry.firedAt * 1000), "d MMM, HH:mm")}
                            {entry.status === "snoozed" && entry.snoozedUntil && (
                              <> · Snoozed until {format(new Date(entry.snoozedUntil * 1000), "HH:mm")}</>
                            )}
                          </p>
                        </div>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${
                          entry.status === "fired" ? "bg-amber-500/15 text-amber-600" :
                          entry.status === "snoozed" ? "bg-blue-500/15 text-blue-600" :
                          "bg-muted text-muted-foreground"
                        }`}>
                          {entry.status}
                        </span>
                      </div>
                      {entry.status !== "dismissed" && (
                        <div className=\"flex gap-1 mt-1.5\">
                          <button
                            className=\"text-[10px] px-2 py-0.5 rounded border border-border hover:bg-muted/50 text-muted-foreground\"
                            onClick={() => handleSnooze(entry, 15)}
                          >+15m</button>
                          <button
                            className=\"text-[10px] px-2 py-0.5 rounded border border-border hover:bg-muted/50 text-muted-foreground\"
                            onClick={() => handleSnooze(entry, 60)}
                          >+1h</button>
                          <button
                            className=\"text-[10px] px-2 py-0.5 rounded border border-border hover:bg-muted/50 text-muted-foreground\"
                            onClick={() => handleSnooze(entry, 1440)}
                          >+1d</button>
                          <button
                            className=\"text-[10px] px-2 py-0.5 rounded border border-destructive/40 hover:bg-destructive/10 text-destructive ml-auto\"
                            onClick={() => handleDismissReminder(entry)}
                          >Dismiss</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {notificationPermission !== "granted" && (
                <div className=\"px-3 py-2 border-t border-border bg-amber-500/5\">
                  <button
                    className=\"text-xs text-amber-600 hover:underline w-full text-left\"
                    onClick={() => Notification.requestPermission().then(p => setNotificationPermission(p))}
                  >
                    ⚠ Enable push notifications to receive alerts
                  </button>
                </div>
              )}
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {error && (
        <div className=\"flex items-center gap-2 mx-5 mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm\">
          <AlertCircle className=\"w-4 h-4 flex-shrink-0\" />
          <span>Could not load tasks. Check your API URL configuration.</span>
        </div>
      )}

      <div className=\"flex-1 overflow-auto\">
        <div className=\"flex flex-col md:flex-row gap-4 p-5 md:min-w-max\">
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className=\"contents\">
            {COLUMNS.map(col => {
              const colTasks = tasksByColumn(col.id);
              const ColIcon = col.icon;
              return (
                <div
                  key={col.id}
                  className=\"flex flex-col w-full md:w-72 md:flex-shrink-0\"
                  data-testid={`column-${col.id}`}
                >
                  <div className=\"flex items-center justify-between mb-3\">
                    <div className=\"flex items-center gap-2\">
                      <ColIcon className={`w-4 h-4 ${columnColors[col.id]}`} />
                      <span className=\"text-sm font-semibold text-foreground\">{col.label}</span>
                      <span className=\"text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full\">
                        {colTasks.length}
                      </span>
                    </div>
                    <Button
                      size=\"icon\"
                      variant=\"ghost\"
                      onClick={() => setAddingColumn(col.id)}
                      data-testid={`button-add-${col.id}`}
                      className=\"h-7 w-7\"
                    >
                      <Plus className=\"w-3.5 h-3.5\" />
                    </Button>
                  </div>

                  <Droppable droppableId={col.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`md:flex-1 rounded-md min-h-32 p-2 transition-colors ${snapshot.isDraggingOver ? "bg-primary/5 border border-primary/20" : "bg-muted/30 border border-border/50"}`}
                      >
                        {isLoading ? (
                          Array.from({ length: 2 }).map((_, i) => (
                            <Skeleton key={i} className=\"h-20 mb-2 rounded-md\" />
                          ))
                        ) : (
                          colTasks.map((task, index) => (
                            <TaskCard
                              key={task.id}
                              task={task}
                              index={index}
                              onClick={() => { setSelectedTask(task); setModalOpen(true); }}
                            />
                          ))
                        )}
                        {provided.placeholder}

                        {addingColumn === col.id && (
                          <AddCardForm
                            columnId={col.id}
                            onAdd={handleAddCard}
                            onCancel={() => setAddingColumn(null)}
                          />
                        )}

                        {!isLoading && colTasks.length === 0 && addingColumn !== col.id && (
                          <div className=\"flex items-center justify-center h-16 text-xs text-muted-foreground/60\">
                            Drop cards here
                          </div>
                        )}
                      </div>
                    )}
                  </Droppable>
                </div>
              );
            })}
          </div>
        </DragDropContext>

        <div className=\"flex flex-col w-full md:w-72 md:flex-shrink-0\" data-testid=\"column-repeatable\">
          <div className=\"flex items-center gap-2 mb-3\">
            <Repeat className=\"w-4 h-4 text-violet-500 dark:text-violet-400\" />
            <span className=\"text-sm font-semibold text-foreground\">Repeatable</span>
            <span className=\"text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full\">
              {repeatableTasks.length}
            </span>
          </div>
          <div className=\"md:flex-1 rounded-md min-h-32 p-2 bg-violet-500/5 border border-violet-500/20\">
            {isLoading ? (
              Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className=\"h-20 mb-2 rounded-md\" />
              ))
            ) : repeatableTasks.length === 0 ? (
              <div className=\"flex items-center justify-center h-16 text-xs text-muted-foreground/60\">
                No repeatable tasks
              </div>
            ) : (
              repeatableTasks.map(task => (
                <div
                  key={task.id}
                  className=\"bg-card border border-card-border rounded-md p-3 mb-2 cursor-pointer select-none hover-elevate\"
                  onClick={() => { setSelectedTask(task); setModalOpen(true); }}
                  data-testid={`card-repeatable-${task.id}`}
                >
                  <div className=\"flex items-start justify-between gap-2 mb-1.5\">
                    <p className=\"text-sm font-medium text-card-foreground leading-snug flex-1\">{task.title}</p>
                    <div className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium whitespace-nowrap ${(PRIORITY_META[task.priority] ?? PRIORITY_META.medium).className}`}>
                      {(PRIORITY_META[task.priority] ?? PRIORITY_META.medium).label}
                    </div>
                  </div>
                  <div className=\"flex flex-wrap items-center gap-1.5\">
                    <span className=\"inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-violet-500/15 text-violet-500 dark:text-violet-300\">
                      <Repeat className=\"w-2.5 h-2.5\" />
                      {task.cadence ? task.cadence.charAt(0).toUpperCase() + task.cadence.slice(1) : \"Repeating\"}
                    </span>
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${(LABEL_META[task.label] ?? LABEL_META.other).className}`}>
                      {(LABEL_META[task.label] ?? LABEL_META.other).label}
                    </span>
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${(ASSIGNEE_META[task.assignee] ?? ASSIGNEE_META.steve).className}`}>
                      {(ASSIGNEE_META[task.assignee] ?? ASSIGNEE_META.steve).label}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        </div>
      </div>

      <TaskModal
        task={selectedTask}
        open={modalOpen}
        onClose={() => { setModalOpen(false); setSelectedTask(null); }}
        onSave={handleSaveTask}
        onDelete={handleDeleteTask}
        projectOptions={[...ALL_PROJECTS]}
      />
    </div>
  );\
}
