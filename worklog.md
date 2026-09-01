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
