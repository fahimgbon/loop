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
        "w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-950 shadow-[0_8px_22px_-18px_rgba(4,12,27,0.2)] outline-none placeholder:text-slate-500 focus:border-[rgb(var(--accent))] focus:ring-4 focus:ring-[rgb(var(--accent)_/_0.16)]",
        className,
      )}
      {...props}
    />
  );
});
