// src/App.js
import React, { useState, useCallback, useRef, useEffect } from 'react';
import MonitoringTask from './MonitoringTask';
import CommunicationsTask from './CommunicationsTask';
import ResourceManagementTask from './ResourceManagementTask';
import TrackingTask from './TrackingTask';
import SystemHealth from './components/SystemHealth';
import EnhancedSidebar from './components/EnhancedSidebar';
import MainMenu from './components/MainMenu';
import NormalModeGame from './components/NormalModeGame';
import InfiniteModeGame from './components/InfiniteModeGame';
import CustomModeGame from './components/CustomModeGame';
import eventService from './services/EventService';
import BackgroundSelector from './components/BackgroundSelector';
import BackgroundService from './services/BackgroundService';
import './App.css';
import { useTranslation } from 'react-i18next';
import { COMM_CONFIG } from './config/simulationConfig';

// Helper function to detect mobile devices
const isMobileDevice = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    (navigator.maxTouchPoints && navigator.maxTouchPoints > 1);
};

// Helper function to get the saved input mode (exported for use in MainMenu)
export const getTrackingInputMode = () => {
  const savedMode = localStorage.getItem('trackingInputMode');
  if (savedMode && ['keyboard', 'touch'].includes(savedMode)) {
    return savedMode;
  }
  return isMobileDevice() ? 'touch' : 'keyboard';
};

