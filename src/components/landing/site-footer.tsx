import Link from "next/link";
import { Phone } from "lucide-react";
import { BrandMark } from "@/components/brand/brand-mark";
import { site } from "@/content/site";

export function SiteFooter() {
  return (
    <footer className="no-print bg-ink text-sand">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <BrandMark tone="light" />
            <p className="mt-5 max-w-sm text-sand/70">
              A non-denominational, Christ-centred family of young people growing together in faith, fellowship and
              purpose.
            </p>
            <Link
              href="/#register"
              className="mt-6 inline-flex h-12 items-center rounded-full bg-sunset px-6 font-bold text-ink transition hover:bg-sun"
            >
              Register for GGZ Camp 1.0
            </Link>
          </div>
          <nav aria-label="Footer">
            <p className="text-sm font-bold uppercase tracking-widest text-sun">Explore</p>
            <ul className="mt-4 space-y-2.5 text-sand/80">
              <li><Link href="/#about" className="hover:text-sand">About GGZ</Link></li>
              <li><Link href="/#impact" className="hover:text-sand">The IMPACT experience</Link></li>
              <li><Link href="/#details" className="hover:text-sand">Camp details</Link></li>
              <li><Link href="/#faq" className="hover:text-sand">FAQ</Link></li>
              <li><Link href="/help" className="hover:text-sand">Help Center</Link></li>
              <li><Link href="/register/resume" className="hover:text-sand">Resume registration</Link></li>
              <li><Link href="/privacy" className="hover:text-sand">Privacy policy</Link></li>
              <li><Link href="/terms" className="hover:text-sand">Registration terms &amp; payments</Link></li>
            </ul>
          </nav>
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-sun">Need help?</p>
            <Link
              href="/help"
              className="mt-4 inline-flex h-11 items-center rounded-full bg-white/10 px-5 font-bold text-sand ring-1 ring-white/20 hover:bg-white/15"
            >
              Visit the Help Center
            </Link>
            <p className="mt-2 text-sm text-sand/60">We respond within 24–48 hours.</p>
            <p className="mt-5 text-xs font-bold uppercase tracking-widest text-sand/50">Emergencies only</p>
            <a href={`tel:${site.contact.phoneE164}`} className="mt-1 inline-flex items-center gap-2 text-sand/80 hover:text-sand">
              <Phone className="size-4" aria-hidden="true" /> {site.contact.name} · {site.contact.phoneDisplay}
            </a>
            <p className="mt-6 text-sm text-sand/60">
              {site.dates.label}
              <br />
              {site.venueLabel}
            </p>
          </div>
        </div>
        <p className="mt-12 border-t border-white/10 pt-6 text-sm text-sand/50">
          © {new Date().getFullYear()} {site.organiser}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
