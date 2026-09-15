# 2c — AMMONIA ENGINEERING RESEARCH
Task 2-c | Ammonia Plant Builder Agent — correlations, operating data, validation sources
Method: ~40 web searches + primary-source PDF extraction (EPFL/ECOS, Elsevier open PDFs, EFMA booklet, IFA) + independent numerical verification of correlations in Python.

Confidence tags: **[S]** = confirmed by search/source; **[V]** = numerically verified in this research (Python); **[D]** = domain knowledge (not independently confirmed here).

---

## Q1. Ammonia synthesis equilibrium — Gillespie-Beattie & alternatives

### Gillespie-Beattie (1930) correlation — RECOMMENDED for the engine [S][V]
For reaction ½N2 + (3/2)H2 ⇌ NH3, defined as:

    Kp = p_NH3 / (p_N2^0.5 * p_H2^1.5)      [atm^-1],  partial pressures in atm, T in K

    log10(Kp) = 2074.8/T − 2.4943*log10(T) − beta*T + 1.856e-7*T^2 + I

beta and I are pressure-dependent (apparent Kp in partial-pressure terms; the pressure
dependence absorbs fugacity effects):

| P (atm) | beta        | I      |
|---------|-------------|--------|
| 10      | 0           | 1.993  |
| 30      | 3.4e-5      | 2.021  |
| 50      | 1.256e-4    | 2.090  |
| 100     | 1.256e-4    | 2.113  |
| 300     | 1.256e-4    | 2.206  |
| 600     | (in original table; out of scope for a 150-250 bar app) |

Sources: Gillespie & Beattie, Phys. Rev. 36, 743 (1930) — data spanning 325–952 °C;
coefficient table reproduced in El-Gharbawy et al. (2021), Egypt. J. Chem. 64(5),
https://www.sciencedirect.com/science/article/pii/S1110062120304670
and https://www.researchgate.net/publication/348338338 (table snippet confirms
10/30/50/100/300 atm rows exactly).

**Numerical verification performed in this research** (solving equilibrium NH3 mol% for
stoichiometric H2/N2 = 3 feed with the above formula, linear interpolation of beta/I in P):

| T      | 100 atm | 150 atm | 200 atm | 300 atm |
|--------|---------|---------|---------|---------|
| 350 °C | 37.3 %  | 45.2 %  | 50.9 %  | 59.1 %  |
| 400 °C | 25.2 %  | 32.4 %  | 38.2 %  | 47.0 %  |
| 450 °C | 16.3 %  | 22.3 %  | 27.4 %  | 35.8 %  |
| 500 °C | 10.5 %  | 15.0 %  | 19.1 %  | 26.4 %  |

These match the classic Larson–Dodge / Vancini textbook tables (e.g., 450 °C/100 atm ≈ 16 %,
400 °C/200 atm ≈ 38 %, 500 °C/300 atm ≈ 26 %) → **implementation is correct as written above,
including signs.**

Validity ranges: T ≈ 325–950 °C, P ≈ 10–300 atm (source data). Interpolate beta, I linearly
in P between table rows; do NOT extrapolate above 300 atm.
WARNING: units are **atm**, and Kp uses the ½N2 + (3/2)H2 convention (Kp in atm^-1). If the
reaction is written N2 + 3H2 ⇌ 2NH3, then Kp² of the half-convention is used.

