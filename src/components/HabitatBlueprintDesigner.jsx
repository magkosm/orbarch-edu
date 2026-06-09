/**
 * HabitatBlueprintDesigner — Concept A.
 *
 * Students place architectural features onto a station-module grid; a live
 * cognitive read-out (reusing the shared cognitive model) shows how their
 * design choices "rescue" the crew's simulated reaction time. This is the
 * digital twin of the Phase 3 A3 sketching activity.
 *
 * Also carries the inconspicuous `orbarch:toggleMATB` trigger so a facilitator
 * can flip to the MATB testing suite during the workshop.
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

// Palette of placeable features. Each applies deltas to the architectural
// parameters. Positive design choices help; "noisyEquipment" is a necessary
// but costly element that teaches acoustic zoning / trade-offs.
const FEATURES = {
  acousticZone: { icon: '🔇', color: '#2c5282', deltas: { noise: -18 } },
  plantWall: { icon: '🪴', color: '#276749', deltas: { biophilia: 18 } },
  virtualWindow: { icon: '🪟', color: '#2b6cb0', deltas: { lighting: 10, biophilia: 6 } },
  stowage: { icon: '📦', color: '#744210', deltas: { clutter: -16 } },
  circadianLight: { icon: '💡', color: '#975a16', deltas: { lighting: 16 } },
  noisyEquipment: { icon: '🌀', color: '#822727', deltas: { noise: 14, clutter: 8 } }
};

const GRID_COLS = 6;
const GRID_ROWS = 4;
const GRID_SIZE = GRID_COLS * GRID_ROWS;

function HabitatBlueprintDesigner() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [cells, setCells] = useState(() => Array(GRID_SIZE).fill(null));
  const [tool, setTool] = useState('acousticZone'); // selected palette tool or 'erase'

  const placeAt = useCallback((index) => {
    setCells((prev) => {
      const next = [...prev];
      next[index] = tool === 'erase' ? null : tool;
      return next;
    });
  }, [tool]);

  const clearAll = useCallback(() => setCells(Array(GRID_SIZE).fill(null)), []);

  // Aggregate placed features into architectural parameters.
  const params = useMemo(() => {
    const p = { ...DEFAULT_ARCH_PARAMS };
    cells.forEach((id) => {
      if (id && FEATURES[id]) {
        Object.entries(FEATURES[id].deltas).forEach(([k, v]) => {
          p[k] = clamp(p[k] + v);
        });
      }
    });
    return p;
  }, [cells]);

  const metrics = useMemo(() => computeMetrics(params), [params]);
  const rt = reactionTimeMs(metrics.overall);
  const rtDelta = REFERENCE_RT_MS - rt; // positive = faster than the neutral reference

  const handleHiddenTrigger = useCallback((e) => {
    e.preventDefault();
    window.dispatchEvent(new CustomEvent('orbarch:toggleMATB'));
  }, []);

  const bars = [
    { key: 'attention', value: metrics.attention, color: '#4fd1c5' },
    { key: 'memory', value: metrics.memory, color: '#63b3ed' },
    { key: 'stress', value: metrics.stress, color: '#f6ad55' },
    { key: 'overall', value: metrics.overall, color: '#9ae6b4' }
  ];

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
      <div style={{ maxWidth: '960px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '24px', margin: '0 0 6px 0', textAlign: 'center' }}>
          {t('blueprint.title', 'Habitat Blueprint Designer')}
        </h1>
        <p style={{ fontSize: '14px', opacity: 0.8, margin: '0 0 22px 0', textAlign: 'center' }}>
          {t('blueprint.subtitle', 'Lay out your module. Each feature changes the crew\u2019s cognitive baseline.')}
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '24px',
            alignItems: 'start'
          }}
        >
          {/* Left: palette + grid */}
          <div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
              {Object.entries(FEATURES).map(([id, f]) => (
                <button
                  key={id}
                  onClick={() => setTool(id)}
                  title={t(`blueprint.features.${id}`, id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 10px',
                    borderRadius: '8px',
                    border: tool === id ? '2px solid #4fd1c5' : '1px solid rgba(255,255,255,0.18)',
                    background: f.color,
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  <span style={{ fontSize: '16px' }}>{f.icon}</span>
                  {t(`blueprint.features.${id}`, id)}
                </button>
              ))}
              <button
                onClick={() => setTool('erase')}
                style={{
                  padding: '6px 10px',
                  borderRadius: '8px',
                  border: tool === 'erase' ? '2px solid #4fd1c5' : '1px solid rgba(255,255,255,0.18)',
                  background: '#2d3748',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                🧽 {t('blueprint.erase', 'Erase')}
              </button>
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
                    title={f ? t(`blueprint.features.${id}`, id) : ''}
                    style={{
                      aspectRatio: '1 / 1',
                      borderRadius: '6px',
                      border: '1px solid rgba(255,255,255,0.10)',
                      background: f ? f.color : 'rgba(255,255,255,0.02)',
                      color: 'white',
                      fontSize: '20px',
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

            <button
              onClick={clearAll}
              style={{
                marginTop: '12px',
                padding: '8px 16px',
                background: 'transparent',
                color: '#e6edf3',
                border: '1px solid rgba(255,255,255,0.25)',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px'
              }}
            >
              {t('blueprint.clear', 'Clear module')}
            </button>
          </div>

          {/* Right: cognitive read-out */}
          <div>
            <div
              style={{
                background: 'rgba(10,14,22,0.6)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '12px',
                padding: '16px',
                textAlign: 'center',
                marginBottom: '16px'
              }}
            >
              <div style={{ fontSize: '13px', opacity: 0.75 }}>
                {t('blueprint.reactionTime', 'Simulated reaction time')}
              </div>
              <div style={{ fontSize: '34px', fontWeight: 'bold', color: '#9ae6b4' }}>
                {rt} ms
              </div>
              <div style={{ fontSize: '13px', opacity: 0.85, color: rtDelta >= 0 ? '#9ae6b4' : '#fc8181' }}>
                {rtDelta >= 0
                  ? t('blueprint.rescued', 'Rescued by {{ms}} ms vs. a neutral cabin', { ms: rtDelta })
                  : t('blueprint.slower', '{{ms}} ms slower than a neutral cabin', { ms: Math.abs(rtDelta) })}
              </div>
            </div>

            <svg viewBox="0 0 400 230" width="100%" role="img" aria-label={t('blueprint.title', 'Habitat Blueprint Designer')} style={{ display: 'block' }}>
              {[0, 25, 50, 75, 100].map((g) => {
                const y = 188 - (g / 100) * 160;
                return (
                  <g key={g}>
                    <line x1="0" y1={y} x2="400" y2={y} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
                    <text x="2" y={y - 2} fontSize="9" fill="rgba(255,255,255,0.4)">{g}</text>
                  </g>
                );
              })}
              {bars.map((bar, i) => {
                const slotW = 400 / bars.length;
                const barW = slotW * 0.5;
                const h = (bar.value / 100) * 160;
                const x = i * slotW + (slotW - barW) / 2;
                const y = 188 - h;
                return (
                  <g key={bar.key}>
                    <rect x={x} y={y} width={barW} height={h} rx="4" fill={bar.color} />
                    <text x={x + barW / 2} y={y - 5} fontSize="12" fontWeight="bold" textAnchor="middle" fill="#e6edf3">{bar.value}</text>
                    <text x={x + barW / 2} y={204} fontSize="10" textAnchor="middle" fill="rgba(255,255,255,0.75)">
                      {t(`simulator.metrics.${bar.key}`, bar.key)}
                    </text>
                  </g>
                );
              })}
            </svg>
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
            style={{
              padding: '8px 16px',
              background: '#1f6feb',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '13px'
            }}
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
