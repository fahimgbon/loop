"use client";

import clsx from "clsx";
import type { ButtonHTMLAttributes } from "react";

export function Button({
  className,
  variant = "default",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "default" | "secondary" | "ghost" | "danger" }) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--accent)_/_0.18)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";
  const variants: Record<string, string> = {
    default:
      "bg-[linear-gradient(135deg,rgb(var(--accent)),rgb(var(--accent-2)))] text-white shadow-[0_14px_30px_-18px_rgba(101,149,255,0.55)] hover:brightness-[0.98]",
    secondary: "border border-slate-300 bg-white text-slate-900 shadow-sm hover:bg-slate-50",
    ghost: "text-slate-700 hover:bg-slate-100",
    danger: "bg-red-500 text-white hover:bg-red-500/90",
  };
  return <button className={clsx(base, variants[variant], className)} {...props} />;
}
