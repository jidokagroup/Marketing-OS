"use client";

import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Bot, MessageCircle, Send, X } from "lucide-react";

import { PLATFORM_DEFINITIONS } from "@/lib/social/platforms";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ChatAccount = { platform: string; status: string };
type Message = {
  role: "assistant" | "user";
  text: string;
  href?: string;
  actionLabel?: string;
};
type Answer = Omit<Message, "role">;

function agentHref(agentId: string | undefined, tab: string) {
  return agentId ? `/agents/${agentId}?tab=${tab}` : "/agents";
}

function pageHint(pathname: string, primaryAgentId?: string): Answer {
  if (pathname.startsWith("/scheduler")) {
    return {
      text: "You are in Smart Scheduler. Use Single post for one upload or Bulk upload for the CSV template.",
      href: "/scheduler",
      actionLabel: "Open Scheduler",
    };
  }
  if (pathname.startsWith("/calendar")) {
    return {
      text: "You are in Calendar. Open a post to edit its caption, delete it, or confirm whether its account is connected.",
      href: "/calendar",
      actionLabel: "Open Calendar",
    };
  }
  if (pathname.startsWith("/agents")) {
    return {
      text: "You are in Client Content Agents. Open an agent to upload files, analyze voice, connect accounts, generate content, or view the Knowledge Base.",
      href: agentHref(primaryAgentId, "assets"),
      actionLabel: "Open Agent",
    };
  }
  if (pathname.startsWith("/intelligence")) {
    return {
      text: "You are in Intelligence. Save competitor accounts and review weekly topics, hooks, trends, and opportunities once accounts are connected.",
      href: "/intelligence",
      actionLabel: "Open Intelligence",
    };
  }
  return {
    text: "Start in Core Command, choose the agent closest to the work, then use the Content and Inbox flows for execution.",
    href: "/dashboard",
    actionLabel: "Open Core Command",
  };
}

function answerQuestion(
  question: string,
  disconnected: string[],
  pathname: string,
  primaryAgentId?: string,
): Answer {
  const q = question.toLowerCase();
  if (q.includes("where") || q.includes("page") || q.includes("start")) {
    return pageHint(pathname, primaryAgentId);
  }
  if (q.includes("schedule") || q.includes("calendar")) {
    return {
      text: "Go to Smart Scheduler to create or bulk import posts. Use the same generated title so Jidoka Marketing Team OS can attach the caption, then review everything in Calendar.",
      href: "/scheduler",
      actionLabel: "Open Scheduler",
    };
  }
  if (q.includes("brand") || q.includes("voice") || q.includes("dna")) {
    return {
      text: "Open the Client Content Agent, upload client content, then run analysis. Brand Voice DNA and the Knowledge Base are generated from those files.",
      href: agentHref(primaryAgentId, "dna"),
      actionLabel: "Open Voice DNA",
    };
  }
  if (q.includes("connect") || q.includes("account")) {
    return {
      text: disconnected.length
        ? `These accounts still need attention: ${disconnected.join(", ")}. Open a Client Content Agent, then use the Connections tab.`
        : "All tracked platforms show as connected somewhere in this workspace.",
      href: agentHref(primaryAgentId, "connections"),
      actionLabel: "Open Connections",
    };
  }
  if (q.includes("integration") || q.includes("api")) {
    return {
      text: "Open Integrations to see what is live, what needs API setup, and what is planned for the broader marketing stack.",
      href: "/integrations",
      actionLabel: "Open Integrations",
    };
  }
  if (q.includes("spreadsheet") || q.includes("bulk") || q.includes("csv")) {
    return {
      text: "In Smart Scheduler, use Bulk upload, download the CSV template, keep the exact headers, and match media_file_name to the uploaded file name.",
      href: "/scheduler",
      actionLabel: "Open Bulk Upload",
    };
  }
  if (q.includes("tiktok")) {
    return {
      text: "TikTok uploading and account connection are greyed out while the API setup is in progress. Use Instagram, Facebook, YouTube, or X for now.",
      href: agentHref(primaryAgentId, "connections"),
      actionLabel: "Check Connections",
    };
  }
  if (q.includes("youtube")) {
    return {
      text: "YouTube is video-only in Jidoka Marketing Team OS. Shorts can be square or vertical videos up to 3 minutes. Long-form defaults to 15 minutes; verified accounts can upload up to 12 hours or 256 GB, whichever is less.",
      href: "/scheduler",
      actionLabel: "Open Scheduler",
    };
  }
  if (q.includes("x ") || q === "x") {
    return {
      text: "X is image-only in Jidoka Marketing Team OS. If X is selected, choose photo and upload an image file.",
      href: "/scheduler",
      actionLabel: "Open Scheduler",
    };
  }
  if (q.includes("intelligence") || q.includes("trend")) {
    return {
      text: "Open Intelligence to review weekly trends, topics, hooks, audios, and content opportunities from connected platforms.",
      href: "/intelligence",
      actionLabel: "Open Intelligence",
    };
  }
  const hint = pageHint(pathname, primaryAgentId);
  return {
    ...hint,
    text: `${hint.text} Ask me about scheduler, voice analysis, connections, spreadsheet upload, TikTok, X, or Intelligence.`,
  };
}

