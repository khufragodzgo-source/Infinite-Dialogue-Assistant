import { Mic, MicOff, Loader2, Radio } from "lucide-react";

type Props = {
  isRecording: boolean;
  isProcessing: boolean;
  isSpeaking: boolean;
  autoMode: boolean;
  silenceCountdown: number | null;
  onStart: () => void;
  onStop: () => void;
  onToggleAuto: () => void;
};

export function MicButton({
  isRecording,
  isProcessing,
  isSpeaking,
  autoMode,
  silenceCountdown,
  onStart,
  onStop,
  onToggleAuto,
}: Props) {
  const handleMicClick = () => {
    if (isProcessing) return;
    if (isRecording) onStop();
    else onStart();
  };

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Wave bars while recording */}
      {isRecording && (
        <div className="flex items-end gap-0.5 h-7">
          {[3, 5, 8, 11, 14, 11, 8, 5, 3].map((h, i) => (
            <div
              key={i}
              className="wave-bar w-1 rounded-full bg-destructive/80"
              style={{ height: `${h * 2}px` }}
            />
          ))}
        </div>
      )}

      {/* Silence countdown */}
      {isRecording && silenceCountdown !== null && (
        <p className="text-xs text-muted-foreground">
          Sending in <span className="text-destructive font-bold">{silenceCountdown}s</span>…
        </p>
      )}

      {/* Speaking indicator */}
      {isSpeaking && !isRecording && (
        <div className="flex items-end gap-0.5 h-7">
          {[4, 7, 10, 12, 10, 7, 4].map((h, i) => (
            <div
              key={i}
              className="wave-bar w-1 rounded-full bg-primary/60"
              style={{ height: `${h * 2}px` }}
            />
          ))}
        </div>
      )}

      <div className="flex items-center gap-5">
        {/* Auto-mode toggle */}
        <button
          data-testid="button-auto-mode"
          onClick={onToggleAuto}
          title={autoMode ? "Auto-listen ON — tap to turn off" : "Auto-listen OFF — tap to enable continuous chat"}
          className={`flex flex-col items-center gap-1 transition-all ${
            autoMode ? "opacity-100" : "opacity-40 hover:opacity-70"
          }`}
        >
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center border transition-all ${
            autoMode
              ? "bg-primary/20 border-primary/50 text-primary"
              : "bg-card border-border text-muted-foreground"
          }`}>
            <Radio size={15} />
          </div>
          <span className="text-[10px] text-muted-foreground">{autoMode ? "Auto ON" : "Auto OFF"}</span>
        </button>

        {/* Main mic button */}
        <button
          data-testid="mic-button"
          onClick={handleMicClick}
          disabled={isProcessing}
          className={`
            relative w-20 h-20 rounded-full flex items-center justify-center
            transition-all duration-200 select-none
            ${
              isProcessing
                ? "bg-muted border-2 border-border cursor-not-allowed opacity-60"
                : isRecording
                ? "bg-destructive/90 border-2 border-destructive mic-recording cursor-pointer hover:bg-destructive"
                : "bg-primary/15 border-2 border-primary/40 cursor-pointer hover:bg-primary/25 hover:border-primary/60 active:scale-95"
            }
          `}
        >
          {isProcessing ? (
            <Loader2 size={28} className="text-muted-foreground animate-spin" />
          ) : isRecording ? (
            <MicOff size={28} className="text-white" />
          ) : (
            <Mic size={28} className="text-primary" />
          )}
        </button>

        {/* Spacer to balance the auto button */}
        <div className="w-9" />
      </div>

      <p className="text-xs text-muted-foreground text-center">
        {isProcessing
          ? "Processing…"
          : isRecording
          ? "Tap to stop • auto-stops on silence"
          : autoMode
          ? "Continuous mode active"
          : "Tap to speak"}
      </p>
    </div>
  );
}