### Alternatives
- Larson & Dodge (1923) — original experimental data; "The Ammonia Equilibrium",
  J. Am. Chem. Soc. (https://pubs.acs.org/doi/10.1021/ja01665a017) [S]
- El-Gharbawy (2021) — simple fitted correlation for Kp, 350–600 °C, 10–300 atm; claims
  close match to G-B; useful as a cross-check. [S]
- Vancini, C.A., "Synthesis of Ammonia", Macmillan (1971) — classic book with the G-B
  tables (citation confirmed: https://ouci.dntb.gov.ua/en/works/455xpDv4). [S]
- Appl, M., "Ammonia: Principles and Industrial Practice", Wiley-VCH (1999); also Ullmann's
  "Ammonia, 2. Production Processes" chapter. [S]
- Utwente 2025 "Thermodynamics and kinetics for ammonia synthesis" — enhanced thermodynamic
  model + unified kinetic model (open PDF:
  https://research.utwente.nl/files/495064044/1-s2.0-S1385894725054294-main.pdf). [S]
- **"Temperley/Gillespie" appears in the student's plan — no "Temperley" correlation for
  NH3 synthesis Kp exists in the literature (searched; only aqueous-ammonia unrelated hits).
  Likely a hallucinated/garbled name. The lineage is Larson-Dodge → Gillespie-Beattie →
  Vancini/Appl.** [S]

### Approach-to-equilibrium values used in industry
- Per-bed **fractional approach to equilibrium** in modern converters: design convention
  **0.90–0.95** (e.g., Cheema & Krewer 2018 keep each bed outlet at 773 K or "90% of the
  equilibrium temperature": https://pubs.rsc.org/ra/article/8/61/34926/619808). [S]
- The plan's "60–70% fractional approach" is LOW for modern plants — it will underpredict
  converter outlet NH3 by ~3–5 percentage points. Old Kellogg quench converters achieve
  ~85–90%; modern radial (Topsoe S-300, Casale, KBR) ~90–95%. Recommend default 0.90 per
  bed (or temperature approach 15–30 °C). [D, partially S via Cheema]
- Alternative convention — temperature approach: ATE = T_out − T_eq(outlet composition).
  For the primary reformer with good catalyst: ATE(CH4) 0–5 °C good, 5–10 °C acceptable,
  >10 °C marginal (Zečević & Bolf, Processes 8:408, 2020,
  https://www.mdpi.com/2227-9717/8/4/408). [S]

---

## Q2. Temkin-Pyzhev kinetics & converter types

### Rate equation (Dyson-Simon 1968 activity form of Temkin-Pyzhev) [S]
Used in essentially all modern HB reactor models (Cheema 2018, Solmaz 2024, Flórez-Orrego 2017):

    r_NH3 [kmol NH3 / (m3 cat . h)] =
        2*k * [ K_a^2 * a_N2 * (a_H2^3 / a_NH3^2)^alpha  −  (a_NH3^2 / a_H2^3)^(1−alpha) ]

where a_i = activity (or partial pressure) of species i, K_a = equilibrium constant (activity
basis), alpha ≈ 0.5–0.75, and k follows Arrhenius: k = k0 * exp(−Ea/(R*T)).

Constants reported:
| Parameter set | k0 | Ea | alpha | Validity |
|---|---|---|---|---|
| Dyson & Simon (1968), industrial Fe | 8.849e14 kmol/(m3·h) | 170,560 kJ/kmol (40,765 kcal/kmol) | 0.5 | 149–309 atm, 603–768 K (Nielsen data) |
| Solmaz/Nadiri refit (2024) | 6.5e13 | 159.4 kJ/mol | 0.654 | 90 bar lab, 598–773 K |
| Montecatini catalyst (used by Flórez-Orrego 2017, backward rate) | k0b = 2.57e14 | Eab = 163,500 kJ/kmol | 0.55 | 150–300 atm, ±10–20% deviation |

Sources: https://pure.mpg.de/rest/items/item_3608464_2/component/file_3608958/content
(Solmaz 2024, ChemCatChem — full PDF read: alpha=0.654, k0=6.5e13, Ea=159.4 kJ/mol);
https://infoscience.epfl.ch/server/api/core/bitstreams/dc58e187-417b-4e2d-961e-112df2c5be18/content
(Flórez-Orrego ECOS 2016, Table 1); 8.849e14 & 40,765 kcal/kmol confirmed in multiple
sources (Tyrański 2023 CFD paper; SSRN preprints); Nielsen 1964 (J. Catal.): Temkin-Pyzhev
applicable 370–495 °C and 150–310 atm.

### When kinetics vs equilibrium-only
- **First build: equilibrium + fractional approach (0.90–0.95) per bed.** Reproduces outlet
  compositions within ~1–2 % NH3 of plant data, is deterministic, and avoids catalyst-volume
  data. Add adiabatic temperature rise per bed (ΔH_rxn = −46 kJ/mol NH3, gas Cp mixing).
- **Kinetics worth adding (v2)** for: bed temperature profiles, catalyst loading, turndown /
  part-load (Power-to-Ammonia) behavior, H2/N2≠3 off-stoichiometry. Dyson-Simon is the
  industry-standard "good enough" kinetic set; deviations 10–20% in rate are common, so
  calibrate alpha/k against one plant anchor point. [D + S]

### Converter technology landscape [S]
- Kellogg multibed **axial quench** converter — classic 1000+ MTPD single train (first
  1000 t/d plant: Mississippi Chemical, Yazoo City, mid-1960s; UNIDO 1982 "Reactor designs
  and catalysts from ammonia plants" documents Kellogg quench vs radial designs:
  https://www.unido.org/publications/ot/9646198/pdf).
- Modern: **radial-flow** converters — Topsoe S-200 (2-bed), **S-300 (3-bed radial,
  intercooled)**; Casale axial-radial; KBR (Kellogg Brown & Root) advanced ammonia process
  with Ru catalyst (KAAP). Topsoe product pages:
  https://www.topsoe.com/solutions/technologies/equipment-and-spare-parts/ammonia-converter-baskets-s-300
- Uhde/thyssenkrupp: **3 radial magnetite beds in 2 converters**, loop 190–200 bar,
  HP steam generation downstream of each bed (IFA 2004, Frisse:
  https://www.fertilizer.org/wp-content/uploads/2023/01/2004_tech_beijing_frisse.pdf — full PDF read).
- Modeling: 3 adiabatic beds with interbed cooling (quench or indirect) is the right
  granularity; bed inlet 380–430 °C, bed outlet ≤ 500–530 °C (hot spot limit, magnetite).
  Cheema design: all bed inlets 673 K (400 °C), outlets 773 K (500 °C) at 200 bar. [S]

---

## Q3. Reforming equilibrium & SMR conditions

### Equilibrium constants (ideal gas, Dalton's law — adequate at 25–40 bar) [S][V]
Reactions:
    SR1 (steam reforming):  CH4 + H2O ⇌ CO + 3H2        ΔH°298 = +206 kJ/mol
    SR2 (water-gas shift):  CO + H2O ⇌ CO2 + H2         ΔH°298 = −41 kJ/mol

    K_SR1 = (p_CO * p_H2^3) / (p_CH4 * p_H2O)  = 1.198e13 * exp(−26830/T)   [bar^2]
    K_WGS = (p_CO2 * p_H2) / (p_CO * p_H2O)    = 1.767e-2 * exp(+4400/T)    [dimensionless]
(p in bar, T in K.) Source: Zečević & Bolf, Processes 8(4):408 (2020)
https://www.mdpi.com/2227-9717/8/4/408 (also free at
https://psecommunity.org/wp-content/plugins/wpor/includes/file/2006/LAPSE-2020.0560-1v1.pdf).

**Verification in this research (Python):**
- K_WGS at 400 °C → 12.2; at 220 °C → 133 — matches standard WGS tables. [V]
- K_SR1 = 1.198e13·exp(−26830/T) at 800 °C/30 bar/S/C=3 gives equilibrium dry CH4 slip
  8.1 %, H2 71.6 %, CO 9.5 %, CO2 10.7 % — squarely in the industrial primary-reformer
  range (CH4 slip 5–9 % dry). [V] (NOTE: the MDPI PDF typesets the pre-exponential as
  "1.198×10^17"; that is a typo/extraction artifact — 10^13 reproduces industrial slip,
  10^17 gives nonsense. Trust 1.198e13.)
- Alternative model: RGibbs (Gibbs energy minimization) with RK-Soave EOS was used by the
  Rice CENG403 design project for both reformers — also valid; ideal-gas Kp is simpler and
  adequate. [S]

### Typical SMR operating conditions [S]
- Front-end (reforming/purification) pressure: **25–35 bar** (EFMA booklet; Rice used 35.3 bar).
- S/C molar ratio: **≈ 3.0** (EFMA: "around 3.0 for BAT processes"; Rice: 3:1 optimal —
  2.5 raises CH4 slip & carbon risk, 4.0 raises duty; hydrogen plants use higher, 5+).
- Feed desulfurization: feed-gas up to 5 mg S/Nm³; hydrogenation + ZnO to <0.1 ppm S.
- Mixed feed preheated to 500–600 °C in convection section before tubes.
- **Primary reformer outlet: 780–830 °C** (EFMA); general SMR literature 800–900 °C at
  20–30 bar (globalsyngas.org: 815–925 °C). Tube metallurgy limits front-end to ~40 bar.
- Primary reformer duty example (1000 MTPD, Rice): 50 MMkcal/h (≈58 MW), 230 tubes, 4 in
  ID, 35 ft long.
- Only **30–40 % of hydrocarbon is converted in the primary** (EFMA) — the rest converts in
  the secondary.
- **Secondary reformer**: process air (21 % O2) compressed to reforming pressure, preheated
  ~600 °C; adiabatic — partial combustion of H2/CH4 raises gas to **~950–1000 °C** (Rice
  optimum 996.2 °C); exit residual CH4 **0.2–0.3 % dry** (EFMA; ~0.7 % indicates air
  distribution problems — ammoniaknowhow.com). Exit gas contains **12–15 % CO (dry)**
  (EFMA; ammonia-plant-fundamentals slide deck: ~13 % CO, 7.3 % CO2).
- Secondary outlet cooled to 350–400 °C in waste-heat boiler/superheater generating
  HP steam (~100 bar, 450–510 °C).
- Secondary modeling recipe: (1) adiabatic combustion zone — O2 consumed by H2 (fastest)
  with overall heat release fixing temperature; (2) equilibrium (SR1+SR2) over catalyst with
  small CH4 approach. Air flow is the design DOF set by final H2/N2 = 3. [D+S]
- Sources: EFMA "Booklet No. 1 Production of Ammonia" (open PDF — full text read):
  http://productstewardship.eu/fileadmin/user_upload/user_upload_prodstew/documents/Booklet_nr_1_Production_of_Ammonia.pdf ;
  https://en.wikipedia.org/wiki/Steam_reforming ; https://globalsyngas.org/syngas-technology/syngas-production/steam-methane-reforming ;
  Rice CENG403: http://www.owlnet.rice.edu/~ceng403/nh3ref97.html

### Approach-to-equilibrium used industrially (front end) [S]
- Primary reformer: methane ATE 0–5 °C (good catalyst), 5–10 °C acceptable, >10 °C marginal
  (Zečević 2020). Design shortcut commonly 10–25 °C. [S/D]
- WGS: equilibrium-limited; HTS exit ~3 % CO dry, LTS exit 0.2–0.4 % CO dry (EFMA).
- Secondary reformer: near-equilibrium on CH4 (residual 0.2–0.3 % dry); temperature approach
  typically 20–40 °C on CH4 equilibrium. [D]

---

## Q4. Water-gas shift

| Item | HTS | LTS |
|------|-----|-----|
| Catalyst | Fe2O3/Cr2O3 (Fe-Cr) | CuO/ZnO (Cu-Zn, +Al2O3) |
| Inlet T | ~350–400 °C (JM: inlet ≈350 °C) | 200–220 °C |
| Exit CO | ~3 % dry (equilibrium-limited at operating T) | **0.2–0.4 % dry** (well-run plants 0.1–0.3 %) |
| Model | equilibrium K_WGS (above) + approach 10–25 °C | equilibrium K_WGS + approach ~15–30 °C |

- Inlet CO to HTS: 12–15 % dry (from secondary reformer).
- Steam/dry-gas ratio at LTS inlet ≈ 0.45–0.50 mol/mol (cheresources practitioner data).
- Interbed cooling between HTS and LTS (boiler feedwater preheat).
- Catalysts are poisoned: HTS by chlorides/silica; LTS by S, Cl (Cu).
- Sources: EFMA booklet (full text); Johnson Matthey "Catalyst solutions delivering value in
  water gas shift" https://matthey.com/documents/161599/440149/Reprint+-+N%2BS+-+JM+Catalyst+solutions+delivering+value+in+water+gas+shift+TP+%28c2022%29.pdf ;
  https://www.digitalrefining.com/article/1002381/improvements-to-water-gas-shift-process ;
  https://smartcatalyst.ir/en/high-and-low-temperature-shift-catalyst

---

## Q5. CO2 removal & methanation

### CO2 removal
- Candidate processes: MEA (legacy, high regeneration energy — NOT BAT), **aMDEA (BASF
  activated MDEA — current default for new plants)**, **Benfield** hot potassium carbonate
  (promoted; variants HiPure, LoHeat), Selexol (physical), PSA (H2 plants). [S — EFMA]
- Residual CO2 after removal: **100–1000 ppmv typical; down to ~50 ppmv achievable** [S — EFMA].
  Modern aMDEA designs run < 50 ppmv (researchgate: "CO2 slip < 50 ppmv" for new systems).
- Heat consumption (chemical absorption): **30–60 MJ per kmol CO2** [S — EFMA]. Physical
  solvents ≈ 0 heat but mechanical energy.
- Removal efficiency ≈ 99.5 %+ of the CO2 (CO2 is ~18–22 % dry of shifted gas) [D].
- Absorption column ~30–60 bar (front-end pressure), regeneration at 1.5–2 bar.
- Modeling for first build: black-box splitter with fixed residual ppm + reboiler duty
  30–60 MJ/kmol CO2; VLE not needed. [D]

### Methanation (final purification)
- Ni catalyst, **~300 °C** inlet (EFMA; literature 300–450 °C); adiabatic.
- Reactions: CO + 3H2 → CH4 + H2O; CO2 + 4H2 → CH4 + 2H2O.
- Temperature rise: **74 °C per 1 vol% CO converted, 60 °C per 1 vol% CO2** [S — Johnson
  Matthey methanation brochure:
  https://matthey.com/documents/161599/440146/JM%20Methanation%20product%20brochure%20%281%29.pdf].
- Exit CO+CO2: **< 1 ppm** (must be; oxygenates are reversible poisons to the Fe synthesis
  catalyst — total oxygenates should stay below ~10 ppm, normally single-digit ppm). [S/D]
- Methanator inlet total carbon oxides: ~0.2–0.4 % CO + 0.01–0.1 % CO2 → CH4 added to loop
  inerts + H2 consumed (4:1 on CO2, 3:1 on CO) + water knocked out after cooler.
- Sources: EFMA booklet; JM brochure; MDPI Catalysts 13(2):448 (methanation review).

---

## Q6. Synthesis loop numbers

| Parameter | Typical value | Source |
|---|---|---|
| Loop pressure | 100–250 bar; modern conventional 150–200 bar (Uhde 190–200) | EFMA [S]; IFA/Frisse [S]; Flórez-Orrego cases 150 & 200 bar [S] |
| Converter bed 1 inlet T | 380–430 °C (Cheema 400 °C; Flórez-Orrego base 450 °C@150 bar, 410 °C@200 bar; optimum lower) | Cheema [S]; Flórez-Orrego [S] |
| Max bed outlet T | ~500–530 °C (773 K design cap in Cheema) | [S] |
| Converter inlet NH3 (from recycle) | 1.9–2.6 mol% | Flórez-Orrego Table 5 [S] |
| Converter outlet NH3 | **14–18 mol%** typical (Shamiri plant: 15.26 % per pass; Rice Gibbs 2-bed at 100 bar: 19 %; Indorama: 24.4 % high-end; Cheema P2A design: 25–35 %) | multiple [S] |
| Per-pass conversion (N2 basis) | 10–20 % (Humphreys: catalysts 10–15 %; EFMA: 20–30 % reacted per pass incl. dilution effects) | [S] |
| Overall conversion with recycle | > 98 % of makeup gas converted (Rice: 98.96 % product purity; H2 recovery from purge typical) | [S/D] |
| Separator/condensation | water/air cooling then refrigerated chill to **≈ −20 °C** (Flórez-Orrego, 2-stage R717 refrigeration w/ intercooling); −25 to −33 °C at lower loop pressures; Uhde dual-pressure: −33 °C product | Flórez-Orrego [S]; IFA [S] |
| Liquid product purity | 99.5 wt% NH3 (Rice design; metallurgical grade) | [S] |
| Purge | controls loop inerts to **10–15 %** (CH4+Ar); purge ≈ 5–8 % of loop gas / ≈ 10 % of makeup (Rice: 6 % and 7.25 % purge) | EFMA [S]; Rice [S] |
| Loop inerts (CH4+Ar) | 8–15 mol% (Flórez-Orrego: 8.4–15.4 %) | [S] |
| Fresh syngas inerts | ~1.1–1.3 mol% | Flórez-Orrego [S] |
| H2/N2 ratio | makeup 2.83–2.99; loop feed 2.4–2.9 (drifts low due to purge losses & H2 recovery) | Flórez-Orrego [S] |
| Loop pressure drop | design 1.5–5 bar optimal; base-case plants up to 10–16 bar | Flórez-Orrego [S] |
| Refrigeration COP | actual ≈ 2.4 (Carnot 4.42) | Flórez-Orrego [S] |
| Power split (1000 MTPD) | syngas compression 61–75 %, refrigeration 24–36 %, circulator rest; total ≈ 13 MW optimal / 19–22 MW base-case | Flórez-Orrego [S] |
| Loop gas / recycle multiple | recycle 15,000–38,000 kmol/h vs fresh ~4,900–8,300 kmol/h (≈ 4–5× recycle multiple) | Flórez-Orrego [S] |
| Circulator efficiency | 75 % | Flórez-Orrego [S] |

Sources: Flórez-Orrego & de Oliveira Junior, ECOS 2016 (free PDF, read in full:
https://infoscience.epfl.ch/server/api/core/bitstreams/dc58e187-417b-4e2d-961e-112df2c5be18/content),
journal version Energy 137 (2017) 234–250; EFMA booklet; Rice CENG403
http://www.owlnet.rice.edu/~ceng403/nh3syn97.html and /nh3ref.html; Shamiri et al. 2021
https://www.sciencedirect.com/science/article/pii/S2666821121000922; Cheema & Krewer 2018
RSC Adv. 8 34926.

Loop arrangement (BAT): add make-up gas AFTER ammonia condensation, purge AFTER separator
& BEFORE make-up addition (EFMA). Model the separator with NH3 VLE (Raoult/Henry — liquid
nearly pure NH3; gas leaves with ~2–3 % NH3 at −20 °C, 150 bar). [S/D]

---

## Q7. Syngas compression (polytropic)

### Configuration [S]
- Make-up syngas: from front-end 25–35 bar to loop 150–200 bar (up to 250 bar);
  **2 casings (LP+HP), typically 3–4 compression stages with intercooling to ~40 °C**,
  steam-turbine driven (HP/MP extraction or condensing). Uhde: two-casing compressor pairs
  with 190–200 bar loop (IFA/Frisse). Example: Puertollano syngas 25→250 bar, 2 trains
  (idom.com). Older designs: single 4-case train to 153 bar (Amhamed 2022 review).
- Stage pressure ratio typically 2–3.5; keep discharge T ≤ ~150–200 °C (H2-rich gas).
- Recycle circulator: small ΔP (5–25 bar boost), centrifugal, η ≈ 75 %.
- Refrigeration compressor (NH3), 2-stage with intercooling, η ≈ 75 %.

### Closed-form polytropic equations (ideal gas) [S]
    (n − 1)/n = (k − 1)/(k * η_p)                    (compression; k = Cp/Cv)
    H_p = Z_avg * R * T1 * (n/(n − 1)) * [ (P2/P1)^((n−1)/n) − 1 ]     [J/kmol]
         = (Z_avg * R_u * T1 / M) * ...                               [J/kg with R = Ru/M]
    W_gas = mdot * H_p                                [W]
    T2 = T1 * (P2/P1)^((n−1)/n)

with η_p = polytropic efficiency (0.72–0.78 for large centrifugal syngas machines; 75 %
used in the Flórez-Orrego model), Z_avg ≈ mean compressibility (H2-rich syngas Z ≈ 1.02–1.08;
H2 has Z>1 — do not assume Z<1). k for 3:1 H2/N2 ≈ 1.40–1.41 at 300 K (H2 1.41, N2 1.40),
lower at temperature.
Sources: http://docs.codecalculation.com/thermodynamics/chap06.html (head formula);
https://www.jmcampbell.com/tip-of-the-month/2011/11/compressor-calculations-rigorous-using-equation-of-state-vs-shortcut-method ;
https://www.scribd.com/document/294062820/Polytropic-Compression (W = m*Hp/ηp note);
75 % efficiency: Flórez-Orrego [S]. Efficiency range 72–78 % [D].

Sanity anchor: 1000 MTPD plant, syngas make-up ≈ 4,900–8,300 kmol/h compressed 25→150 bar
consumes ~8–10 MW; total loop power ~13 MW optimal. [S — Flórez-Orrego]

---

## Q8. Published mass/energy balances for VALIDATION (see ranked list at end)

Full details, conditions and what each contains are inline above. Summary of what was
actually retrieved and read:
1. **EFMA/Fertilizers Europe "Booklet No. 1 — Production of Ammonia"** (2000, 44 pp) —
   complete conventional SMR plant description with typical ranges for every section
   (downloaded & fully read; free PDF).
2. **Flórez-Orrego & de Oliveira Junior (ECOS 2016 conf. paper — free PDF, read in full;
   journal version Energy 137 (2017) 234–250)** — 1000 MTPD SMR ammonia unit, Hysys model;
   full base-case/optimal operating tables for the synthesis loop (bed temps, conversions
   per bed, recycle composition, power breakdown); Montecatini kinetic constants; G-B cited
   for equilibrium.
3. **Mahmoud, N. (TAMU M.S. thesis, 2024) "Decarbonizing Ammonia Production..."** — Aspen
   Plus model of a conventional NG SMR ammonia plant with **full stream-by-stream mass
   balance tables** (e.g., "Table 24: Base Case Ammonia Plant Mass Balance" + appendix with
   every stream). PDF is behind Cloudflare but the thesis is citable and obtainable via
   library: https://oaktrust.library.tamu.edu/bitstreams/d88d335a-2cb2-40b8-88d6-d21fbd138424/download
4. **Rice University CENG403 design projects (1997)** — three connected projects
   (reformers / synthesis loop / refrigeration-separation) for a 1000–1016 MTPD plant with
   ASPEN (RGibbs + RKS) numbers: primary 800 °C/35.3 bar/S-C 3/duty 50 MMkcal/h; secondary
   996.2 °C, outlet H2 3375 / CO 814 / N2 1351 kmol/h; loop 100 bar, 7.25 % purge,
   19 % per-pass, 99.5 wt% product. Plain HTML, free.
5. **Zečević & Bolf (Processes, 2020)** — industrial SMR reformer monitoring model with the
   K_SR1/K_WGS constants and ATE benchmarks (free PDF, read in full).
6. **Cheema & Krewer (RSC Adv. 2018)** — open-access HB reactor model (Dyson-Simon kinetics,
   activities, Cp/ΔH correlations) with bed-by-bed design values (free PDF, read in full).
7. **Shamiri et al. (2021, Case Studies in Chem. Eng. Env.)** — industrial 3-bed loop, plant
   vs. model comparison, 15.26 % per-pass conversion (open access).
8. **EAS J. (2020) "Simulation and Optimization of an Ammonia Plant: Indorama case study"** —
   Aspen HYSYS V8.8 model validated against plant data; reformer duties 125.4 Gcal/h primary,
   43.0 Gcal/h secondary (open access web page read).
9. Books (citable, not open): Appl, "Ammonia: Principles and Industrial Practice" (Wiley-VCH
   1999); Vancini (1971); Ullmann's Encyclopedia "Ammonia" chapter; Maxwell — no public
   "Maxwell thesis" found; the student's "Maxwell's thesis" reference could not be verified
   (likely another garbled citation — flag).

**Turton / Felder do NOT contain a complete ammonia plant case study** (Turton's book is
generic process design; no ammonia flowsheet with stream table). Don't count on them.

---

## Q9. Recycle convergence (tear streams)

- **Direct substitution**: x_{k+1} = g(x_k). Robust, linear convergence; for the NH3 loop
  (inert accumulation) typically 10–30 iterations to 1e-4 relative tolerance. Use for the
  first 2–5 iterations to get into the basin. [S/D]
- **Wegstein (1958)**: secant acceleration of fixed point. Per variable:
      s = (g(x_k) − g(x_{k−1})) / (x_k − x_{k−1))    (slope)
      q = s / (s − 1)
      x_{k+1} = q*x_k + (1 − q)*g(x_k)
  Typically converges in 5–15 iterations. **Failures/limits**: when s → 0, q → 0 →
  overshoot/oscillation; commercial simulators bound q (Aspen-type bounds q ∈ [−5, 0];
  DEM damping 0–5; see Wiley "Experimental methods... process flowsheeting" 2020,
  https://onlinelibrary.wiley.com/doi/10.1002/cjce.23857 and classic Wegstein method PDFs).
  Apply damping (e.g., accelerate only after iteration 3; cap |q|). [S]
- **Broyden quasi-Newton**: rank-one Jacobian updates, superlinear; best for multi-variable
  tears (the loop tear has 6–8 variables: N2, H2, NH3, CH4, Ar, CO2(0), flows + recycle
  split). Needs more memory/code but handles strong coupling (converter ⇄ separator ⇄ purge).
  [S]
- **Fallback**: dynamic relaxation — Luyben (2004) "Use of dynamic simulation to converge
  complex process flowsheets" (https://www.cache.org/sites/default/files/fall2004_dynamicsimulation.pdf)
  — integrate the loop ODEs to steady state when Wegstein/Broyden oscillate. [S]
- **Recommended strategy for the app**: direct substitution with 0.5 damping for 3
  iterations → bounded Wegstein (q clipped to [−5, 0]) → if not converged in ~25 iters,
  switch to Broyden or halve the step. Tolerances: 1e-4–1e-5 relative on tear molar flows;
  expect total ~10–20 evaluations of the loop. [D + S]
- Physical tip that matters more than the solver: initialize the loop tear stream
  *close* to the answer (e.g., 13 % inerts, 2.5 % NH3, H2/N2 = 2.7, T = 380 °C, P = loop P);
  a cold start with pure 3:1 H2/N2 and zero NH3 wastes iterations and can drive the
  equilibrium solve to a trivial root. [D]

---

## Q10. Energy integration & specific consumption

### Conventional SMR ammonia plant
- Best-available new plants (BAT): **28–29 GJ/t NH3** (7.78 MWh/t) — ammoniaenergy.org
  "Optimal" figure; IFA top-decile ~28–29 GJ/t. [S]
- Uhde modern plants: **6.6–7.2 Gcal/t = 27.6–30.1 GJ/t** (feed + fuel + electric power).
  [S — IFA/Frisse 2004, PDF read]
- Global average: **~41 GJ/t** (IEA Ammonia Technology Roadmap 2021, net basis; IEA: ammonia
  = 2 % of global final energy, 1.3 % of energy-system CO2). [S]
- 2008 survey of 93 plants: average 36.6 GJ/t, top 10 % near 28–29 GJ/t (IFA data). [S]
- UNIDO Egypt benchmarking: best plant 26.7 GJ/t. [S]
- Thermodynamic minimum: modern plants run 40–50 % above it; practical minimum ≈ 130 % of
  theoretical; more than half of the excess is compression losses (EFMA). [S]
- Natural gas vs alternatives (relative energy): NG 1.0, heavy oil 1.3, coal 1.7 (EFMA). [S]

### Where the energy goes / heat integration [S]
- Primary reformer furnace is the largest fuel consumer (Rice case: 50 MMkcal/h ≈ 58 MW for
  1000 MTPD; Indorama case: primary duty 125 Gcal/h at higher capacity).
- Waste heat recovery: HP steam (~100 bar, 450–510 °C) raised in reformer convection bank,
  secondary-reformer waste-heat boiler/superheater, and synloop boilers downstream of each
  catalyst bed (Uhde: HP steam generation after each bed is a major efficiency contributor).
- Steam drives: syngas compressor, process air compressor (24.5 MW at 3300 MTPD — Uhde),
  refrigeration compressor, BFW pumps via steam turbines; net steam export common (e.g., to
  urea). The plant steam balance sets the optimum S/C ratio.
- Shift/reformer low-level heat → CO2 solvent regeneration (30–60 MJ/kmol CO2) and
  absorption refrigeration; LTS/methanator heat → BFW preheat. [S — EFMA]

### Green ammonia (for future economics mode)
- Electrolysis: ~53 kWh/kg H2 (Salamanca paper: 53.15 kWh/kg H2, NEL electrolyzer); 1 t H2 →
  5.7 t NH3 → electrolysis alone ≈ 9.3 MWh/t NH3.
- Total power-to-ammonia: **10–12 MWh/t NH3 (36–43 GJ/t)** including ASU, compression, loop;
  improving toward 8–9 MWh/t (multiple sources: ammoniagas.com, patsnap, Nami 2024:
  14–15 MWh/t for some systems). greenammonia.info: 9.7 MWh/t.
- Contrast for the app's economic mode: SMR plant buys ~28–33 GJ/t of natural gas;
  green plant buys ~10–12 MWh/t of electricity (+ CO2-free premium). Electricity at
  $30–70/MWh ⇒ $300–840/t NH3 energy cost vs gas at $3–8/MMBtu ⇒ $80–270/t. [S/D]
- Sources: https://ammoniaenergy.org/articles/ammonia-technology-portfolio-optimize-for-energy-efficiency-and-carbon-efficiency ;
  https://greenammonia.info/green-ammonia-production ; https://www.sciencedirect.com/science/article/pii/S1364032124002405 ;
  https://www.iea.org/reports/ammonia-technology-roadmap/executive-summary ;
  https://gredos.usal.es/bitstream/handle/10366/153981/Optimal%20renewable%20production%20of%20ammonia%20from%20water%20and%20air.pdf (Sánchez et al. — free PDF, read: electrolysis 53.15 kWh/kg H2, reactor 168 bar, polytropic compressors η 0.85, Temkin model with Appl 2011 effectiveness factor).

---

## STREAM OBJECT SCHEMA — recommendation [D]
(as requested under open items; synthesized from the unit-op data above)
- Species set: ["H2","N2","NH3","CH4","H2O","CO","CO2","O2","Ar"] (+ "S" trace if modeling
  desulfurization).
- Fields: `id:str, phase:str, T:float(K), P:float(Pa), F:float(kmol/h), y:dict[species→mole
  fraction (sums to 1.0)]`, derived on demand: mass flow (kg/h), MW, molar enthalpy h(T,y)
  with a single reference state (e.g., elements at 298.15 K), Cp mix.
- Rules: SI internally (K, Pa, kmol/h); mole basis (stoichiometry stays linear); carry
  units metadata; never store both mass & mole fractions (single source of truth);
  tolerances: composition 1e-10, flows relative 1e-6.
- Keep per-unit-op derived state separate (duties, approach temps, efficiencies) in unit
  objects, not in streams.

## EQUILIBRIUM vs KINETICS — verdict for first build [D + S]
First build = **equilibrium converter with per-bed fractional approach 0.90–0.95** +
adiabatic beds (ΔH = −46 kJ/mol NH3) + interbed quench/cooling. G-B for the loop Kp
(10–300 atm table with β, I interpolation — verified numerically above); ideal-gas Kp
(K_SR1, K_WGS from Zečević — verified) for reformer/shift/methanator with small approaches.
Add Dyson-Simon kinetics only when the user wants catalyst volumes or off-design (load)
studies.

## PLAN CORRECTIONS (flag for the main agent)
1. "Gillespie-Beattie" ✓ correct choice — but implement with the pressure-dependent β/I
   table and ATM units (numerically verified table + formula above).
2. "Temperley/Gillespie" — Temperley doesn't exist for NH3 synthesis; drop it.
3. "Maxwell's thesis" — could not be found; use Flórez-Orrego / EFMA / TAMU instead.
4. "60–70% fractional approach" — too conservative; use 90–95 % per bed (or 15–30 °C
   temperature approach) to match plant data.
5. Turton/Felder have no ammonia case study — validate against EFMA + Flórez-Orrego + TAMU.
6. Secondary reformer must be modeled in two zones (combustion + equilibrium); air flow is
   the DOF that sets final H2/N2 = 3.
7. Include Ar (from air, 0.93 %) — purge design depends on it.

---

## VALIDATION SOURCES (ranked)

1. **EFMA / Fertilizers Europe, "Booklet No. 1: Production of Ammonia" (Best Available
   Techniques, 2000)** — free PDF, whole conventional SMR process with typical T/P/
   composition ranges per section (front-end 25–35 bar, S/C 3, primary 780–830 °C,
   secondary CH4 slip 0.2–0.3 %, HTS 3 % CO, LTS 0.2–0.4 % CO, CO2 100–1000 ppmv, loop
   100–250 bar, 20–30 % per pass, inerts 10–15 %). Best single "ground truth ranges"
   document to check a flowsheet-level balance.
   http://productstewardship.eu/fileadmin/user_upload/user_upload_prodstew/documents/Booklet_nr_1_Production_of_Ammonia.pdf

2. **Flórez-Orrego, D. & de Oliveira Junior, S., "Modeling and optimization of an industrial
   ammonia synthesis unit: an exergy approach", Energy 137 (2017) 234–250** (free ECOS 2016
   version at EPFL infoscience, read in full) — 1000 MTPD SMR unit; the most complete public
   table of synthesis-loop design data (bed inlet temps, per-bed conversions, recycle
   composition/inerts/NH3, power split, COP, kinetic constants) plus Hysys modeling details.
   https://infoscience.epfl.ch/server/api/core/bitstreams/dc58e187-417b-4e2d-961e-112df2c5be18/content

3. **Mahmoud, N.M.A.A. (2024), "Decarbonizing Ammonia Production Using an Absorption
   Enhanced Reforming..." M.S. thesis, Texas A&M** — Aspen Plus model of a conventional NG
   SMR ammonia plant **with full stream-by-stream mass balance tables** (Table 24 +
   appendix). The closest thing found to a complete citable stream table for validation.
   https://oaktrust.library.tamu.edu/bitstreams/d88d335a-2cb2-40b8-88d6-d21fbd138424/download

4. **Rice University CENG403 Ammonia Design Projects (1997)** — three coordinated 1000–1016
   MTPD designs (reformers; synthesis loop; refrigeration/separation) with ASPEN RGibbs/RKS
   numbers (primary 800 °C/35.3 bar/3:1 S-C/50 MMkcal·h−1; secondary 996 °C with outlet
   flows; loop 100 bar, 7.25 % purge, 19 % per pass; 3 flash drums + compressor; 99.5 wt %
   product). Free HTML; excellent coarse validation targets.
   http://www.owlnet.rice.edu/~ceng403/nh3ref97.html ; http://www.owlnet.rice.edu/~ceng403/nh3syn97.html ;
   http://www.owlnet.rice.edu/~ceng403/nh3ref.html

5. **Cheema & Krewer (2018), "Operating envelope of Haber–Bosch process design for
   power-to-ammonia", RSC Advances 8, 34926** (open access, PDF read) — rigorous
   Dyson–Simon activity model, 3-bed autothermal converter design at 200 bar (673/773 K),
   complete equations for rates, activities, Cp, ΔH — ideal for implementing the kinetic
   model and cross-checking equilibrium conversions.
   https://pubs.rsc.org/ra/article/8/61/34926/619808 (PDF via pure.mpg.de)

Supporting (open): Zečević & Bolf, Processes 8:408 (2020) — reformer equilibrium constants &
ATE benchmarks; Shamiri et al. (2021) — plant-validated loop model; IFA/Frisse (2004) —
Uhde 3300 MTPD plant description, 6.6–7.2 Gcal/t; IEA Ammonia Technology Roadmap (2021) —
energy statistics; El-Gharbawy (2021) — G-B coefficient table + alternative Kp fit.
