"use client";

import Link from "next/link";
import { Avatar } from "./trip/GroupPanel";
import { useSession } from "./SessionProvider";

export function AccountNav() {
  const { user } = useSession();
  if (user === undefined) return <span className="h-9 w-9" aria-hidden="true" />;
  if (!user) {
    return (
      <Link href="/login" className="rounded-full px-3 py-2 text-sm font-medium text-ink-soft transition hover:bg-sand hover:text-ink">
        Sign in
      </Link>
    );
  }
  return (
    <Link href="/account" aria-label="Your account" className="rounded-full p-0.5 transition hover:ring-2 hover:ring-line">
      <Avatar name={user.name} />
    </Link>
  );
}
