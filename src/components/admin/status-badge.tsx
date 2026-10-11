import { cn } from "@/lib/utils";

const styles: Record<string, string> = {
  CONFIRMED: "bg-palm/15 text-palm",
  PAID: "bg-palm/15 text-palm",
  HELD: "bg-palm/15 text-palm",
  PAID_INCOMPLETE: "bg-sun/50 text-ink",
  PENDING: "bg-lagoon/15 text-ink",
  INITIATED: "bg-lagoon/15 text-ink",
  ACTIVE: "bg-lagoon/15 text-ink",
  OVERFLOW: "bg-sunset/20 text-sunset-deep",
  MISMATCH: "bg-sunset/20 text-sunset-deep",
  FAILED: "bg-destructive/10 text-destructive",
  CANCELLED: "bg-destructive/10 text-destructive",
  REVERSED: "bg-destructive/10 text-destructive",
  ABANDONED: "bg-ink/10 text-ink/70",
  RELEASED: "bg-ink/10 text-ink/70",
  EXPIRED: "bg-ink/10 text-ink/70",
};

const labels: Record<string, string> = {
  PAID_INCOMPLETE: "Paid · form incomplete",
  OVERFLOW: "Paid · needs place",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold",
        styles[status] ?? "bg-ink/10 text-ink",
        className,
      )}
    >
      {labels[status] ?? status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, " ")}
    </span>
  );
}

/** Single overall state for an attempt row. */
export function overallStatus(a: {
  paymentStatus: string;
  reservationStatus: string;
  registration: { status: string } | null;
}) {
  if (a.registration) return a.registration.status;
  if (a.paymentStatus === "PAID") return a.reservationStatus === "OVERFLOW" ? "OVERFLOW" : "PAID_INCOMPLETE";
  return a.paymentStatus;
}
