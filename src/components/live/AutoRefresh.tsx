"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function AutoRefresh(props: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const interval = window.setInterval(() => {
      router.refresh();
    }, props.intervalMs ?? 3000);

    return () => {
      window.clearInterval(interval);
    };
  }, [props.intervalMs, router]);

  return null;
}
