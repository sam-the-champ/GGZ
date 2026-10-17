import { site } from "@/content/site";
import type { EmailMessage } from "./send";

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function layout(title: string, bodyHtml: string) {
  return `<!doctype html><html><body style="margin:0;background:#f7f1e8;font-family:Arial,Helvetica,sans-serif;color:#10202e">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="background:#10202e;color:#ffc83d;padding:20px 28px;font-weight:bold;letter-spacing:2px;font-size:12px">${escapeHtml(site.organiser.toUpperCase())}</td></tr>
<tr><td style="padding:28px">
<h1 style="font-size:22px;margin:0 0 16px">${escapeHtml(title)}</h1>
${bodyHtml}
<p style="font-size:13px;color:#5b6773;margin-top:28px">Need help? Contact ${escapeHtml(site.contact.name)} on ${escapeHtml(site.contact.phoneDisplay)}.</p>
</td></tr></table></td></tr></table></body></html>`;
}

function button(href: string, label: string) {
  return `<p style="margin:24px 0"><a href="${escapeHtml(href)}" style="background:#f26b1d;color:#ffffff;text-decoration:none;padding:14px 22px;border-radius:999px;font-weight:bold;display:inline-block">${escapeHtml(label)}</a></p>`;
}

export function paymentReceivedEmail(to: string, continueUrl: string): EmailMessage {
  const title = "Payment received — finish your registration";
  return {
    to,
    subject: `${site.eventName}: ${title}`,
    html: layout(
      title,
      `<p>Thank you! Your payment for ${escapeHtml(site.eventName)} — ${escapeHtml(site.theme)} has been verified.</p>
<p><strong>Your registration is not complete yet.</strong> Please fill in the short registration form to confirm your place.</p>
${button(continueUrl, "Complete my registration")}
<p style="font-size:13px;color:#5b6773">This secure link works once and expires in 2 hours. If it expires, request a new one from the website — you will not be asked to pay again.</p>`,
    ),
    text: `Your payment for ${site.eventName} has been verified, but your registration is not complete yet.\n\nComplete it here (link works once, expires in 2 hours):\n${continueUrl}\n\nNeed help? ${site.contact.name}: ${site.contact.phoneDisplay}`,
  };
}

export function recoveryEmail(to: string, continueUrl: string): EmailMessage {
  const title = "Continue your registration";
  return {
    to,
    subject: `${site.eventName}: ${title}`,
    html: layout(
      title,
      `<p>We found a verified payment for this email address. Use the secure link below to continue your registration — you will not be charged again.</p>
${button(continueUrl, "Continue registration")}
<p style="font-size:13px;color:#5b6773">This link works once and expires in 2 hours. If you did not request it, you can ignore this email.</p>`,
    ),
    text: `We found a verified payment for this email. Continue your registration (link works once, expires in 2 hours):\n${continueUrl}`,
  };
}

export function confirmationEmail(input: {
  to: string;
  fullName: string;
  registrationNumber: string;
}): EmailMessage {
  const title = "You're registered!";
  return {
    to: input.to,
    subject: `${site.eventName}: registration confirmed (${input.registrationNumber})`,
    html: layout(
      title,
      `<p>Hi ${escapeHtml(input.fullName)},</p>
<p>Your place at <strong>${escapeHtml(site.eventName)} — ${escapeHtml(site.theme)}</strong> is confirmed.</p>
<table style="font-size:15px;margin:16px 0;border-collapse:collapse">
<tr><td style="padding:4px 16px 4px 0;color:#5b6773">Registration no.</td><td style="font-weight:bold">${escapeHtml(input.registrationNumber)}</td></tr>
<tr><td style="padding:4px 16px 4px 0;color:#5b6773">Dates</td><td>${escapeHtml(site.dates.label)}</td></tr>
<tr><td style="padding:4px 16px 4px 0;color:#5b6773">Venue</td><td>${escapeHtml(site.venueLabel)}</td></tr>
</table>
<p>Keep your registration number safe. Further details about the programme and logistics will be shared by the organisers.</p>`,
    ),
    text: `Hi ${input.fullName},\n\nYour place at ${site.eventName} — ${site.theme} is confirmed.\nRegistration no.: ${input.registrationNumber}\nDates: ${site.dates.label}\nVenue: ${site.venueLabel}\n\nNeed help? ${site.contact.name}: ${site.contact.phoneDisplay}`,
  };
}

