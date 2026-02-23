"use client";

import clsx from "clsx";
import type { ButtonHTMLAttributes } from "react";

export function Button({
  className,
  variant = "default",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "default" | "secondary" | "ghost" | "danger" }) {
  const base =
    "inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm";
  const variants: Record<string, string> = {
    default: "bg-accent text-white hover:bg-accent/90",
    secondary: "glass hover:bg-white/70",
    ghost: "hover:bg-white/70",
    danger: "bg-red-500 text-white hover:bg-red-500/90",
  };
  return <button className={clsx(base, variants[variant], className)} {...props} />;
}
