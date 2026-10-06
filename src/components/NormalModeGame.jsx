import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import ScoreSaveForm from './ScoreSaveForm';
import MatbResults from './MatbResults';
import ScoreboardService from '../services/ScoreboardService';
import { downloadCSV } from '../utils/csvExport';
import InstructionOverlay from './InstructionOverlay';

const NormalModeGame = ({
  duration,
  onGameEnd,
  eventService,
  healthRef,
  logs,
  isSuite = false
}) => {
  const { t } = useTranslation();
  // Game state
  const [timeRemaining, setTimeRemaining] = useState(duration);
  const [score, setScore] = useState(0);
  const [isGameActive, setIsGameActive] = useState(true);
  const [showScoreSaveForm, setShowScoreSaveForm] = useState(false);
  // Add instruction state - bypass for suite mode
  const [showInstructions, setShowInstructions] = useState(!isSuite);
  const [finalLogs, setFinalLogs] = useState(null);

  const [currentSettings, setCurrentSettings] = useState({
    comm: { eventsPerMinute: 2.1, difficulty: 4 },
    monitoring: { eventsPerMinute: 3, difficulty: 4 },
    tracking: { eventsPerMinute: 1.5, difficulty: 4 },
    resource: { eventsPerMinute: 3, difficulty: 1 }
  });

  // Refs for timers
  const gameTimerRef = useRef(null);
  const scoreTimerRef = useRef(null);
  const epmIntervalRef = useRef(null);
  const difficultyIntervalRef = useRef(null);
  const gameStartTimeRef = useRef(null);
  const finishedRef = useRef(false); // Guard for suite transition
  const logsRef = useRef(logs);

  // Keep logsRef updated
  useEffect(() => {
    logsRef.current = logs;
  }, [logs]);

  // Initialize game - pause tasks immediately and control pause state
  useEffect(() => {
    if (showInstructions) {
      // Pause tasks while instructions are shown
      console.log('Instructions visible, pausing all tasks...');
      eventService.pauseAllTasks();

      // Set up aggressive pause enforcement
      const pauseInterval = setInterval(() => {
        eventService.pauseAllTasks();
      }, 100);

      return () => {
        clearInterval(pauseInterval);
      };
    } else {
      // Resume tasks when instructions are dismissed
      console.log('Instructions dismissed, resuming tasks NOW...');
      eventService.resumeAllTasks();

      // Double-check resume after a short delay to ensure it takes effect
      const resumeTimeout = setTimeout(() => {
        console.log('Double-checking task resume...');
        eventService.resumeAllTasks();
      }, 200);

      return () => {
        clearTimeout(resumeTimeout);
      };
    }
  }, [showInstructions, eventService]);

  // Initialize game
  useEffect(() => {
    // Wait for instructions
    if (showInstructions) return;

    // Apply initial settings to the event service
    eventService.updateSchedulerSettings({
      comm: {
        isEnabled: true,
        eventsPerMinute: currentSettings.comm.eventsPerMinute,
        difficulty: currentSettings.comm.difficulty
      },
      monitoring: {
        isEnabled: true,
        eventsPerMinute: currentSettings.monitoring.eventsPerMinute,
        difficulty: currentSettings.monitoring.difficulty
      },
      tracking: {
        isEnabled: true,
        eventsPerMinute: currentSettings.tracking.eventsPerMinute,
        difficulty: currentSettings.tracking.difficulty
      },
      resource: {
        isEnabled: true,
        eventsPerMinute: currentSettings.resource.eventsPerMinute,
        difficulty: currentSettings.resource.difficulty
      }
    });

    // Start scheduler with a delay to ensure everything is initialized
    // Wait for instructions to be dismissed
    let startTimeout;
    // Start scheduler
    if (!showInstructions) {
      if (isSuite) {
        console.log('NormalModeGame: Starting scheduler immediately for suite mode');
        eventService.startScheduler();
        eventService.resumeAllTasks();
      } else {
        startTimeout = setTimeout(() => {
          console.log('Starting scheduler after init delay...');
          eventService.startScheduler();
          eventService.resumeAllTasks();
        }, 1000);
      }
    }

    // Set start time
    if (!gameStartTimeRef.current) {
      gameStartTimeRef.current = Date.now();
    }

    // Start game timer
    if (!showInstructions) {
      gameTimerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - gameStartTimeRef.current) / 1000);
        const remaining = Math.max(0, Math.floor(duration / 1000) - elapsed);
        setTimeRemaining(remaining * 1000);

        if (remaining <= 0) {
          endGame();
        }
      }, 1000);
    }

    // Start score calculation timer (every second)
    if (!showInstructions) {
      scoreTimerRef.current = setInterval(() => {
        if (healthRef.current) {
          const currentHealth = healthRef.current;
          setScore(prevScore => prevScore + currentHealth);
        }
      }, 1000);
    }

    // Setup EPM progression (every 45 seconds) - Disabled in suite mode
    if (!showInstructions && !isSuite) {
      epmIntervalRef.current = setInterval(() => {
        setCurrentSettings(prevSettings => {
          const newSettings = {
            comm: {
              ...prevSettings.comm,
              eventsPerMinute: Math.min(10, prevSettings.comm.eventsPerMinute + 1)
            },
            monitoring: {
              ...prevSettings.monitoring,
              eventsPerMinute: Math.min(10, prevSettings.monitoring.eventsPerMinute + 1)
            },
            tracking: {
              ...prevSettings.tracking,
              eventsPerMinute: Math.min(10, prevSettings.tracking.eventsPerMinute + 1)
            },
            resource: {
              ...prevSettings.resource,
              eventsPerMinute: Math.min(10, prevSettings.resource.eventsPerMinute + 1)
            }
          };

          // Update event service with new EPM values
          eventService.updateSchedulerSettings({
            comm: {
              isEnabled: true,
              eventsPerMinute: newSettings.comm.eventsPerMinute,
              difficulty: newSettings.comm.difficulty
            },
            monitoring: {
              isEnabled: true,
              eventsPerMinute: newSettings.monitoring.eventsPerMinute,
              difficulty: newSettings.monitoring.difficulty
            },
            tracking: {
              isEnabled: true,
              eventsPerMinute: newSettings.tracking.eventsPerMinute,
              difficulty: newSettings.tracking.difficulty
            },
            resource: {
              isEnabled: true,
              eventsPerMinute: newSettings.resource.eventsPerMinute,
              difficulty: newSettings.resource.difficulty
            }
          });

          return newSettings;
        });
      }, 45000); // 45 seconds
    }

    // Setup difficulty progression (every 90 seconds)
    if (!showInstructions && !isSuite) {
      difficultyIntervalRef.current = setInterval(() => {
        setCurrentSettings(prevSettings => {
          const newSettings = {
            comm: {
              ...prevSettings.comm,
              difficulty: Math.min(10, prevSettings.comm.difficulty + 1)
            },
            monitoring: {
              ...prevSettings.monitoring,
              difficulty: Math.min(10, prevSettings.monitoring.difficulty + 1)
            },
            tracking: {
              ...prevSettings.tracking,
              difficulty: Math.min(10, prevSettings.tracking.difficulty + 1)
            },
            resource: {
              ...prevSettings.resource,
              difficulty: Math.min(10, prevSettings.resource.difficulty + 1)
            }
          };

          // Update event service with new difficulty values
          eventService.updateSchedulerSettings({
            comm: {
              isEnabled: true,
              eventsPerMinute: newSettings.comm.eventsPerMinute,
              difficulty: newSettings.comm.difficulty
            },
            monitoring: {
              isEnabled: true,
              eventsPerMinute: newSettings.monitoring.eventsPerMinute,
              difficulty: newSettings.monitoring.difficulty
            },
            tracking: {
              isEnabled: true,
              eventsPerMinute: newSettings.tracking.eventsPerMinute,
              difficulty: newSettings.tracking.difficulty
            },
            resource: {
              isEnabled: true,
              eventsPerMinute: newSettings.resource.eventsPerMinute,
              difficulty: newSettings.resource.difficulty
            }
          });

          return newSettings;
        });
      }, 90000); // 90 seconds
    }

    // Cleanup function
    return () => {
      clearTimeout(startTimeout);
      clearAllTimers();
      eventService.stopScheduler();
      eventService.pauseAllTasks();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration, eventService, healthRef, showInstructions]);

  // Helper to clear all timers
  const clearAllTimers = () => {
    if (gameTimerRef.current) clearInterval(gameTimerRef.current);
    if (scoreTimerRef.current) clearInterval(scoreTimerRef.current);
    if (epmIntervalRef.current) clearInterval(epmIntervalRef.current);
    if (difficultyIntervalRef.current) clearInterval(difficultyIntervalRef.current);
  };

  // End game function
  const endGame = () => {
    setIsGameActive(false);
    clearAllTimers();
    eventService.stopScheduler();
    eventService.pauseAllTasks();

    // Capture final logs from ref to ensure freshness
    const currentLogs = logsRef.current;

    // Create a deep copy to prevent updates
    const capturedLogs = {
      comm: currentLogs?.comm ? [...currentLogs.comm] : [],
      resource: currentLogs?.resource ? [...currentLogs.resource] : [],
      monitoring: currentLogs?.monitoring ? [...currentLogs.monitoring] : [],
      tracking: currentLogs?.tracking ? [...currentLogs.tracking] : [],
      performance: currentLogs?.performance ? [...currentLogs.performance] : []
    };

    console.log('Captured logs at game end:', {
      comm: capturedLogs.comm.length,
      resource: capturedLogs.resource.length,
      monitoring: capturedLogs.monitoring.length,
      tracking: capturedLogs.tracking.length,
      performance: capturedLogs.performance.length
    });

    setFinalLogs(capturedLogs);

    // Check if the score is high enough to be saved
    const finalScore = Math.floor(score);
    const isHighScore = ScoreboardService.isHighScore('normal', finalScore);

    // If it's a high score, show the save form
    if (isHighScore) {
      setShowScoreSaveForm(true);
    }

    // If in suite mode, automatically trigger completion
    if (isSuite) {
      if (finishedRef.current) return;
      finishedRef.current = true;
      console.log('NormalModeGame: Suite mode active, skipping UI and finishing stage');
      handleReturnToMenu();
    }
  };

  const handleReturnToMenu = () => {
    onGameEnd({
      finalScore: Math.floor(score),
      gameTime: Math.floor(duration / 1000) - Math.floor(timeRemaining / 1000)
    });
  };

  // Format time remaining as mm:ss
  const formatTimeRemaining = () => {
    const totalSeconds = Math.floor(timeRemaining / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')} `;
  };

  // Handle early quit
  const handleQuit = () => {
    endGame();
  };

  const handleExportData = () => {
    if (!logs) return;

    // Auto-generate timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    // Export each log
    if (logs.comm && logs.comm.length > 0) downloadCSV(logs.comm, `comm_log_${timestamp} `);
    if (logs.resource && logs.resource.length > 0) downloadCSV(logs.resource, `resource_log_${timestamp} `);
    if (logs.monitoring && logs.monitoring.length > 0) downloadCSV(logs.monitoring, `monitoring_log_${timestamp} `);
    if (logs.tracking && logs.tracking.length > 0) downloadCSV(logs.tracking, `tracking_log_${timestamp} `);
  };

  const handleExportPlots = () => {
    if (logs?.performance && logs.performance.length > 0) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      downloadCSV(logs.performance, `performance_plots_${timestamp} `);
    } else {
      alert(t('matbResults.noExportData', 'No performance data available to export.'));
    }
  };

  return (
    <div className="normal-mode-hud" style={{
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      pointerEvents: 'none',
      zIndex: 9999
    }}>
      {showInstructions && (
        <InstructionOverlay
          show={showInstructions}
          title={t('instructionsOverlay.multiTitle')}
          content={t('instructionsOverlay.intro') + "\n\n" + t('instructionsOverlay.multi')}
          onStart={() => {
            setShowInstructions(false);
            gameStartTimeRef.current = Date.now();
          }}
        />
      )}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '10px',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        color: 'white'
      }}>
        <div>
          <strong>{t('gameOver.time')}: </strong>{formatTimeRemaining()}
        </div>
        <div>
          <strong>{t('gameOver.currentScore')}: </strong>{Math.floor(score)}
        </div>
        <button
          onClick={handleQuit}
          style={{
            backgroundColor: '#ff5555',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            padding: '5px 10px',
            cursor: 'pointer',
            pointerEvents: 'auto'
          }}
        >
          {t('gameOver.quit')}
        </button>
      </div>

      {!isGameActive && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          color: 'white',
          fontSize: '24px',
          zIndex: 2000,
          pointerEvents: 'auto'
        }}>
          <h2>{t('gameOver.title', 'Simulation Complete')}</h2>

          <div style={{ width: '90%', maxWidth: '1000px', marginBottom: '20px', maxHeight: '70vh', overflowY: 'auto' }}>
            <MatbResults logs={finalLogs || logs} finalScore={Math.floor(score)} />
          </div>

          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', pointerEvents: 'auto' }}>
            <button onClick={handleExportData} style={{ padding: '8px', cursor: 'pointer' }}>
              {t('matbResults.exportRaw', 'Export raw data')}
            </button>
            <button onClick={handleExportPlots} style={{ padding: '8px', cursor: 'pointer' }}>
              {t('matbResults.exportPlot', 'Export plot data')}
            </button>
          </div>

          {showScoreSaveForm ? (
            <div style={{ width: '100%', maxWidth: '400px', pointerEvents: 'auto' }}>
              <ScoreSaveForm
                score={Math.floor(score)}
                mode="normal"
                onSaved={handleReturnToMenu}
                onSkip={handleReturnToMenu}
              />
            </div>
          ) : (
            <button
              onClick={handleReturnToMenu}
              style={{
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                padding: '10px 20px',
                cursor: 'pointer',
                fontSize: '18px',
                marginTop: '20px',
                pointerEvents: 'auto'
              }}
            >
              {t('common.returnToMenu', 'Return to Menu')}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default NormalModeGame; 