export function testEmail(to: string): EmailMessage {
  const title = "Email is working";
  return {
    to,
    subject: `${site.eventName}: test email`,
    html: layout(
      title,
      `<p>This is a test from the ${escapeHtml(site.eventName)} admin dashboard.</p>
<p>If you can read this, participants will receive their confirmation emails and secure registration links.</p>`,
    ),
    text: `This is a test from the ${site.eventName} admin dashboard. Email delivery is working.`,
  };
}

// ─── Help center ────────────────────────────────────────────────────────────

const nl2br = (s: string) => escapeHtml(s).replace(/\r?\n/g, "<br>");

export function ticketReceivedEmail(input: {
  to: string;
  name: string;
  reference: string;
  categoryLabel: string;
  message: string;
  responseWindow: string;
}): EmailMessage {
  const title = "We've received your request";
  return {
    to: input.to,
    subject: `${site.eventName} Help Center: request ${input.reference} received`,
    html: layout(
      title,
      `<p>Hi ${escapeHtml(input.name)},</p>
<p>Thanks for reaching out. Your request reference is <strong>${escapeHtml(input.reference)}</strong>.</p>
<p>A member of the organising team will respond within <strong>${escapeHtml(input.responseWindow)}</strong> by email or phone.</p>
<p style="font-size:13px;color:#5b6773;margin-top:20px">Topic: ${escapeHtml(input.categoryLabel)}</p>
<blockquote style="margin:8px 0;padding:12px 16px;background:#f7f1e8;border-radius:12px;font-size:14px">${nl2br(input.message)}</blockquote>
<p style="font-size:13px;color:#5b6773">For emergencies only, call ${escapeHtml(site.contact.name)} on ${escapeHtml(site.contact.phoneDisplay)}.</p>`,
    ),
    text: `Hi ${input.name},\n\nWe've received your request ${input.reference}. The organising team will respond within ${input.responseWindow}.\n\nTopic: ${input.categoryLabel}\n\n${input.message}\n\nEmergencies only: ${site.contact.name}, ${site.contact.phoneDisplay}`,
  };
}

export function ticketReplyEmail(input: { to: string; name: string; reference: string; body: string }): EmailMessage {
  const title = `Reply to your request ${input.reference}`;
  return {
    to: input.to,
    subject: `${site.eventName} Help Center: ${input.reference}`,
    html: layout(
      title,
      `<p>Hi ${escapeHtml(input.name)},</p>
<div style="font-size:15px;line-height:1.6">${nl2br(input.body)}</div>
<p style="font-size:13px;color:#5b6773;margin-top:24px">You can reply to this email if you need anything else. Please keep the reference ${escapeHtml(input.reference)} in the subject.</p>`,
    ),
    text: `Hi ${input.name},\n\n${input.body}\n\nReference: ${input.reference}. You can reply to this email.`,
  };
}

export function newTicketAlertEmail(input: {
  to: string;
  reference: string;
  name: string;
  categoryLabel: string;
  adminUrl: string;
}): EmailMessage {
  const title = `New help request ${input.reference}`;
  return {
    to: input.to,
    subject: `[Help Center] ${input.reference} · ${input.categoryLabel}`,
    html: layout(
      title,
      `<p><strong>${escapeHtml(input.name)}</strong> submitted a request: ${escapeHtml(input.categoryLabel)}.</p>
${button(input.adminUrl, "Open in Help Desk")}
<p style="font-size:13px;color:#5b6773">Personal details are only shown inside the admin panel.</p>`,
    ),
    text: `New help request ${input.reference} from ${input.name}: ${input.categoryLabel}\n${input.adminUrl}`,
  };
}

