# Landscape Scan — Ammonia Plant Builder Agent (Task 2-a)

**Scope**: what already exists in process simulation, educational sims/OTS, AI engineering tutors, ammonia-specific tools, and digital-twin education — to position the "Ammonia Plant Builder Agent" (deterministic Python engine + LLM voice narration/what-if + 3D render, for ChemE students).

**Method**: 24 web searches via z-ai CLI (July 2026). Facts below cite source URL + site. Items marked *(inference)* are analyst conclusions, not sourced facts.

---

## 1. Commercial Process Simulators

| Product | Vendor | Cost / access facts | Source |
|---|---|---|---|
| Aspen Plus / HYSYS | AspenTech (Emerson) | Commercial single license "varies from 30K to more than 100K" USD/yr | chemicalengineeringguy.com/blog/process-simulation/what-is-aspen-plus |
| Aspen Plus / HYSYS | AspenTech | "A single yearly license can run $10k–$100k/year" (startup's characterization) | alkali.engineering/blog/introducing-ape-0-beta (Apr 23, 2025) |
| Aspen student offer | AspenTech | University students offered Aspen Plus OR HYSYS at **$100 USD (promoted as worth $2,700)**, Sep 2023 limited-time | esupport.aspentech.com/S_Article?id=000101413 |
| Aspen academic program | AspenTech | Academic Program gives universities 50+ AspenTech products for teaching/not-for-profit research; enrollment through institution, not individual walk-up | aspentech.com/en/academic-program-for-education; esupport.aspentech.com (Academic-Community-Exchange, May 16, 2025) |
| Aspen (community-reported) | Reddit r/ChemicalEngineering | Students report ~$50/yr via university portal options; desktop/tokenized tiers far higher — community figures, treat as unconfirmed | reddit.com/r/ChemicalEngineering/comments/1e6lld0/aspen_pricing |
| AVEVA PRO/II (ex-SimSci) | AVEVA | Steady-state simulator; integrates HTRI, OLI, Koch-Glitsch, MySep; no public price, quote-only. Capterra listing shows no public price | avea.com/en/products/pro-ii-simulation; capterra.com/p/144084/SimSci |
| AVEVA Process Simulation / Dynamic Simulation | AVEVA | Cloud or on-prem; dynamic simulation sold with "runtime licenses for use in operator training simulators" | avea.com/en/products/dynamic-simulation |
| Honeywell UniSim Design | Honeywell | "Intuitive, comprehensive and cost-effective"; **free 60-day trial licenses** offered; Windows desktop only; UniSim considered OK "just to learn the basics" by users | process.honeywell.com/us/en/products/industrial-software/process-optimization/unisim-design-suite; cheresources.com/invision/topic/7537-unisim-software; reddit.com/r/ChemicalEngineering/comments/8zofh4 |
| VMGSim | VMG (now part of Honeywell) | No public pricing surfaced in any search; quote-only enterprise product *(inference from absence of pricing pages)* | process.honeywell.com UniSim product pages (VMG acquired by Honeywell) |
| ChemCAD | Chemstations / Datacor | No public price; **free to students at universities with site licenses** (e.g., UIUC webstore: "Chemcad License & Download — Free"; University of Alabama: "No cost for eligible users"); licenses available for all undergrads/grads/professors via academic program | webstore.illinois.edu/shop/product.aspx?zpid=1216; oit.ua.edu/software/chemcad; datacor.com/solutions/education |
| ProcessModel (adjacent market datapoint) | ProcessModel Inc. | Listed at **$1,656/year/user** — the only process-simulation price found in the open | slashdot.org/software/p/AVEVA-PRO-II-Simulation/alternatives |
| AspenTech AI (incumbent response) | AspenTech | V15 (May 2025) adds "expanded AI capabilities," generative AI for facility layout options; Aspen Hybrid Models embed AI/ML in Aspen Plus/HYSYS | aspentech.com/en/whats-new; emerson.com (May 13, 2025); hydrocarbonprocessing.com (May 13, 2025) |

**Why they're NOT accessible to students** *(inference, backed by sourced facts)*:
- Upfront cost ($10k–$100k+/yr commercial; even the promo student price is $100 for 1 product for a limited window).
- Institutional gatekeeping: student access flows through university site licenses and VPN/VM setups (Reddit: ChemCAD "run on a VM through the university").
- Windows-desktop install + license servers; heavyweight GUIs with steep learning curves (Belton 2016 paper documents the teaching burden of steady-state simulators: eprints.hud.ac.uk/id/eprint/29357).
- No narration, no natural-language interface, no pedagogical layer — they are professional tools.

---

## 2. Open-Source / Free Simulators

| Tool | What it is | Status / maturity | Source |
|---|---|---|---|
| **DWSIM** | Full-featured open-source chemical process simulator; steady-state + dynamic, sequential-modular; 35+ unit ops; rigorous thermo incl. NIST ThermoML; CAPE-OPEN compliant (property packages 1.0/1.1); scriptable from Python, C#, VB.NET, COM; cross-platform (Win/Linux/macOS); iOS app exists; GPL license | Very active (SourceForge update Oct 28, 2025); "crown jewel of open-source process simulators" (Simulate Live, Jul 2025). **DWSIM 10 ships an AI Assistant** (patron-preview): "build, modify, and analyze flowsheets through natural-language commands" | dwsim.org; sourceforge.net/projects/dwsim; github.com/DanWBR/dwsim; dwsim.org/wiki/index.php?title=CAPE-OPEN; dwsim.org/tutorials/en/features/ai-assistant.html; linkedin.com/posts/daniel-medeiros-6a3b9124 (DWSIM 10 AI Assistant Preview); apps.apple.com/us/app/dwsim-simulator/id1162110266; simulatelive.com (Jul 1, 2025) |
| **COCO (COFE)** | Free CAPE-OPEN-to-CAPE-OPEN steady-state sequential-modular flowsheet environment (AmsterCHEM); graphical COFE GUI; free-of-charge, non-commercial | Mature but niche; used as the reference free CAPE-OPEN host | cocosimulator.org; amsterchem.com/coco.html; en.wikipedia.org/wiki/COCO_simulator |
| **ASCEND** | Equation-based, object-oriented mathematical/chemical process modeling environment, Carnegie Mellon, developed since 1978 | Historic; largely dormant academic project | en.wikipedia.org/wiki/ASCEND; ascend4.org/Publications |
| **IDAES-PSE** | Institute for the Design of Advanced Energy Systems — DOE-funded Python process modeling framework & model library on Pyomo; equation-oriented; "full process modeling lifecycle from conceptual design to dynamic optimization"; open-sourced 2019; current v2.13 | Actively maintained (DOE National Lab program); steep Pyomo learning curve *(inference)* | idaes.org; idaes-pse.readthedocs.io; aiche.onlinelibrary.wiley.com/doi/10.1002/amp2.10095 (Apr 2021); cs-newsarchive.lbl.gov (Mar 22, 2019); pypi.org/project/idaes-pse |
| **OpenModelica + OMChemSim** | FOSSEE (IIT Bombay) chemical component library in Modelica; steady-state & dynamic; "Chemical Engineering Flowsheets at FOSSEE" course materials | Research/teaching grade; Nayak & Dalve 2019 (I&EC Research, cited 19) reports unit-op library | om.fossee.in/chemical; github.com/FOSSEE/OMChemSim; pubs.acs.org/doi/abs/10.1021/acs.iecr.9b00104; openmodelica.org/useresresources/modelica-courses |
| **NeqSim** | Equinor's open-source Java library for fluid behavior, phase equilibrium, process simulation; usable via Python toolbox, Streamlit web app, Colab notebooks; docs include "Industrial Agentic Engineering with NeqSim" (LLM-agent workflows) | Mature (oil & gas focus); niche for teaching | equinor.github.io/neqsimhome; github.com/equinor/neqsim; neqsim.streamlit.app; equinor.github.io/neqsimhome/doc/agentic%20engineering/book.html |
| **ThermoPack** | SINTEF Energy / NTNU thermodynamics library (Python/Fortran) for multicomponent multiphase fluid property calculations; open source (SINTEF blog Dec 10, 2024) | Active; property layer, not a flowsheet solver | github.com/thermotools/thermopack; pypi.org/project/thermopack; blog.sintef.com (Dec 10, 2024) |
| **OpSim** | Open-source ChemE process simulator with drag-and-drop GUI and "high performance" engine | Smaller community project | github.com/opsim/opsim |
| **ProcessSimulator.jl** | Julia chemical process modeling package built on ModelingToolkit.jl (community discussion, Jan 2024) | Early-stage | discourse.julialang.org/t/109236 |
| pyCalSSS | Not found in searches — no relevant results returned; likely defunct or extremely niche *(inference from zero search hits)* | — | (no sources found) |

**Free-vs-build verdict** *(inference)*: DWSIM and IDAES already give away the "engine" layer for free — the sequential-modular solver, unit ops, and thermo are commodity. What they do NOT give: a browser-only zero-install experience tuned for a single teachable plant, ammonia-specific pedagogy, voice, 3D, or an LLM that narrates and answers what-ifs against the live solve. Building a ~9-unit-op custom engine remains justified for determinism, narrative control, and teaching-grade transparency (every number explainable), not because free engines are unavailable.

---

## 3. Educational Process Simulators / Games / Operator Training Simulators (OTS)

**Teaching simulators:**
- **LearnChemE (Univ. of Colorado Boulder)** — 320+ interactive ChemE simulations; more than half run directly in the browser; plus screencasts (some with embedded questions) and 35+ self-study modules; free; won the Chemical Engineering Division education award (2021). The single largest free interactive ChemE resource. — learncheme.com; learncheme.com/simulations; cache.org/interactive-simulations-chemical-engineering; colorado.edu/chbe (Jun 2, 2021); colorado.edu/faculty/falconer/teaching
- **"Control a Haber-Bosch Ammonia Plant"** (Learner.org / Annenberg) — free interactive ammonia plant game with lesson plan and student worksheet; AP-chemistry level: manipulate N2/H2 feed, T, P for equilibrium yield. It is equilibrium-only — no reforming front end, shift, methanation, recycle/purge loop, or compressors. — learner.org/wp-content/interactive/haberplant/haber.php; studocu.com (AP Chemistry lab based on it)
- **ChemCAD Haber-Bosch teaching module** — peer-reviewed scaffolded teaching module using commercial ChemCAD to simulate industrial Haber-Bosch (Aug 2026, Currents in ChemE Education / ScienceDirect) — confirms educator demand for exactly this scenario, but requires a commercial license. — sciencedirect.com/science/article/abs/pii/S1749772826000254 (Aug 5, 2026)
- **TSC Simulation (UK)** — sells cloud-based process simulation packages purpose-built for university engineering education ("bring real industrial process experience into the classroom"). — tscsimulation.com/cloud-based-process-simulation-for-engineering-education (Jul 14, 2026)
- **IFP School Lab e·nov** — IFPEN uses VR + gamification to teach industrial professions. — ifp-school.com/en/innovation-and-research/lab-enov
- **Bode-Staud 2025** — academic tool for individualized flowsheet-simulation examinations (Assessment-type educational sim). — sciencedirect.com/science/article/pii/S1749772825000156
- **Simsu** — could not be verified in any search; no product of this name surfaced for process education *(treat as non-existent/unverified)*.
- **Factorio / Factorio Learning Environment** — entertainment factory-building game; its FLE variant is used as an LLM-agent benchmark — demonstrates the appeal of "build and operate a plant" gameplay but with zero real thermo. — wiki.factorio.com/Chemical_plant; arxiv.org/html/2503.09617v1 (Mar 6, 2025)

**Industrial OTS (operator training simulators) — how they work & cost:**
- OTS = high-fidelity dynamic model of the plant + emulated DCS/control system + instructor station to inject faults and score trainees. Vendors: Honeywell (UniSim Operations/OTS), AVEVA (Dynamic Simulation "runtime licenses for use in operator training simulators"; instructor tools to build scenarios and track trainees), Yokogawa (OTS "virtual plant on your computer… train ahead of plant start-up"), Emerson (DeltaV Simulate Pro — high-fidelity model developed during design "evolves into" the OTS), GSE Solutions. — process.honeywell.com; avea.com/en/products/operator-training-simulator; yokogawa.com/us/solutions/.../operator-training-simulator; emerson.com/documents/automation/article-getting-real-deltav-en-56516.pdf; gses.com/solution/training
- **Refinery/plant OTS cost: $800,000–$1.5M per installation** (Dataintelo refinery OTS market report). — dataintelo.com/report/operator-training-simulators-for-refineries-market
- OTS market size: ~USD 12.4B (2024) → 35.7B (2032), 14.1% CAGR (Credence Research); other estimates: $2.4B 2024 (Strategic Market Research), $12.57B 2023 → $34.96B 2032 (Zion). Ranges vary widely by definition. — credenceresearch.com/report/power-plant-simulators-market; strategicmarketresearch.com; zionmarketresearch.com
- GSE Solutions: 173 nuclear, 208 fossil, 114 process simulators delivered since 1971. — gses.com/solution/training
- Published academic OTS-for-teaching example: biodiesel plant OTS (Ahmad 2016, cited 36). — sciencedirect.com/science/article/abs/pii/S0957582015001809
- Automation World: OTS used not just for training but for 'what if' scenarios and troubleshooting — validates the what-if loop as a core OTS use case. — automationworld.com/products/control/article/13299078

---

## 4. AI + Engineering Education Tools (2024–2026)

**General AI tutors:**
- **Khanmigo (Khan Academy)** — flagship general AI tutor; continuous improvement blog (May 1, 2026); efficacy studies mixed: Slijepcevic 2025 found positive student perceptions (step-by-step guidance); a 2025 Harvard/Khan-related study (Education Next, Dec 2024) attributed effectiveness to pedagogical design; skeptics note motivation limits (LinkedIn commentary on Khan research). Coverage is K-12/foundational — no chemical engineering content. — blog.khanacademy.org (May 1, 2026); jtl.uwindsor.ca (Slijepcevic 2025); educationnext.org (Dec 3, 2024); khanacademy.org
- No AI-tutor product specific to chemical engineering surfaced in any search — only studies of ChatGPT use: "ChatGMP: AI chatbots in chemical engineering" (Caccavale 2025, cited 36); ChatGPT in ChemE lab-report writing (Das 2025, ASEE); PNAS "Could ChatGPT get an engineering degree?" (Borges 2024, cited 78 — LLMs can pass many engineering assessments). — sciencedirect.com/science/article/pii/S2666920X24001577; peer.asee.org; pnas.org/doi/10.1073/pnas.2414955121
- Students report ChatGPT "answers almost all the answers incorrectly" for ChemE homework — evidence for a deterministic-engine-backed tutor instead of raw LLM. — reddit.com/r/ChemicalEngineering/comments/18f1x04
- Columbia Engineering deploying AI course assistants across departments (Aug 2025); MIT generative-AI reaction prediction (Sep 2025). — engineering.columbia.edu/about/news/ai-enhanced-education; news.mit.edu/2025/generative-ai-approach-to-predicting-chemical-reactions-0903

**AI × process simulation — startups:**
- **Alkali (YC S25→launch May 21, 2025, San Francisco)** — "The AI Copilot for Chemical Process Design"; product **ProcessMate**: catches process design errors, automates equipment sourcing/procurement; targets professional engineering teams. — ycombinator.com/launches/NZM-alkali-the-ai-copilot-for-chemical-process-design; alkali.engineering/blog/introducing-ape-0-beta; startupintros.com/orgs/alkali
- **MaximaLabs** — browser-based process simulator ("zero install, nothing to license on a workstation"), **60+ unit operations, AI copilot (generative + diagnostics)**, Python SDK and Excel add-in; pricing: **Free tier ($0/mo, "for learning," includes AI copilot) and Team $299/mo (2,000 solves)** with usage-based pricing beyond. The closest thing to this project's delivery model, but aimed at professionals. — maximalabs.io/free-process-simulator; maximalabs.io/process-simulation-software; maximalabs.io/pricing
- **ChemCopilot** — "Democratizing Chemical Process Simulation: AI Agents" for bio-based manufacturing scale-up (blog, Oct 13, 2025). — chemcopilot.com/blog
- **DWSIM AI Assistant** (see §2) — NL flowsheet building in the free simulator itself (DWSIM 10 patron preview). — dwsim.org/tutorials/en/features/ai-assistant.html
- **Entalpic** — AI for chemistry/materials R&D (adjacent, not process simulation). — entalpic.ai

**AI × process simulation — research (not products):**
- "Text-to-flowsheet: an LLM-assisted pipeline for expert-level [flowsheet generation]" (RSC Digital Discovery, May 25, 2026) — converts natural-language descriptions into flowsheets. — pubs.rsc.org/dd/article/5/7/2937/1261859
- "Large Language Model Agent for User-friendly Chemical Process Simulation" (J. Liang, 2026, cited 10; arxiv Jan 30, 2026) — flowsheet analysis/synthesis from NL commands. — sciencedirect.com/science/article/pii/S2772508126000256; arxiv.org/html/2601.11650v2
- "Sketch2Simulation" (Bahamdan et al., AIChE 2026; arxiv Mar 25, 2026) — multi-agent LLM converts process diagrams into executable Aspen HYSYS flowsheets. — aiche.confex.com/aiche/2026/meetingapp.cgi/Paper/731164; arxiv.org/html/2603.24629v1
- AAAI 2026: multi-agent LLM workflow for automated chemical process synthesis (Tian et al., cited 5). — ojs.aaai.org/index.php/AAAI/article/view/40215
- "Multi-agent systems for chemical engineering" review (arxiv, Aug 11, 2025). — arxiv.org/html/2508.07880v1
- AutoChemSchematic AI — closed-loop, physics-aware agent that verifies DWSIM material/energy balances (arxiv, May 30, 2025). — arxiv.org/html/2505.24584v1
- **IChemE Education SIG webinar (Aug 13, 2026): "AI-Copilot for Chemical Process Design Education: Intelligent Automation with Aspen Plus"** — an LLM-powered Copilot framework for Aspen Plus pitched explicitly for design education. Direct evidence the education establishment is moving this way — but still tethered to paid Aspen. — icheme.org/knowledge-networks/.../13-08-2026-ai-copilot-for-chemical-process-design-education
- Benchmarking LLM prompts across chemical PSE domains (Sukpancharoen, 2026). — sciencedirect.com/science/article/pii/S266682112600342X

---

## 5. Ammonia-Specific Landscape

- **Green ammonia boom**: market estimates vary wildly by analyst — $1.57B (2024) → $672B (2035) at 73.5% CAGR (MarketResearchFuture); >$3.4B (2025) → $170.5B (2035) (Research Nester, Feb 2026). All agree on explosive growth off a small base. — marketresearchfuture.com/reports/green-ammonia-market-11519; researchnester.com/reports/green-ammonia-production-market/8384
- **IEA Global Hydrogen Review 2025** (Sep 12, 2025): low-emissions hydrogen grew 10% in 2024, on track for 1 Mt in 2025 — still <1% of global production; 200+ committed low-emissions projects; ammonia is the dominant hydrogen carrier vector (IRENA analysis: ammonia predicted "the most" traded hydrogen-based commodity flow by 2050). IEA also estimates ammonia production capacity must grow ~40% by 2050. — iea.org/reports/global-hydrogen-review-2025 (+executive-summary); irena.org/Energy-Transition/Technology/Hydrogen; ammoniaenergy.org/organization/international-renewable-energy-agency-irena; congress.gov (citing IEA)
- **Ammonia Energy Association (AEA)**: provides LEAD (Low-Emission Ammonia Data) files on plants/infrastructure/vessels and launched the global Ammonia Certification System (pilot from Sep 2025; full launch with MiQ Apr 2026). Data/certification tools — **no simulator or educational tool offered**. — ammoniaenergy.org; ammoniaenergy.org/certification; fuelcellsworks.com (Apr 27, 2026)
- **Workforce demand**: UK Hydrogen Skills Alliance — hydrogen workforce must grow to >25,000 by 2030; EU "Green Skills for Hydrogen" VET curriculum; UNIDO green-hydrogen skills-gap methodology; South Africa found 24 needed degree/diploma programmes not currently offered. Strong documented demand signal for ammonia/hydrogen training content. — knowledge.energyinst.org (Oct 8, 2025); hydrogenera.eu (Aug 18, 2025); hydrogen.unido.org/skills; dhet.gov.za (Apr 2024)
- **Ammonia plant simulation in academia**: flexible small-scale green ammonia plants modeled in Aspen Plus (de la Hera et al., MDPI 2024, cited 30); simplified low-cost Haber-Bosch lab experiment published in J. Chem. Educ. (Marcolan). Both confirm ammonia is a hot teaching/research topic — but both assume commercial simulators or wet labs. — mdpi.com/2076-3298/11/4/71; pubs.acs.org/jceda8/article/103/7/3876/5158782
- **Publicly available interactive ammonia tools**: only the Learner.org Haber equilibrium game (§3). No full-flowsheet (reforming→shift→methanation→synthesis loop) ammonia simulator surfaced in any search — free, paid, or academic. *(inference: verified absence across 24 searches)*
- Casale/KBR/topsoe technology licensors were not surveyed — industrial licensing market, not education (excluded by scope).

---

## 6. Digital Twins & 3D/VR in Chemical Engineering Education

- **Systematic review**: "Virtual reality in chemical and biochemical engineering education" (Kumar et al., 2021, cited 218) — VR mainly used "as a visualisation environment for viewing 3D models of process plants"; benefits documented but adoption limited by cost/development effort. — sciencedirect.com/science/article/pii/S1749772821000324; orbit.dtu.dk (full PDF)
- **Digital twins for learning**: Galeazzi et al. 2024 (Politecnico di Milano, cited 7) — digital twin tech in engineering education incl. "3D plant experiences". — re.public.polimi.it (PDF)
- **Full-scale VR plant**: Queen's University (Hungler 2022) — full-scale VR chemical processing plant as immersive learning app, incl. a "broken plant" troubleshooting tutorial. — ojs.library.queensu.ca/index.php/PCEEA/article/view/15949
- **VR immersive learning** studies report students exploring reactors, distillation columns, heat exchangers in 3D virtual plants with gains in understanding of scale/process. — journal-center.litpam.com (e-Saintika)
- Digital-twin tech in chemical plants (industrial): multi-domain/multi-time-scale platforms with model libraries (Zhang 2024, cited 16); commercial digital-twin solutions (iFactoryApp). — newswise.com (PDF); ifactoryapp.com/industries/chemical-plant
- **What's missing in this literature**: none of the published VR/digital-twin education work couples the 3D walkthrough to a *live editable process simulation with an AI narrator* — they are visualization layers over static or instructor-built scenarios. *(inference from review scope)*

---

## WHITE SPACE ANALYSIS

What NOBODY currently offers (each verified absent across the searches above):

1. **Voice-native plant simulator**: every voice-AI-in-education product found targets K-12/language learning; no engineering tool speaks (TTS narration of a live flowsheet) or listens for spoken what-ifs. DWSIM AI, MaximaLabs copilot, Alkali — all text-based.
2. **Free, full-flowsheet ammonia teaching simulator**: Learner.org covers equilibrium-only; the ChemCAD Haber-Bosch teaching module (Aug 2026) needs a commercial license; nothing models reforming→shift→methanation→compression→synthesis-loop→condense→recycle/purge for free in a browser.
3. **LLM what-if loop against a deterministic engine, free for students**: MaximaLabs has an AI copilot but the platform targets professional teams ($299/mo tier); Text-to-Flowsheet and Liang 2026 are research pipelines, not deployable teaching products; DWSIM 10 AI is a patron-preview desktop app.
4. **3D render data-bound to the live solve**: published VR plants are static visualizations or scenario replays; none map stream compositions/temperatures onto equipment in real time as the student changes parameters.
5. **Natural-language "build me a 500 t/d plant" intake for learners**: Sketch2Simulation/Text-to-flowsheet aim at experts generating Aspen files; no student-oriented NL build of a guided, constrained (physically sane) flowsheet exists.
6. **Student-accessible fault-injection operator training**: industrial OTS costs $800K–$1.5M; a free "trip the LT-shift, diagnose via voice" mode would be the first OTS-style experience a student can get without an employer.
7. **Exportable PFD + mass/energy balance tables from a chat tool**: no free tool exports instructor-grade deliverables from an AI-guided session.
8. **Ammonia/hydrogen-transition curriculum integration**: documented skills gap (UK >25k hydrogen workers by 2030; 24 missing SA degree programmes) with zero dedicated interactive teaching simulators addressing it.
9. **Single-plant depth over generality**: LearnChemE has 320+ single-concept widgets; no free tool offers *one deeply modeled plant* with narrated story (why each unit exists, what breaks when you starve it).
10. **Pedagogical guardrails on LLM answers** — raw ChatGPT fails ChemE homework (Reddit; PNAS shows pass-but-not-reliable), and no existing simulator product binds the LLM to a deterministic engine's numbers for grading-safe answers.

## THREATS & COMPARABLES (closest first)

1. **DWSIM (+ DWSIM 10 AI Assistant)** — dwsim.org — Free, mature, 35+ unit ops, Python API, NL flowsheet building in preview. **Overlap: HIGH on engine; LOW on pedagogy/voice/3D/ammonia-narrative.** Biggest "why not just use DWSIM?" objection to pre-empt.
2. **MaximaLabs** — maximalabs.io — Browser-based, zero-install, 60+ unit ops, AI copilot, free tier for learning, $299/mo teams. **Overlap: HIGH on delivery model (web + AI); targets professionals, not students; no voice, no 3D, no ammonia storyline.** Most likely to add an edu tier.
3. **LearnChemE (CU Boulder)** — learncheme.com — 320+ free browser sims owned by the ChemE teaching community. **Overlap: MEDIUM (same audience, different format — concept widgets vs. whole plant); no LLM, no full flowsheet.** Best partner/channel, not competitor.
4. **Alkali ProcessMate (YC 2025)** — alkali.engineering — AI copilot for process design & equipment sourcing. **Overlap: MEDIUM on "AI copilot" branding; LOW on education/ammonia/student focus.** Watch for pivot toward universities.
5. **AspenTech (Plus/HYSYS + V15 AI + $100 student promos + IChemE copilot-for-education webinar)** — aspentech.com — The incumbent: adding generative AI and cheap student promos; an LLM-copilot framework for Aspen in education was presented at IChemE (Aug 2026). **Overlap: HIGH capability, LOW accessibility (cost/install complexity persist).**
6. **learner.org Haber-Bosch game** — learner.org — Free interactive ammonia plant. **Overlap: LOW fidelity (equilibrium toy) — easily outclassed, but occupies the "free ammonia sim" search slot today.**

---
*Compiled by research agent 2-a, July 2026. 24 searches via z-ai web_search; no page-fetching tool used — all facts from search result titles/snippets as cited.*
