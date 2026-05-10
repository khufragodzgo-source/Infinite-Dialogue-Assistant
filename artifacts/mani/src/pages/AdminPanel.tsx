import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Users, Key, RefreshCw, Eye, EyeOff, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import type { AuthUser } from "@/hooks/useAuth";

type Props = { user: AuthUser; onBack: () => void };

type UserItem = {
  id: number;
  email: string;
  isAdmin: boolean;
  createdAt: string;
  messageCount: number;
};

type MessageItem = {
  id: number;
  role: string;
  content: string;
  createdAt: string;
  userId: number | null;
};

type OpenAIConfig = {
  hasCustomKey: boolean;
  keyPreview: string | null;
  updatedAt: string | null;
};

type Tab = "users" | "apikey";

export function AdminPanel({ user, onBack }: Props) {
  const [tab, setTab] = useState<Tab>("users");
  const [users, setUsers] = useState<UserItem[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [config, setConfig] = useState<OpenAIConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [newApiKey, setNewApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const fetchUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const res = await fetch("/api/admin/users", { credentials: "include" });
      const data = (await res.json()) as UserItem[];
      setUsers(data);
    } catch { setUsers([]); }
    finally { setUsersLoading(false); }
  }, []);

  const fetchConfig = useCallback(async () => {
    setConfigLoading(true);
    try {
      const res = await fetch("/api/admin/config/openai", { credentials: "include" });
      const data = (await res.json()) as OpenAIConfig;
      setConfig(data);
    } catch { setConfig(null); }
    finally { setConfigLoading(false); }
  }, []);

  const fetchMessages = useCallback(async (userId: number) => {
    setMessagesLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/messages`, { credentials: "include" });
      const data = (await res.json()) as MessageItem[];
      setMessages(data);
    } catch { setMessages([]); }
    finally { setMessagesLoading(false); }
  }, []);

  useEffect(() => { void fetchUsers(); }, [fetchUsers]);
  useEffect(() => { void fetchConfig(); }, [fetchConfig]);

  const handleSelectUser = (u: UserItem) => {
    setSelectedUser(u);
    void fetchMessages(u.id);
  };

  const handleSaveKey = async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch("/api/admin/config/openai", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ apiKey: newApiKey.trim() }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (data.success) {
        setSaveMsg({ ok: true, text: newApiKey.trim() ? "API key saved! Mani will now use it." : "Reverted to default credits." });
        setNewApiKey("");
        await fetchConfig();
      } else {
        setSaveMsg({ ok: false, text: data.error ?? "Failed to save." });
      }
    } catch {
      setSaveMsg({ ok: false, text: "Connection error." });
    }
    setSaving(false);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border px-5 py-4 flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="font-semibold text-foreground">Admin Panel</h1>
          <p className="text-xs text-muted-foreground">{user.email}</p>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex border-b border-border px-5">
        <button
          onClick={() => setTab("users")}
          className={`flex items-center gap-2 py-3 px-1 mr-6 text-sm font-medium border-b-2 transition-colors ${
            tab === "users" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Users size={14} /> Users
        </button>
        <button
          onClick={() => setTab("apikey")}
          className={`flex items-center gap-2 py-3 px-1 text-sm font-medium border-b-2 transition-colors ${
            tab === "apikey" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Key size={14} /> API Key
        </button>
      </div>

      <div className="p-5 max-w-2xl mx-auto">
        {/* ── USERS TAB ── */}
        {tab === "users" && (
          <div className="flex gap-4">
            {/* User list */}
            <div className="w-56 flex-shrink-0">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Users ({users.length})</p>
                <button onClick={fetchUsers} className="p-1 rounded hover:bg-accent transition-colors" title="Refresh">
                  <RefreshCw size={12} className="text-muted-foreground" />
                </button>
              </div>
              {usersLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={20} className="animate-spin text-muted-foreground" />
                </div>
              ) : users.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No users yet</p>
              ) : (
                <div className="space-y-1.5">
                  {users.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => handleSelectUser(u)}
                      className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all ${
                        selectedUser?.id === u.id
                          ? "bg-primary/15 border-primary/40"
                          : "bg-card border-border hover:border-border/80 hover:bg-accent/50"
                      }`}
                    >
                      <p className="text-xs font-medium text-foreground truncate">{u.email}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{u.messageCount} msgs {u.isAdmin && "· admin"}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Messages */}
            <div className="flex-1 min-w-0">
              {!selectedUser ? (
                <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                  <Users size={28} className="mb-2 opacity-30" />
                  <p className="text-sm">Select a user to view their chats</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{selectedUser.email}</p>
                      <p className="text-xs text-muted-foreground">
                        Joined {new Date(selectedUser.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={() => void fetchMessages(selectedUser.id)}
                      className="p-1.5 rounded-lg hover:bg-accent transition-colors"
                    >
                      <RefreshCw size={12} className="text-muted-foreground" />
                    </button>
                  </div>

                  {messagesLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 size={20} className="animate-spin text-muted-foreground" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <p className="text-sm">No messages yet</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                      {messages.map((m) => (
                        <div
                          key={m.id}
                          className={`px-3 py-2 rounded-xl text-sm ${
                            m.role === "user"
                              ? "bg-primary/10 border border-primary/20 ml-4"
                              : "bg-card border border-border mr-4"
                          }`}
                        >
                          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">
                            {m.role}
                          </p>
                          <p className="text-foreground whitespace-pre-wrap text-xs leading-relaxed line-clamp-6">
                            {m.content}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* ── API KEY TAB ── */}
        {tab === "apikey" && (
          <div className="max-w-sm space-y-5">
            <div>
              <h2 className="font-semibold text-foreground mb-1">OpenAI API Key</h2>
              <p className="text-sm text-muted-foreground">
                When Replit AI credits run out, paste your own OpenAI API key here. Mani will use it for all AI features.
              </p>
            </div>

            {/* Current status */}
            {!configLoading && (
              <div className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${
                config?.hasCustomKey
                  ? "bg-green-500/10 border-green-500/30"
                  : "bg-card border-border"
              }`}>
                {config?.hasCustomKey ? (
                  <>
                    <CheckCircle size={16} className="text-green-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Custom key active</p>
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">{config.keyPreview}</p>
                      {config.updatedAt && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Updated {new Date(config.updatedAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <AlertCircle size={16} className="text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Using Replit AI credits</p>
                      <p className="text-xs text-muted-foreground mt-0.5">No custom key set</p>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Input */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">
                {config?.hasCustomKey ? "Replace API Key" : "Set API Key"}
              </label>
              <div className="relative">
                <input
                  type={showKey ? "text" : "password"}
                  value={newApiKey}
                  onChange={(e) => setNewApiKey(e.target.value)}
                  placeholder="sk-..."
                  className="w-full bg-card border border-border rounded-xl px-4 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground font-mono focus:outline-none focus:border-primary/50 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">Leave blank to remove custom key and revert to Replit credits.</p>
            </div>

            {saveMsg && (
              <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm ${
                saveMsg.ok
                  ? "bg-green-500/10 border-green-500/30 text-green-400"
                  : "bg-destructive/10 border-destructive/30 text-destructive"
              }`}>
                {saveMsg.ok ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                {saveMsg.text}
              </div>
            )}

            <button
              onClick={handleSaveKey}
              disabled={saving}
              className="w-full py-2.5 rounded-xl bg-primary/20 border border-primary/40 text-primary font-semibold text-sm hover:bg-primary/30 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
