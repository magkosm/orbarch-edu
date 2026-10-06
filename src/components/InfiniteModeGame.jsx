import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import ScoreSaveForm from './ScoreSaveForm';
import ScoreboardService from '../services/ScoreboardService';

const InfiniteModeGame = ({
  onGameEnd,
  eventService,
  healthRef
}) => {
  const { t } = useTranslation();
  // Game state
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [score, setScore] = useState(0);
  const [isGameActive, setIsGameActive] = useState(true);
  const [showScoreSaveForm, setShowScoreSaveForm] = useState(false);
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
  const gameStartTimeRef = useRef(Date.now());
  const healthCheckIntervalRef = useRef(null);

  // Initialize game
  useEffect(() => {
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

    // Start scheduler
    eventService.startScheduler();

    // Start game timer to track elapsed time
    gameTimerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - gameStartTimeRef.current) / 1000);
      setTimeElapsed(elapsed * 1000);

      // Update score to be the time survived
      setScore(elapsed);
    }, 1000);

    // Setup health check (every 100ms)
    healthCheckIntervalRef.current = setInterval(() => {
      if (healthRef.current !== undefined && healthRef.current <= 0) {
        endGame();
      }
    }, 100);

    // Setup EPM progression (every 30 seconds)
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
    }, 30000); // 30 seconds

    // Setup difficulty progression (every 45 seconds)
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
    }, 45000); // 45 seconds

    // Cleanup function
    return () => {
      clearAllTimers();
      eventService.stopScheduler();
      eventService.pauseAllTasks();
    };
  }, [eventService, healthRef]);

  // Helper to clear all timers
  const clearAllTimers = () => {
    if (gameTimerRef.current) clearInterval(gameTimerRef.current);
    if (scoreTimerRef.current) clearInterval(scoreTimerRef.current);
    if (epmIntervalRef.current) clearInterval(epmIntervalRef.current);
    if (difficultyIntervalRef.current) clearInterval(difficultyIntervalRef.current);
    if (healthCheckIntervalRef.current) clearInterval(healthCheckIntervalRef.current);
  };

  // End game function
  const endGame = () => {
    setIsGameActive(false);
    clearAllTimers();
    eventService.stopScheduler();
    eventService.pauseAllTasks();

    // Check if the score is high enough to be saved
    const finalScore = Math.floor(timeElapsed / 1000);
    const isHighScore = ScoreboardService.isHighScore('infinite', finalScore);

    // If it's a high score, show the save form
    if (isHighScore) {
      setShowScoreSaveForm(true);
    }
  };

  const handleReturnToMenu = () => {
    onGameEnd({
      finalScore: Math.floor(timeElapsed / 1000),
      gameMode: 'infinite'
    });
  };

  // Format time elapsed as mm:ss
  const formatTimeElapsed = () => {
    const totalSeconds = Math.floor(timeElapsed / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Handle early quit
  const handleQuit = () => {
    endGame();
  };

  return (
    <div className="infinite-mode-hud" style={{
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      pointerEvents: 'none',
      zIndex: 9999
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '10px',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        color: 'white'
      }}>
        <div>
          <strong>{t('gameOver.timeSurvived', 'Time Survived')}: </strong>{formatTimeElapsed()}
        </div>
        <div>
          <strong>{t('systemStatus.health', 'Health')}: </strong>{healthRef.current !== undefined ? Math.floor(healthRef.current) : 100}
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
          {t('gameOver.quit', 'Quit Game')}
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
          <h2>{t('gameOver.title')}</h2>
          <p>{t('gameOver.timeSurvived')}: {formatTimeElapsed()}</p>

          {showScoreSaveForm ? (
            <div style={{ width: '100%', maxWidth: '400px', pointerEvents: 'auto' }}>
              <ScoreSaveForm
                score={Math.floor(timeElapsed / 1000)}
                mode="infinite"
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
              {t('common.returnToMenu')}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default InfiniteModeGame; 