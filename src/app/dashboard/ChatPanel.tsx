"use client";

import { useEffect, useState } from "react";

interface Message {
  id: number;
  role: "assistant" | "user";
  text: string;
}

interface EmailItem {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  aiReply?: string | null;
}

interface ChatPanelProps {
  userLabel: string;
}

type CriterionField = "subject" | "from";

const initialAssistantGreeting = (userLabel: string): Message[] => [
  {
    id: 1,
    role: "assistant",
    text: `Hi ${userLabel}, I\'m your AI email assistant. 👋`,
  },
  {
    id: 2,
    role: "assistant",
    text:
      "You can ask me to: \n• Read recent emails \n• Draft replies \n• Delete or archive messages \n\nFor now, I\'ll simulate these actions and show updates on the right.",
  },
];

const commandHelp: Message = {
  id: 3,
  role: "assistant",
  text:
    "Try commands like: \n- \"read my latest emails\" \n- \"draft a reply to a client\" \n- \"delete spam emails\"",
};

export function ChatPanel({ userLabel }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [activity, setActivity] = useState<string[]>([]);
  const [isLoadingEmails, setIsLoadingEmails] = useState(false);
  const [emails, setEmails] = useState<EmailItem[]>([]);
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    setMessages([...initialAssistantGreeting(userLabel), commandHelp]);
    setActivity(["Dashboard initialized. Waiting for your first command…"]);
  }, [userLabel]);

  const appendActivity = (entry: string) => {
    setActivity((prev) => [entry, ...prev]);
  };

  const extractDeletionParams = (
    input: string
  ): { keyword: string; field: CriterionField } | null => {
    const normalized = input.trim();
    if (!normalized) return null;

    const fromMatch = normalized.match(/from\s+(.+)/i);
    if (fromMatch && fromMatch[1]) {
      return { keyword: fromMatch[1].trim(), field: "from" };
    }

    const deleteMatch = normalized.match(/(?:delete|remove)\s+(?:email\s+)?(.+)/i);
    if (deleteMatch && deleteMatch[1]) {
      return { keyword: deleteMatch[1].trim(), field: "subject" };
    }

    return { keyword: normalized, field: "subject" };
  };

  const findLocalMatch = (
    keyword: string,
    field: CriterionField
  ): EmailItem | null => {
    const lowered = keyword.toLowerCase();
    const candidates = emails.filter((email) => {
      const haystack =
        field === "from" ? email.from.toLowerCase() : email.subject.toLowerCase();
      return haystack.includes(lowered);
    });

    if (candidates.length === 0) return null;
    return candidates[0];
  };

  const deleteEmail = async (rawInput: string): Promise<string> => {
    const params = extractDeletionParams(rawInput);
    if (!params || !params.keyword) {
      return "Please tell me which email to delete (mention the subject or sender).";
    }

    const localMatch = findLocalMatch(params.keyword, params.field);

    appendActivity(
      `Attempting to delete an email matching "${params.keyword}" (${params.field}).`
    );

    try {
      setIsDeleting(true);
      const res = await fetch("/api/emails/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...params,
          messageId: localMatch?.id,
          selectedSubject: localMatch?.subject,
          selectedFrom: localMatch?.from,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        const reason = data?.reason || data?.error || "No matching email found.";
        appendActivity(`Delete failed: ${reason}`);
        return `I couldn't delete any email matching "${params.keyword}". ${reason}`;
      }

      const deletedId = data.deleted?.id as string | undefined;

      if (deletedId) {
        setEmails((prev) => prev.filter((email) => email.id !== deletedId));
        setSelectedEmailId((prev) => (prev === deletedId ? null : prev));
      }

      const summary = data.deleted
        ? `Deleted email from ${data.deleted.from} with subject "${data.deleted.subject}".`
        : "Deleted the requested email.";

      appendActivity(summary);
      return summary;
    } catch (error: any) {
      const message = error?.message || "Unknown error";
      appendActivity(`Delete request failed: ${message}`);
      return "I ran into a problem while trying to delete that email. Please try again.";
    } finally {
      setIsDeleting(false);
    }
  };

  const fetchLatestEmails = async (): Promise<string> => {
    try {
      setIsLoadingEmails(true);
      appendActivity("Fetching your last 5 emails from Gmail…");

      const res = await fetch("/api/emails/latest");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        appendActivity(
          `Failed to fetch emails: ${data.error || res.statusText || "Unknown error"}`
        );
        return "I couldnt fetch your emails due to an error. Please try again later.";
      }

      const data = await res.json();

      const debug = (data.geminiDebug || []) as string[];
      if (Array.isArray(debug) && debug.length > 0) {
        debug.forEach((entry) =>
          appendActivity(`Gemini debug: ${entry}`)
        );
      }

      const fetchedEmails = (data.emails || []) as EmailItem[];

      if (!fetchedEmails.length) {
        appendActivity("No recent emails found in your inbox.");
        return "I checked your inbox but didnt find any recent emails.";
      }

      appendActivity(`Fetched ${fetchedEmails.length} emails from your inbox.`);
      setEmails(fetchedEmails);
      setSelectedEmailId(fetchedEmails[0]?.id ?? null);

      return "Ive loaded your latest emails. Use the cards on the right to review each email and its suggested reply.";
    } catch (error: any) {
      appendActivity(
        `Unexpected error while fetching emails: ${error?.message || String(
          error
        )}`
      );
      return "I ran into a problem while trying to fetch your emails.";
    } finally {
      setIsLoadingEmails(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;

    const nextBaseId = messages.length + 1;
    const userMessage: Message = { id: nextBaseId, role: "user", text: trimmed };

    const lower = trimmed.toLowerCase();
    let assistantPromise: Promise<string> | null = null;

    if (lower.includes("read") && lower.includes("email")) {
      appendActivity("Requested: Read latest emails.");
      assistantPromise = fetchLatestEmails();
    } else if (lower.includes("reply") || lower.includes("respond")) {
      appendActivity("Queued action: Draft reply.");
      assistantPromise = Promise.resolve(
        "I can help you draft smart replies. In the next step, I'll be able to send them via Gmail."
      );
    } else if (lower.includes("delete") || lower.includes("remove")) {
      appendActivity("Requested: Delete a specific email.");
      assistantPromise = deleteEmail(trimmed);
    } else if (lower.includes("help") || lower.includes("command")) {
      appendActivity("Displayed help and available commands.");
      assistantPromise = Promise.resolve(commandHelp.text);
    } else {
      appendActivity("Received a free-form request. Will map to email actions later.");
      assistantPromise = Promise.resolve(
        "I've received your request. I'll connect this to more advanced email actions soon."
      );
    }

    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    if (assistantPromise) {
      const thisAssistantId = nextBaseId + 1;
      const placeholder: Message = {
        id: thisAssistantId,
        role: "assistant",
        text: lower.includes("read") && lower.includes("email")
          ? "Let me pull your latest emails…"
          : "Let me think about that…",
      };

      setMessages((prev) => [...prev, placeholder]);

      const finalText = await assistantPromise;

      setMessages((prev) =>
        prev.map((m) =>
          m.id === thisAssistantId
            ? {
                ...m,
                text: finalText,
              }
            : m
        )
      );
    }
  };

  const selectedEmail = emails.find((e) => e.id === selectedEmailId) ?? null;

  return (
    <div className="grid h-full min-h-[calc(100vh-7rem)] grid-cols-1 gap-4 md:grid-cols-[320px_minmax(0,1fr)] md:gap-6">
      <section className="flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-900 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 md:sticky md:top-4 md:h-[calc(100vh-8rem)]">
        <div className="mb-2 flex items-center justify-between border-b border-zinc-200 pb-2 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          <span>Chat</span>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            AI Assistant
          </span>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto pr-1">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${
                m.role === "assistant" ? "justify-start" : "justify-end"
              }`}
            >
              <div
                className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-[13px] leading-relaxed ${
                  m.role === "assistant"
                    ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
                    : "bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900"
                }`}
              >
                {m.text}
              </div>
            </div>
          ))}
        </div>
        <form onSubmit={handleSubmit} className="mt-3 flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask me to read, respond to, or delete emails…"
            className="flex-1 rounded-full border border-zinc-200 bg-white px-3 py-2 text-[13px] text-zinc-900 outline-none ring-0 placeholder:text-zinc-400 focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500"
          />
          <button
            type="submit"
            disabled={isLoadingEmails || isDeleting}
            className="rounded-full bg-zinc-900 px-4 py-2 text-[13px] font-medium text-zinc-50 shadow-sm transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:focus-visible:ring-zinc-50 dark:focus-visible:ring-offset-zinc-900"
          >
            {isLoadingEmails || isDeleting ? "Working" : "Send"}
          </button>
        </form>
      </section>

      <aside className="flex h-full min-h-[calc(100vh-8rem)] flex-col overflow-hidden rounded-2xl border border-zinc-100 bg-zinc-50 p-4 text-xs text-zinc-700 shadow-inner dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
        <div className="flex-1 overflow-hidden">
          <div className="mb-2 flex items-center justify-between border-b border-zinc-200 pb-2 text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            <span>Inbox (latest)</span>
          </div>
          <div className="flex h-[calc(100%-2.5rem)] gap-3 overflow-hidden">
            <div className="flex-1 space-y-2 overflow-y-auto pr-1">
              {emails.map((email) => {
                const isSelected = email.id === selectedEmailId;
                return (
                  <button
                    key={email.id}
                    type="button"
                    onClick={() => setSelectedEmailId(email.id)}
                    className={`w-full rounded-xl border px-3 py-2 text-left text-[11px] transition ${{
                      true: "border-zinc-900 bg-white shadow-sm dark:border-zinc-100 dark:bg-zinc-900",
                      false: "border-zinc-200 bg-white/80 hover:bg-white dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:bg-zinc-900",
                    }[String(isSelected) as "true" | "false"]}`}
                  >
                    <div className="mb-0.5 line-clamp-1 font-medium text-zinc-900 dark:text-zinc-50">
                      {email.subject || "(no subject)"}
                    </div>
                    <div className="mb-0.5 line-clamp-1 text-[10px] text-zinc-500 dark:text-zinc-400">
                      {email.from}
                    </div>
                    <div className="line-clamp-2 text-[10px] text-zinc-600 dark:text-zinc-400">
                      {email.snippet?.replace(/\s+/g, " ").trim()}
                    </div>
                  </button>
                );
              })}
              {emails.length === 0 && (
                <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
                  Ask me to "read my latest emails" to load your inbox.
                </p>
              )}
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-3 text-[11px] dark:border-zinc-800 dark:bg-zinc-900">
              {selectedEmail ? (
                <>
                  <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Email details
                  </div>
                  <div className="mb-1 text-[10px] text-zinc-500 dark:text-zinc-400">
                    From: <span className="font-medium">{selectedEmail.from}</span>
                  </div>
                  <div className="mb-1 text-[10px] text-zinc-500 dark:text-zinc-400">
                    Subject: <span className="font-medium">{selectedEmail.subject || "(no subject)"}</span>
                  </div>
                  <div className="mb-2 whitespace-pre-wrap text-[11px] text-zinc-700 dark:text-zinc-200">
                    {selectedEmail.snippet?.replace(/\s+/g, " ").trim()}
                  </div>
                  <div className="mt-2 rounded-lg bg-zinc-50 p-2 text-[11px] text-zinc-800 dark:bg-zinc-950 dark:text-zinc-100">
                    <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      Suggested reply
                    </div>
                    {selectedEmail.aiReply ? (
                      <pre className="whitespace-pre-wrap text-[11px] leading-relaxed text-zinc-800 dark:text-zinc-100">
                        {selectedEmail.aiReply}
                      </pre>
                    ) : (
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        No AI reply was generated for this email.
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
                  Select an email card on the left to see details and a suggested reply.
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="h-40 space-y-1 overflow-y-auto border-t border-zinc-200 pt-2 text-[11px] dark:border-zinc-800">
          <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Activity
          </div>
          {activity.map((entry, idx) => (
            <div
              key={idx}
              className="rounded-lg bg-white px-2 py-1 text-[11px] shadow-sm dark:bg-zinc-900"
            >
              {entry}
            </div>
          ))}
          {activity.length === 0 && (
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
              No actions yet.
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}
