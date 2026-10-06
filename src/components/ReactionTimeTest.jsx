import React, { useState, useEffect, useRef } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import { useTranslation } from 'react-i18next';
import ScoreboardService from '../services/ScoreboardService';

import { downloadCSV } from '../utils/csvExport';
import BackgroundService from '../services/BackgroundService';

// Register ChartJS components
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend);

// Debug flag - set to false to disable debug UI and logging
const DEBUG_MODE = false;

// Helper component for showing keyboard shortcuts
const KeyboardShortcut = ({ keys, description, onClick }) => {
  const { t } = useTranslation();
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        margin: '5px 0',
        fontSize: '14px',
        opacity: '0.9',
        cursor: onClick ? 'pointer' : 'default'
      }}
      onClick={onClick}
      title={onClick ? t('common.clickToExecute', 'Click to execute this command') : ''}
    >
      <span style={{ marginRight: '8px' }}>{description}:</span>
      {keys.map((key, index) => (
        <React.Fragment key={index}>
          {index > 0 && <span style={{ margin: '0 4px' }}>+</span>}
          <span style={{
            backgroundColor: 'rgba(255,255,255,0.2)',
            padding: '2px 6px',
            borderRadius: '4px',
            fontFamily: 'monospace'
          }}>{key}</span>
        </React.Fragment>
      ))}
    </div>
  );
};

