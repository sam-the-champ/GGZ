import { describe, expect, it } from "vitest";
import { ageOn, agePolicyErrors, registrationFormSchema } from "@/lib/validation/registration";
import { validForm } from "../helpers/db";

const policy = { minimumAge: 13, guardianConsentAge: 18, eventStart: new Date("2026-12-10T00:00:00Z") };

describe("registration form validation", () => {
  it("accepts a valid adult registration", () => {
    const r = registrationFormSchema.safeParse(validForm);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.phone).toBe("08031234567");
  });

  it("reports missing required fields", () => {
    const r = registrationFormSchema.safeParse({});
    expect(r.success).toBe(false);
    const fields = new Set(r.error!.issues.map((i) => i.path[0]));
    for (const f of ["fullName", "phone", "dateOfBirth", "cityOrState", "emergencyContactName", "emergencyContactPhone", "acceptTerms", "acceptPrivacy"]) {
      expect(fields.has(f)).toBe(true);
    }
  });

  it("rejects invalid phone, email and unaccepted terms", () => {
    const r = registrationFormSchema.safeParse({ ...validForm, phone: "12345", guardianEmail: "nope", acceptTerms: false });
    expect(r.success).toBe(false);
    const fields = r.error!.issues.map((i) => i.path[0]);
    expect(fields).toEqual(expect.arrayContaining(["phone", "guardianEmail", "acceptTerms"]));
  });

  it("computes age on the first day of camp", () => {
    expect(ageOn("2008-12-10", policy.eventStart)).toBe(18);
    expect(ageOn("2008-12-11", policy.eventStart)).toBe(17);
  });

  it("requires guardian details and consent for minors", () => {
    const errs = agePolicyErrors({ dateOfBirth: "2010-01-01" }, policy);
    expect(Object.keys(errs).sort()).toEqual(["guardianConsent", "guardianName", "guardianPhone"]);
    expect(
      agePolicyErrors(
        { dateOfBirth: "2010-01-01", guardianName: "Mrs Bello", guardianPhone: "08030000000", guardianConsent: true },
        policy,
      ),
    ).toEqual({});
  });

  it("enforces a configured minimum age", () => {
    expect(agePolicyErrors({ dateOfBirth: "2015-01-01" }, policy).dateOfBirth).toMatch(/at least 13/);
  });

  it("does not require guardians for adults", () => {
    expect(agePolicyErrors({ dateOfBirth: "2000-01-01" }, policy)).toEqual({});
  });
});
