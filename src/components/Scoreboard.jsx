import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import ScoreboardService from '../services/ScoreboardService';

const Scoreboard = ({ mode, onClose }) => {
  const { t, i18n } = useTranslation();
  const [scores, setScores] = useState([]);
  const [selectedMode, setSelectedMode] = useState(mode || 'normal');

  // Load scores on mount and when mode changes
  useEffect(() => {
    const loadedScores = ScoreboardService.getScores(selectedMode);
    setScores(loadedScores);
  }, [selectedMode]);

  // Format scores for display
  const formatScore = (score, mode) => {
    if (mode === 'infinite') {
      // Format as minutes:seconds
      const minutes = Math.floor(score / 60);
      const seconds = score % 60;
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    } else if (mode === 'reaction') {
      // For reaction test, show in milliseconds
      return `${Number(score).toFixed(0)} ms`;
    } else if (mode === 'nback') {
      // For n-back test, show as performance score (d-prime)
      // Ensure score is a number before using toFixed
      const numericScore = typeof score === 'number' ? score : parseFloat(score || 0);
      if (isNaN(numericScore)) return '0.0';
      return `${numericScore.toFixed(1)}`;
    }
    // Normal mode - just show the number
    return Math.floor(score).toLocaleString(i18n.language);
  };

  // Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat(i18n.language, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  };

  return (
    <div style={{
      backgroundColor: 'rgba(0, 0, 0, 0.85)',
      color: 'white',
      width: '100%',
      height: '100%',
      position: 'fixed',
      top: 0,
      left: 0,
      zIndex: 2000,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '20px',
      boxSizing: 'border-box',
      pointerEvents: 'auto'
    }}>
      <div style={{
        backgroundColor: '#1a2a3a',
        borderRadius: '10px',
        padding: '20px',
        width: '100%',
        maxWidth: '600px',
        maxHeight: '90vh',
        overflow: 'auto',
        boxShadow: '0 0 20px rgba(0, 0, 0, 0.5)',
        pointerEvents: 'auto'
      }}>
        <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>{t('scoreboard.title')}</h2>

        {/* Mode selector */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          marginBottom: '20px',
          gap: '10px'
        }}>
          <button
            onClick={() => setSelectedMode('normal')}
            style={{
              padding: '8px 16px',
              backgroundColor: selectedMode === 'normal' ? '#007bff' : '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              pointerEvents: 'auto'
            }}
          >
            {t('mainMenu.normalMode')}
          </button>
          <button
            onClick={() => setSelectedMode('infinite')}
            style={{
              padding: '8px 16px',
              backgroundColor: selectedMode === 'infinite' ? '#007bff' : '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              pointerEvents: 'auto'
            }}
          >
            {t('mainMenu.infiniteMode')}
          </button>
          <button
            onClick={() => setSelectedMode('reaction')}
            style={{
              padding: '8px 16px',
              backgroundColor: selectedMode === 'reaction' ? '#007bff' : '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              pointerEvents: 'auto'
            }}
          >
            {t('reactionTest.title', 'Reaction Test')}
          </button>
          <button
            onClick={() => setSelectedMode('nback')}
            style={{
              padding: '8px 16px',
              backgroundColor: selectedMode === 'nback' ? '#007bff' : '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              pointerEvents: 'auto'
            }}
          >
            {t('nbackTest.title', 'N-Back Test')}
          </button>
        </div>

        {/* Scores table */}
        <div style={{ marginBottom: '20px' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            color: 'white',
            tableLayout: 'fixed'
          }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.2)' }}>
                <th style={{ padding: '10px', textAlign: 'center', width: '10%' }}>#</th>
                <th style={{ padding: '10px', textAlign: 'left', width: '40%' }}>{t('scoreboard.playerName')}</th>
                <th style={{ padding: '10px', textAlign: 'right', width: '25%' }}>
                  {selectedMode === 'infinite' ? t('scoreboard.time') :
                    selectedMode === 'reaction' ? t('reactionTest.averageTime', 'Average Time') :
                      selectedMode === 'nback' ? t('nbackTest.performanceScore') :
                        t('scoreboard.score')}
                </th>
                <th style={{ padding: '10px', textAlign: 'right', width: '25%' }}>{t('scoreboard.date')}</th>
              </tr>
            </thead>
            <tbody>
              {scores.length > 0 ? (
                scores.map((score, index) => (
                  <tr
                    key={index}
                    style={{
                      backgroundColor: index % 2 === 0 ? 'rgba(0, 0, 0, 0.2)' : 'transparent',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
                    }}
                  >
                    <td style={{ padding: '8px', textAlign: 'center' }}>{index + 1}</td>
                    <td style={{ padding: '8px', textAlign: 'left' }}>{score.name || t('scoreboard.anonymous')}</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>
                      {formatScore(score.score, selectedMode)}
                      {selectedMode === 'nback' ? '%' : ''}
                      {selectedMode === 'reaction' && score.stimuliCount &&
                        ` (${score.stimuliCount} ${t('reactionTest.stimuli', 'stimuli')})`}
                      {selectedMode === 'nback' && score.nValue &&
                        ` (${score.nValue}-back)`}
                    </td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>
                      {formatDate(score.date)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" style={{ padding: '20px', textAlign: 'center' }}>
                    {t('scoreboard.noScores')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Close button */}
        <div style={{ textAlign: 'center' }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              pointerEvents: 'auto'
            }}
          >
            {t('common.back')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Scoreboard; 