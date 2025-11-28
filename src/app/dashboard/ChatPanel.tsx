"use client";

import { useEffect, useState } from "react";

interface Message {
  id: number;
  role: "assistant" | "user";
  text: string;
}

interface EmailItem {
  id: string;
  threadId?: string | null;
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
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [isEditingReply, setIsEditingReply] = useState(false);
  const [replyDraft, setReplyDraft] = useState("");
  const [refinePrompt, setRefinePrompt] = useState("");
  const [isRefiningReply, setIsRefiningReply] = useState(false);

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

  const basicHeuristicRoute = async (trimmed: string): Promise<string> => {
    const lower = trimmed.toLowerCase();

    if (lower.includes("read") && lower.includes("email")) {
      appendActivity("Requested: Read latest emails (heuristic).");
      return fetchLatestEmails();
    }

    if (lower.includes("reply") || lower.includes("respond")) {
      appendActivity("Queued action: Draft reply (heuristic).");
      return Promise.resolve(
        "I can help you draft smart replies. In the next step, I'll be able to send them via Gmail."
      );
    }

    if (lower.includes("delete") || lower.includes("remove")) {
      appendActivity("Requested: Delete a specific email (heuristic).");
      return deleteEmail(trimmed);
    }

    if (lower.includes("help") || lower.includes("command")) {
      appendActivity("Displayed help and available commands (heuristic).");
      return Promise.resolve(commandHelp.text);
    }

    appendActivity("Received a free-form request. Will map to email actions later (heuristic).");
    return Promise.resolve(
      "I've received your request. I'll connect this to more advanced email actions soon."
    );
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

  const deleteEmail = async (
    rawInput: string,
    overrideParams?: { keyword?: string; field?: CriterionField }
  ): Promise<string> => {
    const params = overrideParams?.keyword && overrideParams.field
      ? { keyword: overrideParams.keyword, field: overrideParams.field }
      : extractDeletionParams(rawInput);

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
    } catch (error) {
      const message = (error as Error)?.message || "Unknown error";
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
    } catch (error) {
      appendActivity(
        `Unexpected error while fetching emails: ${
          (error as Error)?.message || String(error)
        }`
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

    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    const thisAssistantId = nextBaseId + 1;
    const placeholder: Message = {
      id: thisAssistantId,
      role: "assistant",
      text: "Let me think about that…",
    };

    setMessages((prev) => [...prev, placeholder]);

    const run = async (): Promise<string> => {
      appendActivity("Sending your command to the AI router…");

      try {
        const res = await fetch("/api/assistant/interpret", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ command: trimmed }),
        });

        const data = await res
          .json()
          .catch(() => ({ action: "unknown" as const }));

        const action = data.action as
          | "fetch_latest"
          | "delete_email"
          | "help"
          | "draft_reply"
          | "unknown"
          | undefined;

        if (!res.ok || !action) {
          appendActivity("AI router returned an invalid response. Falling back to simple rules.");
          return basicHeuristicRoute(trimmed);
        }

        switch (action) {
          case "fetch_latest": {
            appendActivity("AI router mapped this to: read latest emails.");
            return fetchLatestEmails();
          }
          case "delete_email": {
            const deleteParams = data.deleteParams as
              | { keyword?: string; field?: CriterionField }
              | undefined;

            if (deleteParams?.keyword && deleteParams.field) {
              appendActivity(
                `AI router mapped this to: delete email (field=${deleteParams.field}, keyword="${deleteParams.keyword}").`
              );
              return deleteEmail(trimmed, deleteParams);
            }

            appendActivity(
              "AI router suggested delete, but without clear parameters. Falling back to simple delete parsing."
            );
            return deleteEmail(trimmed);
          }
          case "help": {
            appendActivity("AI router mapped this to: help / show commands.");
            return Promise.resolve(commandHelp.text);
          }
          case "draft_reply": {
            appendActivity("AI router mapped this to: draft a reply.");
            return Promise.resolve(
              "I can help you draft smart replies. In the next step, I'll be able to send them via Gmail."
            );
          }
          default: {
            appendActivity(
              "AI router could not confidently map this command. Falling back to simple rules."
            );
            return basicHeuristicRoute(trimmed);
          }
        }
      } catch (error) {
        appendActivity(
          `AI router request failed: ${
            (error as Error)?.message || String(error)
          }. Falling back to simple rules.`
        );
        return basicHeuristicRoute(trimmed);
      }
    };

