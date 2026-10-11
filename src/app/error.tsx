"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main id="main" className="grid min-h-dvh place-items-center px-4 text-center">
      <div className="max-w-md">
        <h1 className="font-display text-4xl font-extrabold">Something went wrong</h1>
        <p className="mt-3 text-lg text-ink/75">
          Please try again. If you were making a payment, <strong>don&apos;t pay again</strong> — use “Resume registration”
          or contact the organisers.
        </p>
        {error.digest && <p className="mt-2 text-xs text-ink/50">Reference: {error.digest}</p>}
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <button onClick={reset} className="h-12 rounded-full bg-ink px-6 font-bold text-sand">Try again</button>
          <Link href="/register/resume" className="inline-flex h-12 items-center justify-center rounded-full border-2 border-ink/15 px-6 font-bold">
            Resume registration
          </Link>
        </div>
      </div>
    </main>
  );
}
