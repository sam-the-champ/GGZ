/**
 * Animated camp characters — original SVG illustrations animated with CSS
 * keyframes (see globals.css). Pure server components: no client JS.
 * Every animation is disabled under `prefers-reduced-motion`.
 *
 * Arm/leg pivots use `transform-box: view-box` with explicit origins in SVG
 * user units so joints rotate from the shoulder/hip.
 */
import type { CSSProperties, ReactNode } from "react";

const INK = "#0e1b26";

const pivot = (x: number, y: number): CSSProperties => ({
  transformBox: "view-box",
  transformOrigin: `${x}px ${y}px`,
});

type HairStyle = "afro" | "short" | "puffs" | "braids" | "wrap";

type Look = {
  skin: string;
  hair: string;
  hairStyle: HairStyle;
  top: string;
  bottom: string;
};

export const looks = {
  ada: { skin: "#7a4a2c", hair: "#1b120d", hairStyle: "puffs", top: "#f26b1d", bottom: "#0e1b26" },
  tobi: { skin: "#5c3920", hair: "#140d09", hairStyle: "short", top: "#1e7a57", bottom: "#d9c3a5" },
  zee: { skin: "#8d5a3b", hair: "#1b120d", hairStyle: "afro", top: "#ffc83d", bottom: "#1c3142" },
  kemi: { skin: "#6b4226", hair: "#1b120d", hairStyle: "braids", top: "#2aa3a0", bottom: "#0e1b26" },
  dayo: { skin: "#4e301b", hair: "#120c08", hairStyle: "short", top: "#ffffff", bottom: "#1e7a57" },
  ife: { skin: "#a26a45", hair: "#1b120d", hairStyle: "wrap", top: "#c94f0c", bottom: "#1c3142" },
} satisfies Record<string, Look>;

function Svg({
  children,
  className,
  title,
  viewBox = "0 0 200 220",
}: {
  children: ReactNode;
  className?: string;
  title: string;
  viewBox?: string;
}) {
  return (
    <svg viewBox={viewBox} className={className} role="img" aria-label={title} xmlns="http://www.w3.org/2000/svg">
      <title>{title}</title>
      {children}
    </svg>
  );
}

function Head({
  cx,
  cy,
  look,
  eyes = "open",
  tilt = 0,
}: {
  cx: number;
  cy: number;
  look: Look;
  eyes?: "open" | "closed";
  tilt?: number;
}) {
  const r = 23;
  return (
    <g transform={`rotate(${tilt} ${cx} ${cy + r})`}>
      {/* hair behind head */}
      {look.hairStyle === "afro" && <circle cx={cx} cy={cy - 6} r={r + 11} fill={look.hair} />}
      {look.hairStyle === "puffs" && (
        <>
          <circle cx={cx - 22} cy={cy - 20} r={12} fill={look.hair} />
          <circle cx={cx + 22} cy={cy - 20} r={12} fill={look.hair} />
        </>
      )}
      {look.hairStyle === "braids" && (
        <>
          <rect x={cx - r - 3} y={cy - 6} width={9} height={44} rx={4.5} fill={look.hair} />
          <rect x={cx + r - 6} y={cy - 6} width={9} height={44} rx={4.5} fill={look.hair} />
        </>
      )}
      {/* ears + face */}
      <circle cx={cx - r + 1} cy={cy + 3} r={5} fill={look.skin} />
      <circle cx={cx + r - 1} cy={cy + 3} r={5} fill={look.skin} />
      <circle cx={cx} cy={cy} r={r} fill={look.skin} />
      {/* hair on top */}
      {look.hairStyle === "short" && (
        <path d={`M${cx - r} ${cy - 2} Q${cx - r + 2} ${cy - r - 6} ${cx} ${cy - r - 4} Q${cx + r - 2} ${cy - r - 6} ${cx + r} ${cy - 2} Q${cx + 8} ${cy - 14} ${cx - r} ${cy - 2}Z`} fill={look.hair} />
      )}
      {(look.hairStyle === "puffs" || look.hairStyle === "braids" || look.hairStyle === "afro") && (
        <path d={`M${cx - r} ${cy} Q${cx - r} ${cy - r - 4} ${cx} ${cy - r - 3} Q${cx + r} ${cy - r - 4} ${cx + r} ${cy} Q${cx + 6} ${cy - 16} ${cx - r} ${cy}Z`} fill={look.hair} />
      )}
      {look.hairStyle === "wrap" && (
        <>
          <path d={`M${cx - r - 3} ${cy - 2} Q${cx - r} ${cy - r - 14} ${cx} ${cy - r - 12} Q${cx + r + 4} ${cy - r - 14} ${cx + r + 3} ${cy - 2} Q${cx} ${cy - 12} ${cx - r - 3} ${cy - 2}Z`} fill="#ffc83d" />
          <path d={`M${cx + 6} ${cy - r - 10} q12 -10 20 -2 q-8 2 -12 10z`} fill="#f26b1d" />
        </>
      )}
      {/* eyes */}
      {eyes === "open" ? (
        <g className="anim-blink" style={pivot(cx, cy + 2)}>
          <ellipse cx={cx - 8.5} cy={cy + 2} rx={2.6} ry={3} fill={INK} />
          <ellipse cx={cx + 8.5} cy={cy + 2} rx={2.6} ry={3} fill={INK} />
        </g>
      ) : (
        <g stroke={INK} strokeWidth={2} strokeLinecap="round" fill="none">
          <path d={`M${cx - 12} ${cy + 2} q3.5 3 7 0`} />
          <path d={`M${cx + 5} ${cy + 2} q3.5 3 7 0`} />
        </g>
      )}
      <circle cx={cx - 14} cy={cy + 9} r={3.2} fill="#f26b1d" opacity={0.25} />
      <circle cx={cx + 14} cy={cy + 9} r={3.2} fill="#f26b1d" opacity={0.25} />
      <path d={`M${cx - 6} ${cy + 10} Q${cx} ${cy + 16} ${cx + 6} ${cy + 10}`} stroke={INK} strokeWidth={2} fill="none" strokeLinecap="round" />
    </g>
  );
}

