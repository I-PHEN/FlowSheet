# FlowSheet — AI-native Process Simulator

An interactive chemical-process platform: draw flowsheets, run the plant, hear it explained, and inspect the equipment in 3D. Built as a teaching and demonstration tool for chemical engineering plants — starting with the ammonia synthesis loop.

## What's inside

### Plants & flowsheets
- **Reference plant** — the ammonia synthesis loop, with converter beds, heat exchangers, separators and compressors, laid out on a proper engineering drawing sheet
- **Flash drum** — a miniature NH3 separator teaching Peng–Robinson VLE
- **Distillation column** — staged separation with its own guided tour
- Interactive SVG diagrams: stream labels, equipment masks, zone rules, title block — every plant (prebuilt, AI-built or saved project) draws on **one coherent sheet**

### AI Plant Builder
- Describe a plant in plain language — the agent plans it and lays the units out on the sheet
- Pipeline: `blueprint → catalog → orchestrator` (`src/lib/agent/`)
- **Grid router** (`src/lib/flowsheet/route.ts`): collision-free stream routing — lines and labels can never overlap a unit box, whatever the agent builds
- Saved projects persist through Prisma + SQLite

### 3D Component Viewer
- Full-screen orbit viewer at `/plant/[plant]/3d/[unit]` (React Three Fiber)
- **Procedural shell-and-tube heat exchanger** modeled after the real training unit: bolted channel bonnet with bolt circle, welded dished rear head, green shell-side + red tube-side nozzles, twin saddles, instanced ~150-tube bundle, segmental baffles, tubesheets
- **ASSEMBLED / CUTAWAY** toggle — the cutaway sections the shell to expose bundle, baffles and tubesheets, mirroring the sectioned twin of the training unit
- Models self-position after load, so equipment always rests on the ground grid
- Theme-aware canvas (light/dark), mobile-friendly

### Guided tours with voice & music
- TTS voice narration with ambient music (ducking at 0.30 while narrating)
- VOICE / MUSIC toggles, replay, honest status when audio is unavailable

### Solve API
- `POST /api/solve` — server-side mirror of the client process solver (accepts a partial spec, returns the full plant result)

## Tech stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · shadcn/ui · Radix · Prisma + SQLite · React Three Fiber / drei · z-ai-web-dev-sdk (LLM + TTS) · dnd-kit

## Getting started

```bash
bun install                # or npm install
cp .env.example .env       # point DATABASE_URL at your SQLite file
bunx prisma db push        # create/sync the database
bun run dev                # http://localhost:3000
```

## Project structure

```
src/app/          App Router pages + API routes (plants, builder, 3D viewer, solve, tts, agent)
src/components/   UI, flowsheet canvas, three.js models, workspace, tours
src/lib/          plant content, flowsheet engine + layout, agent pipeline, audio, 3D registry
prisma/           database schema
db/               SQLite database
research/         design research notes (landscape, tech stack, ammonia engineering, interactivity)
scripts/          utility scripts (CAD/GLB pipeline, probes, tests)
worklog.md        full development log with verification records
```

## Extending the 3D model registry

`src/lib/three/registry.ts` maps equipment kinds to models. The shell-and-tube exchanger is built procedurally in `src/components/three/models/ShellAndTube.tsx` after photos of the real training unit (CAD reference assets live under `upload/hx/`). To model another unit — reformer, converter, column — add a component and a registry entry; the viewer, routing and ground-positioning come for free.

## Notes

- `.env` is never committed (see `.env.example`)
- `worklog.md` keeps the full task-by-task development record, including before/after verification of the 3D fixes
