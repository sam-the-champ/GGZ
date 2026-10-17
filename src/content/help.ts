/**
 * Help Center content. Categories match the TicketCategory enum in
 * prisma/schema.prisma. Edit the answers freely; keep the `value`s unchanged.
 */
export const RESPONSE_WINDOW = "24–48 hours";

export type HelpCategory =
  | "PAID_NOT_CONFIRMED"
  | "PAYMENT_FAILED"
  | "CHARGED_TWICE"
  | "NO_EMAIL"
  | "CHANGE_DETAILS"
  | "REFUND_CANCELLATION"
  | "WEBSITE_PROBLEM"
  | "GENERAL_QUESTION"
  | "OTHER";

export const helpCategories: {
  value: HelpCategory;
  label: string;
  /** Quick self-help shown before the form. */
  answer?: string;
  /** Link that often solves it. */
  action?: { href: string; label: string };
}[] = [
  {
    value: "PAID_NOT_CONFIRMED",
    label: "I paid but my registration isn't complete",
    answer:
      "Don't pay again. Your payment is safe. Go to Resume registration and enter the email you paid with to get a secure link and finish the form. If you paid in the last few minutes by bank transfer or USSD, it can take a little while to confirm.",
    action: { href: "/register/resume", label: "Resume registration" },
  },
  {
    value: "PAYMENT_FAILED",
    label: "My payment failed or was declined",
    answer:
      "You haven't been charged for a failed payment. You can start again and try another method (card, bank transfer or USSD). If money left your account but the payment shows as failed, submit a request below with the date and amount.",
    action: { href: "/register", label: "Try registering again" },
  },
  {
    value: "CHARGED_TWICE",
    label: "I think I was charged twice",
    answer:
      "Submit a request below with the dates and amounts (a screenshot of your bank alert helps). We'll check with Flutterwave and arrange a refund for any duplicate.",
  },
  {
    value: "NO_EMAIL",
    label: "I didn't receive my confirmation email",
    answer:
      "Check your spam/promotions folder first. Your registration number was also shown on screen after you submitted the form. If you still can't find it, submit a request and we'll resend it.",
  },
  {
    value: "CHANGE_DETAILS",
    label: "I need to correct my details",
    answer: "Tell us your registration number and what needs changing (e.g. a misspelt name or a new phone number).",
  },
  {
    value: "REFUND_CANCELLATION",
    label: "Refund or cancellation",
    answer: "Our refund and cancellation policy is on the Registration terms page. Submit a request to ask for a cancellation.",
    action: { href: "/terms", label: "Read the policy" },
  },
  {
    value: "WEBSITE_PROBLEM",
    label: "The website isn't working for me",
    answer:
      "Try refreshing, or opening the link in Chrome/Safari instead of inside WhatsApp or Instagram. If it still doesn't work, tell us what you see and which phone or browser you use.",
  },
  { value: "GENERAL_QUESTION", label: "A question about the camp" },
  { value: "OTHER", label: "Something else" },
];

export const categoryLabel = (value: string) =>
  helpCategories.find((c) => c.value === value)?.label ?? value;
