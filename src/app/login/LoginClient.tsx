"use client";

import { signIn } from "next-auth/react";

interface LoginClientProps {
  errorMessage: string | null;
}

export default function LoginClient({ errorMessage }: LoginClientProps) {
  const handleSignIn = () => {
    signIn("google", { callbackUrl: "/dashboard" });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-800 text-zinc-50">
      <main className="mx-auto flex min-h-screen max-w-5xl flex-col items-stretch gap-10 px-4 py-8 sm:px-6 sm:py-10 lg:flex-row lg:items-center">
        {/* Left side: brand + marketing copy */}
        <section className="max-w-xl space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-zinc-900/60 px-3 py-1 text-xs font-medium text-zinc-200 shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Smart email, powered by AI
          </div>

          <div className="space-y-4">
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
               Turn your inbox
              <span className="bg-gradient-to-r from-emerald-300 via-sky-300 to-violet-300 bg-clip-text text-transparent">
                {" "}
                into a superpower.
              </span>
            </h1>
            <p className="max-w-lg text-sm text-zinc-300 sm:text-base">
              AI Email Assistant helps you draft replies, summarize long threads, and focus on what truly matters &mdash; all directly from your Gmail inbox.
            </p>
          </div>

          <div className="grid gap-4 text-xs text-zinc-300 sm:grid-cols-3 sm:text-sm">
            <div className="rounded-xl border border-white/5 bg-zinc-900/50 p-3">
              <h3 className="text-sm font-semibold text-emerald-300 sm:text-base">⚡ 2x Faster</h3>
              <p className="mt-1 text-[11px] text-zinc-300">
                Respond to important emails twice as fast with pre-generated replies and quick-send options.
              </p>
            </div>
            <div className="rounded-xl border border-white/5 bg-zinc-900/50 p-3">
              <h3 className="text-sm font-semibold text-sky-300 sm:text-base">🧠 No More Email Overload</h3>
              <p className="mt-1 text-[11px] text-zinc-300">
                The assistant automatically interprets your intent and performs the right email action.
              </p>
            </div>
            <div className="rounded-xl border border-white/5 bg-zinc-900/50 p-3">
              <h3 className="text-sm font-semibold text-violet-300 sm:text-base">🕒 24/7 Availability</h3>
              <p className="mt-1 text-[11px] text-zinc-300">
                Your personal email assistant that never gets tired, always ready to read, summarize, or reply.
              </p>
            </div>
          </div>
          <p className="pt-2 text-[10px] text-zinc-400">
            made with love by Pranav Bhatia
          </p>
        </section>

        {/* Right side: login card */}
        <section className="mt-8 flex w-full max-w-md justify-end sm:mt-10 lg:mt-0 lg:ml-auto lg:max-w-sm">
          <div className="w-full rounded-2xl border border-white/10 bg-zinc-950/70 p-7 shadow-xl backdrop-blur-xl">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 via-sky-400 to-violet-500 text-zinc-950 shadow-md">
                <span className="text-lg font-bold">AI</span>
              </div>
              <div>
                <h2 className="text-sm font-semibold tracking-tight text-zinc-50">
                  Welcome back
                </h2>
                <p className="text-xs text-zinc-400">
                  Sign in to connect your Google inbox securely.
                </p>
              </div>
            </div>

            {errorMessage && (
              <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-200">
                {errorMessage}
              </div>
            )}

            <button
              type="button"
              onClick={handleSignIn}
              className="group flex w-full items-center justify-center gap-2 rounded-full bg-zinc-50 px-4 py-3 text-sm font-medium text-zinc-900 shadow-sm transition hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 48 48"
                className="h-5 w-5"
              >
                <path
                  fill="#FFC107"
                  d="M43.6 20.5H42V20H24v8h11.3C34.7 31.7 30 35 24 35c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l5.7-5.7C34.6 3.6 29.6 1.5 24 1.5 11.9 1.5 2 11.4 2 23.5S11.9 45.5 24 45.5 46 35.6 46 23.5c0-1-.1-2-.4-3z"
                />
                <path
                  fill="#FF3D00"
                  d="M6.3 14.7l6.6 4.8C14.5 16 18.9 13 24 13c3.1 0 5.9 1.1 8.1 2.9l5.7-5.7C34.6 3.6 29.6 1.5 24 1.5 16.1 1.5 9.2 6 6.3 14.7z"
                />
                <path
                  fill="#4CAF50"
                  d="M24 45.5c6 0 11-2 14.9-5.5l-6.9-5.7C29.9 36.5 27.1 37.5 24 37.5c-6 0-10.9-3.8-12.7-9.1l-6.6 5.1C8.2 40.8 15.5 45.5 24 45.5z"
                />
                <path
                  fill="#1976D2"
                  d="M43.6 20.5H42V20H24v8h11.3c-1 2.9-3 5.1-5.4 6.6l-.1.1 6.9 5.7C35.7 41.9 40.5 45.5 24 45.5c8.5 0 15.8-4.7 19.3-11.9 1.1-2.3 1.7-4.9 1.7-7.6 0-1-.1-2-.4-3z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>

            <p className="mt-4 text-[11px] leading-relaxed text-zinc-500">
              By continuing, you agree to let AI Email Assistant read and draft emails
              on your behalf. We only access data needed to provide the service and
              never share your messages with third parties.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
