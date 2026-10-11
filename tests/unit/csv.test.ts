import { describe, expect, it } from "vitest";
import { csvCell } from "@/lib/services/admin";

describe("csvCell", () => {
  it("neutralises spreadsheet formula injection", () => {
    for (const v of ["=HYPERLINK(\"x\")", "+1", "-2+3", "@SUM(A1)", "\tcmd", "\rcmd"]) {
      expect(csvCell(v).startsWith(`"'`)).toBe(true);
    }
  });
  it("quotes and escapes values", () => {
    expect(csvCell('He said "hi", ok')).toBe('"He said ""hi"", ok"');
    expect(csvCell(null)).toBe('""');
    expect(csvCell(42)).toBe('"42"');
  });
});
