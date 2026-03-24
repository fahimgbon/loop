"use client";

import clsx from "clsx";
import { forwardRef } from "react";
import type { InputHTMLAttributes } from "react";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={clsx(
        "w-full rounded-xl border border-slate-300 bg-white/95 px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-[rgb(var(--accent))] focus:ring-4 focus:ring-[rgb(var(--accent)_/_0.1)]",
        className,
      )}
      {...props}
    />
  );
});
