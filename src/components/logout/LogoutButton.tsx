"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/src/components/Button";

export function LogoutButton(props: { compact?: boolean } = {}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="secondary" onClick={logout} disabled={loading} aria-label="Log out">
      {loading ? "..." : props.compact ? "Out" : "Log out"}
    </Button>
  );
}
