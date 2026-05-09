import { useState, useRef, useCallback } from "react";
import { useTextToSpeech } from "@workspace/api-client-react";

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

export function useManiChat(): UseManiChatReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const tts = useTextToSpeech();

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
    async (text: string) => {
      const cleanText = text
        .replace(/```[\s\S]*?```/g, " [code block] ")
        .replace(/`[^`]+`/g, (m) => m.slice(1, -1))
        .replace(/[*_~#>]/g, "")
        .replace(/\s+/g, " ")
        .trim();

      if (!cleanText) return;

      try {
        setIsSpeaking(true);
        const result = await tts.mutateAsync({ data: { text: cleanText } });
        if (result.audio) {
          const audioData = result.audio;
          const format = result.format || "mp3";
          const byteChars = atob(audioData);
          const byteArr = new Uint8Array(byteChars.length);
          for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
          const blob = new Blob([byteArr], { type: `audio/${format}` });
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          currentAudioRef.current = audio;
          audio.onended = () => {
            setIsSpeaking(false);
            URL.revokeObjectURL(url);
          };
          audio.onerror = () => {
            setIsSpeaking(false);
            URL.revokeObjectURL(url);
          };
          await audio.play();
        } else {
          setIsSpeaking(false);
        }
      } catch {
        setIsSpeaking(false);
      }
    },
    [tts]
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
                const parsed = JSON.parse(data) as { content?: string; done?: boolean; error?: string };
                if (parsed.content) {
                  fullContent += parsed.content;
                  updateLastAssistantMessage(fullContent, true);
                } else if (parsed.done) {
                  updateLastAssistantMessage(fullContent, false);
                  setIsProcessing(false);
                  void speakText(fullContent);
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
        void speakText(fullContent);
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
        const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
        const mimeType = audioBlob.type || "audio/webm";
        const format = mimeType.includes("webm")
          ? "webm"
          : mimeType.includes("ogg")
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
    if (isRecording || isProcessing) return;
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      setIsSpeaking(false);
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        void transcribeAndSend(blob);
      };
      recorder.start(250);
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
