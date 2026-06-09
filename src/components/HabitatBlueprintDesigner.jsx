/**
 * HabitatBlueprintDesigner — Concept A (extended).
 *
 * Students place architectural features onto a station-module grid. The design
 * drives TWO sides:
 *   - Crew cognition (Attention / Working Memory / Stress) via the shared
 *     architectural model (noise, biophilia, clutter, lighting), and
 *   - Mission value (Science / Health / Life Support) which benefits from
 *     having the right equipment.
 * A top-level Mission Success score blends both, so students must balance a
 * productive, well-equipped habitat against a calm, low-clutter one.
 *
 * Ships with a starting scenario + live requirements checklist, hover
 * descriptions for every feature, and the inconspicuous orbarch:toggleMATB
 * trigger.
 *
 * Part of the Orbital Architecture project. MIT License — see LICENSE.
 */
import React, { useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  clamp,
  DEFAULT_ARCH_PARAMS,
  computeMetrics,
  reactionTimeMs,
  REFERENCE_RT_MS
} from '../utils/cognitiveModel';

// Each feature can affect the architectural params (arch -> cognition) AND the
// mission-value factors (value). Many items deliberately help some things while
// hurting others, to create trade-offs.
const FEATURES = {
  acousticZone: { icon: '🔇', color: '#2c5282', arch: { noise: -18 }, value: {} },
  stowage: { icon: '📦', color: '#744210', arch: { clutter: -16 }, value: {} },
  plantWall: { icon: '🪴', color: '#276749', arch: { biophilia: 16, clutter: 4 }, value: { health: 6, lifeSupport: 8 } },
  virtualWindow: { icon: '🪟', color: '#2b6cb0', arch: { lighting: 10, biophilia: 6 }, value: { health: 4 } },
  circadianLight: { icon: '💡', color: '#975a16', arch: { lighting: 16 }, value: { health: 4 } },
  sleepingQuarters: { icon: '🛏️', color: '#4c51bf', arch: { noise: -6, biophilia: 4 }, value: { health: 12 } },
  noisyEquipment: { icon: '🌀', color: '#822727', arch: { noise: 14, clutter: 6 }, value: { lifeSupport: 16 } },
  scienceRack: { icon: '🔬', color: '#285e61', arch: { clutter: 10, noise: 4 }, value: { science: 20 } },
  exerciseBike: { icon: '🚴', color: '#9c4221', arch: { noise: 12, clutter: 6 }, value: { health: 18 } },
  workstation: { icon: '🖥️', color: '#2a4365', arch: { clutter: 8, lighting: 4 }, value: { science: 10 } },
  medbay: { icon: '⚕️', color: '#702459', arch: { clutter: 6 }, value: { health: 14, science: 6 } },
  greenhouse: { icon: '🌱', color: '#22543d', arch: { biophilia: 10, clutter: 8, noise: 4 }, value: { lifeSupport: 16, health: 8 } }
};

const GRID_COLS = 7;
const GRID_ROWS = 5;
const GRID_SIZE = GRID_COLS * GRID_ROWS;

const VALUE_BASE = { science: 25, health: 25, lifeSupport: 25 };

// Starting scenario: equipment-heavy, noisy and cluttered, with no stowage,
// no acoustic treatment and no sleeping quarters. Students must fix it.
function buildScenario() {
  const cells = Array(GRID_SIZE).fill(null);
  cells[0] = 'noisyEquipment';
  cells[2] = 'scienceRack';
  cells[4] = 'noisyEquipment';
  cells[6] = 'exerciseBike';
  cells[8] = 'workstation';
  cells[18] = 'scienceRack';
  return cells;
}

