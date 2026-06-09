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
      // `links` describe how OTHER inputs push this input up/down (slider-to-slider
      // coupling). Example: biophilia adds some clutter and a little noise.
      { id: 'noise', label: t('simulator.sliders.noise', 'Noise'), value: 40, min: 0, max: 100, links: { biophilia: 0.15 } },
      { id: 'biophilia', label: t('simulator.sliders.biophilia', 'Biophilia'), value: 55, min: 0, max: 100, links: {} },
      { id: 'clutter', label: t('simulator.sliders.clutter', 'Clutter'), value: 35, min: 0, max: 100, links: { biophilia: 0.25 } },
      { id: 'lighting', label: t('simulator.sliders.lighting', 'Lighting'), value: 60, min: 0, max: 100, links: {} }
    ],
    outcomes: [
      { id: 'attention', label: t('simulator.metrics.attention', 'Attention'), base: 55, color: '#4fd1c5', weights: { noise: -0.35, biophilia: 0.20, clutter: -0.25, lighting: 0.30 } },
      { id: 'memory', label: t('simulator.metrics.memory', 'Working Memory'), base: 55, color: '#63b3ed', weights: { noise: -0.30, biophilia: 0.25, clutter: -0.30, lighting: 0.20 } },
      { id: 'stress', label: t('simulator.metrics.stress', 'Stress'), base: 30, color: '#f6ad55', weights: { noise: 0.40, biophilia: -0.20, clutter: 0.30, lighting: -0.15 } }
    ]
  };
}

// Resolve each slider's EFFECTIVE value by applying slider-to-slider coupling.
// One pass over the user-set (base) values, so there are no feedback loops.
function effectiveValues(sliders) {
  const baseNorm = {};
  sliders.forEach((s) => {
    const span = (s.max - s.min) || 1;
    baseNorm[s.id] = (s.value - s.min) / span; // 0..1
  });
  const eff = {};
  sliders.forEach((s) => {
    let v = s.value;
    const links = s.links || {};
    Object.entries(links).forEach(([srcId, w]) => {
      if (srcId === s.id) return;
      const xn = baseNorm[srcId];
      if (xn === undefined) return;
      v += w * 100 * xn;
    });
    eff[s.id] = Math.round(clamp(v, s.min, s.max));
  });
  return eff;
}

