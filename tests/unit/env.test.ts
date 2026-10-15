import { describe, expect, it } from "vitest";
import { envProblems, normaliseEnv } from "@/lib/env";

const good = {
  DATABASE_URL: "postgresql://u:p@host/db",
  APP_URL: "https://camp.example.org",
  APP_SECRET: "x".repeat(40),
};

describe("environment normalisation", () => {
  it("strips quotes, whitespace and trailing slashes", () => {
    const e = normaliseEnv({ ...good, APP_URL: ' "https://camp.example.org/" ', DATABASE_URL: "'postgresql://u:p@host/db'" });
    expect(e.APP_URL).toBe("https://camp.example.org/");
    expect(e.DATABASE_URL).toBe("postgresql://u:p@host/db");
    expect(envProblems({ ...good, APP_URL: ' "https://camp.example.org/" ' })).toEqual([]);
  });

  it("adds https:// to a bare domain", () => {
    expect(normaliseEnv({ ...good, APP_URL: "ggz-camp.vercel.app" }).APP_URL).toBe("https://ggz-camp.vercel.app");
  });

  it("falls back to Vercel's production domain when APP_URL is unset", () => {
    const { APP_URL: _omit, ...rest } = good;
    void _omit;
    expect(normaliseEnv({ ...rest, VERCEL_PROJECT_PRODUCTION_URL: "ggz-camp.vercel.app" }).APP_URL).toBe(
      "https://ggz-camp.vercel.app",
    );
  });

  it("names missing and invalid variables without echoing values", () => {
    const problems = envProblems({ APP_URL: "https://ok.example", APP_SECRET: "short-secret-value" });
    expect(problems).toContain("DATABASE_URL is not set");
    expect(problems.find((p) => p.startsWith("APP_SECRET"))).toMatch(/at least 32/);
    expect(problems.join(" ")).not.toContain("short-secret-value");
  });
});

describe("email provider", () => {
  it("prefers SMTP, falls back to Resend, and strips App Password spaces", async () => {
    const { emailProvider, env, resetEnvCache } = await import("@/lib/env");
    const saved = { ...process.env };
    Object.assign(process.env, { SMTP_HOST: "smtp.gmail.com", SMTP_USER: "ggz@gmail.com", SMTP_PASS: "abcd efgh ijkl mnop" });
    resetEnvCache();
    expect(emailProvider()).toBe("smtp");
    expect(env().SMTP_PASS).toBe("abcdefghijklmnop");
    delete process.env.SMTP_PASS;
    Object.assign(process.env, { RESEND_API_KEY: "re_x", EMAIL_FROM: "GGZ <camp@example.org>" });
    resetEnvCache();
    expect(emailProvider()).toBe("resend");
    for (const k of ["SMTP_HOST", "SMTP_USER", "RESEND_API_KEY", "EMAIL_FROM"]) delete process.env[k];
    resetEnvCache();
    expect(emailProvider()).toBeNull();
    Object.assign(process.env, saved);
    resetEnvCache();
  });
});
