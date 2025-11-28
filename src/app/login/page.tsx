"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";

const errorMessages: Record<string, string> = {
  OAuthSignin: "Error constructing the authorization URL.",
  OAuthCallback: "Error during sign-in with Google.",
  OAuthCreateAccount: "Could not create your account.",
  EmailCreateAccount: "Could not create your account with email.",
  Callback: "Error in sign-in callback.",
  OAuthAccountNotLinked:
    "This Google account is not linked. Try another account or contact support.",
  EmailSignin: "Error sending the email.",
  CredentialsSignin: "Invalid credentials.",
  SessionRequired: "You must be signed in to access this page.",
  AccessDenied: "You do not have access to sign in.",
  Configuration: "There is a problem with the server configuration.",
  Verification: "The verification token is invalid or has expired.",
  Default: "Unable to sign in. Please try again.",
};

export default function LoginPage() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const errorMessage = error
    ? errorMessages[error] || errorMessages.Default
    : null;

  const handleSignIn = () => {
    signIn("google", { callbackUrl: "/dashboard" });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg dark:bg-zinc-900">
        <h1 className="mb-2 text-center text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          AI Email Assistant
        </h1>
        <p className="mb-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
          Sign in with your Google account to securely connect your inbox.
        </p>

        {errorMessage && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
            {errorMessage}
          </div>
        )}

        <button
          type="button"
          onClick={handleSignIn}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-zinc-900 px-4 py-3 text-sm font-medium text-zinc-50 transition hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200 dark:focus-visible:ring-zinc-50 dark:focus-visible:ring-offset-zinc-900"
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
              d="M43.6 20.5H42V20H24v8h11.3c-1 2.9-3 5.1-5.4 6.6l.1-.1 6.9 5.7C35.7 41.9 40.5 45.5 24 45.5c8.5 0 15.8-4.7 19.3-11.9 1.1-2.3 1.7-4.9 1.7-7.6 0-1-.1-2-.4-3z"
            />
          </svg>
          <span>Continue with Google</span>
        </button>
      </main>
    </div>
  );
}
