import { useState } from "react";
import { Plus, Trash2, Check, Bell, BellOff, X, AlarmClock, ListTodo } from "lucide-react";
import {
  useListTodos,
  useCreateTodo,
  useUpdateTodo,
  useDeleteTodo,
  useListAlarms,
  useCreateAlarm,
  useUpdateAlarm,
  useDeleteAlarm,
  getListTodosQueryKey,
  getListAlarmsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

type Props = { onClose: () => void };

type TabType = "todos" | "alarms";

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export function SidePanel({ onClose }: Props) {
  const [activeTab, setActiveTab] = useState<TabType>("todos");
  const [newTodo, setNewTodo] = useState("");
  const [newAlarmLabel, setNewAlarmLabel] = useState("");
  const [newAlarmTime, setNewAlarmTime] = useState("07:00");
  const [newAlarmDays, setNewAlarmDays] = useState<number[]>([]);
  const qc = useQueryClient();

  const todos = useListTodos();
  const createTodo = useCreateTodo();
  const updateTodo = useUpdateTodo();
  const deleteTodo = useDeleteTodo();

  const alarms = useListAlarms();
  const createAlarm = useCreateAlarm();
  const updateAlarm = useUpdateAlarm();
  const deleteAlarm = useDeleteAlarm();

  const invalidateTodos = () => void qc.invalidateQueries({ queryKey: getListTodosQueryKey() });
  const invalidateAlarms = () => void qc.invalidateQueries({ queryKey: getListAlarmsQueryKey() });

  const handleAddTodo = () => {
    if (!newTodo.trim()) return;
    createTodo.mutate({ data: { text: newTodo.trim() } }, { onSuccess: () => { invalidateTodos(); setNewTodo(""); } });
  };

  const handleToggleTodo = (id: number, completed: boolean) => {
    updateTodo.mutate({ id, data: { completed: !completed } }, { onSuccess: invalidateTodos });
  };

  const handleDeleteTodo = (id: number) => {
    deleteTodo.mutate({ id }, { onSuccess: invalidateTodos });
  };

  const handleAddAlarm = () => {
    if (!newAlarmLabel.trim()) return;
    createAlarm.mutate(
      { data: { label: newAlarmLabel.trim(), time: newAlarmTime, days: newAlarmDays } },
      { onSuccess: () => { invalidateAlarms(); setNewAlarmLabel(""); setNewAlarmTime("07:00"); setNewAlarmDays([]); } }
    );
  };

  const handleToggleAlarm = (id: number, enabled: boolean) => {
    updateAlarm.mutate({ id, data: { enabled: !enabled } }, { onSuccess: invalidateAlarms });
  };

  const handleDeleteAlarm = (id: number) => {
    deleteAlarm.mutate({ id }, { onSuccess: invalidateAlarms });
  };

  const toggleDay = (d: number) => {
    setNewAlarmDays((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]);
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-80 h-full bg-sidebar border-l border-border flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-foreground">My Space</h2>
          <button
            data-testid="close-panel"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-accent transition-colors"
          >
            <X size={16} className="text-muted-foreground" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          <button
            data-testid="tab-todos"
            onClick={() => setActiveTab("todos")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
              activeTab === "todos"
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ListTodo size={15} /> To-Do
          </button>
          <button
            data-testid="tab-alarms"
            onClick={() => setActiveTab("alarms")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
              activeTab === "alarms"
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <AlarmClock size={15} /> Alarms
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === "todos" && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  data-testid="input-todo"
                  value={newTodo}
                  onChange={(e) => setNewTodo(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddTodo()}
                  placeholder="Add a task…"
                  className="flex-1 bg-card border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
                />
                <button
                  data-testid="button-add-todo"
                  onClick={handleAddTodo}
                  disabled={!newTodo.trim() || createTodo.isPending}
                  className="p-2 rounded-xl bg-primary/20 border border-primary/30 text-primary hover:bg-primary/30 disabled:opacity-40 transition-colors"
                >
                  <Plus size={16} />
                </button>
              </div>

              {todos.isLoading && (
                <p className="text-sm text-muted-foreground text-center py-4">Loading…</p>
              )}

              {todos.data?.length === 0 && !todos.isLoading && (
                <p className="text-sm text-muted-foreground text-center py-6">No tasks yet</p>
              )}

              {todos.data?.map((todo) => (
                <div
                  key={todo.id}
                  data-testid={`todo-item-${todo.id}`}
                  className="flex items-start gap-3 p-3 rounded-xl bg-card border border-border group hover:border-border/80 transition-colors"
                >
                  <button
                    data-testid={`toggle-todo-${todo.id}`}
                    onClick={() => handleToggleTodo(todo.id, todo.completed)}
                    className={`flex-shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors mt-0.5 ${
                      todo.completed
                        ? "bg-primary border-primary"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    {todo.completed && <Check size={11} className="text-white" />}
                  </button>
                  <span
                    className={`flex-1 text-sm leading-relaxed ${
                      todo.completed ? "line-through text-muted-foreground" : "text-foreground"
                    }`}
                  >
                    {todo.text}
                  </span>
                  <button
                    data-testid={`delete-todo-${todo.id}`}
                    onClick={() => handleDeleteTodo(todo.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-all"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {activeTab === "alarms" && (
            <div className="space-y-3">
              <div className="space-y-2 p-3 bg-card border border-border rounded-xl">
                <input
                  data-testid="input-alarm-label"
                  value={newAlarmLabel}
                  onChange={(e) => setNewAlarmLabel(e.target.value)}
                  placeholder="Label…"
                  className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
                />
                <input
                  data-testid="input-alarm-time"
                  type="time"
                  value={newAlarmTime}
                  onChange={(e) => setNewAlarmTime(e.target.value)}
                  className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/50 transition-colors"
                />
                <div className="flex gap-1 justify-between">
                  {DAYS.map((d, i) => (
                    <button
                      key={d}
                      data-testid={`day-${d}`}
                      onClick={() => toggleDay(i)}
                      className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                        newAlarmDays.includes(i)
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-accent"
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
                <button
                  data-testid="button-add-alarm"
                  onClick={handleAddAlarm}
                  disabled={!newAlarmLabel.trim() || createAlarm.isPending}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-primary/20 border border-primary/30 text-primary text-sm font-medium hover:bg-primary/30 disabled:opacity-40 transition-colors"
                >
                  <Plus size={15} /> Add Alarm
                </button>
              </div>

              {alarms.isLoading && (
                <p className="text-sm text-muted-foreground text-center py-4">Loading…</p>
              )}

              {alarms.data?.length === 0 && !alarms.isLoading && (
                <p className="text-sm text-muted-foreground text-center py-6">No alarms set</p>
              )}

              {alarms.data?.map((alarm) => (
                <div
                  key={alarm.id}
                  data-testid={`alarm-item-${alarm.id}`}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-colors group ${
                    alarm.enabled
                      ? "bg-card border-border"
                      : "bg-card/50 border-border/50 opacity-60"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground font-mono">{alarm.time}</p>
                    <p className="text-xs text-muted-foreground truncate">{alarm.label}</p>
                    {alarm.days.length > 0 && (
                      <div className="flex gap-0.5 mt-1">
                        {DAYS.map((d, i) => (
                          <span
                            key={d}
                            className={`text-[10px] ${
                              alarm.days.includes(i) ? "text-primary font-medium" : "text-muted-foreground/40"
                            }`}
                          >
                            {d}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    data-testid={`toggle-alarm-${alarm.id}`}
                    onClick={() => handleToggleAlarm(alarm.id, alarm.enabled)}
                    className="p-1.5 rounded-lg hover:bg-accent transition-colors"
                  >
                    {alarm.enabled ? (
                      <Bell size={15} className="text-primary" />
                    ) : (
                      <BellOff size={15} className="text-muted-foreground" />
                    )}
                  </button>
                  <button
                    data-testid={`delete-alarm-${alarm.id}`}
                    onClick={() => handleDeleteAlarm(alarm.id)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-all"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