function MiniBars({ title, bars, t }) {
  const VB_W = 300;
  const top = 22;
  const bottom = 120;
  const h0 = bottom - top;
  return (
    <div>
      <div style={{ fontSize: '12px', opacity: 0.75, marginBottom: '2px', textAlign: 'center' }}>{title}</div>
      <svg viewBox={`0 0 ${VB_W} 140`} width="100%" style={{ display: 'block' }}>
        {[0, 50, 100].map((g) => {
          const y = bottom - (g / 100) * h0;
          return <line key={g} x1="0" y1={y} x2={VB_W} y2={y} stroke="rgba(255,255,255,0.08)" />;
        })}
        {bars.map((b, i) => {
          const slot = VB_W / bars.length;
          const bw = Math.min(slot * 0.5, 42);
          const hh = (b.value / 100) * h0;
          const x = i * slot + (slot - bw) / 2;
          const y = bottom - hh;
          return (
            <g key={b.key}>
              <rect x={x} y={y} width={bw} height={hh} rx="4" fill={b.color} />
              <text x={x + bw / 2} y={y - 4} fontSize="11" fontWeight="bold" textAnchor="middle" fill="#e6edf3">{b.value}</text>
              <text x={x + bw / 2} y={134} fontSize="9" textAnchor="middle" fill="rgba(255,255,255,0.75)">{b.label}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function HabitatBlueprintDesigner() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [cells, setCells] = useState(() => buildScenario());
  const [tool, setTool] = useState('acousticZone');
  const [hoveredFeature, setHoveredFeature] = useState(null);

  const placeAt = useCallback((index) => {
    setCells((prev) => {
      const next = [...prev];
      next[index] = tool === 'erase' ? null : tool;
      return next;
    });
  }, [tool]);

  const clearAll = useCallback(() => setCells(Array(GRID_SIZE).fill(null)), []);
  const loadScenario = useCallback(() => setCells(buildScenario()), []);

  // Aggregate placed features into architectural params + mission value factors.
  const { params, value, counts } = useMemo(() => {
    const p = { ...DEFAULT_ARCH_PARAMS };
    const v = { ...VALUE_BASE };
    const c = {};
    cells.forEach((id) => {
      if (!id || !FEATURES[id]) return;
      c[id] = (c[id] || 0) + 1;
      Object.entries(FEATURES[id].arch || {}).forEach(([k, d]) => { p[k] = clamp(p[k] + d); });
      Object.entries(FEATURES[id].value || {}).forEach(([k, d]) => { v[k] = clamp((v[k] || 0) + d); });
    });
    return { params: p, value: v, counts: c };
  }, [cells]);

  const metrics = useMemo(() => computeMetrics(params), [params]);
  const cognitiveOverall = metrics.overall;
  const missionValueOverall = Math.round((value.science + value.health + value.lifeSupport) / 3);
  const missionSuccess = Math.round(0.5 * cognitiveOverall + 0.5 * missionValueOverall);
  const rt = reactionTimeMs(cognitiveOverall);
  const rtDelta = REFERENCE_RT_MS - rt;

  const handleHiddenTrigger = useCallback((e) => {
    e.preventDefault();
    window.dispatchEvent(new CustomEvent('orbarch:toggleMATB'));
  }, []);

  const cognitionBars = [
    { key: 'attention', value: metrics.attention, color: '#4fd1c5', label: t('simulator.metrics.attention', 'Attention') },
    { key: 'memory', value: metrics.memory, color: '#63b3ed', label: t('simulator.metrics.memory', 'Memory') },
    { key: 'stress', value: metrics.stress, color: '#f6ad55', label: t('simulator.metrics.stress', 'Stress') },
    { key: 'overall', value: cognitiveOverall, color: '#9ae6b4', label: t('simulator.metrics.overall', 'Overall') }
  ];
  const valueBars = [
    { key: 'science', value: value.science, color: '#f6e05e', label: t('blueprint.metricsV.science', 'Science') },
    { key: 'health', value: value.health, color: '#68d391', label: t('blueprint.metricsV.health', 'Health') },
    { key: 'lifeSupport', value: value.lifeSupport, color: '#76e4f7', label: t('blueprint.metricsV.lifeSupport', 'Life support') }
  ];

  const requirements = [
    { ok: (counts.noisyEquipment || 0) >= 1, label: t('blueprint.req.lifeSupport', 'Keep at least 1 life-support unit') },
    { ok: (counts.stowage || 0) >= 2, label: t('blueprint.req.stowage', 'Add at least 2 stowage units') },
    { ok: (counts.sleepingQuarters || 0) >= 1, label: t('blueprint.req.sleep', 'Add sleeping quarters') },
    { ok: missionSuccess >= 70, label: t('blueprint.req.success', 'Reach Mission Success ≥ 70') }
  ];

  const successColor = missionSuccess >= 70 ? '#9ae6b4' : missionSuccess >= 50 ? '#f6ad55' : '#fc8181';
  const descId = hoveredFeature || (tool !== 'erase' ? tool : null);

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        boxSizing: 'border-box',
        padding: '24px',
        background: 'radial-gradient(1200px 600px at 50% -10%, #16243d 0%, #0b0e14 60%)',
        color: '#e6edf3',
        fontFamily: 'Arial, sans-serif'
      }}
    >
      <div style={{ maxWidth: '1040px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '24px', margin: '0 0 6px 0', textAlign: 'center' }}>
          {t('blueprint.title', 'Habitat Blueprint Designer')}
        </h1>
        <p style={{ fontSize: '14px', opacity: 0.8, margin: '0 0 22px 0', textAlign: 'center' }}>
          {t('blueprint.subtitle2', 'Balance crew cognition against mission value. Equipment boosts the mission but can hurt focus — design wisely.')}
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', alignItems: 'start' }}>
          {/* Left: palette + descriptor + grid */}
          <div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
              {Object.entries(FEATURES).map(([id, f]) => (
                <button
                  key={id}
                  onClick={() => setTool(id)}
                  onMouseEnter={() => setHoveredFeature(id)}
                  onMouseLeave={() => setHoveredFeature(null)}
                  title={t(`blueprint.desc.${id}`, '')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '5px 8px',
                    borderRadius: '8px',
                    border: tool === id ? '2px solid #4fd1c5' : '1px solid rgba(255,255,255,0.18)',
                    background: f.color,
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '11px'
                  }}
                >
                  <span style={{ fontSize: '15px' }}>{f.icon}</span>
                  {t(`blueprint.features.${id}`, id)}
                </button>
              ))}
              <button
                onClick={() => setTool('erase')}
                onMouseEnter={() => setHoveredFeature(null)}
                style={{
                  padding: '5px 8px',
                  borderRadius: '8px',
                  border: tool === 'erase' ? '2px solid #4fd1c5' : '1px solid rgba(255,255,255,0.18)',
                  background: '#2d3748',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '11px'
                }}
              >
                🧽 {t('blueprint.erase', 'Erase')}
              </button>
            </div>

            {/* hover/selected descriptor */}
            <div style={{ minHeight: '34px', fontSize: '12px', opacity: 0.85, background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '8px 10px', marginBottom: '10px' }}>
              {descId ? (
                <span><strong>{t(`blueprint.features.${descId}`, descId)}:</strong> {t(`blueprint.desc.${descId}`, '')}</span>
              ) : (
                <span style={{ opacity: 0.6 }}>{t('blueprint.hoverHint', 'Hover a feature to see what it does, then click the grid to place it.')}</span>
              )}
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
                gap: '4px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '10px',
                padding: '8px'
              }}
            >
              {cells.map((id, i) => {
                const f = id ? FEATURES[id] : null;
                return (
                  <button
                    key={i}
                    onClick={() => placeAt(i)}
                    onMouseEnter={() => f && setHoveredFeature(id)}
                    title={f ? `${t(`blueprint.features.${id}`, id)} — ${t(`blueprint.desc.${id}`, '')}` : ''}
                    style={{
                      aspectRatio: '1 / 1',
                      borderRadius: '6px',
                      border: '1px solid rgba(255,255,255,0.10)',
                      background: f ? f.color : 'rgba(255,255,255,0.02)',
                      color: 'white',
                      fontSize: '18px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    {f ? f.icon : ''}
                  </button>
                );
              })}
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
              <button onClick={loadScenario} style={{ padding: '8px 16px', background: '#6f42c1', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
                {t('blueprint.loadScenario', 'Load scenario')}
              </button>
              <button onClick={clearAll} style={{ padding: '8px 16px', background: 'transparent', color: '#e6edf3', border: '1px solid rgba(255,255,255,0.25)', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
                {t('blueprint.clear', 'Clear module')}
              </button>
            </div>
          </div>

          {/* Right: scores + brief */}
          <div>
            <div style={{ background: 'rgba(10,14,22,0.6)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '16px', textAlign: 'center', marginBottom: '14px' }}>
              <div style={{ fontSize: '13px', opacity: 0.75 }}>{t('blueprint.missionSuccess', 'Mission success')}</div>
              <div style={{ fontSize: '40px', fontWeight: 'bold', color: successColor, lineHeight: 1.1 }}>{missionSuccess}</div>
              <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '4px' }}>
                {t('blueprint.reactionTime', 'Simulated reaction time')}: <strong>{rt} ms</strong>{' '}
                <span style={{ color: rtDelta >= 0 ? '#9ae6b4' : '#fc8181' }}>
                  ({rtDelta >= 0 ? '−' : '+'}{Math.abs(rtDelta)} ms)
                </span>
              </div>
            </div>

            {/* Mission brief / requirements */}
            <div style={{ background: 'rgba(10,14,22,0.6)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '14px', marginBottom: '14px' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>🎯 {t('blueprint.brief', 'Mission brief')}</div>
              {requirements.map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', marginBottom: '4px', color: r.ok ? '#9ae6b4' : 'rgba(255,255,255,0.8)' }}>
                  <span>{r.ok ? '✅' : '⬜'}</span>{r.label}
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <MiniBars title={t('blueprint.cognition', 'Crew cognition')} bars={cognitionBars} t={t} />
              <MiniBars title={t('blueprint.missionValue', 'Mission value')} bars={valueBars} t={t} />
            </div>
          </div>
        </div>

        {/* Footer: back + inconspicuous build-tag trigger */}
        <div
          style={{
            marginTop: '18px',
            paddingTop: '12px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px'
          }}
        >
          <button
            onClick={() => navigate('/')}
            style={{ padding: '8px 16px', background: '#1f6feb', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}
          >
            {t('common.back', 'Back')}
          </button>

          <a
            href="#config"
            onClick={handleHiddenTrigger}
            tabIndex={-1}
            aria-hidden="true"
            style={{
              fontFamily: 'monospace',
              fontSize: '10px',
              letterSpacing: '0.3px',
              color: 'rgba(160, 174, 192, 0.10)',
              textDecoration: 'none',
              cursor: 'default',
              userSelect: 'none'
            }}
          >
            {t('simulator.buildTag', 'Config: build_75m_rev2//ID:orbarch-matb-eval')}
          </a>
        </div>
      </div>
    </div>
  );
}

export default HabitatBlueprintDesigner;
