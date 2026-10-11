"use client";

import Link from "next/link";
import { startTransition, useActionState, useEffect, useMemo } from "react";
import { useForm, useWatch, type FieldPath } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle, ShieldCheck } from "lucide-react";
import { submitRegistrationAction, type SubmitState } from "@/app/register/actions";
import { inputClass, primaryButton } from "@/components/register/flow-shell";
import {
  ageOn,
  agePolicyErrors,
  registrationFormSchema,
  type RegistrationFormData,
  type RegistrationFormInput,
} from "@/lib/validation/registration";

type Props = {
  email: string;
  eventStart: string;
  minimumAge: number | null;
  guardianConsentAge: number;
};

export function RegistrationForm({ email, eventStart, minimumAge, guardianConsentAge }: Props) {
  const [state, formAction, pending] = useActionState<SubmitState, FormData>(submitRegistrationAction, {});
  const policy = useMemo(
    () => ({ minimumAge, guardianConsentAge, eventStart: new Date(`${eventStart}T00:00:00Z`) }),
    [minimumAge, guardianConsentAge, eventStart],
  );

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors },
  } = useForm<RegistrationFormInput, unknown, RegistrationFormData>({
    resolver: zodResolver(registrationFormSchema),
    mode: "onTouched",
    defaultValues: { guardianConsent: false },
  });

  const dob = useWatch({ control, name: "dateOfBirth" });
  const isMinor =
    typeof dob === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dob) && ageOn(dob, policy.eventStart) < guardianConsentAge;

  // Surface server-side field errors on the matching inputs.
  useEffect(() => {
    for (const [field, message] of Object.entries(state.fieldErrors ?? {})) {
      setError(field as FieldPath<RegistrationFormInput>, { message });
    }
  }, [state.fieldErrors, setError]);

  const onValid = (data: RegistrationFormData) => {
    const policyErrors = agePolicyErrors(data, policy);
    if (Object.keys(policyErrors).length > 0) {
      for (const [field, message] of Object.entries(policyErrors)) {
        setError(field as FieldPath<RegistrationFormInput>, { message });
      }
      return;
    }
    const fd = new FormData();
    for (const [k, v] of Object.entries(data)) {
      if (typeof v === "boolean") {
        if (v) fd.set(k, "on");
      } else if (v != null) fd.set(k, String(v));
    }
    startTransition(() => formAction(fd));
  };

  const field = (name: FieldPath<RegistrationFormInput>) => ({
    id: name,
    "aria-invalid": Boolean(errors[name]),
    "aria-describedby": errors[name] ? `${name}-error` : undefined,
  });

  const err = (name: FieldPath<RegistrationFormInput>) =>
    errors[name]?.message ? (
      <p id={`${name}-error`} className="mt-1.5 text-sm font-semibold text-destructive">
        {String(errors[name]?.message)}
      </p>
    ) : null;

  return (
    <form onSubmit={handleSubmit(onValid)} noValidate className="mt-8 space-y-8">
      <fieldset className="space-y-5">
        <legend className="font-display text-xl font-bold">About you</legend>
        <div>
          <label htmlFor="fullName" className="font-semibold">Full name</label>
          <input {...register("fullName")} {...field("fullName")} autoComplete="name" className={inputClass} />
          {err("fullName")}
        </div>
        <div>
          <p className="font-semibold">Email</p>
          <p className="mt-2 rounded-2xl bg-sand px-4 py-3 text-ink/80">{email}</p>
          <p className="mt-1 text-sm text-ink/60">The email you paid with. Contact the organisers if it needs changing.</p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="phone" className="font-semibold">Phone number</label>
            <input {...register("phone")} {...field("phone")} type="tel" inputMode="tel" autoComplete="tel" placeholder="0803 123 4567" className={inputClass} />
            {err("phone")}
          </div>
          <div>
            <label htmlFor="dateOfBirth" className="font-semibold">Date of birth</label>
            <input {...register("dateOfBirth")} {...field("dateOfBirth")} type="date" autoComplete="bday" className={inputClass} />
            {err("dateOfBirth")}
          </div>
        </div>
        <div>
          <label htmlFor="cityOrState" className="font-semibold">City or state of residence</label>
          <input {...register("cityOrState")} {...field("cityOrState")} autoComplete="address-level1" placeholder="e.g. Ikeja, Lagos" className={inputClass} />
          {err("cityOrState")}
        </div>
      </fieldset>

      <fieldset className="space-y-5">
        <legend className="font-display text-xl font-bold">Emergency contact</legend>
        <p className="-mt-2 text-sm text-ink/65">Someone we can reach if anything happens during camp.</p>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="emergencyContactName" className="font-semibold">Name</label>
            <input {...register("emergencyContactName")} {...field("emergencyContactName")} className={inputClass} />
            {err("emergencyContactName")}
          </div>
          <div>
            <label htmlFor="emergencyContactPhone" className="font-semibold">Phone number</label>
            <input {...register("emergencyContactPhone")} {...field("emergencyContactPhone")} type="tel" inputMode="tel" className={inputClass} />
            {err("emergencyContactPhone")}
          </div>
        </div>
      </fieldset>

      {isMinor && (
        <fieldset className="space-y-5 rounded-3xl bg-sun/25 p-5 sm:p-6">
          <legend className="sr-only">Parent or guardian</legend>
          <p className="font-display text-xl font-bold">Parent or guardian consent</p>
          <p className="-mt-3 text-sm text-ink/75">
            Because you&apos;ll be under {guardianConsentAge} at camp, we need a parent or guardian&apos;s details and consent.
          </p>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="guardianName" className="font-semibold">Parent/guardian name</label>
              <input {...register("guardianName")} {...field("guardianName")} className={inputClass} />
              {err("guardianName")}
            </div>
            <div>
              <label htmlFor="guardianPhone" className="font-semibold">Parent/guardian phone</label>
              <input {...register("guardianPhone")} {...field("guardianPhone")} type="tel" inputMode="tel" className={inputClass} />
              {err("guardianPhone")}
            </div>
          </div>
          <div>
            <label htmlFor="guardianEmail" className="font-semibold">
              Parent/guardian email <span className="font-normal text-ink/60">(optional)</span>
            </label>
            <input {...register("guardianEmail")} {...field("guardianEmail")} type="email" className={inputClass} />
            {err("guardianEmail")}
          </div>
          <label className="flex gap-3 text-sm leading-relaxed">
            <input type="checkbox" {...register("guardianConsent")} {...field("guardianConsent")} className="mt-0.5 size-5 shrink-0 accent-[#f26b1d]" />
            <span>
              I confirm that the parent or guardian named above has agreed to this participant attending GGZ Camp 1.0 and
              to the registration terms.
            </span>
          </label>
          {err("guardianConsent")}
        </fieldset>
      )}

      <fieldset className="space-y-3">
        <legend className="font-display text-xl font-bold">
          Anything we should know? <span className="text-base font-normal text-ink/60">(optional)</span>
        </legend>
        <label htmlFor="supportNeeds" className="block text-sm text-ink/70">
          Dietary needs, allergies, accessibility or medical information the organisers should know to keep you safe.
          Share only what you&apos;re comfortable with — it is seen only by the organising team and handled as described
          in our privacy notice.
        </label>
        <textarea {...register("supportNeeds")} {...field("supportNeeds")} rows={3} className={`${inputClass} h-auto py-3`} />
        {err("supportNeeds")}
      </fieldset>

      <fieldset className="space-y-3 rounded-3xl bg-sand p-5">
        <legend className="sr-only">Agreements</legend>
        <label className="flex gap-3 text-sm leading-relaxed">
          <input type="checkbox" {...register("acceptTerms")} {...field("acceptTerms")} className="mt-0.5 size-5 shrink-0 accent-[#f26b1d]" />
          <span>
            I accept the{" "}
            <Link href="/terms" target="_blank" className="font-semibold underline">registration terms</Link>.
          </span>
        </label>
        {err("acceptTerms")}
        <label className="flex gap-3 text-sm leading-relaxed">
          <input type="checkbox" {...register("acceptPrivacy")} {...field("acceptPrivacy")} className="mt-0.5 size-5 shrink-0 accent-[#f26b1d]" />
          <span>
            I have read the <Link href="/privacy" target="_blank" className="font-semibold underline">privacy notice</Link>{" "}
            and agree to my information being used to organise the camp.
          </span>
        </label>
        {err("acceptPrivacy")}
      </fieldset>

      {state.error && (
        <p role="alert" className="rounded-2xl bg-destructive/10 p-4 font-semibold text-destructive">
          {state.error}
        </p>
      )}
      {Object.keys(errors).length > 0 && (
        <p role="alert" className="text-sm font-semibold text-destructive">
          Please fix the highlighted fields above.
        </p>
      )}

      <button type="submit" disabled={pending} className={primaryButton}>
        {pending ? (
          <>
            <LoaderCircle className="size-5 animate-spin" aria-hidden="true" /> Confirming your place…
          </>
        ) : (
          "Complete registration"
        )}
      </button>
      <p className="flex items-center gap-1.5 text-xs text-ink/60">
        <ShieldCheck className="size-3.5" aria-hidden="true" /> Your details are sent securely and seen only by the
        organising team.
      </p>
    </form>
  );
}
