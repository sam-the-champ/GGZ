import { z } from "zod";

const phone = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s()-]/g, ""))
  .pipe(
    z
      .string()
      .regex(/^(\+?234|0)[789][01]\d{8}$|^\+[1-9]\d{7,14}$/, "Enter a valid phone number, e.g. 0803 123 4567"),
  );

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters`)
    .optional()
    .transform((v) => (v ? v : undefined));

export const startRegistrationSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address").max(254),
});

export const registrationFormSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(3, "Enter your full name")
      .max(120)
      .regex(/^[\p{L}\p{M}' .-]+$/u, "Use letters, spaces, apostrophes and hyphens only"),
    phone,
    dateOfBirth: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter your date of birth")
      .refine((v) => !Number.isNaN(Date.parse(v)), "Enter a valid date"),
    cityOrState: z.string().trim().min(2, "Tell us where you live").max(80),
    emergencyContactName: z.string().trim().min(3, "Enter an emergency contact name").max(120),
    emergencyContactPhone: phone,
    supportNeeds: optionalText(500),
    guardianName: optionalText(120),
    guardianPhone: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? v.replace(/[\s()-]/g, "") : undefined)),
    guardianEmail: z
      .string()
      .trim()
      .toLowerCase()
      .optional()
      .transform((v) => (v ? v : undefined))
      .pipe(z.string().email("Enter a valid email address").optional()),
    guardianConsent: z.boolean().optional(),
    acceptTerms: z.literal(true, { error: "You need to accept the registration terms" }),
    acceptPrivacy: z.literal(true, { error: "You need to accept the privacy notice" }),
  });

export type RegistrationFormInput = z.input<typeof registrationFormSchema>;
export type RegistrationFormData = z.output<typeof registrationFormSchema>;

/** Age in whole years on a given date (UTC calendar dates). */
export function ageOn(dateOfBirth: string, on: Date): number {
  const dob = new Date(`${dateOfBirth}T00:00:00Z`);
  let age = on.getUTCFullYear() - dob.getUTCFullYear();
  const beforeBirthday =
    on.getUTCMonth() < dob.getUTCMonth() ||
    (on.getUTCMonth() === dob.getUTCMonth() && on.getUTCDate() < dob.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

export type AgePolicy = { minimumAge: number | null; guardianConsentAge: number; eventStart: Date };

/**
 * Age-dependent rules (minimum age, guardian details for minors). Returned as
 * field errors so the same logic runs in the browser and on the server.
 */
export function agePolicyErrors(
  data: Pick<RegistrationFormData, "dateOfBirth"> &
    Partial<Pick<RegistrationFormData, "guardianName" | "guardianPhone" | "guardianEmail" | "guardianConsent">>,
  policy: AgePolicy,
): Partial<Record<keyof RegistrationFormData, string>> {
  const errors: Partial<Record<keyof RegistrationFormData, string>> = {};
  const age = ageOn(data.dateOfBirth, policy.eventStart);
  if (age < 5 || age > 100) {
    errors.dateOfBirth = "Please check the date of birth";
    return errors;
  }
  if (policy.minimumAge != null && age < policy.minimumAge) {
    errors.dateOfBirth = `Participants must be at least ${policy.minimumAge} at the start of camp`;
    return errors;
  }
  if (age < policy.guardianConsentAge) {
    if (!data.guardianName || data.guardianName.length < 3) errors.guardianName = "Enter a parent or guardian's name";
    if (!data.guardianPhone || !/^(\+?234|0)[789][01]\d{8}$|^\+[1-9]\d{7,14}$/.test(data.guardianPhone)) {
      errors.guardianPhone = "Enter a valid parent or guardian phone number";
    }
    if (!data.guardianConsent) errors.guardianConsent = "A parent or guardian must give consent";
  }
  return errors;
}

/** Fields organisers may correct after submission (identity/consent fields excluded). */
export const participantEditSchema = registrationFormSchema.pick({
  fullName: true,
  phone: true,
  cityOrState: true,
  emergencyContactName: true,
  emergencyContactPhone: true,
  supportNeeds: true,
  guardianName: true,
  guardianPhone: true,
  guardianEmail: true,
});
export type ParticipantEdit = z.output<typeof participantEditSchema>;

// ─── Help center ────────────────────────────────────────────────────────────

export const HELP_CATEGORY_VALUES = [
  "PAID_NOT_CONFIRMED",
  "PAYMENT_FAILED",
  "CHARGED_TWICE",
  "NO_EMAIL",
  "CHANGE_DETAILS",
  "REFUND_CANCELLATION",
  "WEBSITE_PROBLEM",
  "GENERAL_QUESTION",
  "OTHER",
] as const;

export const helpRequestSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email address").max(254),
  phone: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v.replace(/[\s()-]/g, "") : undefined))
    .pipe(
      z
        .string()
        .regex(/^(\+?234|0)[789][01]\d{8}$|^\+[1-9]\d{7,14}$/, "Enter a valid phone number, e.g. 0803 123 4567")
        .optional(),
    ),
  category: z.enum(HELP_CATEGORY_VALUES, { error: "Choose what your request is about" }),
  registrationRef: optionalText(60),
  message: z
    .string()
    .trim()
    .min(15, "Please describe the problem (at least 15 characters)")
    .max(3000, "Please keep your message under 3,000 characters"),
});
export type HelpRequestInput = z.input<typeof helpRequestSchema>;
export type HelpRequest = z.output<typeof helpRequestSchema>;

export const ticketReplySchema = z.object({
  channel: z.enum(["EMAIL", "PHONE", "WHATSAPP", "NOTE"]),
  body: z.string().trim().min(2, "Write a message").max(5000),
  status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]).optional(),
});
