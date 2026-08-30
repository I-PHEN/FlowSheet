#!/usr/bin/env python3
"""Charts for the Ammonia Plant Builder Agent research report.
Follows typesetting/charts.md: no top/right spines, dashed grid 20% opacity,
first/last/max/min labeling, legend outside plot area, muted palette colors.
"""
import matplotlib
import matplotlib.font_manager as fm
fm.fontManager.addfont('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')
import matplotlib.pyplot as plt
import numpy as np

plt.rcParams['font.sans-serif'] = ['DejaVu Sans']
plt.rcParams['axes.unicode_minus'] = False
plt.rcParams['font.size'] = 10

# Cascade palette (design_engine palette-cascade, intent=cold, seed=42)
ACCENT   = '#1f6c92'   # series 1
ACCENT_2 = '#c23a50'   # series 2
HEADER   = '#32454e'   # series 3
ICON     = '#4b86a4'   # series 4
BORDER   = '#acbdc5'
MUTED    = '#747b7e'
TEXT     = '#131515'

OUT = '/home/z/my-project/scripts/assets'


def style_axes(ax):
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    ax.spines['left'].set_color(BORDER)
    ax.spines['bottom'].set_color(BORDER)
    ax.tick_params(colors=MUTED, labelsize=9)
    ax.grid(True, linestyle='--', linewidth=0.5, alpha=0.2, color=HEADER)
    ax.set_axisbelow(True)


# ----------------------------------------------------------------------------
# Chart 1: NH3 equilibrium curves (Gillespie-Beattie, verified) + approach bands
# ----------------------------------------------------------------------------
# Verified equilibrium NH3 mol% table (research 2-c, numerically verified
# against Larson-Dodge / Vancini classic tables)
T_C = np.array([350, 400, 450, 500])
eq = {
    100: [37.3, 25.2, 16.3, 10.5],
    150: [45.2, 32.4, 22.3, 15.0],
    200: [50.9, 38.2, 27.4, 19.1],
    300: [59.1, 47.0, 35.8, 26.4],
}
fig, ax = plt.subplots(figsize=(7.4, 4.2), constrained_layout=True)
colors = {100: ICON, 150: ACCENT, 200: HEADER, 300: ACCENT_2}
for p, vals in eq.items():
    ax.plot(T_C, vals, marker='o', markersize=4, linewidth=2.2,
            color=colors[p], label=f'{p} bar')
    # first/last labels only
    ax.annotate(f'{vals[0]:.0f}%', (T_C[0], vals[0]), textcoords='offset points',
                xytext=(-6, 4), fontsize=8.5, color=colors[p], ha='right')
    ax.annotate(f'{vals[-1]:.0f}%', (T_C[-1], vals[-1]), textcoords='offset points',
                xytext=(6, -2), fontsize=8.5, color=colors[p], ha='left')

# Approach-to-equilibrium band at 450 C, 200 bar: 65% vs 90% of equilibrium
ax.annotate('', xy=(450, 27.4), xytext=(450, 27.4 * 0.65),
            arrowprops=dict(arrowstyle='<->', color=MUTED, lw=1.1))
ax.text(457, 22.0, 'plan says 65% approach\n= 17.8 mol% NH3',
        fontsize=8.5, color=MUTED, va='center')
ax.text(457, 25.8, 'industry runs 90-95%\n= 24.7-26.1 mol%',
        fontsize=8.5, color=ACCENT_2, va='center', fontweight='bold')

ax.set_xlabel('Temperature (°C)', fontsize=10, color=TEXT)
ax.set_ylabel('Equilibrium NH3 (mol %)', fontsize=10, color=TEXT)
ax.set_xlim(340, 560)
ax.set_ylim(5, 65)
style_axes(ax)
ax.legend(loc='upper left', bbox_to_anchor=(1.02, 1.0), frameon=False,
          fontsize=9, title='Loop pressure', title_fontsize=9)
fig.savefig(f'{OUT}/chart_equilibrium.png', dpi=200, facecolor='white')
plt.close(fig)

# ----------------------------------------------------------------------------
# Chart 2: Voice latency comparison (horizontal bars vs thresholds)
# ----------------------------------------------------------------------------
labels = [
    'Human turn-taking gap',
    'Naive STT-LLM-TTS pipeline',
    'Sentence-chunked streaming',
    'Median production voice AI',
    'OpenAI Realtime API (e2e)',
]
lo = np.array([0.20, 1.30, 0.42, 1.40, 0.50])
hi = np.array([0.30, 2.00, 0.52, 1.70, 0.80])
mid = (lo + hi) / 2
colors_bar = [MUTED, '#a25b54', '#529067', '#8c7443', ACCENT]