function Limb({ d, color, width = 12 }: { d: string; color: string; width?: number }) {
  return <path d={d} stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" fill="none" />;
}

function Torso({ look, y = 98, h = 66 }: { look: Look; y?: number; h?: number }) {
  return (
    <>
      <rect x={93} y={y - 8} width={14} height={14} rx={4} fill={look.skin} />
      <path d={`M74 ${y + 6} Q100 ${y - 6} 126 ${y + 6} L130 ${y + h} Q100 ${y + h + 6} 70 ${y + h} Z`} fill={look.top} />
    </>
  );
}

function Shadow({ cx = 100, cy = 212, rx = 52 }: { cx?: number; cy?: number; rx?: number }) {
  return <ellipse cx={cx} cy={cy} rx={rx} ry={6} fill={INK} opacity={0.12} />;
}

// ─── Bible reader ───────────────────────────────────────────────────────────

export function BibleReader({ className, look = looks.ada }: { className?: string; look?: Look }) {
  return (
    <Svg className={className} title="A young person reading an open Bible">
      <Shadow cy={206} rx={70} />
      {/* sparkle */}
      <g className="anim-glow" style={pivot(150, 34)}>
        <path d="M150 22 l3 9 9 3 -9 3 -3 9 -3 -9 -9 -3 9 -3z" fill="#ffc83d" />
      </g>
      <g className="anim-bob">
        {/* crossed legs */}
        <ellipse cx={100} cy={186} rx={64} ry={18} fill={look.bottom} />
        <ellipse cx={42} cy={192} rx={10} ry={6} fill={INK} />
        <ellipse cx={158} cy={192} rx={10} ry={6} fill={INK} />
        <Torso look={look} y={106} h={70} />
        <Head cx={100} cy={78} look={look} tilt={6} />
        {/* arms to the book */}
        <Limb d="M78 120 Q64 140 74 156" color={look.top} />
        <Limb d="M122 120 Q136 140 126 156" color={look.top} />
        {/* book */}
        <path d="M66 146 L100 150 L134 146 L134 172 L100 176 L66 172 Z" fill="#7a2e12" />
        <path d="M100 148 L70 144 L70 168 L100 172 Z" fill="#fffaf1" />
        <path d="M100 148 L130 144 L130 168 L100 172 Z" fill="#fffaf1" />
        <g stroke="#d8c8b2" strokeWidth={1.2}>
          <path d="M75 151 L95 153 M75 156 L95 158 M75 161 L95 163" />
        </g>
        <g className="anim-page" style={pivot(100, 158)}>
          <path d="M100 148 L128 145 L128 169 L100 172 Z" fill="#ffffff" stroke="#eadcc8" strokeWidth={0.8} />
          <path d="M105 153 L123 151 M105 158 L123 156 M105 163 L120 161" stroke="#d8c8b2" strokeWidth={1.2} />
        </g>
        <path d="M100 172 L100 186" stroke="#c94f0c" strokeWidth={3} />
        <circle cx={72} cy={158} r={6} fill={look.skin} />
        <circle cx={128} cy={158} r={6} fill={look.skin} />
      </g>
    </Svg>
  );
}

// ─── Worshipper ─────────────────────────────────────────────────────────────

