import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import Scoreboard from './Scoreboard';
import ScoreboardService from '../services/ScoreboardService';
import BackgroundSelector from './BackgroundSelector';
import BackgroundService from '../services/BackgroundService';
import CustomModeSetup from './CustomModeSetup';
import { useTranslation } from 'react-i18next';
import LanguageSelector from './LanguageSelector';

const MainMenu = ({ onStartGame, onExitApp, gameResults }) => {
  const { t } = useTranslation();
  const [selectedMode, setSelectedMode] = useState('normal'); // Normal is now default
  const [gameDuration] = useState(5 * 60 * 1000); // 5 minutes default
  const [showScoreboard, setShowScoreboard] = useState(false);
  const [showOtherModes, setShowOtherModes] = useState(false);
  const [showBackgroundSelector, setShowBackgroundSelector] = useState(false);
  const [showPresetsModal, setShowPresetsModal] = useState(false);
  const [showCustomModeSetup, setShowCustomModeSetup] = useState(false);
  // We're tracking pressed keys for the hidden clear scoreboard feature
  const [, setKeysPressed] = useState(new Set());
  const [currentBackground] = useState(BackgroundService.getCurrentBackground());

  // Apply background on component mount
  useEffect(() => {
    const style = BackgroundService.getBackgroundStyle(currentBackground);
    document.body.style.backgroundImage = style.backgroundImage || 'none';
    document.body.style.backgroundColor = style.backgroundColor || '';
    document.body.style.backgroundSize = style.backgroundSize || '';
    document.body.style.backgroundPosition = style.backgroundPosition || '';
    document.body.style.backgroundRepeat = style.backgroundRepeat || '';
  }, [currentBackground]);

  // Handle the combo key press detector for the hidden clear scoreboard feature
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Add the key to the set of pressed keys
      setKeysPressed(prev => {
        const updated = new Set(prev);
        updated.add(e.key);

        // Check if the combination is pressed (Shift + S + Q)
        if (
          updated.has('Shift') &&
          updated.has('s') &&
          updated.has('q')
        ) {
          // Clear all scores
          const cleared = ScoreboardService.clearScores();
          if (cleared) {
            alert('All score records have been cleared.');
          }

          // Reset the key tracking
          return new Set();
        }

        return updated;
      });
    };

    const handleKeyUp = (e) => {
      // Remove the key from the set of pressed keys
      setKeysPressed(prev => {
        const updated = new Set(prev);
        updated.delete(e.key);
        return updated;
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const handleStartGame = () => {
    if (selectedMode === 'custom') {
      setShowCustomModeSetup(true);
    } else {
      onStartGame({
        mode: selectedMode,
        duration: gameDuration
      });
    }
  };

  const handleCustomModeStart = (customSettings) => {
    setShowCustomModeSetup(false);
    onStartGame({
      mode: 'custom',
      duration: customSettings.duration,
      taskConfig: customSettings.taskConfig
    });
  };

  // Handler for reaction time test button
  const handleStartReactionTest = () => {
    window.location.href = `${process.env.PUBLIC_URL}/reaction`;
  };

  // Handler for n-back test button
  const handleStartNbackTest = () => {
    window.location.href = `${process.env.PUBLIC_URL}/nback`;
  };

  // Create Other Game Modes Modal Component
  const OtherGameModesModal = () => (
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
        maxWidth: '500px',
        maxHeight: '90vh',
        overflow: 'auto',
        boxShadow: '0 0 20px rgba(0, 0, 0, 0.5)',
        pointerEvents: 'auto'
      }}>
        <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>{t('mainMenu.otherModes')}</h2>

        <div style={{ marginBottom: '20px' }}>
          <div style={{
            padding: '15px',
            backgroundColor: 'rgba(0,0,0,0.2)',
            marginTop: '10px',
            marginBottom: '15px',
            borderRadius: '4px'
          }}>
            <label style={{
              marginBottom: '10px',
              display: 'flex',
              alignItems: 'center',
              padding: '8px',
              borderRadius: '4px',
              backgroundColor: selectedMode === 'testing' ? 'rgba(0, 123, 255, 0.2)' : 'transparent'
            }}>
              <input
                type="radio"
                name="gameMode"
                value="testing"
                checked={selectedMode === 'testing'}
                onChange={() => setSelectedMode('testing')}
                style={{ marginRight: '10px' }}
              />
              {t('mainMenu.testingMode')}
            </label>

            <label style={{
              marginBottom: '10px',
              display: 'flex',
              alignItems: 'center',
              padding: '8px',
              borderRadius: '4px',
              backgroundColor: selectedMode === 'infinite' ? 'rgba(0, 123, 255, 0.2)' : 'transparent'
            }}>
              <input
                type="radio"
                name="gameMode"
                value="infinite"
                checked={selectedMode === 'infinite'}
                onChange={() => setSelectedMode('infinite')}
                style={{ marginRight: '10px' }}
              />
              {t('mainMenu.infiniteMode')}
            </label>

            <label style={{
              display: 'flex',
              alignItems: 'center',
              padding: '8px',
              borderRadius: '4px',
              backgroundColor: selectedMode === 'custom' ? 'rgba(0, 123, 255, 0.2)' : 'transparent'
            }}>
              <input
                type="radio"
                name="gameMode"
                value="custom"
                checked={selectedMode === 'custom'}
                onChange={() => setSelectedMode('custom')}
                style={{ marginRight: '10px' }}
              />
              {t('mainMenu.customMode')}
            </label>
          </div>

          {selectedMode === 'infinite' && (
            <div style={{ padding: '10px', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: '5px' }}>
              <p style={{ margin: 0, textAlign: 'left' }}>
                {t('mainMenu.infiniteDesc')}
              </p>
            </div>
          )}

          {selectedMode === 'testing' && (
            <div style={{ padding: '10px', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: '5px' }}>
              <p style={{ margin: 0, textAlign: 'left' }}>
                {t('mainMenu.testingDesc')}
              </p>
            </div>
          )}

          {selectedMode === 'custom' && (
            <div style={{ padding: '10px', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: '5px' }}>
              <p style={{ margin: 0, textAlign: 'left' }}>
                {t('customMode.intro')}
              </p>
            </div>
          )}
        </div>

        <div style={{ textAlign: 'center', display: 'flex', justifyContent: 'center', gap: '15px' }}>
          <button
            onClick={() => setShowOtherModes(false)}
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
            {t('common.cancel')}
          </button>

          <button
            onClick={() => {
              setShowOtherModes(false);
              handleStartGame();
            }}
            style={{
              padding: '10px 20px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              pointerEvents: 'auto'
            }}
          >
            {selectedMode === 'custom' ? t('customMode.setup') : t('common.start')}
          </button>
        </div>
      </div>
    </div>
  );

  // Create Presets Modal Component
  const PresetsModal = () => (
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
        maxWidth: '500px',
        maxHeight: '90vh',
        overflow: 'auto',
        boxShadow: '0 0 20px rgba(0, 0, 0, 0.5)',
        pointerEvents: 'auto',
        textAlign: 'center'
      }}>
        <h2 style={{ marginBottom: '20px' }}>{t('mainMenu.presets', 'Presets')}</h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '20px' }}>
          <button
            onClick={() => {
              onStartGame({ mode: 'normal', duration: 2 * 60 * 1000 });
              setShowPresetsModal(false);
            }}
            style={{
              padding: '15px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '16px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center'
            }}
          >
            <span style={{ fontWeight: 'bold' }}>{t('mainMenu.2minTest', '2-Minute Test')}</span>
          </button>

          <button
            onClick={() => {
              onStartGame({ mode: 'normal', duration: 5 * 60 * 1000 });
              setShowPresetsModal(false);
            }}
            style={{
              padding: '15px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '16px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center'
            }}
          >
            <span style={{ fontWeight: 'bold' }}>{t('mainMenu.5minRun', '5-Minute Run')}</span>
          </button>

          <button
            onClick={() => {
              onStartGame({ mode: 'normal', duration: 10 * 60 * 1000 });
              setShowPresetsModal(false);
            }}
            style={{
              padding: '15px',
              backgroundColor: '#17a2b8',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '16px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center'
            }}
          >
            <span style={{ fontWeight: 'bold' }}>{t('mainMenu.standardRun', 'Standard 10-Minute Run')}</span>
          </button>

          <h3 style={{ margin: '10px 0 5px 0' }}>{t('mainMenu.trainingPresets', 'Training Modes')}</h3>

          {/* Communications Training */}
          <button
            onClick={() => {
              onStartGame({
                mode: 'custom',
                duration: 3 * 60 * 1000,
                taskConfig: {
                  instructionKey: 'comm',
                  instructionTitle: t('instructionsOverlay.commTitle'),
                  instructionContent: t('instructionsOverlay.comm'),
                  comm: { isActive: true, difficulty: 6, eventsPerMinute: 6 }, // Higher difficulty and explicitly enabled events
                  monitoring: { isActive: false, difficulty: 1, eventsPerMinute: 0 },
                  tracking: { isActive: false, difficulty: 1, eventsPerMinute: 0 },
                  resource: { isActive: false, difficulty: 1, eventsPerMinute: 0 }
                }
              });
              setShowPresetsModal(false);
            }}
            style={{
              padding: '12px',
              backgroundColor: '#17a2b8',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '14px',
              textAlign: 'center'
            }}
          >
            <strong>{t('training.commOnly')}</strong>
            <div style={{ fontSize: '10px', marginTop: '3px' }}>{t('training.commOnlyDesc')}</div>
          </button>

          {/* Tracking Training */}
          <button
            onClick={() => {
              onStartGame({
                mode: 'custom',
                duration: 3 * 60 * 1000,
                taskConfig: {
                  instructionKey: 'track',
                  instructionTitle: t('instructionsOverlay.trackTitle'),
                  instructionContent: t('instructionsOverlay.track'),
                  comm: { isActive: false, difficulty: 1, eventsPerMinute: 0 },
                  monitoring: { isActive: false, difficulty: 1, eventsPerMinute: 0 },
                  tracking: { isActive: true, difficulty: 6, eventsPerMinute: 6 },
                  resource: { isActive: false, difficulty: 1, eventsPerMinute: 0 }
                }
              });
              setShowPresetsModal(false);
            }}
            style={{
              padding: '12px',
              backgroundColor: '#17a2b8',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '14px',
              textAlign: 'center'
            }}
          >
            <strong>{t('training.trackingOnly')}</strong>
            <div style={{ fontSize: '10px', marginTop: '3px' }}>{t('training.trackingOnlyDesc')}</div>
          </button>

          {/* Monitoring Training */}
          <button
            onClick={() => {
              onStartGame({
                mode: 'custom',
                duration: 3 * 60 * 1000,
                taskConfig: {
                  instructionKey: 'sysMon',
                  instructionTitle: t('instructionsOverlay.sysMonTitle'),
                  instructionContent: t('instructionsOverlay.sysMon'),
                  comm: { isActive: false, difficulty: 1, eventsPerMinute: 0 },
                  monitoring: { isActive: true, difficulty: 6, eventsPerMinute: 6 },
                  tracking: { isActive: false, difficulty: 1, eventsPerMinute: 0 },
                  resource: { isActive: false, difficulty: 1, eventsPerMinute: 0 }
                }
              });
              setShowPresetsModal(false);
            }}
            style={{
              padding: '12px',
              backgroundColor: '#17a2b8',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '14px',
              textAlign: 'center'
            }}
          >
            <strong>{t('training.monitoringOnly')}</strong>
            <div style={{ fontSize: '10px', marginTop: '3px' }}>{t('training.monitoringOnlyDesc')}</div>
          </button>

          {/* Resource Management Training */}
          <button
            onClick={() => {
              onStartGame({
                mode: 'custom',
                duration: 3 * 60 * 1000,
                taskConfig: {
                  instructionKey: 'resMan',
                  instructionTitle: t('instructionsOverlay.resManTitle'),
                  instructionContent: t('instructionsOverlay.resMan'),
                  comm: { isActive: false, difficulty: 1, eventsPerMinute: 0 },
                  monitoring: { isActive: false, difficulty: 1, eventsPerMinute: 0 },
                  tracking: { isActive: false, difficulty: 1, eventsPerMinute: 0 },
                  resource: { isActive: true, difficulty: 6, eventsPerMinute: 6 }
                }
              });
              setShowPresetsModal(false);
            }}
            style={{
              padding: '12px',
              backgroundColor: '#17a2b8',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '14px',
              textAlign: 'center'
            }}
          >
            <strong>{t('training.resourceOnly')}</strong>
            <div style={{ fontSize: '10px', marginTop: '3px' }}>{t('training.resourceOnlyDesc')}</div>
          </button>

          <h3 style={{ margin: '15px 0 5px 0' }}>{t('mainMenu.cognitiveTests', 'Cognitive Tests')}</h3>

          {/* Reaction Time Test */}
          <div style={{ display: 'flex', gap: '5px' }}>
            <button
              onClick={handleStartReactionTest}
              style={{
                padding: '12px',
                backgroundColor: '#9c27b0',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                fontSize: '14px',
                flex: 1
              }}
            >
              <strong>{t('reactionTest.title')}</strong>
              <div style={{ fontSize: '10px', marginTop: '3px' }}>{t('training.reactionOnlyDesc')}</div>
            </button>
            <button
              onClick={() => window.location.href = `${process.env.PUBLIC_URL}/reaction-default`}
              style={{
                padding: '12px',
                backgroundColor: '#7B1FA2',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                fontSize: '14px',
                minWidth: '100px'
              }}
            >
              {t('reactionTest.quickStart')}
            </button>
          </div>

          {/* N-Back Test */}
          <div style={{ display: 'flex', gap: '5px' }}>
            <button
              onClick={handleStartNbackTest}
              style={{
                padding: '12px',
                backgroundColor: '#FF9800',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                fontSize: '14px',
                flex: 1
              }}
            >
              <strong>{t('nbackTest.title')}</strong>
              <div style={{ fontSize: '10px', marginTop: '3px' }}>{t('training.nbackOnlyDesc')}</div>
            </button>
            <button
              onClick={() => window.location.href = `${process.env.PUBLIC_URL}/nbackdefault`}
              style={{
                padding: '12px',
                backgroundColor: '#F57C00',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                fontSize: '14px',
                minWidth: '100px'
              }}
            >
              {t('nbackTest.quickStart')}
            </button>
          </div>
        </div>

        <button
          onClick={() => setShowPresetsModal(false)}
          style={{
            padding: '10px 20px',
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          {t('common.close', 'Close')}
        </button>
      </div>
    </div>
  );

  // Create Background Selector Modal Component
  const BackgroundSelectorModal = () => (
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
        maxWidth: '500px',
        maxHeight: '90vh',
        overflow: 'auto',
        boxShadow: '0 0 20px rgba(0, 0, 0, 0.5)',
        pointerEvents: 'auto'
      }}>
        <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>{t('backgroundSelector.title')}</h2>

        <BackgroundSelector onClose={() => setShowBackgroundSelector(false)} />
      </div>
    </div>
  );

  return (
    <div
      style={{
        width: '100%',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(26, 42, 58, 0.85)', // Semi-transparent background
        color: 'white',
        fontFamily: 'Arial, sans-serif',
        padding: '20px',
        boxSizing: 'border-box'
      }}
    >
      <div
        style={{
          background: 'rgba(0,0,0,0.7)',
          padding: '40px',
          borderRadius: '10px',
          textAlign: 'center',
          maxWidth: '500px',
          width: '80%',
          maxHeight: '90vh',
          overflowY: 'auto'
        }}
      >
        <h1 style={{ fontSize: '36px', marginBottom: '20px' }}>{t('mainMenu.title')}</h1>
        <p style={{ fontSize: '16px', marginBottom: '30px' }}>
          {t('mainMenu.subtitle')}
        </p>

        <LanguageSelector />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {/* Main Quick Access Buttons */}
          <button
            onClick={() => onStartGame({ mode: 'normal', duration: 2 * 60 * 1000 })}
            style={{
              padding: '15px 30px',
              fontSize: '18px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              transition: 'background-color 0.3s',
              width: '100%'
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = '#0069d9'}
            onMouseOut={(e) => e.target.style.backgroundColor = '#007bff'}
          >
            {t('mainMenu.quickMATB', 'Quick MATB Test')}
          </button>

          <button
            onClick={() => window.location.href = `${process.env.PUBLIC_URL}/reaction-default`}
            style={{
              padding: '15px 30px',
              fontSize: '18px',
              backgroundColor: '#9c27b0',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              transition: 'background-color 0.3s',
              width: '100%'
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = '#7B1FA2'}
            onMouseOut={(e) => e.target.style.backgroundColor = '#9c27b0'}
          >
            {t('reactionTest.quickStart', 'Quick Reaction Time')}
          </button>

          <button
            onClick={() => window.location.href = `${process.env.PUBLIC_URL}/nbackdefault`}
            style={{
              padding: '15px 30px',
              fontSize: '18px',
              backgroundColor: '#FF9800',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              transition: 'background-color 0.3s',
              width: '100%'
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = '#F57C00'}
            onMouseOut={(e) => e.target.style.backgroundColor = '#FF9800'}
          >
            {t('nbackTest.quickStart', 'Quick 2-Back')}
          </button>
        </div>

        {/* Secondary Options */}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap', marginTop: '20px' }}>
          <button
            onClick={() => setShowPresetsModal(true)}
            style={{
              padding: '10px 20px',
              fontSize: '16px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              transition: 'background-color 0.3s',
              flex: 1,
              minWidth: '120px'
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = '#5a6268'}
            onMouseOut={(e) => e.target.style.backgroundColor = '#6c757d'}
          >
            {t('mainMenu.presets', 'Presets & Training')}
          </button>

          <button
            onClick={() => setShowOtherModes(true)}
            style={{
              padding: '10px 20px',
              fontSize: '16px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              transition: 'background-color 0.3s',
              flex: 1,
              minWidth: '120px'
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = '#5a6268'}
            onMouseOut={(e) => e.target.style.backgroundColor = '#6c757d'}
          >
            {t('mainMenu.customMode', 'Custom Mode')}
          </button>
        </div>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap', marginTop: '10px' }}>
          <button
            onClick={() => setShowScoreboard(true)}
            style={{
              padding: '10px 20px',
              fontSize: '16px',
              backgroundColor: '#17a2b8',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              transition: 'background-color 0.3s',
              flex: 1,
              minWidth: '120px'
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = '#138496'}
            onMouseOut={(e) => e.target.style.backgroundColor = '#17a2b8'}
          >
            {t('mainMenu.scoreboard', 'Scoreboard')}
          </button>

          <button
            onClick={() => setShowBackgroundSelector(true)}
            style={{
              padding: '10px 20px',
              fontSize: '16px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              transition: 'background-color 0.3s',
              flex: 1,
              minWidth: '120px'
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = '#218838'}
            onMouseOut={(e) => e.target.style.backgroundColor = '#28a745'}
          >
            {t('mainMenu.changeBackground', 'Background')}
          </button>
        </div>

        <div style={{ marginTop: '20px' }}>
          <button
            onClick={onExitApp}
            style={{
              padding: '10px 20px',
              fontSize: '16px',
              backgroundColor: 'transparent',
              color: 'white',
              border: '1px solid #6c757d',
              borderRadius: '5px',
              cursor: 'pointer',
              transition: 'background-color 0.3s'
            }}
            onMouseOver={(e) => {
              e.target.style.backgroundColor = 'rgba(108, 117, 125, 0.2)';
            }}
            onMouseOut={(e) => {
              e.target.style.backgroundColor = 'transparent';
            }}
          >
            {t('common.exit')}
          </button>
        </div>
      </div>

      <div style={{ marginTop: '30px', fontSize: '14px', opacity: 0.7 }}>
        <p>{t('mainMenu.pressStartToBegin')}</p>
        <p>{t('mainMenu.pressCtrlQToReturn')}</p>
      </div>

      {/* Mini background selector at the bottom */}
      <div style={{ marginTop: '20px' }}>
        <BackgroundSelector small={true} />
      </div>

      {/* Related projects & credits footer */}
      <div
        style={{
          marginTop: '30px',
          maxWidth: '640px',
          width: '90%',
          textAlign: 'center',
          fontSize: '12px',
          opacity: 0.85,
          lineHeight: 1.6
        }}
      >
        <div style={{ marginBottom: '8px', fontWeight: 'bold', opacity: 0.9 }}>
          {t('mainMenu.relatedProjects', 'Orbital Architecture — related projects')}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '6px 14px' }}>
          {[
            { label: 'ESERO Sweden', url: 'https://www.esero.se/orbital-architecture/' },
            { label: 'KTH (EN)', url: 'https://www.kth.se/en/om/nyheter/centrala-nyheter/svensk-astronaut-deltar-i-kth-forskning-i-rymden-1.1300047' },
            { label: 'KTH (SV)', url: 'https://www.kth.se/om/nyheter/centrala-nyheter/svensk-astronaut-deltar-i-kth-forskning-i-rymden-1.1300047' },
            { label: 'KTH Ergonomics', url: 'https://www.kth.se/mth/ergonomi/forskning/architectural-properties-impact-on-stress-and-cognition-1.1302002' },
            { label: 'ESA blog', url: 'https://blogs.esa.int/exploration/i-need-more-space/' },
            { label: 'NASA ISS Research', url: 'https://www.nasa.gov/mission/station/research-explorer/investigation/?#id=9082' }
          ].map((link) => (
            <a
              key={link.url}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#8ec5ff', textDecoration: 'none' }}
            >
              {link.label}
            </a>
          ))}
        </div>
        <div style={{ marginTop: '10px', opacity: 0.7 }}>
          {t(
            'mainMenu.credits',
            'KTH Royal Institute of Technology \u00B7 ESERO Sweden \u00B7 Michail Magkos \u2014 MIT License'
          )}
        </div>
      </div>

      {gameResults && (
        <div style={{
          marginTop: '30px',
          backgroundColor: 'rgba(0,100,0,0.3)',
          padding: '15px',
          borderRadius: '5px'
        }}>
          <h3 style={{ margin: '0 0 10px 0' }}>{t('gameOver.score')}</h3>
          {gameResults.gameMode === 'infinite' ? (
            <p>{t('scoreboard.timeSurvived')}: {Math.floor(gameResults.finalScore / 60)}:{(gameResults.finalScore % 60).toString().padStart(2, '0')}</p>
          ) : (
            <p>{t('scoreboard.finalScore')}: {Math.floor(gameResults.finalScore)}</p>
          )}
        </div>
      )}
      {/* Scoreboard modal */}
      {showScoreboard &&
        ReactDOM.createPortal(
          <Scoreboard
            mode={selectedMode !== 'testing' ? selectedMode : 'normal'}
            onClose={() => setShowScoreboard(false)}
          />,
          document.body
        )}

      {/* Other Game Modes modal */}
      {showOtherModes &&
        ReactDOM.createPortal(<OtherGameModesModal />, document.body)}

      {/* Background Selector modal */}
      {showBackgroundSelector &&
        ReactDOM.createPortal(<BackgroundSelectorModal />, document.body)}

      {/* Presets modal */}
      {showPresetsModal &&
        ReactDOM.createPortal(<PresetsModal />, document.body)}

      {showCustomModeSetup && (
        <CustomModeSetup
          onSave={handleCustomModeStart}
          onCancel={() => setShowCustomModeSetup(false)}
        />
      )}
    </div>
  );
};

export default MainMenu;