import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

interface RefineRequest {
  currentReply?: string;
  instructions?: string;
  emailContext?: {
    from?: string;
    subject?: string;
    snippet?: string;
  };
}

interface RefineResponse {
  refinedReply: string;
}

export async function POST(request: Request) {
  let payload: RefineRequest = {};

  try {
    payload = (await request.json()) as RefineRequest;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const currentReply = (payload.currentReply || "").trim();
  const instructions = (payload.instructions || "").trim();

  if (!currentReply) {
    return NextResponse.json(
      { error: "Missing 'currentReply' in request body" },
      { status: 400 }
    );
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // If no key, just echo back the reply so the UI still behaves gracefully.
    return NextResponse.json<RefineResponse>({ refinedReply: currentReply });
  }

  const contextLines: string[] = [];
  if (payload.emailContext?.from) {
    contextLines.push(`Sender: ${payload.emailContext.from}`);
  }
  if (payload.emailContext?.subject) {
    contextLines.push(`Subject: ${payload.emailContext.subject}`);
  }
  if (payload.emailContext?.snippet) {
    contextLines.push(`Email snippet: ${payload.emailContext.snippet}`);
  }

  const contextBlock = contextLines.length
    ? `Original email context (for reference):\n${contextLines.join("\n")}\n\n`
    : "";

  const instructionLine = instructions
    ? `User refinement instructions: ${instructions}\n\n`
    : "Please improve clarity, tone, and professionalism while keeping the original intent.\n\n";

  const prompt = `You are an expert email copy editor. Your job is to refine the draft reply below.\n\n${contextBlock}${instructionLine}Draft reply to refine:\n${currentReply}\n\nReturn only the improved email text, nothing else.`;

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

    const refined = (await result.response.text())?.trim();

    if (!refined) {
      // Fall back to original if model returned nothing.
      return NextResponse.json<RefineResponse>({ refinedReply: currentReply });
    }

    return NextResponse.json<RefineResponse>({ refinedReply: refined });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        error: "Unexpected error while refining reply",
        details: message,
      },
      { status: 500 }
    );
  }
}
