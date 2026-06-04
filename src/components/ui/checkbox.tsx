"use client";

import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Checkbox({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="checkbox"
      className={cn(
        "h-4 w-4 rounded border border-input bg-card accent-primary outline-none focus-visible:ring-2 focus-visible:ring-primary/25",
        className
      )}
      {...props}
    />
  );
}
