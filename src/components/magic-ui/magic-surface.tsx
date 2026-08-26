import * as React from "react";
import { cn } from "@/lib/utils";

export function MagicSurface({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border border-white/70 bg-white/78 shadow-[0_18px_60px_rgba(36,48,71,0.12)] backdrop-blur-xl before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white before:to-transparent",
        className,
      )}
      {...props}
    />
  );
}

export function AnimatedGradientText({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "bg-[linear-gradient(90deg,#0f3c81,#2563eb,#0891b2,#0f3c81)] bg-[length:240%_100%] bg-clip-text text-transparent motion-safe:animate-gradient-pan",
        className,
      )}
      {...props}
    />
  );
}
