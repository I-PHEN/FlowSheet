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
