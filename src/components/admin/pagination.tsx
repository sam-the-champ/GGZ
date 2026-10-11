import Link from "next/link";

export function Pagination({ page, pages, href }: { page: number; pages: number; href: (p: number) => string }) {
  if (pages <= 1) return null;
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between text-sm">
      {page > 1 ? (
        <Link href={href(page - 1)} className="rounded-full bg-white px-4 py-2 font-semibold ring-1 ring-ink/10">
          ← Previous
        </Link>
      ) : (
        <span />
      )}
      <span className="text-ink/60">
        Page {page} of {pages}
      </span>
      {page < pages ? (
        <Link href={href(page + 1)} className="rounded-full bg-white px-4 py-2 font-semibold ring-1 ring-ink/10">
          Next →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
