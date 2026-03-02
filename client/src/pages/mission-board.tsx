import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import {
  Plus, X, ChevronDown, ChevronUp, Lightbulb, Wrench, Eye, CheckCircle2,
  AlertCircle, MessageSquare, ArrowRight, Send, Loader2, User, Repeat
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
import { apiRequest } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import type { Task, TaskStatus, TaskPriority, TaskLabel, TaskAssignee, ActivityEntry } from "@shared/schema";

const COLUMNS: { id: TaskStatus; label: string; icon: React.ElementType }[] = [
  { id: "ideas", label: "Ideas", icon: Lightbulb },
  { id: "inprogress", label: "In Progress", icon: Wrench },
  { id: "review", label: "Review", icon: Eye },
  { id: "complete", label: "Complete", icon: CheckCircle2 },
];

const ALL_PROJECTS = [
  "invoicewizard", "lifecoach", "wesayido", "horserace",
  "brightstacklabs", "mission-control", "other",
] as const;

const LABEL_META: Record<string, { label: string; className: string }> = {
  "invoicewizard": { label: "InvoiceWizard", className: "bg-blue-500/15 text-blue-400 dark:text-blue-300" },
  "lifecoach": { label: "Life Coach Steven", className: "bg-emerald-500/15 text-emerald-500 dark:text-emerald-300" },
  "wesayido": { label: "WeSayIDo", className: "bg-pink-500/15 text-pink-500 dark:text-pink-300" },
  "horserace": { label: "Horse Race System", className: "bg-amber-500/15 text-amber-500 dark:text-amber-300" },
  "brightstacklabs": { label: "Bright Stack Labs", className: "bg-violet-500/15 text-violet-500 dark:text-violet-300" },
  "mission-control": { label: "Mission Control", className: "bg-cyan-500/15 text-cyan-500 dark:text-cyan-300" },
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
            <p className="text-sm font-medium text-card-foreground leading-snug flex-1">{task.title}</p>
            <div className="flex items-center gap-1">
              {!!task.is_repeatable && (
                <span className="inline-flex items-center px-1 py-0.5 rounded text-xs bg-violet-500/10 text-violet-500" title={`Repeats ${task.cadence ?? ""}`.trim()} data-testid={`badge-repeat-${task.id}`}>
                  <Repeat className="w-3 h-3" />
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

function ActivityItem({ entry }: { entry: ActivityEntry }) {
  const authorMeta = ASSIGNEE_META[entry.author] ?? { label: entry.author, className: "bg-muted text-muted-foreground" };

  if (entry.type === "comment") {
    return (
      <div className="flex gap-2.5" data-testid={`activity-comment-${entry.id}`}>
        <div className={`flex items-center justify-center w-6 h-6 rounded-full flex-shrink-0 mt-0.5 ${authorMeta.className}`}>
          <User className="w-3 h-3" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs font-medium text-foreground">{authorMeta.label}</span>
            <span className="text-xs text-muted-foreground/60">{timeAgo(entry.created_at)}</span>
          </div>
          <div className="bg-muted/50 border border-border rounded-lg rounded-tl-none px-3 py-2">
            <p className="text-sm text-foreground whitespace-pre-wrap">{entry.content}</p>
          </div>
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
  const [comment, setComment] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const activityEndRef = useRef<HTMLDivElement>(null);

  const { data: taskDetail, isLoading: detailLoading } = useQuery<{ activity: ActivityEntry[] }>({
    queryKey: ["/tasks", task?.id],
    queryFn: async () => {
      const raw = await apiRequest<Record<string, unknown>>("GET", `/tasks/${task!.id}`);
      const activity = (Array.isArray(raw.activity) ? raw.activity : []) as ActivityEntry[];
      return { activity };
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
      setComment("");
    }
  }, [task]);

  useEffect(() => {
    if (taskDetail?.activity?.length) {
      setTimeout(() => activityEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  }, [taskDetail?.activity?.length]);

  const handleSave = () => {
    onSave({
      title, description, status, priority, label, assignee,
      is_repeatable: isRepeatable ? 1 : 0,
      cadence: isRepeatable ? cadence : undefined,
    });
  };

  const handleSubmitComment = async () => {
    if (!comment.trim() || !task) return;
    setSubmittingComment(true);
    try {
      await apiRequest("POST", `/tasks/${task.id}/activity`, {
        author: "steve",
        content: comment.trim(),
      });
      setComment("");
      qc.invalidateQueries({ queryKey: ["/tasks", task.id] });
    } catch (err) {
      toast({ title: "Failed to post comment", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSubmittingComment(false);
    }
  };

  if (!task) return null;

  const activity = taskDetail?.activity ?? [];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col" data-testid="modal-task">
        <DialogHeader>
          <DialogTitle className="text-base">Edit Task</DialogTitle>
          <DialogDescription className="sr-only">View and edit task details, and see activity log</DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-4 pt-1 pr-1">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              data-testid="input-task-title"
              placeholder="Task title"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              data-testid="input-task-description"
              placeholder="Optional description..."
              className="resize-none"
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Column</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
                <SelectTrigger data-testid="select-task-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALL_STATUSES.map(s => (
                    <SelectItem key={s} value={s}>{COLUMNS.find(c => c.id === s)?.label ?? s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                <SelectTrigger data-testid="select-task-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALL_PRIORITIES.map(p => (
                    <SelectItem key={p} value={p}>{PRIORITY_META[p].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Project</Label>
              <Select value={label} onValueChange={(v) => setLabel(v)}>
                <SelectTrigger data-testid="select-task-label">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {projectOptions.map(l => (
                    <SelectItem key={l} value={l}>{(LABEL_META[l] ?? { label: l }).label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Assigned To</Label>
              <Select value={assignee} onValueChange={(v) => setAssignee(v)}>
                <SelectTrigger data-testid="select-task-assignee">
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

          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Repeatable</Label>
              <Switch checked={isRepeatable} onCheckedChange={setIsRepeatable} data-testid="switch-repeatable" />
            </div>
            {isRepeatable && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Cadence</Label>
                <Select value={cadence} onValueChange={(v) => setCadence(v as "daily" | "weekly" | "monthly")}>
                  <SelectTrigger data-testid="select-cadence">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-1">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => onDelete(task.id)}
              data-testid="button-delete-task"
            >
              Delete
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={onClose} data-testid="button-cancel-task">
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} data-testid="button-save-task">
                Save Changes
              </Button>
            </div>
          </div>

          <div className="border-t border-border pt-3">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Activity</Label>
            </div>
            {detailLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-8 rounded" />)}
              </div>
            ) : activity.length === 0 ? (
              <p className="text-xs text-muted-foreground/60 py-4 text-center">No activity yet</p>
            ) : (
              <div className="space-y-2.5 mb-3">
                {activity.map(entry => (
                  <ActivityItem key={entry.id} entry={entry} />
                ))}
                <div ref={activityEndRef} />
              </div>
            )}

            <div className="flex gap-2">
              <Input
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Add a comment..."
                className="text-sm"
                data-testid="input-comment"
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSubmitComment()}
              />
              <Button
                size="icon"
                variant="secondary"
                onClick={handleSubmitComment}
                disabled={!comment.trim() || submittingComment}
                data-testid="button-submit-comment"
                className="flex-shrink-0"
              >
                {submittingComment ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
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
    <form onSubmit={handleSubmit} className="mt-2">
      <Input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Card title..."
        className="mb-2 text-sm"
        data-testid={`input-new-card-${columnId}`}
        onKeyDown={(e) => e.key === "Escape" && onCancel()}
      />
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={!title.trim()} data-testid={`button-add-card-${columnId}`}>
          Add
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} data-testid={`button-cancel-add-${columnId}`}>
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>
    </form>
  );
}

export default function MissionBoard() {
  const qc = useQueryClient();
  const [filterLabel, setFilterLabel] = useState<TaskLabel | "all">("all");
  const [addingColumn, setAddingColumn] = useState<TaskStatus | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const { data: tasks, isLoading, error } = useQuery<Task[]>({
    queryKey: ["/tasks"],
    queryFn: async () => {
      const raw = await apiRequest<Record<string, unknown>[]>("GET", "/tasks");
      return (Array.isArray(raw) ? raw : []).map(normalizeTask);
    },
    staleTime: 30000,
  });

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiRequest<Task>("POST", "/tasks", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/tasks"] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: Record<string, unknown> & { id: string }) =>
      apiRequest<Task>("PATCH", `/tasks/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/tasks"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/tasks/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/tasks"] }),
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
    await updateMutation.mutateAsync({ id: selectedTask.id, ...apiData, author: "steve" });
    await qc.refetchQueries({ queryKey: ["/tasks"] });
    setModalOpen(false);
    setSelectedTask(null);
  };

  const handleDeleteTask = async (id: string) => {
    await deleteMutation.mutateAsync(id);
    await qc.refetchQueries({ queryKey: ["/tasks"] });
    setModalOpen(false);
    setSelectedTask(null);
  };

  const repeatableTasks = (tasks ?? []).filter(t => !!t.is_repeatable);

  const filteredTasks = (tasks ?? []).filter(
    t => filterLabel === "all" || t.label === filterLabel
  );

  const tasksByColumn = (status: TaskStatus) =>
    filteredTasks.filter(t => t.status === status);

  const columnColors: Record<TaskStatus, string> = {
    ideas: "text-amber-500 dark:text-amber-400",
    inprogress: "text-blue-500 dark:text-blue-400",
    review: "text-violet-500 dark:text-violet-400",
    complete: "text-emerald-500 dark:text-emerald-400",
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-background flex-wrap gap-2">
        <h1 className="text-base font-semibold text-foreground">Mission Board</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">Filter:</span>
          <div className="flex gap-1.5 flex-wrap">
            <button
              className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${filterLabel === "all" ? "bg-primary text-primary-foreground border-primary" : "bg-card border-card-border text-muted-foreground"}`}
              onClick={() => setFilterLabel("all")}
              data-testid="filter-all"
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
      </div>

      {error && (
        <div className="flex items-center gap-2 mx-5 mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>Could not load tasks. Check your API URL configuration.</span>
        </div>
      )}

      <div className="flex-1 overflow-auto md:overflow-x-auto md:overflow-y-hidden">
        <div className="flex flex-col md:flex-row gap-4 p-5 md:h-full md:min-w-max">
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="contents">
            {COLUMNS.map(col => {
              const colTasks = tasksByColumn(col.id);
              const ColIcon = col.icon;
              return (
                <div
                  key={col.id}
                  className="flex flex-col w-full md:w-72 md:flex-shrink-0"
                  data-testid={`column-${col.id}`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <ColIcon className={`w-4 h-4 ${columnColors[col.id]}`} />
                      <span className="text-sm font-semibold text-foreground">{col.label}</span>
                      <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                        {colTasks.length}
                      </span>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setAddingColumn(col.id)}
                      data-testid={`button-add-${col.id}`}
                      className="h-7 w-7"
                    >
                      <Plus className="w-3.5 h-3.5" />
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
                            <Skeleton key={i} className="h-20 mb-2 rounded-md" />
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
                          <div className="flex items-center justify-center h-16 text-xs text-muted-foreground/60">
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

        <div className="flex flex-col w-full md:w-72 md:flex-shrink-0" data-testid="column-repeatable">
          <div className="flex items-center gap-2 mb-3">
            <Repeat className="w-4 h-4 text-violet-500 dark:text-violet-400" />
            <span className="text-sm font-semibold text-foreground">Repeatable</span>
            <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
              {repeatableTasks.length}
            </span>
          </div>
          <div className="md:flex-1 rounded-md min-h-32 p-2 bg-violet-500/5 border border-violet-500/20">
            {isLoading ? (
              Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-20 mb-2 rounded-md" />
              ))
            ) : repeatableTasks.length === 0 ? (
              <div className="flex items-center justify-center h-16 text-xs text-muted-foreground/60">
                No repeatable tasks
              </div>
            ) : (
              repeatableTasks.map(task => (
                <div
                  key={task.id}
                  className="bg-card border border-card-border rounded-md p-3 mb-2 cursor-pointer select-none hover-elevate"
                  onClick={() => { setSelectedTask(task); setModalOpen(true); }}
                  data-testid={`card-repeatable-${task.id}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <p className="text-sm font-medium text-card-foreground leading-snug flex-1">{task.title}</p>
                    <div className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium whitespace-nowrap ${(PRIORITY_META[task.priority] ?? PRIORITY_META.medium).className}`}>
                      {(PRIORITY_META[task.priority] ?? PRIORITY_META.medium).label}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-violet-500/15 text-violet-500 dark:text-violet-300">
                      <Repeat className="w-2.5 h-2.5" />
                      {task.cadence ? task.cadence.charAt(0).toUpperCase() + task.cadence.slice(1) : "Repeating"}
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
  );
}
