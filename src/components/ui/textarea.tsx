import * as React from "react";
import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(
          "min-h-[120px] w-full rounded-md border border-input bg-card px-3 py-2 text-sm leading-6 text-foreground outline-none transition placeholder:text-muted-foreground/80 focus:border-primary/70 focus:ring-2 focus:ring-primary/20",
          className
        )}
        {...props}
      />
    );
  }
);
