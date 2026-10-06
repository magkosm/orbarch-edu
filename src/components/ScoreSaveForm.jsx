import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import ScoreboardService from '../services/ScoreboardService';

const ScoreSaveForm = ({ score, mode, onSaved, onSkip }) => {
  const { t, i18n } = useTranslation();
  const [playerName, setPlayerName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const inputRef = useRef(null);
  
  // Focus the input field when component mounts
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);
  
  // Format score for display
  const formatScore = (scoreValue, gameMode) => {
    if (gameMode === 'infinite') {
      // Format as minutes:seconds
      const minutes = Math.floor(scoreValue / 60);
      const seconds = scoreValue % 60;
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
    // Normal mode - just show the number
    return Math.floor(scoreValue).toLocaleString(i18n.language);
  };
  
  const handleSubmit = (e) => {
    e.preventDefault();
    setIsSaving(true);
    
    const success = ScoreboardService.saveScore(mode, score, playerName);
    
    setIsSaving(false);
    setSaveSuccess(success);
    
    // Call the onSaved callback after a short delay
    setTimeout(() => {
      onSaved();
    }, 1000);
  };
  
  return (
    <div style={{
      padding: '20px',
      backgroundColor: '#1a2a3a',
      borderRadius: '10px',
      marginBottom: '20px',
      color: 'white',
      pointerEvents: 'auto'
    }}>
      <h3 style={{ textAlign: 'center', marginBottom: '15px' }}>{t('scoreboard.newHighScore', 'New High Score!')}</h3>
      
      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <div>{t('scoreboard.yourScore', 'Your score')}: <strong>{formatScore(score, mode)}</strong></div>
        <div style={{ fontSize: '0.8em', opacity: 0.7, marginTop: '5px' }}>
          {mode === 'infinite' ? t('scoreboard.timeSurvived', 'Time Survived') : t('scoreboard.finalScore', 'Final Score')}
        </div>
      </div>
      
      {!saveSuccess ? (
        <form onSubmit={handleSubmit} style={{ pointerEvents: 'auto' }}>
          <div style={{ marginBottom: '15px' }}>
            <label 
              htmlFor="playerName" 
              style={{ display: 'block', marginBottom: '5px' }}
            >
              {t('scoreboard.enterName', 'Enter your name:')}
            </label>
            <input
              ref={inputRef}
              id="playerName"
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder={t('scoreboard.yourName', 'Your Name')}
              style={{
                width: '100%',
                padding: '8px',
                backgroundColor: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: '4px',
                color: 'white',
                fontSize: '16px',
                pointerEvents: 'auto'
              }}
              maxLength={20}
              disabled={isSaving}
            />
          </div>
          
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between',
            gap: '10px'
          }}>
            <button
              type="button"
              onClick={onSkip}
              style={{
                padding: '8px 16px',
                backgroundColor: 'transparent',
                color: 'white',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: '4px',
                cursor: 'pointer',
                flex: 1,
                pointerEvents: 'auto'
              }}
              disabled={isSaving}
            >
              {t('common.skip', 'Skip')}
            </button>
            <button
              type="submit"
              style={{
                padding: '8px 16px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                flex: 2,
                pointerEvents: 'auto'
              }}
              disabled={isSaving}
            >
              {isSaving ? t('common.saving', 'Saving...') : t('scoreboard.saveScore', 'Save Score')}
            </button>
          </div>
        </form>
      ) : (
        <div style={{ 
          padding: '15px', 
          backgroundColor: 'rgba(40, 167, 69, 0.2)', 
          borderRadius: '5px',
          textAlign: 'center'
        }}>
          {t('scoreboard.scoreSaved', 'Score saved successfully!')}
        </div>
      )}
    </div>
  );
};

export default ScoreSaveForm; 