import { ImageResponse } from "next/og";

/**
 * Generated social-sharing image (WhatsApp, Instagram, X…). To replace it with
 * a designed image, delete this file and add src/app/opengraph-image.png (1200×630).
 */
export const alt = "GGZ Camp 1.0 — IMPACT · 8–10 December 2026 · Royal Beach, Orimedu, Lagos";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#0e1b26", color: "#fbf5ec", position: "relative", fontFamily: "sans-serif" }}>
        <div style={{ position: "absolute", right: -120, top: -120, width: 560, height: 560, borderRadius: 9999, background: "#ffc83d", display: "flex" }} />
        <div style={{ position: "absolute", right: 0, bottom: 0, width: 1200, height: 150, background: "#2aa3a0", display: "flex" }} />
        <div style={{ position: "absolute", right: 0, bottom: 0, width: 1200, height: 80, background: "#f1e4d1", display: "flex" }} />
        <div style={{ display: "flex", flexDirection: "column", padding: "64px 72px" }}>
          <div style={{ fontSize: 26, letterSpacing: 6, color: "#ffc83d", fontWeight: 700 }}>GOD&apos;S GENZ COMMUNITY PRESENTS</div>
          <div style={{ fontSize: 84, fontWeight: 800, marginTop: 18 }}>GGZ Camp 1.0</div>
          <div style={{ fontSize: 170, fontWeight: 900, color: "#f26b1d", lineHeight: 1 }}>IMPACT</div>
          <div style={{ fontSize: 34, marginTop: 22, fontWeight: 600 }}>8–10 December 2026 · Royal Beach, Orimedu, Lagos</div>
        </div>
      </div>
    ),
    size,
  );
}
