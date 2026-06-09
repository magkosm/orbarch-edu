/**
 * ResourceManagementTask — the Resource Management task of MATB-II.
 *
 * The operator keeps the two main tanks (A/B) within tolerance by toggling
 * pumps that transfer fuel between tanks, while pumps occasionally fail.
 * Deviation from target levels drives the shared System Health gauge.
 *
 * Part of the Orbital Architecture project. MIT License — see LICENSE.
 */
import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import Tank from './components/Tank';
import Pump from './components/Pump';
import Connection from './components/Connection';
import './components/Connection.css';
import StatusDisplay from './components/StatusDisplay';
import { useAutoScroll } from './hooks/useAutoScroll';
import { downloadCSV } from './utils/csvExport';
import { RESOURCE_CONFIG } from './config/simulationConfig';

// Constants for initial setup using Config
const INITIAL_STATE = {
  tanks: {
    a: { level: RESOURCE_CONFIG.TANKS.A.TARGET, max: RESOURCE_CONFIG.TANKS.A.MAX, target: RESOURCE_CONFIG.TANKS.A.TARGET, depletable: true, lossPerMinute: RESOURCE_CONFIG.TANKS.A.LOSS_RATE },
    b: { level: RESOURCE_CONFIG.TANKS.B.TARGET, max: RESOURCE_CONFIG.TANKS.B.MAX, target: RESOURCE_CONFIG.TANKS.B.TARGET, depletable: true, lossPerMinute: RESOURCE_CONFIG.TANKS.B.LOSS_RATE },
    c: { level: 1000, max: RESOURCE_CONFIG.TANKS.C.MAX, target: null, depletable: true, lossPerMinute: 0 },
    d: { level: 1000, max: RESOURCE_CONFIG.TANKS.D.MAX, target: null, depletable: true, lossPerMinute: 0 },
    e: { level: 3000, max: RESOURCE_CONFIG.TANKS.E.MAX, target: null, depletable: false, lossPerMinute: 0 },
    f: { level: 3000, max: RESOURCE_CONFIG.TANKS.F.MAX, target: null, depletable: false, lossPerMinute: 0 }
  },
  pumps: {
    1: { flow: RESOURCE_CONFIG.PUMPS.MAIN, state: 'off', fromTank: 'c', toTank: 'a' },
    2: { flow: RESOURCE_CONFIG.PUMPS.SEC, state: 'off', fromTank: 'e', toTank: 'a' },
    3: { flow: RESOURCE_CONFIG.PUMPS.MAIN, state: 'off', fromTank: 'd', toTank: 'b' },
    4: { flow: RESOURCE_CONFIG.PUMPS.SEC, state: 'off', fromTank: 'f', toTank: 'b' },
    5: { flow: RESOURCE_CONFIG.PUMPS.SEC, state: 'off', fromTank: 'e', toTank: 'c' },
    6: { flow: RESOURCE_CONFIG.PUMPS.SEC, state: 'off', fromTank: 'f', toTank: 'd' },
    7: { flow: RESOURCE_CONFIG.PUMPS.XFER, state: 'off', fromTank: 'a', toTank: 'b' },
    8: { flow: RESOURCE_CONFIG.PUMPS.XFER, state: 'off', fromTank: 'b', toTank: 'a' }
  },
  failures: new Set()
};

// Constants for difficulty scaling
const MIN_LOSS_MULTIPLIER = RESOURCE_CONFIG.DIFFICULTY.MIN_LOSS_MULTIPLIER;
const MAX_LOSS_MULTIPLIER = RESOURCE_CONFIG.DIFFICULTY.MAX_LOSS_MULTIPLIER;

