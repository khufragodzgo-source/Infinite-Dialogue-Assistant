import { useEffect, useState } from "react";
import { X, Volume2, Check } from "lucide-react";
import type { VoiceConfig, VoiceMode } from "@/hooks/useManiChat";

type Props = {
  config: VoiceConfig;
  onChange: (c: VoiceConfig) => void;
  onClose: () => void;
};

export function VoiceSettings({ config, onChange, onClose }: Props) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    const load = () => {
      const v = window.speechSynthesis.getVoices().filter((v) => v.lang.startsWith("en"));
      setVoices(v);
    };
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, []);

  const previewVoice = (uri: string) => {
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance("Hey, I'm Mani, your AI assistant!");
    const voice = window.speechSynthesis.getVoices().find((v) => v.voiceURI === uri);
    if (voice) utt.voice = voice;
    utt.lang = "en-US";
    utt.rate = config.rate;
    utt.pitch = config.pitch;
    window.speechSynthesis.speak(utt);
  };

  const setMode = (mode: VoiceMode) => onChange({ ...config, mode });

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-card border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl p-5 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Volume2 size={16} className="text-primary" />
            <h2 className="font-semibold text-foreground">Voice Settings</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent transition-colors">
            <X size={16} className="text-muted-foreground" />
          </button>
        </div>

        {/* Voice source */}
        <div className="mb-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-2">Voice Source</p>
          <div className="flex gap-2">
            <button
              data-testid="voice-mode-inworld"
              onClick={() => setMode("inworld")}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                config.mode === "inworld"
                  ? "bg-primary/20 border-primary/50 text-primary"
                  : "bg-card border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              🎙 Inworld AI
            </button>
            <button
              data-testid="voice-mode-browser"
              onClick={() => setMode("browser")}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                config.mode === "browser"
                  ? "bg-primary/20 border-primary/50 text-primary"
                  : "bg-card border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              🔊 Device Voice
            </button>
          </div>
          {config.mode === "inworld" && (
            <p className="text-xs text-muted-foreground mt-2 px-1">
              Uses Inworld AI's natural voice. Falls back to device voice if unavailable.
            </p>
          )}
        </div>

        {/* Browser voice picker (shown when browser mode or as fallback info) */}
        {config.mode === "browser" && voices.length > 0 && (
          <div className="mb-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-2">
              Select Voice
            </p>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {voices.map((v) => (
                <div
                  key={v.voiceURI}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer border transition-all ${
                    config.browserVoiceURI === v.voiceURI
                      ? "bg-primary/15 border-primary/40"
                      : "border-transparent hover:bg-accent"
                  }`}
                  onClick={() => onChange({ ...config, browserVoiceURI: v.voiceURI })}
                  data-testid={`voice-option-${v.name}`}
                >
                  {config.browserVoiceURI === v.voiceURI && (
                    <Check size={13} className="text-primary flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">{v.name}</p>
                    <p className="text-xs text-muted-foreground">{v.lang}</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); previewVoice(v.voiceURI); }}
                    className="text-xs text-primary/70 hover:text-primary px-2 py-1 rounded-lg hover:bg-primary/10 transition-colors"
                  >
                    Preview
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Speed */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Speed</p>
            <span className="text-xs text-primary font-mono">{config.rate.toFixed(1)}×</span>
          </div>
          <input
            type="range"
            min="0.7"
            max="1.8"
            step="0.1"
            value={config.rate}
            onChange={(e) => onChange({ ...config, rate: parseFloat(e.target.value) })}
            className="w-full accent-[hsl(var(--primary))]"
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>Slow</span><span>Fast</span>
          </div>
        </div>

        {/* Pitch (browser only) */}
        {config.mode === "browser" && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Pitch</p>
              <span className="text-xs text-primary font-mono">{config.pitch.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={config.pitch}
              onChange={(e) => onChange({ ...config, pitch: parseFloat(e.target.value) })}
              className="w-full accent-[hsl(var(--primary))]"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>Deep</span><span>High</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
