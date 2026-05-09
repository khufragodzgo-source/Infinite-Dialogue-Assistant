import { useState, useEffect } from "react";
import { Plus, Trash2, Check, Bell, BellOff, X, AlarmClock, ListTodo, Globe } from "lucide-react";
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

const TIMEZONE_OPTIONS = [
  { label: "India (IST, UTC+5:30)", value: "Asia/Kolkata" },
  { label: "UK (GMT/BST)", value: "Europe/London" },
  { label: "US Eastern (ET)", value: "America/New_York" },
  { label: "US Pacific (PT)", value: "America/Los_Angeles" },
  { label: "Dubai (GST, UTC+4)", value: "Asia/Dubai" },
  { label: "Singapore (SGT, UTC+8)", value: "Asia/Singapore" },
  { label: "UTC", value: "UTC" },
];

function useTimezone() {
  const [tz, setTzState] = useState<string>(() => {
    return localStorage.getItem("mani_timezone") ?? "Asia/Kolkata";
  });
  const setTz = (v: string) => {
    localStorage.setItem("mani_timezone", v);
    setTzState(v);
  };
  return [tz, setTz] as const;
}

function formatTimeInTz(time24: string, tz: string): string {
  // time24 is "HH:MM" stored in the selected timezone
  try {
    const [h, m] = time24.split(":").map(Number);
    const now = new Date();
    now.setHours(h, m, 0, 0);
    return now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: tz });
  } catch {
    return time24;
  }
}

function getCurrentTimeInTz(tz: string): string {
  try {
    const now = new Date();
    // Get HH:MM in the target timezone
    const parts = new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit", minute: "2-digit", hour12: false, timeZone: tz,
    }).formatToParts(now);
    const h = parts.find((p) => p.type === "hour")?.value ?? "07";
    const min = parts.find((p) => p.type === "minute")?.value ?? "00";
    return `${h}:${min}`;
  } catch {
    return "07:00";
  }
}

// Check alarms against current time in user's timezone
export function useAlarmChecker() {
  const alarms = useListAlarms();
  const [tz] = useTimezone();

  useEffect(() => {
    const check = () => {
      if (!alarms.data) return;
      const now = new Date();
      const currentTime = getCurrentTimeInTz(tz);
      const currentDow = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: tz })
        .format(now);
      const dowMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
      const currentDowNum = dowMap[currentDow] ?? now.getDay();
      const currentSeconds = now.getSeconds();

      for (const alarm of alarms.data) {
        if (!alarm.enabled) continue;
        if (alarm.time !== currentTime) continue;
        if (currentSeconds > 10) continue; // only fire in first 10s of the minute
        if (alarm.days.length > 0 && !alarm.days.includes(currentDowNum)) continue;

        // Fire the alarm!
        const ring = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAA==");
        void ring.play().catch(() => {});
        if (Notification.permission === "granted") {
          new Notification(`⏰ ${alarm.label}`, { body: `Alarm: ${alarm.time} (${tz})` });
        } else {
          alert(`⏰ Alarm: ${alarm.label} — ${alarm.time}`);
        }
      }
    };

    const interval = setInterval(check, 10000); // check every 10s
    return () => clearInterval(interval);
  }, [alarms.data, tz]);
}