function App({ isSuiteMode = false, suiteParams = null, onSuiteEnd = null }) {
  const { t } = useTranslation();

  // -------------------------
  // 1) STATE & HANDLERS
  // -------------------------

  // Add loading state
  const [isInitializing, setIsInitializing] = useState(false);

  // Check for startup parameters in localStorage
  const [startupParamsChecked, setStartupParamsChecked] = useState(false);

  // Main Menu state - we'll decide this after checking localStorage
  // Main Menu state - check localStorage synchronously for auto-start params to avoid flash
  const [showMainMenu, setShowMainMenu] = useState(() => {
    // If we're in suite mode, don't show menu
    if (isSuiteMode) return false;
    // Check for params synchronously - if params exist, don't show menu
    try {
      const hasParams = localStorage.getItem('matb_start_params') !== null;
      return !hasParams; // Show menu only if no params
    } catch {
      return true; // Default to showing menu on error
    }
  });

  // Synchronously check startup params to avoid flash
  const initialParams = (() => {
    if (isSuiteMode) return suiteParams;
    try {
      const stored = localStorage.getItem('matb_start_params');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  })();

  // Game mode state
  const [currentGameMode, setCurrentGameMode] = useState(initialParams?.mode || 'testing');
  const [gameDuration, setGameDuration] = useState(initialParams?.duration || 5 * 60 * 1000);
  const [gameResults, setGameResults] = useState(null);

  // Helper to determine if a task is active from initial params
  const isTaskActive = (taskKey) => {
    if (!initialParams) return true;
    if (initialParams.taskConfig?.[taskKey]) return initialParams.taskConfig[taskKey].isActive;
    if (initialParams.tasks) return initialParams.tasks.includes(taskKey);
    return true; // Default to true if not specified
  };

  // Monitoring Task controls
  const [monitoringEPM, setMonitoringEPM] = useState(initialParams?.taskConfig?.monitoring?.eventsPerMinute || 3);
  const [monitoringDifficulty, setMonitoringDifficulty] = useState(initialParams?.taskConfig?.monitoring?.difficulty || 5);
  const [isMonitoringTaskEnabled, setIsMonitoringTaskEnabled] = useState(isTaskActive('monitoring'));
  const [monitoringAutoEvents, setMonitoringAutoEvents] = useState(false);
  const [monitoringEventLog, setMonitoringEventLog] = useState([]);

  // Communications Task controls
  const [commEPM, setCommEPM] = useState(initialParams?.taskConfig?.comm?.eventsPerMinute || COMM_CONFIG.DEFAULT_EPM);
  const [commDifficulty, setCommDifficulty] = useState(initialParams?.taskConfig?.comm?.difficulty || 5);
  const [isCommTaskEnabled, setIsCommTaskEnabled] = useState(isTaskActive('comm'));
  const [commAutoEvents, setCommAutoEvents] = useState(false);
  const [commEventLog, setCommEventLog] = useState([]);
  const [commMetrics, setCommMetrics] = useState({ healthImpact: 0, systemLoad: 0 });

  // Resource Management controls
  const [resourceEPM, setResourceEPM] = useState(initialParams?.taskConfig?.resource?.eventsPerMinute || 2);
  const [resourceDifficulty, setResourceDifficulty] = useState(initialParams?.taskConfig?.resource?.difficulty || 5);
  const [isResourceTaskEnabled, setIsResourceTaskEnabled] = useState(isTaskActive('resource'));
  const [resourceAutoEvents, setResourceAutoEvents] = useState(false);
  const [resourceEventLog, setResourceEventLog] = useState([]);
  const [resourceMetrics, setResourceMetrics] = useState(
    ResourceManagementTask.getDefaultMetrics ?
      ResourceManagementTask.getDefaultMetrics() :
      { healthImpact: 0, systemLoad: 0 }
  );

  // Tracking Task controls
  const [trackingEPM, setTrackingEPM] = useState(initialParams?.taskConfig?.tracking?.eventsPerMinute || 2);
  const [trackingDifficulty, setTrackingDifficulty] = useState(initialParams?.taskConfig?.tracking?.difficulty || 5);
  const [isTrackingTaskEnabled, setIsTrackingTaskEnabled] = useState(isTaskActive('tracking'));
  const [trackingAutoEvents, setTrackingAutoEvents] = useState(false);
  const [trackingEventLog, setTrackingEventLog] = useState([]);
  const [isTrackingManual, setIsTrackingManual] = useState(false);
  const [isInBox, setIsInBox] = useState(false);
  const [trackingMetrics, setTrackingMetrics] = useState(
    TrackingTask.getDefaultMetrics ?
      TrackingTask.getDefaultMetrics() :
      { healthImpact: 0, systemLoad: 0 }
  );

  // Sidebar control
  const [isEventSidebarOpen, setIsEventSidebarOpen] = useState(false);

  // Add state for monitoring metrics
  const [monitoringMetrics, setMonitoringMetrics] = useState({
    healthImpact: 0,
    systemLoad: 0
  });

  // System Performance Log (1Hz health/load)
  const [systemPerformanceLog, setSystemPerformanceLog] = useState([]);

  // Handler for SystemHealth performance updates
  const handlePerformanceUpdate = useCallback((data) => {
    setSystemPerformanceLog(prev => [...prev, data]);
    performanceLogRef.current = [...performanceLogRef.current, data];
  }, []);

  // Inside the App component, add a state for showing the background selector
  const [showBackgroundSelector, setShowBackgroundSelector] = useState(false);

  // Refs
  const commTaskRef = useRef(null);
  const monitoringTaskRef = useRef(null);
  const trackingTaskRef = useRef(null);
  const resourceTaskRef = useRef(null);
  const systemHealthRef = useRef(null);
  const systemHealthValueRef = useRef(100);

  // Log Refs to ensure we have the latest data at all times (especially for suite graduation)
  const commLogRef = useRef([]);
  const monitoringLogRef = useRef([]);
  const trackingLogRef = useRef([]);
  const resourceLogRef = useRef([]);
  const performanceLogRef = useRef([]);

  // Task registration status
  const [tasksRegistered, setTasksRegistered] = useState(false);

  // Mobile detection state
  const [isMobile, setIsMobile] = useState(isMobileDevice());

  // Phone scale-to-fit: render the MATB grid at a fixed design size and
  // uniformly scale it to fit the screen, so every element (buttons, gauges,
  // pumps, text) shrinks together. Null on desktop/tablet (no scaling).
  const [matbGridStyle, setMatbGridStyle] = useState(null);

  // Add state for custom game configuration - initialize from start params if they exist
  const [customGameConfig, setCustomGameConfig] = useState(initialParams?.taskConfig || null);

  // Always use keyboard input mode
  const [trackingInputMode, setTrackingInputMode] = useState('keyboard'); // Default to keyboard input

  // Handler for Monitoring logs
  const handleMonitoringLogUpdate = useCallback((newEntry) => {
    setMonitoringEventLog(prevLog => {
      const updated = Array.isArray(newEntry) ? newEntry : [...prevLog, newEntry];
      monitoringLogRef.current = updated;
      return updated;
    });
  }, []);

  // Handler for Comm logs
  const handleCommLogUpdate = useCallback((newEntry) => {
    setCommEventLog(prevLog => {
      const updated = Array.isArray(newEntry) ? newEntry : [...prevLog, newEntry];
      commLogRef.current = updated;
      return updated;
    });
  }, []);

  // Handler for Resource logs
  const handleResourceLogUpdate = useCallback((newEntry) => {
    setResourceEventLog(prevLog => {
      const updated = Array.isArray(newEntry) ? newEntry : [...prevLog, newEntry];
      resourceLogRef.current = updated;
      return updated;
    });
  }, []);

  // Custom handler to append Tracking logs
  const handleTrackingLogUpdate = useCallback((newEntry) => {
    setTrackingEventLog(prevLog => {
      const updated = Array.isArray(newEntry) ? newEntry : [...prevLog, newEntry];
      trackingLogRef.current = updated;
      return updated;
    });
  }, []);

  // Handle resource metrics update
  const handleResourceMetricsUpdate = useCallback((metrics) => {
    setResourceMetrics(metrics);
  }, []);

  // Handle discrete penalties (one-time deductions)
  const handlePenalty = useCallback((amount) => {
    console.log(`App: Processing penalty of ${amount}`);
    if (systemHealthRef.current) {
      if (typeof systemHealthRef.current.applyDiscretePenalty === 'function') {
        console.log('App: Calling systemHealthRef.applyDiscretePenalty');
        systemHealthRef.current.applyDiscretePenalty(amount);
      } else {
        // Fallback or legacy support
        console.warn('SystemHealth does not support applyDiscretePenalty');
      }
    } else {
      console.warn('App: systemHealthRef is null');
    }
  }, []);

  // Register task refs with the event service when they change
  useEffect(() => {
    // Don't try registering more than once if we've already succeeded
    if (tasksRegistered) return;

    // Skip registration if we're in the main menu
    if (showMainMenu) return;

    // Check if all refs have current values
    // Check if required refs have current values
    // Only check for refs that correspond to enabled tasks
    const allRefsAvailable =
      (!isCommTaskEnabled || commTaskRef?.current) &&
      (!isMonitoringTaskEnabled || monitoringTaskRef?.current) &&
      (!isTrackingTaskEnabled || trackingTaskRef?.current) &&
      (!isResourceTaskEnabled || resourceTaskRef?.current);

    if (allRefsAvailable) {
      console.log('All task refs are available, registering with EventService...');

      // Register the tasks
      const registrationSuccess = eventService.registerTasks(
        commTaskRef,
        monitoringTaskRef,
        trackingTaskRef,
        resourceTaskRef
      );

      // Update registration status
      setTasksRegistered(registrationSuccess);

      if (registrationSuccess) {
        console.log('All tasks successfully registered with event service');
      } else {
        console.warn('Task registration was not successful, some features may not work properly');
      }
    } else {
      // Log which refs are missing
      console.log('Not all task refs are available yet:', {
        commTask: !!commTaskRef?.current,
        monitoringTask: !!monitoringTaskRef?.current,
        trackingTask: !!trackingTaskRef?.current,
        resourceTask: !!resourceTaskRef?.current
      });
    }
  }, [
    showMainMenu,
    tasksRegistered,
    commTaskRef,
    monitoringTaskRef,
    trackingTaskRef,
    resourceTaskRef,
    // Add enabled flags to dependencies
    isCommTaskEnabled,
    isMonitoringTaskEnabled,
    isTrackingTaskEnabled,
    isResourceTaskEnabled
    // These refs need to be in the dependency array to ensure registration happens when they're available
  ]);

  // Reset all tasks to default states - added isSuite parameter to skip timeouts
  const resetAllTasksToDefault = useCallback((isSuite = false) => {
    console.log(`resetAllTasksToDefault: isSuite=${isSuite}`);
    // Stop the event scheduler if running
    eventService.stopScheduler();

    // Pause all tasks explicitly first
    eventService.pauseAllTasks();

    // Reset task-specific states
    setCommEPM(COMM_CONFIG.DEFAULT_EPM);
    setCommDifficulty(5);
    setMonitoringEPM(3);
    setMonitoringDifficulty(5);
    setTrackingEPM(2);
    setTrackingDifficulty(5);
    setResourceEPM(2);
    setResourceDifficulty(5);

    // Reset logs
    setMonitoringEventLog([]);
    setCommEventLog([]);
    setResourceEventLog([]);
    setTrackingEventLog([]);
    setSystemPerformanceLog([]);

    // Reset log refs
    commLogRef.current = [];
    monitoringLogRef.current = [];
    resourceLogRef.current = [];
    trackingLogRef.current = [];
    performanceLogRef.current = [];

    // Reset task enablement
    setIsCommTaskEnabled(true);
    setIsMonitoringTaskEnabled(true);
    setIsTrackingTaskEnabled(true);
    setIsResourceTaskEnabled(true);

    // Reset auto-events
    setMonitoringAutoEvents(false);
    setTrackingAutoEvents(false);
    setCommAutoEvents(false);
    setResourceAutoEvents(false);

    // Reset sidebars
    setIsEventSidebarOpen(false);

    // Reset game mode state
    setGameResults(null);

    // Reset task components explicitly
    if (isSuite) {
      // Synchronous reset for suite mode with a small delay to ensure all resets complete
      console.log('Resetting task components synchronously for suite mode...');
      // Reset all tasks
      if (resourceTaskRef.current?.resetTask) {
        resourceTaskRef.current.resetTask();
        console.log('Resource task reset (suite mode)');
      }
      if (commTaskRef.current?.resetTask) {
        commTaskRef.current.resetTask();
        console.log('Communications task reset (suite mode)');
      } else if (commTaskRef.current?.clearActiveMessage) {
        commTaskRef.current.clearActiveMessage();
        console.log('Communications task cleared (suite mode)');
      }
      if (monitoringTaskRef.current?.resetTask) {
        monitoringTaskRef.current.resetTask();
        console.log('Monitoring task reset (suite mode)');
      }
      if (trackingTaskRef.current?.resetTask) {
        trackingTaskRef.current.resetTask();
        console.log('Tracking task reset (suite mode)');
      }
      if (systemHealthRef.current?.resetHealth) {
        systemHealthRef.current.resetHealth();
        console.log('System health reset (suite mode)');
      }
      systemHealthValueRef.current = 100;

      // Small delay to ensure all resets are applied before next game starts
      setTimeout(() => {
        console.log('Suite mode reset complete - all tasks and gauges reset');
      }, 100);
    } else {
      // Use setTimeout for regular mode to ensure this runs after state updates
      setTimeout(() => {
        console.log('Resetting all task components...');

        // Reset Resource Management task (tanks)
        if (resourceTaskRef.current && typeof resourceTaskRef.current.resetTask === 'function') {
          resourceTaskRef.current.resetTask();
          console.log('Resource task reset');
        }

        // Reset Communications task
        if (commTaskRef.current) {
          if (typeof commTaskRef.current.resetTask === 'function') {
            commTaskRef.current.resetTask();
            console.log('Communications task reset via resetTask');
          } else if (typeof commTaskRef.current.reset === 'function') {
            commTaskRef.current.reset();
            console.log('Communications task reset via reset');
          } else if (typeof commTaskRef.current.clearActiveMessage === 'function') {
            commTaskRef.current.clearActiveMessage();
            console.log('Communications task cleared active message');
          }
        }

        // Reset Monitoring task
        if (monitoringTaskRef.current && typeof monitoringTaskRef.current.resetTask === 'function') {
          monitoringTaskRef.current.resetTask();
          console.log('Monitoring task reset');
        }

        // Reset Tracking task
        if (trackingTaskRef.current && typeof trackingTaskRef.current.resetTask === 'function') {
          trackingTaskRef.current.resetTask();
          console.log('Tracking task reset');
        }

        // Make sure system health is reset too
        if (systemHealthRef.current && typeof systemHealthRef.current.resetHealth === 'function') {
          systemHealthRef.current.resetHealth();
          console.log('System health reset');
        }
        systemHealthValueRef.current = 100;

        // Don't auto-resume tasks here - let game components control their own pause state
        console.log('All tasks reset - pause control remains with game component');
      }, 200);
    }
  }, []);

  // Function to handle starting the game from the main menu
  const startGame = useCallback((options, isSuite = false) => {
    // Get mode and duration from options
    const { mode, duration, taskConfig, trackingInputMode: menuInputMode } = options;

    // Update tracking input mode if provided from menu
    if (menuInputMode) {
      console.log(`App: Setting tracking input mode from menu selection: ${menuInputMode}`);
      setTrackingInputMode(menuInputMode);
    } else {
      // If not provided, refresh from localStorage just to be sure
      const savedMode = localStorage.getItem('trackingInputMode');
      if (savedMode && ['keyboard', 'touch'].includes(savedMode)) {
        console.log(`App: Using tracking input mode from localStorage: ${savedMode}`);
        setTrackingInputMode(savedMode);
      }
    }

    // Reset all tasks to their default states
    resetAllTasksToDefault(isSuite);

    // Set game mode and duration
    setCurrentGameMode(mode);
    if (duration) setGameDuration(duration);

    // For custom mode, store task configuration
    if (mode === 'custom' && taskConfig) {
      setCustomGameConfig(taskConfig);

      // Set task enabled states based on custom configuration
      setIsCommTaskEnabled(taskConfig.comm.isActive);
      setIsMonitoringTaskEnabled(taskConfig.monitoring.isActive);
      setIsTrackingTaskEnabled(taskConfig.tracking.isActive);
      setIsResourceTaskEnabled(taskConfig.resource.isActive);
    }

    // Hide the main menu
    setShowMainMenu(false);

    // Reset the task registration status so it will register again
    setTasksRegistered(false);

    // Reset all tanks explicitly for Normal Mode
    if (mode === 'normal' || mode === 'custom') {
      if (isSuite) {
        // For suite mode, avoid further timeouts
        if (resourceTaskRef.current?.resetTask) resourceTaskRef.current.resetTask();
      } else {
        // Use a small timeout to ensure components are mounted
        setTimeout(() => {
          if (resourceTaskRef.current && typeof resourceTaskRef.current.resetTask === 'function') {
            console.log('Resetting all tanks for game mode');
            resourceTaskRef.current.resetTask();
          } else {
            console.warn('Resource task not available for reset');
          }

          // For normal/custom mode, DON'T auto-resume - let NormalModeGame/CustomModeGame control pause state
          // This prevents the game from running during instruction overlay
          console.log('Game mode started - pause control handed to game component');
        }, 300);
      }
    } else if (mode === 'testing') {
      // For testing mode, resume tasks since there's no instruction overlay
      setTimeout(() => {
        eventService.resumeAllTasks();
        console.log('Testing mode - tasks resumed');
      }, 300);
    }
  }, [
    resetAllTasksToDefault,
    setShowMainMenu,
    setTasksRegistered,
    resourceTaskRef,
    setTrackingInputMode,
    setCurrentGameMode,
    setGameDuration,
    setCustomGameConfig,
    setIsCommTaskEnabled,
    setIsMonitoringTaskEnabled,
    setIsTrackingTaskEnabled,
    setIsResourceTaskEnabled
  ]);

  // Function to handle exiting to the main menu
  const exitToMainMenu = useCallback(() => {
    // Stop the event scheduler
    eventService.stopScheduler();

    // Pause all tasks
    eventService.pauseAllTasks();

    // Show the main menu
    setShowMainMenu(true);

    // Reset task registration status
    setTasksRegistered(false);

    // Clear any stored startup parameters
    localStorage.removeItem('matb_start_params');
  }, []);

  // Handle game end (both Normal Mode and Infinite Mode)
  const handleGameEnd = useCallback((results) => {
    // Preserve the gameMode in the results if it was provided
    const gameMode = results.gameMode || currentGameMode;

    // Collect logs BEFORE any reset happens - using REFS for absolute latest data
    const collectedLogs = isSuiteMode ? {
      comm: Array.isArray(commLogRef.current) ? [...commLogRef.current] : [],
      resource: Array.isArray(resourceLogRef.current) ? [...resourceLogRef.current] : [],
      monitoring: Array.isArray(monitoringLogRef.current) ? [...monitoringLogRef.current] : [],
      tracking: Array.isArray(trackingLogRef.current) ? [...trackingLogRef.current] : [],
      performance: Array.isArray(performanceLogRef.current) ? [...performanceLogRef.current] : []
    } : null;

    // Debug logging for suite mode
    if (isSuiteMode && collectedLogs) {
      // No logs here
    }

    // Create a standardized result object with the mode included
    const standardizedResults = {
      ...results,
      gameMode,
      // Inject logs for suite mode summary export
      trialLogs: collectedLogs
    };

    // Update the game results state with the standardized object
    setGameResults(standardizedResults);

    // If in suite mode, notify the suite manager instead of exiting to main menu
    if (isSuiteMode && onSuiteEnd) {
      onSuiteEnd(standardizedResults);
      return;
    }

    // Return to the main menu
    exitToMainMenu();
  }, [exitToMainMenu, currentGameMode, isSuiteMode, onSuiteEnd]);

  // Add keyboard shortcut (Ctrl+Q) to exit to main menu
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl+Q to exit to main menu
      if (e.ctrlKey && e.key === 'q') {
        e.preventDefault();
        exitToMainMenu();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [exitToMainMenu]);

  // Handle exiting the application (can't be fully implemented in a web app)
  const handleExitApp = () => {
    // In a web app, we can only show a confirmation or redirect
    if (window.confirm('Are you sure you want to exit the application? This will close the browser tab.')) {
      window.close(); // This may be blocked by browsers without user interaction
      // As a fallback, we can redirect to a blank page or show a message
      document.body.innerHTML = '<h1>Thanks for using MATB-II Simulation</h1><p>You can now close this tab.</p>';
    }
  };

  // Add a useEffect to apply the background on component mount
  useEffect(() => {
    const currentBackground = BackgroundService.getCurrentBackground();
    const style = BackgroundService.getBackgroundStyle(currentBackground);
    document.body.style.backgroundImage = style.backgroundImage || 'none';
    document.body.style.backgroundColor = style.backgroundColor || '';
    document.body.style.backgroundSize = style.backgroundSize || '';
    document.body.style.backgroundPosition = style.backgroundPosition || '';
    document.body.style.backgroundRepeat = style.backgroundRepeat || '';
  }, []);

  // Add an effect to log when running on mobile
  useEffect(() => {
    if (isMobile) {
    }
  }, [isMobile]);

  // Compute a fit-to-screen transform for the MATB grid on phones.
  // We lay the dashboard out at a generous fixed design size (so fixed/vh-based
  // inner elements have room and don't overlap), then scale it down to fit the
  // viewport. Recomputed on resize / orientation change.
  useEffect(() => {
    const portraitQ = window.matchMedia('(max-width: 600px) and (orientation: portrait)');
    const landscapeQ = window.matchMedia('(orientation: landscape) and (max-height: 600px)');

    const computeScale = () => {
      const isPortrait = portraitQ.matches;
      const isLandscape = landscapeQ.matches;

      // Not a phone layout -> let desktop inline styles apply.
      if (!isPortrait && !isLandscape) {
        setMatbGridStyle(null);
        return;
      }

      const design = isLandscape ? { w: 1300, h: 560 } : { w: 700, h: 1500 };
      const reservedTop = 44; // clearance for the fixed game HUD
      const availW = window.innerWidth;
      const availH = Math.max(1, window.innerHeight - reservedTop);
      const scale = Math.min(availW / design.w, availH / design.h);
      const left = Math.max(0, (availW - design.w * scale) / 2);
      const top = reservedTop + Math.max(0, (availH - design.h * scale) / 2);

      setMatbGridStyle({
        position: 'absolute',
        top: 0,
        left: 0,
        width: `${design.w}px`,
        height: `${design.h}px`,
        transformOrigin: 'top left',
        transform: `translate(${left}px, ${top}px) scale(${scale})`
      });
    };

    computeScale();
    window.addEventListener('resize', computeScale);
    window.addEventListener('orientationchange', computeScale);
    portraitQ.addEventListener?.('change', computeScale);
    landscapeQ.addEventListener?.('change', computeScale);

    return () => {
      window.removeEventListener('resize', computeScale);
      window.removeEventListener('orientationchange', computeScale);
      portraitQ.removeEventListener?.('change', computeScale);
      landscapeQ.removeEventListener?.('change', computeScale);
    };
  }, []);

  // Cross-browser fullscreen toggle (no-op on iOS Safari, which lacks the API).
  const toggleFullscreen = useCallback(() => {
    const doc = document;
    const el = doc.documentElement;
    const isFs = doc.fullscreenElement || doc.webkitFullscreenElement || doc.msFullscreenElement;
    try {
      if (!isFs) {
        const req = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
        if (req) {
          const result = req.call(el);
          if (result && typeof result.catch === 'function') result.catch(() => {});
        }
      } else {
        const exit = doc.exitFullscreen || doc.webkitExitFullscreen || doc.msExitFullscreen;
        if (exit) exit.call(doc);
      }
    } catch (e) {
      // Ignore: some browsers (notably iOS Safari) don't support element fullscreen.
    }
  }, []);

  // Add effect to detect mobile and initialize tracking input mode on component mount
  useEffect(() => {
    const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
      (navigator.maxTouchPoints && navigator.maxTouchPoints > 1);

    setIsMobile(isMobileDevice);

    // If this is the first time loading and we detected mobile,
    // initialize the tracking input mode preference to 'touch'
    if (isMobileDevice && !localStorage.getItem('trackingInputMode')) {
      localStorage.setItem('trackingInputMode', 'touch');
      setTrackingInputMode('touch');
    } else {
      // Ensure we sync our state with the stored preference
      const savedMode = localStorage.getItem('trackingInputMode');
      if (savedMode && ['keyboard', 'touch'].includes(savedMode)) {
        setTrackingInputMode(savedMode);
      }
    }
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

  // Sync background when trackingInputMode changes (already has an effect)
  useEffect(() => {
  }, [trackingInputMode]);

  // Check for startup parameters stored in localStorage
  // Clear any stale localStorage params on mount ONLY if we're on the main route (no params on initial mount)
  useEffect(() => {
    // Only run once on mount
    if (startupParamsChecked) return;

    if (!isSuiteMode) {
      // Check if we have params - if not, we're on main route, so clear any stale data
      const hasParams = localStorage.getItem('matb_start_params') !== null;
      if (!hasParams && showMainMenu) {
        // We're on main route with no params - ensure it's clean
        localStorage.removeItem('matb_start_params');
      }
    }
  }, []); // Only run once on mount

  useEffect(() => {
    // Only handle startup once
    if (startupParamsChecked || isInitializing) return;

    if (initialParams) {
      setIsInitializing(true);
      setShowMainMenu(false);

      // Extract details
      const { mode, duration, taskConfig, tasks } = initialParams;

      // Clear params immediately to prevent re-triggering upon reload
      if (!isSuiteMode) {
        localStorage.removeItem('matb_start_params');
      }

      const generateTaskConfigFromTasks = () => {
        const isEnabled = (taskKey) => tasks ? tasks.includes(taskKey) : true;
        return {
          comm: {
            isActive: isEnabled('comm'),
            eventsPerMinute: isEnabled('comm') ? commEPM : 0,
            difficulty: commDifficulty
          },
          monitoring: {
            isActive: isEnabled('monitoring'),
            eventsPerMinute: isEnabled('monitoring') ? monitoringEPM : 0,
            difficulty: monitoringDifficulty
          },
          tracking: {
            isActive: isEnabled('tracking'),
            eventsPerMinute: isEnabled('tracking') ? trackingEPM : 0,
            difficulty: trackingDifficulty
          },
          resource: {
            isActive: isEnabled('resource'),
            eventsPerMinute: isEnabled('resource') ? resourceEPM : 0,
            difficulty: resourceDifficulty
          }
        };
      };

      // Wait a bit to ensure refs are ready
      const timer = setTimeout(() => {
        const startOptions = {
          mode: mode || 'normal',
          duration: duration || gameDuration,
          taskConfig: taskConfig || (mode === 'custom' ? generateTaskConfigFromTasks() : null)
        };

        startGame(startOptions, isSuiteMode);

        if (mode === 'testing') {
          eventService.resumeAllTasks();
        }

        setIsInitializing(false);
        setStartupParamsChecked(true);
      }, 200);

      return () => clearTimeout(timer);
    } else {
      setStartupParamsChecked(true);
    }
  }, [
    isSuiteMode, suiteParams, startGame, startupParamsChecked, isInitializing, gameDuration,
    commEPM, commDifficulty, monitoringEPM, monitoringDifficulty,
    trackingEPM, trackingDifficulty, resourceEPM, resourceDifficulty,
    setShowMainMenu, setIsInitializing, setStartupParamsChecked, initialParams
  ]);

  // If the main menu should be shown, render it instead of the main app
  if (showMainMenu) {
    return (
      <MainMenu
        onStartGame={startGame}
        onExitApp={handleExitApp}
        gameResults={gameResults}
      />
    );
  }

  return (
    <div className="app-container" style={{ height: '100vh', overflow: 'hidden' }}>
      <div className="main-container" style={{ position: 'relative', height: '100%' }}>

        {/* Fullscreen toggle (works on Chrome/Android/desktop; iOS Safari ignores it) */}
        <button
          onClick={toggleFullscreen}
          title={t('common.fullscreen', 'Fullscreen')}
          aria-label="Toggle fullscreen"
          style={{
            position: 'fixed',
            bottom: '10px',
            left: '10px',
            zIndex: 100001,
            width: '40px',
            height: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0, 0, 0, 0.55)',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            fontSize: '20px',
            lineHeight: 1,
            cursor: 'pointer',
            pointerEvents: 'auto'
          }}
        >
          &#9974;
        </button>


        <div className={`main-content ${isEventSidebarOpen && currentGameMode === 'testing' ? 'sidebar-open' : ''}`}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            position: 'relative'
          }}>
            {/* Rest of the main content (tasks) */}
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
              <div className="matb-scroll-area" style={{ flex: 1, overflow: 'auto', padding: '1rem' }}>
                <div className="matb-grid" style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(6, 1fr)',
                  gridTemplateRows: '1fr 1fr',
                  gap: '1rem',
                  height: '100vh',
                  padding: '5%',
                  boxSizing: 'border-box',
                  ...(matbGridStyle || {})
                }}>
                  {/* Top Left - System Monitoring */}
                  <div className="matb-cell matb-cell--monitoring" style={{
                    gridColumn: '1 / span 2',
                    gridRow: '1',
                    border: '1px solid #ccc',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    backgroundColor: 'white'
                  }}>
                    {isMonitoringTaskEnabled ? (
                      <MonitoringTask
                        ref={monitoringTaskRef}
                        eventsPerMinute={monitoringEPM}
                        setEventsPerMinute={setMonitoringEPM}
                        onLogUpdate={handleMonitoringLogUpdate}
                        isEnabled={isMonitoringTaskEnabled}
                        onMetricsUpdate={setMonitoringMetrics}
                        autoEvents={monitoringAutoEvents}
                        onPenalty={handlePenalty}
                      />
                    ) : (
                      <div style={{
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: '#e0e0e0',
                        color: '#888',
                        flexDirection: 'column'
                      }}>
                        <div style={{
                          backgroundColor: '#d0d0d0',
                          color: '#686868',
                          width: '100%',
                          padding: '0.5rem',
                          textAlign: 'center',
                          fontWeight: 'bold'
                        }}>
                          {t('tasks.monitoring.title')}
                        </div>
                        <div style={{ padding: '20px', textAlign: 'center' }}>
                          {t('customMode.monitoringTask')} {t('gameOver.inactive')}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Top Middle - Tracking Task */}
                  <div className="matb-cell matb-cell--tracking" style={{
                    gridColumn: '3 / span 3',
                    gridRow: '1',
                    border: '1px solid #ccc',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    backgroundColor: 'rgba(255, 255, 255, 0.9)'
                  }}>
                    {isTrackingTaskEnabled ? (
                      <TrackingTask
                        ref={trackingTaskRef}
                        eventsPerMinute={trackingEPM}
                        difficulty={trackingDifficulty}
                        onLogUpdate={handleTrackingLogUpdate}
                        onStatusUpdate={({ isManual, isInBox }) => {
                          setIsTrackingManual(isManual);
                          setIsInBox(isInBox);
                        }}
                        onMetricsUpdate={setTrackingMetrics}
                        isEnabled={isTrackingTaskEnabled}
                        autoEvents={trackingAutoEvents}
                        isMobile={isMobile}
                        defaultInputMode={trackingInputMode}
                        key={`tracking-${trackingInputMode}`}
                      />
                    ) : (
                      <div style={{
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: '#e0e0e0',
                        color: '#888',
                        flexDirection: 'column'
                      }}>
                        <div style={{
                          backgroundColor: '#d0d0d0',
                          color: '#686868',
                          width: '100%',
                          padding: '0.5rem',
                          textAlign: 'center',
                          fontWeight: 'bold'
                        }}>
                          {t('tasks.tracking.title')}
                        </div>
                        <div style={{ padding: '20px', textAlign: 'center' }}>
                          {t('customMode.trackingTask')} {t('gameOver.inactive')}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Top Right - System Health */}
                  <div className="matb-cell matb-cell--health" style={{
                    gridColumn: '6',
                    gridRow: '1',
                    border: '1px solid #ccc',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    backgroundColor: 'white'
                  }}>
                    <SystemHealth
                      ref={systemHealthRef}
                      monitoringLogs={monitoringEventLog}
                      resourceLogs={resourceEventLog}
                      commLogs={commEventLog}
                      trackingLogs={trackingEventLog}
                      isTrackingManual={isTrackingManual}
                      isInBox={isInBox}
                      commMetrics={commMetrics}
                      resourceMetrics={resourceMetrics}
                      monitoringMetrics={monitoringMetrics}
                      trackingMetrics={trackingMetrics}
                      isMonitoringActive={isMonitoringTaskEnabled}
                      isCommActive={isCommTaskEnabled}
                      isResourceActive={isResourceTaskEnabled}
                      isTrackingActive={isTrackingTaskEnabled}
                      healthRef={systemHealthValueRef}
                      onPerformanceUpdate={handlePerformanceUpdate}
                    />
                  </div>

                  {/* Bottom Left - Communications Task */}
                  <div className="matb-cell matb-cell--comm" style={{
                    gridColumn: '1 / span 2',
                    gridRow: '2',
                    border: '1px solid #ccc',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    backgroundColor: 'white'
                  }}>
                    {isCommTaskEnabled ? (
                      <CommunicationsTask
                        ref={commTaskRef}
                        eventsPerMinute={commEPM}
                        onLogUpdate={handleCommLogUpdate}
                        isEnabled={isCommTaskEnabled}
                        onMetricsUpdate={setCommMetrics}
                        autoEvents={commAutoEvents}
                        onPenalty={handlePenalty}
                      />
                    ) : (
                      <div style={{
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: '#e0e0e0',
                        color: '#888',
                        flexDirection: 'column'
                      }}>
                        <div style={{
                          backgroundColor: '#d0d0d0',
                          color: '#686868',
                          width: '100%',
                          padding: '0.5rem',
                          textAlign: 'center',
                          fontWeight: 'bold'
                        }}>
                          {t('tasks.communications.title')}
                        </div>
                        <div style={{ padding: '20px', textAlign: 'center' }}>
                          {t('customMode.commTask')} {t('gameOver.inactive')}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Resource Management */}
                  <div className="matb-cell matb-cell--resource" style={{
                    gridColumn: '3 / span 4',
                    gridRow: '2',
                    border: '1px solid #ccc',
                    overflow: 'hidden',
                    backgroundColor: 'white'
                  }}>
                    {isResourceTaskEnabled ? (
                      <ResourceManagementTask
                        ref={resourceTaskRef}
                        eventsPerMinute={resourceEPM}
                        difficulty={resourceDifficulty}
                        onLogUpdate={handleResourceLogUpdate}
                        onMetricsUpdate={handleResourceMetricsUpdate}
                        isEnabled={isResourceTaskEnabled}
                        autoEvents={resourceAutoEvents}
                      />
                    ) : (
                      <div style={{
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: '#e0e0e0',
                        color: '#888',
                        flexDirection: 'column'
                      }}>
                        <div style={{
                          backgroundColor: '#d0d0d0',
                          color: '#686868',
                          width: '100%',
                          padding: '0.5rem',
                          textAlign: 'center',
                          fontWeight: 'bold'
                        }}>
                          {t('tasks.resource.title')}
                        </div>
                        <div style={{ padding: '20px', textAlign: 'center' }}>
                          {t('customMode.resourceTask')} {t('gameOver.inactive')}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Testing/Normal Mode Control Buttons */}
        {currentGameMode === 'testing' && (
          <div style={{
            position: 'fixed',
            top: '10px',
            right: '20px',
            zIndex: 1000
          }}>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={exitToMainMenu}
                style={{
                  padding: '8px 12px',
                  background: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                {t('common.returnToMenu')} (Ctrl+Q)
              </button>
              <button
                onClick={() => setShowBackgroundSelector(!showBackgroundSelector)}
                style={{
                  padding: '8px 12px',
                  background: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                {t('common.background')}
              </button>
              <button
                onClick={() => setIsEventSidebarOpen(!isEventSidebarOpen)}
                style={{
                  padding: '8px 12px',
                  background: isEventSidebarOpen ? '#555' : '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                {isEventSidebarOpen ? t('common.hideControls') : t('common.showControls')}
              </button>
            </div>
            {showBackgroundSelector && (
              <div style={{
                position: 'absolute',
                top: '50px',
                right: '0',
                zIndex: 1500
              }}>
                <BackgroundSelector small={true} />
              </div>
            )}
          </div>
        )}

        {/* Settings Sidebar for Testing Mode */}
        {currentGameMode === 'testing' && isEventSidebarOpen && (
          <div className="sidebar">
            <EnhancedSidebar
              // Task settings
              commSettings={{
                eventsPerMinute: commEPM,
                difficulty: commDifficulty,
                isEnabled: isCommTaskEnabled,
                autoEvents: commAutoEvents
              }}
              monitoringSettings={{
                eventsPerMinute: monitoringEPM,
                difficulty: monitoringDifficulty,
                isEnabled: isMonitoringTaskEnabled,
                autoEvents: monitoringAutoEvents
              }}
              trackingSettings={{
                eventsPerMinute: trackingEPM,
                difficulty: trackingDifficulty,
                isEnabled: isTrackingTaskEnabled,
                autoEvents: trackingAutoEvents
              }}
              resourceSettings={{
                eventsPerMinute: resourceEPM,
                difficulty: resourceDifficulty,
                isEnabled: isResourceTaskEnabled,
                autoEvents: resourceAutoEvents
              }}
              // Logs for each task
              monitoringLog={monitoringEventLog}
              commLog={commEventLog}
              trackingLog={trackingEventLog}
              resourceLog={resourceEventLog}
              // Callback functions
              onCommConfigChange={(type, value) => {
                if (type === 'epm') setCommEPM(value);
                if (type === 'difficulty') setCommDifficulty(value);
                if (type === 'autoEvents') setCommAutoEvents(value);
                if (type === 'isEnabled') setIsCommTaskEnabled(value);
              }}
              onMonitoringConfigChange={(type, value) => {
                if (type === 'epm') setMonitoringEPM(value);
                if (type === 'difficulty') setMonitoringDifficulty(value);
                if (type === 'autoEvents') setMonitoringAutoEvents(value);
                if (type === 'isEnabled') setIsMonitoringTaskEnabled(value);
              }}
              onTrackingConfigChange={(type, value) => {
                if (type === 'epm') setTrackingEPM(value);
                if (type === 'difficulty') setTrackingDifficulty(value);
                if (type === 'autoEvents') setTrackingAutoEvents(value);
                if (type === 'isEnabled') setIsTrackingTaskEnabled(value);
              }}
              onResourceConfigChange={(type, value) => {
                if (type === 'epm') setResourceEPM(value);
                if (type === 'difficulty') setResourceDifficulty(value);
                if (type === 'autoEvents') setResourceAutoEvents(value);
                if (type === 'isEnabled') setIsResourceTaskEnabled(value);
              }}
              onSchedulingChange={(change) => {
                const { task, type, value } = change;
                switch (task) {
                  case 'comm':
                    if (type === 'epm') setCommEPM(value);
                    if (type === 'difficulty') setCommDifficulty(value);
                    break;
                  case 'monitoring':
                    if (type === 'epm') setMonitoringEPM(value);
                    if (type === 'difficulty') setMonitoringDifficulty(value);
                    break;
                  case 'tracking':
                    if (type === 'epm') setTrackingEPM(value);
                    if (type === 'difficulty') setTrackingDifficulty(value);
                    break;
                  case 'resource':
                    if (type === 'epm') setResourceEPM(value);
                    if (type === 'difficulty') setResourceDifficulty(value);
                    break;
                  default:
                    break;
                }
              }}
            />
          </div>
        )}

        {/* Add a small background selector button to normal and infinite modes */}
        {(currentGameMode === 'normal' || currentGameMode === 'infinite') && (
          <div style={{
            position: 'fixed',
            top: '10px',
            right: '110px',
            zIndex: 1000
          }}>
            <button
              onClick={() => setShowBackgroundSelector(!showBackgroundSelector)}
              style={{
                padding: '8px 12px',
                background: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              {t('common.background').substring(0, 2).toUpperCase()}
            </button>
            {showBackgroundSelector && (
              <div style={{
                position: 'absolute',
                top: '40px',
                right: '0',
                zIndex: 1500
              }}>
                <BackgroundSelector small={true} />
              </div>
            )}
          </div>
        )}
        {/* Game components rendered in a fixed top-level overlay with absolute priority */}
        {(currentGameMode === 'normal' || currentGameMode === 'infinite' || (currentGameMode === 'custom' && customGameConfig)) && (
          <div className="game-controls-overlay" style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            zIndex: 99999,
            pointerEvents: 'none'
          }}>
            {currentGameMode === 'normal' && (
              <NormalModeGame
                key={`normal-game-${gameDuration}`}
                duration={gameDuration}
                onGameEnd={handleGameEnd}
                eventService={eventService}
                healthRef={systemHealthValueRef}
                isSuite={isSuiteMode}
                logs={{
                  comm: commEventLog,
                  resource: resourceEventLog,
                  monitoring: monitoringEventLog,
                  tracking: trackingEventLog,
                  performance: systemPerformanceLog
                }}
              />
            )}

            {currentGameMode === 'infinite' && (
              <InfiniteModeGame
                key="infinite-game"
                onGameEnd={handleGameEnd}
                eventService={eventService}
                healthRef={systemHealthValueRef}
                isSuite={isSuiteMode}
              />
            )}

            {currentGameMode === 'custom' && customGameConfig && (
              <CustomModeGame
                key={`custom-game-${gameDuration}`}
                duration={gameDuration}
                taskConfig={customGameConfig}
                onGameEnd={handleGameEnd}
                eventService={eventService}
                healthRef={systemHealthValueRef}
                isSuite={isSuiteMode}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
