/**
 * ConfigurableSimulator — a user-editable evolution of the Space Architecture
 * Simulator. Facilitators/students can define their OWN inputs (sliders) and
 * OUTCOMES, and wire them together with linear weighted interactions that can
 * be positive or negative.
 *
 * Model: each outcome = clamp( base + Σ_j weight(outcome, slider_j) * 100 * x_j )
 * where x_j is slider_j normalised to 0..1. Weights in [-1, 1] express how
 * strongly (and in which direction) each slider drives each outcome.
 *
 * The whole configuration persists to localStorage and ships with a sensible
 * space-architecture example as the starting point.
 *
 * Part of the Orbital Architecture project. MIT License — see LICENSE.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { clamp } from '../utils/cognitiveModel';

const STORAGE_KEY = 'orbarch_model_config';
const PALETTE = ['#4fd1c5', '#63b3ed', '#f6ad55', '#9ae6b4', '#b794f4', '#fc8181', '#f6e05e', '#76e4f7'];

const uid = (prefix) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

// Sensible space-architecture starting point (labels localised at build time).
function buildDefaultConfig(t) {
  return {
    sliders: [
      { id: 'noise', label: t('simulator.sliders.noise', 'Noise'), value: 40, min: 0, max: 100 },
      { id: 'biophilia', label: t('simulator.sliders.biophilia', 'Biophilia'), value: 55, min: 0, max: 100 },
      { id: 'clutter', label: t('simulator.sliders.clutter', 'Clutter'), value: 35, min: 0, max: 100 },
      { id: 'lighting', label: t('simulator.sliders.lighting', 'Lighting'), value: 60, min: 0, max: 100 }
    ],
    outcomes: [
      { id: 'attention', label: t('simulator.metrics.attention', 'Attention'), base: 55, color: '#4fd1c5', weights: { noise: -0.35, biophilia: 0.20, clutter: -0.25, lighting: 0.30 } },
      { id: 'memory', label: t('simulator.metrics.memory', 'Working Memory'), base: 55, color: '#63b3ed', weights: { noise: -0.30, biophilia: 0.25, clutter: -0.30, lighting: 0.20 } },
      { id: 'stress', label: t('simulator.metrics.stress', 'Stress'), base: 30, color: '#f6ad55', weights: { noise: 0.40, biophilia: -0.20, clutter: 0.30, lighting: -0.15 } }
    ]
  };
}

function computeOutcomeValue(outcome, sliders) {
  let v = outcome.base;
  sliders.forEach((s) => {
    const w = outcome.weights[s.id] || 0;
    const span = (s.max - s.min) || 1;
    const x = (s.value - s.min) / span; // 0..1
    v += w * 100 * x;
  });
  return Math.round(clamp(v));
}

function ConfigurableSimulator() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [config, setConfig] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch (e) { /* ignore */ }
    return null; // resolved in effect (needs t)
  });

  // Seed the default example on first run (when nothing stored).
  useEffect(() => {
    if (!config) setConfig(buildDefaultConfig(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist on every change.
  useEffect(() => {
    if (config) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(config)); } catch (e) { /* ignore */ }
    }
  }, [config]);

  const [editingOutcomeId, setEditingOutcomeId] = useState(null);
  const [showAddSlider, setShowAddSlider] = useState(false);
  const [showAddOutcome, setShowAddOutcome] = useState(false);

  // ---- mutators ----
  const setSliderValue = useCallback((id, value) => {
    setConfig((c) => ({ ...c, sliders: c.sliders.map((s) => (s.id === id ? { ...s, value: Number(value) } : s)) }));
  }, []);

  const updateSlider = useCallback((id, patch) => {
    setConfig((c) => ({ ...c, sliders: c.sliders.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));
  }, []);

  const removeSlider = useCallback((id) => {
    setConfig((c) => ({
      ...c,
      sliders: c.sliders.filter((s) => s.id !== id),
      outcomes: c.outcomes.map((o) => {
        const { [id]: _removed, ...rest } = o.weights;
        return { ...o, weights: rest };
      })
    }));
  }, []);

  const addSlider = useCallback((slider) => {
    setConfig((c) => ({ ...c, sliders: [...c.sliders, slider] }));
  }, []);

  const updateOutcome = useCallback((id, patch) => {
    setConfig((c) => ({ ...c, outcomes: c.outcomes.map((o) => (o.id === id ? { ...o, ...patch } : o)) }));
  }, []);

  const setWeight = useCallback((outcomeId, sliderId, w) => {
    setConfig((c) => ({
      ...c,
      outcomes: c.outcomes.map((o) => (o.id === outcomeId ? { ...o, weights: { ...o.weights, [sliderId]: Number(w) } } : o))
    }));
  }, []);

  const removeOutcome = useCallback((id) => {
    setConfig((c) => ({ ...c, outcomes: c.outcomes.filter((o) => o.id !== id) }));
  }, []);

  const addOutcome = useCallback((outcome) => {
    setConfig((c) => ({ ...c, outcomes: [...c.outcomes, outcome] }));
  }, []);

  const resetToExample = useCallback(() => {
    if (window.confirm(t('modelLab.confirmReset', 'Reset to the example model? Your changes will be lost.'))) {
      setConfig(buildDefaultConfig(t));
    }
  }, [t]);

  const computed = useMemo(() => {
    if (!config) return [];
    return config.outcomes.map((o) => ({ ...o, value: computeOutcomeValue(o, config.sliders) }));
  }, [config]);

  if (!config) return null;

  return (
    <div style={{ minHeight: '100vh', width: '100%', boxSizing: 'border-box', padding: '24px', background: 'radial-gradient(1200px 600px at 50% -10%, #16243d 0%, #0b0e14 60%)', color: '#e6edf3', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ maxWidth: '980px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '24px', margin: '0 0 6px 0', textAlign: 'center' }}>
          {t('modelLab.title', 'Model Lab \u2014 Build Your Own Simulator')}
        </h1>
        <p style={{ fontSize: '14px', opacity: 0.8, margin: '0 0 22px 0', textAlign: 'center' }}>
          {t('modelLab.subtitle', 'Define inputs and outcomes, then wire them with positive/negative linear interactions.')}
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', alignItems: 'start' }}>
          {/* INPUTS */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h2 style={{ fontSize: '16px', margin: 0 }}>{t('modelLab.inputs', 'Inputs (sliders)')}</h2>
              <button onClick={() => setShowAddSlider(true)} style={btnSmallPrimary}>+ {t('modelLab.addSlider', 'Add slider')}</button>
            </div>
            {config.sliders.map((s) => (
              <div key={s.id} style={card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <input value={s.label} onChange={(e) => updateSlider(s.id, { label: e.target.value })} style={inlineLabelInput} />
                  <span style={{ fontSize: '13px', opacity: 0.85, fontVariantNumeric: 'tabular-nums' }}>{s.value}</span>
                </div>
                <input type="range" min={s.min} max={s.max} value={s.value} onChange={(e) => setSliderValue(s.id, e.target.value)} style={{ width: '100%', accentColor: '#4fd1c5', cursor: 'pointer' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', opacity: 0.7 }}>
                  <label>min <input type="number" value={s.min} onChange={(e) => updateSlider(s.id, { min: Number(e.target.value) })} style={miniNum} /></label>
                  <label>max <input type="number" value={s.max} onChange={(e) => updateSlider(s.id, { max: Number(e.target.value) })} style={miniNum} /></label>
                  <button onClick={() => removeSlider(s.id)} style={btnDangerLink}>{t('modelLab.remove', 'remove')}</button>
                </div>
              </div>
            ))}
          </div>

          {/* OUTCOMES + chart */}
          <div>
            <svg viewBox="0 0 400 230" width="100%" role="img" style={{ display: 'block', marginBottom: '8px' }}>
              {[0, 25, 50, 75, 100].map((g) => {
                const y = 188 - (g / 100) * 160;
                return (<g key={g}><line x1="0" y1={y} x2="400" y2={y} stroke="rgba(255,255,255,0.08)" /><text x="2" y={y - 2} fontSize="9" fill="rgba(255,255,255,0.4)">{g}</text></g>);
              })}
              {computed.map((o, i) => {
                const slotW = 400 / Math.max(computed.length, 1);
                const barW = Math.min(slotW * 0.5, 50);
                const h = (o.value / 100) * 160;
                const x = i * slotW + (slotW - barW) / 2;
                const y = 188 - h;
                return (
                  <g key={o.id}>
                    <rect x={x} y={y} width={barW} height={h} rx="4" fill={o.color} />
                    <text x={x + barW / 2} y={y - 5} fontSize="12" fontWeight="bold" textAnchor="middle" fill="#e6edf3">{o.value}</text>
                    <text x={x + barW / 2} y={204} fontSize="9" textAnchor="middle" fill="rgba(255,255,255,0.75)">{o.label}</text>
                  </g>
                );
              })}
            </svg>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '10px 0' }}>
              <h2 style={{ fontSize: '16px', margin: 0 }}>{t('modelLab.outcomes', 'Outcomes')}</h2>
              <button onClick={() => setShowAddOutcome(true)} style={btnSmallPrimary}>+ {t('modelLab.addOutcome', 'Add outcome')}</button>
            </div>

            {config.outcomes.map((o) => (
              <div key={o.id} style={card}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: 12, height: 12, borderRadius: '50%', background: o.color, flexShrink: 0 }} />
                  <input value={o.label} onChange={(e) => updateOutcome(o.id, { label: e.target.value })} style={inlineLabelInput} />
                  <button onClick={() => setEditingOutcomeId(editingOutcomeId === o.id ? null : o.id)} style={btnDangerLink}>
                    {editingOutcomeId === o.id ? t('modelLab.done', 'done') : t('modelLab.editWeights', 'weights')}
                  </button>
                  <button onClick={() => removeOutcome(o.id)} style={btnDangerLink}>{t('modelLab.remove', 'remove')}</button>
                </div>

                {editingOutcomeId === o.id && (
                  <div style={{ marginTop: '10px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', marginBottom: '8px' }}>
                      <label>{t('modelLab.base', 'Base')} <input type="number" value={o.base} onChange={(e) => updateOutcome(o.id, { base: Number(e.target.value) })} style={miniNum} /></label>
                      <label>{t('modelLab.color', 'Color')} <input type="color" value={o.color} onChange={(e) => updateOutcome(o.id, { color: e.target.value })} style={{ verticalAlign: 'middle', width: 28, height: 22, border: 'none', background: 'none' }} /></label>
                    </div>
                    {config.sliders.map((s) => {
                      const w = o.weights[s.id] || 0;
                      return (
                        <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <span style={{ width: '38%', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.label}</span>
                          <input type="range" min="-1" max="1" step="0.05" value={w} onChange={(e) => setWeight(o.id, s.id, e.target.value)} style={{ flex: 1, accentColor: w >= 0 ? '#9ae6b4' : '#fc8181' }} />
                          <span style={{ width: 38, textAlign: 'right', fontSize: '12px', color: w > 0 ? '#9ae6b4' : w < 0 ? '#fc8181' : 'rgba(255,255,255,0.6)', fontVariantNumeric: 'tabular-nums' }}>
                            {w > 0 ? '+' : ''}{w.toFixed(2)}
                          </span>
                        </div>
                      );
                    })}
                    <p style={{ fontSize: '10px', opacity: 0.5, margin: '6px 0 0 0' }}>
                      {t('modelLab.weightHint', 'Green = positive interaction, red = negative. Effect is linear with each slider.')}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <p style={{ fontSize: '11px', opacity: 0.5, marginTop: '16px', textAlign: 'center' }}>
          {t('modelLab.note', 'Your model is saved on this device. Illustrative educational tool.')}
        </p>

        <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button onClick={() => navigate('/')} style={{ padding: '8px 16px', background: '#1f6feb', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
            {t('common.back', 'Back')}
          </button>
          <button onClick={resetToExample} style={{ padding: '8px 16px', background: 'transparent', color: '#e6edf3', border: '1px solid rgba(255,255,255,0.25)', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
            {t('modelLab.resetExample', 'Reset to example')}
          </button>
        </div>
      </div>

      {showAddSlider && (
        <AddSliderModal
          onCancel={() => setShowAddSlider(false)}
          onAdd={(slider) => { addSlider(slider); setShowAddSlider(false); }}
        />
      )}
      {showAddOutcome && (
        <AddOutcomeModal
          sliders={config.sliders}
          colorSeed={config.outcomes.length}
          onCancel={() => setShowAddOutcome(false)}
          onAdd={(outcome) => { addOutcome(outcome); setShowAddOutcome(false); }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modals
// ---------------------------------------------------------------------------
function ModalShell({ title, children }) {
  return (
    <div style={modalBackdrop}>
      <div style={modalBox}>
        <h2 style={{ marginTop: 0, fontSize: '18px' }}>{title}</h2>
        {children}
      </div>
    </div>
  );
}

function AddSliderModal({ onAdd, onCancel }) {
  const { t } = useTranslation();
  const [label, setLabel] = useState('');
  const [min, setMin] = useState(0);
  const [max, setMax] = useState(100);
  const [value, setValue] = useState(50);

  const submit = () => {
    const name = label.trim() || t('modelLab.newInput', 'New input');
    onAdd({ id: uid('s'), label: name, min: Number(min), max: Number(max), value: Number(value) });
  };

  return (
    <ModalShell title={t('modelLab.addSlider', 'Add slider')}>
      <Field label={t('modelLab.name', 'Name')}>
        <input autoFocus value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t('modelLab.namePlaceholder', 'e.g. Crew size')} style={modalInput} />
      </Field>
      <div style={{ display: 'flex', gap: '10px' }}>
        <Field label={t('modelLab.min', 'Min')}><input type="number" value={min} onChange={(e) => setMin(e.target.value)} style={modalInput} /></Field>
        <Field label={t('modelLab.max', 'Max')}><input type="number" value={max} onChange={(e) => setMax(e.target.value)} style={modalInput} /></Field>
        <Field label={t('modelLab.initial', 'Start')}><input type="number" value={value} onChange={(e) => setValue(e.target.value)} style={modalInput} /></Field>
      </div>
      <ModalActions onCancel={onCancel} onConfirm={submit} confirmLabel={t('modelLab.add', 'Add')} />
    </ModalShell>
  );
}

function AddOutcomeModal({ sliders, colorSeed, onAdd, onCancel }) {
  const { t } = useTranslation();
  const [label, setLabel] = useState('');
  const [base, setBase] = useState(50);
  const [color, setColor] = useState(PALETTE[colorSeed % PALETTE.length]);
  const [weights, setWeights] = useState(() => sliders.reduce((acc, s) => ({ ...acc, [s.id]: 0 }), {}));

  const submit = () => {
    const name = label.trim() || t('modelLab.newOutcome', 'New outcome');
    onAdd({ id: uid('o'), label: name, base: Number(base), color, weights });
  };

  return (
    <ModalShell title={t('modelLab.addOutcome', 'Add outcome')}>
      <Field label={t('modelLab.name', 'Name')}>
        <input autoFocus value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t('modelLab.outcomePlaceholder', 'e.g. Fatigue')} style={modalInput} />
      </Field>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
        <Field label={t('modelLab.base', 'Base')}><input type="number" value={base} onChange={(e) => setBase(e.target.value)} style={modalInput} /></Field>
        <Field label={t('modelLab.color', 'Color')}><input type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ width: 44, height: 34, border: 'none', background: 'none' }} /></Field>
      </div>
      <div style={{ marginTop: '8px' }}>
        <div style={{ fontSize: '12px', opacity: 0.75, marginBottom: '6px' }}>{t('modelLab.interactions', 'Interactions with inputs')}</div>
        {sliders.length === 0 && <div style={{ fontSize: '12px', opacity: 0.5 }}>{t('modelLab.noInputs', 'Add some inputs first.')}</div>}
        {sliders.map((s) => {
          const w = weights[s.id] || 0;
          return (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ width: '36%', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.label}</span>
              <input type="range" min="-1" max="1" step="0.05" value={w} onChange={(e) => setWeights((prev) => ({ ...prev, [s.id]: Number(e.target.value) }))} style={{ flex: 1, accentColor: w >= 0 ? '#9ae6b4' : '#fc8181' }} />
              <span style={{ width: 38, textAlign: 'right', fontSize: '12px', color: w > 0 ? '#9ae6b4' : w < 0 ? '#fc8181' : 'rgba(255,255,255,0.6)' }}>{w > 0 ? '+' : ''}{w.toFixed(2)}</span>
            </div>
          );
        })}
      </div>
      <ModalActions onCancel={onCancel} onConfirm={submit} confirmLabel={t('modelLab.add', 'Add')} />
    </ModalShell>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'block', marginBottom: '10px', flex: 1 }}>
      <span style={{ display: 'block', fontSize: '12px', opacity: 0.75, marginBottom: '4px' }}>{label}</span>
      {children}
    </label>
  );
}

function ModalActions({ onCancel, onConfirm, confirmLabel }) {
  const { t } = useTranslation();
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
      <button onClick={onCancel} style={{ padding: '8px 16px', background: 'transparent', color: '#e6edf3', border: '1px solid rgba(255,255,255,0.25)', borderRadius: '6px', cursor: 'pointer' }}>{t('common.cancel', 'Cancel')}</button>
      <button onClick={onConfirm} style={{ padding: '8px 16px', background: '#2f855a', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>{confirmLabel}</button>
    </div>
  );
}

// ---- shared inline styles ----
const card = { background: 'rgba(10,14,22,0.6)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '12px', marginBottom: '10px' };
const inlineLabelInput = { background: 'transparent', border: 'none', borderBottom: '1px dashed rgba(255,255,255,0.2)', color: '#e6edf3', fontSize: '14px', fontWeight: 'bold', flex: 1, minWidth: 0, padding: '2px 0' };
const miniNum = { width: 52, marginLeft: 4, padding: '2px 4px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.3)', color: '#fff' };
const btnSmallPrimary = { padding: '6px 10px', background: '#6f42c1', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' };
const btnDangerLink = { background: 'none', border: 'none', color: 'rgba(255,255,255,0.55)', cursor: 'pointer', fontSize: '11px', textDecoration: 'underline' };
const modalBackdrop = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000, padding: '16px' };
const modalBox = { background: '#1a2233', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '12px', padding: '20px', width: '100%', maxWidth: '440px', color: '#e6edf3', boxShadow: '0 10px 40px rgba(0,0,0,0.5)' };
const modalInput = { width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.3)', color: '#fff', boxSizing: 'border-box' };

export default ConfigurableSimulator;