export function HelpChatbot({
  accounts,
  primaryAgentId,
}: {
  accounts: ChatAccount[];
  primaryAgentId?: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      text: "I am the JIDOKA Core Orchestrator. I can route work across Growth & Revenue, Client Delivery, Success & Intelligence, and Business Operations.",
    },
  ]);

  const disconnected = useMemo(() => {
    const connected = new Set(
      accounts
        .filter((account) => account.status === "active")
        .map((account) => account.platform),
    );
    return PLATFORM_DEFINITIONS.filter(
      (platform) => !platform.disabled && !connected.has(platform.key),
    ).map((platform) => platform.label);
  }, [accounts]);

  async function saveChat(userQuestion: string, answer: Answer) {
    try {
      const res = await fetch("/api/core-chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          thread_id: threadId,
          question: userQuestion,
          answer: answer.text,
          pathname,
          action_href: answer.href,
          action_label: answer.actionLabel,
          disconnected,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        thread_id?: string;
      };
      if (json.thread_id) setThreadId(json.thread_id);
    } catch {
      // Chat guidance should keep working even if the memory endpoint is down.
    }
  }

  function appendExchange(userQuestion: string) {
    const answer = answerQuestion(
      userQuestion,
      disconnected,
      pathname,
      primaryAgentId,
    );
    setMessages((current) => [
      ...current,
      { role: "user", text: userQuestion },
      {
        role: "assistant",
        ...answer,
      },
    ]);
    void saveChat(userQuestion, answer);
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const clean = question.trim();
    if (!clean) return;
    appendExchange(clean);
    setQuestion("");
  }

  function ask(prompt: string) {
    appendExchange(prompt);
  }

  return (
    <div className="fixed bottom-4 right-4 z-40">
      {open && (
        <div className="mb-3 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-lg">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4" />
              <p className="font-medium">JIDOKA Core Orchestrator</p>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              type="button"
              onClick={() => setOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          {disconnected.length > 0 && (
            <div className="border-b bg-destructive/10 px-4 py-2 text-xs text-destructive">
              Disconnected: {disconnected.join(", ")}
            </div>
          )}
          <div className="max-h-80 space-y-3 overflow-y-auto p-4">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`rounded-lg px-3 py-2 text-sm ${
                  message.role === "assistant"
                    ? "bg-muted text-muted-foreground"
                    : "ml-8 bg-primary text-primary-foreground"
                }`}
              >
                <p>{message.text}</p>
                {message.href && message.actionLabel && (
                  <ButtonLink
                    href={message.href}
                    variant="outline"
                    size="xs"
                    className="mt-2 bg-background"
                  >
                    {message.actionLabel}
                  </ButtonLink>
                )}
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              {[
                "What do I do on this page?",
                "How do I schedule a post?",
                "Are accounts disconnected?",
              ].map((prompt) => (
                <Button
                  key={prompt}
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() => ask(prompt)}
                >
                  {prompt}
                </Button>
              ))}
            </div>
          </div>
          <form onSubmit={submit} className="flex gap-2 border-t p-3">
            <Input
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Ask how to..."
            />
            <Button type="submit" size="icon" aria-label="Send help question">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      )}
      <Button
        type="button"
        size="lg"
        onClick={() => setOpen((value) => !value)}
        className="relative shadow-lg"
      >
        <MessageCircle className="mr-1 h-4 w-4" />
        Help
        {disconnected.length > 0 && (
          <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-red-500" />
        )}
      </Button>
    </div>
  );
}
