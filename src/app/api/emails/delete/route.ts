import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

type CriterionField = "from" | "subject";

interface DeleteRequest {
  keyword?: string;
  field?: CriterionField;
  messageId?: string;
  selectedSubject?: string;
  selectedFrom?: string;
}

interface GmailMessage {
  id: string;
}

interface GmailMessageDetail {
  id: string;
  snippet?: string;
  payload?: {
    headers?: Array<{ name: string; value: string }>;
  };
}

function extractHeader(
  headers: Array<{ name: string; value: string }> | undefined,
  name: string
): string | undefined {
  if (!headers) return undefined;
  const header = headers.find((h) => h.name.toLowerCase() === name.toLowerCase());
  return header?.value;
}

function matchesCriterion(
  email: { from: string; subject: string },
  keyword: string,
  field: CriterionField
) {
  const target = field === "from" ? email.from : email.subject;
  return target.toLowerCase().includes(keyword.toLowerCase());
}

async function deleteMessage(
  accessToken: string,
  messageId: string
): Promise<boolean> {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/trash`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    }
  );

  return res.ok;
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

  let payload: DeleteRequest = {};
  try {
    payload = (await request.json()) as DeleteRequest;
  } catch {
    // ignore – payload stays default
  }

  const keyword = payload.keyword?.trim();
  const field = payload.field || "subject";
  const messageId = payload.messageId?.trim();

  if (!keyword && !messageId) {
    return NextResponse.json(
      { error: "Provide a keyword or message ID to delete an email." },
      { status: 400 }
    );
  }

  try {
    if (messageId) {
      const deleted = await deleteMessage(accessToken, messageId);
      if (!deleted) {
        return NextResponse.json(
          { success: false, reason: "Unable to delete message" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        deleted: {
          id: messageId,
          from: payload.selectedFrom || "Unknown",
          subject: payload.selectedSubject || "(no subject)",
        },
      });
    }

    const query =
      field === "from" ? `from:${keyword}` : `subject:${keyword}`;
    const searchUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=10&labelIds=INBOX&q=${encodeURIComponent(
      query
    )}`;

    const listRes = await fetch(searchUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });

    if (!listRes.ok) {
      const text = await listRes.text();
      return NextResponse.json(
        { error: "Failed to list messages", details: text },
        { status: 500 }
      );
    }

    const listData = await listRes.json();
    let messages: GmailMessage[] = listData.messages || [];

    if (messages.length === 0) {
      // fallback: fetch recent inbox if search failed
      const fallbackRes = await fetch(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=15&labelIds=INBOX",
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          cache: "no-store",
        }
      );

      if (fallbackRes.ok) {
        const fallbackData = await fallbackRes.json();
        messages = fallbackData.messages || [];
      }
    }

    if (messages.length === 0) {
      return NextResponse.json({
        success: false,
        reason: "No emails found to delete with that keyword.",
      });
    }

    for (const msg of messages) {
      const detailRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          cache: "no-store",
        }
      );

      if (!detailRes.ok) continue;

      const detail = (await detailRes.json()) as GmailMessageDetail;
      const headers = detail.payload?.headers;
      const from = extractHeader(headers, "From") || "Unknown";
      const subject = extractHeader(headers, "Subject") || "(no subject)";

      if (
        !keyword ||
        matchesCriterion({ from, subject }, keyword, field)
      ) {
        const deleted = await deleteMessage(accessToken, detail.id);

        if (!deleted) {
          return NextResponse.json(
            { success: false, reason: "Unable to delete message" },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          deleted: {
            id: detail.id,
            from,
            subject,
          },
        });
      }
    }

    return NextResponse.json({
      success: false,
      reason: "No email matched the provided keyword.",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        error: "Unexpected error while deleting email",
        details: message,
      },
      { status: 500 }
    );
  }
}

