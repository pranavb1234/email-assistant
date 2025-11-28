import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

interface ReplyRequest {
  messageId?: string;
  threadId?: string;
  to?: string;
  subject?: string;
  replyText?: string;
}

function toBase64Url(input: string): string {
  const base64 = Buffer.from(input, "utf-8").toString("base64");
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accessToken = (session as { accessToken?: string }).accessToken;

  if (!accessToken) {
    return NextResponse.json({ error: "Missing access token" }, { status: 401 });
  }

  let payload: ReplyRequest = {};
  try {
    payload = (await request.json()) as ReplyRequest;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const to = payload.to?.trim();
  const subject = payload.subject?.trim();
  const replyText = payload.replyText?.trim();
  const threadId = payload.threadId?.trim();

  if (!to || !subject || !replyText) {
    return NextResponse.json(
      { error: "Missing required fields: 'to', 'subject', or 'replyText'" },
      { status: 400 }
    );
  }

  const subjectLine = subject.startsWith("Re:") ? subject : `Re: ${subject}`;

  const mimeMessage = [
    `To: ${to}`,
    `Subject: ${subjectLine}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "",
    replyText,
  ].join("\r\n");

  const raw = toBase64Url(mimeMessage);

  try {
    const res = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          raw,
          ...(threadId ? { threadId } : {}),
        }),
        cache: "no-store",
      }
    );

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return NextResponse.json(
        {
          success: false,
          error: "Failed to send reply",
          details: data,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      sentMessageId: data.id,
      threadId: data.threadId,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        success: false,
        error: "Unexpected error while sending reply",
        details: message,
      },
      { status: 500 }
    );
  }
}