    const finalText = await run();

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
  };

  const selectedEmail = emails.find((e) => e.id === selectedEmailId) ?? null;

  const refineReplyWithAI = async (email: EmailItem) => {
    if (!replyDraft.trim()) {
      appendActivity("Nothing to refine yet. Please type or paste a reply first.");
      return;
    }

    appendActivity("Refining your reply with AI…");

    try {
      setIsRefiningReply(true);
      const res = await fetch("/api/emails/refine", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentReply: replyDraft,
          instructions: refinePrompt,
          emailContext: {
            from: email.from,
            subject: email.subject,
            snippet: email.snippet,
          },
        }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        refinedReply?: string;
        error?: string;
      };

      if (!res.ok || !data.refinedReply) {
        const reason = data.error || res.statusText || "Unknown error";
        appendActivity(`Refine with AI failed: ${reason}`);
        return;
      }

      setReplyDraft(data.refinedReply);
      appendActivity("Updated reply draft using AI refinement.");
    } catch (error) {
      appendActivity(
        `Unexpected error while refining reply: ${
          (error as Error)?.message || String(error)
        }`
      );
    } finally {
      setIsRefiningReply(false);
    }
  };

  const applyReplyDraft = (email: EmailItem) => {
    const trimmed = replyDraft.trim();
    if (!trimmed) {
      appendActivity("Cannot apply an empty reply draft.");
      return;
    }

    setEmails((prev) =>
      prev.map((e) => (e.id === email.id ? { ...e, aiReply: trimmed } : e))
    );
    appendActivity("Applied edited reply as the new suggested reply.");
    setIsEditingReply(false);
  };

  const sendSelectedReply = async (email: EmailItem) => {
    const effectiveText = email.aiReply?.trim();

    if (!effectiveText) {
      appendActivity("No reply text available to send for this email.");
      return;
    }

    appendActivity(`Sending reply to ${email.from}…`);

    try {
      setIsSendingReply(true);
      const res = await fetch("/api/emails/reply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messageId: email.id,
          threadId: email.threadId,
          to: email.from,
          subject: email.subject,
          replyText: effectiveText,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success) {
        const reason = data?.error || res.statusText || "Unknown error";
        appendActivity(`Failed to send reply: ${reason}`);
        return;
      }

      appendActivity(
        `Reply sent to ${email.from} with subject "${email.subject || "(no subject)"}".`
      );
    } catch (error) {
      appendActivity(
        `Unexpected error while sending reply: ${
          (error as Error)?.message || String(error)
        }`
      );
    } finally {
      setIsSendingReply(false);
    }
  };

  return (
    <>
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
                    onClick={() => {
                      setSelectedEmailId(email.id);
                      setIsEditingReply(false);
                      setReplyDraft("");
                      setRefinePrompt("");
                    }}
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
                  Ask me to &quot;read my latest emails&quot; to load your inbox.
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
                    <div className="mb-1 flex items-center justify-between text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      <span>Suggested reply</span>
                      <div className="flex items-center gap-2">
                        {selectedEmail.aiReply && (
                          <button
                            type="button"
                            disabled={isSendingReply}
                            onClick={() => sendSelectedReply(selectedEmail)}
                            className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-semibold text-zinc-50 shadow-sm transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                          >
                            {isSendingReply ? "Sending…" : "Ready to send"}
                          </button>
                        )}
                        {selectedEmail.aiReply && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsEditingReply(true);
                              setReplyDraft(selectedEmail.aiReply ?? "");
                              setRefinePrompt("");
                              appendActivity("Opened reply editor for manual refinement.");
                            }}
                            className="rounded-full border border-zinc-400 px-2 py-0.5 text-[10px] font-semibold text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-500 dark:text-zinc-200 dark:hover:bg-zinc-900"
                          >
                            Refine my reply
                          </button>
                        )}
                      </div>
                    </div>
                    {selectedEmail.aiReply ? (
                      <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap text-[11px] leading-relaxed text-zinc-800 dark:text-zinc-100">
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
      {isEditingReply && selectedEmail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-lg rounded-2xl bg-white p-4 text-[11px] text-zinc-900 shadow-lg dark:bg-zinc-900 dark:text-zinc-50">
            <div className="mb-2 flex items-center justify-between text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              <span>Edit reply</span>
              <button
                type="button"
                onClick={() => {
                  setIsEditingReply(false);
                  appendActivity("Closed reply editor.");
                }}
                className="rounded-full border border-zinc-300 px-2 py-0.5 text-[10px] font-medium text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Close
              </button>
            </div>
            <div className="mb-2 text-[10px] text-zinc-500 dark:text-zinc-400">
              <div>
                <span className="font-medium">To:</span> {selectedEmail.from}
              </div>
              <div>
                <span className="font-medium">Subject:</span> {selectedEmail.subject || "(no subject)"}
              </div>
            </div>
            <textarea
              value={replyDraft}
              onChange={(e) => setReplyDraft(e.target.value)}
              rows={6}
              className="mb-2 w-full rounded-md border border-zinc-300 bg-white p-2 text-[11px] text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
              placeholder="Edit your reply here before sending…"
            />
            <input
              value={refinePrompt}
              onChange={(e) => setRefinePrompt(e.target.value)}
              className="mb-2 w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-[11px] text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder:text-zinc-500"
              placeholder="Optional: tell the AI how to refine this (e.g. make it shorter, more formal)…"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={isRefiningReply}
                onClick={() => refineReplyWithAI(selectedEmail)}
                className="rounded-full bg-zinc-900 px-3 py-1 text-[10px] font-semibold text-zinc-50 shadow-sm transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                {isRefiningReply ? "Refining…" : "Refine with AI"}
              </button>
              <button
                type="button"
                onClick={() => applyReplyDraft(selectedEmail)}
                className="rounded-full bg-emerald-600 px-3 py-1 text-[10px] font-semibold text-emerald-50 shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-70"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
