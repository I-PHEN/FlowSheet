import { NextRequest, NextResponse } from 'next/server';
import { baseCase, run } from '@/lib/engine';
import type { PlantSpec } from '@/lib/engine/plant';

/**
 * POST /api/solve — server-side mirror of the client solver.
 * Accepts a partial PlantSpec (merged over the base case) and returns the
 * full PlantResult. Used by future LLM/scenario tooling; the workbench UI
 * solves in-process for zero-latency interaction.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<PlantSpec> | null;
    const spec: PlantSpec = body ? { ...baseCase(), ...body } : baseCase();
    for (const [k, v] of Object.entries(spec)) {
      if (typeof v === 'number' && !Number.isFinite(v)) {
        return NextResponse.json({ error: `non-finite value for ${k}` }, { status: 400 });
      }
    }
    if (!Array.isArray(spec.bedApproach) || spec.bedApproach.length !== 3) {
      return NextResponse.json({ error: 'bedApproach must have 3 entries' }, { status: 400 });
    }
    const result = run(spec);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

export async function GET() {
  const result = run(baseCase());
  return NextResponse.json(result);
}
