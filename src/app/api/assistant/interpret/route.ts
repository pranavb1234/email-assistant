import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Actions the assistant can route to.
const ALLOWED_ACTIONS = [
  "fetch_latest",
  "delete_email",
  "help",
  "draft_reply",
  "unknown",
] as const;

export type AssistantAction = (typeof ALLOWED_ACTIONS)[number];

export type CriterionField = "subject" | "from";

export interface DeleteParams {
  keyword: string;
  field: CriterionField;
}

export interface InterpretResponse {
  action: AssistantAction;
  deleteParams?: DeleteParams;
}

function basicHeuristic(command: string): InterpretResponse {
  const lower = command.toLowerCase();

  if (lower.includes("read") && lower.includes("email")) {
    return { action: "fetch_latest" };
  }

  if (lower.includes("delete") || lower.includes("remove")) {
    // crude guess – let client refine
    return {
      action: "delete_email",
      deleteParams: {
        keyword: command,
        field: "subject",
      },
    };
  }

  if (lower.includes("help") || lower.includes("command")) {
    return { action: "help" };
  }

  if (lower.includes("reply") || lower.includes("respond")) {
    return { action: "draft_reply" };
  }

  return { action: "unknown" };
}

function sanitizeModelJson(text: string): InterpretResponse | null {
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null;
  }

  try {
    const raw = JSON.parse(text.slice(firstBrace, lastBrace + 1));

    let action: AssistantAction = "unknown";
    if (typeof raw.action === "string") {
      const candidate = raw.action as string;
      if ((ALLOWED_ACTIONS as readonly string[]).includes(candidate)) {
        action = candidate as AssistantAction;
      }
    }

    let deleteParams: DeleteParams | undefined;
    if (raw.deleteParams && typeof raw.deleteParams === "object") {
      const k = typeof raw.deleteParams.keyword === "string" ? raw.deleteParams.keyword.trim() : "";
      const f = raw.deleteParams.field as CriterionField | undefined;
      if (k && (f === "from" || f === "subject")) {
        deleteParams = { keyword: k, field: f };
      }
    }

    return { action, ...(deleteParams ? { deleteParams } : {}) };
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  // const command =
  //   body &&
  //   typeof body === "object" &&
  //   "command" in body &&
  //   typeof (body as { command?: unknown }).command === "string"
  //     ? (body as { command?: string }).command.trim()
  //     : "";
    
    const command =
  typeof body === "object" &&
  body &&
  typeof (body as any).command === "string"
    ? (body as any).command.trim()
    : "";


  if (!command) {
    return NextResponse.json(
      { error: "Missing 'command' in request body" },
      { status: 400 }
    );
  }

  const apiKey = process.env.GEMINI_API_KEY;

  // If no key, fall back to simple rules so the feature still works.
  if (!apiKey) {
    const fallback = basicHeuristic(command);
    return NextResponse.json<InterpretResponse>(fallback);
  }

  const prompt = `You are an AI email assistant command router. A user will type a natural language command about their email.

Your job is to classify the command into one of these actions:
- "fetch_latest": user wants to read or see their most recent emails.
- "delete_email": user wants to delete or remove one or more emails.
- "help": user is asking for help or what commands are available.
- "draft_reply": user wants help drafting or sending a reply.
- "unknown": anything else that does not clearly match.

If the action is "delete_email", you MAY also infer structured delete parameters:
- deleteParams.keyword: a short keyword or phrase to match emails.
- deleteParams.field: either "subject" or "from".

Return STRICTLY a single JSON object with this TypeScript type (no extra keys, no explanation text):
{
  "action": "fetch_latest" | "delete_email" | "help" | "draft_reply" | "unknown",
  "deleteParams"?: {
    "keyword": string,
    "field": "subject" | "from"
  }
}

User command: "${command}"`;

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

    const text = await result.response.text();
    const parsed = sanitizeModelJson(text) ?? basicHeuristic(command);

    return NextResponse.json<InterpretResponse>(parsed);
  } catch {
    // On any Gemini error, fall back to heuristic so the client still gets a response.
    const fallback = basicHeuristic(command);
    return NextResponse.json<InterpretResponse>(fallback);
  }
}
