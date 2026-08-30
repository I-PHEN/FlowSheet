# Interactivity Frontier Research — Task 2-d
**Agent:** general-purpose (research) · **Date:** 2026 · **Scope:** voice AI, 3D web, gamified training, latency/UX budgets for the Ammonia Plant Builder Agent

Sources are cited inline as URLs. All numbers are as reported by the cited source; market-size and pricing figures vary by source and are flagged accordingly.

---

## 1. LIVE CONVERSATIONAL VOICE — "talk to your simulation"

### 1.1 OpenAI Realtime API (speech-to-speech, full-duplex)

**Capabilities.** Bidirectional audio streaming over WebSocket or WebRTC; the model manages conversation state, does phrase endpointing / turn detection (server VAD + "semantic VAD"), supports **barge-in/interruption** natively, and supports **function/tool calling** — i.e., the model can call your simulation engine mid-conversation ("what if we raise the loop to 180 bar?" → tool call → engine recompute → narrated result). WebRTC + ephemeral tokens is the recommended browser path.
- Docs: https://developers.openai.com/api/docs/guides/realtime · WebRTC guide: https://developers.openai.com/api/docs/guides/realtime-webrtc · Azure: https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/realtime-audio-webrtc
- Deep technical review (Latent Space "Missing Manual"): conversation state, endpointing, bidirectional streaming, TTFB measurements: https://www.latent.space/p/realtime-api

