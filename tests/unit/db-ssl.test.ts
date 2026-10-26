import { describe, expect, it } from "vitest";
import { withStrictSsl } from "@/lib/db";

describe("withStrictSsl", () => {
  it("upgrades lenient sslmodes to verify-full and keeps other params", () => {
    expect(withStrictSsl("postgresql://u:p@h/db?sslmode=require&channel_binding=require")).toBe(
      "postgresql://u:p@h/db?sslmode=verify-full&channel_binding=require",
    );
    expect(withStrictSsl("postgresql://u:p@h/db?x=1&sslmode=prefer")).toBe("postgresql://u:p@h/db?x=1&sslmode=verify-full");
  });
  it("leaves strict, disabled or absent sslmode alone", () => {
    for (const url of [
      "postgresql://u:p@h/db?sslmode=verify-full",
      "postgresql://u:p@localhost:54329/ggz_dev",
      "postgresql://u:p@h/db?sslmode=disable",
    ]) {
      expect(withStrictSsl(url)).toBe(url);
    }
  });
});
