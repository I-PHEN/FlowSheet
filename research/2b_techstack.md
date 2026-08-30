# Task 2-b: Tech Stack Research — Thermo Libraries, TTS Engines, LLM Structured Output

**Agent:** general-purpose (tech stack research, retry with narrowed scope)
**Date compiled:** research session for Ammonia Plant Builder Agent
**Scope note:** Voice orchestration (Realtime API, LiveKit, Pipecat) and 3D libs (Three.js, React Flow) researched by agent 2-d — excluded here.

---

## DOMAIN 1: Python Thermodynamics Libraries (engine layer)

### The decision-shaping question first: NH3–H2–N2–CH4–Ar VLE at −20 °C / 150 bar?

**Short answer: neither CoolProp nor Cantera does this out of the box.** CoolProp's mixture framework is a GERG-2008-style multi-fluid Helmholtz model; NH3 is **not** a GERG-2008 component, NH3–water is explicitly unavailable (GitHub issue #341; coolprop-users Google Group: "the Ammonia/Water mixture is not yet available in CoolProp"), and mixture flashes only support a very small set of calculations with pre-generated phase envelopes — non-PT input pairs are unsupported (GitHub issue #2534, Apr 2025; CoolProp's own paper: "the major limitation of CoolProp... is that it cannot handle mixtures of fluids" in general, PMC3944605). Cantera has no real-fluid liquid-phase flash at all (ideal-gas / sparse real-gas thermodynamics).

**What people actually use for ammonia condensation / loop VLE:**
- **Cubic EOS (Peng-Robinson / SRK / Patel-Teja) with binary interaction parameters** — standard industry & teaching practice (mines-paris.psl.edu course: ammonia + Peng-Robinson liquid-vapor equilibrium; Scribd PR-vs-Patel-Teja comparison: "PR offers greater accuracy for ammonia at conditions deviating from ideal"). This is what Aspen PENG-ROB does inside commercial simulators.
- **Research-grade multi-fluid EOS:** Herrmann/Span-type reference equations of state exist for *exactly the synthesis-loop binaries* — NH3+Ar, NH3+CH4, NH3+H2, NH3+N2, NH3+CO (Fluid Phase Equilibria, 2020, S037838122030042X) — but these live in the Ruhr-Uni Bochum/Span ecosystem, not pip-installable mainstream libraries.
- **CPA (Cubic-Plus-Association) EOS** for hydrogen-bonding NH3-containing systems (e.g., Moortgat 2025, PMC12747400, water–H2 VLE).
- Volume-translated PR (VTPR, Tsai 1998) improves liquid densities.

