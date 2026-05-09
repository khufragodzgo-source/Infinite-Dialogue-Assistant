import { useState } from "react";
import { X, Volume2, Check, Play } from "lucide-react";
import type { VoiceConfig } from "@/hooks/useManiChat";

type Props = {
  config: VoiceConfig;
  onChange: (c: VoiceConfig) => void;
  onClose: () => void;
};

type OpenAIVoice = "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";

const VOICES: { id: OpenAIVoice; label: string; desc: string }[] = [
  { id: "nova",    label: "Nova",    desc: "Warm & expressive" },
  { id: "alloy",   label: "Alloy",   desc: "Neutral & clear" },
  { id: "echo",    label: "Echo",    desc: "Smooth & balanced" },
  { id: "fable",   label: "Fable",   desc: "British accent, narrative" },
  { id: "onyx",    label: "Onyx",    desc: "Deep & authoritative" },
  { id: "shimmer", label: "Shimmer", desc: "Soft & conversational" },
];

export function VoiceSettings({ config, onChange, onClose }: Props) {
  const [previewingVoice, setPreviewingVoice] = useState<OpenAIVoice | null>(null);

  const previewVoice = async (voice: OpenAIVoice) => {
    if (previewingVoice) return;
    setPreviewingVoice(voice);
    try {
      const res = await fetch("/api/mani/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Hey, I'm Mani, your personal AI assistant. How can I help you today?", voice }),
      });
      if (res.status === 204) {
        // Fallback preview via browser speech
        const utt = new SpeechSynthesisUtterance("Hey, I'm Mani. How can I help?");
        utt.lang = "en-US";
        window.speechSynthesis.speak(utt);
        return;
      }
      if (!res.ok) return;
      const data = await res.json() as { audio: string; format: string };
      const byteChars = atob(data.audio);
      const bytes = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
      const blob = new Blob([bytes], { type: `audio/${data.format}` });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      await audio.play();
    } catch {
      // ignore preview errors
    } finally {
      setPreviewingVoice(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-card border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl p-5">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Volume2 size={16} className="text-primary" />
            <h2 className="font-semibold text-foreground">Voice Settings</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent transition-colors">
            <X size={16} className="text-muted-foreground" />
          </button>
        </div>
        <p className="text-xs text-muted-foreground mb-5 pl-6">Powered by OpenAI gpt-audio-mini</p>

        {/* Voice picker */}
        <div className="mb-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-2">Choose Voice</p>
          <div className="grid grid-cols-2 gap-2">
            {VOICES.map((v) => (
              <div
                key={v.id}
                onClick={() => onChange({ ...config, openaiVoice: v.id })}
                className={`relative flex flex-col gap-0.5 px-3 py-2.5 rounded-xl border cursor-pointer transition-all ${
                  config.openaiVoice === v.id
                    ? "bg-primary/15 border-primary/50"
                    : "bg-card border-border hover:border-border/80 hover:bg-accent/50"
                }`}
              >
                {config.openaiVoice === v.id && (
                  <Check size={11} className="absolute top-2 right-2 text-primary" />
                )}
                <p className={`text-sm font-semibold ${config.openaiVoice === v.id ? "text-primary" : "text-foreground"}`}>
                  {v.label}
                </p>
                <p className="text-xs text-muted-foreground">{v.desc}</p>
                <button
                  onClick={(e) => { e.stopPropagation(); void previewVoice(v.id); }}
                  disabled={previewingVoice !== null}
                  className="mt-1.5 flex items-center gap-1 text-[11px] text-primary/70 hover:text-primary disabled:opacity-40 transition-colors w-fit"
                >
                  <Play size={9} />
                  {previewingVoice === v.id ? "Loading…" : "Preview"}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Speed */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Response Speed</p>
            <span className="text-xs text-primary font-mono">{config.rate.toFixed(1)}×</span>
          </div>
          <input
            type="range" min="0.7" max="1.8" step="0.1"
            value={config.rate}
            onChange={(e) => onChange({ ...config, rate: parseFloat(e.target.value) })}
            className="w-full accent-[hsl(var(--primary))]"
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>Slower</span><span>Faster</span>
          </div>
        </div>
      </div>
    </div>
  );
}
