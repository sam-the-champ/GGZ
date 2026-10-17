import { db } from "@/lib/db";
import { EVENT_SLUG } from "@/content/site";

export async function resetDb() {
  await db.$executeRawUnsafe(`
    TRUNCATE "SupportMessage", "SupportTicket", "AuditLog", "AdminSession", "AdminUser", "Registration", "Participant", "Payment",
             "ContinuationToken", "RegistrationAttempt", "RateLimitBucket", "Event" CASCADE
  `);
}

export async function seedEvent(overrides: Partial<{
  feeKobo: number | null;
  capacity: number | null;
  registrationOpen: boolean;
  refundPolicy: string | null;
  reservationMinutes: number;
  minimumAge: number | null;
  guardianConsentAge: number;
}> = {}) {
  return db.event.create({
    data: {
      slug: EVENT_SLUG,
      name: "GGZ Camp 1.0",
      theme: "IMPACT",
      startDate: new Date("2026-12-08T00:00:00Z"),
      endDate: new Date("2026-12-10T00:00:00Z"),
      venue: "Royal Beach, Orimedu, Lagos, Nigeria",
      feeKobo: 1_500_000,
      capacity: 3,
      registrationOpen: true,
      refundPolicy: "Test refund policy",
      reservationMinutes: 30,
      ...overrides,
    },
  });
}

export const validForm = {
  fullName: "Ada Okafor",
  phone: "0803 123 4567",
  dateOfBirth: "2003-05-14",
  cityOrState: "Lagos",
  emergencyContactName: "Ngozi Okafor",
  emergencyContactPhone: "08031112222",
  supportNeeds: "",
  acceptTerms: true,
  acceptPrivacy: true,
};
