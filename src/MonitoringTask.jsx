/**
 * MonitoringTask — the System Monitoring task of MATB-II.
 *
 * Presents warning lights (F1/F2) and gauges (F3-F6); the operator must detect
 * abnormal states and respond (keyboard F1-F6 or click/tap). Misses and false
 * alarms feed the shared System Health gauge via onPenalty / onMetricsUpdate.
 *
 * Part of the Orbital Architecture project. MIT License — see LICENSE.
 */
import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAutoScroll } from './hooks/useAutoScroll';
import { downloadCSV } from './utils/csvExport';

/**
 * Simple utility for unique event IDs.
 * Example format: "1689876543210-F3-417"
 */
function generateEventId(label) {
  return `${Date.now()}-${label}-${Math.floor(Math.random() * 1000)}`;
}

/**
 * MonitoringTask
 * 
 * Receives the following props:
 *  - eventsPerMinute (number): current EPM value
 *  - setEventsPerMinute (function): setter for EPM
 *  - showLog (boolean): whether to show/hide the log
 *  - setShowLog (function): setter for toggling the log
 *  - autoEvents (boolean): whether events should occur automatically (defaults to false)
 */
function MonitoringTask({
  eventsPerMinute,
  setEventsPerMinute,
  showLog = false,
  setShowLog,
  onLogUpdate,
  isEnabled = true,
  onMetricsUpdate,
  onOptionsUpdate,
  autoEvents = false,
  onPenalty
}, ref) {
  const { t } = useTranslation();
  // ---------------------
  // 1) STATE & REFS
  // ---------------------
  const [startTime] = useState(Date.now());
  const [taskMetrics, setTaskMetrics] = useState({
    runTime: 0,
    currentHealth: 100,
    activeEvents: 0,
    totalEvents: 0,
    hits: 0,
    misses: 0,
    falseAlarms: 0
  });

  // Add difficulty state
  const [difficulty, setDifficultyState] = useState(5);
  const [isPaused, setIsPaused] = useState(false);

  // Items: F1, F2 (buttons), F3–F6 (gauges)
  // For gauges: track level (0..10) + eventSide ('low'|'high'|null)
  const [items, setItems] = useState([
    { label: 'F1', colorNormal: 'green', colorEvent: 'gray', eventActive: false },
    { label: 'F2', colorNormal: 'gray', colorEvent: 'red', eventActive: false },
    { label: 'F3', level: 5, eventActive: false, eventSide: null },
    { label: 'F4', level: 5, eventActive: false, eventSide: null },
    { label: 'F5', level: 5, eventActive: false, eventSide: null },
    { label: 'F6', level: 5, eventActive: false, eventSide: null },
  ]);

  /**
   * `activeEvents` holds in-progress events that haven't been marked final
   * Each event: {
   *   id: string,            // unique ID
   *   label: string,         // "F1"..."F6"
   *   timestamp: number,     // start time
   *   responded: boolean,
   *   responseTime: number | null,
   *   type: 'HIT'|'MISS'|'FA'|null
   * }
   */
  const [activeEvents, setActiveEvents] = useState([]);

  /**
   * The master log of finalized events (HIT, MISS, or FA).
   * Once an event is logged here, it won't be added again.
   */
  const [eventLog, setEventLog] = useState([]);

  // To prevent accidental double key/click logs within 250ms
  const [lastPressTimes, setLastPressTimes] = useState({});

  // Refs for scheduling and timing
  const eventTimeoutRef = useRef(null);
  const mainLoopRef = useRef(null);
  const metricsLoopRef = useRef(null);
  const isEnabledRef = useRef(isEnabled);

  // Add new state/refs for metrics
  const [healthImpact, setHealthImpact] = useState(0);
  const [metrics, setMetrics] = useState({
    systemLoad: 0,
    healthImpact: 0
  });

  // Update enabled ref when prop changes
  useEffect(() => {
    isEnabledRef.current = isEnabled;
  }, [isEnabled]);

  // ---------------------
  // 3) EVENT MANAGEMENT
  // ---------------------

  /**
   * Trigger a new monitoring event
   * @param {string} [specificLabel] - Optional specific indicator to trigger
   * @param {number} [customDuration] - Optional custom duration for the event
   * @returns {boolean} - Whether event was successfully triggered
   */
  const triggerEvent = useCallback((specificLabel, customDuration) => {
    if (!isEnabledRef.current) return false;

    // Find the specified item or pick a random one if not specified
    let label = specificLabel;
    if (!label) {
      // Original random selection logic
      const availableIndices = items
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => !item.eventActive)
        .map(({ index }) => index);

      if (availableIndices.length === 0) return false;

      const randomIndex = Math.floor(Math.random() * availableIndices.length);
      const itemIndex = availableIndices[randomIndex];
      label = items[itemIndex].label;
    }

    // Find the item
    const itemIndex = items.findIndex(item => item.label === label);
    if (itemIndex === -1 || items[itemIndex].eventActive) return false;

    // Calculate duration - use custom if provided, otherwise default random
    const baseDuration = 15000; // 15 seconds by default
    const randomFactor = 0.5 + Math.random(); // Random multiplier between 0.5 and 1.5
    let duration = customDuration || Math.floor(baseDuration * randomFactor);

    // Generate event ID
    const eventId = generateEventId(label);

    // Update item state
    const updatedItems = [...items];

    // For F1 and F2 (buttons)
    if (label === 'F1' || label === 'F2') {
      updatedItems[itemIndex] = {
        ...updatedItems[itemIndex],
        eventActive: true
      };
    }
    // For F3-F6 (gauges)
    else {
      const eventSide = Math.random() > 0.5 ? 'high' : 'low';
      const targetLevel = eventSide === 'high' ? 10 : 0;

      updatedItems[itemIndex] = {
        ...updatedItems[itemIndex],
        eventActive: true,
        eventSide,
        targetLevel
      };
    }

    setItems(updatedItems);

    // Add to active events
    const newActiveEvent = {
      id: eventId,
      label,
      timestamp: Date.now(),
      responded: false,
      responseTime: null,
      type: null,
      hasCustomTimeout: duration !== undefined
    };

    setActiveEvents(prev => [...prev, newActiveEvent]);

    // Update metrics
    setTaskMetrics(prev => ({
      ...prev,
      activeEvents: prev.activeEvents + 1,
      totalEvents: prev.totalEvents + 1
    }));

    // Schedule event to end
    const timeoutId = setTimeout(() => {
      // Find the event in the current activeEvents state
      setActiveEvents(prev => {
        const updatedEvents = [];
        let wasFinalized = false;

        for (const evt of prev) {
          if (evt.id === eventId && evt.type === null) {
            // Update the event status
            evt.responded = false;
            evt.responseTime = null;
            evt.type = 'MISS';

            // Log it
            setEventLog(prevLog => [...prevLog, evt]);
            wasFinalized = true;

            // Update metrics
            setTaskMetrics(prev => ({
              ...prev,
              misses: prev.misses + 1,
              activeEvents: prev.activeEvents - 1
            }));
            setHealthImpact(-5); // Negative impact for miss

            // Deactivate the indicator
            setItems(items =>
              items.map(item =>
                item.label === evt.label
                  ? item.label.startsWith('F') && parseInt(item.label[1]) > 2
                    ? { ...item, eventActive: false, eventSide: null, level: 5 }
                    : { ...item, eventActive: false }
                  : item
              )
            );
          } else {
            updatedEvents.push(evt);
          }
        }

        return updatedEvents;
      });
    }, duration);

    // Store timeout ID
    eventTimeoutRef.current = timeoutId;

    return true;
  }, [items, setItems, setActiveEvents, setTaskMetrics, setEventLog, setHealthImpact]);

  /**
   * Handle user response to an event
   * @param {string} label - Label of the indicator (e.g., "F1")
   * @returns {boolean} - Whether response was successful
   */
  const handleResponse = useCallback((label) => {
    if (!isEnabledRef.current) return false;

    // Debug which label is being processed
    console.log('Processing response for:', label);

    // Find the item
    const itemIndex = items.findIndex(item => item.label === label);
    if (itemIndex === -1) return false;

    const item = items[itemIndex];

    // Check if there's an active event for this item
    if (!item.eventActive) {
      // False alarm!
      setTaskMetrics(prev => ({
        ...prev,
        falseAlarms: prev.falseAlarms + 1
      }));
      if (onPenalty) onPenalty(-2); // Smaller negative impact for false alarm

      // Add to event log
      const falseAlarmEvent = {
        id: generateEventId(label),
        label,
        timestamp: Date.now(),
        responded: true,
        responseTime: 0,
        type: 'FA'
      };
      setEventLog(prev => [...prev, falseAlarmEvent]);

      return false;
    }

    // Find the corresponding active event
    setActiveEvents(prev => {
      const updatedEvents = [];
      let wasResponded = false;

      for (const evt of prev) {
        if (evt.label === label && evt.type === null) {
          // Update the event
          evt.responded = true;
          evt.responseTime = Date.now() - evt.timestamp;
          evt.type = 'HIT';

          // Add to log
          setEventLog(prevLog => [...prevLog, evt]);
          wasResponded = true;

          // Update metrics
          setTaskMetrics(prevMetrics => ({
            ...prevMetrics,
            hits: prevMetrics.hits + 1,
            activeEvents: prevMetrics.activeEvents - 1
          }));

          if (onPenalty) onPenalty(5); // Positive impact for hit
        } else {
          updatedEvents.push(evt);
        }
      }

      return updatedEvents;
    });

    // Reset the item's state
    const updatedItems = [...items];
    if (label.startsWith('F') && parseInt(label[1]) > 2) {
      // For gauges (F3-F6), reset to center
      updatedItems[itemIndex] = {
        ...updatedItems[itemIndex],
        eventActive: false,
        eventSide: null,
        level: 5
      };
    } else {
      // For buttons, just turn off the event
      updatedItems[itemIndex] = {
        ...updatedItems[itemIndex],
        eventActive: false
      };
    }
    setItems(updatedItems);

    return true;
  }, [items, setItems, setActiveEvents, setEventLog, setTaskMetrics, onPenalty]);

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    resetTask,
    triggerEvent,
    getMetrics: () => taskMetrics,
    triggerMultipleEvents: (config) => {
      try {
        const { triggerCount, duration } = config;

        // console.log(`Attempting to trigger ${triggerCount} monitoring events with duration ${duration}ms`);

        // Validate trigger count (1-6)
        // Higher difficulty means more simultaneous events can be triggered
        const maxEvents = Math.min(6, Math.floor(3 + (difficulty * 0.3))); // 3 at diff 1, up to 6 at diff 10
        const count = Math.min(maxEvents, Math.max(1, triggerCount || 1));

        // Get all available indicators (not currently active)
        const availableIndicators = items
          .filter(item => !item.eventActive)
          .map(item => item.label);

        if (availableIndicators.length === 0) {
          // console.log('No available indicators to trigger');
          return false;
        }

        // Shuffle the array of labels
        const shuffledLabels = [...availableIndicators].sort(() => Math.random() - 0.5);

        // Take the first 'count' items, but no more than are available
        const selectedLabels = shuffledLabels.slice(0, Math.min(count, availableIndicators.length));

        // console.log(`Selected indicators to trigger: ${selectedLabels.join(', ')}`);

        // Create a new items array for batch update
        const newItems = [...items];
        const newActiveEvents = [];
        let triggeredCount = 0;

        selectedLabels.forEach(label => {
          const itemIndex = newItems.findIndex(item => item.label === label);
          if (itemIndex === -1) return;

          const item = newItems[itemIndex];

          // For gauges (F3-F6), randomly choose high or low event
          if (label.startsWith('F') && parseInt(label[1]) > 2) {
            const eventSide = Math.random() < 0.5 ? 'low' : 'high';
            const targetLevel = eventSide === 'low' ? 0 : 10;

            // Higher difficulty means more extreme deviations
            const deviation = 5 + (difficulty * 0.3); // 5.3 at diff 1, 8 at diff 10

            newItems[itemIndex] = {
              ...item,
              eventActive: true,
              eventSide,
              level: targetLevel,
              deviation
            };
          } else {
            // For buttons (F1-F2), just activate the event
            newItems[itemIndex] = {
              ...item,
              eventActive: true
            };
          }

          // Create event object
          const eventId = generateEventId(label);
          const event = {
            id: eventId,
            label,
            timestamp: Date.now(),
            responded: false,
            responseTime: null,
            type: null
          };

          newActiveEvents.push(event);

          // Set up timeout to finalize event if not responded to
          setTimeout(() => {
            // Find the event in the current activeEvents state
            setActiveEvents(prev => {
              const updatedEvents = [];
              let wasFinalized = false;

              for (const evt of prev) {
                if (evt.id === eventId && evt.type === null) {
                  // Update the event status
                  evt.responded = false;
                  evt.responseTime = null;
                  evt.type = 'MISS';

                  // Log it
                  setEventLog(prevLog => [...prevLog, evt]);
                  wasFinalized = true;

                  // Update metrics
                  setTaskMetrics(prev => ({
                    ...prev,
                    misses: prev.misses + 1,
                    activeEvents: prev.activeEvents - 1
                  }));

                  if (onPenalty) onPenalty(-5); // Negative impact for miss

                  // Deactivate the indicator
                  setItems(items =>
                    items.map(item =>
                      item.label === evt.label
                        ? item.label.startsWith('F') && parseInt(item.label[1]) > 2
                          ? { ...item, eventActive: false, eventSide: null, level: 5 }
                          : { ...item, eventActive: false }
                        : item
                    )
                  );
                } else {
                  updatedEvents.push(evt);
                }
              }

              return updatedEvents;
            });
          }, duration);

          triggeredCount++;
        });

        // Apply all updates at once
        if (triggeredCount > 0) {
          setItems(newItems);
          setActiveEvents(prev => [...prev, ...newActiveEvents]);
          setTaskMetrics(prev => ({
            ...prev,
            activeEvents: prev.activeEvents + triggeredCount,
            totalEvents: prev.totalEvents + triggeredCount
          }));
        }

        // console.log(`Successfully triggered ${triggeredCount} monitoring events`);
        return triggeredCount > 0;
      } catch (error) {
        console.error('Error triggering multiple events:', error);
        return false;
      }
    },
    setDifficulty: (value) => {
      console.log('MonitoringTask: Setting difficulty to', value);
      setDifficultyState(value);
    },
    togglePause: () => {
      setIsPaused(prev => !prev);
      return !isPaused;
    },
    setPause: (shouldPause) => {
      setIsPaused(shouldPause);
      return shouldPause;
    },
    isPaused: () => isPaused
  }));

  // Schedule events based on EPM
  useEffect(() => {
    if (!isEnabled || !autoEvents || isPaused) {
      if (eventTimeoutRef.current) {
        clearTimeout(eventTimeoutRef.current);
        eventTimeoutRef.current = null;
      }
      return;
    }

    const scheduleNextEvent = () => {
      const baseIntervalMs = 60000 / eventsPerMinute;
      const jitter = Math.random() * 0.4 + 0.8; // 80-120% of base interval
      const waitMs = baseIntervalMs * jitter;

      eventTimeoutRef.current = setTimeout(() => {
        if (isEnabledRef.current && autoEvents) {
          triggerEvent();
          scheduleNextEvent();
        }
      }, waitMs);
    };

    scheduleNextEvent();

    // Notify options of EPM change
    onOptionsUpdate?.({ eventsPerMinute });

    return () => {
      if (eventTimeoutRef.current) clearTimeout(eventTimeoutRef.current);
    };
  }, [eventsPerMinute, isEnabled, autoEvents, triggerEvent, onOptionsUpdate]);

  // Update metrics periodically
  useEffect(() => {
    if (isPaused) return;

    const updateMetrics = () => {
      const now = Date.now();
      setTaskMetrics(prev => ({
        ...prev,
        runTime: Math.floor((now - startTime) / 1000)
      }));
    };

    metricsLoopRef.current = setInterval(updateMetrics, 1000);
    return () => {
      if (metricsLoopRef.current) clearInterval(metricsLoopRef.current);
    };
  }, [startTime, isPaused]);

  // Handle event completion and health impact
  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      const now = Date.now();
      setActiveEvents(prev => {
        const stillActive = [];
        const completed = [];

        for (const evt of prev) {
          if (evt.type === null) {
            const age = now - evt.timestamp;
            if (age >= 5000) {
              // MISS
              evt.type = 'MISS';
              evt.responded = false;
              evt.responseTime = null;
              if (onPenalty) onPenalty(-5);
              setTaskMetrics(prev => ({
                ...prev,
                misses: prev.misses + 1,
                activeEvents: prev.activeEvents - 1
              }));

              // Deactivate indicator
              setItems(prevItems =>
                prevItems.map(it =>
                  it.label === evt.label ? { ...it, eventActive: false } : it
                )
              );
              completed.push(evt);
            } else {
              stillActive.push(evt);
            }
          } else {
            completed.push(evt);
          }
        }

        if (completed.length > 0) {
          setEventLog(prev => {
            const logIds = new Set(prev.map(x => x.id));
            const uniqueCompleted = completed.filter(e => !logIds.has(e.id));
            return [...prev, ...uniqueCompleted];
          });
        }

        return stillActive;
      });
    }, 1000); // Check every second

    return () => clearInterval(interval);
  }, [isPaused, onPenalty]);

  // Reset function with enhanced cleanup
  const resetTask = useCallback(() => {
    setItems([
      { label: 'F1', colorNormal: 'green', colorEvent: 'gray', eventActive: false },
      { label: 'F2', colorNormal: 'gray', colorEvent: 'red', eventActive: false },
      { label: 'F3', level: 5, eventActive: false, eventSide: null },
      { label: 'F4', level: 5, eventActive: false, eventSide: null },
      { label: 'F5', level: 5, eventActive: false, eventSide: null },
      { label: 'F6', level: 5, eventActive: false, eventSide: null },
    ]);
    setActiveEvents([]);
    setEventLog([]);
    setLastPressTimes({});
    setTaskMetrics({
      runTime: 0,
      currentHealth: 100,
      activeEvents: 0,
      totalEvents: 0,
      hits: 0,
      misses: 0,
      falseAlarms: 0
    });

    if (eventTimeoutRef.current) {
      clearTimeout(eventTimeoutRef.current);
      eventTimeoutRef.current = null;
    }
    if (metricsLoopRef.current) {
      clearInterval(metricsLoopRef.current);
      metricsLoopRef.current = null;
    }
    setMetrics({
      systemLoad: 0,
      healthImpact: 0
    });
  }, []);

  // ---------------------
  // 2) MAIN LOOP (Gauge updates & timeouts)
  // ---------------------

  useEffect(() => {
    mainLoopRef.current = setInterval(() => {
      if (isPaused) return;

      // 3a) Gauge fluctuation
      setItems((prev) =>
        prev.map((item) => {
          if (/F[3-6]/.test(item.label)) {
            const { level, eventActive, eventSide } = item;
            if (eventActive && eventSide) {
              // Lock to side range with stronger bias toward the target state
              let newLevel = level;
              const randomFactor = Math.random();

              if (eventSide === 'low') {
                // Target range is [0..2]
                if (randomFactor < 0.6) {
                  // 60% chance to move toward target (down)
                  newLevel = Math.max(0, level - Math.floor(randomFactor * 3));
                } else if (randomFactor < 0.8) {
                  // 20% chance to move up (but stay in range)
                  newLevel = Math.min(2, level + 1);
                }
                // 20% chance to stay the same

                // Ensure we stay in the event range
                newLevel = Math.min(2, Math.max(0, newLevel));
              } else {
                // Target range is [8..10]
                if (randomFactor < 0.6) {
                  // 60% chance to move toward target (up)
                  newLevel = Math.min(10, level + Math.floor(randomFactor * 3));
                } else if (randomFactor < 0.8) {
                  // 20% chance to move down (but stay in range)
                  newLevel = Math.max(8, level - 1);
                }
                // 20% chance to stay the same

                // Ensure we stay in the event range
                newLevel = Math.max(8, Math.min(10, newLevel));
              }

              return { ...item, level: newLevel };
            } else if (eventActive) {
              // fallback 0..10 if eventSide is null
              let newLevel = level + Math.floor(Math.random() * 7 - 3);
              if (newLevel < 0) newLevel = 0;
              if (newLevel > 10) newLevel = 10;
              return { ...item, level: newLevel };
            } else {
              // Normal mode => [3..7]
              let newLevel = level + Math.floor(Math.random() * 5 - 2);
              if (newLevel < 3) newLevel = 3;
              if (newLevel > 7) newLevel = 7;
              // Reset leftover eventSide
              return { ...item, level: newLevel, eventSide: null };
            }
          }
          // F1/F2 => no level
          return item;
        })
      );

      // 3b) Timeout check
      const now = Date.now();
      setActiveEvents((prevA) => {
        const stillActive = [];
        const completed = [];

        for (const evt of prevA) {
          if (evt.type === null) {
            // Only check for expiration if this event doesn't have a custom timeout already set
            // Events with custom durations are handled by their own timeouts
            if (!evt.hasCustomTimeout) {
              const age = now - evt.timestamp;
              if (age >= 5000) { // Default duration of 5 seconds
                // MISS - Set health impact
                evt.type = 'MISS';
                evt.responded = false;
                evt.responseTime = null;

                // Set health impact for MISS
                if (onPenalty) onPenalty(-5);

                // Turn off item's eventActive
                setItems((prevItems) =>
                  prevItems.map((it) =>
                    it.label === evt.label ?
                      it.label.startsWith('F') && parseInt(it.label[1]) > 2 ?
                        { ...it, eventActive: false, eventSide: null, level: 5 } :
                        { ...it, eventActive: false }
                      : it
                  )
                );
                completed.push(evt);
              } else {
                stillActive.push(evt);
              }
            } else {
              // Event has custom timeout, keep it active
              stillActive.push(evt);
            }
          } else {
            completed.push(evt);
          }
        }

        // 3c) Merge completed events into eventLog
        if (completed.length > 0) {
          setEventLog((prevLog) => {
            const logIds = new Set(prevLog.map((x) => x.id));
            const uniqueCompleted = completed.filter((e) => !logIds.has(e.id));
            return [...prevLog, ...uniqueCompleted];
          });
        }

        return stillActive; // keep active ones
      });
    }, 250); // Increased animation rate from 1000ms to 250ms for more visual feedback

    return () => {
      if (mainLoopRef.current) clearInterval(mainLoopRef.current);
    };
  }, []);

  // ---------------------
  // 4) RESPONDING (Keyboard & Click)
  // ---------------------

  const handleKeyDown = useCallback((e) => {
    if (e.repeat) return; // skip repeats

    // Debug what key is being pressed
    console.log('Key pressed:', e.key);

    // Handle function keys F1-F6
    if (e.key && /^F[1-6]$/.test(e.key)) {
      e.preventDefault(); // Prevent default browser behavior
      console.log('Function key detected:', e.key);
      handleResponse(e.key);
    }
  }, [handleResponse]);

  // Attach global keydown
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Update the eventLog state and notify parent
  useEffect(() => {
    onLogUpdate(eventLog);
  }, [eventLog, onLogUpdate]);

  // Add effect to update metrics when health impact changes
  useEffect(() => {
    if (!isEnabled || isPaused) {
      if (!isEnabled) {
        onMetricsUpdate?.({ healthImpact: 0, systemLoad: 0 });
      } else {
        // If paused, also send 0 metrics to stop SystemHealth updates
        onMetricsUpdate?.({ healthImpact: 0, systemLoad: 0 });
      }
      return;
    }

    // Calculate load based on number of active indicators (5% each)
    const activeCount = items.filter(item => item.eventActive).length;
    const calculatedLoad = activeCount * 5;

    setMetrics(prev => ({
      ...prev,
      systemLoad: calculatedLoad,
      healthImpact: healthImpact
    }));

    onMetricsUpdate?.({
      healthImpact,
      systemLoad: calculatedLoad
    });

    // Reset health impact after a delay
    if (healthImpact !== 0) {
      const timer = setTimeout(() => {
        setHealthImpact(0);
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [healthImpact, items, isEnabled, isPaused, onMetricsUpdate]);

  // Add cleanup on unmount
  useEffect(() => {
    return () => {
      if (eventTimeoutRef.current) {
        clearTimeout(eventTimeoutRef.current);
      }
      if (mainLoopRef.current) {
        clearInterval(mainLoopRef.current);
      }
      // Reset metrics on unmount
      setMetrics({
        systemLoad: 0,
        healthImpact: 0
      });
    };
  }, []);

  // ---------------------
  // 5) RENDER
  // ---------------------
  if (!isEnabled) {
    return (
      <div style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f5f5f5',
        color: '#666'
      }}>
        System Monitoring Task Disabled
      </div>
    );
  }

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'sans-serif'
    }}>
      <div style={{
        background: 'blue',
        color: 'white',
        textAlign: 'center',
        padding: '0.5rem',
        fontWeight: 'bold',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center'
      }}>
        <div>{t('tasks.monitoring.title').toUpperCase()}</div>
      </div>

      {/* Debug metrics panel - can be toggled */}
      {showLog && (
        <div style={{
          position: 'absolute',
          top: '3rem',
          right: '1rem',
          background: 'rgba(0,0,0,0.8)',
          color: 'white',
          padding: '0.5rem',
          borderRadius: '4px',
          fontSize: '0.8rem',
          zIndex: 1000
        }}>
          <div>Active Events: {taskMetrics.activeEvents}</div>
          <div>Total Events: {taskMetrics.totalEvents}</div>
          <div>Hits: {taskMetrics.hits}</div>
          <div>Misses: {taskMetrics.misses}</div>
          <div>False Alarms: {taskMetrics.falseAlarms}</div>
          <div>EPM: {eventsPerMinute}</div>
        </div>
      )}

      {/* Main Content Container */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '2%'
      }}>
        {/* F1, F2 */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '10%',
          width: '100%',
          marginBottom: '5%'
        }}>
          {items.slice(0, 2).map((btn) => {
            const displayColor = btn.eventActive ? btn.colorEvent : btn.colorNormal;
            return (
              <div
                key={btn.label}
                onClick={() => handleResponse(btn.label)}
                onTouchStart={() => handleResponse(btn.label)}
                style={{
                  background: displayColor,
                  width: '15%',
                  aspectRatio: '4/3',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#fff',
                  borderRadius: '5px',
                  userSelect: 'none',
                  fontSize: 'clamp(0.8rem, 2vw, 1.2rem)'
                }}
              >
                {btn.label}
              </div>
            );
          })}
        </div>

        {/* Gauges: F3-F6 */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '8%',
          width: '100%'
        }}>
          {items.slice(2).map((gauge) => {
            const cells = Array.from({ length: 11 }, (_, i) => i);
            return (
              <div
                key={gauge.label}
                style={{
                  display: 'flex',
                  flexDirection: 'column-reverse',
                  alignItems: 'center',
                  cursor: 'pointer',
                  userSelect: 'none',
                  width: '8%'
                }}
                onClick={() => handleResponse(gauge.label)}
                onTouchStart={() => handleResponse(gauge.label)}
              >
                <div style={{
                  width: '100%',
                  height: '20vh',
                  border: '1px solid #333',
                  display: 'flex',
                  flexDirection: 'column-reverse',
                  marginBottom: '0.5rem',
                }}>
                  {cells.map((cellIndex) => {
                    // "Bad" range if <3 or >7
                    const isOutOfNormal = cellIndex < 3 || cellIndex > 7;
                    // highlight [level-1, level, level+1]
                    const isInRange = (
                      cellIndex >= gauge.level - 1 &&
                      cellIndex <= gauge.level + 1
                    );

                    let backgroundColor;
                    if (isOutOfNormal) {
                      // Light red base
                      backgroundColor = '#FFEEEE';
                      if (isInRange) {
                        // darker red highlight
                        backgroundColor = '#FFCCCC';
                      }
                    } else {
                      // Light gray
                      backgroundColor = '#B0BEC5';
                      if (isInRange) {
                        backgroundColor = '#607D8B';
                      }
                    }

                    // Yellow dot if cellIndex == gauge.level
                    let content = null;
                    if (cellIndex === gauge.level) {
                      content = (
                        <span style={{ color: 'yellow', fontSize: '0.7rem' }}>
                          ●
                        </span>
                      );
                    }

                    return (
                      <div
                        key={cellIndex}
                        style={{
                          flex: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: backgroundColor,
                          borderTop: '1px solid #eee',
                        }}
                      >
                        {content}
                      </div>
                    );
                  })}
                </div>
                <div style={{ fontSize: 'clamp(0.8rem, 1.5vw, 1.1rem)' }}>
                  {gauge.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// First define the Log component
const Log = ({ eventLog }) => {
  const { t } = useTranslation();
  const scrollRef = useAutoScroll();

  const handleExport = () => {
    downloadCSV(eventLog, 'monitoring-log');
  };

  if (!eventLog || eventLog.length === 0) {
    return <div>No monitoring events recorded</div>;
  }

  // Get last 50 entries
  const recentLogs = eventLog.slice(-50);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
        <button
          onClick={handleExport}
          style={{
            padding: '0.25rem 0.5rem',
            background: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Export CSV
        </button>
      </div>
      <div ref={scrollRef} style={{ width: '100%', overflowX: 'auto', maxHeight: '300px', overflowY: 'auto' }}>
        <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #ccc' }}>
              <th style={{ padding: '0.5rem' }}>{t('scoreboard.time')}</th>
              <th style={{ padding: '0.5rem' }}>Label</th>
              <th style={{ padding: '0.5rem' }}>Type</th>
              <th style={{ padding: '0.5rem' }}>RT (ms)</th>
            </tr>
          </thead>
          <tbody>
            {recentLogs.map((entry) => (
              <tr key={entry.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '0.5rem' }}>
                  {new Date(entry.timestamp).toLocaleTimeString()}
                </td>
                <td style={{ padding: '0.5rem' }}>{entry.label}</td>
                <td style={{ padding: '0.5rem' }}>{entry.type}</td>
                <td style={{ padding: '0.5rem' }}>{entry.responseTime || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Then create the forwarded ref component
const MonitoringTaskWithRef = forwardRef(MonitoringTask);

// Attach the Log component
MonitoringTaskWithRef.Log = Log;

// Finally export the component
export default MonitoringTaskWithRef;
