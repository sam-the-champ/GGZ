"use server";

import { clientIp } from "@/lib/request";
import { rateLimit } from "@/lib/rate-limit";
import { createTicket } from "@/lib/services/support";

export type HelpState = {
  fieldErrors?: Record<string, string>;
  error?: string;
  values?: Record<string, string>;
  done?: { reference: string; emailSent: boolean };
};

export async function submitHelpRequestAction(_prev: HelpState, formData: FormData): Promise<HelpState> {
  const values = {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    category: String(formData.get("category") ?? ""),
    registrationRef: String(formData.get("registrationRef") ?? ""),
    message: String(formData.get("message") ?? ""),
  };

  // Honeypot: real people never see or fill this field.
  if (String(formData.get("website") ?? "") !== "") {
    return { done: { reference: "HC-RECEIVED", emailSent: false } };
  }

  const [byIp, byEmail] = await Promise.all([
    rateLimit("helpRequest", await clientIp()),
    rateLimit("helpRequestEmail", values.email.trim().toLowerCase() || "anonymous"),
  ]);
  if (!byIp.ok || !byEmail.ok) {
    return {
      error: "You've sent several requests recently. We'll respond to those first — please wait before sending another.",
      values,
    };
  }

  try {
    const result = await createTicket(values);
    if (result.kind === "invalid") return { fieldErrors: result.fieldErrors, values };
    return { done: { reference: result.reference, emailSent: result.emailSent } };
  } catch (err) {
    console.error("[help] could not create ticket", (err as Error).message);
    return { error: "We couldn't send your request just now. Please try again in a moment.", values };
  }
}
