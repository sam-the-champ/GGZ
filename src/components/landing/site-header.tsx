"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { BrandMark } from "@/components/brand/brand-mark";
import { Sheet, SheetContent, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const links = [
  { href: "/#about", label: "About" },
  { href: "/#impact", label: "The IMPACT experience" },
  { href: "/#details", label: "Camp details" },
  { href: "/#faq", label: "FAQ" },
];

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "no-print fixed inset-x-0 top-0 z-50 transition-all duration-300",
        scrolled ? "bg-sand/90 shadow-[0_1px_0_rgba(14,27,38,0.08)] backdrop-blur-md" : "bg-transparent",
      )}
    >
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:rounded-lg focus:bg-ink focus:px-4 focus:py-2 focus:text-sand"
      >
        Skip to content
      </a>
      <nav aria-label="Main" className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:h-18 sm:px-6">
        <Link href="/" aria-label="God's GenZ Community — home">
          <BrandMark />
        </Link>
        <ul className="hidden items-center gap-7 text-sm font-semibold lg:flex">
          {links.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="text-ink/80 transition-colors hover:text-sunset-deep">
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-2">
          <Link
            href="/#register"
            className="hidden rounded-full bg-sunset px-5 py-2.5 text-sm font-bold text-ink shadow-sm transition hover:-translate-y-0.5 hover:bg-sun sm:inline-flex"
          >
            Register
          </Link>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              className="inline-flex size-11 items-center justify-center rounded-full border border-ink/15 bg-white/70 lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="size-5" />
            </SheetTrigger>
            <SheetContent side="right" className="w-[86vw] max-w-sm bg-sand p-6">
              <SheetTitle className="sr-only">Menu</SheetTitle>
              <SheetDescription className="sr-only">Site navigation</SheetDescription>
              <BrandMark />
              <ul className="mt-10 space-y-1">
                {links.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      onClick={() => setOpen(false)}
                      className="block rounded-xl px-3 py-3 font-display text-2xl font-bold hover:bg-sand-deep"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
              <Link
                href="/#register"
                onClick={() => setOpen(false)}
                className="mt-8 flex h-13 items-center justify-center rounded-full bg-sunset text-base font-bold text-ink"
              >
                Register for camp
              </Link>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </header>
  );
}
