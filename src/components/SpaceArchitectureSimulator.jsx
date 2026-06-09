/**
 * SpaceArchitectureSimulator — an interactive educational widget.
 *
 * Students adjust habitat architectural parameters (Noise, Biophilia, Clutter,
 * Lighting) and see a modelled effect on cognitive performance (Attention,
 * Working Memory, Stress, Overall) rendered as a live SVG bar chart.
 *
 * It also contains a deliberately inconspicuous "build tag" link, styled to
 * look like a technical metadata string with very low contrast. Clicking it
 * dispatches a global `orbarch:toggleMATB` CustomEvent, which the app's event
 * bridge (see index.js) listens for to transition to the MATB testing suite.
 *
 * Part of the Orbital Architecture project. MIT License — see LICENSE.
 */
import React, { useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const clamp = (v) => Math.max(0, Math.min(100, v));

// Simple, illustrative model linking architectural choices to cognition.
// Noise & Clutter degrade performance; Biophilia & Lighting improve it.
function computeMetrics({ noise, biophilia, clutter, lighting }) {
  const n = noise / 100;
  const b = biophilia / 100;
  const c = clutter / 100;
  const l = lighting / 100;

  const attention = Math.round(clamp(100 * (0.55 + 0.30 * l + 0.20 * b - 0.35 * n - 0.25 * c)));
  const memory = Math.round(clamp(100 * (0.55 + 0.20 * l + 0.25 * b - 0.30 * n - 0.30 * c)));
  const stress = Math.round(clamp(100 * (0.30 + 0.40 * n + 0.30 * c - 0.20 * b - 0.15 * l)));
  const overall = Math.round((attention + memory + (100 - stress)) / 3);

  return { attention, memory, stress, overall };
}

const SLIDER_KEYS = ['noise', 'biophilia', 'clutter', 'lighting'];

function SpaceArchitectureSimulator() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [params, setParams] = useState({
    noise: 40,
    biophilia: 55,
    clutter: 35,
    lighting: 60
  });

  const metrics = useMemo(() => computeMetrics(params), [params]);

  const setParam = useCallback((key, value) => {
    setParams((prev) => ({ ...prev, [key]: Number(value) }));
  }, []);

  const reset = useCallback(() => {
    setParams({ noise: 40, biophilia: 55, clutter: 35, lighting: 60 });
  }, []);

  // Hidden trigger: dispatch the decoupled event the main app listens for.
  const handleHiddenTrigger = useCallback((e) => {
    e.preventDefault();
    window.dispatchEvent(new CustomEvent('orbarch:toggleMATB'));
  }, []);

  // ---- Chart geometry (SVG, responsive via viewBox) ----
  const VB_W = 400;
  const VB_H = 230;
  const chartTop = 28;
  const chartBottom = 188;
  const chartHeight = chartBottom - chartTop;

  const bars = [
    { key: 'attention', value: metrics.attention, color: '#4fd1c5' },
    { key: 'memory', value: metrics.memory, color: '#63b3ed' },
    { key: 'stress', value: metrics.stress, color: '#f6ad55' },
    { key: 'overall', value: metrics.overall, color: '#9ae6b4' }
  ];

  const slotW = VB_W / bars.length;
  const barW = slotW * 0.5;

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        background: 'radial-gradient(1200px 600px at 50% -10%, #16243d 0%, #0b0e14 60%)',
        color: '#e6edf3',
        fontFamily: 'Arial, sans-serif'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '760px',
          background: 'rgba(10, 14, 22, 0.85)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '14px',
          padding: '24px',
          boxShadow: '0 10px 40px rgba(0,0,0,0.45)'
        }}
      >
        <h1 style={{ fontSize: '24px', margin: '0 0 6px 0', textAlign: 'center' }}>
          {t('simulator.title', 'Space Architecture & Cognitive Performance Simulator')}
        </h1>
        <p style={{ fontSize: '14px', opacity: 0.8, margin: '0 0 22px 0', textAlign: 'center' }}>
          {t('simulator.subtitle', 'Adjust the habitat design parameters and watch the modelled effect on crew cognition.')}
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '24px',
            alignItems: 'start'
          }}
        >
          {/* Sliders */}
          <div>
            {SLIDER_KEYS.map((key) => (
              <div key={key} style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <label htmlFor={`sim-${key}`} style={{ fontSize: '14px', fontWeight: 'bold' }}>
                    {t(`simulator.sliders.${key}`, key)}
                  </label>
                  <span style={{ fontSize: '13px', opacity: 0.85, fontVariantNumeric: 'tabular-nums' }}>
                    {params[key]}%
                  </span>
                </div>
                <input
                  id={`sim-${key}`}
                  type="range"
                  min="0"
                  max="100"
                  value={params[key]}
                  onChange={(e) => setParam(key, e.target.value)}
                  style={{ width: '100%', accentColor: '#4fd1c5', cursor: 'pointer' }}
                />
                <div style={{ fontSize: '11px', opacity: 0.55, marginTop: '2px' }}>
                  {t(`simulator.sliderHints.${key}`, '')}
                </div>
              </div>
            ))}

            <button
              onClick={reset}
              style={{
                marginTop: '6px',
                padding: '8px 16px',
                background: 'transparent',
                color: '#e6edf3',
                border: '1px solid rgba(255,255,255,0.25)',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px'
              }}
            >
              {t('simulator.reset', 'Reset')}
            </button>
          </div>

          {/* Chart */}
          <div>
            <svg
              viewBox={`0 0 ${VB_W} ${VB_H}`}
              width="100%"
              role="img"
              aria-label={t('simulator.overallScore', 'Overall cognitive performance')}
              style={{ display: 'block' }}
            >
              {/* gridlines */}
              {[0, 25, 50, 75, 100].map((g) => {
                const y = chartBottom - (g / 100) * chartHeight;
                return (
                  <g key={g}>
                    <line x1="0" y1={y} x2={VB_W} y2={y} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
                    <text x="2" y={y - 2} fontSize="9" fill="rgba(255,255,255,0.4)">{g}</text>
                  </g>
                );
              })}

              {bars.map((bar, i) => {
                const h = (bar.value / 100) * chartHeight;
                const x = i * slotW + (slotW - barW) / 2;
                const y = chartBottom - h;
                return (
                  <g key={bar.key}>
                    <rect x={x} y={y} width={barW} height={h} rx="4" fill={bar.color}>
                      <title>{`${t(`simulator.metrics.${bar.key}`, bar.key)}: ${bar.value}`}</title>
                    </rect>
                    <text
                      x={x + barW / 2}
                      y={y - 5}
                      fontSize="12"
                      fontWeight="bold"
                      textAnchor="middle"
                      fill="#e6edf3"
                    >
                      {bar.value}
                    </text>
                    <text
                      x={x + barW / 2}
                      y={chartBottom + 16}
                      fontSize="10"
                      textAnchor="middle"
                      fill="rgba(255,255,255,0.75)"
                    >
                      {t(`simulator.metrics.${bar.key}`, bar.key)}
                    </text>
                  </g>
                );
              })}
            </svg>

            <div
              style={{
                marginTop: '8px',
                textAlign: 'center',
                fontSize: '13px',
                opacity: 0.85
              }}
            >
              {t('simulator.overallScore', 'Overall cognitive performance')}:{' '}
              <strong style={{ color: '#9ae6b4' }}>{metrics.overall}</strong>
            </div>
          </div>
        </div>

        <p style={{ fontSize: '11px', opacity: 0.5, marginTop: '20px', textAlign: 'center' }}>
          {t('simulator.note', 'Illustrative educational model — not clinical data.')}
        </p>

        {/* Footer: visible back action + inconspicuous build tag (hidden trigger) */}
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

          {/*
            Inconspicuous easter-egg trigger. Looks like a build/version string,
            very low contrast against the panel, not keyboard-focusable, and
            hidden from assistive tech so students don't activate it by accident.
          */}
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

export default SpaceArchitectureSimulator;
