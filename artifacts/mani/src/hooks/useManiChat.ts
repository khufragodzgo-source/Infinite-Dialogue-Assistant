import { useState, useRef, useCallback, useEffect } from "react";

export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
};

type UseManiChatReturn = {
  messages: Message[];
  isRecording: boolean;
  isProcessing: boolean;
  isSpeaking: boolean;
  startRecording: () => void;
  stopRecording: () => void;
  sendText: (text: string) => void;
  clearHistory: () => void;
};

function pickVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  const preferred = [
    "Google US English",
    "Microsoft Aria Online (Natural) - English (United States)",
    "Microsoft Jenny Online (Natural) - English (United States)",
    "Samantha",
    "Karen",
    "Moira",
  ];
  for (const name of preferred) {
    const v = voices.find((v) => v.name === name);
    if (v) return v;
  }
  const en = voices.find((v) => v.lang.startsWith("en") && !v.name.toLowerCase().includes("male"));
  return en ?? voices.find((v) => v.lang.startsWith("en")) ?? null;
}

export function useManiChat(): UseManiChatReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voicesReady, setVoicesReady] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Load voices — browsers fire voiceschanged when ready
  useEffect(() => {
    const load = () => {
      if (window.speechSynthesis.getVoices().length > 0) setVoicesReady(true);
    };
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
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

  const speakText = useCallback(
    (text: string) => {
      const cleanText = text
        .replace(/```[\s\S]*?```/g, " code block. ")
        .replace(/`[^`]+`/g, (m) => m.slice(1, -1))
        .replace(/[*_~#>•\-]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      if (!cleanText) return;

      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(cleanText);
      const voice = pickVoice();
      if (voice) utterance.voice = voice;
      utterance.lang = "en-US";
      utterance.rate = 1.05;
      utterance.pitch = 1;
      utterance.volume = 1;

      setIsSpeaking(true);

      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      window.speechSynthesis.speak(utterance);
    },
    [voicesReady] // re-create when voices load so pickVoice() has them
  );

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
        speakText(fullContent);
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
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      const userMsg: Message = { id: `user-${Date.now()}`, role: "user", content: text.trim() };
      setMessages((prev) => {
        const next = [...prev, userMsg];
        setIsProcessing(true);
        void streamChat(userMsg.content, next);
        return next;
      });
    },
    [isProcessing, streamChat]
  );

  const transcribeAndSend = useCallback(
    async (audioBlob: Blob) => {
      setIsProcessing(true);
      try {
        const buffer = await audioBlob.arrayBuffer();
        // Encode in chunks to avoid call stack overflow on large buffers
        const bytes = new Uint8Array(buffer);
        let binary = "";
        const chunkSize = 8192;
        for (let i = 0; i < bytes.length; i += chunkSize) {
          binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
        }
        const base64 = btoa(binary);

        const mimeType = audioBlob.type || "audio/webm";
        const format = mimeType.includes("ogg")
          ? "ogg"
          : mimeType.includes("mp4")
          ? "mp4"
          : "webm";

        const res = await fetch("/api/mani/transcribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ audio: base64, format }),
        });

        if (!res.ok) {
          setIsProcessing(false);
          return;
        }
        const { text } = (await res.json()) as { text: string };
        if (!text?.trim()) {
          setIsProcessing(false);
          return;
        }
        const userMsg: Message = {
          id: `user-${Date.now()}`,
          role: "user",
          content: text.trim(),
        };
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
    if (isRecording || isProcessing) return;
    // Stop any current speech
    window.speechSynthesis.cancel();
    setIsSpeaking(false);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        },
      });
      audioChunksRef.current = [];

      const options: MediaRecorderOptions = {};
      if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
        options.mimeType = "audio/webm;codecs=opus";
      } else if (MediaRecorder.isTypeSupported("audio/webm")) {
        options.mimeType = "audio/webm";
      }

      const recorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        void transcribeAndSend(blob);
      };

      recorder.start(100);
      setIsRecording(true);
    } catch {
      setIsRecording(false);
    }
  }, [isRecording, isProcessing, transcribeAndSend]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  const clearHistory = useCallback(() => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setMessages([]);
    void fetch("/api/mani/history", { method: "DELETE" });
  }, []);

  return {
    messages,
    isRecording,
    isProcessing,
    isSpeaking,
    startRecording,
    stopRecording,
    sendText,
    clearHistory,
  };
}
