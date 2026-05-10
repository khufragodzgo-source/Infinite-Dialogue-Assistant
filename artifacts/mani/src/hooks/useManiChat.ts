import { useState, useRef, useCallback, useEffect } from "react";

export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
};

export type OpenAIVoice = "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";

export type VoiceConfig = {
  openaiVoice: OpenAIVoice;
  rate: number;
  pitch: number;
};

export const DEFAULT_VOICE_CONFIG: VoiceConfig = {
  openaiVoice: "nova",
  rate: 1.0,
  pitch: 1,
};

type UseManiChatOptions = {
  voiceConfig?: VoiceConfig;
  autoMode?: boolean;
  onAutoListenStart?: () => void;
};

type UseManiChatReturn = {
  messages: Message[];
  isRecording: boolean;
  isProcessing: boolean;
  isSpeaking: boolean;
  silenceCountdown: number | null;
  startRecording: () => void;
  stopRecording: () => void;
  sendText: (text: string) => void;
  clearHistory: () => void;
};

function pickBrowserVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  const preferred = [
    "Google US English",
    "Microsoft Aria Online (Natural) - English (United States)",
    "Samantha",
  ];
  for (const name of preferred) {
    const v = voices.find((v) => v.name === name);
    if (v) return v;
  }
  return voices.find((v) => v.lang.startsWith("en")) ?? null;
}

function cleanForSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " code block. ")
    .replace(/`[^`]+`/g, (m) => m.slice(1, -1))
    .replace(/[*_~#>•\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const SILENCE_THRESHOLD = 12; // frequency bin RMS threshold
const SILENCE_DURATION_MS = 2000; // 2 seconds

export function useManiChat({
  voiceConfig = DEFAULT_VOICE_CONFIG,
  autoMode = false,
  onAutoListenStart,
}: UseManiChatOptions = {}): UseManiChatReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [silenceCountdown, setSilenceCountdown] = useState<number | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Load chat history from server on mount
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/mani/history");
        if (!res.ok) return;
        const data = (await res.json()) as Array<{
          id: number;
          role: string;
          content: string;
          createdAt: string;
        }>;
        if (data.length > 0) {
          setMessages(
            data.map((m) => ({
              id: `db-${m.id}`,
              role: m.role as "user" | "assistant",
              content: m.content,
            }))
          );
        }
      } catch {
        // ignore — start fresh
      }
    };
    void load();
  }, []);
  const audioContextRef = useRef<AudioContext | null>(null);
  const vadIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const silenceMsRef = useRef(0);
  const isRecordingRef = useRef(false);
  const autoModeRef = useRef(autoMode);
  const voiceConfigRef = useRef(voiceConfig);

  useEffect(() => { autoModeRef.current = autoMode; }, [autoMode]);
  useEffect(() => { voiceConfigRef.current = voiceConfig; }, [voiceConfig]);

  // Pre-load browser voices (used as fallback)
  useEffect(() => {
    const load = () => window.speechSynthesis.getVoices();
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, []);

  const stopVAD = useCallback(() => {
    if (vadIntervalRef.current) {
      clearInterval(vadIntervalRef.current);
      vadIntervalRef.current = null;
    }
    if (audioContextRef.current) {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }
    silenceMsRef.current = 0;
    setSilenceCountdown(null);
  }, []);

  const addMessage = useCallback((msg: Message) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  const updateLastAssistantMessage = useCallback((content: string, isStreaming: boolean) => {
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last?.role === "assistant") {
        return [...prev.slice(0, -1), { ...last, content, isStreaming }];
      }
      return prev;
    });
  }, []);

  const speakBrowserFallback = useCallback((text: string, onDone: () => void) => {
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    const voice = pickBrowserVoice();
    if (voice) utt.voice = voice;
    utt.lang = "en-US";
    utt.rate = voiceConfigRef.current.rate;
    utt.onend = onDone;
    utt.onerror = onDone;
    window.speechSynthesis.speak(utt);
  }, []);

  const speakOpenAI = useCallback(
    async (text: string, onDone: () => void) => {
      try {
        const res = await fetch("/api/mani/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, voice: voiceConfigRef.current.openaiVoice }),
        });
        if (res.status === 204) { speakBrowserFallback(text, onDone); return; }
        if (!res.ok) throw new Error("TTS failed");
        const data = (await res.json()) as { audio?: string; format?: string };
        if (!data.audio) throw new Error("No audio");

        const byteChars = atob(data.audio);
        const bytes = new Uint8Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
        const blob = new Blob([bytes], { type: `audio/${data.format ?? "mp3"}` });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.onended = () => { URL.revokeObjectURL(url); onDone(); };
        audio.onerror = () => { URL.revokeObjectURL(url); onDone(); };
        await audio.play();
      } catch {
        speakBrowserFallback(text, onDone);
      }
    },
    [speakBrowserFallback]
  );

  const speakText = useCallback(
    (text: string) => {
      const clean = cleanForSpeech(text);
      if (!clean) return;
      setIsSpeaking(true);
      const onDone = () => {
        setIsSpeaking(false);
        if (autoModeRef.current) setTimeout(() => onAutoListenStart?.(), 400);
      };
      void speakOpenAI(clean, onDone);
    },
    [speakOpenAI, onAutoListenStart]
  );

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  const streamChat = useCallback(
    async (userMessage: string, history: Message[]) => {
      const assistantId = `assistant-${Date.now()}`;
      addMessage({ id: assistantId, role: "assistant", content: "", isStreaming: true });

      const historyPayload = history.slice(-20).map((m) => ({ role: m.role, content: m.content }));

      try {
        const res = await fetch("/api/mani/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: userMessage, history: historyPayload }),
        });

        if (!res.ok || !res.body) {
          updateLastAssistantMessage("Sorry, I couldn't process your request.", false);
          setIsProcessing(false);
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let fullContent = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const lines = decoder.decode(value, { stream: true }).split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6).trim();
              if (!data) continue;
              try {
                const parsed = JSON.parse(data) as {
                  content?: string;
                  done?: boolean;
                  error?: string;
                };
                if (parsed.content) {
                  fullContent += parsed.content;
                  updateLastAssistantMessage(fullContent, true);
                } else if (parsed.done) {
                  updateLastAssistantMessage(fullContent, false);
                  setIsProcessing(false);
                  speakText(fullContent);
                  return;
                } else if (parsed.error) {
                  updateLastAssistantMessage("Sorry, something went wrong.", false);
                  setIsProcessing(false);
                  return;
                }
              } catch {
                // skip malformed chunk
              }
            }
          }
        }

        updateLastAssistantMessage(fullContent, false);
        setIsProcessing(false);
        if (fullContent) speakText(fullContent);
      } catch {
        updateLastAssistantMessage("Sorry, I couldn't reach the server.", false);
        setIsProcessing(false);
      }
    },
    [addMessage, updateLastAssistantMessage, speakText]
  );

  const sendText = useCallback(
    (text: string) => {
      if (!text.trim() || isProcessing) return;
      stopSpeaking();
      const userMsg: Message = { id: `user-${Date.now()}`, role: "user", content: text.trim() };
      setMessages((prev) => {
        const next = [...prev, userMsg];
        setIsProcessing(true);
        void streamChat(userMsg.content, next);
        return next;
      });
    },
    [isProcessing, streamChat, stopSpeaking]
  );

  const doStopRecording = useCallback(() => {
    stopVAD();
    if (mediaRecorderRef.current && isRecordingRef.current) {
      isRecordingRef.current = false;
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [stopVAD]);

  const transcribeAndSend = useCallback(
    async (audioBlob: Blob) => {
      setIsProcessing(true);
      try {
        const buffer = await audioBlob.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = "";
        const chunkSize = 8192;
        for (let i = 0; i < bytes.length; i += chunkSize) {
          binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
        }
        const base64 = btoa(binary);
        const mimeType = audioBlob.type || "audio/webm";
        const format = mimeType.includes("ogg") ? "ogg" : mimeType.includes("mp4") ? "mp4" : "webm";

        const res = await fetch("/api/mani/transcribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ audio: base64, format }),
        });

        if (!res.ok) { setIsProcessing(false); return; }
        const { text } = (await res.json()) as { text: string };
        if (!text?.trim()) { setIsProcessing(false); return; }

        const userMsg: Message = { id: `user-${Date.now()}`, role: "user", content: text.trim() };
        setMessages((prev) => {
          const next = [...prev, userMsg];
          void streamChat(userMsg.content, next);
          return next;
        });
      } catch {
        setIsProcessing(false);
      }
    },
    [streamChat]
  );

  const startRecording = useCallback(async () => {
    if (isRecordingRef.current || isProcessing) return;
    stopSpeaking();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 44100 },
      });
      audioChunksRef.current = [];

      // Set up Web Audio VAD
      const audioCtx = new AudioContext();
      audioContextRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.7;
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      silenceMsRef.current = 0;

      vadIntervalRef.current = setInterval(() => {
        if (!isRecordingRef.current) return;
        analyser.getByteFrequencyData(dataArray);
        const rms = Math.sqrt(dataArray.reduce((s, v) => s + v * v, 0) / dataArray.length);
        if (rms < SILENCE_THRESHOLD) {
          silenceMsRef.current += 100;
          const remaining = Math.ceil((SILENCE_DURATION_MS - silenceMsRef.current) / 1000);
          if (silenceMsRef.current >= 500) {
            setSilenceCountdown(remaining > 0 ? remaining : 0);
          }
          if (silenceMsRef.current >= SILENCE_DURATION_MS) {
            doStopRecording();
          }
        } else {
          silenceMsRef.current = 0;
          setSilenceCountdown(null);
        }
      }, 100);

      const options: MediaRecorderOptions = {};
      if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) options.mimeType = "audio/webm;codecs=opus";
      else if (MediaRecorder.isTypeSupported("audio/webm")) options.mimeType = "audio/webm";

      const recorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        void transcribeAndSend(blob);
      };
      recorder.start(100);
      isRecordingRef.current = true;
      setIsRecording(true);
    } catch {
      isRecordingRef.current = false;
      setIsRecording(false);
    }
  }, [isProcessing, stopSpeaking, doStopRecording, transcribeAndSend]);

  const stopRecording = useCallback(() => {
    doStopRecording();
  }, [doStopRecording]);

  const clearHistory = useCallback(() => {
    stopSpeaking();
    setMessages([]);
    void fetch("/api/mani/history", { method: "DELETE" });
  }, [stopSpeaking]);

  return {
    messages,
    isRecording,
    isProcessing,
    isSpeaking,
    silenceCountdown,
    startRecording,
    stopRecording,
    sendText,
    clearHistory,
  };
}
