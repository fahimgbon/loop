"use client";

import clsx from "clsx";
import type { ButtonHTMLAttributes } from "react";

export function Button({
  className,
  variant = "default",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "default" | "secondary" | "ghost" | "danger" }) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--accent)_/_0.24)] focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-50";
  const variants: Record<string, string> = {
    default: "border border-slate-950 bg-slate-950 text-white shadow-[0_18px_40px_-24px_rgba(4,12,27,0.45)] hover:bg-slate-900",
    secondary: "border border-slate-300 bg-white text-slate-950 shadow-[0_10px_28px_-22px_rgba(4,12,27,0.28)] hover:border-slate-400 hover:bg-slate-50",
    ghost: "text-slate-900 hover:bg-slate-100",
    danger: "bg-red-600 text-white hover:bg-red-700",
  };
  return <button className={clsx(base, variants[variant], className)} {...props} />;
}