function computeOutcomeValue(outcome, sliders, eff) {
  let v = outcome.base;
  sliders.forEach((s) => {
    const w = outcome.weights[s.id] || 0;
    const span = (s.max - s.min) || 1;
    const x = (eff[s.id] - s.min) / span; // 0..1, from the effective value
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
  const [editingSliderId, setEditingSliderId] = useState(null);
  const [showGraph, setShowGraph] = useState(true);
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
      sliders: c.sliders.filter((s) => s.id !== id).map((s) => {
        if (!s.links || !(id in s.links)) return s;
        const { [id]: _r, ...rest } = s.links;
        return { ...s, links: rest };
      }),
      outcomes: c.outcomes.map((o) => {
        const { [id]: _removed, ...rest } = o.weights;
        return { ...o, weights: rest };
      })
    }));
  }, []);

  const setLink = useCallback((targetId, sourceId, w) => {
    setConfig((c) => ({
      ...c,
      sliders: c.sliders.map((s) => (s.id === targetId ? { ...s, links: { ...(s.links || {}), [sourceId]: Number(w) } } : s))
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

  const eff = useMemo(() => (config ? effectiveValues(config.sliders) : {}), [config]);

  const computed = useMemo(() => {
    if (!config) return [];
    return config.outcomes.map((o) => ({ ...o, value: computeOutcomeValue(o, config.sliders, eff) }));
  }, [config, eff]);

  if (!config) return null;

  return (
    <div style={{ minHeight: '100vh', width: '100%', boxSizing: 'border-box', padding: '24px', background: 'radial-gradient(1200px 600px at 50% -10%, #16243d 0%, #0b0e14 60%)', color: '#e6edf3', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ maxWidth: '980px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '24px', margin: '0 0 6px 0', textAlign: 'center' }}>
          {t('modelLab.title', 'Model Lab \u2014 Build Your Own Simulator')}
        </h1>
        <p style={{ fontSize: '14px', opacity: 0.8, margin: '0 0 18px 0', textAlign: 'center' }}>
          {t('modelLab.subtitle', 'Define inputs and outcomes, then wire them with positive/negative linear interactions.')}
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: showGraph ? '14px' : '4px' }}>
          <button
            onClick={() => setShowGraph((v) => !v)}
            style={{
              padding: '8px 18px',
              background: showGraph ? 'rgba(255,255,255,0.08)' : '#6f42c1',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.18)',
              borderRadius: '20px',
              cursor: 'pointer',
              fontSize: '13px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <span style={{ fontSize: '15px' }}>🪢</span>
            {showGraph ? t('modelLab.hideMap', 'Hide interaction map') : t('modelLab.showMap', 'Show interaction map')}
          </button>
        </div>

        {showGraph && (
          <InteractionGraph
            sliders={config.sliders}
            outcomes={computed}
            eff={eff}
            onSetWeight={setWeight}
            onSetLink={setLink}
          />
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', alignItems: 'start', marginTop: '20px' }}>
          {/* INPUTS */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h2 style={{ fontSize: '16px', margin: 0 }}>{t('modelLab.inputs', 'Inputs (sliders)')}</h2>
              <button onClick={() => setShowAddSlider(true)} style={btnSmallPrimary}>+ {t('modelLab.addSlider', 'Add slider')}</button>
            </div>
            {config.sliders.map((s) => {
              const effVal = eff[s.id];
              const coupled = effVal !== undefined && effVal !== s.value;
              const otherSliders = config.sliders.filter((o) => o.id !== s.id);
              return (
                <div key={s.id} style={card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <input value={s.label} onChange={(e) => updateSlider(s.id, { label: e.target.value })} style={inlineLabelInput} />
                    <span style={{ fontSize: '13px', opacity: 0.85, fontVariantNumeric: 'tabular-nums' }}>
                      {s.value}
                      {coupled && <span style={{ color: '#b794f4' }}> → {effVal}</span>}
                    </span>
                  </div>
                  <input type="range" min={s.min} max={s.max} value={s.value} onChange={(e) => setSliderValue(s.id, e.target.value)} style={{ width: '100%', accentColor: '#4fd1c5', cursor: 'pointer' }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', opacity: 0.7 }}>
                    <label>min <input type="number" value={s.min} onChange={(e) => updateSlider(s.id, { min: Number(e.target.value) })} style={miniNum} /></label>
                    <label>max <input type="number" value={s.max} onChange={(e) => updateSlider(s.id, { max: Number(e.target.value) })} style={miniNum} /></label>
                    <button onClick={() => setEditingSliderId(editingSliderId === s.id ? null : s.id)} style={btnDangerLink}>
                      {editingSliderId === s.id ? t('modelLab.done', 'done') : t('modelLab.links', 'interactions')}
                    </button>
                    <button onClick={() => removeSlider(s.id)} style={btnDangerLink}>{t('modelLab.remove', 'remove')}</button>
                  </div>

                  {editingSliderId === s.id && (
                    <div style={{ marginTop: '10px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '10px' }}>
                      {otherSliders.length === 0 && <div style={{ fontSize: '11px', opacity: 0.5 }}>{t('modelLab.noInputs', 'Add some inputs first.')}</div>}
                      {otherSliders.map((src) => {
                        const w = (s.links && s.links[src.id]) || 0;
                        return (
                          <div key={src.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <span style={{ width: '38%', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{src.label}</span>
                            <input type="range" min="-1" max="1" step="0.05" value={w} onChange={(e) => setLink(s.id, src.id, e.target.value)} style={{ flex: 1, accentColor: w >= 0 ? '#9ae6b4' : '#fc8181' }} />
                            <span style={{ width: 38, textAlign: 'right', fontSize: '12px', color: w > 0 ? '#9ae6b4' : w < 0 ? '#fc8181' : 'rgba(255,255,255,0.6)', fontVariantNumeric: 'tabular-nums' }}>
                              {w > 0 ? '+' : ''}{w.toFixed(2)}
                            </span>
                          </div>
                        );
                      })}
                      <p style={{ fontSize: '10px', opacity: 0.5, margin: '6px 0 0 0' }}>
                        {t('modelLab.linksHint', 'How other inputs push this input up or down (linear).')}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
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
// Interaction graph: nodes (inputs left, outcomes right) joined by editable
// wires. Slider->outcome wires AND slider->slider coupling wires. Click a node
// then another to connect them; click a wire to adjust its weight.
// ---------------------------------------------------------------------------
function InteractionGraph({ sliders, outcomes, eff, onSetWeight, onSetLink }) {
  const { t } = useTranslation();
  const [connectSource, setConnectSource] = useState(null);
  const [selected, setSelected] = useState(null);
  const [hover, setHover] = useState(null);

  const W = 480;
  const nodeW = 132;
  const nodeH = 38;
  const rowH = 58;
  const topPad = 48;
  const rows = Math.max(sliders.length, outcomes.length, 1);
  const H = topPad + rows * rowH + 14;
  const inputX = 92;
  const outcomeX = W - 92;
  const yAt = (i) => topPad + rowH / 2 + i * rowH;

  const inputY = {};
  sliders.forEach((s, i) => { inputY[s.id] = yAt(i); });
  const outcomeY = {};
  outcomes.forEach((o, i) => { outcomeY[o.id] = yAt(i); });

  const wireColor = (w) => (w > 0 ? '#6ee7b7' : '#fca5a5');
  const wireWidth = (w) => 1.5 + Math.min(Math.abs(w), 1) * 4.5;
  const cubicMid = (p0, p1, p2, p3) => 0.125 * p0 + 0.375 * p1 + 0.375 * p2 + 0.125 * p3;

  const handleNodeClick = (kind, id) => {
    if (!connectSource) { setConnectSource({ kind, id }); setSelected(null); return; }
    if (connectSource.kind === kind && connectSource.id === id) { setConnectSource(null); return; }
    const a = connectSource;
    const b = { kind, id };
    setConnectSource(null);
    if (a.kind === 'slider' && b.kind === 'outcome') {
      const cur = (outcomes.find((o) => o.id === b.id)?.weights || {})[a.id] || 0;
      onSetWeight(b.id, a.id, cur || 0.3);
      setSelected({ type: 'weight', sliderId: a.id, outcomeId: b.id });
    } else if (a.kind === 'outcome' && b.kind === 'slider') {
      const cur = (outcomes.find((o) => o.id === a.id)?.weights || {})[b.id] || 0;
      onSetWeight(a.id, b.id, cur || 0.3);
      setSelected({ type: 'weight', sliderId: b.id, outcomeId: a.id });
    } else if (a.kind === 'slider' && b.kind === 'slider') {
      const cur = (sliders.find((s) => s.id === b.id)?.links || {})[a.id] || 0;
      onSetLink(b.id, a.id, cur || 0.3);
      setSelected({ type: 'link', sourceId: a.id, targetId: b.id });
    }
  };

  const selectedValue = (() => {
    if (!selected) return 0;
    if (selected.type === 'weight') return (outcomes.find((o) => o.id === selected.outcomeId)?.weights || {})[selected.sliderId] || 0;
    return (sliders.find((s) => s.id === selected.targetId)?.links || {})[selected.sourceId] || 0;
  })();

  const applySelected = (w) => {
    if (selected.type === 'weight') onSetWeight(selected.outcomeId, selected.sliderId, w);
    else onSetLink(selected.targetId, selected.sourceId, w);
  };

  const labelOf = (kind, id) => (kind === 'slider'
    ? (sliders.find((s) => s.id === id)?.label || id)
    : (outcomes.find((o) => o.id === id)?.label || id));

  const isSel = (node) => connectSource && connectSource.kind === node.kind && connectSource.id === node.id;

  const truncate = (str, n) => (str && str.length > n ? `${str.slice(0, n - 1)}…` : str);

  // Build the set of nodes/wires related to the current selection so we can
  // highlight everything that affects (or is affected by) it and dim the rest.
  const highlight = useMemo(() => {
    const nodes = new Set();
    const wires = new Set();
    const addCouplingsInto = (sid) => {
      const s = sliders.find((x) => x.id === sid);
      if (!s || !s.links) return;
      Object.entries(s.links).forEach(([p, w]) => {
        if (w) { nodes.add(`slider:${p}`); wires.add(`l-${sid}-${p}`); }
      });
    };

    if (connectSource) {
      const { kind, id } = connectSource;
      nodes.add(`${kind}:${id}`);
      if (kind === 'outcome') {
        const o = outcomes.find((x) => x.id === id);
        sliders.forEach((s) => {
          const w = (o?.weights || {})[s.id] || 0;
          if (w) { nodes.add(`slider:${s.id}`); wires.add(`w-${id}-${s.id}`); addCouplingsInto(s.id); }
        });
      } else {
        addCouplingsInto(id); // inputs that push this input
        sliders.forEach((target) => { // inputs this one pushes
          const w = (target.links || {})[id] || 0;
          if (w) { nodes.add(`slider:${target.id}`); wires.add(`l-${target.id}-${id}`); }
        });
        outcomes.forEach((o) => { // outcomes this input drives
          const w = (o.weights || {})[id] || 0;
          if (w) { nodes.add(`outcome:${o.id}`); wires.add(`w-${o.id}-${id}`); }
        });
      }
    } else if (selected) {
      if (selected.type === 'weight') {
        nodes.add(`outcome:${selected.outcomeId}`);
        nodes.add(`slider:${selected.sliderId}`);
        wires.add(`w-${selected.outcomeId}-${selected.sliderId}`);
        addCouplingsInto(selected.sliderId);
      } else {
        nodes.add(`slider:${selected.targetId}`);
        nodes.add(`slider:${selected.sourceId}`);
        wires.add(`l-${selected.targetId}-${selected.sourceId}`);
      }
    }
    return { nodes, wires, active: nodes.size > 0 || wires.size > 0 };
  }, [connectSource, selected, sliders, outcomes]);

  const wireOpacity = (key, base) => (highlight.active ? (highlight.wires.has(key) ? 1 : 0.07) : base);
  const nodeOpacity = (key) => (highlight.active && !highlight.nodes.has(key) ? 0.22 : 1);
  const nodeHi = (key) => highlight.active && highlight.nodes.has(key);

  return (
    <div style={{ ...card, padding: '16px', background: 'linear-gradient(180deg, rgba(18,26,40,0.9), rgba(10,14,22,0.9))' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', flexWrap: 'wrap', gap: '6px' }}>
        <h2 style={{ fontSize: '16px', margin: 0 }}>{t('modelLab.graphTitle', 'Interaction map')}</h2>
        <span style={{ fontSize: '11px', opacity: 0.65, color: connectSource ? '#4fd1c5' : 'inherit' }}>
          {connectSource ? t('modelLab.connectHint', 'Now click a target node…') : t('modelLab.graphHint', 'Click a node, then another, to connect. Click a wire to adjust.')}
        </span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
        <defs>
          <marker id="arrowG" markerWidth="9" markerHeight="9" refX="6.5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#6ee7b7" /></marker>
          <marker id="arrowR" markerWidth="9" markerHeight="9" refX="6.5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#fca5a5" /></marker>
          <linearGradient id="gIn" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#27384f" /><stop offset="100%" stopColor="#16202f" /></linearGradient>
          <linearGradient id="gOut" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#1f2c41" /><stop offset="100%" stopColor="#131c29" /></linearGradient>
          <filter id="nodeShadow" x="-30%" y="-40%" width="160%" height="180%"><feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor="rgba(0,0,0,0.55)" /></filter>
          <filter id="wireGlow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>

        {/* column headers */}
        <text x={inputX} y={20} fontSize="10.5" fontWeight="bold" letterSpacing="1" textAnchor="middle" fill="rgba(255,255,255,0.5)">
          {t('modelLab.inputsShort', 'INPUTS').toUpperCase()}
        </text>
        <text x={outcomeX} y={20} fontSize="10.5" fontWeight="bold" letterSpacing="1" textAnchor="middle" fill="rgba(255,255,255,0.5)">
          {t('modelLab.outcomes', 'Outcomes').toUpperCase()}
        </text>

        {/* slider -> outcome wires */}
        {outcomes.map((o) => sliders.map((s) => {
          const w = (o.weights || {})[s.id] || 0;
          if (!w) return null;
          const key = `w-${o.id}-${s.id}`;
          const x1 = inputX + nodeW / 2;
          const y1 = inputY[s.id];
          const x2 = outcomeX - nodeW / 2;
          const y2 = outcomeY[o.id];
          const c1x = x1 + 60;
          const c2x = x2 - 60;
          const d = `M ${x1} ${y1} C ${c1x} ${y1}, ${c2x} ${y2}, ${x2} ${y2}`;
          const active = (selected && selected.type === 'weight' && selected.sliderId === s.id && selected.outcomeId === o.id) || hover === key;
          const mx = cubicMid(x1, c1x, c2x, x2);
          const my = cubicMid(y1, y1, y2, y2);
          const op = wireOpacity(key, active ? 1 : 0.6);
          return (
            <g key={key} style={{ cursor: 'pointer' }} onClick={() => { setSelected({ type: 'weight', sliderId: s.id, outcomeId: o.id }); setConnectSource(null); }}
              onMouseEnter={() => setHover(key)} onMouseLeave={() => setHover((h) => (h === key ? null : h))}>
              <path d={d} fill="none" stroke="transparent" strokeWidth="16" />
              <path d={d} fill="none" stroke={wireColor(w)} strokeWidth={wireWidth(w)} opacity={op} markerEnd={`url(#${w > 0 ? 'arrowG' : 'arrowR'})`} filter={active ? 'url(#wireGlow)' : undefined} />
              {active && <WireBadge x={mx} y={my} w={w} />}
            </g>
          );
        }))}

        {/* slider -> slider coupling wires (dashed, bow to the left) */}
        {sliders.map((target) => Object.entries(target.links || {}).map(([srcId, w]) => {
          if (!w || inputY[srcId] === undefined) return null;
          const key = `l-${target.id}-${srcId}`;
          const x = inputX - nodeW / 2;
          const y1 = inputY[srcId];
          const y2 = inputY[target.id];
          const bow = 50 + Math.abs(y2 - y1) * 0.18;
          const cx = x - bow;
          const d = `M ${x} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x} ${y2}`;
          const active = (selected && selected.type === 'link' && selected.sourceId === srcId && selected.targetId === target.id) || hover === key;
          const mx = cubicMid(x, cx, cx, x);
          const my = cubicMid(y1, y1, y2, y2);
          const op = wireOpacity(key, active ? 1 : 0.6);
          return (
            <g key={key} style={{ cursor: 'pointer' }} onClick={() => { setSelected({ type: 'link', sourceId: srcId, targetId: target.id }); setConnectSource(null); }}
              onMouseEnter={() => setHover(key)} onMouseLeave={() => setHover((h) => (h === key ? null : h))}>
              <path d={d} fill="none" stroke="transparent" strokeWidth="16" />
              <path d={d} fill="none" stroke={wireColor(w)} strokeWidth={wireWidth(w)} strokeDasharray="5 4" opacity={op} markerEnd={`url(#${w > 0 ? 'arrowG' : 'arrowR'})`} filter={active ? 'url(#wireGlow)' : undefined} />
              {active && <WireBadge x={mx} y={my} w={w} />}
            </g>
          );
        }))}

        {/* input nodes */}
        {sliders.map((s) => {
          const y = inputY[s.id];
          const effVal = eff[s.id];
          const coupled = effVal !== undefined && effVal !== s.value;
          const sel = isSel({ kind: 'slider', id: s.id });
          const nKey = `slider:${s.id}`;
          const hi = nodeHi(nKey);
          return (
            <g key={`n-${s.id}`} style={{ cursor: 'pointer' }} opacity={nodeOpacity(nKey)} onClick={() => handleNodeClick('slider', s.id)}>
              <rect x={inputX - nodeW / 2} y={y - nodeH / 2} width={nodeW} height={nodeH} rx="10"
                fill="url(#gIn)" stroke={sel ? '#4fd1c5' : hi ? '#cbd5e1' : 'rgba(255,255,255,0.18)'} strokeWidth={sel || hi ? 2 : 1} filter="url(#nodeShadow)" />
              <rect x={inputX - nodeW / 2} y={y - nodeH / 2} width="4" height={nodeH} rx="2" fill="#4fd1c5" />
              <circle cx={inputX + nodeW / 2} cy={y} r="3" fill="#4fd1c5" />
              <text x={inputX + 3} y={y - 2} fontSize="11.5" fontWeight="bold" textAnchor="middle" fill="#e6edf3">{truncate(s.label, 16)}</text>
              <text x={inputX + 3} y={y + 11} fontSize="9.5" textAnchor="middle" fill={coupled ? '#c4b5fd' : 'rgba(255,255,255,0.55)'}>
                {s.value}{coupled ? ` → ${effVal}` : ''}
              </text>
            </g>
          );
        })}

        {/* outcome nodes */}
        {outcomes.map((o) => {
          const y = outcomeY[o.id];
          const sel = isSel({ kind: 'outcome', id: o.id });
          const nKey = `outcome:${o.id}`;
          const hi = nodeHi(nKey);
          return (
            <g key={`o-${o.id}`} style={{ cursor: 'pointer' }} opacity={nodeOpacity(nKey)} onClick={() => handleNodeClick('outcome', o.id)}>
              <rect x={outcomeX - nodeW / 2} y={y - nodeH / 2} width={nodeW} height={nodeH} rx="10"
                fill="url(#gOut)" stroke={sel ? '#4fd1c5' : hi ? '#cbd5e1' : o.color} strokeWidth={sel || hi ? 2 : 1.5} filter="url(#nodeShadow)" />
              <circle cx={outcomeX - nodeW / 2} cy={y} r="3" fill={o.color} />
              <text x={outcomeX - 12} y={y + 4} fontSize="11.5" fontWeight="bold" textAnchor="middle" fill="#e6edf3">{truncate(o.label, 13)}</text>
              <g>
                <rect x={outcomeX + nodeW / 2 - 34} y={y - 11} width="28" height="22" rx="6" fill={o.color} />
                <text x={outcomeX + nodeW / 2 - 20} y={y + 4} fontSize="11" fontWeight="bold" textAnchor="middle" fill="#0b0e14">{o.value}</text>
              </g>
            </g>
          );
        })}
      </svg>

      {/* legend */}
      <div style={{ fontSize: '10px', opacity: 0.6, textAlign: 'center', marginTop: '2px' }}>
        {t('modelLab.legend', 'Solid: input → outcome · Dashed: input → input · green +, red −')}
      </div>

      {/* selected wire editor */}
      {selected && (
        <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', background: 'rgba(79,209,197,0.08)', border: '1px solid rgba(79,209,197,0.25)', borderRadius: '8px', padding: '8px 12px' }}>
          <span style={{ fontSize: '12px' }}>
            <strong>{selected.type === 'weight' ? labelOf('slider', selected.sliderId) : labelOf('slider', selected.sourceId)}</strong>
            {' → '}
            <strong>{selected.type === 'weight' ? labelOf('outcome', selected.outcomeId) : labelOf('slider', selected.targetId)}</strong>
          </span>
          <input type="range" min="-1" max="1" step="0.05" value={selectedValue} onChange={(e) => applySelected(Number(e.target.value))} style={{ flex: 1, minWidth: 120, accentColor: selectedValue >= 0 ? '#6ee7b7' : '#fca5a5' }} />
          <span style={{ width: 40, textAlign: 'right', fontSize: '12px', fontWeight: 'bold', color: selectedValue > 0 ? '#6ee7b7' : selectedValue < 0 ? '#fca5a5' : 'rgba(255,255,255,0.6)' }}>
            {selectedValue > 0 ? '+' : ''}{selectedValue.toFixed(2)}
          </span>
          <button onClick={() => { applySelected(0); setSelected(null); }} style={btnDangerLink}>{t('modelLab.remove', 'remove')}</button>
        </div>
      )}
    </div>
  );
}

function WireBadge({ x, y, w }) {
  const label = `${w > 0 ? '+' : ''}${w.toFixed(2)}`;
  const col = w > 0 ? '#6ee7b7' : '#fca5a5';
  return (
    <g pointerEvents="none">
      <rect x={x - 17} y={y - 9} width="34" height="18" rx="9" fill="#0b0e14" stroke={col} strokeWidth="1" />
      <text x={x} y={y + 4} fontSize="10" fontWeight="bold" textAnchor="middle" fill={col}>{label}</text>
    </g>
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
