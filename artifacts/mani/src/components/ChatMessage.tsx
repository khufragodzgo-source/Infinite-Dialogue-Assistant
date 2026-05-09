import { useState } from "react";
import { Copy, Check } from "lucide-react";
import type { Message } from "@/hooks/useManiChat";

type Props = { message: Message };

function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <div className="relative my-3 rounded-xl overflow-hidden border border-white/8 bg-[hsl(222_28%_6%)]">
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/8">
        <span className="text-xs font-mono text-muted-foreground uppercase tracking-widest">{lang || "code"}</span>
        <button
          onClick={copy}
          data-testid={`copy-code-${lang}`}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-sm leading-relaxed">
        <code className="font-mono text-[hsl(200_80%_80%)] whitespace-pre">{code}</code>
      </pre>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 py-2 px-1">
      <span className="typing-dot w-2 h-2 rounded-full bg-primary/70 block" />
      <span className="typing-dot w-2 h-2 rounded-full bg-primary/70 block" />
      <span className="typing-dot w-2 h-2 rounded-full bg-primary/70 block" />
    </div>
  );
}

function parseContent(content: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /```(\w*)\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(
        <span key={key++} className="whitespace-pre-wrap leading-relaxed">
          {renderInline(content.slice(lastIndex, match.index))}
        </span>
      );
    }
    parts.push(<CodeBlock key={key++} lang={match[1] || ""} code={match[2].trim()} />);
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    parts.push(
      <span key={key++} className="whitespace-pre-wrap leading-relaxed">
        {renderInline(content.slice(lastIndex))}
      </span>
    );
  }
  return parts;
}

function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const inlineCode = /`([^`]+)`/g;
  let lastIdx = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = inlineCode.exec(text)) !== null) {
    if (m.index > lastIdx) parts.push(<span key={k++}>{text.slice(lastIdx, m.index)}</span>);
    parts.push(
      <code
        key={k++}
        className="px-1.5 py-0.5 rounded-md font-mono text-[0.85em] bg-white/8 text-[hsl(200_80%_80%)] border border-white/10"
      >
        {m[1]}
      </code>
    );
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < text.length) parts.push(<span key={k++}>{text.slice(lastIdx)}</span>);
  return parts;
}

export function ChatMessage({ message }: Props) {
  const isUser = message.role === "user";

  return (
    <div
      data-testid={`message-${message.id}`}
      className={`message-enter flex ${isUser ? "justify-end" : "justify-start"} mb-4`}
    >
      {!isUser && (
        <div className="w-8 h-8 rounded-full flex-shrink-0 mr-3 mt-0.5 flex items-center justify-center bg-primary/20 border border-primary/30">
          <span className="text-xs font-bold text-primary">M</span>
        </div>
      )}
      <div
        className={`max-w-[82%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
          isUser
            ? "bg-primary/20 border border-primary/30 text-foreground rounded-br-sm"
            : "bg-card border border-border text-foreground rounded-bl-sm"
        }`}
      >
        {message.isStreaming && message.content === "" ? (
          <TypingIndicator />
        ) : (
          parseContent(message.content)
        )}
        {message.isStreaming && message.content !== "" && (
          <span className="inline-block w-0.5 h-4 bg-primary/70 ml-0.5 animate-pulse align-middle" />
        )}
      </div>
    </div>
  );
}
