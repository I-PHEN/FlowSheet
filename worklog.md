# Worklog — Ammonia Plant Builder Agent: Research & Enhancement Plan

---
Task ID: 0
Agent: main (Super Z)
Task: Read uploaded plan PDF, clarify requirements with user

Work Log:
- Extracted /home/z/my-project/upload/ammonia_plant_agent_plan.pdf (4 pages)
- Plan: ammonia plant builder agent — deterministic Python unit-op engine (9 unit ops, sequential-modular solver, Wegstein recycle convergence) + LLM for intake/narration/what-if loop + TTS voice + 3D render. Staged MVP→v5 roadmap.
- User requirements: comprehensive pre-build research, PDF report ~25pg, builder-focused, live web research with citations, all four focus areas (plan critique, interactivity edges, landscape scan, tech stack picks), correlation table + risk register + roadmap v2 with effort estimates. No code deliverable.

Stage Summary:
- Research phase begins: 4 parallel agents (landscape, tech stack, ammonia engineering, interactivity frontier)

---
Task ID: 2-d
Agent: general-purpose (interactivity research)
Task: Interactivity frontier — voice AI, 3D web, gamified training

Work Log:
- Ran 27 web searches across 5 areas (voice AI stacks/pricing, 3D web perf & flow animation, P&ID libraries, OTS/serious games, PhET/explorables, latency perception). Hit web_search rate limits mid-run; paced remaining queries with 45–150s cooldowns.
- Voice: OpenAI Realtime TTFB ~500ms, e2e 500–800ms; pricing fell $0.06/$0.24 per min (in/out, Oct-2024) → ~$0.04/min effective (2025, caching); barge-in over-aggressive on filler words (documented). Alternatives benchmarked: LiveKit Agents (OSS self-host), Pipecat (OSS; 24-token first-segment chunking), Vapi ($0.05/min platform fee), Retell (~$0.07–0.25/min), Nova Sonic (~$0.015/min, lowest cost). STT→LLM→TTS: naive 1.3–2s; optimized 400–520ms with sentence-chunked streaming TTS. Web Speech API = free tier, browser-support quirks (Brave/iOS-PWA/Chrome 139 on-device shift).
- Latency perception: 0.1s/1s/10s Nielsen thresholds; voice natural <600ms TTFB, human turn gap 200–300ms; median production voice AI 1.4–1.7s.
- 3D: draw-call budget rule (<100 = 60fps, >500 struggles); Three.js 2–6s load vs Unity WebGL 8–30s; WebGPU in all major browsers since Nov 2025. Flow animation: UV-scroll shader on TubeGeometry (best), SVG stroke-dashoffset for PFD, particles for hero streams. React Flow (free) = live stream labels; JointJS+ $3,490/dev has official P&ID demo; GoJS $3.5–12k/team. P&ID↔3D sync: enterprise-only (AVEVA P&ID 3D Integrator) — no web precedent found → white space.
- Gamification: OTS market $2.4–12.4B (2024, scope-dependent), refinery OTS ≈ $3M example; GSE Jade instructor station (initial conditions, malfunctions, component failures, self-paced startup); GSE+Nuclearn (2026) AI-authored scenarios from natural language — validates student's LLM+sim pattern. Serious-game evidence: Díaz 2024 (ChemE, active learning), SERGE risk-management gains, Tene 2025 STEM review. Steady-state fault injection: fouling/deactivation/efficiency/feed-drift/dP = legitimate parameter re-solve; trips/startup/surge/scoring-on-response-time need dynamics; bridge = quasi-steady game-tick stepping + inventory integrators. Precedent: Annenberg "Control a Haber-Bosch Plant" interactive (Flash-era, no 3D/voice/LLM) → student's app novel.
- Adjacent: PhET principles (immediate feedback, visible abstractions, inquiry); Victor/Nicky Case explorables (play-first, one-step interactions, keep old state visible); AI-copilot-for-CAD pattern (Siemens NX, MIT CAD agent) = LLM tool-calls into deterministic engine.
- Compiled findings + 15-rung INTERACTIVITY LADDER (wow÷effort) into research/2d_interactivity.md.

Stage Summary:
- Artifact: /home/z/my-project/research/2d_interactivity.md — 5 research areas with sources/numbers + ranked interactivity ladder with effort/risk per rung.
- Key recommendations: stage voice as sentence-chunked TTS narration → push-to-talk what-if → Realtime full-duplex; build tag-registry (engine↔PFD↔3D) early since P&ID↔3D sync is an uncontested differentiator; fault mode = steady-state parameter faults + quasi-steady ticker, labeled honestly; instructor station + AI-authored briefs = the $100k-OTS-feel tier.

---
Task ID: 2-c
Agent: general-purpose (ammonia engineering research)
Task: Ammonia plant engineering — correlations, operating data, validation sources

Work Log:
- Ran ~40 web searches via z-ai CLI covering: Gillespie-Beattie Kp (+coefficient table), Temkin-Pyzhev/Dyson-Simon kinetics, SMR/WGS equilibrium constants & conditions, HTS/LTS, CO2 removal (aMDEA/Benfield), methanation, synthesis-loop design data, compressor polytropic equations, published mass balances, Wegstein/Broyden convergence, energy consumption (SMR vs green).
- Downloaded and fully read primary sources: Flórez-Orrego ECOS 2016 (1000 MTPD SMR unit, full loop tables), EFMA "Booklet No.1 Production of Ammonia" (BAT ranges for all sections), Zečević Processes 2020 (reformer Kp correlations + ATE benchmarks), Cheema & Krewer RSC Adv 2018 (Dyson-Simon activity model), Solmaz/Nadiri 2024 (refitted Temkin constants), IFA/Frisse 2004 (Uhde plant), Sánchez et al. green ammonia, Rice CENG403 design pages.
- NUMERICALLY VERIFIED in Python: (a) Gillespie-Beattie formula+β/I table reproduces classic equilibrium NH3% (450°C/100atm→16.3%, 400°C/200atm→38.2%, 500°C/300atm→26.4%); (b) K_WGS=0.01767·exp(4400/T) matches standard tables (12.2 @400°C, 133 @220°C); (c) K_SR1=1.198e13·exp(−26830/T) reproduces industrial primary-reformer CH4 slip (8.1% dry at 800°C/30bar/S-C 3) — MDPI typo "10^17" disproven.
- Key corrections found: "Temperley" correlation doesn't exist (drop); "Maxwell thesis" unverifiable; 60-70% fractional approach too low (industry 90-95% per bed); Turton/Felder lack ammonia case studies.
- Identified validation stream-table sources: EFMA booklet, Flórez-Orrego (Energy 137:234-250), TAMU Mahmoud 2024 thesis (Table 24 full mass balance), Rice CENG403, Cheema 2018.

Stage Summary:
- Produced research/2c_ammonia_eng.md: per-unit-op modeling approach with concrete equations (G-B Kp w/ β/I table, K_SR1/K_WGS, Dyson-Simon rate + 3 constant sets, polytropic head), operating envelopes (T/P/composition per section), loop numbers (150-200 bar, 14-18% outlet NH3, purge 5-8%, inerts 10-15%, −20°C condensation), convergence strategy (damped DS → bounded Wegstein → Broyden), energy benchmarks (28-29 GJ/t BAT vs ~41 GJ/t global avg vs 10-12 MWh/t green), stream-schema recommendation, ranked VALIDATION SOURCES list, and 7 explicit plan corrections. All numbers source-tagged ([S]/[V]/[D]).

---
Task ID: 2-a
Agent: general-purpose (landscape research)
Task: Landscape scan of process simulators, educational sims, AI engineering tutors

