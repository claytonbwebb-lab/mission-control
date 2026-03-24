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
    const textOnly = entry.content.replace(/!\[\]\([^)]+\)\n?/g, "").trim();
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
        newContent = newContent ? `${newContent}\n${imageRefs.join("\n")}` : imageRefs.join("\n");
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

  const { data: taskDetail, isLoading: detailLoading } = useQuery<{ activity: ActivityEntry[]; images: TaskImage[] }>({\n    queryKey: ["/tasks", task?.id],\n    queryFn: async () => {\n      const raw = await apiRequest<Record<string, unknown>>("GET", `/tasks/${task!.id}`);\n      const activity = (Array.isArray(raw.activity) ? raw.activity : []) as ActivityEntry[];\n      const images = (Array.isArray(raw.images) ? raw.images : []) as TaskImage[];\n      return { activity, images };\n    },\n    enabled: !!task && open,\n    staleTime: 10_000,\n  });\n\n  useEffect(() => {\n    if (task) {\n      setTitle(task.title ?? "");\n      setDescription(task.description ?? "");\n      setStatus(task.status ?? "ideas");\n      setPriority(task.priority ?? "medium");\n      setLabel(task.label ?? "other");\n      setAssignee(task.assignee ?? "steve");\n      setIsRepeatable(!!task.is_repeatable);\n      setCadence(task.cadence ?? "weekly");\n      if (task.reminder_at && task.reminder_at * 1000 > Date.now()) {\n        const d = new Date(task.reminder_at * 1000);\n        setReminderDate(d);\n        setReminderTime(format(d, "HH:mm"));\n      } else {\n        // Check localStorage as fallback\n        try {\n          const stored = localStorage.getItem("task_reminders");\n          const reminders = stored ? JSON.parse(stored) : {};\n          const localReminder = reminders[task.id];\n          if (localReminder && localReminder * 1000 > Date.now()) {\n            const d = new Date(localReminder * 1000);\n            setReminderDate(d);\n            setReminderTime(format(d, "HH:mm"));\n          } else {\n            setReminderDate(undefined);\n            setReminderTime(defaultReminderTime());\n          }\n        } catch {\n          setReminderDate(undefined);\n          setReminderTime(defaultReminderTime());\n        }\n      }\n      setReminderChanged(false);\n      setComment("");\n      setCommentImages([]);\n    }\n  }, [task]);\n\n  useEffect(() => {\n    if (taskDetail?.activity?.length) {\n      setTimeout(() => activityEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);\n    }\n  }, [taskDetail?.activity?.length]);\n\n  const handleSave = () => {\n    let reminderAt: number | undefined;\n    if (reminderDate) {\n      const [hours, minutes] = reminderTime.split(":").map(Number);\n      const d = new Date(reminderDate);\n      d.setHours(hours, minutes, 0, 0);\n      reminderAt = Math.floor(d.getTime() / 1000);\n    }\n    // Save to localStorage as fallback (works without backend column)\n    if (task) {\n      setLocalReminder(task.id, reminderAt);\n    }\n    onSave({\n      title, description, status, priority, label, assignee,\n      is_repeatable: isRepeatable ? 1 : 0,\n      cadence: isRepeatable ? cadence : undefined,\n      ...(reminderChanged ? { reminder_at: reminderAt ?? null } : {}),\n    });\n  };\n\n  const handleSubmitComment = async () => {\n    if ((!comment.trim() && commentImages.length === 0) || !task) return;\n    setSubmittingComment(true);\n    try {\n      const uploadedUrls: string[] = [];\n      for (const img of commentImages) {\n        const uploadRes = await apiRequest<{ url: string }>("POST", `/tasks/${task.id}/images`, {\n          data: img.data,\n          filename: img.filename,\n        });\n        uploadedUrls.push(uploadRes.url);\n      }\n      let content = comment.trim();\n      if (uploadedUrls.length > 0) {\n        const mdImages = uploadedUrls.map(u => `![](${u})`).join("\\n");\n        content = content ? `${content}\\n${mdImages}` : mdImages;\n      }\n      const body: Record<string, string> = {\n        author: "steve",\n        type: "comment",\n        content: content || "Attached images",\n      };\n      if (uploadedUrls.length > 0) {\n        body.image_url = uploadedUrls[0];\n      }\n      await apiRequest("POST", `/tasks/${task.id}/activity`, body);\n      setComment("");\n      setCommentImages([]);\n      qc.invalidateQueries({ queryKey: ["/tasks", task.id] });\n      qc.invalidateQueries({ queryKey: ["/tasks"], exact: false });\n    } catch (err) {\n      toast({ title: "Failed to post comment", description: (err as Error).message, variant: "destructive" });\n    } finally {\n      setSubmittingComment(false);\n    }\n  };\n\n  const handleCommentImageSelect = async (files: FileList | null) => {\n    if (!files || files.length === 0) return;\n    const newImages: { data: string; filename: string }[] = [];\n    for (const file of Array.from(files)) {\n      if (!file.type.startsWith("image/")) continue;\n      const dataUri = await new Promise<string>((resolve, reject) => {\n        const reader = new FileReader();\n        reader.onload = () => resolve(reader.result as string);\n        reader.onerror = reject;\n        reader.readAsDataURL(file);\n      });\n      newImages.push({ data: dataUri, filename: file.name });\n    }\n    if (newImages.length > 0) {\n      setCommentImages(prev => [...prev, ...newImages]);\n    }\n  };\n\n  const handleFileUpload = async (files: FileList | File[]) => {\n    if (!task || uploading) return;\n    setUploading(true);\n    try {\n      for (const file of Array.from(files)) {\n        if (!file.type.startsWith("image/")) continue;\n        const dataUri = await new Promise<string>((resolve, reject) => {\n          const reader = new FileReader();\n          reader.onload = () => resolve(reader.result as string);\n          reader.onerror = reject;\n          reader.readAsDataURL(file);\n        });\n        await apiRequest("POST", `/tasks/${task.id}/images`, {\n          data: dataUri,\n          filename: file.name,\n        });\n      }\n      qc.invalidateQueries({ queryKey: ["/tasks", task.id] });\n      qc.invalidateQueries({ queryKey: ["/tasks"], exact: false });\n      toast({ title: "Image uploaded" });\n    } catch (err) {\n      toast({ title: "Upload failed", description: (err as Error).message, variant: "destructive" });\n    } finally {\n      setUploading(false);\n    }\n  };\n\n  const handleDeleteImage = async (imageId: number) => {\n    if (!task) return;\n    if (!window.confirm("Delete this image?")) return;\n    try {\n      await apiRequest("DELETE", `/tasks/${task.id}/images/${imageId}`);\n      qc.invalidateQueries({ queryKey: ["/tasks", task.id] });\n      qc.invalidateQueries({ queryKey: ["/tasks"], exact: false });\n      toast({ title: "Image deleted" });\n    } catch (err) {\n      toast({ title: "Delete failed", description: (err as Error).message, variant: "destructive" });\n    }\n  };\n\n  const handleDrop = (e: React.DragEvent) => {\n    e.preventDefault();\n    setDragOver(false);\n    if (e.dataTransfer.files.length) handleFileUpload(e.dataTransfer.files);\n  };\n\n  if (!task) return null;\n\n  const activity = taskDetail?.activity ?? [];\n  const images = taskDetail?.images ?? task.images ?? [];\n\n  return (\n    <>\n    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>\n      <DialogContent className=\"max-w-lg max-h-[85vh] flex flex-col\" data-testid=\"modal-task\">\n        <DialogHeader>\n          <DialogTitle className=\"text-base\">Edit Task</DialogTitle>\n          <DialogDescription className=\"sr-only\">View and edit task details, and see activity log</DialogDescription>\n        </DialogHeader>\n        <div className=\"flex-1 overflow-y-auto space-y-4 pt-1 pr-1\">\n          <div className=\"space-y-1.5\">\n            <Label className=\"text-xs text-muted-foreground uppercase tracking-wide\">Title</Label>\n            <Input\n              value={title}\n              onChange={(e) => setTitle(e.target.value)}\n              data-testid=\"input-task-title\"\n              placeholder=\"Task title\"\n            />\n          </div>\n          <div className=\"space-y-1.5\">\n            <Label className=\"text-xs text-muted-foreground uppercase tracking-wide\">Description</Label>\n            <Textarea\n              value={description}\n              onChange={(e) => setDescription(e.target.value)}\n              data-testid=\"input-task-description\"\n              placeholder=\"Optional description...\"\n              className=\"resize-none\"\n              rows={3}\n            />\n          </div>\n          <div className=\"grid grid-cols-2 gap-3\">\n            <div className=\"space-y-1.5\">\n              <Label className=\"text-xs text-muted-foreground uppercase tracking-wide\">Column</Label>\n              <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>\n                <SelectTrigger data-testid=\"select-task-status\">\n                  <SelectValue />\n                </SelectTrigger>\n                <SelectContent>\n                  {ALL_STATUSES.map(s => (\n                    <SelectItem key={s} value={s}>{COLUMNS.find(c => c.id === s)?.label ?? s}</SelectItem>\n                  ))}\n                </SelectContent>\n              </Select>\n            </div>\n            <div className=\"space-y-1.5\">\n              <Label className=\"text-xs text-muted-foreground uppercase tracking-wide\">Priority</Label>\n              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>\n                <SelectTrigger data-testid=\"select-task-priority\">\n                  <SelectValue />\n                </SelectTrigger>\n                <SelectContent>\n                  {ALL_PRIORITIES.map(p => (\n                    <SelectItem key={p} value={p}>{PRIORITY_META[p].label}</SelectItem>\n                  ))}\n                </SelectContent>\n              </Select>\n            </div>\n            <div className=\"space-y-1.5\">\n              <Label className=\"text-xs text-muted-foreground uppercase tracking-wide\">Project</Label>\n              <Select value={label} onValueChange={(v) => setLabel(v)}>\n                <SelectTrigger data-testid=\"select-task-label\">\n                  <SelectValue />\n                </SelectTrigger>\n                <SelectContent>\n                  {projectOptions.map(l => (\n                    <SelectItem key={l} value={l}>{(LABEL_META[l] ?? { label: l }).label}</SelectItem>\n                  ))}\n                </SelectContent>\n              </Select>\n            </div>\n            <div className=\"space-y-1.5\">\n              <Label className=\"text-xs text-muted-foreground uppercase tracking-wide\">Assigned To</Label>\n              <Select value={assignee} onValueChange={(v) => setAssignee(v)}>\n                <SelectTrigger data-testid=\"select-task-assignee\">\n                  <SelectValue />\n                </SelectTrigger>\n                <SelectContent>\n                  {ALL_ASSIGNEES.map(a => (\n                    <SelectItem key={a} value={a}>{(ASSIGNEE_META[a] ?? { label: a }).label}</SelectItem>\n                  ))}\n                </SelectContent>\n              </Select>\n            </div>\n          </div>\n\n          <div className=\"space-y-3 pt-1\">\n            <div className=\"flex items-center justify-between\">\n              <Label className=\"text-xs text-muted-foreground uppercase tracking-wide\">Repeatable</Label>\n              <Switch checked={isRepeatable} onCheckedChange={setIsRepeatable} data-testid=\"switch-repeatable\" />\n            </div>\n            {isRepeatable && (\n              <div className=\"space-y-1.5\">\n                <Label className=\"text-xs text-muted-foreground uppercase tracking-wide\">Cadence</Label>\n                <Select value={cadence} onValueChange={(v) => setCadence(v as \"daily\" | \"weekly\" | \"monthly\")}>\n                  <SelectTrigger data-testid=\"select-cadence\">\n                    <SelectValue />\n                  </SelectTrigger>\n                  <SelectContent>\n                    <SelectItem value=\"daily\">Daily</SelectItem>\n                    <SelectItem value=\"weekly\">Weekly</SelectItem>\n                    <SelectItem value=\"monthly\">Monthly</SelectItem>\n                  </SelectContent>\n                </Select>\n              </div>\n            )}\n          </div>\n\n          <div className=\"space-y-3 pt-1\">\n            <div className=\"flex items-center justify-between\">\n              <Label className=\"text-xs text-muted-foreground uppercase tracking-wide\">Reminder</Label>\n              <Switch checked={!!reminderDate} onCheckedChange={(checked) => { setReminderDate(checked ? new Date() : undefined); setReminderChanged(true); }} />\n            </div>\n            {reminderDate && (\n              <div className=\"flex gap-2\">\n                <div className=\"flex-1\">\n                  <Calendar\n                    mode=\"single\"\n                    selected={reminderDate}\n                    onSelect={(d) => { setReminderDate(d); setReminderChanged(true); }}\n                    fromDate={new Date()}\n                    className=\"rounded-md border\"\n                  />\n                </div>\n                <div className=\"space-y-1.5\">\n                  <Label className=\"text-xs text-muted-foreground\">Time</Label>\n                  <Input\n                    type=\"time\"\n                    value={reminderTime}\n                    onChange={(e) => { setReminderTime(e.target.value); setReminderChanged(true); }}\n                    className=\"w-24\"\n                  />\n                  {reminderDate && (\n                    <Button\n                      variant=\"ghost\"\n                      size=\"sm\"\n                      onClick={() => setReminderDate(undefined)}\n                      className=\"w-full text-xs text-destructive\"\n                    >\n                      Clear\n                    </Button>\n                  )}\n                </div>\n              </div>\n            )}\n          </div>\n\n          <div className=\"border-t border-border pt-3\">\n            <div className=\"flex items-center gap-2 mb-2\">\n              <ImageIcon className=\"w-3.5 h-3.5 text-muted-foreground\" />\n              <Label className=\"text-xs text-muted-foreground uppercase tracking-wide\">Images</Label>\n              {images.length > 0 && (\n                <span className=\"text-xs text-muted-foreground/60\">({images.length})</span>\n              )}\n            </div>\n            {images.length > 0 && (\n              <div className=\"grid grid-cols-4 gap-2 mb-2\">\n                {images.map(img => (\n                  <div key={img.id} className=\"relative group\" data-testid={`image-thumb-${img.id}`}>\n                    <button\n                      onClick={() => setLightboxUrl(img.url)}\n                      className=\"w-full aspect-square rounded-md overflow-hidden border border-border bg-muted\"\n                    >\n                      <img src={img.url} alt={img.filename} className=\"w-full h-full object-cover\" />\n                    </button>\n                    <button\n                      onClick={() => handleDeleteImage(img.id)}\n                      className=\"absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity\"\n                      data-testid={`button-delete-image-${img.id}`}\n                    >\n                      <X className=\"w-3 h-3\" />\n                    </button>\n                  </div>\n                ))}\n              </div>\n            )}\n            <div\n              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}\n              onDragLeave={() => setDragOver(false)}\n              onDrop={handleDrop}\n              onClick={() => fileInputRef.current?.click()}\n              className={`flex items-center justify-center gap-2 p-3 rounded-md border-2 border-dashed cursor-pointer transition-colors\n                ${dragOver ? \"border-primary bg-primary/5\" : \"border-border hover:border-primary/40\"}`}\n              data-testid=\"dropzone-images\"\n            >\n              {uploading ? (\n                <Loader2 className=\"w-4 h-4 animate-spin text-muted-foreground\" />\n              ) : (\n                <Upload className=\"w-4 h-4 text-muted-foreground\" />\n              )}\n              <span className=\"text-xs text-muted-foreground\">\n                {uploading ? \"Uploading...\" : \"Drop image or click to browse\"}\n              </span>\n              <input\n                ref={fileInputRef}\n                type=\"file\"\n                accept=\"image/*\"\n                multiple\n                className=\"hidden\"\n                onChange={(e) => e.target.files && handleFileUpload(e.target.files)}\n                data-testid=\"input-file-images\"\n              />\n            </div>\n          </div>\n\n          <div className=\"flex items-center justify-between pt-1\">\n            <Button\n              variant=\"destructive\"\n              size=\"sm\"\n              onClick={() => onDelete(task.id)}\n              data-testid=\"button-delete-task\"\n            >\n              Delete\n            </Button>\n            <div className=\"flex gap-2\">\n              <Button variant=\"ghost\" size=\"sm\" onClick={onClose} data-testid=\"button-cancel-task\">\n                Cancel\n              </Button>\n              <Button size=\"sm\" onClick={handleSave} data-testid=\"button-save-task\">\n                Save Changes\n              </Button>\n            </div>\n          </div>\n\n          <div className=\"border-t border-border pt-3\">\n            <div className=\"flex items-center gap-2 mb-3\">\n              <MessageSquare className=\"w-3.5 h-3.5 text-muted-foreground\" />\n              <Label className=\"text-xs text-muted-foreground uppercase tracking-wide\">Activity</Label>\n            </div>\n            {detailLoading ? (\n              <div className=\"space-y-2\">\n                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className=\"h-8 rounded\" />)}\n              </div>\n            ) : activity.length === 0 ? (\n              <p className=\"text-xs text-muted-foreground/60 py-4 text-center\">No activity yet</p>\n            ) : (\n              <div className=\"space-y-2.5 mb-3\">\n                {activity.map(entry => (\n                  <ActivityItem key={entry.id} entry={entry} taskId={task?.id} onEdited={() => qc.invalidateQueries({ queryKey: [\"/tasks\", task?.id] })} />\n                ))}\n                <div ref={activityEndRef} />\n              </div>\n            )}\n\n            {commentImages.length > 0 && (\n              <div className=\"flex gap-2 mb-2 flex-wrap\">\n                {commentImages.map((img, i) => (\n                  <div key={i} className=\"relative group\">\n                    <img src={img.data} alt={img.filename} className=\"w-14 h-14 object-cover rounded border border-border\" />\n                    <button\n                      onClick={() => setCommentImages(prev => prev.filter((_, j) => j !== i))}\n                      className=\"absolute -top-1.5 -right-1.5 w-4 h-4 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity\"\n                      data-testid={`button-remove-comment-image-${i}`}\n                    >\n                      <X className=\"w-2.5 h-2.5\" />\n                    </button>\n                  </div>\n                ))}\n              </div>\n            )}\n            <div className=\"flex gap-2\">\n              <Textarea\n                value={comment}\n                onChange={(e) => setComment(e.target.value)}\n                placeholder=\"Add a comment... (Shift+Enter for new line)\"\n                className=\"text-sm min-h-[40px] max-h-[120px] resize-none\"\n                data-testid=\"input-comment\"\n                onKeyDown={(e) => { if (e.key === \"Enter\" && !e.shiftKey) { e.preventDefault(); handleSubmitComment(); } }}\n                rows={1}\n              />\n              <Button\n                size=\"icon\"\n                variant=\"ghost\"\n                onClick={() => commentFileRef.current?.click()}\n                className=\"flex-shrink-0\"\n                data-testid=\"button-attach-comment-image\"\n              >\n                <ImageIcon className=\"w-3.5 h-3.5\" />\n              </Button>\n              <input\n                ref={commentFileRef}\n                type=\"file\"\n                accept=\"image/*\"\n                multiple\n                className=\"hidden\"\n                onChange={(e) => { handleCommentImageSelect(e.target.files); e.target.value = \"\"; }}\n              />\n              <Button\n                size=\"icon\"\n                variant=\"secondary\"\n                onClick={handleSubmitComment}\n                disabled={(!comment.trim() && commentImages.length === 0) || submittingComment}\n                data-testid=\"button-submit-comment\"\n                className=\"flex-shrink-0\"\n              >\n                {submittingComment ? <Loader2 className=\"w-3.5 h-3.5 animate-spin\" /> : <Send className=\"w-3.5 h-3.5\" />}\n              </Button>\n            </div>\n          </div>\n        </div>\n      </DialogContent>\n    </Dialog>\n\n    {lightboxUrl && (\n      <Dialog open onOpenChange={() => setLightboxUrl(null)}>\n        <DialogContent className=\"max-w-3xl p-2 bg-black/90 border-none\" data-testid=\"lightbox\">\n          <DialogHeader className=\"sr-only\">\n            <DialogTitle>Image Preview</DialogTitle>\n            <DialogDescription>Full size image</DialogDescription>\n          </DialogHeader>\n          <img\n            src={lightboxUrl}\n            alt=\"Full size\"\n            className=\"w-full h-auto max-h-[80vh] object-contain rounded\"\n          />\n        </DialogContent>\n      </Dialog>\n    )}\n    </>\n  );\n}\n\ninterface AddCardFormProps {\n  columnId: TaskStatus;\n  onAdd: (title: string, status: TaskStatus) => void;\n  onCancel: () => void;\n}\n\nfunction AddCardForm({ columnId, onAdd, onCancel }: AddCardFormProps) {\n  const [title, setTitle] = useState("");\n\n  const handleSubmit = (e: React.FormEvent) => {\n    e.preventDefault();\n    if (title.trim()) onAdd(title.trim(), columnId);\n  };\n\n  return (\n    <form onSubmit={handleSubmit} className=\"mt-2\">\n      <Input\n        autoFocus\n        value={title}\n        onChange={(e) => setTitle(e.target.value)}\n        placeholder=\"Card title...\"\n        className=\"mb-2 text-sm\"\n        data-testid={`input-new-card-${columnId}`}\n        onKeyDown={(e) => e.key === \"Escape\" && onCancel()}\n      />\n      <div className=\"flex gap-2\">\n        <Button type=\"submit\" size=\"sm\" disabled={!title.trim()} data-testid={`button-add-card-${columnId}`}>\n          Add\n        </Button>\n        <Button type=\"button\" variant=\"ghost\" size=\"sm\" onClick={onCancel} data-testid={`button-cancel-add-${columnId}`}>\n          <X className=\"w-3.5 h-3.5\" />\n        </Button>\n      </div>\n    </form>\n  );\
}\n\nexport default function MissionBoard() {\n  const qc = useQueryClient();\n  const { toast } = useToast();\n  const [filterLabel, setFilterLabel] = useState<TaskLabel | \"all\">(\"all\");\n  const [filterAssignee, setFilterAssignee] = useState<string>(\"all\");\n  const [hideWithReminder, setHideWithReminder] = useState(false);\n  const [addingColumn, setAddingColumn] = useState<TaskStatus | null>(null);\n  const [selectedTask, setSelectedTask] = useState<Task | null>(null);\n  const [modalOpen, setModalOpen] = useState(false);\n  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);\n  const [refreshing, setRefreshing] = useState(false);\n  const [checkingTasks, setCheckingTasks] = useState(false);\n  const [searchInput, setSearchInput] = useState(\"\");\n  const [searchQuery, setSearchQuery] = useState(\"\");\n\n  useEffect(() => {\n    const timer = setTimeout(() => setSearchQuery(searchInput.trim()), 300);\n    return () => clearTimeout(timer);\n  }, [searchInput]);\n\n  const { data: tasks, isLoading, error, dataUpdatedAt } = useQuery<Task[]>({\n    queryKey: ["/tasks", searchQuery],\n    queryFn: async ({ queryKey }) => {\n      const q = queryKey[1] as string;\n      const url = q ? `/tasks?q=${encodeURIComponent(q)}` : "/tasks";\n      const raw = await apiRequest<Record<string, unknown>[]>(\"GET\", url);\n      return (Array.isArray(raw) ? raw : []) as Task[];\n    },\n    staleTime: 30000,\n  });\n\n  useEffect(() => {\n    if (dataUpdatedAt) setLastUpdated(new Date(dataUpdatedAt));\n  }, [dataUpdatedAt]);\n\n  useEffect(() => {\n    const poll = () => {\n      if (document.visibilityState === \"visible\") {\n        qc.invalidateQueries({ queryKey: ["/tasks"], exact: false });\n      }\n    };\n    const id = setInterval(poll, 30000);\n    const onVisChange = () => {\n      if (document.visibilityState === \"visible\") {\n        qc.invalidateQueries({ queryKey: ["/tasks"], exact: false });\n      }\n    };\n    document.addEventListener(\"visibilitychange\", onVisChange);\n    return () => { clearInterval(id); document.removeEventListener(\"visibilitychange\", onVisChange); };\n  }, [qc]);\n\n    // Reminder notifications\n  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | \"checking\">(\"checking\");\n  const [reminderHistory, setReminderHistory] = useState<ReminderHistoryEntry[]>(() => {\n    // purge any entries from the 1970s (caused by localStorage seconds/ms unit bug)\n    const history = getReminderHistory().filter(h => h.firedAt > 1000000000);\n    localStorage.setItem("reminder_history", JSON.stringify(history));\n    return history;\n  });\n  const [reminderPanelOpen, setReminderPanelOpen] = useState(false);\n  const unreadReminderCount = reminderHistory.filter(h => h.status === "fired").length;\n\n  const refreshReminderHistory = () => setReminderHistory(getReminderHistory());\n\n  const handleSnooze = (entry: ReminderHistoryEntry, minutes: number) => {\n    const snoozedUntil = Math.floor(Date.now() / 1000) + minutes * 60;\n    updateReminderHistoryStatus(entry.id, "snoozed", snoozedUntil);\n    setLocalReminder(entry.taskId, snoozedUntil);\n    // also patch backend\n    apiRequest("PATCH", `/tasks/${entry.taskId}`, { reminder_at: snoozedUntil }).catch(() => {});\n    refreshReminderHistory();\n  };\n\n  const handleDismissReminder = (entry: ReminderHistoryEntry) => {\n    updateReminderHistoryStatus(entry.id, "dismissed");\n    setLocalReminder(entry.taskId, undefined);\n    apiRequest("PATCH", `/tasks/${entry.taskId}`, { reminder_at: null }).catch(() => {});\n    refreshReminderHistory();\n  };\n\n  useEffect(() => {\n    if (!("Notification" in window)) {\n      setNotificationPermission("denied");\n      return;\n    }\n    if (Notification.permission !== "default") {\n      setNotificationPermission(Notification.permission);\n    }\n  }, []);\n\n  useEffect(() => {\n    const checkReminders = () => {\n      const now = Date.now();\n      const localReminders = getLocalReminders();\n      const firedKeys = getFiredReminderKeys();\n      const allTasks = tasks || [];\n      allTasks.forEach(task => {\n        const reminderTime = task.reminder_at ? task.reminder_at * 1000 : (localReminders[task.id] ? localReminders[task.id] * 1000 : null);\n        if (!reminderTime || reminderTime > now) return; // not yet due\n        const key = `${task.id}-${Math.floor(reminderTime / 1000)}`;\n        if (firedKeys.has(key)) return; // already fired this session\n        markReminderFired(key);\n        const entry: ReminderHistoryEntry = {\n          id: key,\n          taskId: String(task.id),\n          taskTitle: task.title,\n          firedAt: Math.floor(reminderTime / 1000),\n          status: "fired",\n        };\n        addReminderHistory(entry);\n        refreshReminderHistory();\n        if (Notification.permission === "granted") {\n          const notif = new Notification(`Reminder: ${task.title}`, {\n            body: task.description?.slice(0, 100) || "Task reminder",\n            icon: "/favicon.ico",\n            tag: `task-${task.id}`,\n            requireInteraction: true,\n          });\n          notif.onclick = () => { window.focus(); notif.close(); };\n        }\n      });\n    };\n    const id = setInterval(checkReminders, 30000);\n    checkReminders();\n    return () => clearInterval(id);\n  }, [tasks]);\n\n  const handleManualRefresh = async () => {\n    setRefreshing(true);\n    await qc.invalidateQueries({ queryKey: ["/tasks"], exact: false });\n    setRefreshing(false);\n  };\n\n  const handleCheckTasks = async () => {\n    setCheckingTasks(true);\n    try {\n      const base = import.meta.env.VITE_API_URL || "/api";\n      const token = localStorage.getItem("bsl_mc_token");\n      const headers: Record<string, string> = { "Content-Type": "application/json" };\n      if (token) headers["Authorization"] = `Bearer ${token}`;\n      let res: Response;\n      try {\n        res = await fetch(`${base}/clawbot/check-tasks`, { method: "POST", headers });\n      } catch (_networkErr) {\n        toast({ title: "Failed to reach Clawbot", variant: "destructive" });\n        setCheckingTasks(false);\n        return;\n      }\n      if (res.ok) {\n\n        toast({ title: "🦞 Clawbot is on it!", className: "bg-emerald-600 text-white border-emerald-700" });\n      } else {\n        toast({ title: "Failed to reach Clawbot", variant: "destructive" });\n      }\n    } catch (err) {\n      console.error("Check tasks error:", err);\n      toast({ title: "Failed to reach Clawbot", variant: "destructive" });\n    }\n    setCheckingTasks(false);\n  };\n\n  const createMutation = useMutation({\n    mutationFn: (data: Record<string, unknown>) => apiRequest<Task>("POST", "/tasks", data),\n    onSuccess: () => qc.invalidateQueries({ queryKey: ["/tasks"], exact: false }),\n  });\n\n  const updateMutation = useMutation({\n    mutationFn: ({ id, ...data }: Record<string, unknown> & { id: string }) =>\n      apiRequest<Task>("PATCH", `/tasks/${id}`, data),\n    onSuccess: () => qc.invalidateQueries({ queryKey: ["/tasks"], exact: false }),\n  });\n\n  const deleteMutation = useMutation({\n    mutationFn: (id: string) => apiRequest("DELETE", `/tasks/${id}`),\n    onSuccess: () => qc.invalidateQueries({ queryKey: ["/tasks"], exact: false }),\n  });\n\n  const handleDragEnd = useCallback((result: DropResult) => {\n    if (!result.destination) return;\n    const taskId = result.draggableId;\n    const newStatus = result.destination.droppableId as TaskStatus;\n    updateMutation.mutate({ id: taskId, status: newStatus, author: "steve" });\n  }, [updateMutation]);\n\n  const handleAddCard = (title: string, status: TaskStatus) => {\n    createMutation.mutate({\n      title,\n      status,\n      priority: "medium",\n      project: "other",\n      assigned_to: "steve",\n    });\n    setAddingColumn(null);\n  };\n\n  const handleSaveTask = async (updates: Partial<Task>) => {\n    if (!selectedTask) return;\n    const apiData = toApiPayload(updates);\n    try {\n      await updateMutation.mutateAsync({ id: selectedTask.id, ...apiData, author: "steve" });\n      // Directly update the exact query key used by the tasks list\n      qc.setQueryData(["/tasks", searchQuery], (old: unknown) => {\n        if (!Array.isArray(old)) return old;\n        return old.map((t: Task) => t.id === selectedTask.id ? { ...t, ...updates } : t);\n      });\n    } catch (err) {\n      console.error("Save task failed:", err);\n    }\n    setModalOpen(false);\n    setSelectedTask(null);\n  };\n\n  const handleDeleteTask = async (id: string) => {\n    await deleteMutation.mutateAsync(id);\n    await qc.refetchQueries({ queryKey: ["/tasks"], exact: false });\n    setModalOpen(false);\n    setSelectedTask(null);\n  };\n\n  const repeatableTasks = (tasks ?? []).filter(t => !!t.is_repeatable &&\n    (filterLabel === "all" || t.label === filterLabel) &&\n    (filterAssignee === "all" || t.assignee === filterAssignee)\n  );\n\n  const filteredTasks = (tasks ?? []).filter(\n    t => (filterLabel === "all" || t.label === filterLabel) &&\n         (filterAssignee === "all" || t.assignee === filterAssignee) &&\n         (!hideWithReminder || !t.reminder_at)\n  );\n\n  const tasksByColumn = (status: TaskStatus) =>\n    filteredTasks.filter(t => t.status === status && !t.is_repeatable);\n\n  const columnColors: Record<TaskStatus, string> = {\n    ideas: "text-amber-500 dark:text-amber-400",\n    inprogress: "text-blue-500 dark:text-blue-400",\n    review: "text-violet-500 dark:text-violet-400",\n    complete: "text-emerald-500 dark:text-emerald-400",\n  };\n\n  return (\n    <div className=\"h-full flex flex-col\">\n      <div className=\"flex items-center justify-between px-5 py-3 border-b border-border bg-background flex-wrap gap-2\">\n        <div className=\"flex items-center gap-3\">\n          <h1 className=\"text-base font-semibold text-foreground\">Mission Board</h1>\n          <Button\n            size=\"sm\"\n            onClick={handleCheckTasks}\n            disabled={checkingTasks}\n            className=\"h-7 text-xs\"\n            data-testid=\"button-check-tasks\"\n          >\n            {checkingTasks ? <Loader2 className=\"w-3.5 h-3.5 animate-spin mr-1.5\" /> : <span className=\"mr-1.5\">🦞</span>}\n            {checkingTasks ? \"Checking…\" : \"Check Tasks\"}\n          </Button>\n\n        </div>\n        <div className=\"relative\">\n          <Search className=\"absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none\" />\n          <Input\n            value={searchInput}\n            onChange={(e) => setSearchInput(e.target.value)}\n            placeholder=\"Search tasks…\"\n            className=\"h-7 text-xs pl-8 pr-7 w-48\"\n            data-testid=\"input-search-tasks\"\n          />\n          {searchInput && (\n            <button\n              onClick={() => setSearchInput(\"\")}\n              className=\"absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground\"\n              data-testid=\"button-clear-search\"\n            >\n              <X className=\"w-3.5 h-3.5\" />\n            </button>\n          )}\n        </div>\n        <div className=\"flex items-center gap-2 flex-wrap\">\n          <span className=\"text-xs text-muted-foreground\">Filter:</span>\n          <div className=\"flex gap-1.5 flex-wrap\">\n            <button\n              className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${filterLabel === "all" ? "bg-primary text-primary-foreground border-primary" : "bg-card border-card-border text-muted-foreground"}`}\n              onClick={() => setFilterLabel("all")}\n              data-testid=\"filter-all\"\n            >\n              All\n            </button>\n            {ALL_PROJECTS.map(l => (\n              <button\n                key={l}\n                className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${filterLabel === l ? "bg-primary text-primary-foreground border-primary" : "bg-card border-card-border text-muted-foreground"}`}\n                onClick={() => setFilterLabel(l)}\n                data-testid={`filter-${l}`}\n              >\n                {LABEL_META[l].label}\n              </button>\n            ))}\n          </div>\n        </div>\n        <div className=\"flex items-center gap-2 flex-wrap\">\n          <span className=\"text-xs text-muted-foreground\">Assignee:</span>\n          <div className=\"flex gap-1.5\">\n            {[{ value: "all", label: "All" }, { value: "steve", label: "Steve" }, { value: "clawbot", label: "Clawbot" }].map(opt => (\n              <button\n                key={opt.value}\n                className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${filterAssignee === opt.value ? "bg-primary text-primary-foreground border-primary" : "bg-card border-card-border text-muted-foreground"}`}\n                onClick={() => setFilterAssignee(opt.value)}\n                data-testid={`filter-assignee-${opt.value}`}\n              >\n                {opt.label}\n              </button>\n            ))}\n          </div>\n        </div>\n        <div className=\"flex items-center gap-2 flex-wrap\">\n          <span className=\"text-xs text-muted-foreground\">Hide:</span>\n          <button\n            className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${hideWithReminder ? "bg-primary text-primary-foreground border-primary" : "bg-card border-card-border text-muted-foreground"}`}\n            onClick={() => setHideWithReminder(!hideWithReminder)}\n            data-testid=\"filter-hide-reminder\"\n          >\n            With Reminder\n          </button>\n        </div>\n        <div className=\"flex items-center gap-1.5\">\n          {lastUpdated && (\n            <span className=\"text-xs text-muted-foreground/70\" data-testid=\"text-last-updated\">\n              Last updated: {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}\n            </span>\n          )}\n          <button\n            onClick={handleManualRefresh}\n            disabled={refreshing}\n            className=\"p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-50\"\n            data-testid=\"button-refresh\"\n          >\n            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />\n          </button>\n\n          {/* Reminder history bell */}\n          <Popover open={reminderPanelOpen} onOpenChange={setReminderPanelOpen}>\n            <PopoverTrigger asChild>\n              <button\n                className=\"relative p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors\"\n                title=\"Reminder history\"\n                onClick={() => { refreshReminderHistory(); setReminderPanelOpen(v => !v); }}\n              >\n                <Bell className=\"w-3.5 h-3.5\" />\n                {unreadReminderCount > 0 && (\n                  <span className=\"absolute -top-0.5 -right-0.5 w-3.5 h-3.5 flex items-center justify-center rounded-full bg-amber-500 text-white text-[9px] font-bold leading-none\">\n                    {unreadReminderCount > 9 ? "9+" : unreadReminderCount}\n                  </span>\n                )}\n              </button>\n            </PopoverTrigger>\n            <PopoverContent align=\"end\" className=\"w-80 p-0 max-h-[420px] flex flex-col\">\n              <div className=\"flex items-center justify-between px-3 py-2 border-b border-border\">\n                <span className=\"text-sm font-semibold\">Reminder History</span>\n                {reminderHistory.length > 0 && (\n                  <button\n                    className=\"text-xs text-muted-foreground hover:text-foreground\"\n                    onClick={() => { localStorage.removeItem("reminder_history"); refreshReminderHistory(); }}\n                  >\n                    Clear all\n                  </button>\n                )}\n              </div>\n              <div className=\"overflow-y-auto flex-1\">\n                {reminderHistory.length === 0 ? (\n                  <div className=\"px-3 py-6 text-center text-xs text-muted-foreground\">No reminders yet</div>\n                ) : (\n                  reminderHistory.map(entry => {\n                    const linkedTask = tasks?.find(t => String(t.id) === entry.taskId);\n                    return (\n                      <div\n                        key={entry.id}\n                        className={`px-3 py-2 border-b border-border last:border-0 hover:bg-muted/30 ${linkedTask ? 'cursor-pointer' : ''}`}\n                        onClick={() => {\n                          if (linkedTask) {\n                            setSelectedTask(linkedTask);\n                            setModalOpen(true);\n                            setReminderPanelOpen(false);\n                          }\n                        }}>\n                        <div className=\"flex items-start justify-between gap-2\">\n                          <div className=\"flex-1 min-w-0\">\n                            <p className={`text-xs font-medium truncate ${linkedTask ? 'text-primary hover:underline' : ''}`}>{entry.taskTitle}</p>\n                          <p className=\"text-[10px] text-muted-foreground mt-0.5\">\n                            {format(new Date(entry.firedAt * 1000), "d MMM, HH:mm")}\n                            {entry.status === "snoozed" && entry.snoozedUntil && (\n                              <> · Snoozed until {format(new Date(entry.snoozedUntil * 1000), "HH:mm")}</>\n                            )}\n                          </p>\n                        </div>\n                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${\n                          entry.status === "fired" ? "bg-amber-500/15 text-amber-600" :\n                          entry.status === "snoozed" ? "bg-blue-500/15 text-blue-600" :\n                          "bg-muted text-muted-foreground"\n                        }`}>\n                          {entry.status}\n                        </span>\n                      </div>\n                      {entry.status !== "dismissed" && (\n                        <div className=\"flex gap-1 mt-1.5\">\n                          <button\n                            className=\"text-[10px] px-2 py-0.5 rounded border border-border hover:bg-muted/50 text-muted-foreground\"\n                            onClick={() => handleSnooze(entry, 15)}\n                          >+15m</button>\n                          <button\n                            className=\"text-[10px] px-2 py-0.5 rounded border border-border hover:bg-muted/50 text-muted-foreground\"\n                            onClick={() => handleSnooze(entry, 60)}\n                          >+1h</button>\n                          <button\n                            className=\"text-[10px] px-2 py-0.5 rounded border border-border hover:bg-muted/50 text-muted-foreground\"\n                            onClick={() => handleSnooze(entry, 1440)}\n                          >+1d</button>\n                          <button\n                            className=\"text-[10px] px-2 py-0.5 rounded border border-destructive/40 hover:bg-destructive/10 text-destructive ml-auto\"\n                            onClick={() => handleDismissReminder(entry)}\n                          >Dismiss</button>\n                        </div>\n                      )}\n                    </div>\n                  );\n                })}\n              </div>\n              {notificationPermission !== "granted" && (\n                <div className=\"px-3 py-2 border-t border-border bg-amber-500/5\">\n                  <button\n                    className=\"text-xs text-amber-600 hover:underline w-full text-left\"\n                    onClick={() => Notification.requestPermission().then(p => setNotificationPermission(p))}\n                  >\n                    ⚠ Enable push notifications to receive alerts\n                  </button>\n                </div>\n              )}\n            </PopoverContent>\n          </Popover>\n        </div>\n      </div>\n\n      {error && (\n        <div className=\"flex items-center gap-2 mx-5 mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm\">\n          <AlertCircle className=\"w-4 h-4 flex-shrink-0\" />\n          <span>Could not load tasks. Check your API URL configuration.</span>\n        </div>\n      )}\n\n      <div className=\"flex-1 overflow-auto\">\n        <div className=\"flex flex-col md:flex-row gap-4 p-5 md:min-w-max\">\n        <DragDropContext onDragEnd={handleDragEnd}>\n          <div className=\"contents\">\n            {COLUMNS.map(col => {\n              const colTasks = tasksByColumn(col.id);\n              const ColIcon = col.icon;\n              return (\n                <div\n                  key={col.id}\n                  className=\"flex flex-col w-full md:w-72 md:flex-shrink-0\"\n                  data-testid={`column-${col.id}`}\n                >\n                  <div className=\"flex items-center justify-between mb-3\">\n                    <div className=\"flex items-center gap-2\">\n                      <ColIcon className={`w-4 h-4 ${columnColors[col.id]}`} />\n                      <span className=\"text-sm font-semibold text-foreground\">{col.label}</span>\n                      <span className=\"text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full\">\n                        {colTasks.length}\n                      </span>\n                    </div>\n                    <Button\n                      size=\"icon\"\n                      variant=\"ghost\"\n                      onClick={() => setAddingColumn(col.id)}\n                      data-testid={`button-add-${col.id}`}\n                      className=\"h-7 w-7\"\n                    >\n                      <Plus className=\"w-3.5 h-3.5\" />\n                    </Button>\n                  </div>\n\n                  <Droppable droppableId={col.id}>\n                    {(provided, snapshot) => (\n                      <div\n                        ref={provided.innerRef}\n                        {...provided.droppableProps}\n                        className={`md:flex-1 rounded-md min-h-32 p-2 transition-colors ${snapshot.isDraggingOver ? "bg-primary/5 border border-primary/20" : "bg-muted/30 border border-border/50"}`}\n                      >\n                        {isLoading ? (\n                          Array.from({ length: 2 }).map((_, i) => (\n                            <Skeleton key={i} className=\"h-20 mb-2 rounded-md\" />\n                          ))\n                        ) : (\n                          colTasks.map((task, index) => (\n                            <TaskCard\n                              key={task.id}\n                              task={task}\n                              index={index}\n                              onClick={() => { setSelectedTask(task); setModalOpen(true); }}\n                            />\n                          ))\n                        )}\n                        {provided.placeholder}\n\n                        {addingColumn === col.id && (\n                          <AddCardForm\n                            columnId={col.id}\n                            onAdd={handleAddCard}\n                            onCancel={() => setAddingColumn(null)}\n                          />\n                        )}\n\n                        {!isLoading && colTasks.length === 0 && addingColumn !== col.id && (\n                          <div className=\"flex items-center justify-center h-16 text-xs text-muted-foreground/60\">\n                            Drop cards here\n                          </div>\n                        )}\n                      </div>\n                    )}\n                  </Droppable>\n                </div>\n              );\n            })}\n          </div>\n        </DragDropContext>\n\n        <div className=\"flex flex-col w-full md:w-72 md:flex-shrink-0\" data-testid=\"column-repeatable\">\n          <div className=\"flex items-center gap-2 mb-3\">\n            <Repeat className=\"w-4 h-4 text-violet-500 dark:text-violet-400\" />\n            <span className=\"text-sm font-semibold text-foreground\">Repeatable</span>\n            <span className=\"text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full\">\n              {repeatableTasks.length}\n            </span>\n          </div>\n          <div className=\"md:flex-1 rounded-md min-h-32 p-2 bg-violet-500/5 border border-violet-500/20\">\n            {isLoading ? (\n              Array.from({ length: 2 }).map((_, i) => (\n                <Skeleton key={i} className=\"h-20 mb-2 rounded-md\" />\n              ))\n            ) : repeatableTasks.length === 0 ? (\n              <div className=\"flex items-center justify-center h-16 text-xs text-muted-foreground/60\">\n                No repeatable tasks\n              </div>\n            ) : (\n              repeatableTasks.map(task => (\n                <div\n                  key={task.id}\n                  className=\"bg-card border border-card-border rounded-md p-3 mb-2 cursor-pointer select-none hover-elevate\"\n                  onClick={() => { setSelectedTask(task); setModalOpen(true); }}\n                  data-testid={`card-repeatable-${task.id}`}\n                >\n                  <div className=\"flex items-start justify-between gap-2 mb-1.5\">\n                    <p className=\"text-sm font-medium text-card-foreground leading-snug flex-1\">{task.title}</p>\n                    <div className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium whitespace-nowrap ${(PRIORITY_META[task.priority] ?? PRIORITY_META.medium).className}`}>\n                      {(PRIORITY_META[task.priority] ?? PRIORITY_META.medium).label}\n                    </div>\n                  </div>\n                  <div className=\"flex flex-wrap items-center gap-1.5\">\n                    <span className=\"inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-violet-500/15 text-violet-500 dark:text-violet-300\">\n                      <Repeat className=\"w-2.5 h-2.5\" />\n                      {task.cadence ? task.cadence.charAt(0).toUpperCase() + task.cadence.slice(1) : \"Repeating\"}\n                    </span>\n                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${(LABEL_META[task.label] ?? LABEL_META.other).className}`}>\n                      {(LABEL_META[task.label] ?? LABEL_META.other).label}\n                    </span>\n                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${(ASSIGNEE_META[task.assignee] ?? ASSIGNEE_META.steve).className}`}>\n                      {(ASSIGNEE_META[task.assignee] ?? ASSIGNEE_META.steve).label}\n                    </span>\n                  </div>\n                </div>\n              ))\n            )}\n          </div>\n        </div>\n        </div>\n      </div>\n\n      <TaskModal\n        task={selectedTask}\n        open={modalOpen}\n        onClose={() => { setModalOpen(false); setSelectedTask(null); }}\n        onSave={handleSaveTask}\n        onDelete={handleDeleteTask}\n        projectOptions={[...ALL_PROJECTS]}\n      />\n    </div>\n  );\
}\n