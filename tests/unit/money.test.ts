import { describe, expect, it } from "vitest";
import { formatNaira, koboToNairaInput, nairaInputToKobo } from "@/lib/money";

describe("money", () => {
  it("parses admin naira input to integer kobo", () => {
    expect(nairaInputToKobo("15000")).toBe(1_500_000);
    expect(nairaInputToKobo("15,000.50")).toBe(1_500_050);
    expect(nairaInputToKobo("₦ 2,500")).toBe(250_000);
    expect(nairaInputToKobo("0.5")).toBe(50);
  });
  it("rejects invalid amounts", () => {
    for (const bad of ["", "abc", "-100", "0", "10.123", "1e5"]) expect(nairaInputToKobo(bad)).toBeNull();
  });
  it("round-trips kobo for the settings form", () => {
    expect(koboToNairaInput(1_500_050)).toBe("15000.50");
    expect(koboToNairaInput(1_500_000)).toBe("15000");
    expect(koboToNairaInput(null)).toBe("");
  });
  it("formats naira", () => {
    expect(formatNaira(1_500_000)).toMatch(/15,000/);
  });
});
