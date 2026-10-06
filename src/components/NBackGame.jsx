import React, { useState, useCallback, useEffect } from 'react';
import NBackTest from './NBackTest';
import BackgroundService from '../services/BackgroundService';
import { useTranslation } from 'react-i18next';

const NBackGame = ({ onReturn }) => {
  const { t } = useTranslation();
  const [gameResults, setGameResults] = useState(null);
  const [isConfigScreen, setIsConfigScreen] = useState(true);

  // Configuration options
  const [nValue, setNValue] = useState(2);
  const [trials, setTrials] = useState(20);
  const [dim1Targets, setDim1Targets] = useState(4);
  const [dim2Targets, setDim2Targets] = useState(4);
  const [bothTargets, setBothTargets] = useState(2);
  const [tickTime, setTickTime] = useState(3000);
  const [audioEnabled, setAudioEnabled] = useState(true);

  // Apply background on component mount to ensure consistency with main app
  useEffect(() => {
    console.log('NBackGame: Initializing game component');
    const currentBackground = BackgroundService.getCurrentBackground();
    const style = BackgroundService.getBackgroundStyle(currentBackground);
    document.body.style.backgroundImage = style.backgroundImage || 'none';
    document.body.style.backgroundColor = style.backgroundColor || '';
    document.body.style.backgroundSize = style.backgroundSize || '';
    document.body.style.backgroundPosition = style.backgroundPosition || '';
    document.body.style.backgroundRepeat = style.backgroundRepeat || '';

    return () => {
      console.log('NBackGame: Component unmounting');
    };
  }, []);

  const handleReturnToMenu = useCallback(() => {
    console.log('NBackGame: Returning to main menu');
    if (onReturn) {
      onReturn(gameResults);
    }
  }, [onReturn, gameResults]);

  // Add keyboard shortcut (Ctrl+Q) to exit to main menu
  useEffect(() => {
    console.log('NBackGame: Setting up keyboard shortcuts');
    const handleKeyDown = (e) => {
      // Ctrl+Q to exit to main menu
      if (e.ctrlKey && e.key === 'q') {
        console.log('NBackGame: Ctrl+Q detected, returning to main menu');
        e.preventDefault();
        handleReturnToMenu();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleReturnToMenu]);

  const handleGameFinished = useCallback((results) => {
    console.log('NBackGame: Game finished with results:', results);
    setGameResults(results);
  }, []);

  const handleStartCustomGame = useCallback(() => {
    console.log('NBackGame: Starting custom game with settings:', {
      nValue,
      trials,
      dim1Targets,
      dim2Targets,
      bothTargets,
      tickTime,
      audioEnabled
    });
    setIsConfigScreen(false);
  }, [nValue, trials, dim1Targets, dim2Targets, bothTargets, tickTime, audioEnabled]);

  const handleReturnToConfig = useCallback(() => {
    console.log('NBackGame: Returning to configuration screen');
    setGameResults(null);
    setIsConfigScreen(true);
  }, []);

  // Calculate max possible targets based on trials and n
  const maxPossibleTargets = Math.max(0, trials - nValue);

  // Ensure dim1Targets + dim2Targets + bothTargets doesn't exceed maxPossibleTargets
  useEffect(() => {
    const totalTargets = dim1Targets + dim2Targets + bothTargets;
    if (totalTargets > maxPossibleTargets) {
      // Reduce the targets proportionally
      const reductionFactor = maxPossibleTargets / totalTargets;
      setDim1Targets(Math.floor(dim1Targets * reductionFactor));
      setDim2Targets(Math.floor(dim2Targets * reductionFactor));
      setBothTargets(Math.floor(bothTargets * reductionFactor));
    }
  }, [nValue, trials, dim1Targets, dim2Targets, bothTargets, maxPossibleTargets]);

  // Configuration screen
  if (isConfigScreen) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        padding: '20px',
        textAlign: 'center',
        backgroundColor: 'rgba(26, 42, 58, 0.85)', // Semi-transparent background to match main app
        color: 'white',
        fontFamily: 'Arial, sans-serif'
      }}>
        <div style={{
          background: 'rgba(0,0,0,0.7)',
          padding: '40px',
          borderRadius: '10px',
          maxWidth: '500px',
          width: '80%'
        }}>
          <h1>{t('nbackTest.configTitle', 'N-Back Test Configuration')}</h1>

          <div style={{ width: '100%', maxWidth: '500px', margin: '20px 0' }}>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                {t('nbackTest.nValue', 'N Value')}:
              </label>
              <input
                type="range"
                min="1"
                max="4"
                step="1"
                value={nValue}
                onChange={(e) => setNValue(parseInt(e.target.value))}
                style={{ width: '100%' }}
              />
              <span>{nValue}</span>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                {t('nbackTest.trialCountLabel', 'Number of trials')}:
              </label>
              <input
                type="range"
                min="10"
                max="40"
                step="5"
                value={trials}
                onChange={(e) => setTrials(parseInt(e.target.value))}
                style={{ width: '100%' }}
              />
              <span>{trials} {t('nbackTest.trials', 'trials')}</span>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                {t('nbackTest.letterTargets', 'Letter Targets')}:
              </label>
              <input
                type="range"
                min="1"
                max={Math.max(1, Math.floor(maxPossibleTargets / 2))}
                step="1"
                value={dim1Targets}
                onChange={(e) => setDim1Targets(parseInt(e.target.value))}
                style={{ width: '100%' }}
              />
              <span>{dim1Targets}</span>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                {t('nbackTest.positionTargets', 'Position Targets')}:
              </label>
              <input
                type="range"
                min="1"
                max={Math.max(1, Math.floor(maxPossibleTargets / 2))}
                step="1"
                value={dim2Targets}
                onChange={(e) => setDim2Targets(parseInt(e.target.value))}
                style={{ width: '100%' }}
              />
              <span>{dim2Targets}</span>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                {t('nbackTest.bothTargets', 'Dual Targets')}:
              </label>
              <input
                type="range"
                min="0"
                max={Math.max(0, maxPossibleTargets - dim1Targets - dim2Targets)}
                step="1"
                value={bothTargets}
                onChange={(e) => setBothTargets(parseInt(e.target.value))}
                style={{ width: '100%' }}
              />
              <span>{bothTargets}</span>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                {t('nbackTest.stimulusTime', 'Time per Stimulus (seconds)')}:
              </label>
              <input
                type="range"
                min="1.5"
                max="5"
                step="0.5"
                value={tickTime / 1000}
                onChange={(e) => setTickTime(parseFloat(e.target.value) * 1000)}
                style={{ width: '100%' }}
              />
              <span>{(tickTime / 1000).toFixed(1)} {t('common.seconds', 'seconds')}</span>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                <input
                  type="checkbox"
                  checked={audioEnabled}
                  onChange={(e) => setAudioEnabled(e.target.checked)}
                  style={{ marginRight: '10px' }}
                />
                {t('nbackTest.audioEnabled', 'Audio Enabled')}
              </label>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'center' }}>
            <button
              onClick={handleStartCustomGame}
              style={{
                backgroundColor: '#4CAF50',
                color: 'white',
                padding: '10px 20px',
                fontSize: '16px',
                cursor: 'pointer',
                border: 'none',
                borderRadius: '4px'
              }}
            >
              {t('nbackTest.startTest', 'Start Test')}
            </button>

            <button
              onClick={handleReturnToMenu}
              style={{
                backgroundColor: '#6c757d',
                color: 'white',
                padding: '10px 20px',
                fontSize: '16px',
                cursor: 'pointer',
                border: 'none',
                borderRadius: '4px'
              }}
            >
              {t('common.returnToMenu', 'Return to Main Menu')}
            </button>
          </div>

          <div style={{ marginTop: '30px', fontSize: '14px', opacity: 0.7 }}>
            <p>{t('nbackTest.pressCtrlQToReturn', 'Press Ctrl+Q to return to the main menu at any time')}</p>
          </div>
        </div>
      </div>
    );
  }

  // Render the actual game
  return (
    <NBackTest
      n={nValue}
      trials={trials}
      dim1targets={dim1Targets}
      dim2targets={dim2Targets}
      bothTargets={bothTargets}
      tickTime={tickTime}
      audioEnabled={audioEnabled}
      onFinish={handleGameFinished}
      onReturn={handleReturnToConfig}
    />
  );
};

export default NBackGame; 