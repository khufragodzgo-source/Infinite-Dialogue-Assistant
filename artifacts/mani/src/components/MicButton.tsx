import { Mic, MicOff, Loader2 } from "lucide-react";

type Props = {
  isRecording: boolean;
  isProcessing: boolean;
  isSpeaking: boolean;
  onStart: () => void;
  onStop: () => void;
};

export function MicButton({ isRecording, isProcessing, isSpeaking, onStart, onStop }: Props) {
  const handleClick = () => {
    if (isProcessing) return;
    if (isRecording) onStop();
    else onStart();
  };

  return (
    <div className="flex flex-col items-center gap-3">
      {isRecording && (
        <div className="flex items-end gap-0.5 h-8">
          {[3, 5, 7, 9, 11, 9, 7].map((h, i) => (
            <div
              key={i}
              className="wave-bar w-1 rounded-full bg-primary/80"
              style={{ height: `${h * 2}px` }}
            />
          ))}
        </div>
      )}
      {isSpeaking && !isRecording && (
        <p className="text-xs text-primary/70 animate-pulse font-medium tracking-wide">Speaking…</p>
      )}

      <button
        data-testid="mic-button"
        onClick={handleClick}
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

      <p className="text-xs text-muted-foreground text-center">
        {isProcessing ? "Processing…" : isRecording ? "Tap to stop" : "Tap to speak"}
      </p>
    </div>
  );
}
