import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Reusable GGZ brand treatment.
 *
 * The official GGZ logo has not been supplied yet, so this renders a clean
 * text wordmark. To switch to the official logo:
 *   1. Add the file to /public/brand/ (e.g. ggz-logo.svg or .png).
 *   2. Set OFFICIAL_LOGO below to { src, width, height }.
 * Every header, footer, email-free page and print view uses this component.
 */
const OFFICIAL_LOGO: { src: string; width: number; height: number } | null = null;

export function BrandMark({
  className,
  tone = "dark",
  compact = false,
}: {
  className?: string;
  tone?: "dark" | "light";
  compact?: boolean;
}) {
  if (OFFICIAL_LOGO) {
    return (
      <Image
        src={OFFICIAL_LOGO.src}
        width={OFFICIAL_LOGO.width}
        height={OFFICIAL_LOGO.height}
        alt="God's GenZ Community"
        className={cn("h-9 w-auto", className)}
        priority
      />
    );
  }
  const fg = tone === "dark" ? "text-ink" : "text-sand";
  return (
    <span className={cn("inline-flex items-center gap-2.5", fg, className)}>
      <span
        aria-hidden="true"
        className={cn(
          "grid size-9 place-items-center rounded-xl font-display text-sm font-extrabold tracking-tight",
          tone === "dark" ? "bg-ink text-sun" : "bg-sun text-ink",
        )}
      >
        GGZ
      </span>
      <span className={cn("flex flex-col leading-none", compact && "sr-only")}>
        <span className="font-display text-[0.95rem] font-bold tracking-tight">God&apos;s GenZ</span>
        <span className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] opacity-70">Community</span>
      </span>
    </span>
  );
}
