import { useState, useRef, useEffect, useCallback } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { LayoutGrid, Trash2, Send, ChevronDown, Volume2, LogOut } from "lucide-react";
import { MicButton } from "@/components/MicButton";
import { ChatMessage } from "@/components/ChatMessage";
import { SidePanel } from "@/components/SidePanel";
import { VoiceSettings } from "@/components/VoiceSettings";
import { LoginPage } from "@/pages/LoginPage";
import { AdminPanel } from "@/pages/AdminPanel";
import { useManiChat, DEFAULT_VOICE_CONFIG, type VoiceConfig } from "@/hooks/useManiChat";
import { useAuth } from "@/hooks/useAuth";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

function ForceDark() {
  useEffect(() => { document.documentElement.classList.add("dark"); }, []);
  return null;
}

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center animate-pulse">
          <span className="text-primary font-bold text-lg">M</span>
        </div>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    </div>
  );
}

function ManiApp() {
  const auth = useAuth();
  const [, navigate] = useLocation();

  const [voiceConfig, setVoiceConfig] = useState<VoiceConfig>(() => {
    try {
      const saved = localStorage.getItem("mani_voice_config");
      return saved ? (JSON.parse(saved) as VoiceConfig) : DEFAULT_VOICE_CONFIG;
    } catch { return DEFAULT_VOICE_CONFIG; }
  });
  const [autoMode, setAutoMode] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [showScrollDown, setShowScrollDown] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const startRecordingRef = useRef<(() => void) | null>(null);

  const handleAutoListenStart = useCallback(() => {
    startRecordingRef.current?.();
  }, []);

  const {
    messages, isRecording, isProcessing, isSpeaking, silenceCountdown,
    startRecording, stopRecording, sendText, clearHistory,
  } = useManiChat({ voiceConfig, autoMode, onAutoListenStart: handleAutoListenStart });

  useEffect(() => { startRecordingRef.current = startRecording; }, [startRecording]);
  useEffect(() => {
    localStorage.setItem("mani_voice_config", JSON.stringify(voiceConfig));
  }, [voiceConfig]);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    setShowScrollDown(el.scrollHeight - el.scrollTop - el.clientHeight > 120);
  }, []);

  const handleSendText = () => {
    if (!textInput.trim() || isProcessing) return;
    sendText(textInput);
    setTextInput("");
  };

  if (auth.isLoading) return <LoadingScreen />;
  if (!auth.user) return <LoginPage auth={auth} />;

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden relative">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[50%] -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-primary/5 blur-[100px]" />
        <div className="absolute bottom-[10%] right-[-10%] w-[400px] h-[400px] rounded-full bg-primary/4 blur-[120px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-5 py-4 border-b border-border/60">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
            <span className="text-primary font-bold text-sm">M</span>
          </div>
          <div>
            <h1 className="text-base font-semibold text-foreground leading-none">Mani</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isRecording ? <span className="text-destructive font-medium">Listening…</span>
              : isProcessing ? <span className="text-primary/80">Thinking…</span>
              : isSpeaking ? <span className="text-primary/80">Speaking…</span>
              : autoMode ? <span className="text-primary/60">Continuous mode on</span>
              : "Your AI assistant"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {messages.length > 0 && (
            <button onClick={clearHistory} title="Clear conversation"
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-card border border-transparent hover:border-border transition-all">
              <Trash2 size={15} />
            </button>
          )}
          <button onClick={() => setShowVoiceSettings(true)} title="Voice settings"
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-card border border-transparent hover:border-border transition-all">
            <Volume2 size={15} />
          </button>
          <button onClick={() => setShowPanel(true)}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-card border border-transparent hover:border-border transition-all">
            <LayoutGrid size={15} />
          </button>
          <button onClick={() => void auth.logout()} title="Sign out"
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-card border border-transparent hover:border-border transition-all">
            <LogOut size={15} />
          </button>
        </div>
      </header>

      {/* Messages */}
      <div ref={scrollContainerRef} onScroll={handleScroll}
        className="relative z-10 flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-4 pb-10">
            <div className="w-16 h-16 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center">
              <span className="text-primary font-bold text-2xl">M</span>
            </div>
            <div className="text-center space-y-1">
              <p className="font-semibold text-foreground text-lg">Hey, I'm Mani</p>
              <p className="text-sm text-muted-foreground max-w-xs">
                Your personal AI assistant. Tap the mic or type to start.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center mt-2 max-w-xs">
              {["What can you do?", "Write me some code", "Add a to-do"].map((q) => (
                <button key={q} onClick={() => sendText(q)}
                  className="px-3 py-1.5 rounded-xl text-xs text-muted-foreground border border-border hover:border-primary/40 hover:text-foreground hover:bg-card transition-all">
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) => <ChatMessage key={m.id} message={m} />)}
        <div ref={messagesEndRef} />
      </div>

      {showScrollDown && (
        <button onClick={() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })}
          className="absolute bottom-40 right-4 z-20 p-2 rounded-full bg-card border border-border shadow-lg hover:bg-accent transition-all">
          <ChevronDown size={16} className="text-muted-foreground" />
        </button>
      )}

      {/* Bottom controls */}
      <div className="relative z-10 pb-6 pt-3 px-4 border-t border-border/60 bg-background/90 backdrop-blur-xl">
        <div className="flex gap-2 mb-5">
          <input
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendText()}
            placeholder="Type a message…"
            disabled={isRecording || isProcessing}
            className="flex-1 bg-card border border-border rounded-2xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors disabled:opacity-50"
          />
          <button onClick={handleSendText}
            disabled={!textInput.trim() || isProcessing || isRecording}
            className="p-2.5 rounded-2xl bg-primary/20 border border-primary/30 text-primary hover:bg-primary/30 disabled:opacity-40 transition-colors">
            <Send size={17} />
          </button>
        </div>
        <div className="flex items-center justify-center">
          <MicButton
            isRecording={isRecording} isProcessing={isProcessing} isSpeaking={isSpeaking}
            autoMode={autoMode} silenceCountdown={silenceCountdown}
            onStart={startRecording} onStop={stopRecording}
            onToggleAuto={() => setAutoMode((v) => !v)}
          />
        </div>
      </div>

      {showPanel && <SidePanel onClose={() => setShowPanel(false)} />}
      {showVoiceSettings && (
        <VoiceSettings config={voiceConfig} onChange={setVoiceConfig} onClose={() => setShowVoiceSettings(false)} />
      )}
    </div>
  );
}

function AdminRoute() {
  const auth = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!auth.isLoading && !auth.user?.isAdmin) {
      void navigate("/");
    }
  }, [auth.isLoading, auth.user, navigate]);

  if (auth.isLoading) return <LoadingScreen />;
  if (!auth.user?.isAdmin) return <LoadingScreen />;
  return <AdminPanel user={auth.user} onBack={() => void navigate("/")} />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ForceDark />
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Switch>
            <Route path="/xadmin" component={AdminRoute} />
            <Route path="/" component={ManiApp} />
          </Switch>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
