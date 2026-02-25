import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { Plus, X, ChevronDown, ChevronUp, Lightbulb, Wrench, Eye, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/auth";
import type { Task, TaskStatus, TaskPriority, TaskLabel, TaskAssignee } from "@shared/schema";

const COLUMNS: { id: TaskStatus; label: string; icon: React.ElementType }[] = [
  { id: "ideas", label: "Ideas", icon: Lightbulb },
  { id: "in_progress", label: "In Progress", icon: Wrench },
  { id: "review", label: "Review", icon: Eye },
  { id: "complete", label: "Complete", icon: CheckCircle2 },
];

const LABEL_META: Record<TaskLabel, { label: string; className: string }> = {
  invoice_wizard: { label: "InvoiceWizard", className: "bg-blue-500/15 text-blue-400 dark:text-blue-300" },
  life_coach_steven: { label: "Life Coach Steven", className: "bg-emerald-500/15 text-emerald-500 dark:text-emerald-300" },
  wesayido: { label: "WeSayIDo", className: "bg-pink-500/15 text-pink-500 dark:text-pink-300" },
  horse_race: { label: "Horse Race System", className: "bg-amber-500/15 text-amber-500 dark:text-amber-300" },
  bright_stack_labs: { label: "Bright Stack Labs", className: "bg-violet-500/15 text-violet-500 dark:text-violet-300" },
  other: { label: "Other", className: "bg-muted text-muted-foreground" },
};

const PRIORITY_META: Record<TaskPriority, { label: string; className: string }> = {
  low: { label: "Low", className: "bg-muted text-muted-foreground" },
  medium: { label: "Medium", className: "bg-amber-500/15 text-amber-500 dark:text-amber-300" },
  high: { label: "High", className: "bg-orange-500/15 text-orange-500 dark:text-orange-300" },
  urgent: { label: "Urgent", className: "bg-destructive/15 text-destructive" },
};

const ASSIGNEE_META: Record<TaskAssignee, { label: string; className: string }> = {
  steve: { label: "Steve", className: "bg-sky-500/15 text-sky-500 dark:text-sky-300" },
  clawbot: { label: "Clawbot", className: "bg-violet-500/15 text-violet-500 dark:text-violet-300" },
};

const ALL_LABELS: TaskLabel[] = ["invoice_wizard", "life_coach_steven", "wesayido", "horse_race", "bright_stack_labs", "other"];
const ALL_PRIORITIES: TaskPriority[] = ["low", "medium", "high", "urgent"];
const ALL_STATUSES: TaskStatus[] = ["ideas", "in_progress", "review", "complete"];
const ALL_ASSIGNEES: TaskAssignee[] = ["steve", "clawbot"];

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
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
            <div className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium whitespace-nowrap ${priorityMeta.className}`}>
              {priorityMeta.label}
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

interface TaskModalProps {
  task: Task | null;
  open: boolean;
  onClose: () => void;
  onSave: (updates: Partial<Task>) => void;
  onDelete: (id: string) => void;
}

function TaskModal({ task, open, onClose, onSave, onDelete }: TaskModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>("ideas");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [label, setLabel] = useState<TaskLabel>("other");
  const [assignee, setAssignee] = useState<TaskAssignee>("steve");

  useEffect(() => {
    if (task) {
      setTitle(task.title ?? "");
      setDescription(task.description ?? "");
      setStatus(task.status ?? "ideas");
      setPriority(task.priority ?? "medium");
      setLabel(task.label ?? "other");
      setAssignee(task.assignee ?? "steve");
    }
  }, [task]);

  const handleSave = () => {
    onSave({ title, description, status, priority, label, assignee });
  };

  if (!task) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg" data-testid="modal-task">
        <DialogHeader>
          <DialogTitle className="text-base">Edit Task</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">
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
              <Select value={label} onValueChange={(v) => setLabel(v as TaskLabel)}>
                <SelectTrigger data-testid="select-task-label">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALL_LABELS.map(l => (
                    <SelectItem key={l} value={l}>{LABEL_META[l].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Assigned To</Label>
              <Select value={assignee} onValueChange={(v) => setAssignee(v as TaskAssignee)}>
                <SelectTrigger data-testid="select-task-assignee">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALL_ASSIGNEES.map(a => (
                    <SelectItem key={a} value={a}>{ASSIGNEE_META[a].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
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
    queryFn: () => apiRequest<Task[]>("GET", "/tasks"),
    staleTime: 30000,
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<Task>) => apiRequest<Task>("POST", "/tasks", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/tasks"] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: Partial<Task> & { id: string }) =>
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
    updateMutation.mutate({ id: taskId, status: newStatus });
  }, [updateMutation]);

  const handleAddCard = (title: string, status: TaskStatus) => {
    createMutation.mutate({
      title,
      status,
      priority: "medium",
      label: "other",
      assignee: "clawbot",
      createdAt: new Date().toISOString(),
    });
    setAddingColumn(null);
  };

  const handleSaveTask = (updates: Partial<Task>) => {
    if (!selectedTask) return;
    updateMutation.mutate({ id: selectedTask.id, ...updates });
    setModalOpen(false);
    setSelectedTask(null);
  };

  const handleDeleteTask = (id: string) => {
    deleteMutation.mutate(id);
    setModalOpen(false);
    setSelectedTask(null);
  };

  const filteredTasks = (tasks ?? []).filter(
    t => filterLabel === "all" || t.label === filterLabel
  );

  const tasksByColumn = (status: TaskStatus) =>
    filteredTasks.filter(t => t.status === status);

  const columnColors: Record<TaskStatus, string> = {
    ideas: "text-amber-500 dark:text-amber-400",
    in_progress: "text-blue-500 dark:text-blue-400",
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
            {ALL_LABELS.map(l => (
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

      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex gap-4 p-5 h-full min-w-max">
            {COLUMNS.map(col => {
              const colTasks = tasksByColumn(col.id);
              const ColIcon = col.icon;
              return (
                <div
                  key={col.id}
                  className="flex flex-col w-72 flex-shrink-0"
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
                        className={`flex-1 rounded-md min-h-32 p-2 transition-colors ${snapshot.isDraggingOver ? "bg-primary/5 border border-primary/20" : "bg-muted/30 border border-border/50"}`}
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
      </div>

      <TaskModal
        task={selectedTask}
        open={modalOpen}
        onClose={() => { setModalOpen(false); setSelectedTask(null); }}
        onSave={handleSaveTask}
        onDelete={handleDeleteTask}
      />
    </div>
  );
}
