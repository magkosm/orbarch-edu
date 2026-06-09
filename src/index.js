/**
 * Application entry point and route table for the Orbital Architecture
 * web assessment battery (KTH / ESERO Sweden research project).
 *
 * Defines every public route, including the deep links that launch a single
 * test directly (e.g. /monitoring, /tracking, /comms, /resource, /reaction,
 * /nback) by seeding `matb_start_params` in localStorage before App mounts.
 * Append ?lng=sv or ?lng=el to any route to force a language.
 *
 * Part of the Orbital Architecture project. Licensed under the MIT License
 * (KTH Royal Institute of Technology, ESERO Sweden, Michail Magkos) — see LICENSE.
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import './index.css';
import App from './App';
import ReactionTimeGame from './components/ReactionTimeGame';
import NBackGame from './components/NBackGame';
import SuiteManager from './components/SuiteManager';
import SpaceArchitectureSimulator from './components/SpaceArchitectureSimulator';
import reportWebVitals from './reportWebVitals';

// Import i18n configuration
import './i18n';

// Helper component to set localStorage and render App
const AppWithParams = ({ startParams }) => {
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    // Clear any existing params first to prevent conflicts
    localStorage.removeItem('matb_start_params');

    if (startParams) {
      const paramsStr = JSON.stringify(startParams);
      // Store the parameters in localStorage
      localStorage.setItem('matb_start_params', paramsStr);

      // Small delay to ensure localStorage is set before App checks it
      setTimeout(() => {
        setIsLoading(false);
      }, 100);
    } else {
      setIsLoading(false);
    }
  }, [startParams]); // Include startParams in dependencies

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: '#f0f0f0'
      }}>
        <div>Loading...</div>
      </div>
    );
  }

  return <App />;
};

// Reaction Time Game Route Component
const ReactionTimeRoute = () => {
  const handleReturn = () => {
    window.location.href = process.env.PUBLIC_URL + '/';
  };

  return <ReactionTimeGame onReturn={handleReturn} />;
};

// N-Back Game Route Component
const NBackRoute = () => {
  const handleReturn = () => {
    window.location.href = process.env.PUBLIC_URL + '/';
  };

  return <NBackGame onReturn={handleReturn} />;
};

// Direct Reaction Time Game Route Component (bypasses config screen)
const DirectReactionTimeRoute = () => {
  const handleReturn = () => {
    window.location.href = process.env.PUBLIC_URL + '/';
  };

  // Create a ReactionTimeTest component directly with default parameters
  const ReactionTimeTest = React.lazy(() => import('./components/ReactionTimeTest'));

  return (
    <React.Suspense fallback={<div>Loading...</div>}>
      <ReactionTimeTest
        duration={null} // No time limit
        maxStimuli={8} // 8 stimuli
        minDelay={1500}
        maxDelay={8000}
        onReturn={handleReturn}
      />
    </React.Suspense>
  );
};

// Direct N-Back Game Route Component (bypasses config screen)
const DirectNBackRoute = () => {
  const handleReturn = () => {
    window.location.href = process.env.PUBLIC_URL + '/';
  };

  // Create an NBackTest component directly with default parameters
  const NBackTest = React.lazy(() => import('./components/NBackTest'));

  return (
    <React.Suspense fallback={<div>Loading...</div>}>
      <NBackTest
        n={2}
        trials={20}
        dim1targets={4}
        dim2targets={4}
        bothTargets={2}
        tickTime={3000}
        onReturn={handleReturn}
        audioEnabled={false} // Disable audio for quick mode
      />
    </React.Suspense>
  );
};

/**
 * Listens for the global `orbarch:toggleMATB` CustomEvent (dispatched by the
 * hidden trigger in the Space Architecture Simulator) and transitions the user
 * to the MATB testing suite. Decoupled via the event so any component can
 * request the transition without a direct import.
 */
const MatbEventBridge = () => {
  const navigate = useNavigate();
  React.useEffect(() => {
    const handleToggle = () => navigate('/');
    window.addEventListener('orbarch:toggleMATB', handleToggle);
    return () => window.removeEventListener('orbarch:toggleMATB', handleToggle);
  }, [navigate]);
  return null;
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter basename={process.env.PUBLIC_URL}>
      <MatbEventBridge />
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/comms" element={<AppWithParams startParams={{
          mode: 'custom',
          duration: 3 * 60 * 1000,
          taskConfig: {
            instructionKey: 'comm',
            comm: { isActive: true, difficulty: 6, eventsPerMinute: 6 },
            monitoring: { isActive: false, difficulty: 1, eventsPerMinute: 0 },
            tracking: { isActive: false, difficulty: 1, eventsPerMinute: 0 },
            resource: { isActive: false, difficulty: 1, eventsPerMinute: 0 }
          }
        }} />} />
        <Route path="/monitoring" element={<AppWithParams startParams={{
          mode: 'custom',
          duration: 3 * 60 * 1000,
          taskConfig: {
            instructionKey: 'sysMon',
            comm: { isActive: false, difficulty: 1, eventsPerMinute: 0 },
            monitoring: { isActive: true, difficulty: 6, eventsPerMinute: 6 },
            tracking: { isActive: false, difficulty: 1, eventsPerMinute: 0 },
            resource: { isActive: false, difficulty: 1, eventsPerMinute: 0 }
          }
        }} />} />
        <Route path="/tracking" element={<AppWithParams startParams={{
          mode: 'custom',
          duration: 3 * 60 * 1000,
          taskConfig: {
            instructionKey: 'track',
            comm: { isActive: false, difficulty: 1, eventsPerMinute: 0 },
            monitoring: { isActive: false, difficulty: 1, eventsPerMinute: 0 },
            tracking: { isActive: true, difficulty: 6, eventsPerMinute: 6 },
            resource: { isActive: false, difficulty: 1, eventsPerMinute: 0 }
          }
        }} />} />
        <Route path="/resource" element={<AppWithParams startParams={{
          mode: 'custom',
          duration: 3 * 60 * 1000,
          taskConfig: {
            instructionKey: 'resMan',
            comm: { isActive: false, difficulty: 1, eventsPerMinute: 0 },
            monitoring: { isActive: false, difficulty: 1, eventsPerMinute: 0 },
            tracking: { isActive: false, difficulty: 1, eventsPerMinute: 0 },
            resource: { isActive: true, difficulty: 6, eventsPerMinute: 6 }
          }
        }} />} />
        <Route path="/normal" element={<AppWithParams startParams={{ mode: 'normal', duration: 5 * 60 * 1000 }} />} />
        <Route path="/2min" element={<AppWithParams startParams={{ mode: 'normal', duration: 2 * 60 * 1000 }} />} />
        <Route path="/reaction" element={<ReactionTimeRoute />} />
        <Route path="/nback" element={<NBackRoute />} />
        <Route path="/reaction-default" element={<DirectReactionTimeRoute />} />
        <Route path="/nbackdefault" element={<DirectNBackRoute />} />
        <Route path="/suite" element={<SuiteManager />} />
        <Route path="/simulator" element={<SpaceArchitectureSimulator />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