**Latency.** Time-to-first-byte ~500ms measured (Latent Space). Well-optimized realtime voice pipelines land at **500–800ms end-to-end** (Inworld: https://inworld.ai/resources/openai-realtime-api-alternatives). That is "conversational" but slower than the ~200–300ms human turn-taking gap (see §5).

**Pricing (audio tokens; has dropped repeatedly).**
- Launch (Oct 2024): $100 / $200 per 1M audio in/out tokens ≈ **$0.06/min input + $0.24/min output** (community math: https://community.openai.com/t/i-dont-understand-the-pricing-for-the-realtime-api/963837).
- Dec 2024 cut ≈ 60%: audio in $40 / out $80 per 1M (Azure price list: https://azure.microsoft.com/en-us/pricing/details/azure-openai); ≈ $0.024/min in + $0.096/min out.
- Real-world reports: 2-min phone-style conversation ≈ $0.09 on 4o-mini-realtime vs $0.21–0.25 on 4o (https://community.openai.com/t/confusion-between-per-minute-audio-pricing-vs-token-based-audio-pricing/1073222).
- After Aug-2025 pricing + implicit caching: ≈ **$0.04/min of speech**, ~$0.20/hour to keep a session connected idle (analysis: https://www.linkedin.com/posts/kwkramer_i-got-a-bunch-of-questions-about-the-cost-activity-7367240082434482177-7gKo; official: https://developers.openai.com/api/docs/pricing).

**Pitfalls.** Barge-in is aggressive — the model interrupts on filler words ("hmm", "ok"): https://community.openai.com/t/realtime-api-interrupts-too-aggressively-on-filler-words-hmm-ok-etc/1378522. Manual truncation/AV-sync on interruption is fiddly (Twilio/WebSocket media streams: https://community.openai.com/t/openai-realtime-how-to-correctly-truncate-a-live-streaming-conversation-on-speech-interruption-twilio-media-streams/1371637). Idle-session cost matters for a narration-heavy app. Production guide: https://www.forasoft.com/blog/article/openai-realtime-api-voice-agent-production-guide-2026

### 1.2 Alternatives

| Option | Model | Notes | Cost |
|---|---|---|---|
| **LiveKit Agents** | Open-source framework, self-host | Python/Node agents join WebRTC rooms; you pick STT/LLM/TTS; needs LiveKit media server + Redis; full control, self-host infra cost only | OSS; infra ~$10–50/mo | https://github.com/livekit/agents · https://docs.livekit.io/agents |
| **Pipecat** | Open-source Python orchestration (STT→LLM→TTS pipelines) | Frame-based pipelines, WebRTC-ready, provider-agnostic (Deepgram, ElevenLabs, OpenAI…); used in enterprise builds; documented chunking strategy (first segment 24 tokens for fast time-to-first-chunk, then up to 96) | OSS + provider costs | https://github.com/pipecat-ai/pipecat · https://docs.pipecat.ai/pipecat/get-started/introduction · https://github.com/pipecat-ai/nemotron-january-2026/blob/main/docs/streaming-pipeline-architecture.md |
| **Vapi** | Hosted platform | $0.05/min platform fee + underlying providers at cost; effective $0.09–0.33/min | https://ventureharbour.com/voice-ai-platforms-compared-i-built-voice-agents-on-7-tools · https://telnyx.com/resources/vapi-pricing |
| **Retell AI** | Hosted platform | ~$0.07+/min list, ~$0.25/min typical; reported better turn-taking naturalness | https://www.reddit.com/r/AI_Agents/comments/1m87noa/cost_comparison_on_voice_agents · https://www.famulor.io/blog/retell-ai-vs-vapi-2026-which-platform-is-actually-better |
| **Amazon Nova Sonic** | Bidirectional speech-to-speech on Bedrock | Nova 2 Sonic ≈ **$0.015/min** ($3/$12 per 1M speech in/out tokens); Big Bench Audio speech-reasoning 87.0; WebSocket API | https://aws.amazon.com/blogs/aws/introducing-amazon-nova-sonic-human-like-voice-conversations-for-generative-ai-applications · https://rywalker.com/research/aws-nova-2-sonic · https://aws.amazon.com/blogs/machine-learning/how-loka-built-a-natural-low-latency-voice-agent-with-amazon-nova-2-sonic |
| Bland / Telnyx | Hosted | $0.09/min connected; $0.05/min orchestration | https://www.retellai.com/blog/how-much-should-you-spend-on-an-ai-voice-agent |

### 1.3 Turn-based with fast TTS (STT → LLM → TTS)

Achievable latencies (measured/reported):
- Naive pipeline: end-of-speech silence detection 500–1000ms + first LLM chunk 800ms–1s ≈ **1.3–2s**: https://community.openai.com/t/how-does-elevenlabs-or-deepgram-realtime-voice-agents-work-as-good-as-openai-realtime-api/1083444
- Optimized streaming: Deepgram STT ~150ms (100–500ms range: https://introl.com/blog/voice-ai-infrastructure-real-time-speech-agents-asr-tts-guide-2025); ElevenLabs Flash claims ~75ms TTFB (concurrency-capped: https://deepgram.com/learn/is-elevenlabs-real-time-what-developers-need-to-know); full streaming pipeline **420–520ms** vs 2.5–5.5s non-streaming (Gradium: https://gradium.ai/content/best-low-latency-tts-apis-2026).
- Sub-1s with all open/self-hosted models is a community benchmark target (https://www.reddit.com/r/LocalLLaMA/comments/1oqe8o2/1_second_voicetovoice_latency_with_all_open); one HN build reports **~400ms average end-to-end** (https://news.ycombinator.com/item?id=47224295).
- **Sentence-chunking is the single biggest win**: start TTS on the first sentence while the LLM still generates the rest; audio streams out in 200–400ms chunks (Retell: https://www.retellai.com/blog/how-real-time-voice-ai-works-stt-llm-tts; Towards AI: https://pub.towardsai.net/voice-ai-in-2026-the-complete-stack-from-whisper-to-speaker-23e4de3ee3c4; academic: https://arxiv.org/html/2508.04721v1).

**Verdict for the app:** turn-based + sentence-chunked streaming TTS gets you to 0.8–1.5s perceived for what-if answers (fine for a Q&A moment); Realtime API gets 500–800ms with true barge-in but at $0.04–0.12/min and with interruption quirks. Recommended staging: sentence-chunked narration first, Realtime as a "live call" mode.

### 1.4 Web Speech API (free browser tier)

- Supported in Chrome/Edge/Safari; **SpeechRecognition is (historically) server-processed** — no offline; Chrome has been moving to on-device recognition since Chrome 139 (Aug 2025): https://blog.addpipe.com/a-deep-dive-into-the-web-speech-api · https://h5p.org/node/1557513
- Inconsistent support: Brave refuses to implement; iOS Safari blocks it inside installed PWAs; Firefox partial: https://webreflection.medium.com/taming-the-web-speech-api-ef64f5a245e1 · https://vocafuse.com/blog/web-speech-api-vs-cloud-apis
- SpeechSynthesis (TTS): free, ~instant, voice/rate/pitch configurable, decent quality on desktop Chrome/Safari, mediocre on some Linux/Android voices: https://www.reddit.com/r/javascript/comments/1pnwi29/til_the_web_speech_api_exists_and_its_way_more
- **Use as:** zero-cost fallback tier + always-available "mute/read" mode; not reliable as the flagship voice path. No custom vocabulary/word-boosting hurts on jargon ("Haber", "Wegstein").

### 1.5 Interruptible narration design patterns

- **Interruptibility pattern**: one obvious gesture to pause/cancel speech (tap anywhere / spacebar) — AI UX pattern library: https://aiuxplayground.com/pattern/interruptibility
- **Pause-and-resume vs pause-and-discard**: on interruption, pause output; resume if user stops quickly, discard if they keep talking — recommended for long-form content (i.e., narration): https://medium.com/@roshini.rafy/handling-interruptions-in-speech-to-speech-services-a-complete-guide-4255c5aa2d84
- Museum audio-guide craft: keep stops to **60–90s (110–170 spoken words)** so interruption/resume cost stays bounded: https://www.look2innovate.com/articles/audio-guides/museum-audio-guide-script-best-practices
- Interruption handling in the wild is still "an unsolved problem" (echo/barge-in false positives): https://www.reddit.com/r/speechtech/comments/1ral2xz/handling_interruptions_in_voice_ai_is_an_unsolved
- NN/g on designing for waits & interruptions: https://www.nngroup.com/articles/designing-for-waits-and-interruptions
- **Applicable pattern:** narration segmented into 1–2 sentence "beats"; each beat tied to a visual event (unit op assembles); interrupt = stop audio + cancel pending beats + jump visual state; resume = replay from beat boundary. This also makes narration seekable/scrubbable like a timeline.

---

## 2. 3D PLANT VISUALIZATION ON THE WEB

### 2.1 Three.js / React Three Fiber performance envelope

- **Draw calls are the currency**: <100 draw calls → 60fps on most devices; >500 → even powerful machines struggle (https://www.utsubo.com/blog/threejs-best-practices-100-tips)
- Instancing → hundreds of thousands of objects (https://r3f.docs.pmnd.rs/advanced/scaling-performance); merge geometries; control React re-renders (https://r3f.docs.pmnd.rs/advanced/pitfalls)
- Case: merging + instancing cut 300 draw calls → 56 (https://github.com/pmndrs/react-three-fiber/discussions/1447)
- Three.js runs at 95–99% of raw WebGL performance (https://mdx.so/blog/webgl-vs-three-js-which-technology-for-your-3d-website)
- **Budget for an ammonia plant:** ~9 unit ops (vessels, exchangers, converter beds, compressor, separator, heater) + pipe rack. With merged/instanced geometry: 50–300 draw calls, 100k–500k triangles → comfortable 60fps on integrated laptop GPUs. Pipes = TubeGeometry along Catmull-Rom splines, merged into few meshes.
- **WebGPU shipped in all major browsers as of Nov 2025** (Chrome 113+, Firefox 141, Safari 26; https://web.dev/blog/webgpu-supported-major-browsers · https://www.webgpu.com/news/webgpu-hits-critical-mass-all-major-browsers) — nice-to-have (compute shaders for particle flows); WebGL2 remains the safe baseline.

### 2.2 Three.js vs Unity WebGL for industrial scenes

- Three.js experiences load in **2–6s; Unity WebGL takes 8–30s** before interaction (https://www.utsubo.com/blog/threejs-vs-unity-web-comparison)
- Unity ships its whole runtime → memory pressure, browser OOM risk on mobile (https://discussions.unity.com/t/unity-webgl-and-three-js-performance/617896)
- Community consensus: Three.js for product/web-embedded scenes; Unity only if you need its physics/gameplay/asset pipeline (https://www.reddit.com/r/webgl/comments/oimjow/unity_with_webgl_vs_threejs)
- **For this app (React frontend + Python engine): Three.js/R3F is the clear pick** — React Three Fiber integrates with the app state directly; Unity would fight the stack.

### 2.3 Flow animation techniques (process streams) — ranked

1. **Shader UV-scroll on TubeGeometry** (best): scroll a texture/stripe pattern along the pipe's UVs (`map.offset.x -= rate·dt`); speed ∝ mass flow, color/emissive ∝ temperature or composition. Hundreds of pipes ≈ 1 draw call per material. Techniques referenced: animating material on tube meshes (https://forum.babylonjs.com/t/how-to-make-a-pipe-with-liquid-stream/37319 · https://stackoverflow.com/questions/69551308/waterflow-simulation-through-a-pipe-using-three-js)
2. **Animated dashed lines**: SVG `stroke-dasharray`/`stroke-dashoffset` for the 2D flowsheet (classic technique: https://jakearchibald.com/2013/animated-line-drawing-svg · https://css-tricks.com/svg-line-animation-works); `LineDashedMaterial` + dashOffset in 3D. Cheap, reads clearly as "direction + motion".
3. **GPU particles inside pipes** (instanced sprites along curves): prettiest for spotlight streams (feed gas, product ammonia), most expensive; mostly occluded by pipe walls — use transparent pipes or particles above the pipe.
4. **Real fluid solvers** (e.g., three-fluid-fx 2D stable fluids, WebGL+WebGPU/TSL: https://github.com/artcodev/three-fluid-fx): overkill for stream rates, useful for smoke/flare FX.

**Recommendation:** UV-scroll shader for every stream (speed = solved mass flow), dashed-flow SVG on the PFD, particles only on 2–3 hero streams. Fluid X-ray/reveal effects (https://tympanus.net/codrops/2026/03/23/building-a-dual-scene-fluid-x-ray-reveal-effect-in-three-js) can give a "see inside the converter" moment.

### 2.4 P&ID / PFD 2D diagram libraries with live labels

- **React Flow (xyflow)** — MIT/free; nodes are React components → **live-updating stream labels are trivial** (re-render from engine tick); virtualization supported; perf caution: uncontrolled re-renders on every position/state change — memoize nodes; ~300 custom nodes can still hit 120fps if layered well, naive setups drop to ~10fps drag (https://reactflow.dev/learn/advanced-use/performance · https://github.com/xyflow/xyflow/issues/4711 · https://www.synergycodes.com/webbook/guide-to-optimize-react-flow-project-performance). Siemens ships a "React Flow Modeler" widget for Mendix for process-flow diagrams (https://marketplace.mendix.com/link/component/201626/Siemens/React-Flow-Modeler) — enterprise validation of the pattern. No built-in orthogonal routing; use elbow edges + manual/dagre layout.
- **JointJS / JointJS+** — open core; **official P&ID demo aimed at SCADA/HMI** (https://www.jointjs.com); commercial JointJS+ = **$3,490/dev perpetual + $1,690/yr updates** (https://www.jointjs.com/pricing); strong diagramming perf culture (https://www.synergycodes.com/blog/jointjs-alternative-performance-comparison-on-the-interactive-diagram-with-thousands-of-objects-using-gojs)
- **GoJS** — commercial, per-developer, one-app restriction; listing shows team packs $6,990 (3 devs) to $11,990; individual license cheaper (https://gojs.net/latest/pricing · https://nwoods.com/sales/team); SCADA/P&ID-class features (https://gojs.net/latest); comparison: https://www.jointjs.com/blog/jointjs-vs-gojs
- **AntV X6** — free/MIT, graph editing framework; no P&ID symbol ecosystem but zero cost.
- **bpmn-js** — BPMN-specific; wrong metaphor for P&ID but proves live-label pattern in open source.
- **Recommendation:** React Flow for the PFD (free, React-native, live labels); only consider JointJS+ if a full ISA-5.1 symbol library + strict schematic editing becomes core.

### 2.5 P&ID ↔ 3D sync

- Enterprise-only today: **AVEVA P&ID 3D Integrator** does rules-based synchronization between P&ID and the E3D model (https://www.scribd.com/document/425369993/HOA-DAU · https://www.multisoftsystems.com/blog/aveva-pid-explained-features-benefits-and-real-world-use-cases); **AVEVA Unified Engineering** (cloud) integrates engineering/design/simulation data with real-time sync (https://www.aveva.com/en/products/unified-engineering); E3D has "real-time dynamic P&ID associative modeling" (https://www.cadinterop.com/en/formats/cad-systems/aveva.html). CADMATIC comparable.
- **No public web-based P&ID↔3D sync example found** — this is a white-space/differentiator for the app.
- Implementation pattern: shared **equipment tag registry** (tag → {PFD node id, 3D object id, engine unit id}); selection events broadcast through app state; clicking a tag in either view highlights it in both + camera fly-to (tween). Effort is UI plumbing, not research.

### 2.6 Digital-twin precedents on the web

- Babylon.js positions digital-twin/IOT rendering as a first-class use case (https://www.babylonjs.com/digitalTwinIot); academic web digital twin via WebGL libraries (MDPI 2023, cited 41: https://www.mdpi.com/2072-4292/15/3/721); Blender→Three.js industrial digital twin case (https://seeg-engineering.com/en/news/blender-threejs-industrial-ux). Industrial 3D walkthroughs used for HSE/evacuation design (https://www.chasingillusions.com/blog/industrial-plant-3d-walkthrough); first-person 3D safety-training games with measured outcomes exist (Shiradkar 2021, cited 45: https://www.mdpi.com/2078-2489/12/6/219).

---

## 3. GAMIFIED OPERATIONS & OPERATOR TRAINING

### 3.1 The OTS industry (what the pros do)

- **Architecture:** dynamic first-principles model (high-fidelity thermodynamics) + emulated DCS/consoles + **instructor station** + scoring/competency tracking. Vendors: GSE Solutions, Honeywell UniSim (Competency Suite / UniSim Design), Yokogawa (CENTUM VP OTS), AVEVA OTS, KBC, TSC Simulation, IDS Power.
- **GSE's Jade Instructor Station** ships: initial conditions, remote functions, **malfunctions, component failures**, self-paced startup procedures (https://gses.com/systems-and-simulation/classroom-simulators). GSE installed base: 173 nuclear, 208 fossil, 114 process simulators since 1971 (https://gses.com/solution/simulation).
- AVEVA OTS: instructor tools to build/administer training scenarios + track trainee performance (https://www.aveva.com/en/products/operator-training-simulator). Honeywell UniSim OTS: https://idspower.com/simulation-systems. Yokogawa released a "low-priced OTS" for education (https://web-material3.yokogawa.com/1001_Yokogawa_Releases_Low_Priced_Operator_Training_Simulator_for_Centum_VP__Centum_CS3000_users.pdf).
- **Costs:** a refinery OTS with "thousands" of I/O points came in around **$3M** (https://www.automationworld.com/products/control/article/13299078/operator-training-simulators-to-the-rescue). Market estimates vary wildly by definition: $2.4B (2024, strategicmarketresearch) to $11.8–12.4B (2024, market.us / credenceresearch), ~11.8% CAGR toward ~$35B by 2034 (https://market.us/report/operator-training-simulator-market). Treat the market numbers as directional.
- **AI is entering OTS:** GSE + Nuclearn (2026) integrate AI to **author training scenarios from natural-language prompts** and tailor assessments per trainee (https://gses.com/nuclearn-and-gse-solutions-announce-a-strategic-collaboration-to-bring-ai-to-nuclear-plant-simulation-and-training · https://interestingengineering.com/energy/nuclearn-gse-nuclear-simulators). This is exactly the "LLM narrates + injects faults" pattern of the student's roadmap — industry validation.

### 3.2 Serious games in chemical engineering education (published evidence)

- Díaz et al. 2024, *Education for Chemical Engineers* (cited 31): serious games promote active learning, engagement, motivation in ChemE (https://www.sciencedirect.com/science/article/abs/pii/S1749772823000490)
- Pacheco-Velazquez 2023 (cited 51): simulation games recreate concrete experiences → experiential learning in process courses (https://journal.seriousgamessociety.org/index.php/IJSG/article/view/593)
- Annunziata et al. 2023: "Serge" serious game **improved acquisition of risk-management skills** in ChemE students (https://fpalomba.github.io/pdf/Conferencs/C80.pdf)
- Tene et al. 2025 systematic review (cited 54): serious games show positive impact on knowledge acquisition, retention, application across STEM (https://www.frontiersin.org/journals/education/articles/10.3389/feduc.2025.1432982/full)
- 2026: scaffolded digital simulation module of the industrial Haber–Bosch process for teaching (https://www.sciencedirect.com/science/article/abs/pii/S1749772826000254)

### 3.3 Gamification mechanics that actually work

- Meta-analysis-grade evidence: **points, challenges/quests, badges, leaderboards** are the most-used and moderately effective affordances (Khaldi 2023, cited 692: https://pmc.ncbi.nlm.nih.gov/articles/PMC9887250); performance gains are weaker/conditional than engagement gains.
- Team-based leaderboards boost engagement and sometimes performance (Papadopoulos 2024: https://www.sciencedirect.com/science/article/pii/S1041608024001584); challenge-based gamification improved learning in a stats course (https://www.mazetec.org/blog/challenge-based-gamification-in-education); scenario-based learning games pattern for workplace training (https://www.linkedin.com/top-content/training-development/using-gamification-in-employee-training/scenario-based-learning-games).
- **Transferable scoring design for a plant sim:** score = (stay within safe/optimal operating band) + (time-to-diagnose fault) + (final production/economics) + (alarms acknowledged); scenario → briefing → constrained actions → score → **debrief** (debrief is where OTS practice says learning happens).
- Nuclear-adjacent precedents: VR for NPP field-operator training (scoping review, Satu 2024, cited 35: https://www.sciencedirect.com/science/article/pii/S0149197024000544); Fortum uses Varjo human-eye-resolution VR for operator training/design validation (https://varjo.com/case-studies/case-fortum-virtual-reality-vr-for-nuclear-power-plant-operator-training); GE Vernova VR simulators (https://www.gevernova.com/nuclear/services/training/virtual-training-simulator); IAEA distributes free PC reactor simulators for education (https://www.iaea.org/topics/nuclear-power-reactors/nuclear-reactor-simulators-for-education-and-training); "ReacTour" cinematic nuclear-plant VR tour on Quest (https://www.meta.com/experiences/reactour/6028153617252478/).
- Factorio evidence for "plant games teach systems thinking": Factorio Learning Environment as an AI-agent benchmark (arXiv 2025: https://arxiv.org/html/2503.09617v1); practitioner consensus on bottleneck/systems thinking (https://news.ycombinator.com/item?id=17618495 · https://medium.com/gaming-is-good/factorio-taught-me-systems-thinking-part-i-f8a1d2a8a349).

### 3.4 Fault injection on a STEADY-STATE engine vs a dynamic simulator (critical distinction)

Research/reference consensus: steady-state simulation solves equilibrium points — faster, design/sensitivity oriented; it **"fails to evaluate transient conditions"** (https://www.digitalrefining.com/article/1000649/dynamic-simulation-a-tool-for-engineering-problems); dynamic simulation models time-dependent behavior — pressure spikes, propagation, paths — and is what real OTS uses (https://www.modelon.com/blog/steady-state-and-dynamic-simulation-what-is-the-difference · https://www.sciencedirect.com/topics/engineering/steady-state-simulation). CIGRE notes operator training in steady-state vs transient regimes demands dynamic models for oscillation-type events (https://www.e-cigre.org/publications/detail/c2-11332-2026-system-operator-training-using-simulators-in-steady-state-and-transient-regimes.html).

**What a steady-state engine CAN fault-inject (parameter re-solve, genuinely educational):**
- Heat-exchanger **fouling**: lower U / larger ΔT approach → higher utility use, colder feed
- **Catalyst deactivation / poisoning**: lower conversion or approach-to-equilibrium per bed → more recycle, lower production, worse economics
- **Compressor fouling/political efficiency loss**: lower polytropic efficiency → higher power draw
- **Feed composition drift** (H₂:N₂ ratio, inerts/argon buildup → purge optimization)
- **Cooling-water/steam utility degradation** (higher CW temp → condenser duty collapse)
- Increased **pressure drop** (dP multiplier), partial load, partial bypass
Each fault = parameter deltas → re-solve → new flows/temps/compositions + KPI deltas + alarm thresholds crossed. This is "sensitivity analysis dramatized" — pedagogically legitimate.

**What REQUIRES dynamics (cannot be done honestly with steady state alone):**
- Trips, sudden shutdowns, startup/shutdown sequences, compressor surge, relief/flare events, runaway excursions, oscillation/instability, alarm floods, and **any time-based scoring of operator response speed**.

**Bridge pattern — quasi-steady stepping:** run the steady-state solver on a game tick (every 0.5–2 s of "plant time"), interpolate between solutions, and treat inventories (drums, loop holdup) as simple integrators (level = ∫(in−out)dt). Faults become ramps; alarms trip on threshold crossings; "response time" becomes measurable. Must be honestly labeled (quasi-steady, not high-fidelity dynamic). This is how many educational simulators fake dynamics and it is the recommended path for the roadmap's operator-training mode before any true dynamic engine exists.

### 3.5 Direct precedents for an ammonia-plant interactive

- Annenberg Learner, **"Control a Haber-Bosch Ammonia Plant"** — free 2D web interactive with sliders + lesson plan/worksheet (the direct ancestor; Flash-era): https://www.learner.org/wp-content/interactive/haberplant/haber.php
- Physics Classroom, "The Ammonia Factory" — kinetics/equilibrium interactive: https://www.physicsclassroom.com/interactive/kinetics-and-equilibrium/ammonia-factory
- Physical-exhibit Haber simulator (ExhibitFarm): https://exhibitfarm.com/haber-process-simulation-chemistry-behind-fertilizers
- **Gap:** none of these have 3D, voice, LLM narration, or modern game mechanics — the student's app is novel in this niche.

---

## 4. INSPIRATION FROM ADJACENT FIELDS

### 4.1 PhET (Colorado) — why it works

- Design principles (official): encourage scientific inquiry; **direct interactivity with immediate feedback**; **make the invisible visible** (visual mental models); real-world connections; minimal text; implicit scaffolding via constrained controls (https://phet.colorado.edu/en/research · https://phet.colorado.edu/en/about). Grounded in *How People Learn* (Bransford 2000) + hundreds of student interviews per sim (https://pubs.acs.org/doi/10.1021/bk-2013-1142.ch005).
- Evidence: PhET-based learning improved outcomes in oscillations/waves (Banda 2022, cited 289: https://pmc.ncbi.nlm.nih.gov/articles/PMC9761040); elementary science (Diab 2024, cited 88: https://www.mdpi.com/2414-4088/8/11/105).
- **Transfer:** every unit op = grabbable object; every stream = visible with live numbers on hover; all controls respond <100ms; sliders not text fields.

### 4.2 Explorable explanations (Bret Victor, Nicky Case)

- Victor 2011, *Explorable Explanations*: active reading; reactive documents; **immediate consequences + persistent context** ("context collapse" is the enemy): https://worrydream.com/ExplorableExplanations
- Nicky Case's method: get something interactive on the first screen; one-step interactions; play first, explain later (https://blog.ncase.me/how-i-make-an-explorable-explanation); design patterns: sandbox + stepping stones, parables, challenge caps (https://blog.ncase.me/explorable-explanations-4-more-design-patterns); the genre defined by users testing expectations against actual behavior (https://en.wikipedia.org/wiki/Explorable_explanation).
- **Transfer:** the what-if loop should feel like scrubbing a slider, not submitting a form; show before/after deltas side-by-side (keep the old state visible); let users pose a hypothesis, then let the plant answer.

### 4.3 AI + simulation hybrids ("copilot for models")

- **Siemens Design Copilot NX** (Jul 2025): natural-language interface inside CAD, accelerates learning of the tool (https://news.siemens.com/en-us/siemens-designcenter-nx-summer-2025)
- MIT agent that *operates* CAD like a human to build 3D objects from sketches (Nov 2025: https://news.mit.edu/2025/new-ai-agent-learns-use-cad-create-3d-objects-sketches-1119)
- LLM copilots for engineering simulation workflows (Monolith: https://www.monolithai.com/blog/llm-co-pilots-engineering-workflows); agents with direct access to engineering data as tools (https://simutecra.com/blogs/ai-agents-in-mechanical-engineering-beyond-prompt-engineering)
- **The proven pattern:** LLM as reasoning/orchestration layer emitting tool calls into a deterministic engine, then narrating diffs — identical in shape to GSE+Nuclearn's agentic scenario authoring (§3.1). The student's architecture (deterministic Python engine + LLM narration/tool calls) is aligned with where industry is going.

---

## 5. LATENCY & UX BUDGET

**Human thresholds (Nielsen, still the standard):**
- **0.1s** — feels instantaneous / direct manipulation; no feedback needed
- **1s** — limit of "continuous flow" of thought; delays 1–10s need progress feedback
- **10s** — attention limit
(https://www.nngroup.com/articles/response-times-3-important-limits · https://jakobnielsenphd.substack.com/p/time-scale-ux · https://www.nngroup.com/articles/powers-of-10-time-scales-in-ux)

**Voice-specific thresholds:**
- Human turn-taking gap: **200–300ms**, hardwired across cultures (https://hamming.ai/resources/voice-ai-latency-whats-fast-whats-slow-how-to-fix-it · https://picovoice.ai/blog/latency-in-speech-recognition)
- Voice AI feels natural at **<600ms time-to-first-audio; <400ms is excellent** (https://www.ultravox.ai/voice-ai/understanding-latency-in-voice-ai-systems); ~500ms is the ideal benchmark; pauses >1s noticeable (https://telnyx.com/resources/low-latency-voice-ai)
- Median production voice agents today: **1.4–1.7s** — 5–8× slower than human turn-taking (https://www.parloa.com/knowledge-hub/speech-latency-voice-ai)

**Budget allocation for the Ammonia Plant Builder:**
| Interaction | Budget | Technique |
|---|---|---|
| Slider drag / exploded view / camera | <100ms | client-side interpolation; precomputed solution surfaces |
| What-if recompute + visual update | 0.5–2s | streaming progress; **optimistic UI** (animate flows toward new rates instantly, snap to solved values) |
| Narration start after event | <600ms | sentence-chunked streaming TTS (first ~24 tokens) |
| Voice Q&A turn | <1s (ideally <600ms) | Realtime API or Deepgram+LLM+Flash-TTS pipeline |
| Fault scenario tick | 0.5–2s/step | quasi-steady solver stepping |
| Anything >1s | visible feedback mandatory | pulsing pipes, status chip, voice filler ("let me re-solve the loop…") |

---

## INTERACTIVITY LADDER
Ranked by **wow-factor ÷ build-effort** (solo dev estimates; dependencies and risk noted). Items 1–5 are "ship in the next sprint"; 11–15 are differentiators.

| # | Feature | What it is | Effort | Depends on | Risk |
|---|---|---|---|---|---|
| 1 | **3D stream-flow shader** | UV-scroll texture on pipe meshes; speed ∝ solved mass flow, color ∝ temperature; plant instantly feels "alive" | 2–3 days | Three.js TubeGeometry + engine stream rates | Low |
| 2 | **Live flowsheet (PFD) with animated dashes + live labels** | React Flow PFD; `stroke-dashoffset` animation per stream; labels (T, P, flow, composition) re-render on engine tick | 2–4 days | React Flow (free); memoized nodes | Low (perf hygiene only) |
| 3 | **Sentence-chunked streaming narration** | LLM streams; TTS starts on first sentence; beats synced to visual events; ~0.5s narration start | 1–3 days | Streaming LLM + streaming TTS (ElevenLabs/Deepgram) | Low |
| 4 | **Interruptible narration controls** | Any click/keypress/speech pauses audio; resume-from-beat; narration = seekable 60–90s "stops" (museum pattern) | 2–5 days | Web Speech API or TTS SDK; beat timeline | Low–Med (browser quirks) |
| 5 | **Exploded-view slider + click-to-inspect** | Drag slider to explode plant into unit ops; click any unit → spec card (duty, U, conversion, KPI) | 3–5 days | R3F; tag registry | Low |
| 6 | **Push-to-talk what-if voice commands** | "What if feed is 10% richer?" → STT → LLM intent → engine recompute → spoken + visual answer | 3–7 days | STT (Web Speech or Deepgram); tool-calling LLM | Medium (jargon ASR; use word lists) |
| 7 | **Fault-injection operator mode (steady-state)** | Fouling, catalyst deactivation, compressor efficiency, feed drift, CW temp, dP faults → re-solve → alarms + KPI deltas; quasi-steady tick for ramps | 1–2 weeks | Engine parameter hooks; alarm thresholds; quasi-steady stepper | Medium (label honestly: no true transients) |
| 8 | **P&ID↔3D bi-directional sync** | Click vessel in 3D → highlight on PFD (+ fly-to); click stream on PFD → highlight pipe in 3D. No web precedent found = differentiator | 1–2 weeks | Shared tag registry (tag→3D id→PFD id→engine id) | Medium (plumbing, camera tweens) |
| 9 | **Scenario challenges + scoring** | NRC/OTS-style: briefing → constrained ops → score (band-keeping, time-to-diagnose, economics) → debrief screen | 1–2 weeks | #7; scoring engine; scenario YAML | Medium |
| 10 | **First-person walkthrough mode** | Pointer-lock WASD walk through the plant; proximity-triggered narration beats ("audio guide" of the plant) | 1–2 weeks | R3F controls; collision-lite; LOD | Medium (motion sickness; perf) |
| 11 | **Full-duplex "talk to the plant" (Realtime API)** | OpenAI Realtime + function calling into engine; barge-in narration ("wait, go back — why did the recycle ratio jump?") | 1–3 weeks | OpenAI Realtime (~$0.04–0.12/min) or LiveKit/Pipecat self-host | High (cost, filler-word interruptions, session mgmt) |
| 12 | **Instructor station (GSE Jade-style)** | Set initial conditions, inject malfunctions remotely, run "class" scenarios, track trainee performance | 2–4 weeks | #7 + #9; multi-session state | Medium |
| 13 | **Quasi-dynamic plant clock** | Game-tick steady-state stepping + inventory integrators → levels drift, alarms sequence, response timing scorable | 1–3 weeks | Engine solve time <500ms; holdup data | High (physics honesty; convergence at each tick) |
| 14 | **AI-authored fault briefs** | LLM writes scenario brief + fault deltas + grading rubric from a template (GSE+Nuclearn pattern), engine validates parameter sanity | 3–7 days | Guardrails: whitelist of faultable parameters | Medium (must reject nonphysical faults) |
| 15 | **Leaderboards + shareable scenario cards** | Class leaderboards, share-a-fault links ("try my 3-fault ammonia plant") | 3–5 days | #9; lightweight backend | Low |

**Sequencing note:** items 1–6 form a coherent "v2" (alive plant + guided voice), items 7–9 the "operator mode" milestone, 11 the headline demo mode, 12–13 the "real OTS feel" tier.

---

## Source index (primary URLs)

Voice: developers.openai.com (realtime guides/pricing), latent.space/p/realtime-api, inworld.ai/resources/openai-realtime-api-alternatives, community.openai.com threads (pricing, interruptions, truncation), azure.microsoft.com pricing, linkedin.com (kwkramer cost post), github.com/livekit/agents, docs.livekit.io, github.com/pipecat-ai (+nemotron streaming doc), telnyx.com/resources/vapi-pricing, ventureharbour.com (7 tools), famulor.io (Retell vs Vapi), aws.amazon.com Nova Sonic blogs, rywalker.com/research/aws-nova-2-sonic, blog.addpipe.com (Web Speech deep dive), vocafuse.com, webreflection.medium.com, arxiv.org/html/2508.04721v1, gradium.ai, deepgram.com learn articles, retellai.com/how-real-time-voice-ai-works, news.ycombinator.com/item?id=47224295, reddit.com/r/LocalLLaMA (1s open-models thread), aiuxplaybook.com/pattern/interruptibility, medium.com (roshini.rafy interruptions), look2innovate.com (audio guide scripts), reddit.com/r/speechtech (unsolved interruptions), nngroup.com (waits & interruptions).
Latency: nngroup.com response-times-3-important-limits, jakobnielsenphd.substack.com, ultravox.ai, hamming.ai, telnyx.com, picovoice.ai, parloa.com.
3D: r3f.docs.pmnd.rs (scaling/pitfalls), utsubo.com (100 tips, vs Unity), mdx.so, github.com/pmndrs discussions, discourse.threejs.org (pipe flow), forum.babylonjs.com (pipe liquid), stackoverflow.com (waterflow), github.com/artcodev/three-fluid-fx, tympanus.net (fluid X-ray), web.dev + webgpu.com + caniuse (WebGPU), jakearchibald.com + css-tricks.com (dash animation), reactflow.dev (performance), synergycodes.com (React Flow webbook; JointJS/GoJS), jointjs.com (+pricing, P&ID demo), gojs.net (pricing), nwoods.com, marketplace.mendix.com (Siemens React Flow Modeler), mdpi.com (web digital twin; safety training game), babylonjs.com/digitalTwinIot, seeg-engineering.com, chasingillusions.com, cadinterop.com, aveva.com, scribd.com (P&ID 3D Integrator), multisoftsystems.com.
Gamification/OTS: gses.com (Jade, installed base, Nuclearn), automationworld.com ($3M OTS), avea.com, idspower.com, yokogawa.com PDF, market.us + strategicmarketresearch.com + credenceresearch.com (market size), sciencedirect.com (Díaz 2024; Satu 2024; steady-state topics), journal.seriousgamessociety.org (Pacheco-Velazquez), fpalomba.github.io (Serge), frontiersin.org (Tene 2025), pmc.ncbi.nlm.nih.gov (Khaldi 2023; Banda 2022), sciencedirect.com (Papadopoulos 2024), mazetec.org, varjo.com (Fortum), gevernova.com, iaea.org, meta.com (ReacTour), modelon.com, digitalrefining.com, e-cigre.org, learner.org (Haber interactive), physicsclassroom.com, exhibitfarm.com, sciencedirect.com S1749772826000254 (Haber-Bosch module), arxiv.org/html/2503.09617v1 (Factorio LE), news.ycombinator.com (Factorio systems thinking).
Adjacent: phet.colorado.edu (research/about), pubs.acs.org (PhET design principles), mdpi.com (Diab 2024), worrydream.com/ExplorableExplanations, blog.ncase.me (3 posts), en.wikipedia.org (explorable explanation), news.siemens.com (Design Copilot NX), news.mit.edu (CAD agent), monolithai.com, simutecra.com.
