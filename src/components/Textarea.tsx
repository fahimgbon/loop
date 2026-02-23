"use client";

import clsx from "clsx";
import { forwardRef } from "react";
import type { TextareaHTMLAttributes } from "react";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      className={clsx(
        "w-full resize-y rounded-md border bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted focus:border-accent",
        className,
      )}
      {...props}
    />
  );
});