function Note({ x, y, className }: { x: number; y: number; className?: string }) {
  return (
    <g className={className}>
      <path d={`M${x} ${y} v-18 l12 -4 v18`} stroke={INK} strokeWidth={2.4} fill="none" />
      <ellipse cx={x - 3} cy={y} rx={4.5} ry={3.5} fill={INK} />
      <ellipse cx={x + 9} cy={y - 4} rx={4.5} ry={3.5} fill={INK} />
    </g>
  );
}

export function Worshipper({ className, look = looks.zee }: { className?: string; look?: Look }) {
  return (
    <Svg className={className} title="A young person worshipping with raised hands">
      <Shadow />
      <Note x={30} y={70} className="anim-note" />
      <Note x={164} y={58} className="anim-note delay-2" />
      <g className="anim-sway" style={pivot(100, 210)}>
        <rect x={84} y={160} width={14} height={46} rx={6} fill={look.bottom} />
        <rect x={102} y={160} width={14} height={46} rx={6} fill={look.bottom} />
        <ellipse cx={89} cy={207} rx={11} ry={5} fill={INK} />
        <ellipse cx={111} cy={207} rx={11} ry={5} fill={INK} />
        <Torso look={look} y={100} h={66} />
        <g className="anim-arm-l" style={pivot(80, 108)}>
          <Limb d="M80 108 Q64 84 58 50" color={look.top} />
          <circle cx={57} cy={44} r={7} fill={look.skin} />
        </g>
        <g className="anim-arm-r" style={pivot(120, 108)}>
          <Limb d="M120 108 Q136 84 142 50" color={look.top} />
          <circle cx={143} cy={44} r={7} fill={look.skin} />
        </g>
        <Head cx={100} cy={72} look={look} eyes="closed" tilt={-4} />
      </g>
    </Svg>
  );
}

// ─── Praying ────────────────────────────────────────────────────────────────

export function Praying({ className, look = looks.kemi }: { className?: string; look?: Look }) {
  return (
    <Svg className={className} title="A young person kneeling in prayer">
      <circle cx={100} cy={96} r={74} fill="#ffc83d" className="anim-glow" style={pivot(100, 96)} opacity={0.5} />
      <Shadow cy={208} rx={58} />
      <g className="anim-bob">
        <ellipse cx={100} cy={192} rx={48} ry={16} fill={look.bottom} />
        <Torso look={look} y={112} h={70} />
        <Limb d="M80 124 Q78 146 96 142" color={look.top} />
        <Limb d="M120 124 Q122 146 104 142" color={look.top} />
        <path d="M100 116 Q92 130 94 144 L106 144 Q108 130 100 116Z" fill={look.skin} />
        <Head cx={100} cy={84} look={look} eyes="closed" tilt={8} />
      </g>
    </Svg>
  );
}

// ─── Guitarist ──────────────────────────────────────────────────────────────

export function Guitarist({ className, look = looks.tobi }: { className?: string; look?: Look }) {
  return (
    <Svg className={className} title="A young person playing guitar">
      <Shadow />
      <Note x={168} y={86} className="anim-note delay-1" />
      <g className="anim-bob">
        {/* log seat */}
        <rect x={56} y={182} width={88} height={22} rx={11} fill="#8a5a33" />
        <circle cx={140} cy={193} r={10} fill="#b07a4c" />
        <rect x={80} y={160} width={16} height={40} rx={7} fill={look.bottom} />
        <rect x={104} y={160} width={16} height={40} rx={7} fill={look.bottom} />
        <Torso look={look} y={100} h={66} />
        <Head cx={100} cy={72} look={look} tilt={-6} />
        {/* guitar */}
        <g transform="rotate(-28 108 150)">
          <rect x={20} y={146} width={78} height={8} rx={3} fill="#5a3517" />
          <rect x={14} y={143} width={14} height={14} rx={3} fill="#3d230f" />
          <ellipse cx={116} cy={150} rx={26} ry={20} fill="#d9822b" />
          <ellipse cx={100} cy={150} rx={18} ry={15} fill="#d9822b" />
          <circle cx={108} cy={150} r={6} fill="#3d230f" />
          <path d="M28 148 H130 M28 152 H130" stroke="#fffaf1" strokeWidth={0.8} />
        </g>
        {/* fretting arm */}
        <Limb d="M80 108 Q58 116 52 128" color={look.top} />
        <circle cx={50} cy={131} r={6.5} fill={look.skin} />
        {/* strumming arm */}
        <g className="anim-strum" style={pivot(120, 108)}>
          <Limb d="M120 108 Q130 130 116 146" color={look.top} />
          <circle cx={114} cy={149} r={6.5} fill={look.skin} />
        </g>
      </g>
    </Svg>
  );
}

// ─── Ball player ────────────────────────────────────────────────────────────

