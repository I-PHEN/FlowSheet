'use client';

import { useState } from 'react';
import type { PlantResult } from '@/lib/engine/types';
import type { PlantSpec } from '@/lib/engine/plant';
import { SPEC_FIELDS, UNITS } from '@/lib/workbench/layout';
import type { SpecField } from '@/lib/workbench/layout';
import { Switch } from '@/components/ui/switch';

interface Props {
  spec: PlantSpec;
  onSpecChange: (patch: Partial<PlantSpec>) => void;
  result: PlantResult;
  selectedUnit: string | null;
  onSelectUnit: (id: string | null) => void;
}

export function Inspector({ spec, onSpecChange, result, selectedUnit, onSelectUnit }: Props) {
  const unit = selectedUnit ? result.units[selectedUnit] : null;
  const node = selectedUnit ? UNITS.find((u) => u.id === selectedUnit) : null;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* header */}
      <div className="flex items-center justify-between border-b border-[#1f2a34] px-3 py-2">
        <div className="wb-label">
          {unit ? `${node?.section ?? ''} · ${unit.id}` : 'PLANT OVERVIEW'}
        </div>
        {selectedUnit && (
          <button
            className="wb-mono text-[10px] text-[#5c7080] hover:text-[#dce5ec]"
            onClick={() => onSelectUnit(null)}
          >
            ← PLANT
          </button>
        )}
      </div>

      <div className="wb-scroll flex-1 overflow-y-auto">
        {unit ? (
          <UnitCard
            unitId={unit.id}
            result={result}
            spec={spec}
            onSpecChange={onSpecChange}
          />
        ) : (
          <PlantOverview result={result} spec={spec} onSpecChange={onSpecChange} />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-[#151d25] py-1.5">
      <span className="text-[11px] text-[#8ca0ae]">{label}</span>
      <span className="wb-mono text-[11.5px] text-[#dce5ec]">{value}</span>
    </div>
  );
}

function UnitCard({
  unitId,
  result,
  spec,
  onSpecChange,
}: {
  unitId: string;
  result: PlantResult;
  spec: PlantSpec;
  onSpecChange: (patch: Partial<PlantSpec>) => void;
}) {
  const unit = result.units[unitId];
  if (!unit) return <div className="p-3 text-[11px] text-[#5c7080]">no data</div>;
  const fields = SPEC_FIELDS.filter((f) => f.unitIds?.includes(unitId));
  const bedIdx: Record<string, number> = { 'Bed 1 approach': 0, 'Bed 2 approach': 1, 'Bed 3 approach': 2 };

  return (
    <div>
      <div className="border-b border-[#1f2a34] px-3 py-2.5">
        <div className="text-[13px] font-semibold tracking-wide text-[#dce5ec]">{unit.name}</div>
        <div className="mt-0.5 text-[10.5px] leading-snug text-[#5c7080]">{unit.model}</div>
        {unit.warnings.length > 0 && (
          <div className="mt-1.5 border border-[#5c2b2b] bg-[#2a1414] px-2 py-1 text-[10.5px] text-[#f87171]">
            {unit.warnings.join(' · ')}
          </div>
        )}
      </div>

      <Section title="Performance">
        {unit.metrics.map((m) => (
          <MetricRow key={m.label} label={m.label} value={m.value} />
        ))}
      </Section>

      {fields.length > 0 && (
        <Section title="Specifications">
          {fields.map((f) =>
            f.key === 'bedApproach' ? (
              <BedApproachRows key="bedApproach" spec={spec} onSpecChange={onSpecChange} />
            ) : (
              <SpecRow
                key={f.key}
                field={f}
                value={(spec[f.key] as number) ?? 0}
                onChange={(v) =>
                  f.key === 'bedApproach'
                    ? onSpecChange({ bedApproach: [v, v, v] })
                    : onSpecChange({ [f.key]: v } as Partial<PlantSpec>)
                }
                disabled={f.key === 'airFlow' && spec.airAuto}
              />
            ),
          )}
          {unitId === 'R2' && (
            <div className="flex items-center justify-between border-b border-[#151d25] py-2">
              <span className="text-[11px] text-[#8ca0ae]">H2/N2 air controller</span>
              <Switch
                checked={spec.airAuto}
                onCheckedChange={(v) => onSpecChange({ airAuto: v })}
                className="data-[state=checked]:bg-[#f2a93b] data-[state=unchecked]:bg-[#26333f]"
              />
            </div>
          )}
        </Section>
      )}
      {fields.length === 0 && (
        <div className="px-3 py-2 text-[10.5px] text-[#5c7080]">
          No editable specifications — driven by upstream units.
        </div>
      )}
      <div className="h-6" />
    </div>
  );
}

function BedApproachRows({
  spec,
  onSpecChange,
}: {
  spec: PlantSpec;
  onSpecChange: (patch: Partial<PlantSpec>) => void;
}) {
  return (
    <>
      {spec.bedApproach.map((v, i) => (
        <SpecRow
          key={`bed${i}`}
          field={{
            key: 'bedApproach',
            label: `Bed ${i + 1} fractional approach`,
            unit: '—',
            min: 0.5,
            max: 0.99,
            step: 0.01,
            digits: 2,
            group: '',
          }}
          value={v}
          onChange={(nv) => {
            const next = [...spec.bedApproach] as [number, number, number];
            next[i] = nv;
            onSpecChange({ bedApproach: next });
          }}
        />
      ))}
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="wb-label border-b border-[#1f2a34] bg-[#10161c] px-3 py-1.5">{title}</div>
      <div className="px-3">{children}</div>
    </div>
  );
}

function SpecRow({
  field,
  value,
  onChange,
  disabled,
}: {
  field: SpecField;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  const scale = field.scale ?? 1;
  const digits = field.digits ?? 1;
  // text being edited + the value it belongs to; stale edits fall back to the
  // formatted value automatically (no state-setting effects needed)
  const [edit, setEdit] = useState<{ forValue: number; text: string } | null>(null);
  const display = edit && edit.forValue === value ? edit.text : (value * scale).toFixed(digits);

  const atMin = Math.abs(value - field.min) < 1e-9;
  const atMax = Math.abs(value - field.max) < 1e-9;

  const commit = (text: string) => {
    const v = parseFloat(text) / scale;
    if (Number.isFinite(v)) onChange(Math.min(field.max, Math.max(field.min, v)));
    setEdit(null);
  };

  return (
    <div className={`border-b border-[#151d25] py-2 ${disabled ? 'opacity-40' : ''}`}>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-[11px] text-[#8ca0ae]">{field.label}</span>
        <span className="wb-mono text-[10px] text-[#5c7080]">{field.unit}</span>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="range"
          className="wb-range"
          min={field.min}
          max={field.max}
          step={field.step}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          aria-label={field.label}
        />
        <input
          type="text"
          inputMode="decimal"
          className="wb-mono w-[68px] border border-[#26333f] bg-[#0d1319] px-1.5 py-0.5 text-right text-[11px] text-[#dce5ec] focus:border-[#f2a93b] focus:outline-none"
          value={display}
          disabled={disabled}
          onChange={(e) => setEdit({ forValue: value, text: e.target.value })}
          onBlur={() => {
            if (edit && edit.forValue === value) commit(edit.text);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
        />
      </div>
      {(atMin || atMax) && !disabled && (
        <div className="mt-0.5 text-[9.5px] text-[#b0742a]">
          {atMin ? 'at physical lower limit' : 'at physical upper limit'}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function PlantOverview({
  result,
  spec,
  onSpecChange,
}: {
  result: PlantResult;
  spec: PlantSpec;
  onSpecChange: (patch: Partial<PlantSpec>) => void;
}) {
  const k = result.kpis;
  const groups = [...new Set(SPEC_FIELDS.map((f) => f.group))];
  return (
    <div>
      <Section title="Plant performance">
        <MetricRow label="Production" value={`${k.productionTpd.toFixed(0)} t/d NH3`} />
        <MetricRow label="Product purity" value={`${(k.productPurityWt * 100).toFixed(2)} wt %`} />
        <MetricRow label="Per-pass conversion (N2)" value={`${(k.perPassConv * 100).toFixed(1)} %`} />
        <MetricRow label="Overall N2 conversion" value={`${(k.overallConv * 100).toFixed(1)} %`} />
        <MetricRow label="Loop inerts (CH4+Ar)" value={`${(k.loopInerts * 100).toFixed(1)} %`} />
        <MetricRow label="H2/N2 at converter" value={k.h2n2Ratio.toFixed(3)} />
        <MetricRow label="Recycle multiple" value={`${k.recycleMultiple.toFixed(2)} ×`} />
        <MetricRow label="Make-up syngas" value={`${k.makeupFlow.toFixed(0)} kmol/h`} />
        <MetricRow label="Process air" value={`${k.airFlow.toFixed(0)} kmol/h`} />
        <MetricRow label="Reformer duty" value={`${k.reformerDutyMW.toFixed(1)} MW`} />
        <MetricRow label="Refrigeration duty" value={`${k.refrigerationDutyMW.toFixed(1)} MW`} />
        <MetricRow label="Syngas compression" value={`${k.syngasComprPowerMW.toFixed(2)} MW`} />
        <MetricRow label="Circulator" value={`${k.circulatorPowerKW.toFixed(0)} kW`} />
        <MetricRow label="Specific energy (partial)" value={`${k.specificEnergyGJt.toFixed(1)} GJ/t`} />
        <MetricRow label="LTS CO slip" value={`${(k.coSlipLTS * 100).toFixed(2)} % dry`} />
        <MetricRow label="Oxides to loop" value={`${k.oxidesAfterMeth.toFixed(1)} ppmv`} />
      </Section>

      {result.warnings.length > 0 && (
        <Section title="Alarms">
          {result.warnings.map((w) => (
            <div key={w} className="mb-1 border border-[#5c2b2b] bg-[#2a1414] px-2 py-1 text-[10.5px] text-[#f87171]">
              {w}
            </div>
          ))}
        </Section>
      )}

      {groups.map((g) => (
        <Section key={g} title={g}>
          {SPEC_FIELDS.filter((f) => f.group === g).map((f) =>
            f.key === 'bedApproach' ? (
              <BedApproachRows key="bedApproach" spec={spec} onSpecChange={onSpecChange} />
            ) : (
              <SpecRow
                key={f.key}
                field={f}
                value={(spec[f.key] as number) ?? 0}
                onChange={(v) =>
                  onSpecChange({ [f.key]: v } as Partial<PlantSpec>)
                }
                disabled={f.key === 'airFlow' && spec.airAuto}
              />
            ),
          )}
        </Section>
      ))}
      <div className="h-6" />
    </div>
  );
}