export function SidePanel({ onClose }: Props) {
  const [activeTab, setActiveTab] = useState<TabType>("todos");
  const [newTodo, setNewTodo] = useState("");
  const [newAlarmLabel, setNewAlarmLabel] = useState("");
  const [newAlarmDays, setNewAlarmDays] = useState<number[]>([]);
  const [showTzPicker, setShowTzPicker] = useState(false);
  const [tz, setTz] = useTimezone();
  const [newAlarmTime, setNewAlarmTime] = useState(() => getCurrentTimeInTz(tz));
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

  // Request notification permission
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      void Notification.requestPermission();
    }
  }, []);

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
      {
        onSuccess: () => {
          invalidateAlarms();
          setNewAlarmLabel("");
          setNewAlarmTime(getCurrentTimeInTz(tz));
          setNewAlarmDays([]);
        },
      }
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

  const tzLabel = TIMEZONE_OPTIONS.find((t) => t.value === tz)?.label ?? tz;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-80 h-full bg-sidebar border-l border-border flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-foreground">My Space</h2>
          <button data-testid="close-panel" onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent transition-colors">
            <X size={16} className="text-muted-foreground" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          <button
            data-testid="tab-todos"
            onClick={() => setActiveTab("todos")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
              activeTab === "todos" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ListTodo size={15} /> To-Do
          </button>
          <button
            data-testid="tab-alarms"
            onClick={() => setActiveTab("alarms")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
              activeTab === "alarms" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <AlarmClock size={15} /> Alarms
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {/* ── TODOS ── */}
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

              {todos.isLoading && <p className="text-sm text-muted-foreground text-center py-4">Loading…</p>}
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
                      todo.completed ? "bg-primary border-primary" : "border-border hover:border-primary/50"
                    }`}
                  >
                    {todo.completed && <Check size={11} className="text-white" />}
                  </button>
                  <span className={`flex-1 text-sm leading-relaxed ${todo.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
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

          {/* ── ALARMS ── */}
          {activeTab === "alarms" && (
            <div className="space-y-3">
              {/* Timezone selector */}
              <div className="relative">
                <button
                  data-testid="button-timezone"
                  onClick={() => setShowTzPicker(!showTzPicker)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/10 border border-primary/25 text-sm hover:bg-primary/15 transition-colors"
                >
                  <Globe size={13} className="text-primary" />
                  <span className="flex-1 text-left text-foreground truncate">{tzLabel}</span>
                  <span className="text-xs text-muted-foreground">{showTzPicker ? "▲" : "▼"}</span>
                </button>
                {showTzPicker && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-xl z-10 overflow-hidden">
                    {TIMEZONE_OPTIONS.map((t) => (
                      <button
                        key={t.value}
                        data-testid={`tz-option-${t.value}`}
                        onClick={() => { setTz(t.value); setNewAlarmTime(getCurrentTimeInTz(t.value)); setShowTzPicker(false); }}
                        className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-accent ${
                          tz === t.value ? "text-primary font-medium" : "text-foreground"
                        }`}
                      >
                        {t.label}
                        {tz === t.value && <span className="float-right text-primary">✓</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* New alarm form */}
              <div className="space-y-2 p-3 bg-card border border-border rounded-xl">
                <input
                  data-testid="input-alarm-label"
                  value={newAlarmLabel}
                  onChange={(e) => setNewAlarmLabel(e.target.value)}
                  placeholder="Label (e.g. Wake up)"
                  className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
                />
                <div className="flex items-center gap-2">
                  <input
                    data-testid="input-alarm-time"
                    type="time"
                    value={newAlarmTime}
                    onChange={(e) => setNewAlarmTime(e.target.value)}
                    className="flex-1 bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/50 transition-colors"
                  />
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {TIMEZONE_OPTIONS.find((t) => t.value === tz)?.label.split("(")[1]?.replace(")", "") ?? "IST"}
                  </span>
                </div>
                <div className="flex gap-1 justify-between">
                  {DAYS.map((d, i) => (
                    <button
                      key={d}
                      data-testid={`day-${d}`}
                      onClick={() => toggleDay(i)}
                      className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                        newAlarmDays.includes(i) ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"
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
                  <Plus size={15} /> Set Alarm
                </button>
              </div>

              {alarms.isLoading && <p className="text-sm text-muted-foreground text-center py-4">Loading…</p>}
              {alarms.data?.length === 0 && !alarms.isLoading && (
                <p className="text-sm text-muted-foreground text-center py-6">No alarms set</p>
              )}

              {alarms.data?.map((alarm) => (
                <div
                  key={alarm.id}
                  data-testid={`alarm-item-${alarm.id}`}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-colors group ${
                    alarm.enabled ? "bg-card border-border" : "bg-card/50 border-border/50 opacity-60"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground font-mono">{formatTimeInTz(alarm.time, tz)}</p>
                    <p className="text-xs text-muted-foreground truncate">{alarm.label}</p>
                    {alarm.days.length > 0 && (
                      <div className="flex gap-0.5 mt-0.5">
                        {DAYS.map((d, i) => (
                          <span key={d} className={`text-[10px] ${alarm.days.includes(i) ? "text-primary font-medium" : "text-muted-foreground/30"}`}>
                            {d}
                          </span>
                        ))}
                      </div>
                    )}
                    {alarm.days.length === 0 && (
                      <p className="text-[10px] text-muted-foreground/60">One-time</p>
                    )}
                  </div>
                  <button
                    data-testid={`toggle-alarm-${alarm.id}`}
                    onClick={() => handleToggleAlarm(alarm.id, alarm.enabled)}
                    className="p-1.5 rounded-lg hover:bg-accent transition-colors"
                  >
                    {alarm.enabled ? <Bell size={15} className="text-primary" /> : <BellOff size={15} className="text-muted-foreground" />}
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