**Practical verdict for this project:** pure NH3 properties at −20 °C/150 bar → CoolProp (pure-fluid EOS valid to 725 K / 1000 MPa); the 5-component loop flash → PR EOS via `thermo` (Caleb Bell) with BIPs, validated against published stream tables (agent 2-c's sources).

---

### Per-library assessment

#### 1. Cantera — cantera.org
- **What:** C++ chemistry/thermo/transport library with Python API. Ideal-gas (and some real-fluid) thermodynamics, **chemical equilibrium via Gibbs energy minimization** (`gas.equilibrate('TP','VCS'/'gibbs')`), 0-D/1-D reactor networks, surface chemistry.
- **License:** BSD 3-clause. **Pricing:** free. **Activity:** very active (v3.x; examples updated through 2024–2026).
- **NH3 fit:** Excellent for reactor-side modeling. Official example "1-D packed-bed catalytic membrane reactor" uses a 12-step elementary microkinetic mechanism for NH3 formation/decomposition over Ru/Ba-YSZ (cantera.org/dev/examples/python/reactors/1D_packed_bed.html). NH3-formation equilibrium via Gibbs minimization is a textbook Cantera exercise (tutorial videos Apr 2024). SMR/WGS/methanation equilibrium = one `equilibrate()` call each.
- **Speed:** equilibrium calls are milliseconds (C++ core); microkinetic reactor integration is heavier but unnecessary here.
- **Can't do:** real-fluid VLE/condensation (no liquid-phase flash for NH3–H2–N2), no steam tables, no unit ops (flash drums, compressor polytropic head), no property-database breadth (needs mechanism files with NASA polynomials).
- **Fit verdict: CONDITIONAL-USE** — great if you want Gibbs-minimization equilibrium instead of hand-coded Gillespie-Beattie Kp, but agent 2-c already validated explicit Kp correlations; Cantera adds a dependency for marginal gain. Use if SMR equilibrium gets messy by hand.
- Sources: https://cantera.org/dev/examples/python/reactors/1D_packed_bed.html ; https://www.youtube.com/watch?v=yh0sJh8hZ2c ; https://cantera.org/dev/userguide/reactor-tutorial.html

#### 2. CoolProp — coolprop.org
- **What:** Helmholtz-energy property library, 100+ pure fluids, IAPWS-IF95/IF97 water, humid air, incompressibles, incompressible binaries, GERG-2008-type mixtures. C++ core, Python wheels.
- **License:** MIT. **Pricing:** free. **Activity:** very active — **v8.0.0 released ~Dec 2025** ("Faster, Bigger, and More Accurate", Ian Bell; changelog: many new mixture interaction pairs incl. Bell-JCED-2025, Bell-IJT-2020, Bell-JPCRD-2022/2023 models, NIST IR 8570 pairs).
- **NH3 fit:** **Pure NH3 EOS is superb** — "Thermodynamic Properties of Ammonia from the Melting Line to 725 K and Pressures to 1000 MPa" (coolprop.org fluid page). −20 °C/150 bar saturated-liquid/vapor NH3: trivially covered. Also N2, H2, CH4, Ar pure fluids for single-phase compressor duty enthalpies. IF97 mode is the fast steam-table path (coolprop.org/fluid_properties/IF97.html: IF97 faster, within 1% of IAPWS-95).
- **Can't do:** general NH3-containing mixture VLE (see box above); NH3–water; mixture flashes limited to narrow input pairs; per-call mixture flash speed is poor (heavier than pure-fluid, which is µs–ms via superancillaries).
- **Fit verdict: USE (pure fluids + steam only).** Standard, bulletproof for property evaluation layers; do NOT attempt the 5-component condenser flash in CoolProp.
- Sources: https://coolprop.org/fluid_properties/Mixtures.html ; https://coolprop.org/fluid_properties/IF97.html ; https://github.com/CoolProp/CoolProp/issues/2534 ; https://github.com/CoolProp/CoolProp/issues/341 ; https://pmc.ncbi.nlm.nih.gov/articles/PMC3944605 ; https://www.linkedin.com/posts/ian-bell-3a261a2b_welcome-to-coolprop-activity-7477004588957536256-5xb1

#### 3. thermo (Caleb Bell / ChEDL) — thermo.readthedocs.io
- **What:** Pure-Python thermodynamics & phase-equilibrium library: 70k+ chemical database (via `chemicals`), temperature/pressure-dependent property correlations, **cubic EOS (PR, SRK, RK, VTPR...) with BIPs, activity models (UNIFAC, NRTL, Wilson), multiphase flash algorithms**, mixture enthalpy/entropy. Sibling packages: `chemicals`, `fluids`, `ht` (all MIT).
- **License:** MIT. **Pricing:** free. **Activity:** active 2016–2025 (docs footer; regular releases).
- **Fit:** This is the **missing piece** for the synthesis loop: PR-EOS flash of NH3–H2–N2–CH4–Ar at −20 °C/150 bar, condensation split, stream enthalpies for the heat balance, gas-mixture heat capacities for the converter beds. Pure Python = trivially deployable (serverless/Pyodide candidate), ms-scale flashes fine for interactive what-ifs. PyThermo.jl exists as a Julia interface (evidence of API stability).
- **Can't do:** reaction kinetics/equilibrium constants (no chemistry engine — pair with agent 2-c's Kp correlations), IAPWS-95-grade water accuracy (use iapws/CoolProp for steam), no flowsheeting.
- **Fit verdict: USE — the core VLE/properties engine.** Best license, best fit, easiest deployment.
- Sources: https://thermo.readthedocs.io/index.html ; https://github.com/CalebBell/thermo ; https://pypi.org/project/chemicals ; https://discourse.julialang.org/t/ann-pythermo-jl-an-interface-to-the-thermo-library-for-thermophysical-properties/58310

