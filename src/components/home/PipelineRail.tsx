import { C } from '@/lib/design/tokens';
import { Belt } from '@/components/learn/OrionMark';

/**
 * PipelineRail — the three beats of the product as ONE visual sentence:
 * three glyph stations on a hairline rail. This replaced the hero's three
 * text pills (reviewer round 66: "a single visual, not text pills… let it
 * live below the fold — it's explaining the product when the hero should
 * be selling the feeling"). The hero now sells; this explains, quietly,
 * right above the guide.
 *
 * No pill borders, no filled chips — glyph circles on the line, a short
 * plain-language note under each title. Mobile stacks the stations
 * vertically (the rail hides); sm+ lays them out horizontally.
 */

function SparkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 2.5 14.2 9.8 21.5 12 14.2 14.2 12 21.5 9.8 14.2 2.5 12 9.8 9.8Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CubeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 2.5 21 7.5 V16.5 L12 21.5 3 16.5 V7.5 Z M12 21.5 V12 M3 7.5 12 12 21 7.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Connector() {
  return (
    <span className="relative hidden h-px min-w-7 flex-1 items-center sm:flex" aria-hidden="true">
      <span className="h-px w-full" style={{ background: C.bandLine }} />
      <span
        className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 text-[10px] leading-none"
        style={{ color: C.inkFaint, background: C.canvas, padding: '0 4px' }}
      >
        ›
      </span>
    </span>
  );
}

function Station({
  icon,
  title,
  note,
  align,
}: {
  icon: React.ReactNode;
  title: string;
  note: string;
  align: 'start' | 'center' | 'end';
}) {
  const justify = align === 'center' ? 'sm:justify-center' : align === 'end' ? 'sm:justify-end' : '';
  return (
    <div className={`flex items-center gap-3 ${justify}`}>
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border"
        style={{ borderColor: C.bandLine, background: C.paper, color: C.ink }}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span
          className="block font-mono text-[9.5px] font-bold tracking-[0.14em]"
          style={{ color: C.ink }}
        >
          {title}
        </span>
        <span className="mt-0.5 block text-[11.5px] leading-snug" style={{ color: C.inkFaint }}>
          {note}
        </span>
      </span>
    </div>
  );
}

export function PipelineRail() {
  return (
    <div className="mt-14 sm:mt-20" aria-label="How Flowsheet works">
      <div className="flex flex-col gap-5 sm:grid sm:grid-cols-[1fr_auto_1fr_auto_1fr] sm:items-center sm:gap-x-4">
        <Station
          icon={<SparkIcon />}
          title="BUILT BY AI"
          note="agents plan, place and solve every unit"
          align="start"
        />
        <Connector />
        <Station
          icon={<Belt color={C.ink} size={17} />}
          title="TAUGHT BY ORION"
          note="guided tours in his own voice"
          align="center"
        />
        <Connector />
        <Station
          icon={<CubeIcon />}
          title="EXPLORED IN 3D"
          note="every unit opens for inspection"
          align="end"
        />
      </div>
    </div>
  );
}