// Define Log component
function ResourceManagementLog({ resourceLog }) {
  const { t } = useTranslation();
  const scrollRef = useAutoScroll();

  // Ensure resourceLog is always an array
  const safeLog = Array.isArray(resourceLog) ? resourceLog : [];

  const handleExport = () => {
    downloadCSV(safeLog, 'resource-management-log');
  };

  if (!safeLog || safeLog.length === 0) {
    return <div>No resource events recorded</div>;
  }

  const recentLogs = safeLog.slice(-50);

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
              <th style={{ padding: '0.5rem' }}>{t('tasks.resource.tank')} A</th>
              <th style={{ padding: '0.5rem' }}>{t('tasks.resource.tank')} B</th>
              <th style={{ padding: '0.5rem' }}>{t('tasks.resource.diff')} A</th>
              <th style={{ padding: '0.5rem' }}>{t('tasks.resource.diff')} B</th>
              <th style={{ padding: '0.5rem' }}>{t('tasks.resource.activePumps')}</th>
              <th style={{ padding: '0.5rem' }}>{t('tasks.resource.failedPumps')}</th>
              <th style={{ padding: '0.5rem' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {recentLogs.map((entry, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '0.5rem' }}>
                  {new Date(entry.time).toLocaleTimeString()}
                </td>
                <td style={{ padding: '0.5rem' }}>{entry.tankA}</td>
                <td style={{ padding: '0.5rem' }}>{entry.tankB}</td>
                <td style={{ padding: '0.5rem' }}>{entry.diffA}</td>
                <td style={{ padding: '0.5rem' }}>{entry.diffB}</td>
                <td style={{ padding: '0.5rem' }}>{entry.activePumps}</td>
                <td style={{ padding: '0.5rem' }}>{entry.failedPumps}</td>
                <td style={{
                  padding: '0.5rem',
                  color: entry.corrA && entry.corrB ? 'green' : 'red'
                }}>
                  {entry.corrA && entry.corrB ? '✓' : '✗'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Add these constants at the top with other constants
// Use ranges from Config
const FUEL_RANGES = {
  CRITICAL: { min: 1000, max: 4000, impact: RESOURCE_CONFIG.RANGES.CRITICAL.SCORE },
  WARNING: { min: 2250, max: 2750, impact: RESOURCE_CONFIG.RANGES.WARNING.SCORE },
  NEUTRAL: { min: 2400, max: 2600, impact: RESOURCE_CONFIG.RANGES.NEUTRAL.SCORE },
  OPTIMAL: { min: 2400, max: 2600, impact: RESOURCE_CONFIG.RANGES.OPTIMAL.SCORE }
};

// Define main component
function ResourceManagementTaskComponent({
  eventsPerMinute = 2,
  difficulty = 5,
  showLog = true,
  onLogUpdate,
  onMetricsUpdate,
  isEnabled = true,
  autoEvents = false
}, ref) {
  const { t } = useTranslation();
  const containerRef = useRef(null);
  const [tanks, setTanks] = useState(INITIAL_STATE.tanks);
  const [pumps, setPumps] = useState(INITIAL_STATE.pumps);
  const [tankPositions, setTankPositions] = useState({});
  const [pumpPositions, setPumpPositions] = useState({});
  const [failures, setFailures] = useState(INITIAL_STATE.failures);
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  const [resourceLog, setResourceLog] = useState([]);
  const [lossMultiplier, setLossMultiplier] = useState(0.5); // Default 50%
  const [lastLogTime, setLastLogTime] = useState(Date.now());
  const lastMetricsStringRef = useRef('');
  const [repairingPumps, setRepairingPumps] = useState(() => new Set());
  const [healthImpact, setHealthImpact] = useState(0);
  const [systemLoad, setSystemLoad] = useState(0);
  const [currentDifficulty, setCurrentDifficulty] = useState(difficulty);
  const [isPaused, setIsPaused] = useState(false);
  const pumpTimeoutsRef = useRef({});

  // Calculate and store positions of tanks and pumps
  useEffect(() => {
    if (!containerRef.current) return;

    // Use offset dimensions (layout px) rather than getBoundingClientRect:
    // these are unaffected by any CSS transform/scale applied to ancestors
    // (e.g. the phone fit-to-screen scaling), keeping tank/pump positions
    // correct. On desktop (no transform) the values are identical.
    const contentWidth = containerRef.current.offsetWidth;
    const contentHeight = containerRef.current.offsetHeight - 40; // Account for title bar

    // Base positions as percentages (adjusted for better spacing)
    const basePositions = {
      a: { x: 30, y: 25 },
      b: { x: 70, y: 25 },
      c: { x: 20, y: 75 },
      d: { x: 60, y: 75 },
      e: { x: 40, y: 75 },
      f: { x: 80, y: 75 }
    };

    // Calculate actual positions
    const newTankPositions = {};
    Object.entries(basePositions).forEach(([key, pos]) => {
      newTankPositions[key] = {
        x: (pos.x * contentWidth) / 100,
        y: (pos.y * contentHeight) / 100
      };
    });

    setTankPositions(newTankPositions);
    setPumpPositions(calculatePumpPositions(newTankPositions));
  }, [containerRef.current?.offsetWidth, containerRef.current?.offsetHeight]);

  // Helper function to calculate pump positions
  const calculatePumpPositions = (tankPos) => {
    const positions = {};
    Object.entries(INITIAL_STATE.pumps).forEach(([id, pump]) => {
      const fromTank = tankPos[pump.fromTank];
      const toTank = tankPos[pump.toTank];

      if (id === '7' || id === '8') {
        // Horizontal pumps between A and B - closer together
        const yOffset = id === '7' ? -8 : 8;  // Reduced vertical offset
        positions[id] = {
          x: (fromTank.x + toTank.x) / 2,
          y: fromTank.y + (yOffset * containerRef.current.offsetHeight / 100)
        };
      } else if (id === '5' || id === '6') {
        // Pumps 5 and 6 exactly centered
        positions[id] = {
          x: (fromTank.x + toTank.x) / 2,
          y: (fromTank.y + toTank.y) / 2
        };
      } else {
        // Pumps 1-4 closer to their diagonal lines
        const xOffset = (id === '1' || id === '3') ? -1 : 1;  // Minimal horizontal offset
        positions[id] = {
          x: (fromTank.x + toTank.x) / 2 + (xOffset * containerRef.current.offsetWidth / 100),
          y: (fromTank.y + toTank.y) / 1.8
        };
      }
    });
    return positions;
  };

  // Modify togglePump to be more robust - DEFINE BEFORE handleKeyPress
  const togglePump = useCallback((pumpId) => {
    if (isPaused) return;

    // console.log(`Attempting to toggle pump ${pumpId}`, {
    //   currentState: pumps[pumpId]?.state,
    //   isFailed: failures.has(pumpId)
    // });

    // Check both the failures Set and the pump's state
    if (failures.has(pumpId) || pumps[pumpId]?.state === 'failure') {
      // console.log(`Cannot toggle pump ${pumpId} - failed`);
      return;
    }

    setPumps(prev => {
      const pump = prev[pumpId];
      if (!pump) return prev;

      const newState = pump.state === 'on' ? 'off' : 'on';
      // console.log(`Toggling pump ${pumpId} from ${pump.state} to ${newState}`);

      return {
        ...prev,
        [pumpId]: {
          ...pump,
          state: newState
        }
      };
    });
  }, [isPaused, failures, pumps]);

  // Handle keyboard controls
  const handleKeyPress = useCallback((event) => {
    if (isPaused) return;
    const key = event.key;
    if (/[1-8]/.test(key)) {
      const pumpId = key;
      if (!failures.has(pumpId)) {
        togglePump(pumpId);
      }
    }
  }, [failures, isPaused, togglePump]);

  // Add keyboard event listeners
  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [handleKeyPress]);

  // Schedule pump failures based on EPM
  useEffect(() => {
    if (!isEnabled || !autoEvents || isPaused) return; // Skip if autoEvents is false or paused

    const failureInterval = setInterval(() => {
      const workingPumps = Object.keys(pumps).filter(id =>
        !failures.has(id) &&
        !repairingPumps.has(id) &&
        pumps[id].state !== 'failure'
      );

      if (workingPumps.length === 0) return;

      const baseFailureChance = 0.01; // Base failure chance
      const epmMultiplier = eventsPerMinute / 2;
      const totalChance = Math.min(baseFailureChance * epmMultiplier, 0.1); // Cap at 10%

      // Determine if any pump should fail this interval using a single random check
      if (Math.random() < totalChance * workingPumps.length) {
        // We'll fail 1 to 2 pumps based on EPM
        const maxPumpsToFail = Math.min(
          Math.ceil(eventsPerMinute / 3),  // Higher EPM means more failures at once
          workingPumps.length,              // Can't fail more than available
          2                                 // Cap at 2 pumps per interval
        );

        // At least 1 pump will fail if we got here
        const numPumpsToFail = Math.max(1, Math.floor(Math.random() * maxPumpsToFail + 1));

        // Properly shuffle the array using Fisher-Yates algorithm
        const shuffledPumps = [...workingPumps];
        for (let i = shuffledPumps.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffledPumps[i], shuffledPumps[j]] = [shuffledPumps[j], shuffledPumps[i]];
        }

        // Select a random subset of pumps to fail
        const pumpsThatWillFail = shuffledPumps.slice(0, numPumpsToFail);

        // console.log(`${pumpsThatWillFail.length} pumps failing automatically (randomly selected): ${pumpsThatWillFail.join(', ')}`);

        // Create new state objects for batch updates
        const newFailures = new Set([...failures, ...pumpsThatWillFail]);
        const newRepairing = new Set([...repairingPumps, ...pumpsThatWillFail]);
        const newPumps = { ...pumps };

        // Update all pumps that will fail
        pumpsThatWillFail.forEach(pumpId => {
          newPumps[pumpId] = { ...newPumps[pumpId], state: 'failure' };
        });

        // Apply all updates at once
        setFailures(newFailures);
        setRepairingPumps(newRepairing);
        setPumps(newPumps);

        // Log failures
        pumpsThatWillFail.forEach(pumpId => {
          logSnapshot({
            event: 'PUMP_FAILURE',
            pumpId: pumpId
          });
        });

        // Schedule repairs for each pump
        pumpsThatWillFail.forEach(pumpId => {
          const repairTime = Math.max(5000, 15000 - (eventsPerMinute * 1000));
          setTimeout(() => {
            setRepairingPumps(curr => {
              const updated = new Set(curr);
              updated.delete(pumpId);
              return updated;
            });
            setFailures(curr => {
              const updated = new Set(curr);
              updated.delete(pumpId);
              return updated;
            });
            setPumps(curr => ({
              ...curr,
              [pumpId]: { ...curr[pumpId], state: 'off' }
            }));

            // Log the repair event
            logSnapshot({
              event: 'PUMP_REPAIRED',
              pumpId: pumpId
            });

            // console.log(`Pump ${pumpId} repaired automatically after ${repairTime/1000}s`);
          }, repairTime);
        });
      }
    }, 1000);

    return () => clearInterval(failureInterval);
  }, [failures, pumps, repairingPumps, eventsPerMinute, isEnabled, autoEvents, isPaused]);

  // Add debug logging for loss rate
  useEffect(() => {
    // console.log('Loss Rate:', {
    //   difficulty,
    //   lossMultiplier,
    //   tankALoss: tanks.a.lossPerMinute * lossMultiplier,
    //   tankBLoss: tanks.b.lossPerMinute * lossMultiplier
    // });
  }, [difficulty, lossMultiplier]);

  // Add debug logging for pump operations
  useEffect(() => {
    const operationalPumps = Object.entries(pumps)
      .filter(([id, pump]) => pump.state === 'on' && !failures.has(id))
      .map(([id]) => id);

    console.log('Operational Pumps:', {
      pumps: operationalPumps,
      failures: Array.from(failures),
      states: Object.entries(pumps).map(([id, pump]) => ({
        id,
        state: pump.state,
        failed: failures.has(id)
      }))
    });
  }, [pumps, failures]);

  // Calculate loss multiplier when difficulty changes
  useEffect(() => {
    const normalizedDifficulty = difficulty / 10; // Convert 0-10 to 0-1
    const multiplier = MIN_LOSS_MULTIPLIER +
      (MAX_LOSS_MULTIPLIER - MIN_LOSS_MULTIPLIER) * normalizedDifficulty;
    setLossMultiplier(multiplier);
  }, [difficulty]);

  // Modify tank depletion to use loss multiplier
  useEffect(() => {
    if (!isEnabled) return;

    const interval = setInterval(() => {
      const now = Date.now();

      // If paused, just update the timestamp and skip processing
      if (isPaused) {
        setLastUpdate(now);
        return;
      }

      const deltaTime = (now - lastUpdate) / 1000;

      setTanks(prevTanks => {
        const newTanks = { ...prevTanks };

        // Apply tank depletion with difficulty multiplier
        Object.entries(newTanks).forEach(([tankId, tank]) => {
          if (tank.depletable && tank.lossPerMinute > 0) {
            const adjustedLossRate = tank.lossPerMinute * lossMultiplier;
            const loss = (adjustedLossRate / 60) * deltaTime;
            newTanks[tankId].level = Math.max(0, tank.level - loss);
          }
        });

        // Apply pump transfers - only for working pumps
        Object.entries(pumps).forEach(([pumpId, pump]) => {
          // Check both failures Set and pump state
          const isPumpWorking = pump.state === 'on' &&
            !failures.has(pumpId) &&
            pump.state !== 'failure';

          if (isPumpWorking) {
            const flow = (pump.flow / 60) * deltaTime;
            const fromTank = newTanks[pump.fromTank];
            const toTank = newTanks[pump.toTank];

            // Calculate actual flow based on available fuel and tank capacity
            const availableFlow = Math.min(
              flow,
              fromTank.depletable ? fromTank.level : flow,
              toTank.max - toTank.level
            );

            if (fromTank.depletable) {
              newTanks[pump.fromTank].level = Math.max(0, fromTank.level - availableFlow);
            }
            newTanks[pump.toTank].level = Math.min(toTank.max, toTank.level + availableFlow);
          }
        });

        return newTanks;
      });

      setLastUpdate(now);
    }, 100);

    return () => clearInterval(interval);
  }, [pumps, lastUpdate, failures, lossMultiplier, isEnabled, isPaused]);

  // Add to your existing state declarations
  const logRow = useCallback((row) => {
    if (!isEnabled) return;

    setResourceLog(prev => {
      const newLog = [...prev, row];
      // Call external handler in the next tick to avoid render conflicts
      setTimeout(() => onLogUpdate?.(newLog), 0);
      return newLog;
    });
  }, [isEnabled, onLogUpdate]);

  // Add logging to your existing tank level updates
  useEffect(() => {
    if (isPaused) return;

    const now = Date.now();

    // Only log if 1 second has passed since last log AND the task is enabled
    if (now - lastLogTime >= 1000 && isEnabled) {
      const tankALevel = Math.round(tanks.a.level);
      const tankBLevel = Math.round(tanks.b.level);
      const corrA = tankALevel >= 2250 && tankALevel <= 2750;
      const corrB = tankBLevel >= 2250 && tankBLevel <= 2750;

      // Create the log entry
      const logEntry = {
        time: now,
        tankA: tankALevel,
        tankB: tankBLevel,
        diffA: Math.round(Math.abs(tanks.a.level - tanks.a.target)),
        diffB: Math.round(Math.abs(tanks.b.level - tanks.b.target)),
        activePumps: Object.entries(pumps).filter(([_, p]) => p.state === 'on').length,
        failedPumps: failures.size,
        corrA,
        corrB
      };

      // Use logRow instead of direct state updates
      logRow(logEntry);
      setLastLogTime(now);
    }
  }, [tanks, pumps, failures, isEnabled]);

  // -------------------------
  // Helper Functions
  // -------------------------

  /**
   * Calculates the absolute difference between the tank level and its target.
   * @param {Object} tank - The tank object containing level and target.
   * @returns {number} - The absolute difference.
   */
  const calculateDifference = (tank) => {
    return Math.abs(tank.level - tank.target);
  };

  /**
   * Returns the number of active pumps.
   * @returns {number} - Count of pumps that are currently on.
   */
  const getActivePumps = () => {
    return Object.values(pumps).filter(pump => pump.state === 'on').length;
  };

  // Reset function
  const resetTask = () => {
    // Reset tanks to initial state with exact values
    // Reset tanks to initial state with exact values
    setTanks({
      a: { level: RESOURCE_CONFIG.TANKS.A.TARGET, max: RESOURCE_CONFIG.TANKS.A.MAX, target: RESOURCE_CONFIG.TANKS.A.TARGET, depletable: true, lossPerMinute: RESOURCE_CONFIG.TANKS.A.LOSS_RATE },
      b: { level: RESOURCE_CONFIG.TANKS.B.TARGET, max: RESOURCE_CONFIG.TANKS.B.MAX, target: RESOURCE_CONFIG.TANKS.B.TARGET, depletable: true, lossPerMinute: RESOURCE_CONFIG.TANKS.B.LOSS_RATE },
      c: { level: 1000, max: RESOURCE_CONFIG.TANKS.C.MAX, target: null, depletable: true, lossPerMinute: 0 },
      d: { level: 1000, max: RESOURCE_CONFIG.TANKS.D.MAX, target: null, depletable: true, lossPerMinute: 0 },
      e: { level: 3000, max: RESOURCE_CONFIG.TANKS.E.MAX, target: null, depletable: false, lossPerMinute: 0 },
      f: { level: 3000, max: RESOURCE_CONFIG.TANKS.F.MAX, target: null, depletable: false, lossPerMinute: 0 }
    });

    // Reset all pumps to off state
    // Reset all pumps to off state
    setPumps({
      1: { flow: RESOURCE_CONFIG.PUMPS.MAIN, state: 'off', fromTank: 'c', toTank: 'a' },
      2: { flow: RESOURCE_CONFIG.PUMPS.SEC, state: 'off', fromTank: 'e', toTank: 'a' },
      3: { flow: RESOURCE_CONFIG.PUMPS.MAIN, state: 'off', fromTank: 'd', toTank: 'b' },
      4: { flow: RESOURCE_CONFIG.PUMPS.SEC, state: 'off', fromTank: 'f', toTank: 'b' },
      5: { flow: RESOURCE_CONFIG.PUMPS.SEC, state: 'off', fromTank: 'e', toTank: 'c' },
      6: { flow: RESOURCE_CONFIG.PUMPS.SEC, state: 'off', fromTank: 'f', toTank: 'd' },
      7: { flow: RESOURCE_CONFIG.PUMPS.XFER, state: 'off', fromTank: 'a', toTank: 'b' },
      8: { flow: RESOURCE_CONFIG.PUMPS.XFER, state: 'off', fromTank: 'b', toTank: 'a' }
    });

    // Clear all failures
    setFailures(new Set());

    // Reset all timers and logs
    setResourceLog([]);
    setLastUpdate(Date.now());
    setLastLogTime(Date.now());

    // Reset difficulty-related settings
    setLossMultiplier(MIN_LOSS_MULTIPLIER +
      (MAX_LOSS_MULTIPLIER - MIN_LOSS_MULTIPLIER) * (difficulty / 10));
    onLogUpdate?.([]);  // Also clear external logs
  };

  // Expose resetTask to ref
  useImperativeHandle(ref, () => ({
    resetTask,
    togglePause: () => {
      setIsPaused(prev => !prev);
      return !isPaused;
    },
    setPause: (shouldPause) => {
      setIsPaused(shouldPause);
      return shouldPause;
    },
    isPaused: () => isPaused,
    triggerPumpFailure: (config) => {
      if (isPaused) return false;
      try {
        const { pumpId, duration } = config;

        // Validate pump ID
        if (!pumpId || !pumps[pumpId]) {
          // console.error('Invalid pump ID specified');
          return false;
        }

        // Check if pump is already failed or being repaired
        if (failures.has(pumpId) || repairingPumps.has(pumpId) || pumps[pumpId].state === 'failure') {
          // console.log(`Pump ${pumpId} is already failed or being repaired`);
          return false;
        }

        // console.log(`Manually triggering failure for pump ${pumpId}`);

        // Add pump to failures set
        setFailures(prev => new Set([...prev, pumpId]));

        // Update pump state
        setPumps(prev => ({
          ...prev,
          [pumpId]: { ...prev[pumpId], state: 'failure' }
        }));

        // Track that it's in repair process
        setRepairingPumps(prev => {
          const next = new Set(prev);
          next.add(pumpId);
          return next;
        });

        // Log the pump failure event
        logSnapshot({
          event: 'PUMP_FAILURE',
          pumpId: pumpId
        });

        // Schedule repair
        const repairTime = duration || Math.max(5000, 10000);

        // Set up timeout to repair pump
        const timeoutId = setTimeout(() => {
          // Remove from failures and repairing sets
          setFailures(prev => {
            const next = new Set(prev);
            next.delete(pumpId);
            return next;
          });

          setRepairingPumps(prev => {
            const next = new Set(prev);
            next.delete(pumpId);
            return next;
          });

          // Update pump state
          setPumps(prev => ({
            ...prev,
            [pumpId]: { ...prev[pumpId], state: 'off' }
          }));

          // Log the repair event
          logSnapshot({
            event: 'PUMP_REPAIRED',
            pumpId: pumpId
          });
        }, repairTime);

        // Store timeout ID for cleanup
        pumpTimeoutsRef.current[pumpId] = timeoutId;

        return true;
      } catch (error) {
        console.error('Error triggering pump failure:', error);
        return false;
      }
    },
    setDifficulty: (value) => {
      console.log('ResourceManagementTask: Setting difficulty to', value);
      // Update difficulty state
      setCurrentDifficulty(value);

      // Adjust failure rates and fuel loss based on difficulty
      const baseFailureRate = 0.1; // 10% base chance per check
      const baseFuelLoss = 0.5; // Base fuel loss rate

      // Scale failure rate and fuel loss with difficulty
      const failureRate = baseFailureRate * (1 + (value - 5) * 0.2); // 0.06 at diff 1, 0.2 at diff 10
      const fuelLoss = baseFuelLoss * (1 + (value - 5) * 0.3); // 0.2 at diff 1, 1.0 at diff 10

      // Update the rates
      setLossMultiplier(fuelLoss);

      // Log the change
      logSnapshot({
        event: 'DIFFICULTY_CHANGED',
        newDifficulty: value,
        failureRate: failureRate,
        fuelLossRate: fuelLoss
      });
    },
    triggerMultiplePumpFailures: (config) => {
      if (isPaused) return false;
      try {
        const { count, duration } = config;

        // console.log(`ResourceManagementTask: triggerMultiplePumpFailures called with config:`, config);

        // Validate count (1-8)
        const pumpCount = Math.min(8, Math.max(1, count || 1));

        // Get all available working pumps
        const availablePumps = Object.keys(pumps).filter(id =>
          !failures.has(id) &&
          !repairingPumps.has(id) &&
          pumps[id].state !== 'failure'
        );

        // console.log(`Available pumps for failure: ${availablePumps.length}`, availablePumps);

        if (availablePumps.length === 0) {
          // console.log('No available pumps to fail');
          return false;
        }

        // Properly shuffle the array using Fisher-Yates algorithm
        const shuffledPumps = [...availablePumps];
        for (let i = shuffledPumps.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffledPumps[i], shuffledPumps[j]] = [shuffledPumps[j], shuffledPumps[i]];
        }

        // Take only as many as requested or available
        const pumpsThatWillFail = shuffledPumps.slice(0, Math.min(pumpCount, availablePumps.length));

        // console.log(`Will fail ${pumpsThatWillFail.length} pumps out of ${pumpCount} requested: ${pumpsThatWillFail.join(', ')}`);

        // Create new failure and repairing sets by adding all failing pumps at once
        const newFailures = new Set([...failures, ...pumpsThatWillFail]);
        const newRepairing = new Set([...repairingPumps, ...pumpsThatWillFail]);

        // Create new pumps object with all failures applied
        const newPumps = { ...pumps };
        pumpsThatWillFail.forEach(pumpId => {
          newPumps[pumpId] = { ...newPumps[pumpId], state: 'failure' };
        });

        // console.log(`Current failures: ${Array.from(failures).join(', ')}`);
        // console.log(`New failures: ${Array.from(newFailures).join(', ')}`);

        // Apply all changes at once
        setFailures(newFailures);
        setRepairingPumps(newRepairing);
        setPumps(newPumps);

        // console.log(`State updates applied for ${pumpsThatWillFail.length} pump failures`);

        // Log the pump failure event
        logSnapshot({
          event: 'MULTIPLE_PUMP_FAILURE',
          pumpIds: pumpsThatWillFail.join(','),
          count: pumpsThatWillFail.length
        });

        // Schedule repair for all failed pumps
        const repairTime = duration || Math.max(5000, 10000);
        setTimeout(() => {
          // Create new states for all updates
          const repairedPumps = { ...pumps };

          // Set all failed pumps to off state
          pumpsThatWillFail.forEach(pumpId => {
            repairedPumps[pumpId] = { ...repairedPumps[pumpId], state: 'off' };
          });

          // Apply all updates at once
          setRepairingPumps(curr => {
            const updated = new Set(curr);
            pumpsThatWillFail.forEach(pumpId => updated.delete(pumpId));
            return updated;
          });

          setFailures(curr => {
            const updated = new Set(curr);
            pumpsThatWillFail.forEach(pumpId => updated.delete(pumpId));
            return updated;
          });

          setPumps(repairedPumps);

          // Log the repair event
          logSnapshot({
            event: 'MULTIPLE_PUMP_REPAIRED',
            pumpIds: pumpsThatWillFail.join(','),
            count: pumpsThatWillFail.length
          });

          // console.log(`All ${pumpsThatWillFail.length} pumps repaired after ${repairTime/1000}s`);
        }, repairTime);

        return true;
      } catch (error) {
        // console.error('Error triggering multiple pump failures:', error);
        return false;
      }
    },
    setFuelLossRate: (multiplier, duration) => {
      if (isPaused) return false;
      try {
        // Validate multiplier (0.1 to 5.0)
        const validMultiplier = Math.min(5.0, Math.max(0.1, multiplier || 1.0));

        // console.log(`ResourceManagementTask: Setting fuel loss rate to ${validMultiplier}x for ${duration/1000}s`);

        // Store the current loss multiplier to restore later
        const previousMultiplier = lossMultiplier;

        // Apply the new loss multiplier
        setLossMultiplier(validMultiplier);

        // Log the fuel loss change event
        logSnapshot({
          event: 'FUEL_LOSS_CHANGE',
          multiplier: validMultiplier,
          duration: duration / 1000
        });

        // Schedule restoration of original multiplier
        const restoreTime = duration || 30000; // Default to 30 seconds
        setTimeout(() => {
          // console.log(`ResourceManagementTask: Restoring fuel loss rate to ${previousMultiplier}x after ${restoreTime/1000}s`);
          setLossMultiplier(previousMultiplier);

          // Log the restoration event
          logSnapshot({
            event: 'FUEL_LOSS_RESTORED',
            multiplier: previousMultiplier
          });
        }, restoreTime);

        return true;
      } catch (error) {
        // console.error('Error setting fuel loss rate:', error);
        return false;
      }
    },
    getMetrics: () => ({
      healthImpact,
      systemLoad
    })
  }));

  // Calculate health impact based on tank states and failures
  const calculateHealthImpact = useCallback(() => {
    let impactPerSecond = 0;
    const TARGET = 2500;

    // Calculate absolute differences from target
    const diffA = Math.abs(tanks.a.level - TARGET);
    const diffB = Math.abs(tanks.b.level - TARGET);

    // Calculate impact per second for each tank
    const getImpactPerSecond = (diff) => {
      if (diff <= 100) return 0.5;      // Within 100 units: +0.5 per sec
      if (diff <= 250) return 0.25;     // Within 250 units: +0.25 per sec
      if (diff <= 500) return 0;        // Within 500 units: no impact
      return -1;                        // More than 500 units: -1 per sec
    };

    impactPerSecond += getImpactPerSecond(diffA);
    impactPerSecond += getImpactPerSecond(diffB);

    // console.log('Health Impact Per Second:', {
    //   tankADiff: diffA,
    //   tankBDiff: diffB,
    //   tankAImpactPerSec: getImpactPerSecond(diffA),
    //   tankBImpactPerSec: getImpactPerSecond(diffB),
    //   totalImpactPerSec: impactPerSecond
    // });

    return impactPerSecond;  // Return per-second rate
  }, [tanks.a.level, tanks.b.level]);

  // Calculate system load based on failures and tank states
  const calculateSystemLoad = useCallback(() => {
    let load = 0;

    // Add load for each failed pump
    load += failures.size * 1; // Each failed pump adds 2 to load

    // Add load for tanks in critical state
    if (tanks.a.level < FUEL_RANGES.CRITICAL.min || tanks.a.level > FUEL_RANGES.CRITICAL.max) {
      load += 5; // Critical tank state adds 3 to load
    }
    if (tanks.b.level < FUEL_RANGES.CRITICAL.min || tanks.b.level > FUEL_RANGES.CRITICAL.max) {
      load += 5; // Critical tank state adds 3 to load
    }

    // Add load for tanks in warning state
    if ((tanks.a.level >= FUEL_RANGES.WARNING.min && tanks.a.level < FUEL_RANGES.OPTIMAL.min) ||
      (tanks.a.level > FUEL_RANGES.OPTIMAL.max && tanks.a.level <= FUEL_RANGES.WARNING.max)) {
      load += 10; // Warning tank state adds 1 to load
    }
    if ((tanks.b.level >= FUEL_RANGES.WARNING.min && tanks.b.level < FUEL_RANGES.OPTIMAL.min) ||
      (tanks.b.level > FUEL_RANGES.OPTIMAL.max && tanks.b.level <= FUEL_RANGES.WARNING.max)) {
      load += 10; // Warning tank state adds 1 to load
    }

    return load;
  }, [failures.size, tanks.a.level, tanks.b.level]);

  // Add this function after calculateSystemLoad
  const calculateResourceLoad = useCallback(() => {
    let load = 0;  // No base load!

    // Add load for failed pumps (2.5 each up to max of 10)
    const failedPumpLoad = Math.min(10, failures.size * 2.5);
    load += failedPumpLoad;

    // Add load for tank states (5 each if in warning or critical)
    const tankAState = getTankState(tanks.a.level);
    const tankBState = getTankState(tanks.b.level);

    // Add 5 for each tank in warning OR critical state
    if (tankAState === 'CRITICAL' || tankAState === 'WARNING') load += 5;
    if (tankBState === 'CRITICAL' || tankBState === 'WARNING') load += 5;

    // console.log('Load Calculation:', {
    //   failedPumpLoad,
    //   tankALoad: (tankAState === 'CRITICAL' || tankAState === 'WARNING') ? 5 : 0,
    //   tankBLoad: (tankBState === 'CRITICAL' || tankBState === 'WARNING') ? 5 : 0,
    //   totalLoad: Math.min(100, Math.max(0, load))
    // });

    return Math.min(100, Math.max(0, load));
  }, [failures.size, tanks.a.level, tanks.b.level]);

  // Helper function to get tank state for logging
  const getTankState = (level) => {
    if (level < FUEL_RANGES.CRITICAL.min || level > FUEL_RANGES.CRITICAL.max) return 'CRITICAL';
    if (level < FUEL_RANGES.WARNING.min || level > FUEL_RANGES.WARNING.max) return 'WARNING';
    return 'NORMAL';
  };

  // Modify the metrics update effect
  useEffect(() => {
    if (!isEnabled || isPaused) {
      if (!isEnabled) {
        onMetricsUpdate?.({ healthImpact: 0, systemLoad: 0 });
      } else {
        // If paused, also send 0 metrics
        onMetricsUpdate?.({ healthImpact: 0, systemLoad: 0 });
      }
      return;
    }

    const updateInterval = setInterval(() => {
      const systemLoad = calculateResourceLoad();
      const healthImpact = calculateHealthImpact();

      onMetricsUpdate?.({
        healthImpact,
        systemLoad
      });

      // console.log('Resource Management Metrics Update:', {
      //   healthImpact,
      //   systemLoad,
      //   activePumps: Object.values(pumps).filter(p => p.state === 'on' && !failures.has(p.id)).length,
      //   failedPumps: failures.size,
      //   tankAState: getTankState(tanks.a.level),
      //   tankBState: getTankState(tanks.b.level)
      // });

    }, 100);

    return () => clearInterval(updateInterval);
  }, [isEnabled, calculateResourceLoad, calculateHealthImpact]);

  // Add the logSnapshot function before the useImperativeHandle hook
  const logSnapshot = (eventData) => {
    // Create a snapshot of the current state
    const snapshot = {
      time: Date.now(),
      tankA: tanks.a.level,
      tankB: tanks.b.level,
      tankC: tanks.c.level,
      tankD: tanks.d.level,
      tankE: tanks.e.level,
      tankF: tanks.f.level,
      activePumps: Object.entries(pumps)
        .filter(([id, pump]) => pump.state === 'on' && !failures.has(id))
        .map(([id]) => id)
        .join(','),
      failedPumps: Array.from(failures).join(','),
      ...eventData
    };

    // Add snapshot to log
    setResourceLog(prev => [...prev, snapshot]);

    // Send to parent component if callback provided
    if (onLogUpdate) {
      onLogUpdate(snapshot);
    }
  };

  // Return placeholder when task is disabled
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
        Resource Management Task Disabled
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Title Bar */}
      <div style={{
        background: 'blue',
        color: 'white',
        textAlign: 'center',
        padding: '0.5rem',
        fontWeight: 'bold',
        flexShrink: 0 // Prevent title from shrinking
      }}>
        <div>{t('tasks.resource.title').toUpperCase()}</div>
      </div>



      {/* Main Content */}
      <div style={{
        flex: 1,
        position: 'relative',
        margin: '2%',
        height: '96%', // Account for margin
        width: '96%'  // Account for margin
      }}>
        {/* Connections */}
        <svg style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none'
        }}>
          {Object.entries(INITIAL_STATE.pumps).map(([id, pump]) => {
            if (!tankPositions[pump.fromTank] || !tankPositions[pump.toTank]) return null;

            // Calculate start and end positions
            let startX = tankPositions[pump.fromTank].x;
            let startY = tankPositions[pump.fromTank].y;
            let endX = tankPositions[pump.toTank].x;
            let endY = tankPositions[pump.toTank].y;

            // Apply vertical offset to horizontal connection lines
            if (id === '7') {
              startY -= 40;
              endY -= 40;
            } else if (id === '8') {
              startY += 40;
              endY += 40;
            }

            return (
              <Connection
                key={`connection-${id}`}
                startX={startX}
                startY={startY}
                endX={endX}
                endY={endY}
                isActive={pumps[id].state === 'on'}
                flowDirection={
                  id === '7' ? 'right' :
                    id === '8' ? 'left' :
                      pump.toTank === 'a' || pump.toTank === 'b' ? 'up' : 'down'
                }
              />
            );
          })}
        </svg>

        {/* Tanks and Pumps */}
        {Object.entries(tankPositions).map(([letter, position]) => (
          <div
            key={`tank-${letter}`}
            style={{
              position: 'absolute',
              left: position.x,
              top: position.y,
              transform: 'translate(-50%, -50%)',
              width: letter === 'a' || letter === 'b' ? '15%' : '10%',
              height: letter === 'a' || letter === 'b' ? '45%' : '27%',
            }}
          >
            <Tank
              letter={letter}
              level={tanks[letter].level}
              maxLevel={tanks[letter].max}
              target={tanks[letter].target}
            />
          </div>
        ))}

        {Object.entries(pumpPositions).map(([id, position]) => (
          <div
            key={`pump-${id}`}
            style={{
              position: 'absolute',
              left: position.x,
              top: position.y,
              transform: 'translate(-50%, -50%)',
              width: '40px',
              height: '40px',
              cursor: 'pointer',
              zIndex: 2
            }}
          >
            <Pump
              id={id}
              state={pumps[id].state}
              flow={pumps[id].flow}
              onClick={() => togglePump(id)}
              orientation={id === '7' || id === '8' ? 'horizontal' : 'vertical'}
              flowDirection={
                INITIAL_STATE.pumps[id].toTank === 'a' ? 'up' :
                  INITIAL_STATE.pumps[id].toTank === 'b' ? 'up' :
                    id === '7' ? 'right' :
                      id === '8' ? 'left' :
                        'down'
              }
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// Create the forwarded ref component
const ResourceManagementTask = forwardRef(ResourceManagementTaskComponent);

// Add Log component as a static property
ResourceManagementTask.Log = ResourceManagementLog;

// Add static method to get default metrics
ResourceManagementTask.getDefaultMetrics = () => ({
  healthImpact: 0,
  systemLoad: 0
});

// Export the component
export default ResourceManagementTask;