'use client';

/**
 * OrionMark — the guide's identity, drawn once and reused everywhere his
 * name appears: the CinemaBar nameplate, the tour index, the launch copy.
 *
 * The mark is Orion's Belt — three stars in a rising line (Alnitak,
 * Alnilam, Mintaka) — set as a solid nameplate in his signature green
 * (the ammonia hue, the plant's own product color). No animation, no
 * glow: the belt + the letterspaced name IS the identity. On the first
 * stop of every tour — where his voice introduces him by name — the
 * plate expands to "ORION · YOUR GUIDE", so the plate and the voice
 * make the introduction together.
 */

import { C } from '@/lib/design/tokens';

/** one four-point star (a sparkle): concave diamond */
function star(cx: number, cy: number, r: number): string {
  return `M${cx} ${cy - r}Q${cx} ${cy} ${cx + r} ${cy}Q${cx} ${cy} ${cx} ${cy + r}Q${cx} ${cy} ${cx - r} ${cy}Q${cx} ${cy} ${cx} ${cy - r}Z`;
}

/** the Belt — three stars rising to the right, the middle one brightest */
export function Belt({ color, size = 13 }: { color: string; size?: number }) {
  return (
    <svg
      width={size}
      height={(size * 8) / 22}
      viewBox="0 0 22 8"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
      style={{ display: 'block' }}
    >
      <path
        d={`${star(3.5, 5.9, 1.55)} ${star(11, 3.5, 1.9)} ${star(18.5, 1.6, 1.55)}`}
        fill={color}
      />
    </svg>
  );
}

/**
 * The nameplate. `guide` widens it to "ORION · YOUR GUIDE" — pass it on
 * the first stop of a tour, where the voice introduces him by name.
 */
export function OrionPlate({ guide = false }: { guide?: boolean }) {
  return (
    <span
      className="flex items-center gap-1.5 rounded-md px-2 py-1"
      style={{ background: C.nh3 }}
      title="Orion — your guide. Thirty years on the catwalks; he has run every plant in this simulator."
    >
      <Belt color={C.paper} />
      <span
        className="font-mono text-[9px] font-extrabold tracking-[0.14em]"
        style={{ color: C.paper }}
      >
        ORION{guide ? ' · YOUR GUIDE' : ''}
      </span>
    </span>
  );
}
