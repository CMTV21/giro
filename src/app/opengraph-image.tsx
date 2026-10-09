import { ImageResponse } from "next/og";

// The preview card shown when someone shares a Giro link (iMessage, WhatsApp, Slack, social).
export const alt = "Giro — trips, curated";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "linear-gradient(135deg, #0b1220 0%, #1e3a5f 55%, #0e7c7b 100%)", color: "white", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <svg width="72" height="72" viewBox="0 0 32 32">
            <circle cx="16" cy="16" r="16" fill="#ffffff" />
            <path d="M22.5 11.2A8 8 0 1 0 24 16h-7" fill="none" stroke="#0b1220" strokeWidth="2.6" strokeLinecap="round" />
            <circle cx="22.6" cy="10.9" r="2.2" fill="#ff5a36" />
          </svg>
          <span style={{ fontSize: 56, fontWeight: 700, letterSpacing: -1 }}>giro</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <span style={{ fontSize: 84, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2 }}>Trips, curated.</span>
          <span style={{ fontSize: 34, opacity: 0.85, maxWidth: 900 }}>A day-by-day plan built around you, with flights, stays and the best local food ready to book.</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 28, opacity: 0.8 }}>
          <span>girotrips.com</span>
          <span style={{ display: "flex", width: 120, height: 8, borderRadius: 8, background: "#ff5a36" }} />
        </div>
      </div>
    ),
    size,
  );
}
