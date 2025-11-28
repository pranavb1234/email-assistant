import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { GoogleGenerativeAI } from "@google/generative-ai";

interface GmailMessage {
  id: string;
}

interface GmailPayload {
  mimeType?: string;
  body?: {
    data?: string;
  };
  parts?: GmailPayload[];
  headers?: Array<{ name: string; value: string }>;
}

interface GmailMessageDetail {
  id: string;
  threadId?: string;
  snippet?: string;
  payload?: GmailPayload;
}

function extractHeader(
  headers: Array<{ name: string; value: string }> | undefined,
  name: string
): string | undefined {
  if (!headers) return undefined;
  const header = headers.find((h) => h.name.toLowerCase() === name.toLowerCase());
  return header?.value;
}

function decodeBase64Url(data?: string): string {
  if (!data) return "";
  try {
    const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
    return Buffer.from(normalized, "base64").toString("utf-8");
  } catch {
    return "";
  }
}

function extractPlainTextFromPayload(payload?: GmailPayload): string {
  if (!payload) return "";

  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }

  if (payload.parts && payload.parts.length > 0) {
    for (const part of payload.parts) {
      const text = extractPlainTextFromPayload(part);
      if (text.trim()) return text;
    }
  }

  return "";
}

async function summarizeEmailWithGemini(
  input: {
    from: string;
    subject: string;
    body: string;
  },
  debug: string[]
): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    debug.push("GEMINI_API_KEY is not set; skipping AI summaries.");
    return null;
  }

  const prompt = `You are an email summarization assistant. Given an email, write a concise, user-friendly summary that tells the recipient what the email is about and what (if anything) they need to do.\n\nSummary requirements:\n- 1 to 3 short sentences, max ~60 words total.\n- Start with the key purpose of the email.\n- Mention any requests, deadlines, or important decisions.\n- Do NOT include greetings or sign-offs.\n- Do NOT speak in the first person as the sender.\n- Output only the summary text, nothing else.\n\nOriginal message:\nSender: ${
    input.from
  }\nSubject: ${input.subject}\nEmail body: ${
    input.body || "(no body available)"
  }\n\nWrite the summary now:`;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
    });

    const text = (await result.response.text())?.trim();

    if (!text) {
      debug.push("Gemini SDK returned an empty summary.");
    }

    return text || null;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    debug.push(`Gemini summary API threw: ${message}`);
    return null;
  }
}

async function generateReplyWithGemini(
  input: {
    from: string;
    subject: string;
    body: string;
  },
  debug: string[]
): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    debug.push("GEMINI_API_KEY is not set; skipping AI replies.");
    return null;
  }

  const prompt = `You are an AI email assistant. Draft a clear, concise, professional email reply to the message below.\n\nReply requirements:\n- Write the reply as if it will be sent directly to the sender.\n- Include a short greeting that addresses the sender appropriately.\n- Keep the body focused and actionable (2-5 short paragraphs).\n- End with a natural, courteous sign-off.\n- Do NOT explain what you are doing.\n- Do NOT include headings like \"Here is your reply\" or \"Explanation\".\n- Output only the email text, nothing else.\n- Use the full email body below as context.\n\nOriginal message:\nSender: ${
    input.from
  }\nSubject: ${input.subject}\nEmail body: ${
    input.body || "(no body available)"
  }\n\nWrite the reply now:`;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
    });

    const text = (await result.response.text())?.trim();

    if (!text) {
      debug.push("Gemini SDK returned an empty reply.");
    }

    return text || null;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    debug.push(`Gemini reply API threw: ${message}`);
    return null;
  }
}

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accessToken = (session as { accessToken?: string }).accessToken;

  if (!accessToken) {
    return NextResponse.json({ error: "Missing access token" }, { status: 401 });
  }

  const geminiDebug: string[] = [];

  try {
    const listRes = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=5&labelIds=INBOX",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
      }
    );

    if (!listRes.ok) {
      const text = await listRes.text();
      return NextResponse.json(
        { error: "Failed to list messages", details: text },
        { status: 500 }
      );
    }

    const listData = await listRes.json();
    const messages: GmailMessage[] = listData.messages || [];

    if (messages.length === 0) {
      return NextResponse.json({ emails: [] });
    }

    const detailsResults = await Promise.all(
      messages.map(async (msg) => {
        const detailRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
            cache: "no-store",
          }
        );

        if (!detailRes.ok) return null;

        const detail = (await detailRes.json()) as GmailMessageDetail;
        return detail;
      })
    );

    const details: GmailMessageDetail[] = detailsResults.filter(
      (d): d is GmailMessageDetail => d !== null
    );

    const summaries = await Promise.all(
      details.map(async (d) => {
        const headers = d.payload?.headers;
        const from = extractHeader(headers, "From") || "Unknown";
        const subject = extractHeader(headers, "Subject") || "(no subject)";
        const rawSnippet = d.snippet || "";
        const bodyText = extractPlainTextFromPayload(d.payload) || rawSnippet;

        const summary = await summarizeEmailWithGemini(
          {
            from,
            subject,
            body: bodyText,
          },
          geminiDebug
        );

        const base = {
          id: d.id,
          threadId: d.threadId,
          from,
          subject,
          snippet: summary || rawSnippet,
        };

        const aiReply = await generateReplyWithGemini(
          {
            from,
            subject,
            body: bodyText,
          },
          geminiDebug
        );

        return {
          ...base,
          aiReply,
        };
      })
    );

    return NextResponse.json({ emails: summaries, geminiDebug });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Unexpected error while fetching emails", details: message },
      { status: 500 }
    );
  }
}
