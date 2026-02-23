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
        "w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted focus:border-accent",
        className,
      )}
      {...props}
    />
  );
});
