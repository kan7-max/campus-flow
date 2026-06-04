"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "default" | "outline" | "ghost" | "danger" | "secondary";
type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const variantStyles: Record<ButtonVariant, string> = {
  default: "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 focus-visible:ring-primary/35",
  secondary: "border border-border bg-muted text-foreground hover:bg-accent focus-visible:ring-primary/25",
  outline: "border border-border bg-card text-foreground hover:border-primary/45 hover:bg-accent hover:text-primary focus-visible:ring-primary/25",
  ghost: "bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-primary/20",
  danger: "bg-danger/90 text-white hover:bg-danger focus-visible:ring-danger/60"
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "min-h-11 px-3 py-2 text-sm sm:min-h-9 sm:py-1.5 sm:text-xs",
  md: "min-h-11 px-4 py-2 text-sm",
  lg: "min-h-12 px-5 py-2.5 text-sm"
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "default", size = "md", ...props },
  ref
) {
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex cursor-pointer items-center justify-center gap-2 rounded-md text-center font-semibold leading-none transition focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50 [&>svg]:shrink-0",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    />
  );
});