#### 4. DWSIM (Python API) — dwsim.org
- **What:** Full open-source flowsheet simulator (steady-state + dynamic), CAPE-OPEN compliant, scriptable/automatable from Python (pythonnet bridge); official Python dynamic-simulation tutorials. DWSIM 10 adds an AI assistant (NL flowsheet building).
- **License:** **GPL v3** (desktop editions; dwsim.org/wiki/Licensing). **Pricing:** free; paid support/apps. **Activity:** active (DWSIM 10 repo active as of late 2025/2026).
- **Pros for teaching app:** reformer/shift/CO2-removal/compressor/synthesis-loop unit ops exist out of the box; could serve as a **validation oracle** to cross-check the custom engine.
- **Cons:** GPL v3 virality (fine for a free web app backend, but constrains future commercialization); .NET runtime + pythonnet on the server = heavy, fragile deployment; recycle-convergence solve per what-if = slow for interactive loops; solver failures are opaque to students; "not on par with proprietary software" for rigorous work (r/Chempros); not parallel-ready (SourceForge thread, Mar 2025).
- **Fit verdict: SKIP as runtime engine; CONDITIONAL as offline validation harness.**
- Sources: https://dwsim.org/wiki/index.php?title=Licensing ; https://dwsim.org/wiki/index.php?title=Dynamic_Simulation_Tutorial_with_DWSIM_and_Python,_Part_1:_Concepts_and_Steady-State_Model ; https://www.reddit.com/r/Chempros/comments/18876is/ ; https://sourceforge.net/p/dwsim/discussion/scripting/thread/9e5e9fddcd/ ; https://pp.bme.hu/ch/article/download/19678/9410

#### 5. iapws (Python) — iapws.readthedocs.io
- **What:** Pure-Python IAPWS-IF97 (industrial) and IAPWS-95 (scientific) water/steam tables.
- **License:** MIT. **Pricing:** free. **Activity:** maintained.
- **Fit:** steam side (reformer steam, waste-heat boiler, turbine). IF97 is explicitly the *fast* formulation (within 1% of IAPWS-95, coolprop IF97 page). `SEUIF97` (C extension) is the even-faster option (github.com/thermalogic/SEUIF97).
- **Can't do:** anything non-water.
- **Fit verdict: USE (steam layer)** — or just use CoolProp's IF97 backend; don't need both.
- Sources: https://iapws.readthedocs.io/en/latest/iapws.iapws97.html ; https://coolprop.org/fluid_properties/IF97.html ; https://github.com/thermalogic/SEUIF97

#### 6. ThermoPack (SINTEF/NTNU) — thermotools.github.io/thermopack
- **What:** Fortran-core library (Python bindings on PyPI) for multi-component multiphase thermodynamics: PR, SRK, **CPA**, PC-SAFT, GERG-2008, flash & phase envelopes. Strong on polar/associating fluids — the NH3/H2-carrier research community uses it.
- **License:** **open-source version on GitHub is feature-limited** — "A limited feature open-source version of Thermopack is available on github" (sintef.no/software/thermopack); full version licensed from SINTEF. **Pricing:** free (limited edition). **Activity:** active (SINTEF blog Dec 2024).
- **Fit:** research-grade CPA/VLE for NH3 mixtures if PR proves inadequate; overkill for v1.
- **Can't do (practically):** trivial embedding — Fortran wheel, limited open edition, energy-sector focus.
- **Fit verdict: SKIP (keep as named fallback if PR-vs-data error > few %).**
- Sources: https://www.sintef.no/en/software/thermopack ; https://github.com/thermotools/thermopack ; https://blog.sintef.com/digital-en/open-source-code-thermopack-software-performs-thermodynamics-calculation ; https://pypi.org/project/thermopack

