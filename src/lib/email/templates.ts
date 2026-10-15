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