Work Log:
- Ran 24 web searches via z-ai CLI (rate-limited twice; backed off with sleeps): commercial sim pricing (Aspen/AVEVA/UniSim/ChemCAD), open-source (DWSIM, COCO, ASCEND, IDAES, OMChemSim, NeqSim, ThermoPack, OpSim), educational sims & OTS (LearnChemE, learner.org Haber game, GSE/Honeywell/AVEVA/Yokogawa OTS, OTS market reports), AI x engineering education (Khanmigo, ChatGPT-in-ChemE studies, Alkali ProcessMate YC S25, MaximaLabs, ChemCopilot, DWSIM 10 AI Assistant, Text-to-flowsheet RSC 2026, Sketch2Simulation AIChE 2026, IChemE Aspen-copilot webinar Aug 2026), ammonia-specific (IEA Hydrogen Review 2025, green ammonia market, AEA LEAD/certification, workforce-skills reports), digital twins/VR education (Kumar 2021 review cited 218, Galeazzi 2024, Queen's VR plant).
- Key pricing facts: Aspen commercial $30K–$100K+/yr (chemicalengineeringguy.com; Alkali blog "$10k–$100k/yr"); Aspen student promo $100 (worth $2,700, Sep 2023); MaximaLabs free tier + $299/mo team; ProcessModel $1,656/yr/user; refinery OTS $800K–$1.5M/project; OTS market ~$12.4B 2024.
- Critical comparables identified: DWSIM 10 AI Assistant (NL flowsheet building, patron preview); MaximaLabs (browser sim, 60+ unit ops, AI copilot, free tier); Alkali ProcessMate (YC, AI copilot for process design); LearnChemE (320+ free browser sims, same audience); AspenTech V15 AI + IChemE education copilot webinar.
- Verified absences (white space): no voice-native engineering simulator; no free full-flowsheet ammonia teaching sim (learner.org is equilibrium-only); no LLM what-if loop on deterministic engine free for students; no 3D tied to live solve; no student-accessible fault-injection OTS. Simsu & pyCalSSS could not be verified (noted as unverified).
- Wrote structured findings with per-fact citations, WHITE SPACE ANALYSIS (10 bullets) and THREATS & COMPARABLES (6 ranked) to research/2a_landscape.md.

Stage Summary:
- Artifact: /home/z/my-project/research/2a_landscape.md (6 research-question sections + white space + threats, all facts source-tagged with URL/site, inference flagged).
- Bottom line: the engine layer is commoditized (DWSIM/IDAES free; MaximaLabs already ships web+AI for pros), but NOBODY offers a free, voice-narrated, LLM-what-if, ammonia-specific, 3D plant-building teaching tool for students; nearest threats are DWSIM 10 AI Assistant and MaximaLabs (high overlap on mechanics, zero on pedagogy/voice/ammonia story); Aspen is adding AI but remains cost/install-gated. Recommend positioning as "the free OTS-style ammonia trainer with a voice" and partnering with (not competing against) LearnChemE's distribution.

---
Task ID: 2-b
Agent: general-purpose (tech stack research, retry with narrowed scope)
Task: Thermo libraries, TTS engines, LLM structured output — comparison

Work Log:
- Ran 18 web searches via z-ai CLI across 3 domains (thermo libs, TTS engines/pricing, LLM structured output); skipped voice-orchestration and 3D topics (covered by agent 2-d).
- Domain 1 (thermo): Cantera (BSD-3, Gibbs-min equilibrium incl. NH3 packed-bed example w/ Ru mechanism; no real-fluid VLE), CoolProp (MIT; v8.0.0 released ~Dec 2025; pure NH3 EOS to 725K/1000MPa; mixture flashes severely limited — GH #2534, NH3-water unavailable #341; PMC3944605 "cannot handle mixtures"), thermo/Caleb Bell (MIT, PR/SRK+UNIFAC flash, 2016-2025 active), DWSIM (GPL v3, .NET+pythonnet, slow interactive re-solves), iapws/SEUIF97 (IF97 steam), ThermoPack (SINTEF; GitHub edition feature-limited), NeqSim (Java/JPype; SKIP), pyromat (SKIP).
- KEY QUESTION resolved: CoolProp & Cantera CANNOT do NH3-H2-N2-CH4-Ar VLE at -20C/150bar as a general mixture flash. Standard practice = cubic EOS (PR/SRK/Patel-Teja) with BIPs (mines-paris course, PR-vs-PT comparisons, VTPR). Research-grade reference EOS exists for exactly NH3+Ar/CH4/H2/N2/CO (Herrmann, FPE 2020). => Use `thermo` PR flash for condenser; CoolProp for pure fluids + IF97 steam.
- Domain 2 (TTS): Piper (MIT code; voice models dataset-licensed, some non-commercial; ~700ms/10s CPU; "fastest but most robotic"), Kokoro-82M (Apache 2.0; ~200x RT CPU; quality > Piper; no cloning; dataset-provenance caveats), OpenAI gpt-4o-mini-tts ($0.60/1M in + $12/1M audio-out tokens = ~$0.015/min; voice-instructions persona steering; tts-1 $15/1M, hd $30/1M), ElevenLabs (v2/v3 $100/1M chars, Flash/Turbo $50/1M; Flash v2.5 75ms TTFB, 32 langs; free ~10k credits/mo; cloning paid), Azure ($15-16/1M neural, $22-30/1M HD; FREE 500k chars/mo F0; SSML explanatory styles), Google ($4-16/1M; free 4M standard/mo), Polly ($16-19.2/1M; free tier replaced by $200 credits Jul 15 2025), Cartesia Sonic ($30/1M, sub-100ms), Deepgram Aura-2 ($30/1M, $200 credits).
- Domain 3: OpenAI Structured Outputs (Aug 2024) = constrained decoding, 100% schema adherence vs ~93% function-calling / <40% prompting; Anthropic structured outputs Nov 2025 (schema w/ limitations); Instructor = Pydantic+retry shim, provider-agnostic; outlines & LM Format Enforcer = constrained decoding for local models; arXiv 2501.10868 survey. Hallucination-in-engineering sources: PatSnap (rates in engineering), "numerical hallucination" write-ups, arXiv 2404.00971 (LLM code hallucinations). Safe pattern: strict schema -> Pydantic physical-range validation (bounds from 2-c envelopes) -> deterministic engine computes; LLM narrates only.
- Wrote research/2b_techstack.md: per-tool verdicts (USE/SKIP/CONDITIONAL), pricing table, recommended stack + budget alternatives + semester cost sanity check (~$5-17 total, or $0 with Azure-free/Kokoro).

Stage Summary:
- Artifact: /home/z/my-project/research/2b_techstack.md — 3 domains, 19 tools assessed, per-tool license/pricing/activity/verdict + sources; RECOMMENDED STACK section.
- Recommended: (1) thermo (PR EOS) + CoolProp (pure fluids/IF97) + 2-c's Kp correlations for the engine — all MIT; Cantera optional cross-check; DWSIM validation-only. (2) OpenAI gpt-4o-mini-tts (~$0.015/min, voice-instructions persona) for narration + Azure free 500k chars/mo or ElevenLabs Flash v2.5 (75ms) for conversational; budget = Kokoro self-hosted. (3) OpenAI structured outputs via Instructor + Pydantic range-validation layer; LLM never does arithmetic.
- Decision-changing findings: CoolProp cannot flash NH3 mixtures (thermo/PR fills the gap); Azure perpetual 500k free chars/mo; OpenAI gpt-4o-mini-tts is ~$0.015/min with persona steering; structured-output reliability is 100% at format level but value-level validation still required (Pydantic bounds).

---
Task ID: 3
Agent: main (Super Z)
Task: Synthesize research and generate the final PDF deliverable

Work Log:
- Read all 4 research files (2a landscape, 2b tech stack, 2c ammonia engineering, 2d interactivity) and synthesized into 9-chapter document plan
- Loaded pdf skill report brief + fonts, palette, cover, charts, overflow, pagination, typography, fill-engine, geometry, cover-backgrounds specs
- Generated cascade palette (intent=cold, seed=42, steel-blue family)
- Generated 5 matplotlib charts (equilibrium curves w/ approach correction, voice latency, TTS prices, interactivity ladder, roadmap timeline) per charts.md rules
- Built 30-page body via ReportLab (TocDocTemplate + multiBuild, roman/arabic page numbering with body-start marker, 20+ palette-styled tables, callouts, code blocks, chart embeds); fixed em-dash line-start issues via non-breaking glue
- Built Template 01 HUD cover (HTML -> cover_validate.js pass -> html2poster.js @794px); fixed one title text-overlap flagged by validator
- Merged cover + body via pypdf with exact A4 normalization (fixed sub-point page-size drift)
- QA chain: code.sanitize, meta.brand, font.check (0 issues), toc.check (pass), pages.clean (0 blank), pdf_qa.py (11 passed, 0 errors), VLM visual review of 12 pages (NO DEFECTS FOUND)

Stage Summary:
- Deliverable: /home/z/my-project/download/Ammonia_Plant_Builder_Agent_Research_and_Enhancement_Plan.pdf (31 pages, ~805 KB)
- Supporting: download/cover_source.html (editable cover source)
- Research artifacts: research/2a_landscape.md, research/2b_techstack.md, research/2c_ammonia_eng.md, research/2d_interactivity.md
- Key findings baked in: 5 must-fix corrections (approach 90-95%, thermo library for VLE, 2-zone secondary reformer, Ar species, real validation sources), verified Gillespie-Beattie table, 15-rung interactivity ladder, full stack picks, 15-risk register, 27-week roadmap v2

---
Task ID: 4 (build phases 1+2)
Agent: main (Super Z)
Task: Build Phase 1 (deterministic engine core) and Phase 2 (PFD workbench UI) of the ammonia plant builder, per the phased stage-gate plan agreed with the user.

Work Log:
- Initialized fullstack env (Next.js 16 + React 19 + Tailwind 4 + shadcn, bun runtime).
- Decision (communicated to user): engine in TypeScript in-process instead of Python — identical verified math (PR EOS + research correlations), but sub-100ms re-solve enables live slider-drag interaction, the core product differentiator. Python/thermo/DWSIM remain the offline validation oracle.
- Engine (src/lib/engine/): species.ts (9 species, SVA props, Cp fits, atom matrix), thermo.ts (ideal-gas enthalpy w/ ΔHf), pr.ts (PR EOS fugacity + residual enthalpy), flash.ts (Rachford-Rice PT flash), reactions.ts (Gillespie-Beattie w/ β-I table, K_SR1, K_WGS, nested-bisection SMR+WGS solver, dedicated methanator solver, NH3 bed solver w/ dissociation), units.ts (19 unit ops incl. dual-zone secondary reformer, 3-bed converter w/ fractional approach, polytropic compressor train, isenthalpic product letdown), plant.ts (spec + base case + front-end sequential pass + air secant controller for H2/N2=3 + synthesis loop tear solved by damped-DS×4 → Broyden with trust region + atom-scaled convergence residual).
- Bugs found & fixed via the test gate: ln(Z) instead of ln(Z−B) in PR fugacity; enthalpyRate /1000 unit error (all duties 1000× small); methanator equilibrium unreachable via signed SMR extents (inner WGS pins CO) — rewrote as dedicated methanation reaction solver; isothermal letdown flash unphysical — replaced with isenthalpic (self-refrigerating) flash; convergence metric hid trace-species mismatch (Ar balance) — atom-flow-scaled residual; Wegstein linear tail (111 iters) — replaced with Broyden (17 iters).
- Validation suite scripts/engine-tests.ts: 61 checks — G-B equilibrium table (10 anchors), K_WGS/K_SR1 anchors, PR NH3 Psat + latent heat, loop-gas flash, KO flash, base-case KPI envelopes vs EFMA/Flórez-Orrego/Rice ranges, front-end spot checks (CH4 slip, CO, ppm), element balance closure < 1e-6, physical monotonicity probes (8), determinism, 60-spec robustness fuzz. ALL GREEN.
- Base case: 796 t/d NH3, 99.24 wt% purity, 28.6% per-pass, 6.9% inerts, H2/N2 3.10, 65 MW reformer, 33.4 GJ/t (partial scope), 17 iterations, ~55-90 ms solve.
- UI (src/components/workbench/ + src/lib/workbench/layout.ts): dark control-room theme (no gradients/emoji/AI-slop), hand-drawn SVG PFD (19 unit symbols, 27 stream polylines, pan/zoom, hover tooltips w/ composition, click-select, subtle flow animation), inspector (plant overview + per-unit specs, 25 spec fields w/ engineering sliders + clamps), bottom tabs (stream table wet/dry, solver console w/ Broyden trace, element balance), top KPI bar, /api/solve route mirror.
- Browser verification (agent-browser): 0 errors after fixing hydration mismatch (solveMs SSR) via useSyncExternalStore; live re-solve verified (loopP 150→200 bar → per-pass 28.6→30.3%); unit/stream selection, tabs, reset, mobile stacking all verified; VLM visual reviews clean; lint clean.

Stage Summary:
- Phase 1 GATE: PASSED (61/61). Phase 2 GATE: PASSED (lint + browser E2E).
- Deliverable: runnable Next.js workbench at / (preview panel), engine library, test suite (bun scripts/engine-tests.ts).
- Key artifacts: src/lib/engine/* (9 modules), src/components/workbench/* (4), scripts/engine-tests.ts, scripts/diag-convergence.ts.
- Next phases (not started): P3 analysis suite (sensitivity sweeps, scenario compare, Prisma persistence), P4 LLM copilot (NL→spec with validation, z-ai sdk), P5 voice (TTS walkthroughs), P6 3D view (R3F), P7 ops game (fault injection).

---
Task ID: 5
Agent: main (Super Z)
Task: Post-build UI critique + product re-plan (user feedback: flowsheet sucks, too much info, strictly educational, Google Flow-style project home, 3D only for 1-2 units). NO BUILD — planning discussion only.

Work Log:
- VLM-analyzed user's 3 Google Flow reference screenshots (landing w/ hero + single CTA; project card grid w/ thumbnails + titles/dates; workspace = calm canvas + right agent panel w/ suggestion chips).
- VLM-analyzed current workbench screenshot: diagnosed (1) gray-on-gray flowsheet = near-zero contrast ghost, (2) small ambiguous symbols, (3) NO equipment tags or stream numbers on canvas, (4) spaghetti line routing, (5) everything-at-once layout (KPI bar + legend + dense panel + tabs) overwhelms new users.
- Product reframe: plants-as-projects library home; 2D flowsheet as the hero (textbook-grade rebuild); 3D demoted to 1-2 hero units; AI repositioned to "+ New plant" builder entry + right-side tutor panel (Flow screen-3 pattern).
- Engine (Phase 1, 61/61) preserved untouched; old workbench panels re-housed behind Operate mode.
- Proposed phase sequence: A flowsheet design language → B library+shell (Explore mode) → C wire engine (Operate) → D AI plant builder → E 3D hero units → F educational layer (tours, tutor; voice later).
- Submitted re-plan + 8 decision questions to user (audience, canvas theme, data-on-canvas default, library size, new-plant UX, mode split, tutor panel placement, 3D unit picks).

Stage Summary:
- Planning turn only; no code changed. Awaiting user decisions before Phase A starts.

DECISIONS LOCKED (user, via question round):
1. Audience: BOTH ChE students + self-learners → dual-layer content per unit (plain-language + technical depth)
2. Canvas: soft warm-gray studio (light, textbook-legible, softer ink — not paper-white, not dark)
3. Default canvas data: equipment tags + stream numbers only; values on hover/click
4. Library at first release: ONE reference plant (1,000 t/d SMR), done deep
5. '+ New plant': hybrid wizard (structured steps + AI chat alongside, form always visible)
6. Modes: Explore / Operate (+ Analyze later)
7. AI tutor: persistent right agent panel w/ suggestion chips (Flow screen-3 pattern)
8. 3D hero units: converter + primary reformer furnace
- Phase A spec issued (design tokens, 19-symbol SVG set w/ tags, hand-authored textbook layout w/ section bands + lane discipline, hover/click interactions, dual-layer panel content for 19 units, 7-point acceptance gate incl. 30-second test + silhouette ID test + ≥7:1 contrast).
- Tutor panel shells in Phase B: suggestion chips wired to deterministic authored tours (no LLM needed); free-form AI Q&A + voice deferred to Phase F.
- Old dark workbench: keep at /legacy for engine debugging through Phase C, then remove.

---
Task ID: 6 (build phases A+B)
Agent: main (Super Z)
Task: Build Phase A (flowsheet craft) + Phase B (library home + workspace shell) — the clean, project-structured, educational interface. Engine untouched.

Work Log:
- Design tokens (src/lib/design/tokens.ts): soft warm-gray studio (#F1F0ED canvas, #26282B ink ≈12.9:1, paper equipment fill, 4 muted service hues: feed ochre / process-gas steel blue / NH3 green / dashed utilities gray).
- New hand-authored layout (src/lib/flowsheet/layout.ts): 1800×880 world, 3 narrative section bands (FEED & REFORMING → SHIFT & PURIFICATION → SYNTHESIS LOOP & COMPRESSION), 19 units with real equipment tags (M-101…K-102), 27 streams re-routed with lane discipline (synthesis loop drawn as literal closed circuit w/ long return line S23), margin annotations. Topology mirrors engine ids exactly.
- Symbol library (src/components/flowsheet/Symbols.tsx): 11 distinct silhouettes (furnace w/ tubes+flames+stack, dual-zone secondary w/ cone+air nozzle, 3-bed converter w/ quench stubs, hatched reactors/columns, drums w/ boots, compressor cone, mixer/splitter wedges) on paper fill.
- Diagram (pure SVG, server-safe) + interactive Canvas: pan/drag, wheel zoom (letterbox-correct cursor→world), pinch, keyboard (+/-/arrows/f), animated panTo (used by tours), hover tooltips fed by live base-case solve, stream dimming on selection, legend + zoom overlays, first-visit hint.
- Educational content (src/lib/content/units.ts): 19 units × dual-layer (What it does / How it works / Why it matters, ~150-200 words each, ranges from EFMA/Flórez-Orrego), 3 deterministic tours (13-step walkthrough, 9-step hydrogen-atom journey, 6-step why-a-loop) + colors answer card.
- Workspace (src/app/plant/reference): top bar (back, title, Explore|Operate switch — Operate disabled honestly until Phase C, Learn toggle, Console link), right panel swapping detail ↔ tour ↔ tutor, mobile bottom sheet.
- Library home (src/app/page.tsx): minimal project grid — reference plant card with REAL mini-flowsheet thumbnail (static Diagram render) + honest "+ New plant" coming-soon card + validation footnote.
- Legacy: old dark workbench recovered from git → /legacy (unmodified).
- Bugs found & fixed: (1) container empty-click handler matched unit hit-rects by tagName → wiped selections immediately; replaced with dedicated click-catcher background rect. (2) boxToAspect shorthand property TS error. (3) react-hooks/refs violations (ref mirror during render, ref read in render for tooltip clamp) → effect-synced mirror + handler-side clamp. (4) 'PROCESS STEAM' annotation collided with M-101 name label → shortened to 'STEAM'. (5) Engine type lie: 'broyden' missing from SolverTraceRow method union. (6) Stale page metadata retitled 'Ammonia Plant Lab'.

Stage Summary:
- GATE A+B: PASSED. VLM visual reviews: home 9/10 (clean, uncluttered, thumbnail legible), workspace 9.5/10 (dark-on-light contrast "excellent", tags + pills legible, bands readable, loop reads as closed circuit). Interactions verified in browser: stream hover tooltip w/ real engine numbers (S04: 805°C/30bar/5361 kmol/h + composition), unit click → dual-layer panel (reformer duty 64.9 MW matches base case), stream click → composition bars (S24 NH3 99.3%), 13-step tour with animated camera + halos, FIT, mobile 390px clean (top bar fits, bottom sheet works), legacy intact & converged. Lint clean, tsc clean, production build green (all routes static), engine gate still 61/61.
- Key artifacts: src/lib/design/tokens.ts, src/lib/flowsheet/{layout,geom}.ts, src/lib/content/units.ts, src/components/flowsheet/{Symbols,Diagram,Canvas}.tsx, src/components/workspace/{Workspace,DetailPanel,TutorPanel}.tsx, src/app/page.tsx, src/app/plant/reference/page.tsx, src/app/legacy/page.tsx.
- Next: Phase C — wire live solving into the new skin (Operate mode: spec sliders + live re-solve + stream table in the clean theme), then D (AI builder wizard), E (3D converter+reformer), F (tutor Q&A/voice).

---
Task ID: 7
Agent: main (Super Z)
Task: Delete the legacy console entirely (route, components, code) and implement dark mode for the clean educational interface. Engine untouched.

Work Log:
- DELETED: src/app/legacy/page.tsx, src/components/workbench/ (TopBar, PfdCanvas, Inspector, BottomPanel), src/lib/workbench/layout.ts, the entire .wb* / .st-* CSS block in globals.css, and both "Console" links (home header, workspace top bar). /legacy now 404 (browser-verified).
- Token refactor for theming: tokens.ts now emits CSS variable references (var(--fs-*)); globals.css defines the full light palette (:root, byte-identical to the previous hardcoded values) and a new dark palette (.dark): canvas #1F1E1C, paper #2A2926, ink #EDEBE6 (~14:1), inkSoft #A9A79F, service hues brightened (feed #C9A66B, gas #8FB2CF, nh3 #85BD9A, utility #96999E), + paperA95 / tipShadow / cardShadow / warn tokens.
- Key mechanism: SVG presentation attributes cannot resolve var(), so ALL color usage in Diagram.tsx / Symbols.tsx was converted from fill=/stroke= attributes to inline style props (style objects carry stroke, strokeWidth, fill, linejoin). Diagram stays server-renderable (home thumbnail) AND theme-reactive. Symbols' stroke()/thin helpers now return CSSProperties.
- Hardcoded hexes eliminated: 12× hover:bg-[#E9E7E1] -> .hover-band utility class; tooltip rgba shadow -> C.tipShadow; legend C.paper+'F2' concat -> C.paperA95 var; DetailPanel warn '#8A5A2B' -> C.warn; home card hover shadow -> .card-lift; root layout hardcoded dark body removed.
- Theme infra: next-themes (already installed) via src/app/providers.tsx (attribute="class", defaultTheme light, enableSystem); new src/components/ThemeToggle.tsx in home header + workspace top bar. Toggle icon/label read the APPLIED theme from the <html> class via useSyncExternalStore + MutationObserver (source of truth = the same class the CSS keys off, so the label can never desync; also satisfies react-hooks/set-state-in-effect lint rule). Persistence verified across reloads.
- BUGS found & fixed during verify: (1) Turbopack served a stale CSS chunk after the globals.css rewrite (JS fresh, CSS still contained deleted .wb rules) — fixed by rm -rf .next/cache + reload; if theme vars ever resolve empty in dev, flush the cache. (2) First ThemeToggle used resolvedTheme from context — observed one desynced label state; replaced with DOM-class observer. (3) react-hooks/set-state-in-effect on the mounted-guard pattern — replaced with useSyncExternalStore hydration probe, then removed entirely in the DOM-observer rewrite.
- VERIFIED in browser: light home + dark home; dark workspace (bands #262523, labels #A9A79F, stream strokes in dark service hues, diagram bg #1F1E1C — all via computed styles); hover tooltip w/ live engine numbers (S01: 40C/32bar/1000 kmol/h/CH4 100%); unit click (Primary reformer panel, 64.9 MW base case, dual-layer sections); 13-step tour with dark halo #37352E; /legacy 404; mobile 390px dark; dark->light round-trip + persistence; lint clean; tsc clean (src).
- VLM reviews: dark home 8.5/10, dark workspace 9/10 ("avoided the gray-on-gray trap", "production-ready"); tooltip 9/10; unit panel 8/10; tour 8/10; mobile 7/10; light regression 9/10 (unchanged design). Flagged nits are pre-existing Phase B traits (mobile title truncation, small close-button touch target) — parked for the polish backlog.

Stage Summary:
- GATE: PASSED. Console fully removed from code; dark mode shipped as a first-class theme ("dark studio textbook" — same grammar, high contrast, no gray-on-gray).
- Key artifacts: src/lib/design/tokens.ts (var-based), src/app/globals.css (both palettes + .hover-band/.card-lift), src/app/providers.tsx, src/components/ThemeToggle.tsx; refactored Diagram/Symbols/Canvas/Workspace/page/DetailPanel/TutorPanel.
- Engine gate still 61/61 (untouched). api/solve kept (reserved for Phase D LLM tooling).
- Next: Phase C — Operate mode in the clean skin (spec controls + live re-solve + stream table), per the locked re-plan.

---
Task ID: 8 (Phase C · minimal)
Agent: main (Super Z)
Task: Build Phase C — minimal Operate mode. User directive: "let's go minimal for now, focusing only on the important stuff." Three live levers + reset + KPI readout; everything else (tooltips, panels) updates from the one live solve. Engine untouched.

Work Log:
- Probed engine: run() = ~36 ms avg (bun), converges across full lever envelope (loopP 80–250, primaryT 700–900, ngFeed 100–3000). Corner warnings are honest (H2/N2 controller residual) — surfaced in panel.
- New src/components/workspace/OperatePanel.tsx: 3 levers — Synthesis loop pressure (R-107 · K-102, 80–250 bar, step 5), Reformer outlet temperature (R-102, 700–900 °C, step 5), Natural gas feed (M-101, 100–3000 kmol/h, step 25). Each: label + equipment tag ref, big mono value, native range slider (token-styled via .op-slider + inline --op-fill gradient), min/max ticks, one-line educational hint. "Plant answer" KPI block: NH3 production (t/d, signed Δ vs design, green/amber), per-pass conversion (Δ pt), product purity, H2/N2 at converter. Footer: converged + loop iterations, warnings, full-width "Reset to design conditions".
- globals.css: .op-slider class (webkit + moz track/thumb from --fs tokens, focus-visible ring on thumb). Track fill = inline linear-gradient via --op-fill so both themes work with one rule.
- Workspace.tsx: mode state ('explore' | 'operate'), spec state (PlantSpec, baseCase init); result = useMemo(run(spec)) — the SAME result object feeds canvas + tooltips + panels, so every value in the app is live. enterOperate clears tour/selection/opens panel; enterExplore resets spec to baseCase (book mode always shows design conditions). Mode switch: both tabs enabled, active = ink pill.
- DetailPanel.tsx: new condLabel prop ("base case" in Explore / "operating point" in Operate) threaded to UnitDetail + StreamDetail section titles.
- Import fix: PlantSpec lives in engine/plant.ts, not types.ts.
- VERIFIED (agent-browser): Operate tab clickable → panel renders at design values (150/805/1,000); loopP → 200 bar re-solves live (KPIs 800.6 t/d +4.9, 33.8 % +5.2 pt, 18 iterations — matches offline engine probe); converter detail panel shows "Live conditions — operating point" w/ per-pass 33.8 %; stream tooltips live (S20 converter feed at 200.0 bar, S22 at 195 bar); Reset → back to 795.7 t/d design, deltas cleared; 240 bar then Explore → TutorHome + plant reset (slider back at 150 on re-entry); dark mode: live KPIs at 210 bar (801 t/d +5.4); console clean; home regression clean; mobile 390px bottom sheet works.
- Gates: tsc clean (src), eslint clean, engine 61/61, production build green (/, /plant/reference static).
- VLM: light operate 9/10, dark operate 9/10 ("no gray-on-gray"), mobile 9/10 (sheet scroll truncation = expected).

Stage Summary:
- GATE: PASSED. Phase C (minimal) shipped: Operate mode is live — 3 real levers, ~36 ms full-plant re-solve, whole canvas answers.
- Key artifacts: src/components/workspace/OperatePanel.tsx, .op-slider CSS, Workspace/DetailPanel edits. Screenshots: scripts/op1–op6.
- Deliberately deferred (kept minimal per user): full spec inspector (25 fields), stream table, Analyze mode, scenario compare.
- Next options: D (AI plant builder wizard on "+ New plant"), or deepen C first (stream table, more levers, preset scenarios like "cold loop / turndown").

---
Task ID: 9 (D1 · Engine 2.0)
Agent: main (Super Z)
Task: D1 — refactor the engine's wiring layer into flowsheet-as-data (graph + registry + executor + auto-tear + validator) behind a hard identity gate. Physics (thermo/pr/flash/reactions/units) untouched. User directive: "go" on the locked D1 plan (free composition, multi-agent, no voice-narration during builds).

Work Log:
- Read plant.ts (967 lines) fully; mapped every stream, unit, metric string, warning, controller, and constant.
- NEW src/lib/engine/graph.ts: FlowGraph data model — units {id, type, specs}, stream edges {id, name, cls, from: unit+port, to: unit+port|null, implicit?}, controllers {manipulate source, measure stream, num/den species, set, auto}.
- NEW src/lib/engine/registry.ts: the ammonia catalog — 22 unit types (3 feed sources + 19 process units), each with typed ports (gas/liquid), spec fields with physical clamps/defaults, and solve() wrappers calling the EXISTING physics verbatim (same calls, same metric formatting). Species hooks: tearInit (loop tear guess), airControllerInit (secant bracket). feed-preheater declares fixedOutlet (outlet T/P pure spec) — the property the tear selection keys on.
- NEW src/lib/engine/reference.ts: the reference SMR plant as data (unit ids match UI layout: M1..C2 + SRC_NG/SRC_ST/SRC_AIR; 28 edges incl. S24S self-loop + implicit letdown-vapor line IF1) + applyPlantSpec (the one table mapping flat PlantSpec knobs onto unit specs) + buildGraph.
- NEW src/lib/engine/converge.ts: solveLinear9, solveSecant (air controller secant, verbatim), solveTearLoop (damped-DS + Broyden with trust region/step-limiting/rank-1/stall-reset, verbatim), makeResid.
- NEW src/lib/engine/executor.ts: executeGraph — Tarjan SCC → tear selection (prefer fixedOutlet edges → lands on S20 converter feed) → controller phase (secant re-runs the front-end scope, best-state snapshot/restore) → Kahn topo walk → tear loop → assembly (streams, units, element balance from source-out/sink-in edges, ammonia KPIs with defensive reads for modified graphs). planTear exported for introspection.
- NEW src/lib/engine/validate.ts: the agent-facing cage — unknown types, duplicate ids, unfed inlets, double-fed inlets, dangling outlets, port phase mismatches, spec ranges, controller refs, reachability, no-sinks, multi-loop + no-tearable-edge detection. All messages plain-English (what D2's agent will read to self-correct).
- plant.ts: run() now = executeGraph(buildGraph(spec)); the original implementation preserved VERBATIM as runLegacy() — the identity oracle (delete in D2 once the gate has baked). frontEndPass/loopPass still exported (tests + oracle).
- NEW scripts/graph-tests.ts: the D1 gate — 19 specs (base, corners, manual air, seeded randoms) comparing run vs runLegacy on EVERY field (streams T/P/n, metric strings + raws, KPIs, balance, exact trace rows, warnings order) at 1e-9/1e-12; + tear detection (SCC = 7 loop units, tear = S20); + 7 validator rejection classes; + a MODIFIED graph (LTS bypassed) that validates, solves, closes its balance, and physically drops production.
- BUGS the identity gate caught (this is why the gate exists): (1) R1 dp 0→1 bar — legacy pressure cascade sets the reformer outlet at P0+0 while its inlet is P0+1; my inlet-relative dp needs 1. (2) makeResid captured scale=total(makeup) outside the closure; legacy recomputes scale=total(b) per call (b = current tear flows) — atom terms masked the difference early/late, flow term exposed it mid-convergence. Both fixed; trace now bit-identical.
- Debug scripts (trace/broyden/gfn isolation) deleted after use.

Stage Summary:
- GATES ALL GREEN: Engine 2.0 gate 35/35 (IDENTITY HOLDS — max numeric diff 0.0 at 1e-12 trace tolerance across the envelope), Phase 1 gate 61/61 (old suite now running THROUGH the graph path), tsc clean, eslint clean, production build green, browser spot-check identical numbers (200 bar → 800.6 t/d +4.9, 33.8% +5.2 pt).
- The flowsheet is now DATA the agent can compose; the validator is the cage; physics untouched.
- Key artifacts: src/lib/engine/{graph,registry,reference,executor,converge,validate}.ts (+7 modules, ~1900 lines), plant.ts run/runLegacy split, scripts/graph-tests.ts (permanent gate, run with engine-tests).
- Next: D2 — agent runtime (multi-agent pipeline over z-ai sdk: Architect/Engineer/Critic/Narrator roles, tools add_unit/connect/set_spec/validate/solve, events streamed to the browser, text only, no voice). Then D3 builder UI (canvas assembles live from events).

---
Task ID: 10 (D2 · Agent Runtime + Builder Interface)
Agent: main (Super Z)
Task: Build the agent itself — the multi-agent plant builder over Engine 2.0's tool surface, streamed live to a builder interface. User directive: "then let's build the agent itself, u know how we said the interface should be right. so yh, let's build it."

Work Log:
- NEW src/lib/agent/protocol.ts: BuildEvent union (phase/message/tool/graph/solve/verdict/done/error), ToolCall/ToolResult, CriticVerdict, ArchitectPlan, EngineerStep, SavedPlant + localStorage library key + preset briefs. Pure types, both sides.
- NEW src/lib/agent/catalog.ts: catalogDigest()/graphDigest()/speciesDigest() derived LIVE from registry (fixed: model(specs) needs resolved defaults, not {}).
- NEW src/lib/agent/workspace.ts: AgentWorkspace — the deterministic tool layer. Tools: add_unit, remove_unit (cascades streams+controllers), connect (endpoint parse "UNIT.port", port-kind check, to:null sinks, implicit flag), disconnect, set_spec (number clamps w/ clamp notes, boolean, number[] elem-clamp + default-length enforcement), add_controller (source+flow validation, species index check), remove_controller, validate (plain-English issues), solve (refuses while issues; executeGraph in try/catch → feedback), read_stream (T/P/flow/wet+dry comp/MW), get_graph. Never throws on malformed input.
- STRENGTHENED engine/validate.ts: new 'duplicate-outlet-stream' check (two streams off one outlet break the executor's state assignment — validator now catches it pre-solve). D1 gate re-run: 35/35 still green.
- NEW src/lib/agent/prompts.ts: Architect/Engineer/Critic role prompts — shared conventions block (KPI id conventions: R1/R2/E2/C1/C2/SP1/SRC_NG + S16/S20/S21/S24/S26/S27), structural rules (one inlet one stream, feed-preheater in loop for tear, separator self-loop + implicit flash line), ammonia primer, JSON action protocol; engineer strategy (batch, defaults-are-reference-values, solve-before-done), results/feedback formatters.
- NEW src/lib/agent/llm.ts: ZaiLlm (lazy ZAI.create, 5 attempts, 429-aware exponential backoff 8s→128s), extractJson (balanced-brace scan, fence strip, string-aware) + TRUNCATED-JSON repair (close dangling braces/strings — max-token cutoff salvage; partial action batches are safe downstream), chatJson with 2 repair turns (2nd asks for minimal object). Injectable Llm interface for tests.
- NEW src/lib/agent/orchestrator.ts: runAgentBuild(brief, {llm, emit}) — Architect (plan JSON, guidance only) → Engineer agentic loop (24 turns, 200 actions, 12/turn caps; done-refusal when never solved or canvas empty, max 2 refusals; conversation tail trimmed to 12 messages to bound token growth; LLM-failure → graceful break KEEPING built state) → forced final validate+solve (deterministic truth) → Critic (verdict; LLM-unavailable → factsVerdict fallback computed from converged/balance/warnings) → done. Top-level catch → error+done events.
- NEW src/app/api/agent/build/route.ts: POST → SSE stream (ReadableStream, `data: {json}\n\n` frames, nodejs runtime, client-disconnect safe).
- NEW scripts/agent-tests.ts (offline gate, no network, mock LLM): A workspace cage (16 checks: rejections, clamps, cascades, phases, arrays), B IDENTITY — scripted engineer rebuilds the reference plant through tools: final graph deep-equals buildGraph(baseCase()) and solve matches run(baseCase()) to 1e-9 (45/48 total), C self-correction (double-fed inlet + duplicate outlet → validator feedback → fixed → solve ok), D JSON extraction incl. truncation repair. 48/48.
- NEW builder UI: src/app/plant/builder/page.tsx (brief composer + presets, SSE consumption via fetch reader + frame parser, phase chips, Build/Stop/New, save-to-library, ?load=slug restore), src/components/builder/BuildCanvas.tsx (BFS-depth auto-layout, band-wrapped at 8 columns, class-colored beziers + pills + arrows + self-loops + sink arrows, unit cards fade in (bd-unit-in keyframes; animation on inner g — CSS transform would clobber SVG transform attr), zoom controls, click → UnitInspector w/ live spec table from registry; fixed: transparent hit rect needed because visuals are pointer-events:none), BuildPanels.tsx (BuildLog transcript w/ auto-scroll + role chips, KpiPanel, VerdictCard), SavedPlants.tsx (home library strip).
- Home page: "+ New plant" placeholder → "Build a plant with the AI agent" card → /plant/builder + SavedPlants strip.
- globals.css: bd-in/bd-pulse keyframes + reduced-motion off.
- LIVE E2E (real z-ai model, 5 rounds, honest failure analysis each round): R1 tiny build 23s pass. R2 14-turn budget exhausted mid-specs → validator caught 3 wiring errors, critic failed honestly. Fixes: 24 turns/200 actions, done-refusal without solve, defaults-are-reference prompt. R3 engineer solved 795.7 t/d but critic 429-killed the session → fixes: 429-aware backoff, critic factsVerdict fallback. R4 turn-7 JSON truncation killed session → fixes: truncated-JSON repair + 2 repair turns + graceful LLM-failure break (keep state). R5 FULL SUCCESS: 22 units, 29 streams, agent-composed ids, converged 17 it, 795.7 t/d, 99.24 wt %, balance 9e-8 → BUILD OK, PASS 85/100 (factsVerdict). Canvas band-wrap bug found via VLM (x never wrapped → 4700-wide) → fixed (1984×1388). Unit click inspector verified (mouse coords), save-to-library → localStorage → home card → ?load restore verified. VLM: band layout 8/10, dark 9/10, final 8.5/10 (builder page got ThemeToggle).
- Gates: agent 48/48, graph 35/35, engine 61/61, tsc clean, eslint clean, production build green (/, /plant/builder static, /api/agent/build dynamic).

Stage Summary:
- GATE: PASSED. D2 shipped: the multi-agent runtime (Architect → Engineer tool-loop → forced solve → Critic) builds working plants from a text brief through Engine 2.0's tool surface; every failure mode degrades honestly (never fake success); the builder page shows the flowsheet assembling live.
- LIVE PROOF: reference brief → 22 units/29 streams → converged → 795.7 t/d @ 99.24 wt % (reference-identical numbers) → PASS 85/100. Offline identity: tool-built graph deep-equals buildGraph(baseCase()).
- Key artifacts: src/lib/agent/{protocol,catalog,workspace,prompts,llm,orchestrator}.ts, src/app/api/agent/build/route.ts, src/app/plant/builder/page.tsx, src/components/builder/{BuildCanvas,BuildPanels,SavedPlants}.tsx, scripts/agent-tests.ts. Screenshots: scripts/bd1-bd15, vlm1-4.json.
- Known limits (honest): live builds are model-dependent — rate limits (429) can interrupt long builds (mitigated: backoff + graceful state-preserving break + fallback verdict); agent sometimes miswires the loop and needs validator-feedback turns; mobile canvas is overview-only (zoom needed); KPIs read reference id conventions (agent is told them).
- Next: D3 polish (resume/continue-build button reusing saved graph as initial state, edit-after-build, stream tooltips on builder canvas), E (mineral species pack), F (3D hero units), G (voice tutor only).

---
Task ID: 11 (D3 · Chat Interface + Stage Parity)
Agent: main (Super Z)
Task: Build the Flow-inspired chat interface for the agent builder — two-zone studio (stage + session chat), per the plan locked with the user ("take inspiration, not copycat"; voice narration is post-build tours only, NOT during builds). Agent/engine/server: ZERO changes.

Work Log:
- Read the user's 3 Google Flow screenshots via VLM (studio paradigm: stage + session panel, suggestion cards, pill composer, collapsible panel). Locked the design split: Flow's paradigm, our engineering-paper identity, no left rail (library IS the home), no dead mic button (voice = post-build tours, phase G).
- NEW src/components/builder/SessionPanel.tsx (~590 lines): the chat. LogEntry model extended (user/solve/verdict kinds carrying structured payloads). deriveBlocks() groups consecutive tool entries into ACTIVITY CLUSTERS (collapsed by default: header "ENGINEER · N actions · N flagged" + last 2 lines + "show all"; expandable, max-h scroll). Message types: user bubble (right, band bg), agent messages (role-colored mono labels: ARCHITECT/ENGINEER/CRITIC), phase separators (hairline + mono), SolveCard (3-col KPI grid + converged chip + warnings), VerdictCard (accent border-l, score, strengths/issues/suggestions), ErrorCard, NoteLine. Empty state: "What would you like to build?" + 3 preset suggestion cards (lucide icons, service hues, card-lift, click fills composer). Composer 3 honest states: idle (autosize textarea, Enter-to-build/Shift+Enter newline, ArrowUp send), running (phase status + Stop), finished (action chips: Zoom in / Save to library / New session + honest "editing mid-conversation arrives next phase" note). Autoscroll pins to bottom unless the reader scrolls up ("↓ latest" jump pill). Session header: brief-derived title, live phase subtitle, collapse chevron.
- BuildCanvas.tsx REWRITTEN (interaction shell only; layout/bezier math kept): full inspection parity with the reference canvas — drag pan, wheel zoom-at-cursor, pinch zoom, keyboard (+/-/f/arrows), FIT, drag-vs-click suppression. View model redesigned for lint + correctness: view state = user frame | null (null = fit); effective view DERIVED each render via clampView against the current layout → a growing build keeps auto-fitting while a user-framed zoom stays clamped (no state-sync effects, React-compiler clean). Stream hover: fat invisible hit paths + widened highlight stroke; tooltips show LIVE VALUES via lazy client-side executeGraph (module-level WeakMap cache per graph snapshot, nulls cached too — never blocks the build, warms via setTimeout 400ms post-build) falling back to structural rows mid-build. Unit hover tooltips (registry name + model). Legend, first-visit hint pill, cursor grab/grabbing. Canvas-fit on done event. Empty state restyled ("THE CANVAS IS WAITING").
- page.tsx reworked into the two-zone studio: header (back/title/counts/phase chip/build-verdict chip/ThemeToggle) + stage (flex-1, floating LIVE FLOWSHEET chip, UnitInspector bottom bar) + session aside (lg:w-[420px]; mobile h-[56dvh] stacked). Collapse states: desktop 52px rail (expand chevron, vertical SESSION label, pulsing phase dot) + mobile floating "Session" pill (raised bottom-16 to clear the legend — VLM-found collision, fixed + verified). onZoomIn = collapse + canvas fit. Restore (?load=) now synthesizes the full chat (user brief → solve card → verdict → loaded note, saved=true). Removed the dashboard brief composer entirely.
- DELETED src/components/builder/BuildPanels.tsx (BuildLog/KpiPanel/VerdictCard superseded by SessionPanel).
- globals.css: bd-msg-in keyframes (260ms settle) + reduced-motion off.
- Gates: tsc clean (src), eslint clean (fixed 2 compiler-lint findings: clampView hoisted to module scope; solve cache moved from useRef to module WeakMap after refs-during-render), engine 61/61, graph identity 35/35, agent 48/48 — ZERO drift, engine/agent untouched.
- LIVE E2E (real z-ai model, browser-verified): preset card → composer fill → send. Architect planned (22 units/30 streams), engineer built with clustered activity, solver CONVERGED 18 it — 410.5 t/d @ 99.3 wt% (Modest plant brief), critic PASS 95/100, action chips appeared. Stream hover tooltip read from DOM: "S01 · Natural gas feed — T 40 °C · P 32.0 bar · Flow 500 kmol/h · CH4 100.0%" (client-side live values). Unit click → M1 Feed mixer spec inspector. Zoom in → rail collapse + fitted flowsheet. Save to library → localStorage record verified. Reload ?load=slug → full chat restored (pass 95/100, Saved ✓). New session → clean reset to composer. Mobile 390px: no horizontal overflow (scrollW=clientW=390), stacked layout, FAB reopen works. Home + /plant/reference regressions pass. No console errors, no page errors, dev.log clean.
- VLM scores: idle light 8.5/10, mid-build 8.5/10, collapsed+fit 9/10, dark finished 9.2/10, mobile stacked 8/10 (canvas compressed at fit on 390px — pinch/buttons zoom available, known limit), mobile collapsed re-shot after FAB fix (overlap:false, fabY 740 vs legendBottom 832).

Stage Summary:
- GATE: PASSED. D3-a + D3-b shipped: the builder is now a chat-native studio — the session tells the build's story (quiet activity clusters, rich solve/verdict cards), the stage inspects like the reference plant (pan/zoom/fit/hover live values/click specs), and the chat shrinks to a rail so the plant gets the attention.
- Key artifacts: src/components/builder/SessionPanel.tsx (new), src/components/builder/BuildCanvas.tsx (rewritten interactions + tooltips), src/app/plant/builder/page.tsx (reworked), globals.css (bd-msg-in), BuildPanels.tsx deleted. Screenshots: scripts/d3-01..d3-10b, vlm-d3-*.json.
- Known limits (honest): no follow-up turns yet (D3-c: session continuity, edits, what-ifs — the next deep build), mobile canvas is overview-first at fit (zoom available), agent reliability unchanged (occasional miswire→validator feedback turns, 429s possible on long builds).
- Next: D3-c conversational continuity (session state + incremental edits over saved graphs), then G voice narration (TTS on tour runner + LLM-authored tours for built plants — the tour engine already exists in the workspace), then E species pack, F 3D hero units.

---
Task ID: 12–16 (RECONSTRUCTED SUMMARY — verbatim entries lost in sandbox rollback, see Task R)
Agent: main (Super Z)
Task: Builder continuity + voice/music layer + flash template (L1 rung of the curriculum ladder)

Work Log (reconstructed from artifacts on disk + session summaries — treat details as approximate):
- Tasks in this window shipped: D3-c session continuity work on the builder; the audio layer — /api/tts route, src/lib/audio/{music,spoken,narration,tourAudio}.ts (spoken-term sanitization for TTS, procedural Web Audio lo-fi bed with ducking-to-0.30 during narration, tour narration wired into the existing TourRunner); the flash-drum template (L1) — src/lib/plants/flash.ts, src/lib/flowsheet/flashLayout.ts, src/lib/content/flash.ts, src/components/flash/, route /plant/flash, Explore/Operate/Learn studio pattern; a Task 14 builder-canvas textbook-mode attempt that was rolled back (src/app/legacy holds the archived pre-generalization ammonia app).
- The old ammonia-only app was archived to src/app/legacy as part of brand generalization prep.

Stage Summary:
- Foundation laid that Tasks 17–21 build on: narrated tours with music ducking, a second curriculum rung slot pattern (plant-as-data), and the app no longer ammonia-only.

---
Task ID: 17
Agent: main (Super Z)
Task: Build the distillation-column template — rung 2 of the curriculum ladder (user-confirmed next step after the voice+music layer landed in Task 16)

Work Log:
- Studied the flash template end-to-end (registry pattern, PlantLayout/PlantContent plumbing, tour data flow) so rung 2 slots in as DATA, not a fork.
- SPECIES EXTENSION (the risky part): appended benzene (C6H6) + toluene (C7H8) at indices 9-10 with Smith/Van Ness Tc-Pc-omega, Shomate-anchored Cp fits, and hf; ATOM_MATRIX rows extended to 11 columns so the executor's element balance closes for hydrocarbons too. Audited and fixed every fixed-length-9 hazard the append would break: tearInit y0 (registry.ts AND legacy plant.ts — NaN would have killed the ammonia loop), AIR_COMP (9-wide → NaN in every air-carrying stream), engine-tests.ts arrays, DetailPanel StreamDetail MW (hardcoded table → SP lookup; NaN for benzene streams), plants/flash.ts mass() (same fix, robustness). Gates re-run GREEN: engine 61/61, graph identity 35/35, agent 48/48, flash-check pass — the species append moved ZERO ammonia numbers.
- COLUMN PHYSICS (engine/units.ts, distillationColumn()): the classic design-verification problem — given xD spec, reflux R, N stages, feed stage, find xB so that stepping exactly N Lewis–Sorel stages lands on the reboiler. Constant alpha from the SAME PR EOS the flash drum uses (evaluated at the feed bubble point via Wilson-initialized fugacity — gives 2.32 for benzene/toluene, textbook); q from PR flash between the saturation points and Cp/latent-heat corrections outside (subcooled q>1, superheated q<0); Rmin from the equilibrium pinch on the q-line (grid-scan + bisection); duties from PR-residual enthalpies with the reboiler closed by overall energy balance (cold feed honestly raises Qr). SOLVER HARDENING (two bugs found by probing): (1) pinched columns (R<Rmin) must not trust the stepping — the forced feed-stage switch can produce a fake solution with negative boilup; now pinched → honest no-split + warning naming Rmin. (2) the original g(hi)>=0 starved test probed a degenerate rich-end band (D→0) — replaced with a lean→rich 48-point grid scan for the first achievable bracket + bisection; high-xD columns (0.995) that were wrongly starved now solve to xB→0, and a mislocated feed gets a specific diagnosis ('Feed tray 8 is too high … until tray 14') instead of a misleading 'add stages'.
- REGISTRY: three teaching types — 'column-feed' (binary spec source), 'feed-heater' (cooler wrapper, sets q), 'distillation-column' (compound unit: McCabe–Thiele solve, distillate+bottoms outlets, 12 metrics incl. Rmin, R/Rmin, Fenske Nmin, feed-tray optimum, duties; honest warnings). TYPE_KIND gains 'dcolumn' → new tall-tower symbol in Symbols.tsx (density-based trays, feed nozzle at 55% height, domed shell) — grammar invariant held (every registry type maps to a silhouette).
- PLANT LAYER (src/lib/plants/distillation.ts): graph (FEED→HEATER→COLUMN, streams S01-S04) + ENRICHMENT — solveDistillation re-runs the deterministic column solve from the solved feed and injects the internal streams S05-S09 (overhead vapor, reflux, condensate, bottoms draw, boilup) and the auxiliaries COND/RDRUM/REB as virtual UnitResults: the sheet draws them, tooltips/detail panels render them with live values, zero executor changes. DistillSpec exposes 8 knobs; distillKpis() the scorecard.
- LAYOUT (distillationLayout.ts): one sheet 1180x740 — F-101 sphere, E-101 preheater, T-101 tower (96x420) center-stage, E-102 condenser + V-101 reflux drum top right, E-103 reboiler bottom right; reflux and boilup loops drawn as real stream edges with pills; title block top-right (bottom-right is occupied by the toluene product run); presentation-level unitStreams match the drawing.
- CONTENT + TOUR: six dual-layer unit entries (FEED/HEATER/COLUMN/COND/RDRUM/REB) and an 8-step tour 'The tower that repeats the flash' ending with the Operate pinch challenge — narration comes free from Task 16's audio layer. SPOKEN FIX: the formula-token regex could not match C6H6 (digit before a letter breaks \b) — rewritten to accept any alphanumeric formula token; spoken gate extended to cover the distillation tour (43 steps, 0 issues) + C6H6 spot-check.
- WORKSPACE + ROUTE: DistillationWorkspace mirrors the flash studio (Explore/Operate/Learn, canvas + panel, mobile sheet); DistillOperatePanel has six levers (reflux R, stages, feed tray, feed temperature, benzene fraction, purity target) with live hints and a 9-row scorecard with deltas; route /plant/distillation. HOME: ladder is now LEVEL 1 flash (START HERE) → LEVEL 2 distillation (INTERMEDIATE) → LEVEL 3 SMR (CAPSTONE), 3-column grid, updated hero copy.
- VERIFICATION (scripts/distill-check.ts, persisted, 48/48): base case xB=3.30%/recovery 95.9%/alpha 2.32/Rmin 1.59/feed tray 8 optimal/Qc 6.54+Qr 6.42 MW, element balance 0; lever physics — R↑ leans xB but costs duty, N=22→xB 0.05%, N=8→39.5%, R<Rmin pinches honestly (no fake split, non-negative internals), wrong feed tray warns + degrades (nf=13→19.27%), cold feed raises Qr (8.0 MW), vapor feed raises Rmin (3.02) and unburdens Qr, 99.5% purity reachable with stages+reflux; stream-sheet integrity (V=(R+1)D, L=R·D, boilup in eq with xB, balance closes with virtual streams); determinism to 1e-12. Browser (agent-browser + VLM): one sheet light AND dark (VLM 9/10, no glitches), tour narrated (AudioContext running, duck exactly 0.30, exactly 2 TTS POSTs — dedupe holds), spotlight pans to T-101 at step 4, Operate live — R=1.2 fires the pinch warning in-page, nf=13 scorecard matches the engine byte-for-byte, S06 hover tooltip shows live reflux (L=414=R·D), REB click opens its detail panel, reset restores the design point; home ladder verified; REGRESSIONS: reference plant still ONE sheet with zones+title block (no 3-box reappearance), flash intact, builder loads, zero console/page errors anywhere; mobile 390px no horizontal overflow; production build green (/plant/distillation static).
- COMMITTED same-session (6700603) per the Task 14 lesson.
- Known leftover (pre-existing, NOT from this diff — verified by stashing): `npx eslint src` reports 6 react-hooks/compiler findings in Canvas.tsx (manual-memoization preservation) and tourAudio.ts (setState-in-effect for localStorage hydration) that exist at HEAD, likely from an eslint-config drift after Tasks 11/16; this task's files are lint-clean. Flagged for a dedicated cleanup task.

Stage Summary:
- The curriculum ladder has its second rung: a benzene-toluene tower that teaches staged separation on the same one-sheet renderer, same PR-EOS physics, same narrated-tour studio UX — with McCabe-Thiele as the visible mental model and reflux/stages/feed-tray as levers you can feel. All surfaces stayed data-driven (PlantLayout/PlantContent/Tour), so rung 3+ plants remain authoring work, not plumbing.
- The species table is now genuinely extensible: benzene/toluene proved the append path (indices stable, balances close, ammonia identity byte-identical).
- Next candidates per the user's standing directives: 3D hero components for each plant's 1-2 key units (flash drum, distillation column T-101, ammonia converter — the data model already isolates the key units per plant), builder-canvas textbook-mode rebuild (lost in the Task 14 rollback), and the Canvas/tourAudio lint cleanup.

---
Task ID: 18
Agent: main (Super Z)
Task: User reported "I can't see the app" — diagnose availability

Work Log:
- Checked processes: next dev (pid 1075) running on :3000 since Sep13, Caddy proxy on :81 healthy
- curl localhost:3000/ → HTTP 200 (117ms); all routes 200 (/, /plant/flash, /plant/distillation, /plant/reference, /plant/builder, /api/tts)
- Opened app in headless browser: title "Ammonia Plant Lab" renders, zero page errors, console clean (HMR connected)
- Accessibility snapshot confirms full homepage UI: L1 Flash / L2 Distillation / L3 SMR Ammonia learning path cards + AI builder entry — all present
- Preview gateway (space-z.ai) DNS resolves and responds (tested pattern URL → 404 for unknown bot, i.e. gateway itself up)

Stage Summary:
- Sandbox 100% healthy; no server-side cause found
- Most likely: stale tab from previous session (HMR socket dead after session restart) or stale preview URL
- Advised user: hard refresh (Ctrl/Cmd+Shift+R) or re-open preview link from platform UI

---
Task ID: 19
Agent: main (Super Z)
Task: Planning discussion (no code) — hero restructure, brand generalization, floating AI CTA, per-user projects

Work Log:
- Analyzed user's reference screenshot: Google Flow project dashboard (dark grid, project cards with thumbs/dates/actions, "+ New project" card inside grid)
- Audited current state: homepage = "Ammonia Plant Lab" header → text hero → learning path (3 cards) → AI builder card → SavedPlants localStorage strip (max 6, links to builder ?load=slug)
- Confirmed already shipped since last summary: voice layer (/api/tts + spoken sanitization + tourAudio), music layer (procedural Web Audio lo-fi with ducking), distillation L2 template live
- Produced full planning discussion covering: brand generalization, hero-as-sell with looping live demo, floating Build CTA mechanics, per-user projects as first-class plants (local-first storage with schema-ready ownerId), state-dependent homepage IA, phased build order

Stage Summary:
- Plan delivered in chat for user reaction; no code written per explicit request
- Key proposals: rename away from ammonia; invert page order (projects first when non-empty); unified PlantRecord with source: builtin|user; FAB visible on all pages, ducks during tours; IndexedDB + export/import v1, no accounts
- Awaiting user decisions on: name choice, storage model, hero demo style, projects-vs-path ordering

---
Task ID: 20
Agent: main (Super Z)
Task: Flowsheet rebrand + hero + floating Build CTA + first-class user projects (all 4 planned phases)

Work Log:
- Phase 0 — Brand & Hero: renamed app to "Flowsheet / AI-NATIVE PROCESS SIMULATOR" (layout.tsx metadata, homepage header, footer); killed the blue rings on L1/L2 learning cards (C.gas borders + badges → C.bandLine everywhere); built HeroDemo — looping self-playing AI-build demo (prompt typewriter → architect/engineer/critic chips → units settle in → streams wire → solver converges → critic 92/100 → fade & loop; hover-pause; prefers-reduced-motion static); demo plant is a methanol loop (deliberately not ammonia)
- Phase 0 — BuildFab: fixed bottom-right pill on every page (icon-only circle on mobile), hidden on /plant/builder, one-time pulse via localStorage flag, 'b' keyboard shortcut, ducks (opacity .55, scale .92, no pointer events) while any tour runs
- Phase 1 — Registry: PlantRecord {id,name,brief,createdAt/updatedAt,schemaVersion=1,ownerId,graph,kpis,verdict,productionTpd,source:'user'}; anonymous ownerId (fs.owner); IndexedDB store (db 'flowsheet', store 'plants', keyPath id, updatedAt index); one-shot legacy migration folds psp.library.v1 (original key preserved); export as name.flowsheet.json + import with validation; safeKpis sanitizer drops partial KPI objects instead of crashing (found via e2e test: SolveCard toFixed crash on malformed kpis)
- Phase 2 — First-class projects: /plant/p/[id] viewer (BuildCanvas stage + panel: brief, numbers, critic verdict, GENERATED narrated tour with voice+music+ducking via useTourAudio, spotlight follows steps, progress dots); ProjectsGrid Flow-style (live MiniFlow thumbnails via computed serpentine miniLayout, "+ New project" card first, hover actions: rename dialog / edit-in-builder / duplicate / export / delete-with-undo-toast, Import button in header); homepage state-dependent: hero → YOUR PROJECTS (only when non-empty) → learning path; builder saves PlantRecord to IDB with toast "Open" action + header "Open project →" link; ?load= reads IDB then legacy slug fallback; sonner Toaster replaces unused classic toast
- Phase 3 — tourBus (fs:tour CustomEvent): published by 3 prebuilt workspaces + project viewer, consumed by BuildFab
- New files: lib/projects/{record,store,tour}.ts, lib/ui/tourBus.ts, components/home/{MiniFlow,HeroDemo,BuildFab,ProjectsGrid}.tsx, app/plant/p/[id]/page.tsx, scripts/{inject-test-plant,set-legacy}.js; removed SavedPlants.tsx
- Fixes along the way: fixed 10 lint errors incl. pre-existing Canvas.tsx React-Compiler memoization complaints (deps arrays) and set-state-in-effect violations (rAF pattern); tourAudio hydrated ref → state so first tour step speaks; BuildFab pulced typo
- E2E verified via agent-browser: hero demo animates & loops; blue borders gone (computed rgb(219,216,208)); project grid (inject → appears, rename/duplicate/delete+undo all work); legacy localStorage migration works; viewer renders stage + numbers + critic + generated tour (10 steps, narration reads naturally, Next advances, End restores); FAB ducks during project tour AND reference plant tour, restores after; 'b' shortcut navigates; builder ?load= restores graph; mobile 390px layout + circle FAB clean; fresh-profile error count 0; lint clean

Stage Summary:
- The app now sells itself at first glance (hero demo), stays reachable (FAB), and remembers your work (first-class local projects with narrated auto-tours)
- User's own browser: legacy saved builds migrate automatically on next visit; nothing shared between users (per-browser ownerId)
- Queue remaining: 3D keyComponents visualization (PlantRecord already carries graph; add keyComponents field when 3D lands), soft-delete trash if ever needed, account sync later (schema ready)

---
Task ID: 21
Agent: main (Super Z)
Task: Fix label/line collisions across ALL renderers + professional hero animation + 3D planning

Work Log:
- Analyzed user's 2 screenshots (flash plant): (a) stream S04's vertical boot drop passing straight through the centered "FLASH DRUM" tag/name below the vessel; (b) "GAS TO RECYCLE" annotation overflowing the sheet's right edge (x=1092 + ~120px text > 1200 canvas). Audited all layouts: same pattern in distillation (S06/S08/S04 drops through RDRUM/COLUMN/REB labels) and ammonia (S12/S14/S17/S26 through V1/A1/V2/SP1 labels); found ammonia S24 starting 36px below V-3's boot (label was bridging the gap visually)
- NEW src/lib/flowsheet/labels.ts — the drawing-office label system: generous text metrics; Liang-Barsky segment/rect intersection; placeUnitLabels (candidates below-center → below-side → above variants, avoiding stream lines +5px, equipment boxes +7px, sheet edges, title block, zone captions, stream pills, already-placed labels); placeAnnotations (clamp inside sheet by measured text width, vertical nudge off lines/pills); pillRects; unitHitRect (union of box + label for halos/hit areas)
- Diagram.tsx (PFD renderer, all prebuilts): renders decluttered label positions, sheet-colored (C.band) masks behind tag/name + annotations so unavoidable lines pass BEHIND words; halo + hit rects follow the moved labels; aria-label genericized to "Process flow diagram"
- Layout touch-ups: flash + distillation product arrows end at x=1030 (was 1080) with annotations at x=1042 → fully inside the sheet; ammonia S24 now starts at the V-3 boot (662,630)
- NEW src/lib/flowsheet/route.ts — collision-free grid router for computed layouts (builder + thumbnails): corridors (vertical strips between columns) + lanes (horizontal strips between rows + margins); rules: adjacent-column forward = single corridor jog; skip-forward = corridor + row-lane hop; same-column forward (band wrap) = straight drop into top; recycle = corridor down to a staggered lane BELOW both units, rise into target bottom (right-side entry fallback when column occupied); sinks from mid-columns route along a lane to the margin (fixes pre-existing 6px overhang into next column); roundedPath() for soft corners; pairIndex/laneIndex staggering
- BuildCanvas (AI builder + project viewer): replaced naive beziers (which crossed intermediate unit boxes on skips/recycles) with router output; pills at pointAt(pts,0.5); new streams DRAW THEMSELVES in (pathLength=1 + bd-draw dashoffset animation, bd-pop arrowheads, bd-late pills; dashed utilities skip draw-on to preserve pattern); entered-ids state so classes persist for the 700ms entrance then release
- MiniFlow: optional `view` prop (hero camera) + `dots` prop (faint dot grid = engineering canvas); units now settle with overshoot (mf-settle); streams draw on (mf-draw; dashed utilities crossfade solid→pattern via mf-dash-in/mf-draw-out); miniLayout() thumbnails now routed by the shared grid router — self-loops skipped as before
- HeroDemo rewrite (professional choreography, ~15.7s loop): human-cadence typing (per-char times, pauses at spaces/punctuation); agent chips with done sublines; camera drifts with the build (damped-lerp viewBox framing placed units, aspect-locked via boxToAspect, clamped) then pulls back to the full sheet at convergence, snaps back under the end fade; operator console line bottom-left ("▸ placing STEAM REFORMER…", "▸ wiring recycle loop", "✓ converged · 12 passes"); solver pass ticker + progress bar; numbers COUNT UP (512 t/d, critic 92) with easeOut; whole content fades at loop end (no more hard cut); PAUSED state shows "HOVER TO INSPECT"
- globals.css: bd-draw/bd-pop/bd-late + mf-draw/mf-dash-in/mf-draw-out/mf-settle/mf-pop/mf-label keyframes, all in the prefers-reduced-motion kill list with sensible static end-states
- NEW scripts/inject-router-test.js — 10-unit stress plant: multi-row column (D1/D2), two skip-forwards, band wrap (depth 7→8), two recycles (cross-band + shallow), sinks from last AND middle column
- E2E verified (fresh browser, zero page errors on every route): flash/distillation/reference all pass VLM collision audit (every previously-crossing label now clear; annotations inside sheet); router stress test passes with zero box crossings, recycles in lanes, pills clear, "professional engineering diagram" verdict; hero verified at 4 phases (typing+caret, units+camera framing, streams+console line, converged+counting chips+stamp); home projects grid shows router-routed thumbnail; builder idle healthy; mobile 390px + dark mode clean; unit click selection works with moved-label hit areas
- "pulced is not defined" in dev.log confirmed stale (no source hits; fixed in Task 20; fresh browser = 0 errors)

Stage Summary:
- The #1 visual complaint is fixed SYSTEMICALLY, not per-plant: prebuilts get decluttered labels + masks + fitted annotations; AI-built plants get a grid router that makes line-through-unit geometrically impossible
- Hero now tells the build story with real choreography (typing → placing → wiring → solving → counting → verdict) and a drifting camera
- 3D plan delivered in chat (unit-level cutaways first via react-three-fiber, plant flythrough later, reusing the same graph+router data) — awaiting user go-ahead

---
Task ID: R (Restoration)
Agent: main (Super Z)
Task: Sandbox rollback recovery — restore newest project state, preserve 3D pipeline work

Work Log:
- INCIDENT: between sessions, the sandbox restarted with the project at /home/z/my-project rolled back to a Sep 12 23:01 snapshot (worklog + src through Task 11 only). The newest state (Tasks 12–21, source mtimes Sep 13–14) survived at /tmp/my-project (a complete copy including flash + distillation plants, audio layer, Flowsheet rebrand, projects system, labels.ts, route.ts, hero). The dev server had been restarted against the stale copy (serving "Ammonia Plant Lab" again).
- RECOVERY: verified /tmp/my-project as strict superset with identical deps (package.json byte-identical); copied /tmp/my-project/src → /home/z/my-project/src; merged upload/ + scripts/ (union, no clobber); public/models (the 3D GLB) kept; worklog reconstructed — Tasks 17–21 restored verbatim from session context (read from this worklog earlier the same day), Tasks 12–16 consolidated into a single honestly-marked reconstructed entry (verbatim text lost).
- 3D PIPELINE (done before discovery, unaffected — worked on /home/z/my-project paths that survived): user uploaded GrabCAD "Shell and Tube Heat Exchanger" (SLDASM 27.8MB, SolidWorks 2015+ format — not OLE2, no local parser exists). Converted via convert3d.org through headless browser (agent-browser upload → GLB 48MB, 1.4M verts, PBR materials, real scale 3.39m, BOTH the intact and cutaway twins included). Optimized with gltf-transform: weld → simplify (ratio 0.12, error 0.005) → prune → quantize → meshopt = 885KB final at public/models/shell-and-tube-exchanger.glb (EXT_meshopt_compression + KHR_mesh_quantization, three.js-ready).
- Restarted dev server after restoration; verified newest app state serves again (Flowsheet brand, all routes).

Stage Summary:
- Newest state fully restored; /tmp/my-project left untouched as recovery source until next commit
- LESSON: platform auto-commits (UUID messages) captured only scripts/*.json — the src tree of Tasks 12–21 was never committed to git. Commit src changes promptly at task end.

---
Task ID: R2 (Second Restoration)
Agent: main (Super Z)
Task: User reported the app reverted to a previous version ("how did the app go to the previous version... make sure it returns to the most recent version we had, with the hero and all") — full diagnosis + restoration

Work Log:
- DIAGNOSIS: a second sandbox rollback struck between sessions. The Task R recovery (commit cffa765) had restored NEW files from Tasks 17-21 (components/home/*, lib/flowsheet/{labels,route,flashLayout,distillationLayout}.ts, lib/projects/*, lib/ui/tourBus.ts, plant/p/[id], flash+distillation plants+workspaces+content, audio layer, engine changes in a07cfa9, 3D GLB) — but every file those tasks MODIFIED was stale: page.tsx (Sep 6, "Ammonia Plant Lab", no hero), layout.tsx (Sep 1), globals.css (missing ALL Task-21 keyframes), Diagram.tsx (Sep 1, ammonia-only, no labels), Canvas.tsx (no layout prop), BuildCanvas.tsx (naive beziers), Workspace.tsx (no tourBus/layout), DetailPanel.tsx (no PlantContent), builder page (localStorage SavedPlant), layout.ts (no PlantLayout/REFERENCE_LAYOUT, no S24 fix, no source/dcolumn kinds). /tmp/my-project had itself been rolled back (now an Aug-30-era snapshot mirror) — no recovery source existed; everything was rebuilt from worklog Task 20/21 specs + VLM analysis of the final verification screenshots (lab9-home-projects, lab5-hero-typing, dst6-reference-regression).
- REBUILT layout.ts: PlantLayout/TitleBlock/ZoneDivider interfaces + REFERENCE_LAYOUT composition (sheet frame, zones=BANDS, AMMONIA SYNTHESIS title block) + S24 boot fix ([662,630]) + UnitKind += 'source'|'dcolumn'.
- REBUILT page.tsx: Flowsheet header, 2-col hero (badge ✦ AI-NATIVE PROCESS SIMULATOR, "Describe any chemical plant. Watch AI engineer it — live.", ✦Build a plant with AI / Start at the basics ↓, HeroDemo right), ProjectsGrid, THE LEARNING PATH (Flash LEVEL 1·BEGINNER + START HERE, Distillation LEVEL 2·INTERMEDIATE, SMR LEVEL 3·CAPSTONE — bandLine borders, no blue rings), footer lines, BuildFab.
- layout.tsx: Flowsheet metadata + sonner Toaster (was classic ui/toaster).
- globals.css: appended the full Task-21 animation layer — mf-settle/mf-draw/mf-draw-out/mf-dash-in/mf-pop/mf-label/mf-in, caret, bd-draw/bd-pop/bd-late, fab-pulse + prefers-reduced-motion kill list with static end-states.
- REBUILT Diagram.tsx: layout prop (default REFERENCE_LAYOUT), placeUnitLabels + sheet-colored masks (band-inside→C.band else C.canvas), placeAnnotations clamped+masked, sheet frame + zones + zoneDividers + title block rendering, unitHitRect-driven halos + hit areas, generic "Process flow diagram" aria.
- Canvas.tsx: layout prop, per-plant canvas/aspect/clamp, legend derived from the sheet's stream classes (feed/syngas/loopgas/product/water/co2/purge); fixed the 5 pre-existing React-Compiler memoization errors (clampView hoisted pure, stopAnim/fit/panTo/zoomAtWorld dep-correct).
- Symbols.tsx: 'source' (sphere + latitude ellipse) and 'dcolumn' (14 alternating trays + feed-stage nozzle) symbols.
- BuildCanvas.tsx: beziers → grid router (buildGrid/routeStream/roundedPath, pairIndex+recycleLanes staggering, self-loops kept as beziers); pills at pointAt(pts,0.5); streams draw themselves in (pathLength=1 + bd-draw, bd-pop arrowheads, bd-late pills; dashed utilities skip draw-on); fresh/doneRef entrance state (animate once ≈700ms then release).
- Workspace.tsx: layout={REFERENCE_LAYOUT} + setTourActive publish.
- builder/page.tsx: saveProject → PlantRecord to IndexedDB with sonner toast "Open" action + header "Open project →" link; ?load= reads IDB first, legacy slug fallback.
- DetailPanel.tsx: PlantContent export (unitMap/unitStreams/unitContent/zones?) + plant prop, default = ammonia reference content.
- Removed SavedPlants.tsx.
- VERIFIED (agent-browser + VLM, zero page/console errors on every route): home hero animates through phases (typing w/ caret → placing → wiring → solving → converged); flash/distillation/ammonia sheets all collision-free with sheet frames + title blocks + inside-sheet annotations (ammonia 9/10); router stress plant (10 units, injected to IDB) renders with ZERO box crossings, recycles in lanes; YOUR PROJECTS grid shows with thumbnail+stats+CRITIC badge; mobile 390px stacks clean with round FAB; dark mode correct (class toggle). tsc + eslint clean on all touched files.
- COMMITTED immediately (6252ec9) per the Task R lesson — src changes are never left uncommitted again.

Stage Summary:
- The app is back to the newest state: Flowsheet brand, looping hero, learning path, first-class projects, label engine, grid router, per-plant sheets — all verified end-to-end and committed.
- Root cause is platform-level (two rollbacks in two sessions); /tmp is NOT a reliable recovery source. Mitigation: commit after every task.
- NEXT (queued from user's last order): 3D Component Viewer MVP around the shell-and-tube GLB (public/models/shell-and-tube-exchanger.glb, 885KB, meshopt-compressed, ready) — R3F + drei, lazy bundle, model registry + cube badges on flowsheet units, /plant/<plant>/3d/<unit> routes, full-screen orbit viewer.

---
Task ID: R3 (Voice & Music Restoration)
Agent: main (Super Z)
Task: User asked "where is the voice and music part" + commit everything before the 3D phase — restore the audio UI wiring lost to the second rollback

Work Log:
- DIAGNOSIS: the audio LIBRARY survived and was committed (cffa765: /api/tts, lib/audio/{music,narration,spoken,tourAudio}.ts; project viewer /plant/p/[id] fully wired), but the audio UI WIRING was lost: TutorPanel.tsx was the stale Sep-1 pre-audio version (TourRunner with no useTourAudio, no voice/music/replay controls, footnote still saying "voice narration arrives in a later phase"), and Workspace.tsx (reference plant, rebuilt in R2) never called unlockAudio(). Flash/Distillation workspaces called unlockAudio but rendered the stale TourRunner, so no plant tour actually narrated.
- REBUILT TourRunner (TutorPanel.tsx): useTourAudio(tour, idx) hook + VOICE pill (C.gas accent) + MUSIC pill (C.nh3 accent) + replay button (RotateCcw) + state-aware narration status line ("Narrating — music lowers while I speak." / loading / blocked / off). Double-mount (desktop aside + mobile sheet) handled by narrator dedupe, matching the original Task-16 design.
- Workspace.tsx: unlockAudio() in startTour (user-gesture unlock, same pattern as flash/distillation). TutorHome footnote updated: narration exists, ask-anything tutoring is the future phase.
- VERIFIED (agent-browser, /plant/reference): tour start → narrator loading→speaking, music running, duck gain exactly 0.30 while speaking, exactly 2 TTS POSTs (step + prefetch, dedupe holds), MUSIC toggle off→stopped / on→running, Next advances narration ("Splitting methane" speaking), Exit tour → narrator idle + music stopped; /plant/flash: TTS 200 + music running; zero page/console errors; VLM 9/10 on the restored panel ("no overlap or clipping", status line correct). Mobile 390px screenshot taken.
- tsc: only pre-existing errors outside src/ (examples/, scripts/, skills/). eslint clean on both touched files.
- COMMITTED immediately with this entry (lesson from Tasks R/R2: never leave src uncommitted).

Stage Summary:
- Voice + music are back on ALL tour surfaces: reference plant, flash, distillation (shared TourRunner), and project viewer (never lost). Music ducks to 0.30 under narration; voice/music prefs persist; replay works.
- NEXT: 3D Component Viewer MVP — shell-and-tube GLB (public/models/shell-and-tube-exchanger.glb, 885KB, meshopt) via R3F + drei.

---
Task ID: 22 (3D Component Viewer MVP)
Agent: main (Super Z)
Task: 3D Component Viewer MVP — the queued next step after voice/music restoration ("before we move to the 3D part so yh")

Work Log:
- DEPS: three@0.186 + @react-three/fiber@9.7 + @react-three/drei@10.7 + @types/three via bun (npm eresolve chokes on R3F's react-native peerOptional chain; bun resolves fine).
- PROBED the GLB (scripts/probe-glb-three.ts): meshopt-compressed, 4 mesh nodes, overall 2.65 × 0.77 × 3.39 m (real scale) — shell cylinder + head + bundle parts; decoder wired from three/examples meshopt_decoder.
- NEW src/lib/three/registry.ts: ModelEntry shape + SHELL_AND_TUBE entry (src, title, blurb, GrabCAD credit, dims) + MODEL_BY_KIND ({hex → shell-and-tube}) + PLANTS meta (reference/flash/distillation unit maps) + resolveUnit(). One model stands in for every hex tag — stated honestly in the UI.
- NEW src/components/three/ModelStage.tsx: R3F Canvas (dpr [1,2], fov 38) + Bounds fit/clip/observe + Center bottom → camera auto-frames the real-size model; drei OrbitControls (damped, slow turntable that yields on first pointer/wheel); ContactShadows + infinite Grid; hemisphere + 2 directionals + locally-rendered Lightformer Environment (PBR reflections with zero network fetches); theme read from --fs-* CSS vars with MutationObserver on <html>.class so dark mode live-updates the canvas.
- NEW route /plant/[plant]/3d/[unit]: client page, ModelStage via next/dynamic ssr:false (three never enters the server bundle; flowsheet pages never pay for it) + Suspense mono loading state. HUD: top-left "3D COMPONENT MODEL · tag · REAL SCALE", bottom-right dims chip, "drag to orbit · scroll to zoom" hint, collapsible info card (title/blurb/credit). Honest states: unknown plant/unit → "Nothing to render here"; unit without a model → "No 3D model for <tag> yet" + links to the plant's modeled units (e.g. reference lists E-101..E-104).
- WIRED affordance: PlantContent gained plantId ('reference'|'flash'|'distillation'); DetailPanel UnitDetail renders a "View in 3D — real component model" button (Box icon, band background) under the header when hasModel(node.kind) — flash + distillation bundles updated. On-canvas badges deliberately NOT added yet (label engine is collision-tuned; noted as follow-up).
- VERIFIED (agent-browser + VLM): reference E-101 click → button → viewer loads GLB, model fully rendered (shell, tube bundle, flanged head), grid + soft shadow, info card correct — VLM 9/10; orbit drag changes angle (turntable yields); dark mode re-themes canvas + UI live; /plant/reference/3d/R1 → honest no-model state listing the four modeled exchangers; flash E-101 CHILL → viewer at /plant/flash/3d/CHILL; mobile 390px fits (card wraps, no horizontal scroll); zero page errors anywhere (only harmless THREE.Clock deprecation warning from drei). tsc + eslint clean on all touched files.
- COMMITTED immediately.

Stage Summary:
- The app now has its first real 3D surface: click any heat exchanger (E-101/E-102/E-103/E-104 on the reference sheet, E-101 on flash, E-101/E-102/E-103 on distillation) → View in 3D → full-screen orbit viewer of the real GrabCAD shell-and-tube model at true scale, theme-aware, 885KB lazy chunk.
- Registry is the extension point: one entry + one kind mapping per future model (reformer, converter, column…).
- NEXT candidates: more unit models (converter R-104 first?), on-canvas 3D badges, builder/project-unit 3D links, plant-level flythrough reusing graph+router data.

---
Task ID: 23 (3D fixes: ground + one-sheet + real HX)
Agent: main (Super Z)
Task: User reported three issues from screenshots: (1) the 3D model sits BENEATH the world/grid instead of on it; (2) the ammonia plant (and any agent-built plant) renders as three separate boxes — should be ONE coherent box the flowsheet is drawn on; (3) the shell-and-tube exchanger doesn't represent the real training unit (photos provided)

Work Log:
- DIAGNOSED (1): probed the GLB per-mesh (scripts/probe-glb-deep.ts) — the converted GrabCAD assembly was mangled: the tube-bundle mesh offset ~2.3 m to the side of the shell, and drei <Center> measures in useLayoutEffect BEFORE the suspense GLB resolves, so the model kept its baked transform (axis at y≈0.066) → shell half-buried in the grid. Confirmed visually: grid sliced the cylinder's lower half.
- DIAGNOSED (2): user's dark-mode screenshot = the 2D reference sheet, where each zone/band rendered as its own filled rounded CARD (fill C.band + stroke) — in dark mode the three bands read as three separate boxes.
- DIAGNOSED (3): VLM-analyzed the real training-unit photos: horizontal shell L/D≈5:1 on two saddles, bolted channel bonnet with dished cover + bolt circle, welded rear dished head, GREEN shell-side nozzles top (front+rear), RED tube-side nozzles (front-bottom in, rear-crown out), and a sectioned cutaway twin exposing the tube bundle + segmental baffles + tubesheets. The 88%-decimated GLB (bundle misplaced, wireframe-ish rails) matched none of this well.
- FIX (2) ONE COHERENT SHEET: Diagram.tsx — the sheet rect is now THE box: filled surface + border + soft feDropShadow ("the sheet lies ON the canvas"); zones are no longer cards: section caption + hairline rule under it (ruled drawing sheet); zoneDividers solidified; surfaceFor masks text with the sheet fill when inside the sheet (exact match, no halo rectangles). BuildCanvas (AI builder + project viewer) — added the same one coherent sheet as the first SVG child, growing to wrap every placed unit ("all bands lie on the same big thing"); idle state now shows an empty waiting sheet instead of bare canvas ("THE SHEET IS WAITING").
- FIX (2) TOKEN: new --fs-sheet (light #E9E7E1, dark #292824 — between band and paper so equipment still lifts off) + C.sheet; dark sheet was tuned after pixel-measuring rendered contrast (inside vs outside the sheet).
- FIX (1)+(3) PROCEDURAL MODEL: NEW src/components/three/models/ShellAndTube.tsx — the exchanger rebuilt in code after the photos at real scale (3.24 × 1.08 × 0.82 m), resting on the ground BY CONSTRUCTION (saddle base plates at y=0): shell cylinder, bolted channel bonnet (lathe dished head + barrel + flange + 18-bolt circle), welded rear dished head, green shell-side nozzles top front+rear, red tube-side in at channel bottom + out at rear crown (body + raised-face flange each), two extruded cradle saddles + base plates, lifting lug, nameplate. Internals always present: instanced ~150-tube bundle (triangular pitch), 6 alternating segmental baffles (extruded chord-cut discs), both tubesheets. CUTAWAY mode sections the shell BETWEEN the nozzles (intact end segments keep the shell-side nozzles mounted, middle band opens 136° at the top with wall-thickness rims) — mirroring the sectioned twin of the training unit.
- FIX (1) GLB PATH: ModelStage GltfModel now self-positions in useLayoutEffect AFTER suspense resolves (bbox bottom → y=0, centered X/Z) — the measure-before-load bug can never sink a future GLB again. ModelStage takes a ModelEntry (component | src) instead of a path.
- REGISTRY: ModelEntry gains optional component/cutaway; SHELL_AND_TUBE now procedural (src dropped); deleted public/models/shell-and-tube-exchanger.glb (885 KB, unused).
- VIEWER PAGE: ASSEMBLED/CUTAWAY toggle pills (top-right, aria-pressed), cutaway caption strip (SECTIONED · TUBE BUNDLE · SEGMENTAL BAFFLES · TUBESHEETS), credit line updated ("Modeled in-app after photos of the shell-and-tube training unit"), dims 0.82 × 1.08 × 3.24 m.
- VERIFIED (agent-browser + VLM, zero page/console errors): assembled model RESTS on grid with saddles touching y=0 (VLM: "rests cleanly on top"); cutaway shows bundle + baffles + tubesheets, still on ground, no glitches; dark 3D viewer + click-through flow (E-101 → View in 3D) works; mobile 390 px fits, orbit interaction changes camera, turntable yields; ONE coherent sheet confirmed on reference (dark+light), flash, distillation, builder idle, and the injected 10-unit router-stress project viewer (pixel-checked fill vs canvas; VLM YES with evidence); before/after comparison against the user's own complaint screenshots passed both; model-vs-real-photos comparison: "highly faithful" (orientation, heads, saddles, nozzle placement + green/red coding, cutaway internals all match; noted simplifications: nozzle bolt detail, saddle stiffeners). tsc + eslint clean on all touched files.

Stage Summary:
- All three complaints fixed at the root: models can never sink again (self-positioning + ground-by-construction), every plant surface (prebuilt, AI-built, saved projects) draws on ONE coherent sheet with a shadow, and the exchanger is now a faithful procedural model of the real training unit with an assembled/cutaway toggle.
- The old GLB conversion pipeline is retired; the registry's component indirection is the pattern for future procedural units (reformer, converter, column).
- Committed immediately per the commit-everything policy.

---
Task ID: 24 (publish to GitHub)
Agent: main (Super Z)
Task: Push the full project to github.com/I-PHEN/FlowSheet with a fresh-dated commit, README, and no user screenshots.

Work Log:
- Pre-push audit: found .env (local SQLite URL only — no secrets) tracked, plus 32 user-pasted screenshots baked into history (incl. the 3D-fix screenshots in cacae6e); history dates back to 2026-08-29, which would show as "2 weeks ago" on GitHub — against the user's explicit "commit as now" requirement.
- Security sweep: grepped tracked tree for github_pat_/API-key patterns — clean; .z-ai-config not tracked; token never written to any file or the worklog.
- Created local-only backup branch `history-backup` preserving the 20-commit history before rewriting.
- .gitignore: added `upload/pasted_image_*` (never commit pasted screenshots) and explicit `.env` rules.
- Added `.env.example` (DATABASE_URL template) so the repo stays runnable.
- Added `README.md` (features, stack, getting started, structure, 3D registry extension guide).
- History strategy: ONE parentless commit dated now, built with plumbing (`git commit-tree` of the verified-clean tree + `git update-ref`) — screenshots and .env never exist in the pushed history, and GitHub shows "just now" instead of "2 weeks ago". (First attempt via `git checkout --orphan` silently reverted to main mid-run — a sandbox worktree quirk caught through the reflog; plumbing avoids it entirely. Old history kept locally in `history-backup`.)
- Pushed main → github.com/I-PHEN/FlowSheet (remote was empty — clean first push, no force needed).
- VERIFIED via GitHub API: exactly 1 commit dated 2026-09-15 (today); GitHub-side tree contains 0 pasted screenshots and 0 .env; README.md / .env.example / worklog.md / ShellAndTube.tsx all present; default branch = main.

Stage Summary:
- Repo published clean: full working tree, README, fresh timestamp, zero screenshots, zero secrets. Local `history-backup` branch retains the granular history if ever needed.

---
Task ID: 28 (sandbox-reset recovery + the general family + flow dots)
Agent: main (Super Z)
Task: Recover everything lost to the sandbox reset (tasks 25-27), bake in the user's generalization architecture (the agent builds ANY plant from the basics, no spoon-feeding), and ship the 2D flow animation.

Work Log:
- DISASTER + DIAGNOSIS: the sandbox was reset to the GitHub state (fa23d93 + auto-commit) — all work after the task-24 push was lost (families, remix, six UX fixes, sulphur, symbols, one-card chat). /tmp wiped, tool-results from the session gone, git objects unrecoverable (dangling commits all pre-Sep-15). Conversation context was the only recovery source — and it was rich (every lost file read or written this session).
- RECOVERY (engine): captured the ammonia baseline from the untouched tree FIRST, then rebuilt in dependency order — species #3+#4 in one append (CH3OH/H2S/SO2/S2 + S atom column), MeOH + Claus reaction blocks, meohBed, 7 registry units (meoh-converter, meoh-separator, psa, acid-gas-source, claus-burner, claus-converter, sulphur-condenser), range widenings, flashPT absent-species hardening (convergence + K-updates ignore zero-flow species; frozen K kills the exp-overflow NaN), baseline v2 re-capture with physics windows.
- RECOVERY (families): types/resolve/index + ammonia (KPI block MOVED VERBATIM from the v1 executor), hydrogen, sulphur (from this session's code), methanol REDESIGNED to the true ICI route (HTS only, NO CO2 removal — CO2 is a reactant; M lands near stoichiometric naturally; 665 t/d crude, 66 wt%, 22-iteration convergence), executor family hooks + generic makeup fallback for loop families without convention ids.
- NEW — THE GENERAL FAMILY: the no-spoon-feeding architecture. Primer = the BASICS only (species table, the 6 reaction sets the engine knows with their units, the separation physics, solvability heuristics) — NO route. The engineer composes freely from the full 38-unit catalog and DECLARES its product (declare_product tool → graph.product); generic KPIs compute production/purity/recovery for ANY declared product (S-atom recovery for sulphur-bearing products). General critic judges the BRIEF + physics, never a route. Router: LLM-first with explicit hybrid examples (keywords demoted to fallback); honest default when the router is down = general.
- LIVE TUNING (4 real builds): (1) hybrid brief mis-routed to hydrogen by keyword → fixed routing order; (2) hydrogen-family critic REVISE'd a unit the brief itself asked for → brief-outranks-primer fix; (3) general engineer declared done after units only (my "Done." was read literally) + burned turns on 12 set_specs → WORK DISCIPLINE block, stream-aware premature-done rejection, tiered turn budget (34 for general), architect simplicity nudge; (4) 1.2 t/d sulphur passed as "meaningful" → scale sanity in the critic + S-atom recovery.
- VERIFIED LIVE: hybrid H2+methanator PASS 95/100 (GENERAL route, declared H2 143 t/d @ 99.95 mol%, docent 8-stop tour, viewer GENERAL·H2 badge, docent-tour section); "build me a sulphur treatment plant" free-design PASS 95/100 (Claus composed from the basics primer ALONE); explicit sulphur brief PASS 100/100 (98.8 % recovery, 646 t/d — reference-matching); honest FAIL path (0/100, actionable suggestions).
- RECOVERY (agent + UI): protocol v3 (docent/family/tour events), prompts (router + family roles + docent + remix + general variants), workspace (declare_product + aliases), orchestrator (router-first + tour sanitization + runAgentRemix + normalizeAction), /api/agent/remix; builder page (?remix/?load, family badge, tour flow), SessionPanel (ONE agent-work card per RUN with phase sections + outputs after, family presets, region picker with sulphur briefs, surprise briefs, remix greeting), glyphs.ts + BuildCanvas symbols (168×96 nodes), PlantRecord v2 (+family +tour +safeTour +effectiveFamily), viewer (docent-tour preference, family badge + KPI grid, Remix with AI), regions.ts (12 regions), AnswerStrip + OperatePanel sticky rework, Workspace Learn|Operate + PanelRight, TutorHome remix card, music 3-progression rotation.
- FLOW DOTS: light 2D material-movement animation on BuildCanvas — two beads per stream (paper fill + stream-color ring), SVG animateMotion along the routed path, duration from the SOLVED molar flow (heavy = fast). Toggle ⌁ beside zoom; reduced-motion aware; verified animating (sampled 6-78 px/1.5 s movement).
- GATES: engine 62/62, families ALL PASS (ammonia byte-identity vs baseline v2 + physics windows), sulphur ALL PASS, tsc + eslint clean, console clean, dev overlay clean.

Stage Summary:
- The reset was fully recovered AND overtaken: five families (ammonia/methanol/hydrogen/sulphur/GENERAL), one engine, honest critics, declared products, and flow that students can SEE moving.
- The general family is the user's architecture realized: no routes, just species + chemistry + separations — the agent designed a novel hybrid plant (H2 + methanator guard) and a full Claus plant from the basics alone, both judged honestly by physics.
- LESSON WRITTEN IN FIRE: everything after the last GitHub push was lost. The repo MUST be pushed after every session — it needs a fresh token from the user.

---
Task ID: 29 (token economy + push)
Agent: main (Super Z)
Task: Ship the token-economy layer (metering, reply cache, scoped prompts, TTS disk cache), fix the stale agent tests, push to GitHub. Plan (no code) the cinema-mode walkthrough. 

Work Log:
- MEASURED the cost centers: engineer loop re-sends a ~4.3k-token system prompt every turn (~115k prompt tokens per family build, ~180k general); the 38-unit catalog digest (~2.9k tok) is the bulk. solveFacts + the solve TOOL SUMMARY carried wall-clock ms → non-deterministic messages.
- llm.ts: TokenMeter (per-run ledger, role buckets, repair turns roll up; snapshot → RunUsage) + ZaiLlm records API usage (snake/camel defensive) + CachedLlm (disk reply cache at .agent-cache/llm, sha256 of salted messages, AGENT_LLM_CACHE=0 kill-switch, AGENT_LLM_CACHE_DIR override, cache failures never break a build).
- protocol.ts: RunUsage + 'usage' BuildEvent; orchestrator emits the snapshot right before every 'done' (success AND catch paths), accepts optional meter.
- Determinism fixes so replays hit cache: solveMs dropped from solveFacts AND from the solve tool summary (UI still gets ms via the solve event payload).
- Prompt economy: catalogDigest(types?) abridges to given unit types; engineerSystem(family, planTypes) scopes the ENGINEER's catalog to route units + plan units (family builds only — general + remix + architect + critic keep the full catalog; remix can add any unit). Engineer system prompt: ammonia −29%, methanol −43%, hydrogen −50%, sulphur −52% per turn. Docent: 40–90 words, 2–4 short caption-friendly sentences (also preps cinema mode).
- /api/tts: disk cache tier (.agent-cache/tts, keyed voice+speed+text) under the memory LRU — replays after restarts cost zero.
- UI: LogEntry/Block kind 'usage' → UsageLine "TOKEN LEDGER 0 tokens · 11 cached · ≈37.0k saved + per-role line" under the AGENT WORK card.
- Tests: section E in agent-tests (meter buckets, usage event before done, cache hit/miss/kill-switch, scoped catalog) + fixed 2 stale section-B expectations from task 28 (family stamp normalized in deep-equal; docent phase expected). 63/63 agent, 62/62 engine, tsc/eslint clean.
- LIVE E2E (hydrogen brief, /api/agent/build): fresh build 41.2k in + 2.9k out tok / 11 calls / 30 s, PASS 100/100 (102 t/d H2 @ 99.95%); identical re-run = 0 tokens, 11/11 cache hits, ≈37k saved, 0.058 s (500×), byte-identical plant. probe-usage.ts verifies API usage fields live. UI verified via agent-browser (ledger renders, plant assembles); cold-restart + fresh load = no dev-overlay issues (earlier badge was a hot-reload artifact).

Stage Summary:
- Token economy is real and visible: every run reports its cost; identical briefs replay for zero tokens; family engineer turns are 29–52% lighter; TTS replays are free.
- Lesson (again): wall-clock in LLM-facing text is a cache-killer — keep timing in UI events only.

---
Task ID: 30 (flow animation architecture)
Agent: main (Super Z)
Task: Build the shared flow/particle animation layer for every canvas the AI-built plants render on — architecture-first per the user's instruction ("we are doing it for almost every plant the AI builds").

Work Log:
- SURVEYED all render surfaces before writing code: Diagram.tsx (pure/SSR, library thumbnails), Canvas.tsx (reference workspace, viewBox-driven pan/zoom), BuildCanvas.tsx (builder + saved-plant viewer; had a 2-bead animateMotion prototype with speed-from-flow), route.ts (rounded-corner router), engine types (Stream.n per-species kmol/h, kpis.productSpecies).
- ARCHITECTURE: contract-first FlowSpec {id, d (exact SVG path), flow, color, liquid?, pillAt?}; pure laws in lib/flowsheet/flowAnim.ts; fully imperative client layer components/flowsheet/FlowLayer.tsx (overlay svg sharing the host's exact viewBox → pixel-locked, rides pan/zoom free; 48-sample arc-length LUTs via getPointAtLength so ANY geometry — rounded corners, self-loop beziers — animates correctly; ONE rAF loop, DOM-created circles, zero React re-renders while animating; dim/speed knobs via refs so the loop never restarts; Diagram stays pure/SSR so thumbnails never animate).
- LAWS (all pure + tested): speed = log-normalized molar flow (decades span: 300 kmol/h purge vs 25k loop), liquid ×0.5; count = coverage (~1 dot/150 units) capped 5, sparse below 2% of max, global budget 260; radius = sqrt(relative flow) 2.1–3.6; PRODUCT TINT — streams ≥10 mol% of the plant's DECLARED product species (kpis.productSpecies, data not family code) take the product hue: NH3/CH3OH → green, S2 → NEW --fs-sulfur gold token (light #A8842C, dark #D9B45B); endpoint fades (6%); pill masking (±20 units) so dots never cross stream number pills; deterministic phase (fnv hash) so re-renders never reshuffle.
- INTEGRATIONS: BuildCanvas — routing extracted into useMemo (stable identity → no LUT rebuilds on hover), prototype animateMotion REMOVED, FlowLayer mounted with tint + liquid + pillAt; Canvas.tsx (reference workspace) — FlowLayer + ⌁ toggle in the zoom cluster + stream-dim parity (dimExcept = focus??hover stream, same 0.24 as StreamPath); saved plants inherit via BuildCanvas automatically. Fixed a self-inflicted wart: hosts must NOT empty specs on toggle-off or the layer unmounts instead of fading — reference Canvas now keeps specs (free, result is a prop) and toggles via active only; BuildCanvas keeps the solve gated on flowOn (mid-build solve cost is real) so its toggle is instant by design.
- TESTS: scripts/flow-anim-tests.ts — 53 checks in 8 sections (speed/density/budget/radius/tint/LUT/visibility/phase). Two initial failures were wrong test expectations (linear-comparison used the wrong flow; sparse expectation tighter than the law's intent) — fixed the tests, not the laws.
- LIVE VERIFICATION (agent-browser): reference sheet 50 dots, all moving, graduated radii 2.16–3.60; dot-to-line alignment avg 0.33px / worst 0.57px at unit-density sampling, CTM scales identical; 3× zoom still sub-pixel; toggle fades 1→0 gracefully (dots freeze, layer fades 320ms); dark mode resolves via live var() (no rebuild); builder canvas (?remix=reference) 48 dots with fills {gas 36, feed 5, NH3-tint 3, utility 4} — the ammonia moment works: converter-effluent dots turn green on the steel line; corner tracking on routed paths avg 0.14px; zero console errors; library page has ZERO animated layers (SSR purity held).

Stage Summary:
- The flow animation is now an architecture, not a prototype: one contract + one pure law module + one imperative layer that any canvas hosts with a single line. The future Learn-mode camera (zoom + captions) reuses the same viewBox, so particles will zoom with narration for free; conceptual builds (no engine) degrade to silence naturally.
- Gates: flow-anim 53/53, engine 62/62, graph 35/35, agent 63/63, tsc + eslint clean, console clean.
- Next planned: Learn/Explore merge with cinema-mode walkthrough (zoom choreography + bottom captions + narration decoupled from the side panel).
---
Task ID: 31 (Learn/Explore merge — cinema-mode Learn)
Agent: main (Super Z)
Task: Merge Learn and Explore into ONE mode with two paces (Guided cinema + Free roam) across every surface a plant renders on; narration decoupled from the side panel (kills the panel-close-silences-narration bug structurally).

Work Log:
- RECON: flow animation (Task 30) was already shipped + verified — this session's "that one" = the Learn merge. Surveyed all four tour surfaces: reference/flash/distillation workspaces + /plant/p/[id] all ran tours through TourRunner INSIDE the closable side panel; flash + distillation called the book mode "Explore" while reference called it "Learn" (and their panel toggle was ALSO labeled "Learn"); only the reference canvas had an animated camera; BuildCanvas had no camera API at all.
- ARCHITECTURE (presented before code): the tour script already IS the content model — every TourStep is a caption + narration script + camera target. ONE mode, two paces over one script. Five pieces: (1) useTourDirector — page-level brain owning pace/idx/roam state, camera intent as DATA ({kind:'fly'|'fit', seq}), auto-advance on the narrator's speaking→idle edge (~700ms beat) with a reading-time dwell fallback when voice is off (2600ms + 270ms/word, clamped 14s), capture-phase keyboard (←/→ step, space pause/resume, esc end; space passes through to focused buttons); (2) camera parity — extracted the reference tween into lib/flowsheet/camera.ts (easeOutCubic + lerpView + tweenView, reduced-motion aware); BuildCanvasHandle gained flyToRef (unit box or routed-stream bbox → pad 70 → aspect → clamp → 620ms tween), cancelled by wheel/drag/pinch; routed memo now stores pts; (3) CinemaBar — the one caption system on the stage (counter + GUIDED/ROAM chip + DETOUR marker, caption, progress dots = jump buttons, transport: prev/pause→roam/resume/next/voice/music/replay-narrate/end; floats pb-14 above the legend/zoom chrome so they stay reachable at every width); (4) roam synthesis — a click on a unit WITH a stop jumps the thread there; without a stop, a caption is synthesized (page-provided: reference/flash/distillation use their UNIT_CONTENT .plain stories; AI plants use new roamStep() = registry name + role prose + streams in/out + datasheet + honesty line); (5) useTourAudio refactored to a script-based primitive (script|null + active flag) — speak on script change, music on active; mounted ONCE per page inside the director, so panels opening/closing can never silence a tour.
- SURFACES: reference Workspace, FlashWorkspace, DistillationWorkspace all rewired (director + CinemaBar + TourIndex in panel; click-during-tour = roamTo; camera effects map intents to panTo); "Explore" retired everywhere (mode type 'learn', tabs say Learn, panel toggle is now the PanelRight icon); /plant/p/[id] fully rewired (director + CinemaBar + TourIndex; unit clicks during tours roam; UnitInspector when idle); TourRunner deleted from TutorPanel.
- BUG FOUND + FIXED (pre-existing): the ROLE prose map in tour.ts was keyed by long-form names (hts-reactor, purge-splitter…) while the registry keys are wgs-hts, purge-split… — most roles silently fell back to generic prose in auto-tours. Rewrote ROLE to the real registry keys with full coverage (all 38 types incl. teaching templates + methanol/PSA/Claus units) and added an anti-drift gate to the tests (no ghost keys, no missing keys).
- TESTS: scripts/learn-merge-tests.ts — 43 checks in 6 sections (camera easing/lerp exactness, dwell law, stop lookup, stop resolution, roam synthesis determinism + ROLE↔registry drift gate, naming/wiring source regressions: Explore retired, TourRunner gone, all four surfaces mount director+CinemaBar+TourIndex, flyToRef exposed, interaction cancels flights). Gates: learn-merge 43/43, engine 62/62, graph 35/35, agent 63/63, flow-anim 53/53, tsc + eslint clean.
- LIVE VERIFICATION (agent-browser, seeded v2 plant 'ptest-learn-01' with a 3-stop docent tour): camera flew on tour start (viewBox 1748×360 → zoomed frame); CinemaBar streamed 1/3 GUIDED + caption; TourIndex showed PLAYING; narrator spoke (TTS live); auto-advance fired twice on narration end (1→2→3) and the tour self-ended at the last stop with camera fit (cinema ending); DETOUR roam on a non-stop unit produced the synthesized caption ("This is U4, the high-temp shift… shifts carbon monoxide toward hydrogen over iron catalyst. Datasheet: Adiabatic WGS equilibrium on Fe-Cr…") with camera flight; RESUME returned to the thread + flew back; keyboard deterministic with voice off (arrows step exactly once, stepping past the last stop finishes, space pauses/resumes, esc ends); THE BUG IS DEAD — reference tour speaking, panel hidden → narrator still 'speaking', bar still on stage, tour kept auto-advancing (1/13→2/13) panel-free, TourIndex on reopen; flash + distillation show Learn|Operate with zero 'Explore' tokens and working cinema; flow dots ride the tour camera (57 dots, shared zoomed viewBox); CinemaBar overlaps nothing at 390px or 1440px; home page clean; dev.log + page errors clean; dark + mobile screenshots captured (lm1–lm11).

Stage Summary:
- Learn is now ONE mode with two paces on every surface: Guided cinema (camera flights + bottom captions + narration + auto-advance) and Free roam (click anything → fly + caption card, optional narrate, resume returns to the thread). Explore the name is retired; TourRunner the component is deleted; narration belongs to the page, not the panel.
- The system depends on graph + script, never on a solve — conceptual plants (no engine) will get Learn on day one; Operate simply won't exist for them.
- Files: NEW lib/flowsheet/camera.ts, lib/ui/tourDirector.ts, components/learn/CinemaBar.tsx, components/learn/TourIndex.tsx, scripts/learn-merge-tests.ts, scripts/seed-learn-plant.js. CHANGED BuildCanvas (flyToRef + pts + stopAnim), tourAudio (script primitive), tour.ts (registry-keyed ROLE + roamStep), Workspace/FlashWorkspace/DistillationWorkspace (rewire + rename), plant p/[id] page (rewire), TutorPanel (TourRunner removed).
- Next candidates (deferred, not cancelled): conceptual builds (function catalog + starter symbols + structural critic), freeform physics v4, GitHub push (needs fresh token).
---
Task ID: 32 (Orion + Operate parity + sticky answer bar + push prep)
Agent: main (Super Z)
Task: Give the guide an identity the AGENT can replicate (Orion), kill the Operate scroll friction (results pinned above the levers), and make every AI-built plant land with the same end experience as the prebuilts (Learn | Operate | voice | walk-through | dots).

Work Log:
- STATUS TRUTH: flow animation (task 30) and the Learn merge (task 31) were already shipped + committed — the user's "I thought u already did the flow animation" was right. This session = Orion + friction + parity.
- ORION (one guide, one voice spec, agent-replicable by construction): prompts.ts exports ORION_VOICE — veteran shift supervisor, thirty years on catwalks, plain words, operator intuition, one mechanism per stop, numbers only from the solve facts, introduces himself once in the first stop. docentSystem() embeds it unchanged contract — every tour the agent writes, for every family and every future build, is born in this voice. CinemaBar carries an ORION chip beside the stop counter (visible live: "ORION · 1/4 · GUIDED").
- OPERATE FRICTION (the user's report: change a lever, scroll to find the answer): the AnswerStrip pattern (task 28) already pinned the answer above the levers on the reference — verified live (panel scrolled 393px, strip still fully visible). The REAL gap was that saved AI plants had NO Operate at all.
- OPERATE PARITY — the generalization law, zero per-plant code: NEW lib/projects/operate.ts derives everything from graph + registry metadata. deriveLevers: source units contribute their flow (the throttles, biggest feed first, max 3; controller-owned flows skipped honestly — SRC_AIR is the controller's); process units contribute ONE operating lever each in teaching priority outletT → dischargeP/outletP → any °C → any bar (the reference's feed/hot-section/pressure triad, derived); cap 7; bounds/units/hints straight from SpecField. patchSpec: immutable patch (fresh identity → BuildCanvas + solve caches re-derive; the design point is never mutated — reset is real). answerCells: family KPI headlines (raw rows only) or the generic production/purity/per-pass triple, deltas vs the re-solved design point.
- NEW PlantOperate.tsx (components/builder): the generic control room — sticky AnswerStrip, registry-labelled sliders, converged/warnings footer, honest "doesn't solve" pre-state (no invented numbers; verified live on the unsolvable seeded plant). /plant/p/[id] gets the same Learn | Operate header axis as the prebuilts; operate mode swaps the panel to the control room, the canvas + inspector read the LIVE graph (executeGraph client-side, try/catch honesty), flow dots ride the live solve.
- LIVE VERIFICATION (agent-browser): seeded a REAL v2 record from the live engine (make-parity-plant.ts — reference graph, true solve 795.7 t/d, docent tour in Orion's voice). Tour: ORION chip + camera + caption streaming. Operate: 7 derived levers (steam flow, ng flow, reformer outletT, WHB, intercooler, KO drum, CO2 removal); NG feed 1000 → 1400 answered LIVE: production 795.7 → 1,023.8 t/d (+228.2 delta chip), per-pass −1.4 pt; sticky bar at 0.0px from panel top with 600px scrolled; reset returns to design point; 102 dots animating through it all; reference workspace Operate re-verified (sticky strip visible at 393px scroll).
- HONEST FAILURES OBSERVED (not bugs): two live agent builds FAILed (engineer skipped the shift section on one; missing controller + non-convergence on the other) — the critic judged them 0/100 with actionable suggestions, exactly as designed. Token ledger visible (60.3k on one run).
- BUG FOUND + FIXED (pre-existing): hydration mismatch on /plant/builder — the surprise-brief picker seeded Math.random into useState (server pick ≠ client pick). Fixed SSR-stable: deterministic first brief, random cycling on "Another" (also satisfies react-hooks/set-state-in-effect). Fresh-session builder load: 0 page errors.
- TESTS: NEW scripts/operate-parity-tests.ts — 52 checks in 5 sections (lever law incl. controller-skip/ghost-types/throttle cap/compressor dischargeP priority; patch purity; answer cells both paths; live loop E2E on the reference graph; Orion + parity + sticky anti-drift source gates). GATES: operate-parity 52/52, learn-merge 43/43, agent 63/63, flow-anim 53/53, engine 62/62, graph identity holds, tsc + eslint clean, console clean.

Stage Summary:
- Every plant the agent builds now lands exactly like a prebuilt: Learn (cinema + roam, narrated by Orion), Operate (derived levers, pinned live answer, dots that speed with the flows), critic, remix, export. The same law runs for every family — new families get a control room for free.
- Orion is a spec, not a script: the agent writes every tour in his voice; the brand travels with the content pipeline.
- Files: NEW lib/projects/operate.ts, components/builder/PlantOperate.tsx, scripts/operate-parity-tests.ts, scripts/make-parity-plant.ts. CHANGED prompts.ts (ORION_VOICE), CinemaBar.tsx (chip), plant p/[id] page (mode axis + live solve), SessionPanel.tsx (hydration fix).
- Next: push to GitHub (token pending from user), then conceptual builds (function catalog + starter symbols + structural critic).

---
Task ID: 33 (Cinema polish — streaming captions + YouTube chrome + tour-collapsed panel)
Agent: main (Super Z)
Task: The user's three notes on the Learn cinema: captions must STREAM (not print the whole paragraph at once), the side panel should collapse when a tour starts (better view), and the transport buttons should behave like YouTube (vanish when idle, appear on hover/activity). Then push everything to GitHub.

Work Log:
- STREAMING LAW: new streamFor(text, {voice}) pure law in tourDirector.ts — voice on → 340 ms/word (≈176 wpm, tracks the narrator; floor 1600, ceiling 14000); voice off/blocked/error → 60% of the reading dwell (the reveal is readable as it grows, the tail gets the remaining 40% before auto-advance). NEW useStreamedText hook: rAF-driven word reveal, caret at the tail, prefers-reduced-motion → full text instantly, and the pace is SNAPSHOTTED PER CAPTION (fixed a live-caught bug: the snapshot lived at CinemaBar mount where text='' → duration 0 → instant dump; now refreshed exactly when text changes, so voice toggles mid-caption never rewind it).
- YOUTUBE CHROME LAW: the whole transport row (ORION chip, counter, pace chip, prev/pause/next, voice, music, replay, end) fades AND collapses (grid-template-rows 1fr→0fr + opacity, 300ms, motion-reduce:transition-none) after 2.8s with no activity. Activity = pointermove/pointerdown/keydown/wheel/touchstart ANYWHERE on the window (listeners live for the component's whole life, so the very click that starts a tour always wakes the chrome first). Hovering the bar or focusing inside it keeps the chrome up; paused/roam always shows it. Caption + progress dots + voice status stay visible when hidden — the dots are the scrubber. Hidden chrome is pointer-events:none but still tab-focusable (focusing it brings it back — keyboard users get controls for free).
- CINEMA PANEL LAW: NEW useCinemaPanel(touring) — showPanel = touring ? pinned : panelOpen; a fresh tour resets the pin (render-phase adjust, the React-doc pattern — no effects, no timers, no set-state-in-effect violations); the header toggle pins the panel open mid-tour; an untouched panel returns to its pre-tour state when the tour ends. Wired on ALL FOUR surfaces: reference Workspace, FlashWorkspace, DistillationWorkspace (startTour no longer forces the panel open; enterOperate uses openPanel(true)), and /plant/p/[id] — which previously had NO toggle at all: the aside is now conditional + the page gained the same PanelRight header toggle as the prebuilts.
- ESLint discipline: the react-hooks/set-state-in-effect rule forced clean structure everywhere — no synchronous setState in effect bodies (timer/rAF/media-listener callbacks only); the matchMedia check is a lazy useState initializer.
- TESTS: NEW scripts/cinema-polish-tests.ts — 52 checks in 4 sections (A streaming law exactness: voice 340ms/word with floor/ceiling, silent 60%-of-dwell incl. the dwellFor-clamped tails at 1884/8400ms, voice slower than reading, ≥2 reveal beats; B chrome law: 2.8s beat, all 5 wake channels, 0fr collapse, pointer-events none, hover/focus/paused guards, caption+dots+status survive; C panel law: derived showPanel, pin resets per tour, all 4 surfaces mount the hook, no setPanelOpen(true) regressions, saved plant conditional aside + PanelRight toggle; D wiring: CinemaBar renders {shown} not {stop.text}, caret, streamFor wired, auto-scroll, reduced-motion, per-caption snapshot, rAF reveal, .caret joins the reduced-motion CSS opt-outs).
- LIVE VERIFICATION (agent-browser, all four surfaces): FLASH — tour start collapses panel; caption streams 20→67 chars w/ blinking caret; chrome fades to opacity 0 + rows 0px after idle; mouse move wakes (1 / 38px); space → ROAM + chrome STAYS through 3.5s idle; Esc ends tour → CinemaBar gone, panel restored; mid-tour toggle pins panel open (TourIndex visible) and unpins, end restores. REFERENCE — 13-stop tour: panel collapsed, ORION chip, caption 23→142 chars (~310ms/word ≈ the law), chrome hidden at 3.2s with 15 dots still reachable, mouse move wakes. SAVED PLANT /plant/p/ptest-parity-01 (seeded via make-parity-plant.ts) — panel collapses for the first time on this page, ORION chip, 14→59 chars streaming, chrome hides, pin shows TourIndex mid-tour, end restores panel. DISTILLATION dark mode — panel collapsed, 88 chars streamed, chrome hidden at idle, wake screenshot clean. MOBILE 390px — bottom sheet gone during tour, CinemaBar fits (366px wide, within viewport), caption streaming. Zero page errors; console clean; tsc + eslint clean.
- GATES: cinema-polish 52/52 (new), learn-merge 43/43, operate-parity 52/52, agent 63/63, engine 62/62, graph 35/35, flow-anim 53/53.

Stage Summary:
- The Learn cinema now behaves like a real player: captions arrive word by word as Orion speaks them, the controls vanish when the viewer settles in and wake on any activity, and tours take the full width of the sheet (the panel returns when the tour does — and the saved plant page finally has a panel toggle).
- All three laws are agent-replicable by construction: streamFor/dwellFor are pure laws over the script text, the chrome law is one component (CinemaBar), and the panel law is one hook (useCinemaPanel) wired identically on every surface.
- Files: NEW lib/ui/useStreamedText.ts, lib/ui/useCinemaPanel.ts, scripts/cinema-polish-tests.ts. CHANGED CinemaBar.tsx (streaming + auto-hide chrome), tourDirector.ts (streamFor), FlashWorkspace/DistillationWorkspace/Workspace (cinema panel), plant p/[id] page (cinema panel + PanelRight toggle), globals.css (.caret reduced-motion), .gitignore (tool-results/).
- Next: push to GitHub with the user's fresh token (this commit), then conceptual builds (function catalog + starter symbols + structural critic) remain the queue head.

---
Task ID: 34 (Cinema reposition + true voice sync + Orion nameplate)
Agent: main (Super Z)
Task: The user's notes on the Learn cinema: the bar hovers over the plant, captions stream too fast to sync with the voice, Orion's name is "just there", and the pause button should be at the very bottom.

Work Log:
- ROOT CAUSES: (1) the bar floated pb-14 above the stage bottom — a card over the plant, not player chrome; (2) streamFor assumed 340 ms/word (176 wpm) while the real voice (jam, SPEED 1.15, measured ~87 wpm at 1.0) speaks ~100 wpm — captions ran nearly 2× the voice; (3) the ORION chip was an outlined label like any status chip; (4) the transport row was the FIRST row of the bar.
- THE SYNC LAW (the real fix — the narrator is the clock): narration.ts now exposes scriptOn() (the raw script loading/speaking) and progress() (guarded currentTime/duration of the live audio element). NEW lib/ui/useSyncedCaption.ts replaces useSyncedText (deleted): word k of the caption appears the moment the voice reaches it — a pure function of REAL playback progress, with the title's spoken share as the offset (the voice reads "Title. Text"; the body reveals when the voice reaches the body). SPOKEN ALIGNMENT: every caption word is weighted by its toSpoken expansion ("V-103" = 3 spoken words, "°C" = 2) so chemistry-heavy lines stay aligned to what is actually being said. Honest video semantics: loading holds the caption (never races), pause FREEZES mid-line, resume/replay re-streams from word 1 with the re-read voice, a voice that read ≥97% completes the caption, a voice that dies mid-caption hands over to reading pace, guided+voice WAITS for the voice instead of estimating. Belt-and-braces: speaking-without-duration >1.5 s falls to the recalibrated estimate. Voice flags ride a ref so toggles never re-arm the loop (no mid-caption rewinds).
- CALIBRATION: streamFor voice branch 340→600 ms/word (87 wpm × 1.15 ≈ 100 wpm), ceiling 14000→20000; it is now the fallback only. Auto-advance breath 700→900 ms after the voice ends (the caption now completes WITH the voice, so the viewer needs a beat to land the last words).
- THE DOCK LAW: CinemaBar is flush with the very bottom edge of the stage — full-width w-full border-t (no max-w-720 card, no pb-14 float, no rounded corners), and the row order is the player order: caption → scrubber dots → transport LAST. The pause button sits ~10 px above the viewport bottom; the legend/zoom clusters yield beneath the bar for the length of the tour (the bar IS the stage chrome now). Caption text keeps a max-w-720 measure inside the full-width bar for readable line length.
- THE GUIDE LAW (identity that sticks, zero animation): NEW components/learn/OrionMark.tsx — the Belt (Orion's belt: three four-point stars in a rising line, Alnitak–Alnilam–Mintaka) as a 13px inline SVG + the nameplate: solid ammonia-green plate (C.nh3, his product color) with paper-white letterspaced ORION. On stop 1 — where ORION_VOICE has him introduce himself by name — the plate reads "ORION · YOUR GUIDE"; later stops the compact plate. The identity travels: TourIndex header is now "ORION ON TOUR — {title}" with the Belt, and every launch point names him (reference: "Orion moves the diagram for you… narrated by Orion"; flash/distill: "One guided walkthrough with Orion"; saved plant: "Orion flies the camera unit to unit, captions arrive as he speaks them"). Tooltip is his bio (thirty years on the catwalks).
- TESTS: cinema-polish-tests.ts rewritten around 7 sections — A stream law (600 ms calibration pinned to the TTS route's jam/1.15/87wpm measurement), B sync law (scriptOn/progress source-pinned, spoken-weighted cumulative mapping, freeze/complete/timed/wait paths, liveRef no-rewind, old hook retired), C dock law (flush bottom-0, no pb-14, w-full border-t, row order caption→dots→transport with pause last), D chrome law (unchanged, all patterns preserved), E panel law (unchanged), F guide law (Belt = 3 stars, green plate, first-stop YOUR GUIDE, ORION ON TOUR, launch copy on all four surfaces), G wiring. operate-parity ORION-chip check updated to the nameplate law.
- LIVE VERIFICATION (agent-browser, distillation + reference + mobile): dock gap 0.0px at 1280 and 390 widths, barW = viewport, full width; row Y-order caption 753 < dots 784 < pause 804 (pause bottom gap 10px); plate "ORION · YOUR GUIDE" on stop 1 (bg rgb(63,107,79) = C.nh3), compact "ORION" by stop 4; SYNC MEASURED ZERO-DRIFT — 6 samples across a 51-raw/58-spoken-word line (with kmol/h + °C expansions): shown === spoken-weighted expectation at every sample (raw mapping would have led by 1); pause froze the caption at exactly 25 words for 3+ s with the caret still blinking mid-sentence; resume re-streamed from 1 word at voice p=0.084; chrome hid at 2.8 s idle and woke on mouse move; TourIndex shows ORION ON TOUR + Belt; mobile 390px no overflow, all controls visible; zero page errors, console clean.
- GATES: cinema-polish 93/93 (was 52), operate-parity 52/52, learn-merge 43/43, agent 63/63, engine 62/62, flow-anim 53/53, graph 35/35; tsc (src) + eslint clean.

Stage Summary:
- The Learn cinema is now a real player: the bar is the bottom edge of the stage (caption above, scrubber, pause at the very bottom), captions are driven by the voice's actual audio clock (spoken-aligned, freeze-on-pause, re-stream-on-resume), and Orion has a nameplate — the Belt in ammonia green, YOUR GUIDE on his introduction stop — that recurs at every touchpoint without a single animation.
- The sync law is agent-replicable by construction: it reads the shared narrator singleton, so every tour on every surface (prebuilt, flash, distillation, saved AI plants) gets it for free.
- Files: NEW lib/ui/useSyncedCaption.ts, components/learn/OrionMark.tsx. CHANGED narration.ts (scriptOn + progress), tourDirector.ts (calibration + 900ms breath), CinemaBar.tsx (dock + sync + plate), TourIndex.tsx (ORION ON TOUR), TutorPanel/FlashWorkspace/DistillationWorkspace/plant p/[id] (launch copy), cinema-polish-tests.ts + operate-parity-tests.ts. DELETED lib/ui/useStreamedText.ts.
- Next: GitHub push (token pending), then conceptual builds (function catalog + starter symbols + structural critic).

---
Task ID: 35 (Inside Flowsheet — the architecture learning platform)
Agent: main (Super Z)
Task: Build an interactive learning platform that teaches the owner the important code behind the app (architecture, how things work) so it can be explained at a hackathon or pitch event — explicitly NOT the light/dark-mode commodity code.

Work Log:
- RESEARCH: two parallel Explore agents mapped the whole codebase with verbatim snippet extraction — (a) engine/agent/API/persistence (5,886-line engine internals: Tarjan SCC → tear → Kahn → damped-DS + Broyden, PR Rachford–Rice flash, 35-type registry; 6-role orchestrator, 12-tool cage, jobStore; SSE + TTS + solve routes; IndexedDB records) and (b) frontend (corridor/lane grid router, BFS banded layout, FlowLayer LUT/rAF laws, tourDirector/tourBus, useSyncedCaption spoken-weighted reveal, music ducking, 3D instancing/self-positioning). All key snippets spot-verified against source before embedding (executor.ts 283-298, converge.ts 132-148/166-208, flash.ts 113-133, registry.ts 69-101, workspace.ts 87-104, orchestrator.ts 93-105, llm.ts 113-141, build/route.ts 33-51, builder/page.tsx 236-254, events/route.ts, useSyncedCaption.ts 96-116, music.ts 136-147, tts/route.ts 86-110, route.ts 162-227, flowAnim.ts 67-73, FlowLayer.tsx 179-201, BuildCanvas.tsx 87-131, ShellAndTube.tsx 143-169, ModelStage.tsx 62-70).
- ARCHITECTURE: new route /learn ("Inside Flowsheet") + 8 new files in src/components/inside/ (snippets.ts data, Code.tsx viewer with a ~60-line dependency-free TS tokenizer, bits.tsx chapter shells, EngineLive, AgentRun, WireEvents, VoiceLive, SheetLive, PitchLab). Every demo runs REAL production modules: EngineLive imports run/baseCase and solves the 22-unit reference plant in-tab; VoiceLive drives the real narrator + /api/tts + useSyncedCaption + procedural music ducking; SheetLive mounts the real Diagram + FlowLayer with Canvas.tsx's exact flowSpec derivation. Code artifacts are verbatim with file+line captions and a VERBATIM badge; elisions marked.
- CONTENT: hero + clickable strata stack map (Sheet/Cinema over Wire/Agent/Engine/Rest with LOC), six chapters of 3-paragraph plain-language explanations + LIVE/REPLAY demos + code artifacts + "SAY IT" pitch quotes, and a Pitch Lab chapter: five-beat 60-second script (speakable via the production voice), "numbers worth dropping" grid, and 8 judge-Q&A flip cards (LLM trust, vs Aspen, garbage builds, caption sync, recycle convergence, token cost, SSE vs WebSockets, moat).
- HOME LINK: header gains "Inside the code ↗" (sm+) + footer link.
- FIXES during lint: unescaped apostrophe in AgentRun data (parse error); two react-hooks/set-state-in-effect violations resolved by derivation (VoiceLive progress bar display value; AgentRun playing = playingWanted && n < RUN.length).
- LIVE VERIFICATION (agent-browser + VLM, 13 screenshots learn-01..13): hero/map clean; ENGINE demo solved live — CONVERGED chip, 17 iterations, 113.7 ms measured, KPIs 796 t/d · 99.3% · 28.6% · 3.10 · 2.6× · 33.4 GJ/t, log-scale trace chart with damped-DS (ochre) vs Broyden (green) dots + TOL 1e-7 line, C/H/O/N/Ar/S balance table; AGENT replay plays (role chips light in order, event feed with chips, counters 3/22 units…); WIRE explorer shows frame + contract + gone note; VOICE demo SPOKE — caption "Cold enough to rain…" streaming with caret at 48% progress, narrator state 'speaking', MUSIC GAIN live at 0.30 (ducking fired through the real subscribe wiring); SHEET demo 73 circles on stage, dot transforms sampled twice 700ms apart CHANGED (animation running); PITCH lab flip card flips to YOU SAY; 390px mobile no overflow/cut-offs; dark mode readable; home header link present; zero page errors, console clean, dev.log clean (post-visit).
- GATES: eslint clean; tsc --noEmit clean for src/ (only pre-existing skills/examples errors remain, untouched by this task).

Stage Summary:
- /learn is the explainable twin of the app: six chapters walk the real architecture (engine → agent → wire → sheet → cinema → rest) with live in-browser demos of the actual modules and 20 verbatim code artifacts, ending in a Pitch Lab built for stage delivery (60-second script + numbers + judge Q&A).
- Every interactive piece is the production code, not a mock — the strongest possible answer to "how does it work?" during a pitch: press the button, it solves; press play, it speaks.
- Files: NEW src/app/learn/page.tsx, src/components/inside/{snippets,Code,bits,EngineLive,AgentRun,WireEvents,VoiceLive,SheetLive,PitchLab}.tsx. CHANGED src/app/page.tsx (header/footer link). Next: GitHub push still pending (token), conceptual builds remain the queue head.

---
Task ID: 36 (The Builder's Room — separate learning platform + /learn removal)
Agent: main (Super Z)
Task: User: the "inside the code" learning content must NOT be part of the app at all — it is for the owner only, private, conceptual (no code dumps), deep enough to explain the AI/agent at a hackathon or pitch. Then report the current stage of the app.

Work Log:
- REMOVED the in-app learning platform: deleted src/app/learn/ (route) and src/components/inside/ (9 files); removed both "Inside the code" links from src/app/page.tsx (header + footer). Runtime verified: / 200 with zero references, /learn 404. Kept src/components/learn/* (CinemaBar/TourIndex/OrionMark — the app's cinema UI, not the learning page).
- Deleted dead src/lib/ui/useStreamedText.ts (retired in task 34 but the file survived; nothing imported it; it was the only eslint blocker). src now lints clean; tsc errors = 5, all pre-existing outside src/ (examples/scripts/skills). Deleted files remain recoverable in git history (HEAD still tracks them).
- BUILT THE SEPARATE PLATFORM: download/Flowsheet_The_Builders_Room.html — ONE self-contained offline HTML file (125 KB, zero dependencies, zero connection to the app, double-click to open). Dark control-room theme, ammonia-green + ORION nameplate identity, sidebar with 10 modules + localStorage progress, mobile burger nav, reduced-motion support.
- Modules: 00 Briefing (one-sentence pitch, app surfaces, clickable 6-strata stack map); ★ Follow One Build (10-stage mechanism replay: brief → router → architect → engineer turns incl. the cage refusal → forced solve → critic → docent → cinema, each with an event-feed mock + "if explaining on stage" line); 01 Engine (four moves, PR flash, registry; interactive convergence race — measured "plain substitution: 87 iterations · damped + Broyden: 5"); 02 Agent (six roles deep-dive, 12-tool grid, interactive cage with 3 real refusals, budgets/JSON-repair/token economy, remix law); 03 Wire (11 events, full-snapshot law, fetch-stream + resumable route; interactive stream with kill-connection → Last-Event-ID → gap replay → resume); 04 Sheet (BFS bands, corridor-and-lane SVG with live solved-state dots, label masking, Liang-Barsky); 05 Cinema (interactive sync law: voice-clock caption reveal with spoken weighting V-103=3 / 450=3, title offset, pause freezes mid-line, voice-dies → reading pace; chrome 2.8s law, dock law, 82 BPM duck 0.30); 06 Rest (3D instancing, IndexedDB records, derived operate mode, 15 color slots, token ledger); 07 Pitch Room (five-beat 60s script, 12 numbers, 8 judge Q&A flip cards + shuffle drill, 6 word-for-word sound bites); ≡ One-Pager (whole machine on one screen + three-sentence version).
- All conceptual, ZERO code artifacts — as requested. Every module ends with "why this way", "if they ask" accordions, and a sound bite.
- VERIFIED (agent-browser + VLM): JS syntax OK; walker play/step/reset; convergence demo final counts correct; sync law measured exact (7 spoken = 2 title offset + 5 body words; pause froze mid-line); wire drop → reconnect → 2 gap frames replayed → 14/14 complete; cage refusals render; flip/shuffle; progress persists; VLM: desktop professional, mobile 390px clean (earlier "clip" was a smooth-scroll test artifact); ochre chip contrast brightened (#ddb854). Zero page errors throughout.

Stage Summary:
- The app now ships as the product only — no meta/learning surface. The owner's private study tool is a separate offline file: download/Flowsheet_The_Builders_Room.html.
- Current app stage: all four cinema fixes from the last feedback round are live and were verified in task 34 (CinemaBar docked flush to the stage bottom with caption → dots → pause last; narrator-is-the-clock sync with spoken weighting, measured zero-drift; Orion nameplate + Belt identity at every touchpoint with zero animation; captions repositioned off the plant). Streaming captions, YouTube-style auto-hide chrome, cinema panel law, operate parity (derived levers + pinned answer strip), hydration fix — all in. Gates at last full run: cinema-polish 93/93, operate-parity 52/52, learn-merge 43/43, agent 63/63, engine 62/62, flow-anim 53/53, graph 35/35; tsc + eslint clean for src/. NOTE: work from tasks 32-36 is NOT yet pushed to GitHub (remote holds the earlier fresh-dated commit; push pending user token). Queue head from earlier planning: conceptual builds (function catalog, starter symbols, structural critic).

---
Task ID: 37 (Descriptive-history rebuild + GitHub push preparation)
Agent: main (Super Z)
Task: User: push everything to GitHub with descriptive commit messages (previous ones "not very descriptive"), report next steps, evaluate whether machine learning fits the product, and plan toward an eventual VR experience.

Work Log:
- DIAGNOSED the history: local main was [root fa23d93] -> [1e94243: UUID-named squash of tasks ~28-35] -> [39aa55c: UUID-named tasks 35-36]; remote origin/main (github.com/I-PHEN/FlowSheet) held [same root] -> [3be6d69 UUID: mode-only housekeeping] -> [eight descriptive commits b68aa45..b055f43] -> [0209490 UUID = task 30, d760fee UUID = task 31] -> [ca340aa task 32, 0ef4332 task 33] -> [08a8a1e: an EMPTY merge of the superseded pre-reset snapshot 42814b3 — diff over 0ef4332 proved empty, safe to linearize away]. Remote was missing task 34 (voice-sync/dock/nameplate) and tasks 35-36 entirely.
- REBUILT the history (scripts/git-history-rebuild.sh): reworded the three UUID commits (3be6d69 -> file-mode housekeeping; 0209490 -> flow animation task 30; d760fee -> learn merge task 31), preserved the eight descriptive remote commits verbatim (same trees, same authorship, same dates, rebuilt via commit-tree), then sliced the local squash delta into three honest commits on top of task 33: e52bffa task 34 (cinema dock + narrator-clock sync + Orion nameplate — 13 precise file paths), 28a9c5a recovered pre-reset features (Teaching Blueprint v2, SavedPlants library, GLB/remix assets, gates/probes, tool-results untracking, mode cleanup), 653772e Builder's Room + app-ships-product-only (tree = previous main tree VERBATIM).
- SAFETY + VERIFICATION: backup/pre-push-20260920 branch holds the old main; final tree hash identity verified before moving the branch (c5bb482e5c53687421b2c7ef63c758c45b4db1be == c5bb482e5c53687421b2c7ef63c758c45b4db1be, zero content drift); new history = 15 commits, every one descriptive, chronological order preserved. history-backup (20 pre-reset commits, descriptive) confirmed NOT an ancestor of main — to be pushed as a branch too, per "push everything".
- PUSH BLOCKED ON AUTH: no GitHub token exists in this session (no GH_TOKEN/GITHUB_* env, no ~/.git-credentials, no ~/.netrc, no gh CLI, nothing in .env or shell history; anonymous fetch works because the repo is public). Dry-run push fails: "could not read Username for 'https://github.com'". Everything is staged for a one-command push the moment the user supplies a fresh token: git push --force-with-lease=main:08a8a1e93dbffb25992c54fb276b0f1e001c4c04 origin main; git push origin history-backup; git push origin 42814b3:refs/heads/history/pre-reset-v3.

Stage Summary:
- main now carries a clean, fully descriptive 15-commit history (root -> mode housekeeping -> engine+families -> agent v3 -> family tuning -> flow dots -> worklog -> token economy -> flow animation -> learn merge -> Orion+operate parity -> cinema polish -> cinema dock+sync+nameplate -> recovered pre-reset features -> Builder's Room) with identical content to the verified working tree; nothing lost (the only dropped remote object was an empty merge; the superseded pre-reset line is preserved as its own branch for the push).
- Push pending user token (previous sessions' tokens did not persist into this sandbox).
- Queue after push: conceptual builds (function catalog, starter symbols, structural critic), then the ML layer and VR foundation discussed with the user in this session's reply.

---
Task ID: 38 (GitHub push executed: descriptive history live on all three branches)
Agent: main (Super Z)
Task: User supplied a fresh fine-grained PAT; push the rebuilt descriptive history to github.com/I-PHEN/FlowSheet.

Work Log:
- AUTH: token wired through a temporary credential-store file (no persistence, no token in any committed file or remote URL); remote verified still at 08a8a1e before the push.
- PUSH main: force-with-lease (08a8a1e -> f5dfb9f) — the 16-commit fully descriptive line is now the public main (root -> engine+families -> agent v3 -> tuning -> flow dots -> worklog -> token economy -> flow animation -> learn merge -> Orion+operate parity -> cinema polish -> cinema dock+sync+nameplate -> recovered pre-reset features -> Builder's Room -> task-37 worklog).
- ARCHAEOLOGY + REBUILD of the pre-reset lines so no UUID commit appears anywhere on GitHub: mapped every one of the 12 UUID commits in the original development line to its worklog milestone (research plan -> engine+workbench phases 1+2 -> product re-plan -> interface rebuild -> console deletion+dark mode -> minimal operate -> flowsheet-as-data D1 -> the agent MVP -> verification sweep -> Flow-style studio -> recovery research -> rollback recovery), rewrote each with an honest descriptive message preserving trees, authors, and dates byte-for-byte (scripts/git-history-branches.sh; tree identity verified for both tips before refs were created). The v3 line (42814b3 "Plant families + agent-authored tours") was rebuilt on top of main's reworded mode-housekeeping commit (0dac89d) so it chains into the shared root.
- PUSHED history/pre-reset-builds (20 commits: the original Aug 29 -> Sep 15 development story — engine core 61/61 gate, interface pivot, Engine 2.0 flowsheet-as-data, the agent MVP, the studio, sandbox recoveries, 3D Component Viewer MVP and fixes) and history/v3-pre-reset (the previously-pushed v3 snapshot, now message-clean).
- NOT pushed: backup/pre-push-20260920 (local safety net holding the pre-rebuild UUID-squash line; zero unique content — its tree equals main's).

Stage Summary:
- GitHub now shows: main (product, 17 commits after this entry, every message descriptive), history/pre-reset-builds (the real three-week build story), history/v3-pre-reset (the v3 snapshot line). No UUID commit messages anywhere. Everything the user asked to push is pushed.
- Note flagged to user: the Builder's Room file is public inside the repo (user raised no objection; can be pulled out on request).

---
Task ID: 39 (Builder's Room pulled from the public repo)
Agent: main (Super Z)
Task: Owner: pull the Builder's Room file out of GitHub — it is private study material, not part of the public story.

Work Log:
- Rebuilt the three commits that carried the tutor artifacts (the task 35-36 commit and both worklog commits) with the 16 builders-room paths excluded from their trees; the task 35-36 message adjusted to stay honest — the tutor was built, the artifact is intentionally not published, it lives offline with the owner.
- .gitignore guards added (download/Flowsheet_The_Builders_Room.html, scripts/builders-room/) so no future commit re-adds them; the owner's local copy on disk is untouched and now ignored.
- Verified before moving the branch: zero commits on the new line touch the dropped paths; the only diff old-tip -> new-tip is the 16 deletions plus the .gitignore guard.
- Old line (with the file) preserved locally on backup/builders-room-20260920 — local safety net, never pushed.

Stage Summary:
- The public repo now carries no copy of the tutor or its build scaffolding anywhere in main's history; pushed with force-with-lease after verification. Owner keeps the offline file.

---
Task ID: 40 (Session A — the hero sells Orion too: three beats, Meet Orion section, card chips)
Agent: main (Super Z)
Task: Owner: now that Orion exists, the hero must market him (and the 3D) — the app's two invisible magics. Plan first (approved), then build Session A. Law: NOT cumbersome — tight copy, one compact section, no bloat.

Work Log:
- HERO: three-beat chip row under the H1 (BUILT BY AI → TAUGHT BY ORION → EXPLORED IN 3D) in the app's mono-chip language — the middle chip is Orion's solid ammonia-green plate with the Belt, the outer two are quiet bordered chips; all three claims true today. Body paragraph revised: the weak "narrated, scored tour" clause replaced with the two magics — "a guide named Orion — a thirty-year shift supervisor — walks you through it in voice, and every unit opens for inspection in 3D." H1 and CTAs untouched (tested, tight).
- MEET ORION (NEW components/home/MeetOrion.tsx): compact two-column section between hero and projects. Left: MEET YOUR GUIDE kicker, the large nameplate (Belt + ammonia-green ORION), bio line "Thirty years on the catwalks. Now he lives in your browser.", three one-line law bullets, text CTA into the reference tour. Right: the voice card — marketing by demonstration: one button plays his introduction through the REAL pipeline (narrator singleton → /api/tts → useSyncedCaption sync law), the caption streaming word-by-word with the caret exactly as he speaks; player semantics on one button (▶ Hear Orion → ■ Stop → ↺ Replay; Stop returns to the resting invite — no half-frozen lines in a marketing card); honest states (warming/voice-unavailable-reading-instead); leaving the page cuts his line; blob cache makes the sample cost once. His intro is written to the ORION_VOICE spec (plain words, operator senses, name once, no formulas).
- CARD CHIPS: every learning-path card carries a tiny Belt+ORION chip beside its title (all three plants are narrated by him); the reference card description now ends "— and every unit opens in 3D."
- VLM REVIEW: took one suggestion — the voice-card header now reads ORION'S INTRODUCTION (stands alone when cropped for a deck). The other two suggestions targeted pre-existing hero elements (paper card in dark mode, hero spacing) — the established visual language, left alone.
- LIVE VERIFICATION (agent-browser): chips render (3 beats); Hear Orion clicked → warming holds → caption streams with caret ("Name's Orion. Thirty" → "…catwalks — I've" at 3s intervals, voice pace) → completes exactly at voice end → button becomes Replay; Replay re-streams from word 1; Stop returns to invite; zero page errors; mobile 390px no overflow (one transient SVG rect mid-refresh, re-check clean); console clean.
- GATES: cinema-polish 93/93, operate-parity 52/52, learn-merge 43/43, agent 63/63, engine 62/62, flow-anim 53/53, graph identity holds; tsc (src) 0 errors; eslint clean.

Stage Summary:
- The landing page now tells the whole story in one scan — three beats in the hero, Orion introduced with his real voice a scroll away, every card carrying his name. Marketing by demonstration, zero new animation, zero bloat: one section, one button, three chips.
- Files: NEW src/components/home/MeetOrion.tsx. CHANGED src/app/page.tsx (chips + paragraph + MeetOrion mount + card chips + reference 3D copy).
- Session B (queued): the 3D marketing section (lazy viewer + the 2D→3D "same unit, two views" pairing) + OG/meta tags + footer beat line.