// ─── Resume-page outcomes (sent to the inbox owner, never shown on screen) ──

export function alreadyRegisteredEmail(input: {
  to: string;
  fullName: string;
  registrationNumber: string;
  helpUrl: string;
}): EmailMessage {
  const title = "You're already registered";
  return {
    to: input.to,
    subject: `${site.eventName}: you're already registered (${input.registrationNumber})`,
    html: layout(
      title,
      `<p>Hi ${escapeHtml(input.fullName)},</p>
<p>Someone (hopefully you) asked to resume a registration for this email address. Good news — your registration is already <strong>complete</strong>. There's nothing more to fill in and you don't need to pay again.</p>
<table style="font-size:15px;margin:16px 0;border-collapse:collapse">
<tr><td style="padding:4px 16px 4px 0;color:#5b6773">Registration no.</td><td style="font-weight:bold">${escapeHtml(input.registrationNumber)}</td></tr>
<tr><td style="padding:4px 16px 4px 0;color:#5b6773">Dates</td><td>${escapeHtml(site.dates.label)}</td></tr>
<tr><td style="padding:4px 16px 4px 0;color:#5b6773">Venue</td><td>${escapeHtml(site.venueLabel)}</td></tr>
</table>
<p style="font-size:13px;color:#5b6773">Something wrong with your details? ${button(input.helpUrl, "Visit the Help Center")}</p>`,
    ),
    text: `Hi ${input.fullName},\n\nYour registration for ${site.eventName} is already complete. Registration no.: ${input.registrationNumber}. You don't need to pay again.\n\nNeed help? ${input.helpUrl}`,
  };
}

export function noPaymentFoundEmail(input: { to: string; registerUrl: string; helpUrl: string }): EmailMessage {
  const title = "We couldn't find a completed payment";
  return {
    to: input.to,
    subject: `${site.eventName}: about your registration request`,
    html: layout(
      title,
      `<p>Someone (hopefully you) asked to resume a registration for this email address, but we couldn't find a <strong>completed payment</strong> for it.</p>
<p>If you started registering but didn't finish paying, you haven't been charged — just start again:</p>
${button(input.registerUrl, "Start registration")}
<p>If money left your account, please <a href="${escapeHtml(input.helpUrl)}">send a request in the Help Center</a> with the date and amount, or check whether you paid with a different email address.</p>
<p style="font-size:13px;color:#5b6773">If you didn't request this, you can ignore this email.</p>`,
    ),
    text: `We couldn't find a completed payment for this email address.\n\nIf you didn't finish paying, you haven't been charged — start again: ${input.registerUrl}\n\nIf money left your account, send a request: ${input.helpUrl}\n\nIf you didn't request this, ignore this email.`,
  };
}

export function paymentOnHoldEmail(input: { to: string; publicRef: string; helpUrl: string }): EmailMessage {
  const title = "Your payment is safe — the organisers will be in touch";
  return {
    to: input.to,
    subject: `${site.eventName}: your payment (${input.publicRef})`,
    html: layout(
      title,
      `<p>We found your payment (reference <strong>${escapeHtml(input.publicRef)}</strong>). It arrived after your reserved place had expired and the camp was full at that moment, so the organisers need to review it.</p>
<p>You don't need to pay again. The team will contact you about a place or a refund. You can also <a href="${escapeHtml(input.helpUrl)}">send a request in the Help Center</a>.</p>`,
    ),
    text: `We found your payment (${input.publicRef}). It arrived after your reserved place expired while camp was full, so the organisers will contact you about a place or a refund. Don't pay again.\n\nHelp Center: ${input.helpUrl}`,
  };
}
