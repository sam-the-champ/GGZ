"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const items = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/registrations", label: "Registrations" },
  { href: "/admin/payments", label: "Payments" },
  { href: "/admin/settings", label: "Event settings" },
  { href: "/admin/audit", label: "Audit log" },
  { href: "/admin/account", label: "My account" },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin" className="mx-auto max-w-7xl overflow-x-auto px-4 sm:px-6">
      <ul className="flex gap-1">
        {items.map((i) => {
          const active = i.href === "/admin" ? pathname === "/admin" : pathname.startsWith(i.href);
          return (
            <li key={i.href}>
              <Link
                href={i.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "block whitespace-nowrap border-b-2 px-3 py-3 text-sm font-semibold transition",
                  active ? "border-sunset text-ink" : "border-transparent text-ink/60 hover:text-ink",
                )}
              >
                {i.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
