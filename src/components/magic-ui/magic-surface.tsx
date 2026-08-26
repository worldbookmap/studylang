import * as React from "react";
import { cn } from "@/lib/utils";

export function MagicSurface({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.94),rgba(255,255,255,0.74))] shadow-[var(--shadow-soft)] backdrop-blur-2xl before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white before:to-transparent",
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
        "bg-[linear-gradient(90deg,#7c4a03,#d4af37,#fff1a8,#b7791f,#7c4a03)] bg-[length:240%_100%] bg-clip-text text-transparent motion-safe:animate-gradient-pan",
        className,
      )}
      {...props}
    />
  );
}
