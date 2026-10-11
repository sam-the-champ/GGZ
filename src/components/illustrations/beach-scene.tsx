import type { CSSProperties } from "react";

const pivot = (x: number, y: number): CSSProperties => ({
  transformBox: "view-box",
  transformOrigin: `${x}px ${y}px`,
});

function WaveBand({ y, color, className, amp = 10 }: { y: number; color: string; className: string; amp?: number }) {
  // Two identical periods side by side so translateX(-50%) loops seamlessly.
  let d = `M0 ${y}`;
  for (let x = 0; x < 1200; x += 100) {
    d += ` q25 ${-amp} 50 0 t50 0`;
  }
  d += ` V400 H0 Z`;
  return <path d={d} fill={color} className={className} />;
}

/** Decorative beach backdrop (aria-hidden; characters carry the meaning). */
export function BeachScene({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 600 400"
      preserveAspectRatio="xMidYMax slice"
      className={className}
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="sky" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#ffe4b8" />
          <stop offset="1" stopColor="#ffd08a" />
        </linearGradient>
      </defs>
      <rect width="600" height="400" fill="url(#sky)" />
      <g className="anim-sun" style={pivot(430, 150)}>
        <circle cx="430" cy="150" r="78" fill="#ffc83d" />
        <circle cx="430" cy="150" r="104" fill="#ffc83d" opacity="0.25" />
      </g>
      {/* birds */}
      <g stroke="#0e1b26" strokeWidth="2.2" fill="none" strokeLinecap="round" opacity="0.55">
        <path d="M120 70 q8 -8 16 0 q8 -8 16 0" />
        <path d="M170 96 q6 -6 12 0 q6 -6 12 0" />
      </g>
      {/* sea */}
      <g>
        <svg x="0" y="0" width="600" height="400" overflow="hidden">
          <g className="anim-waves-slow">
            <WaveBand y={212} color="#2aa3a0" className="" amp={8} />
          </g>
          <g className="anim-waves">
            <WaveBand y={236} color="#1f8a87" className="" amp={10} />
          </g>
        </svg>
      </g>
      {/* sand */}
      <path d="M0 290 Q150 262 300 280 T600 270 V400 H0Z" fill="#f1e4d1" />
      <path d="M0 330 Q200 310 420 326 T600 318 V400 H0Z" fill="#ead8bd" />
      {/* palm */}
      <g className="anim-sway" style={pivot(70, 300)}>
        <path d="M70 300 Q60 220 86 150" stroke="#7a4a24" strokeWidth="11" fill="none" strokeLinecap="round" />
        <g fill="#1e7a57">
          <path d="M86 150 Q40 128 14 158 Q46 140 86 156Z" />
          <path d="M86 150 Q70 104 30 104 Q66 118 84 156Z" />
          <path d="M86 150 Q120 110 160 120 Q118 126 88 158Z" />
          <path d="M86 150 Q138 146 156 184 Q124 156 86 156Z" />
          <path d="M86 150 Q96 104 128 90 Q100 120 90 156Z" />
        </g>
        <circle cx="84" cy="158" r="6" fill="#5a3517" />
        <circle cx="92" cy="160" r="6" fill="#5a3517" />
      </g>
    </svg>
  );
}
