import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { ChatPanel } from "./ChatPanel";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login?error=SessionRequired");
  }

  const user = session.user;
  const userLabel = user?.name || user?.email || "there";

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-zinc-50 via-white to-slate-100 font-sans dark:from-zinc-900 dark:via-zinc-950 dark:to-black">
      <header className="border-b border-white/70 bg-white/80 px-4 py-3 backdrop-blur-md dark:border-zinc-800/70 dark:bg-zinc-900/60">
        <div className="mx-auto flex w-full max-w-[90vw] flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-zinc-400">
              Dashboard
            </p>
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
              AI Email Assistant
            </h1>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Connected as {user?.email || user?.name || "Google user"}
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1 text-[10px] font-medium text-zinc-600 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
            <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            <span>Securely connected</span>
          </div>
        </div>
      </header>

      <main className="flex flex-1 overflow-y-auto px-2 py-3 sm:px-4 sm:py-5">
        <div className="mx-auto flex h-full w-full max-w-[90vw] flex-1 flex-col overflow-hidden rounded-3xl border border-white/70 bg-white shadow-lg shadow-zinc-200/50 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950 dark:shadow-black/30">
          <ChatPanel userLabel={userLabel} />
        </div>
      </main>
    </div>
  );
}