fig, ax = plt.subplots(figsize=(7.4, 3.6), constrained_layout=True)
y = np.arange(len(labels))
ax.barh(y, hi - lo, left=lo, height=0.52, color=colors_bar, alpha=0.85,
        edgecolor='none')
for i, (l, h) in enumerate(zip(lo, hi)):
    txt = f'{l:.2f}-{h:.2f} s' if h < 1 else f'{l:.1f}-{h:.1f} s'
    ax.text(h + 0.04, i, txt, va='center', fontsize=9, color=TEXT)
ax.axvline(0.6, color=ACCENT_2, linestyle='--', linewidth=1.2, alpha=0.7)
ax.text(0.615, len(labels) - 0.42, '0.6 s natural-feel\nthreshold', fontsize=8.5,
        color=ACCENT_2, va='center')
ax.set_yticks(y)
ax.set_yticklabels(labels, fontsize=9.5, color=TEXT)
ax.invert_yaxis()
ax.set_xlabel('Time to first audio / end-to-end response (s)', fontsize=10, color=TEXT)
ax.set_xlim(0, 2.35)
style_axes(ax)
ax.grid(axis='y', visible=False)
fig.savefig(f'{OUT}/chart_latency.png', dpi=200, facecolor='white')
plt.close(fig)

# ----------------------------------------------------------------------------
# Chart 3: TTS price comparison (horizontal bars, $/1M characters)
# ----------------------------------------------------------------------------
tts = [
    ('Kokoro-82M (self-host)', 0),
    ('Azure free tier (500k/mo)', 0),
    ('Google Cloud standard', 8),
    ('OpenAI gpt-4o-mini-tts', 15),
    ('Amazon Polly neural', 17.6),
    ('Azure neural', 15.5),
    ('Cartesia Sonic', 30),
    ('Deepgram Aura-2', 30),
    ('ElevenLabs Flash', 50),
    ('ElevenLabs v2/v3', 100),
]
names = [t[0] for t in tts]
prices = [t[1] for t in tts]
cols = ['#529067' if p == 0 else (ACCENT if p <= 20 else (ICON if p <= 35 else '#8c7443'))
        for p in prices]

fig, ax = plt.subplots(figsize=(7.4, 4.4), constrained_layout=True)
y = np.arange(len(tts))
bars = ax.barh(y, prices, height=0.58, color=cols, alpha=0.88, edgecolor='none')
for i, p in enumerate(prices):
    if p == 0:
        ax.text(1.2, i, 'free', va='center', fontsize=9, color='#529067',
                fontweight='bold')
    else:
        ax.text(p + 1.5, i, f'${p:g}', va='center', fontsize=9, color=TEXT)
ax.set_yticks(y)
ax.set_yticklabels(names, fontsize=9.5, color=TEXT)
ax.invert_yaxis()
ax.set_xlabel('Price per 1M characters (USD, list, 2025-2026)', fontsize=10, color=TEXT)
ax.set_xlim(0, 115)
style_axes(ax)
ax.grid(axis='y', visible=False)
fig.savefig(f'{OUT}/chart_tts_price.png', dpi=200, facecolor='white')
plt.close(fig)

# ----------------------------------------------------------------------------
# Chart 4: Interactivity ladder — effort vs impact scatter
# ----------------------------------------------------------------------------
features = [
    ('Flow shader', 2.5, 8.2),
    ('Live PFD', 3.0, 8.0),
    ('Streaming narration', 2.0, 7.2),
    ('Interruptible narration', 3.5, 7.5),
    ('Exploded view', 4.0, 6.8),
    ('Push-to-talk what-if', 5.0, 8.8),
    ('Fault injection', 10.0, 9.0),
    ('P&ID-3D sync', 10.0, 9.4),
    ('Scenario scoring', 10.0, 8.4),
    ('First-person walk', 10.0, 7.0),
    ('Full-duplex talk', 14.0, 9.6),
    ('Instructor station', 20.0, 8.6),
    ('Quasi-dynamic clock', 14.0, 8.8),
    ('AI-authored faults', 5.0, 7.8),
    ('Leaderboards', 4.0, 6.0),
]
phase_color = {'core': ACCENT, 'ops': ICON, 'demo': ACCENT_2}
# assign phases
phases = ['core', 'core', 'core', 'core', 'core', 'core',
          'ops', 'ops', 'ops', 'ops', 'demo', 'demo', 'demo', 'ops', 'ops']

