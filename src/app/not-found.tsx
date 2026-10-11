import Link from "next/link";
import { BallPlayer } from "@/components/illustrations/characters";
import { BrandMark } from "@/components/brand/brand-mark";

export default function NotFound() {
  return (
    <main id="main" className="grain grid min-h-dvh place-items-center px-4 text-center">
      <div className="max-w-md">
        <div className="flex justify-center"><BrandMark /></div>
        <BallPlayer className="mx-auto mt-6 h-44 w-auto" />
        <h1 className="mt-4 font-display text-4xl font-extrabold">Ball&apos;s out of bounds</h1>
        <p className="mt-3 text-lg text-ink/75">We couldn&apos;t find that page. Let&apos;s get you back to camp.</p>
        <Link href="/" className="mt-8 inline-flex h-13 items-center rounded-full bg-ink px-7 font-bold text-sand hover:bg-ink-soft">
          Back to GGZ Camp
        </Link>
      </div>
    </main>
  );
}