#### 7. NeqSim (Equinor) — equinor.github.io/neqsimhome
- **What:** Java process-simulation library (fluid behavior, phase equilibrium, process design), Python via JPype; Colab teaching notebooks exist.
- **License:** open source (Apache-family per Equinor GitHub). **Pricing:** free. **Activity:** maintained.
- **Fit:** oil & gas bias; ammonia-water absorption demonstrated in teaching notebooks; JVM bridge adds deployment friction for a web app.
- **Fit verdict: SKIP.**
- Sources: https://equinor.github.io/neqsimhome ; https://github.com/equinor/neqsim ; https://github.com/EvenSol/NeqSim-Colab

#### 8. pyromat — brief
- Minimal ideal-gas/air/steam property library; low activity, narrow fluid set; superseded by CoolProp/iapws for every use case here. **Fit verdict: SKIP.**
- Sources: (PyPI pyromat; general knowledge, low relevance)

### Domain-1 reference: what the 2020 literature gives you for free
The FPE 2020 paper "Fundamental Thermodynamic Models for Mixtures Containing NH3+Ar, NH3+CH4, NH3+H2, NH3+N2, NH3+CO" (Herrmann et al., semanticscholar.org/paper/fbe80057679c218686ffc0f223e4995310de8bb1) is the scientific backbone for exactly this loop — cite it as the "why PR-EOS-with-BIPs is good enough for teaching, and what the reference answer looks like."

---

## DOMAIN 2: TTS Engines for Narration (2025–2026)

Use-case split: **(a) pre-generated walkthrough narration** (quality > latency; one-time cost) and **(b) short conversational what-if answers** (latency ≈ quality).

