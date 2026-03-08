import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Bot, Send, X, Sparkles, Loader2, Wand2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useToast } from "@/hooks/use-toast";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface QueueItem {
  id: string;
  name: string;
  color: string | null;
  quantity: number;
  tempo_min: number | null;
  variation: string | null;
  platformOrderId: string;
}

interface QueueOptimizerChatProps {
  queueData: QueueItem[];
  isOpen: boolean;
  onToggle: () => void;
  onReorder: (orderedIds: string[], explanation: string) => Promise<void>;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/optimize-queue`;

const SUGGESTIONS = [
  "Estou disponível às 12h e às 18h para trocar peças. Monte a melhor fila.",
  "Agrupe as peças por cor para minimizar trocas de filamento.",
  "Vou sair agora e volto em 5 horas. O que consigo imprimir nesse tempo?",
  "Qual a ordem mais eficiente para imprimir tudo?",
];

export default function QueueOptimizerChat({ queueData, isOpen, onToggle, onReorder }: QueueOptimizerChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isReordering, setIsReordering] = useState(false);
  const [hasAssistantResponse, setHasAssistantResponse] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: ChatMessage = { role: "user", content: text.trim() };
    const allMessages = [...messages, userMsg];
    setMessages(allMessages);
    setInput("");
    setIsLoading(true);
    setHasAssistantResponse(false);

    let assistantSoFar = "";

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: allMessages.map(m => ({ role: m.role, content: m.content })),
          queueData,
          mode: "chat",
        }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        toast({ title: errData.error || "Erro ao consultar IA", variant: "destructive" });
        setIsLoading(false);
        return;
      }

      if (!resp.body) throw new Error("No stream body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let streamDone = false;

      const upsertAssistant = (nextChunk: string) => {
        assistantSoFar += nextChunk;
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") {
            return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
          }
          return [...prev, { role: "assistant", content: assistantSoFar }];
        });
      };

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") {
            streamDone = true;
            break;
          }

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) upsertAssistant(content);
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Final flush
      if (textBuffer.trim()) {
        for (let raw of textBuffer.split("\n")) {
          if (!raw) continue;
          if (raw.endsWith("\r")) raw = raw.slice(0, -1);
          if (raw.startsWith(":") || raw.trim() === "") continue;
          if (!raw.startsWith("data: ")) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) upsertAssistant(content);
          } catch { /* ignore */ }
        }
      }

      setHasAssistantResponse(true);
    } catch (e) {
      console.error("Chat error:", e);
      toast({ title: "Erro na conexão com IA", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyReorder = async () => {
    if (isReordering || queueData.length === 0) return;
    setIsReordering(true);

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: messages.map(m => ({ role: m.role, content: m.content })),
          queueData,
          mode: "reorder",
        }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        toast({ title: errData.error || "Erro ao reorganizar", variant: "destructive" });
        return;
      }

      const data = await resp.json();
      const { ordered_indices, explanation } = data;

      if (!ordered_indices || !Array.isArray(ordered_indices)) {
        toast({ title: "IA não retornou uma ordem válida", variant: "destructive" });
        return;
      }

      // Map indices to order IDs
      const orderedIds = ordered_indices
        .filter((i: number) => i >= 0 && i < queueData.length)
        .map((i: number) => queueData[i].id);

      // Add any missing IDs at the end
      const missingIds = queueData
        .map(q => q.id)
        .filter(id => !orderedIds.includes(id));
      const finalOrderedIds = [...orderedIds, ...missingIds];

      await onReorder(finalOrderedIds, explanation);

      // Add confirmation message
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: `✅ **Fila reorganizada!**\n\n${explanation}` },
      ]);
      setHasAssistantResponse(false);
    } catch (e) {
      console.error("Reorder error:", e);
      toast({ title: "Erro ao aplicar reorganização", variant: "destructive" });
    } finally {
      setIsReordering(false);
    }
  };

  if (!isOpen) {
    return (
      <Button
        onClick={onToggle}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50"
        size="icon"
      >
        <Bot className="h-6 w-6" />
      </Button>
    );
  }

  return (
    <Card className="fixed bottom-6 right-6 w-[380px] sm:w-[420px] h-[520px] z-50 shadow-2xl flex flex-col overflow-hidden border-primary/20">
      <CardHeader className="py-3 px-4 border-b bg-primary/5 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm">Otimizador de Fila</CardTitle>
            <Badge variant="secondary" className="text-[10px]">{queueData.length} peças</Badge>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onToggle}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <div className="space-y-3 pt-2">
            <p className="text-xs text-muted-foreground text-center">
              Diga seus horários de disponibilidade e eu monto a fila ideal para você.
            </p>
            <div className="space-y-1.5">
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(s)}
                  className="w-full text-left text-xs p-2.5 rounded-lg border border-border hover:bg-accent hover:border-primary/30 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted"
              }`}
            >
              {msg.role === "assistant" ? (
                <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_table]:text-xs [&_th]:px-2 [&_td]:px-2 [&_th]:py-1 [&_td]:py-1">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                <p>{msg.content}</p>
              )}
            </div>
          </div>
        ))}

        {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-xl px-3 py-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
      </div>

      <div className="p-3 border-t shrink-0 space-y-2">
        {hasAssistantResponse && !isLoading && queueData.length > 0 && (
          <Button
            onClick={handleApplyReorder}
            disabled={isReordering}
            className="w-full gap-2"
            variant="default"
          >
            {isReordering ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Reorganizando...
              </>
            ) : (
              <>
                <Wand2 className="h-4 w-4" />
                Aplicar ordem sugerida na fila
              </>
            )}
          </Button>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage(input);
          }}
          className="flex gap-2"
        >
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ex: Volto às 14h e 20h..."
            className="text-sm h-9"
            disabled={isLoading}
          />
          <Button type="submit" size="icon" className="h-9 w-9 shrink-0" disabled={isLoading || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </Card>
  );
}