export function BallPlayer({ className, look = looks.dayo }: { className?: string; look?: Look }) {
  return (
    <Svg className={className} title="A young person playing football on the beach">
      <Shadow cx={92} rx={36} />
      <ellipse cx={156} cy={212} rx={12} ry={3.5} fill={INK} opacity={0.12} className="anim-glow" style={pivot(156, 212)} />
      <g className="anim-ball">
        <circle cx={156} cy={196} r={13} fill="#ffffff" stroke={INK} strokeWidth={2} />
        <path d="M156 189 l6 4 -2 7 h-8 l-2 -7z" fill={INK} />
      </g>
      {/* standing leg */}
      <rect x={82} y={160} width={14} height={46} rx={6} fill={look.bottom} />
      <ellipse cx={87} cy={207} rx={11} ry={5} fill={INK} />
      {/* kicking leg */}
      <g className="anim-kick" style={pivot(108, 162)}>
        <path d="M108 162 L126 196" stroke={look.bottom} strokeWidth={14} strokeLinecap="round" />
        <ellipse cx={132} cy={200} rx={11} ry={5} fill={INK} transform="rotate(-20 132 200)" />
      </g>
      <Torso look={look} y={100} h={66} />
      <path d="M90 116 h20 v6 h-20z" fill="#f26b1d" opacity={0.9} />
      <Limb d="M78 108 Q58 116 48 104" color={look.top} />
      <circle cx={46} cy={101} r={6.5} fill={look.skin} />
      <Limb d="M122 108 Q140 122 150 118" color={look.top} />
      <circle cx={153} cy={117} r={6.5} fill={look.skin} />
      <Head cx={100} cy={72} look={look} />
    </Svg>
  );
}

// ─── Friends talking (fellowship) ───────────────────────────────────────────

export function Friends({ className }: { className?: string }) {
  const a = looks.ife;
  const b = looks.tobi;
  return (
    <Svg className={className} title="Two friends talking and laughing together" viewBox="0 0 260 220">
      <ellipse cx={130} cy={212} rx={100} ry={6} fill={INK} opacity={0.12} />
      <g className="anim-bob">
        <g transform="translate(150 6)">
          <rect x={40} y={0} width={64} height={40} rx={14} fill="#ffffff" stroke={INK} strokeWidth={2} />
          <path d="M52 40 l-6 12 14 -12z" fill="#ffffff" stroke={INK} strokeWidth={2} strokeLinejoin="round" />
          <path d="M72 12 c-6 -6 -14 2 -8 8 l8 8 8 -8 c6 -6 -2 -14 -8 -8z" fill="#f26b1d" />
        </g>
      </g>
      <g transform="translate(-20 0)" className="anim-bob delay-1">
        <rect x={84} y={160} width={14} height={46} rx={6} fill={a.bottom} />
        <rect x={102} y={160} width={14} height={46} rx={6} fill={a.bottom} />
        <Torso look={a} y={100} h={66} />
        <Limb d="M80 108 Q70 136 78 160" color={a.top} />
        <Limb d="M120 108 Q140 120 150 112" color={a.top} />
        <Head cx={100} cy={72} look={a} tilt={6} />
      </g>
      <g transform="translate(80 0)" className="anim-bob delay-2">
        <rect x={84} y={160} width={14} height={46} rx={6} fill={b.bottom} />
        <rect x={102} y={160} width={14} height={46} rx={6} fill={b.bottom} />
        <Torso look={b} y={100} h={66} />
        <Limb d="M80 108 Q66 120 54 114" color={b.top} />
        <Limb d="M120 108 Q130 136 122 160" color={b.top} />
        <Head cx={100} cy={72} look={b} tilt={-6} />
      </g>
    </Svg>
  );
}

// ─── Campfire ───────────────────────────────────────────────────────────────

export function Campfire({ className }: { className?: string }) {
  return (
    <Svg className={className} title="A small campfire" viewBox="0 0 120 120">
      <circle cx={60} cy={70} r={46} fill="#ffc83d" opacity={0.3} className="anim-glow" style={pivot(60, 70)} />
      <g className="anim-flame" style={pivot(60, 96)}>
        <path d="M60 30 C78 52 82 66 74 84 C70 94 50 94 46 84 C38 66 46 54 60 30Z" fill="#f26b1d" />
        <path d="M60 52 C70 64 70 74 66 84 C62 90 56 90 54 84 C50 74 54 64 60 52Z" fill="#ffc83d" />
      </g>
      <rect x={30} y={90} width={60} height={10} rx={5} fill="#5a3517" transform="rotate(12 60 95)" />
      <rect x={30} y={90} width={60} height={10} rx={5} fill="#7a4a24" transform="rotate(-12 60 95)" />
    </Svg>
  );
}