fig, ax = plt.subplots(figsize=(7.4, 4.6), constrained_layout=True)
seen = set()
for (name, eff, wow), ph in zip(features, phases):
    lbl = {'core': 'Alive plant (v2 tier)', 'ops': 'Operator mode (v3 tier)',
           'demo': 'Headline demo tier'}[ph]
    ax.scatter(eff, wow, s=110, color=phase_color[ph], alpha=0.85,
               label=lbl if ph not in seen else None, edgecolor='white',
               linewidth=1.2, zorder=3)
    seen.add(ph)
offsets = {
    'Flow shader': (4, 6), 'Live PFD': (4, -10), 'Streaming narration': (5, 4),
    'Interruptible narration': (5, -9), 'Exploded view': (5, 5),
    'Push-to-talk what-if': (-8, 9), 'Fault injection': (5, 5),
    'P&ID-3D sync': (5, 5), 'Scenario scoring': (5, -11),
    'First-person walk': (5, -11), 'Full-duplex talk': (-58, 6),
    'Instructor station': (-30, -14), 'Quasi-dynamic clock': (5, 5),
    'AI-authored faults': (5, -11), 'Leaderboards': (5, 4),
}
for (name, eff, wow), ph in zip(features, phases):
    dx, dy = offsets[name]
    ax.annotate(name, (eff, wow), textcoords='offset points', xytext=(dx, dy),
                fontsize=7.8, color=TEXT)
ax.set_xlabel('Build effort for a solo developer (working days)', fontsize=10, color=TEXT)
ax.set_ylabel('Differentiation / wow factor (index)', fontsize=10, color=TEXT)
ax.set_xlim(0, 23)
ax.set_ylim(5.4, 10.4)
style_axes(ax)
ax.legend(loc='lower right', frameon=False, fontsize=9)
fig.savefig(f'{OUT}/chart_ladder.png', dpi=200, facecolor='white')
plt.close(fig)

# ----------------------------------------------------------------------------
# Chart 5: Roadmap v2 timeline (Gantt-style horizontal bars, dev-weeks)
# ----------------------------------------------------------------------------
stages = [
    ('S0  Foundations: stream object, thermo core, plumbing tests', 0, 2),
    ('S1  Front-end train (once-through units)', 2, 3),
    ('S2  Synthesis loop + convergence + validation', 5, 4),
    ('S3  MVP shell: 3D render + guided voice walkthrough', 9, 4),
    ('S4  v2 what-if sandbox: live PFD + push-to-talk + streaming TTS', 13, 4),
    ('S5  v3 operator mode: faults, scoring, debriefs', 17, 5),
    ('S6  v4 exports: PFD + mass-balance tables', 22, 2),
    ('S7  v5 economics: energy + capital trade-offs', 24, 3),
]
fig, ax = plt.subplots(figsize=(7.4, 4.0), constrained_layout=True)
y = np.arange(len(stages))
for i, (name, start, dur) in enumerate(stages):
    col = ACCENT if i < 4 else (ICON if i < 6 else HEADER)
    ax.barh(i, dur, left=start, height=0.55, color=col, alpha=0.88,
            edgecolor='none')
    ax.text(start + dur + 0.25, i, f'{dur} wk', va='center', fontsize=8.5,
            color=TEXT)
ax.set_yticks(y)
ax.set_yticklabels([s[0] for s in stages], fontsize=8.8, color=TEXT)
ax.invert_yaxis()
ax.set_xlabel('Elapsed working weeks (solo developer, part-time)', fontsize=10, color=TEXT)
ax.set_xlim(0, 30)
style_axes(ax)
ax.grid(axis='y', visible=False)
# milestone markers
ax.axvline(13, color=ACCENT_2, linestyle='--', linewidth=1.1, alpha=0.7)
ax.text(13.2, 7.35, 'MVP demo', fontsize=8.5, color=ACCENT_2, rotation=0)
fig.savefig(f'{OUT}/chart_roadmap.png', dpi=200, facecolor='white')
plt.close(fig)

print('All 5 charts generated in', OUT)