const ReactionTimeTest = ({
  duration = 30000, // 30 seconds default
  maxStimuli = 10,
  minDelay = 1500, // 1.5 seconds
  maxDelay = 8000, // 8 seconds
  onFinish,
  onReturn,
  isSuite = false
}) => {
  const { t } = useTranslation();
  // Game state
  const [isActive, setIsActive] = useState(false);
  const [isStarted, setIsStarted] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [showStimulus, setShowStimulus] = useState(false);
  const [showFixation, setShowFixation] = useState(false);
  const [reactionTimes, setReactionTimes] = useState([]);
  const [currentStimulusIndex, setCurrentStimulusIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(duration);
  const [averageReactionTime, setAverageReactionTime] = useState(0);
  const [debugMessage, setDebugMessage] = useState('Ready');
  const [debug, setDebug] = useState([]);

  // Score saving state - moved to top level to fix conditional hooks issue
  const [playerName, setPlayerName] = useState('');
  const [scoreSaved, setScoreSaved] = useState(false);
  const [showSaveForm, setShowSaveForm] = useState(false);

  // Refs for timing
  const stimulusStartTime = useRef(null);
  const gameTimerRef = useRef(null);
  const nextStimulusTimeoutRef = useRef(null);
  const scheduledTimeRef = useRef(null);
  const isComponentMounted = useRef(true);
  const currentStimulusIndexRef = useRef(0); // Keep a ref to current index for timeout callbacks
  const timersRef = useRef([]); // Track all timers for better cleanup
  const isActiveRef = useRef(false); // Track active state for callbacks
  const finishedRef = useRef(false); // Guard against multiple endGame calls

  // Update ref when state changes
  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  // Simple debug logger
  const debugLog = (message) => {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] ${message}`;

    console.log(`ReactionTimeTest: ${message}`);
    setDebugMessage(message);

    if (DEBUG_MODE) {
      setDebug(prev => {
        const newDebug = [`${logMessage}`, ...prev];
        // Keep only the last 10 messages
        if (newDebug.length > 10) {
          return newDebug.slice(0, 10);
        }
        return newDebug;
      });
    }
  };

  // Add keyboard shortcut (Ctrl+Q) to exit to main menu
  useEffect(() => {
    debugLog('Setting up keyboard shortcuts');
    const handleKeyDown = (e) => {
      // Ctrl+Q to exit to main menu
      if (e.ctrlKey && e.key === 'q') {
        debugLog('Ctrl+Q detected, returning to main menu');
        e.preventDefault();
        if (onReturn) {
          onReturn();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onReturn]);

  // Generate time buckets for histogram
  const generateHistogramData = (times) => {
    if (!times.length) return { labels: [], data: [] };

    // Define buckets in ms (0-100, 100-200, etc.)
    const bucketSize = 50;
    const maxTime = Math.ceil(Math.max(...times) / bucketSize) * bucketSize;
    const buckets = Array.from({ length: maxTime / bucketSize }, (_, i) => ({
      label: `${i * bucketSize}-${(i + 1) * bucketSize}`,
      count: 0
    }));

    // Count reactions in each bucket
    times.forEach(time => {
      const bucketIndex = Math.floor(time / bucketSize);
      if (bucketIndex < buckets.length) {
        buckets[bucketIndex].count++;
      }
    });

    return {
      labels: buckets.map(b => b.label),
      data: buckets.map(b => b.count)
    };
  };

  // Create chart data
  const reactionChartData = {
    labels: reactionTimes.map((_, index) => `${t('reactionTest.stimulus', 'Stimulus')} ${index + 1}`),
    datasets: [
      {
        label: t('reactionTest.reactionTime', 'Reaction Time (ms)'),
        data: reactionTimes,
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.5)',
      },
      {
        label: t('reactionTest.average', 'Average'),
        data: reactionTimes.map(() => averageReactionTime),
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.5)',
        borderDash: [5, 5],
      },
    ],
  };

  const histogramData = generateHistogramData(reactionTimes);
  const distributionChartData = {
    labels: histogramData.labels,
    datasets: [
      {
        label: t('reactionTest.frequency', 'Frequency'),
        data: histogramData.data,
        backgroundColor: 'rgba(53, 162, 235, 0.5)',
      },
    ],
  };

  // Format time as seconds with decimal
  const formatTime = (ms) => {
    return (ms / 1000).toFixed(1);
  };

  // Clear all timers
  const clearAllTimers = () => {
    debugLog('Clearing all timers');

    // Clear game timer
    if (gameTimerRef.current) {
      clearInterval(gameTimerRef.current);
      gameTimerRef.current = null;
    }

    // Clear next stimulus timeout
    if (nextStimulusTimeoutRef.current) {
      clearTimeout(nextStimulusTimeoutRef.current);
      nextStimulusTimeoutRef.current = null;
    }

    // Clear all tracked timers
    timersRef.current.forEach(timer => {
      if (timer) clearTimeout(timer);
    });
    timersRef.current = [];
  };

  // End the game
  const endGame = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;

    setIsActive(false);
    if (!isSuite) {
      setIsFinished(true);
    }

    // Clear all timers
    clearAllTimers();

    // Calculate average reaction time
    let avg = 0;
    if (reactionTimes.length > 0) {
      avg = reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length;
      debugLog(`Average reaction time: ${avg.toFixed(2)}ms`);
      setAverageReactionTime(avg);
    } else {
      debugLog('No reaction times recorded');
    }

    if (onFinish) {
      onFinish({
        reactionTimes,
        averageReactionTime: avg,
        stimuliCount: reactionTimes.length,
        totalTime: duration ? (duration - timeRemaining) : (Date.now() - (stimulusStartTime.current || Date.now()))
      });
    }
  };

  // Calculate average when reaction times change
  useEffect(() => {
    if (reactionTimes.length > 0) {
      const avg = reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length;
      setAverageReactionTime(avg);
    }
  }, [reactionTimes]);

  // Function to show the stimulus directly
  const showNextStimulus = () => {
    if (!isComponentMounted.current) {
      debugLog('Not showing stimulus - component unmounted');
      return;
    }

    if (!isActiveRef.current) {
      debugLog('Not showing stimulus - game not active');
      return;
    }

    if (currentStimulusIndexRef.current >= maxStimuli) {
      debugLog('All stimuli presented, ending game');
      endGame();
      return;
    }

    debugLog(`Presenting stimulus ${currentStimulusIndexRef.current + 1}`);
    stimulusStartTime.current = Date.now();
    setShowStimulus(true);
  };

  // Schedule showing the next stimulus
  const scheduleNextStimulus = () => {
    if (!isComponentMounted.current) {
      debugLog('Not scheduling stimulus - component unmounted');
      return;
    }

    if (!isActiveRef.current) {
      debugLog('Not scheduling stimulus - game not active');
      return;
    }

    if (currentStimulusIndexRef.current >= maxStimuli) {
      debugLog('All stimuli presented, ending game');
      endGame();
      return;
    }

    // Random delay between minDelay and maxDelay
    const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
    const scheduledTime = Date.now() + delay;
    scheduledTimeRef.current = scheduledTime;
    debugLog(`Scheduling stimulus ${currentStimulusIndexRef.current + 1} with delay ${delay}ms (at ${scheduledTime})`);

    // Clear any existing timeout
    if (nextStimulusTimeoutRef.current) {
      clearTimeout(nextStimulusTimeoutRef.current);
      nextStimulusTimeoutRef.current = null;
    }

    // Schedule next stimulus and track the timer ID
    const timerId = setTimeout(() => {
      debugLog(`Timeout fired for stimulus ${currentStimulusIndexRef.current + 1}`);
      if (isComponentMounted.current && isActiveRef.current) {
        showNextStimulus();
      } else {
        debugLog(`Stimulus ${currentStimulusIndexRef.current + 1} not shown - component unmounted or game inactive`);
      }
    }, delay);

    nextStimulusTimeoutRef.current = timerId;
    timersRef.current.push(timerId);
  };

  // Handle false alarm (spam click)
  const handleFalseAlarm = () => {
    debugLog('False alarm (early reaction) detected');

    // Case 1: Spamming while stimulus is visible (too fast response < 100ms)
    // This takes precedence because if stimulus is shown, scheduledTimeRef refers to the PAST start time
    if (showStimulus) {
      debugLog('False alarm during stimulus (too fast). Cancelled current stimulus.');
      setShowStimulus(false);

      const now = Date.now();
      const penaltyDelay = 1000;

      // IMPORTANT: Update scheduled time so subsequent clicks count as false alarms
      scheduledTimeRef.current = now + penaltyDelay;

      const timerId = setTimeout(() => {
        debugLog(`Penalty timeout fired (after fast response)`);
        if (isComponentMounted.current && isActiveRef.current) {
          showNextStimulus();
        }
      }, penaltyDelay);

      nextStimulusTimeoutRef.current = timerId;
      timersRef.current.push(timerId);

      // Don't increment confirmed score, but increment index to retry or move on
      // Let's increment index to move on so they don't get stuck on the same one forever
      currentStimulusIndexRef.current += 1;
      setCurrentStimulusIndex(currentStimulusIndexRef.current);
      return;
    }

    // Case 2: Spamming before stimulus appears (Early Prediction)
    // Check if a stimulus is currently scheduled
    if (scheduledTimeRef.current && nextStimulusTimeoutRef.current) {
      const now = Date.now();
      const timeUntilStimulus = scheduledTimeRef.current - now;

      // If stimulus is coming within the next second (1000ms)
      if (timeUntilStimulus > 0 && timeUntilStimulus < 1000) {
        debugLog(`False alarm: Stimulus was scheduled in ${timeUntilStimulus}ms (< 1s). Delaying to 1s.`);

        // Clear existing timeout
        clearTimeout(nextStimulusTimeoutRef.current);
        nextStimulusTimeoutRef.current = null;

        // Re-schedule with exactly 1s delay from now
        const penaltyDelay = 1000;
        scheduledTimeRef.current = now + penaltyDelay;

        const timerId = setTimeout(() => {
          debugLog(`Penalty timeout fired`);
          if (isComponentMounted.current && isActiveRef.current) {
            showNextStimulus();
          }
        }, penaltyDelay);

        nextStimulusTimeoutRef.current = timerId;
        timersRef.current.push(timerId);
      } else {
        debugLog(`False alarm: Stimulus not imminent (${timeUntilStimulus}ms). No penalty applied.`);
      }
    } else {
      debugLog('False alarm: No stimulus scheduled. No penalty applied.');
    }
  };

  // Handle reaction to stimulus
  const handleReaction = () => {
    if (!isComponentMounted.current) {
      debugLog('Reaction ignored - component unmounted');
      return;
    }

    if (!isActiveRef.current) {
      debugLog('Reaction ignored - game not active');
      return;
    }

    if (!showStimulus) {
      debugLog('Reaction ignored - no stimulus shown');
      return;
    }

    const reactionTime = Date.now() - stimulusStartTime.current;

    // Spam protection: ignore reaction times faster than 100ms
    if (reactionTime < 100) {
      debugLog(`Reaction ignored - too fast (${reactionTime}ms < 100ms) - likely spam or prediction`);
      handleFalseAlarm(); // Treat as false alarm
      return;
    }

    debugLog(`User reacted to stimulus ${currentStimulusIndexRef.current + 1} in ${reactionTime}ms`);

    setReactionTimes(prev => [...prev, reactionTime]);
    setShowStimulus(false);
    scheduledTimeRef.current = null; // Clear scheduled time

    // Show fixation cross
    setShowFixation(true);

    // Increment index
    currentStimulusIndexRef.current += 1;
    setCurrentStimulusIndex(currentStimulusIndexRef.current);

    // Set a timeout for showing the fixation cross before next stimulus
    const fixationTimer = setTimeout(() => {
      if (!isComponentMounted.current) {
        debugLog('Fixation timeout ignored - component unmounted');
        return;
      }

      setShowFixation(false);

      // Schedule next stimulus if game is still active
      if (isActiveRef.current && currentStimulusIndexRef.current < maxStimuli) {
        debugLog(`Fixation timeout complete, scheduling next stimulus ${currentStimulusIndexRef.current + 1}`);
        scheduleNextStimulus();
      } else if (currentStimulusIndexRef.current >= maxStimuli) {
        debugLog('No more stimuli to schedule, ending game');
        endGame();
      } else {
        debugLog('Game no longer active, not scheduling next stimulus');
      }
    }, 500); // Fixation cross shows for 0.5 seconds

    timersRef.current.push(fixationTimer);
  };

  // Handle key presses for spacebar
  const handleKeyPress = (e) => {
    if (e.code === 'Space') {
      debugLog(`Space key pressed, stimulus shown: ${showStimulus}, game active: ${isActive}`);

      if (isActive) {
        if (showStimulus) {
          debugLog('Spacebar pressed for stimulus response');
          handleReaction();
        } else {
          // Stimulus not shown, check for false alarm
          debugLog('Spacebar pressed without stimulus - checking false alarm');
          handleFalseAlarm();
        }
      }
    }
  };

  // Setup keyboard listener - using useCallback to memoize handleKeyPress
  useEffect(() => {
    debugLog('Setting up spacebar listener');
    const keyListener = (e) => handleKeyPress(e);
    window.addEventListener('keydown', keyListener);

    return () => {
      debugLog('Removing spacebar listener');
      window.removeEventListener('keydown', keyListener);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showStimulus, isActive]); // Adding dependencies but disabling the lint rule

  // Track currentState in effect for debugging
  useEffect(() => {
    if (showStimulus) {
      debugLog(`State updated: stimulus ${currentStimulusIndexRef.current + 1} is now visible`);
    }
  }, [showStimulus]);

  // Force trigger a stimulus for debugging purposes
  const forceTriggerStimulus = () => {
    debugLog("Forcing stimulus to appear...");
    showNextStimulus();
  };

  // Manually schedule the first stimulus again
  const forceScheduleFirstStimulus = () => {
    debugLog("Forcing stimulus schedule...");
    scheduleNextStimulus();
  };

  // Handle starting the game
  const startGame = () => {
    debugLog(`Starting game with settings: duration=${duration}, maxStimuli=${maxStimuli}, minDelay=${minDelay}, maxDelay=${maxDelay}`);

    // Reset game state
    clearAllTimers();

    // Set active state first to ensure it's true when the timeout fires
    setIsActive(true);
    isActiveRef.current = true; // Update ref immediately to avoid race condition

    // Then set other states
    setIsStarted(true);
    setTimeRemaining(duration);
    setCurrentStimulusIndex(0);
    setReactionTimes([]);
    setShowStimulus(false);
    setShowFixation(false);
    currentStimulusIndexRef.current = 0;

    // Start the game timer - only for displaying a countdown if duration is provided
    if (duration && duration > 0) {
      gameTimerRef.current = setInterval(() => {
        if (!isComponentMounted.current) return;

        setTimeRemaining(prev => {
          const newTime = prev - 100;
          if (newTime <= 0) {
            debugLog('Time expired, ending game');
            endGame();
            return 0;
          }
          return newTime;
        });
      }, 100);
    }

    // Use a smaller delay to ensure isActive has been applied before scheduling
    setTimeout(() => {
      // Schedule the first stimulus - directly invoke the function to avoid race conditions
      debugLog('Scheduling first stimulus soon...');

      const firstStimulusTimer = setTimeout(() => {
        if (!isComponentMounted.current) {
          debugLog('First stimulus timeout ignored - component unmounted');
          return;
        }

        // Use isActiveRef which is updated immediately, not isActive which depends on React render cycle
        if (!isActiveRef.current) {
          debugLog('First stimulus timeout ignored - game not active (using ref)');
          return;
        }

        debugLog('First stimulus timeout fired, calling scheduleNextStimulus()');
        scheduleNextStimulus();
      }, 1000); // Reduced from 2000ms to 1000ms

      timersRef.current.push(firstStimulusTimer);
    }, 100); // Short delay to ensure state update has been processed
  };

  // Handle return to menu
  const handleReturn = () => {
    debugLog('Returning to config screen');
    if (onFinish) {
      onFinish({
        reactionTimes,
        averageReactionTime,
        stimuliCount: reactionTimes.length,
        totalTime: duration ? (duration - timeRemaining) : (Date.now() - (stimulusStartTime.current || Date.now()))
      });
    }
  };

  // Handle direct return to main menu
  const handleMainMenuReturn = () => {
    debugLog('Returning to main menu');
    if (onReturn) {
      onReturn();
    }
  };

  // Track component mount status and clean up on unmount
  useEffect(() => {
    debugLog('Component mounted');
    isComponentMounted.current = true;

    // Return cleanup function
    return () => {
      debugLog('Component unmounting, cleaning up timers');
      isComponentMounted.current = false;

      // Immediately clear all timers on unmount
      if (gameTimerRef.current) {
        clearInterval(gameTimerRef.current);
        gameTimerRef.current = null;
      }

      if (nextStimulusTimeoutRef.current) {
        clearTimeout(nextStimulusTimeoutRef.current);
        nextStimulusTimeoutRef.current = null;
      }

      timersRef.current.forEach(timer => {
        if (timer) clearTimeout(timer);
      });
      timersRef.current = [];
    };
  }, []);

  // Sync background on mount
  useEffect(() => {
    const currentBackground = BackgroundService.getCurrentBackground();
    const style = BackgroundService.getBackgroundStyle(currentBackground);
    document.body.style.backgroundImage = style.backgroundImage || 'none';
    document.body.style.backgroundColor = style.backgroundColor || '';
    document.body.style.backgroundSize = style.backgroundSize || '';
    document.body.style.backgroundPosition = style.backgroundPosition || '';
    document.body.style.backgroundRepeat = style.backgroundRepeat || '';
  }, []);

  // If not started, show start screen
  if (!isStarted) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        padding: '20px',
        textAlign: 'center',
        backgroundColor: 'rgba(26, 42, 58, 0.85)',
        color: 'white'
      }}>
        <div style={{
          background: 'rgba(0,0,0,0.7)',
          padding: '40px',
          borderRadius: '10px',
          maxWidth: '600px',
          width: '80%'
        }}>
          <h1>{t('reactionTest.title', 'Reaction Time Test')}</h1>
          <p>{t('reactionTest.instructions', 'Test your reaction time by clicking or pressing SPACE as quickly as possible when you see a red dot.')}</p>
          <p>{t('reactionTest.testDetails', 'The test will consist of {{maxStimuli}} stimuli presented with varying intervals.', {
            duration: duration ? (duration / 1000) : ((maxStimuli * maxDelay) / 1000),
            maxStimuli
          })}</p>
          <button
            onClick={startGame}
            style={{
              backgroundColor: '#4CAF50',
              color: 'white',
              padding: '15px 32px',
              fontSize: '16px',
              margin: '20px 0',
              cursor: 'pointer',
              border: 'none',
              borderRadius: '4px'
            }}
          >
            {t('reactionTest.startTest', 'Start Test')}
          </button>

          <button
            onClick={handleMainMenuReturn}
            style={{
              backgroundColor: '#6c757d',
              color: 'white',
              padding: '10px 20px',
              fontSize: '16px',
              margin: '10px 0',
              cursor: 'pointer',
              border: 'none',
              borderRadius: '4px'
            }}
          >
            {t('common.returnToMenu', 'Return to Main Menu')}
          </button>

          <div style={{ marginTop: '20px', fontSize: '14px', opacity: 0.7 }}>
            <KeyboardShortcut
              keys={['Ctrl', 'Q']}
              description={t('reactionTest.returnToMenu', 'Return to main menu')}
              onClick={handleMainMenuReturn}
            />
          </div>
        </div>
      </div>
    );
  }

  // If finished, show results
  if (isFinished) {
    // Only show save option if there are valid reaction times
    const canSaveScore = reactionTimes.length > 0;

    // Handle saving the score
    const handleSaveScore = () => {
      // Use the imported service directly

      // Save the average reaction time as the score
      ScoreboardService.saveScore('reaction', averageReactionTime, playerName, {
        stimuliCount: reactionTimes.length,
        fastestTime: Math.min(...reactionTimes),
        slowestTime: Math.max(...reactionTimes),
        totalTime: duration - timeRemaining
      });

      setScoreSaved(true);
      setScoreSaved(true);
      setShowSaveForm(false);
    };

    const handleExportData = () => {
      if (reactionTimes.length === 0) return;

      const data = reactionTimes.map((rt, index) => ({
        trial: index + 1,
        reactionTimeMs: rt,
        reactionTimeSec: (rt / 1000).toFixed(3)
      }));

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      downloadCSV(data, `reaction_time_results_${timestamp}`);
    };

    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '20px',
        height: '100vh',
        backgroundColor: 'rgba(26, 42, 58, 0.85)',
        color: 'white',
        overflow: 'auto'
      }}>
        <div style={{
          background: 'rgba(0,0,0,0.7)',
          padding: '40px',
          borderRadius: '10px',
          width: '90%',
          maxWidth: '900px',
          marginBottom: '30px'
        }}>
          <h1 style={{ textAlign: 'center' }}>{t('reactionTest.results', 'Reaction Time Results')}</h1>

          <div style={{
            background: 'rgba(255,255,255,0.1)',
            padding: '20px',
            borderRadius: '8px',
            marginBottom: '20px',
            width: '100%',
            textAlign: 'center'
          }}>
            <h2>{t('reactionTest.averageTime', 'Average Reaction Time')}: {reactionTimes.length > 0 ? averageReactionTime.toFixed(2) : '--'} ms</h2>
            <p>{t('reactionTest.totalStimuli', 'Total Stimuli')}: {reactionTimes.length}</p>
            {reactionTimes.length > 0 && (
              <>
                <p>{t('reactionTest.fastestTime', 'Fastest Time')}: {Math.min(...reactionTimes).toFixed(2)} ms</p>
                <p>{t('reactionTest.slowestTime', 'Slowest Time')}: {Math.max(...reactionTimes).toFixed(2)} ms</p>
              </>
            )}
          </div>

          {reactionTimes.length > 0 ? (
            <>
              <div style={{ width: '100%', marginBottom: '30px' }}>
                <h3 style={{ textAlign: 'center' }}>{t('reactionTest.timesByStimulus', 'Reaction Times by Stimulus')}</h3>
                <div style={{ height: '300px', background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '8px' }}>
                  <Line
                    data={reactionChartData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      scales: {
                        y: {
                          beginAtZero: true,
                          title: {
                            display: true,
                            text: t('reactionTest.milliseconds', 'Milliseconds (ms)'),
                            color: 'white'
                          },
                          ticks: { color: 'white' }
                        },
                        x: {
                          ticks: { color: 'white' }
                        }
                      },
                      plugins: {
                        legend: {
                          labels: { color: 'white' }
                        }
                      }
                    }}
                  />
                </div>
              </div>

              <div style={{ width: '100%', marginBottom: '30px' }}>
                <h3 style={{ textAlign: 'center' }}>{t('reactionTest.timeDistribution', 'Reaction Time Distribution')}</h3>
                <div style={{ height: '300px', background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '8px' }}>
                  <Bar
                    data={distributionChartData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      scales: {
                        y: {
                          beginAtZero: true,
                          title: {
                            display: true,
                            text: t('reactionTest.frequency', 'Frequency'),
                            color: 'white'
                          },
                          ticks: { color: 'white' }
                        },
                        x: {
                          title: {
                            display: true,
                            text: t('reactionTest.milliseconds', 'Reaction Time (ms)'),
                            color: 'white'
                          },
                          ticks: { color: 'white' }
                        }
                      },
                      plugins: {
                        legend: {
                          labels: { color: 'white' }
                        }
                      }
                    }}
                  />
                </div>
              </div>

              {/* Score saving section */}
              {canSaveScore && !scoreSaved && !showSaveForm && (
                <div style={{
                  textAlign: 'center',
                  marginBottom: '20px',
                  padding: '15px',
                  background: 'rgba(255,255,255,0.05)',
                  borderRadius: '8px'
                }}>
                  <button
                    onClick={() => setShowSaveForm(true)}
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
                    {t('gameOver.enterName', 'Enter your name to save your score')}
                  </button>
                </div>
              )}

              {canSaveScore && showSaveForm && (
                <div style={{
                  textAlign: 'center',
                  marginBottom: '20px',
                  padding: '15px',
                  background: 'rgba(255,255,255,0.05)',
                  borderRadius: '8px'
                }}>
                  <div style={{ marginBottom: '15px' }}>
                    <input
                      type="text"
                      value={playerName}
                      onChange={(e) => setPlayerName(e.target.value)}
                      placeholder={t('gameOver.enterName', 'Enter your name')}
                      style={{
                        padding: '10px',
                        width: '80%',
                        maxWidth: '300px',
                        fontSize: '16px',
                        borderRadius: '4px',
                        border: 'none',
                        marginRight: '10px'
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
                    <button
                      onClick={handleSaveScore}
                      disabled={!playerName.trim()}
                      style={{
                        backgroundColor: playerName.trim() ? '#4CAF50' : '#cccccc',
                        color: 'white',
                        padding: '10px 20px',
                        fontSize: '16px',
                        cursor: playerName.trim() ? 'pointer' : 'not-allowed',
                        border: 'none',
                        borderRadius: '4px'
                      }}
                    >
                      {t('gameOver.submit', 'Submit')}
                    </button>

                    <button
                      onClick={() => setShowSaveForm(false)}
                      style={{
                        backgroundColor: '#dc3545',
                        color: 'white',
                        padding: '10px 20px',
                        fontSize: '16px',
                        cursor: 'pointer',
                        border: 'none',
                        borderRadius: '4px'
                      }}
                    >
                      {t('common.cancel', 'Cancel')}
                    </button>
                  </div>
                </div>
              )}

              {canSaveScore && scoreSaved && (
                <div style={{
                  textAlign: 'center',
                  marginBottom: '20px',
                  padding: '15px',
                  background: 'rgba(75, 192, 192, 0.2)',
                  borderRadius: '8px',
                  color: '#4CAF50'
                }}>
                  {t('scoreboard.scoreSaved', 'Your score has been saved!')}
                </div>
              )}
            </>
          ) : (
            <div style={{
              background: 'rgba(255,255,255,0.05)',
              padding: '20px',
              borderRadius: '8px',
              marginBottom: '20px',
              width: '100%',
              textAlign: 'center'
            }}>
              <h3>{t('reactionTest.noReactionTimes', 'No reaction times recorded')}</h3>
              <p>{t('reactionTest.tryAgainToTest', 'Try again to test your reaction time.')}</p>
            </div>
          )}

          <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', marginTop: '20px' }}>
            <button
              onClick={handleExportData}
              style={{
                backgroundColor: '#17a2b8',
                color: 'white',
                padding: '10px 20px',
                fontSize: '16px',
                cursor: 'pointer',
                border: 'none',
                borderRadius: '4px'
              }}
            >
              {t('reactionTest.exportData', 'Export data')}
            </button>

            <button
              onClick={handleReturn}
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
              {t('reactionTest.tryAgain', 'Try Again')}
            </button>

            <button
              onClick={handleMainMenuReturn}
              style={{
                backgroundColor: '#007BFF',
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

          <div style={{ marginTop: '20px', fontSize: '14px', opacity: 0.7, textAlign: 'center' }}>
            <KeyboardShortcut
              keys={['Ctrl', 'Q']}
              description={t('reactionTest.returnToMenu', 'Return to main menu')}
              onClick={handleMainMenuReturn}
            />
          </div>
        </div>
      </div>
    );
  }

  // Main game screen
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      backgroundColor: 'rgba(26, 42, 58, 0.85)',
      color: 'white'
    }}>
      <div style={{
        position: 'absolute',
        top: '20px',
        right: '20px',
        background: 'rgba(0,0,0,0.7)',
        padding: '10px',
        borderRadius: '5px',
        boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
      }}>
        {duration && <p style={{ margin: '0' }}>{t('reactionTest.timeRemaining', 'Time')}: {formatTime(timeRemaining)}</p>}
        <p style={{ margin: '0' }}>{t('reactionTest.stimuliProgress', 'Stimuli')}: {currentStimulusIndex}/{maxStimuli}</p>
      </div>

      {/* Debug info - only shown when DEBUG_MODE is true */}
      {DEBUG_MODE && (
        <div style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          background: 'rgba(0,0,0,0.7)',
          padding: '10px',
          borderRadius: '5px',
          boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
          fontSize: '12px',
          maxWidth: '300px',
          zIndex: 1000
        }}>
          <p style={{ margin: '0' }}>Status: {debugMessage}</p>
          <p style={{ margin: '0' }}>Mounted: {isComponentMounted.current ? 'Yes' : 'No'}</p>
          <p style={{ margin: '0' }}>Active: {isActive ? 'Yes' : 'No'}</p>
          <p style={{ margin: '0' }}>Stimulus Visible: {showStimulus ? 'Yes' : 'No'}</p>
          <div style={{ display: 'flex', gap: '5px', marginTop: '5px' }}>
            <button
              onClick={forceTriggerStimulus}
              style={{
                backgroundColor: '#007BFF',
                color: 'white',
                padding: '5px 10px',
                fontSize: '12px',
                cursor: 'pointer',
                border: 'none',
                borderRadius: '4px'
              }}
            >
              {t('reactionTest.forceStimulus', 'Force Stimulus')}
            </button>
            <button
              onClick={forceScheduleFirstStimulus}
              style={{
                backgroundColor: '#28a745',
                color: 'white',
                padding: '5px 10px',
                fontSize: '12px',
                cursor: 'pointer',
                border: 'none',
                borderRadius: '4px'
              }}
            >
              {t('reactionTest.scheduleNext', 'Schedule Next')}
            </button>
          </div>

          <div style={{
            marginTop: '10px',
            maxHeight: '150px',
            overflowY: 'auto',
            background: 'rgba(0,0,0,0.5)',
            padding: '5px',
            borderRadius: '4px',
            fontSize: '10px'
          }}>
            <p style={{ margin: '0', borderBottom: '1px solid #333', paddingBottom: '3px' }}>Debug Log:</p>
            {debug.map((message, index) => (
              <div key={index} style={{
                padding: '2px 0',
                borderBottom: index < debug.length - 1 ? '1px solid #222' : 'none',
                wordBreak: 'break-word'
              }}>
                {message}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{
        width: '80%',
        height: '60%',
        maxWidth: '800px',
        maxHeight: '600px',
        backgroundColor: 'rgba(0,0,0,0.7)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
        borderRadius: '8px',
        position: 'relative'
      }}>
        {showStimulus && (
          <div
            onClick={handleReaction}
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              backgroundColor: 'red',
              cursor: 'pointer'
            }}
          />
        )}

        {!showStimulus && !showFixation && (
          <div
            onClick={handleFalseAlarm}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              cursor: 'pointer'
            }}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: '100%'
            }}>
              <p style={{ pointerEvents: 'none' }}>{t('reactionTest.getReady', 'Get ready for the next stimulus...')}</p>
            </div>
          </div>
        )}

        {showFixation && (
          <div style={{
            fontSize: '40px',
            fontWeight: 'bold',
            pointerEvents: 'none' // Prevent clicks on fixation cross from triggering anything
          }}>
            +
          </div>
        )}

        {/* Duplicate removed */}
      </div>

      <p style={{ marginTop: '20px' }}>
        {t('reactionTest.actionInstructions', 'Press SPACE or click the red dot when it appears')}
      </p>

      <div style={{ marginTop: '20px', fontSize: '14px', opacity: 0.7 }}>
        <KeyboardShortcut
          keys={['Ctrl', 'Q']}
          description={t('reactionTest.returnToMenu', 'Return to main menu')}
          onClick={handleMainMenuReturn}
        />
      </div>
    </div>
  );
};

export default ReactionTimeTest; 