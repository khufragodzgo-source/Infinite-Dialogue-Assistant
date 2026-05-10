import { useState } from "react";
import { Plus, Trash2, Check, X, ListTodo } from "lucide-react";
import {
  useListTodos,
  useCreateTodo,
  useUpdateTodo,
  useDeleteTodo,
  getListTodosQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

type Props = { onClose: () => void };

export function SidePanel({ onClose }: Props) {
  const [newTodo, setNewTodo] = useState("");
  const qc = useQueryClient();

  const todos = useListTodos();
  const createTodo = useCreateTodo();
  const updateTodo = useUpdateTodo();
  const deleteTodo = useDeleteTodo();

  const invalidate = () => void qc.invalidateQueries({ queryKey: getListTodosQueryKey() });

  const handleAdd = () => {
    if (!newTodo.trim()) return;
    createTodo.mutate({ data: { text: newTodo.trim() } }, {
      onSuccess: () => { invalidate(); setNewTodo(""); },
    });
  };

  const handleToggle = (id: number, completed: boolean) => {
    updateTodo.mutate({ id, data: { completed: !completed } }, { onSuccess: invalidate });
  };

  const handleDelete = (id: number) => {
    deleteTodo.mutate({ id }, { onSuccess: invalidate });
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-80 h-full bg-sidebar border-l border-border flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <ListTodo size={15} className="text-primary" />
            <h2 className="font-semibold text-foreground">To-Do List</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent transition-colors">
            <X size={16} className="text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {/* Add input */}
          <div className="flex gap-2 mb-4">
            <input
              value={newTodo}
              onChange={(e) => setNewTodo(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder="Add a task…"
              className="flex-1 bg-card border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
            />
            <button
              onClick={handleAdd}
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

          <div className="space-y-2">
            {todos.data?.map((todo) => (
              <div key={todo.id}
                className="flex items-start gap-3 p-3 rounded-xl bg-card border border-border group hover:border-border/80 transition-colors">
                <button
                  onClick={() => handleToggle(todo.id, todo.completed)}
                  className={`flex-shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors mt-0.5 ${
                    todo.completed ? "bg-primary border-primary" : "border-border hover:border-primary/50"
                  }`}
                >
                  {todo.completed && <Check size={11} className="text-white" />}
                </button>
                <span className={`flex-1 text-sm leading-relaxed ${
                  todo.completed ? "line-through text-muted-foreground" : "text-foreground"
                }`}>
                  {todo.text}
                </span>
                <button
                  onClick={() => handleDelete(todo.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-all"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
