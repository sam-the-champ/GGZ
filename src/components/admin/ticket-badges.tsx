import { cn } from "@/lib/utils";

const statusStyle: Record<string, string> = {
  OPEN: "bg-sun/50 text-ink",
  IN_PROGRESS: "bg-lagoon/15 text-ink",
  RESOLVED: "bg-palm/15 text-palm",
  CLOSED: "bg-ink/10 text-ink/70",
};

export function TicketStatusBadge({ status }: { status: string }) {
  return (
    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold", statusStyle[status] ?? "bg-ink/10")}>
      {status === "IN_PROGRESS" ? "In progress" : status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

/** Time waiting for a first response: neutral < 24 h, amber 24–48 h, red > 48 h. */
export function WaitBadge({ hours }: { hours: number }) {
  const tone = hours >= 48 ? "bg-destructive text-white" : hours >= 24 ? "bg-sunset/25 text-sunset-deep" : "bg-ink/5 text-ink/70";
  const label = hours < 1 ? "just now" : hours < 48 ? `waiting ${hours}h` : `waiting ${Math.floor(hours / 24)}d`;
  return <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold", tone)}>{label}</span>;
}
