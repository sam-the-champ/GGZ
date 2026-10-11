"use client";

import { Printer } from "lucide-react";
import { primaryButton } from "@/components/register/flow-shell";

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className={`${primaryButton} sm:w-full`}>
      <Printer className="size-5" aria-hidden="true" /> Print or save as PDF
    </button>
  );
}