| Engine | Price | Latency/TTFB | Voice cloning | License/terms | Notes |
|---|---|---|---|---|---|
| **Piper** (rhasspy) | free, self-host | ~700 ms per 10 s audio on CPU (blog test); fastest+smallest local model, ~RTF 0.03 | No (train-your-own possible) | **MIT code; voice models carry dataset-specific licenses — some non-commercial** (GH discussion #271) | "Fastest and smallest but most robotic" (contracollective M5 benchmark); pronunciation gaps; 100+ community voices |
| **Kokoro-82M** | free, self-host | ~200× real-time on CPU; <0.3 s short texts (inferless) | **No cloning** | **Apache 2.0 (code+weights)**; community flags training-data provenance caveats on some voices | 82M params; 54 voices; consensus best local quality-per-ms: "best combination of speed, accuracy" (r/LocalLLaMA); slight accent artifacts in minor languages |
| **OpenAI gpt-4o-mini-tts** | **$0.60/1M input tokens + $12/1M audio-output tokens ≈ $0.015/min** (OpenAI forum, sanand0/openai-tts-cost, PromptLayer) | streaming; not latency-leading | No (11 fixed voices) | commercial API | **Voice-instructions feature** = steer persona ("explain like a plant instructor, calm, encouraging") — unique fit for a teaching narrator; tts-1 $15/1M chars, tts-1-hd $30/1M (texttolab) |
| **ElevenLabs** | API: **$0.10/1k chars (v2/v3) = $100/1M; Flash/Turbo $0.05/1k = $50/1M** (elevenlabs.io/pricing/api); Flash = 1 credit/2 chars | **Flash v2.5: 75 ms TTFB**, 32 languages (elevenlabs.io docs); sub-100 ms class (coval.ai) | **Yes** — instant cloning (paid tiers), professional cloning | commercial; free tier ~10k credits/mo; plans to $990/mo (flexprice) | v3 flagship expressivity; Flash 40k-char request limit (invideo) — good for long narration too |
| **Azure AI Speech** | **Neural $15–16/1M chars; Neural HD $22–30/1M** (azure.microsoft.com; aloa.co) | ~sub-second streaming | Yes (paid, application-gated custom voice) | commercial; **FREE F0 tier: 500k neural chars/month ongoing** (texttolab; MS Q&A) | 500+ neural voices; **SSML speaking styles (cheerful, explanatory)** = pedagogically useful; Azure for Students $100 credit |
| **Google Cloud TTS** | Standard/WaveNet $4–16/1M, Neural2 $16/1M, Chirp 3 HD $30/1M (speechify; cloud.google.com) | streaming | limited (Chirp custom, allowlist) | commercial; **free 4M standard chars/mo** (+1M WaveNet) (texttolab; speechmatics) | 380+ voices; Journey/Studio voices for narration |
| **Amazon Polly** | Neural **$16–19.20/1M chars** (aws.amazon.com/polly/pricing) | streaming, mature SSML | No | **Free tier changed Jul 15 2025: new accounts get $200 credits instead of perpetual free chars** (aws.amazon.com/polly) | generative voices added 2025; older "5M free/mo" references are legacy |
| **Cartesia Sonic (2/3)** | **~$0.030/1k chars = $30/1M** ($0.027 Growth) (gradium; inworld) | **sub-100 ms TTFB class** (coval.ai) | Yes (instant) | commercial; 20k free credits (cartesia.ai/vs) | purpose-built for agents; sonic-3 quality tier up |
| **Deepgram Aura-2** | **$30/1M chars**, $200 free credits (texttolab) | ~150–200 ms TTFB | No | commercial | ~40 English-first voices; agent-focused; "fastest first-byte in prod" tier with Cartesia (r/AI_Agents) |

**Latency context (from agent 2-d):** sentence-chunked streaming TTS gives 400–520 ms effective e2e; pre-generated narration avoids latency entirely.

### Verdicts
- **Piper:** USE (budget/offline tier) — MIT code, but **check each voice model's license before shipping commercially**.
- **Kokoro:** USE (self-host quality tier) — Apache 2.0, better quality than Piper, no cloning needed for a fixed "instructor" persona; note dataset-provenance discussion in community.
- **OpenAI gpt-4o-mini-tts:** USE (primary narration) — voice-instructions persona control + $0.015/min is nearly free for pre-generated content.
- **ElevenLabs:** CONDITIONAL (best voice quality if you want a "premium narrator" voice + cloning; Flash v2.5 at 75 ms also best-in-class for conversational tier).
- **Azure:** USE (free-tier workhorse) — 500k chars/month free forever + explanatory SSML styles = ideal education fit.
- **Google:** CONDITIONAL (4M free standard chars/mo is the largest free quota; voice quality mid-tier).
- **Polly:** SKIP (free tier gutted July 2025; nothing distinctive left).
- **Cartesia / Deepgram Aura:** SKIP for v1 (both ~$30/1M, latency-focused for full-duplex agents — that's agent 2-d's later stage, not narration).
- **Web Speech API:** free browser fallback (agent 2-d covered quirks).

---

## DOMAIN 3: LLM Structured Output & Tool-Calling Reliability

### Provider-native mechanisms
- **OpenAI Structured Outputs** (Aug 2024, openai.com/index/introducing-structured-outputs-in-the-api): constrained decoding that **guarantees adherence to a supplied JSON Schema** — OpenAI reported 100% schema compliance on eval vs ~93% with plain function calling and <40% with prompt-only JSON. Available on gpt-4o-06+ / 4o-mini and successors. First-token + per-key overhead is modest; supports `strict: true` mode, enums, ranges via constraints at the schema level.
- **Anthropic:** tool use with JSON schema is reliable but historically lacked strict enforcement; **Claude "structured outputs" (announced Nov 2025)** closes the gap — docs note JSON-Schema support "with some limitations," shared by JSON output mode and strict tool use (platform.claude.com/docs). Good, but OpenAI's constrained decoding is the longer-ship-hardened option for pure extraction.

### Libraries
- **Instructor** (python.useinstructor.com; MIT): patches provider SDKs to return **Pydantic models** — automatic validation + retry loops, provider-agnostic (OpenAI/Anthropic/Gemini/local). The natural fit here: `BuildParams` Pydantic model = single source of truth for LLM output, validation, and engine input.
- **outlines** (dottxt): open-source **constrained decoding/generation** (regex/JSON-grammar, logits masking) for local/open models — for when you self-host.
- **LM Format Enforcer** (github.com/noamgat/lm-format-enforcer): token-level format guarantee for HF/vLLM; positions itself vs Guidance/JsonFormer/Outlines.
- Survey: "Generating Structured Outputs from Language Models" (arXiv 2501.10868, Jan 2025) — constrained decoding trade-offs (format reliability vs task accuracy).
- BAML (Boundary) claims 2–4× faster/more accurate function calling than native strict FC (r/LocalLLaMA) — alternative compiler-style approach.

### Safe parameter-extraction pattern (recommended for this app)
1. LLM call with **strict JSON Schema** (enum-constrained unit fields, `additionalProperties: false`) →
2. **Pydantic validation layer** with hard physical ranges from agent 2-c's operating envelopes (e.g., loop pressure 80–250 bar, S/C 2–4, bed temps 350–530 °C) — reject → one clarifying retry → then default+flag →
3. **Deterministic Python engine computes everything numeric**; LLM never does arithmetic — it only narrates engine output (template + numbers injected server-side).
4. Grounding evidence: hallucinated numbers are a documented LLM failure class ("numerical hallucination," dev.to; uintent case study on AI calculation errors); engineering-domain analysis stresses that hallucinated outputs propagate into decisions (patsnap.com hallucination-rates-in-engineering); LLM-generated *code* hallucination study arXiv 2404.00971. This validates the plan's "LLM as parameterizer, engine as calculator" split — it is the correct architecture, not just a convenient one.

### Verdicts
- **OpenAI structured outputs: USE** (primary extraction path).
- **Anthropic tool use / structured outputs: USE (interchangeable fallback)** — same Pydantic layer works via Instructor.
- **Instructor: USE** as the integration shim (retries + validation for free).
- **outlines / LMFE: SKIP for v1** (only relevant if self-hosting the LLM).

---

## RECOMMENDED STACK

### Domain 1 — Engine (primary): **`thermo` (PR-EOS, MIT) for loop VLE & mixture enthalpies + CoolProp (MIT) for pure NH3/H2/N2/CH4/Ar properties & IF97 steam + agent 2-c's Kp/Dyson-Simon correlations for reactors.**
All MIT, pip-installable, pure-Python-friendly (thermo) + small C wheels (CoolProp), each the best-in-class for its slice; Cantera optional for Gibbs-minimization cross-checks of SMR/WGS equilibrium. **Budget/zero-dependency alternative:** hand-rolled ideal-gas correlations + CoolProp only (skip thermo) — acceptable for MVP since condenser split can start as a K-value correlation.
**Explicitly rejected:** CoolProp for mixture VLE (can't do NH3 mixtures), DWSIM as runtime engine (GPL v3, .NET deployment, slow interactive re-solves), Cantera as the core (no real-fluid condensation).

### Domain 2 — TTS (primary): **OpenAI gpt-4o-mini-tts (~$0.015/min) for pre-generated walkthrough narration** (voice instructions lock the instructor persona) + **Azure Speech free tier (500k neural chars/month) or ElevenLabs Flash v2.5 ($50/1M chars, 75 ms TTFB) for conversational answers.**
**Budget alternative: Kokoro-82M self-hosted (Apache 2.0, ~200× real-time on CPU, 54 voices)** — covers both narration and short answers at $0, with Piper as the even-lighter fallback (verify voice-model licenses).

### Domain 3 — LLM extraction (primary): **OpenAI structured outputs (strict JSON Schema) wrapped in Instructor + Pydantic physical-range validation layer**, engine-side clamps as last resort; LLM never computes.
**Budget alternative: same architecture with any provider** — the reliability lives in the Pydantic validation layer, not the vendor, so Anthropic/Gemini/local models swap in cleanly via Instructor.

### Cost sanity check for a semester of student use
Narration: 100 walkthroughs × 3 min × $0.015/min ≈ **$4.50** (OpenAI) or **$0** (Azure free tier ≈ 55 min/month free ≈ 18 walkthroughs/mo). Conversational tier: 500 questions × 30 s ≈ 4.2 h ≈ 250k chars ≈ **$12.50** (ElevenLabs Flash) / **$0** (Kokoro/Azure-free). The TTS budget is noise; spend the effort on quality and latency instead.
