"use client";

import { signOut } from "next-auth/react";

export function LogoutButton() {
  const handleLogout = () => {
    void signOut({ callbackUrl: "/login" });
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="rounded-full border border-zinc-300 bg-white px-3 py-1 text-[10px] font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
    >
      Log out
    </button>
  );
}
