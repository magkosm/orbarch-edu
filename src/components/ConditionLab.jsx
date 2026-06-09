/**
 * ConditionLab — Concept B.
 *
 * Tightens Phase 2 of the workshop: run the MATB under a quiet BASELINE and a
 * noisy STRESSED condition, then compare. Includes a self-contained Web Audio
 * brown-noise stressor (no audio asset needed) that keeps playing while the
 * MATB is launched in a new tab, plus a baseline-vs-stressed comparison so
 * students can quantify the performance difference between environments.
 *
 * Part of the Orbital Architecture project. MIT License — see LICENSE.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

function ConditionLab() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const [noiseOn, setNoiseOn] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [baseline, setBaseline] = useState('');
  const [stressed, setStressed] = useState('');

  const ctxRef = useRef(null);
  const srcRef = useRef(null);
  const gainRef = useRef(null);

  const ensureNoise = useCallback(() => {
    if (ctxRef.current) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const bufferSize = 2 * ctx.sampleRate;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + 0.02 * white) / 1.02;
      data[i] = lastOut * 3.5; // brown-ish noise, like cabin/fan rumble
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    src.connect(gain).connect(ctx.destination);
    src.start();
    ctxRef.current = ctx;
    srcRef.current = src;
    gainRef.current = gain;
  }, [volume]);

  const stopNoise = useCallback(() => {
    try {
      if (srcRef.current) srcRef.current.stop();
    } catch (e) { /* already stopped */ }
    if (ctxRef.current) ctxRef.current.close();
    ctxRef.current = null;
    srcRef.current = null;
    gainRef.current = null;
  }, []);

  const setNoise = useCallback((on) => {
    setNoiseOn(on);
    if (on) {
      ensureNoise();
      if (ctxRef.current && ctxRef.current.state === 'suspended') ctxRef.current.resume();
    } else {
      stopNoise();
    }
  }, [ensureNoise, stopNoise]);

  // Keep gain in sync with the volume slider.
  useEffect(() => {
    if (gainRef.current) gainRef.current.gain.value = volume;
  }, [volume]);

  // Clean up audio on unmount.
  useEffect(() => () => stopNoise(), [stopNoise]);

  const lng = i18n.language ? `?lng=${i18n.language}` : '';
  const matbUrl = `${process.env.PUBLIC_URL}/2min${lng}`;

  const launchBaseline = useCallback(() => {
    setNoise(false);
    window.open(matbUrl, '_blank', 'noopener');
  }, [matbUrl, setNoise]);

  const launchStressed = useCallback(() => {
    setNoise(true);
    window.open(matbUrl, '_blank', 'noopener');
  }, [matbUrl, setNoise]);

  const b = parseFloat(baseline);
  const s = parseFloat(stressed);
  const haveBoth = !Number.isNaN(b) && !Number.isNaN(s);
  const deltaPct = useMemo(() => {
    if (!haveBoth || b === 0) return null;
    return Math.round(((s - b) / b) * 100);
  }, [haveBoth, b, s]);

  const maxScore = Math.max(b || 0, s || 0, 1);

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
      <div style={{ maxWidth: '760px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '24px', margin: '0 0 6px 0', textAlign: 'center' }}>
          {t('conditionLab.title', 'Condition Lab \u2014 Quiet vs. Noise')}
        </h1>
        <p style={{ fontSize: '14px', opacity: 0.8, margin: '0 0 22px 0', textAlign: 'center' }}>
          {t('conditionLab.subtitle', 'Run the MATB twice and measure how a noisy cabin changes performance.')}
        </p>

        {/* Stressor control */}
        <div
          style={{
            background: 'rgba(10,14,22,0.6)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '16px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ fontWeight: 'bold' }}>
              🔊 {t('conditionLab.stressor', 'Cabin noise stressor')}
            </div>
            <button
              onClick={() => setNoise(!noiseOn)}
              style={{
                padding: '8px 16px',
                background: noiseOn ? '#c53030' : '#2f855a',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px'
              }}
            >
              {noiseOn ? t('conditionLab.noiseOn', 'Noise ON \u2014 tap to stop') : t('conditionLab.noiseOff', 'Noise OFF \u2014 tap to play')}
            </button>
          </div>
          <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '12px', opacity: 0.7 }}>{t('conditionLab.volume', 'Volume')}</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              style={{ flex: 1, accentColor: '#4fd1c5' }}
            />
          </div>
          <p style={{ fontSize: '11px', opacity: 0.5, marginTop: '10px', marginBottom: 0 }}>
            {t('conditionLab.tip', 'Tip: the noise keeps playing here while the MATB opens in a new tab.')}
          </p>
        </div>

        {/* Run buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '16px' }}>
          <div style={{ background: 'rgba(47,133,90,0.15)', border: '1px solid rgba(154,230,180,0.25)', borderRadius: '12px', padding: '16px' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '16px' }}>① {t('conditionLab.baseline', 'Baseline (quiet)')}</h3>
            <button onClick={launchBaseline} style={{ width: '100%', padding: '10px', background: '#2f855a', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', marginBottom: '10px' }}>
              {t('conditionLab.runBaseline', 'Run MATB (quiet)')}
            </button>
            <label style={{ fontSize: '12px', opacity: 0.8 }}>{t('conditionLab.enterScore', 'Enter final score')}</label>
            <input type="number" value={baseline} onChange={(e) => setBaseline(e.target.value)} placeholder="0"
              style={{ width: '100%', marginTop: '4px', padding: '8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.3)', color: '#fff', boxSizing: 'border-box' }} />
          </div>

          <div style={{ background: 'rgba(197,48,48,0.15)', border: '1px solid rgba(252,129,129,0.25)', borderRadius: '12px', padding: '16px' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '16px' }}>② {t('conditionLab.stressed', 'Stressed (noise)')}</h3>
            <button onClick={launchStressed} style={{ width: '100%', padding: '10px', background: '#c53030', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', marginBottom: '10px' }}>
              {t('conditionLab.runStressed', 'Run MATB (with noise)')}
            </button>
            <label style={{ fontSize: '12px', opacity: 0.8 }}>{t('conditionLab.enterScore', 'Enter final score')}</label>
            <input type="number" value={stressed} onChange={(e) => setStressed(e.target.value)} placeholder="0"
              style={{ width: '100%', marginTop: '4px', padding: '8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.3)', color: '#fff', boxSizing: 'border-box' }} />
          </div>
        </div>

        {/* Comparison */}
        {haveBoth && (
          <div style={{ background: 'rgba(10,14,22,0.6)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
            <h3 style={{ marginTop: 0 }}>{t('conditionLab.comparison', 'Comparison')}</h3>
            <svg viewBox="0 0 360 160" width="100%" style={{ maxWidth: '420px' }}>
              {[{ label: t('conditionLab.baseline', 'Baseline (quiet)'), v: b, color: '#9ae6b4', x: 70 },
                { label: t('conditionLab.stressed', 'Stressed (noise)'), v: s, color: '#fc8181', x: 230 }].map((d) => {
                const h = (d.v / maxScore) * 110;
                const y = 130 - h;
                return (
                  <g key={d.label}>
                    <rect x={d.x - 40} y={y} width="80" height={h} rx="5" fill={d.color} />
                    <text x={d.x} y={y - 6} fontSize="14" fontWeight="bold" textAnchor="middle" fill="#e6edf3">{Math.round(d.v)}</text>
                    <text x={d.x} y={148} fontSize="11" textAnchor="middle" fill="rgba(255,255,255,0.8)">{d.label}</text>
                  </g>
                );
              })}
            </svg>
            {deltaPct !== null && (
              <p style={{ fontSize: '15px', marginBottom: 0 }}>
                {deltaPct < 0
                  ? t('conditionLab.dropped', 'Performance dropped {{pct}}% under noise.', { pct: Math.abs(deltaPct) })
                  : t('conditionLab.held', 'Performance held up ({{pct}}% change) under noise.', { pct: deltaPct })}
              </p>
            )}
          </div>
        )}

        <div style={{ marginTop: '18px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <button onClick={() => navigate('/')} style={{ padding: '8px 16px', background: '#1f6feb', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
            {t('common.back', 'Back')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConditionLab;
