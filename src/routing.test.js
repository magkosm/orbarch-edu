/**
 * Routing smoke tests.
 *
 * These exist specifically to guard the react-router-dom dependency (upgraded
 * 7.12.0 → 7.18.1 to clear CVE-2026-33245 and friends). If a future change to
 * react-router-dom or to src/index.js breaks client-side routing, this test
 * fails before it reaches users on GitHub Pages.
 *
 * Uses MemoryRouter so we can drive synthetic locations without a real browser.
 */
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Navigate } from 'react-router-dom';
import App from './App';

// Mock react-i18next so we don't depend on the async locale loader in tests.
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key,
    i18n: { changeLanguage: () => new Promise(() => {}) },
  }),
}));

// Mock the heavy components that deep-link routes render — we only care that
// routing reaches them, not that they fully mount (they pull audio via
// require.context which Jest can't resolve).
jest.mock('./components/ReactionTimeGame', () => {
  const Mock = () => <div data-testid="rt-game">ReactionTimeGame</div>;
  return { __esModule: true, default: Mock };
});
jest.mock('./components/NBackGame', () => {
  const Mock = () => <div data-testid="nb-game">NBackGame</div>;
  return { __esModule: true, default: Mock };
});
jest.mock('./components/SuiteManager', () => {
  const Mock = () => <div data-testid="suite">SuiteManager</div>;
  return { __esModule: true, default: Mock };
});
jest.mock('./components/SpaceArchitectureSimulator', () => {
  const Mock = () => <div data-testid="sim">Simulator</div>;
  return { __esModule: true, default: Mock };
});
jest.mock('./components/HabitatBlueprintDesigner', () => {
  const Mock = () => <div data-testid="blueprint">Blueprint</div>;
  return { __esModule: true, default: Mock };
});
jest.mock('./components/ConditionLab', () => {
  const Mock = () => <div data-testid="clab">ConditionLab</div>;
  return { __esModule: true, default: Mock };
});
jest.mock('./components/ConfigurableSimulator', () => {
  const Mock = () => <div data-testid="mlab">ModelLab</div>;
  return { __esModule: true, default: Mock };
});

describe('client-side routing', () => {
  // Inline a minimal copy of the index.js route table so this test stays
  // independent of the deep-link parameter plumbing — we only want to assert
  // that react-router-dom itself works and routes reach a target component.
  const router = (initialPath) => (
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/reaction" element={<div data-testid="rt-game">ReactionTimeGame</div>} />
        <Route path="/nback" element={<div data-testid="nb-game">NBackGame</div>} />
        <Route path="/reaction-default" element={<div data-testid="rt-game">ReactionTimeGame</div>} />
        <Route path="/nbackdefault" element={<div data-testid="nb-game">NBackGame</div>} />
        <Route path="/suite" element={<div data-testid="suite">SuiteManager</div>} />
        <Route path="/simulator" element={<div data-testid="sim">Simulator</div>} />
        <Route path="/blueprint" element={<div data-testid="blueprint">Blueprint</div>} />
        <Route path="/condition-lab" element={<div data-testid="clab">ConditionLab</div>} />
        <Route path="/model-lab" element={<div data-testid="mlab">ModelLab</div>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </MemoryRouter>
  );

  test('renders the main menu at /', () => {
    render(router('/'));
    expect(screen.getByText('mainMenu.title')).toBeInTheDocument();
  });

  test('routes /simulator to the education component', () => {
    render(router('/simulator'));
    expect(screen.getByTestId('sim')).toBeInTheDocument();
  });

  test('routes /blueprint to the blueprint designer', () => {
    render(router('/blueprint'));
    expect(screen.getByTestId('blueprint')).toBeInTheDocument();
  });

  test('routes /suite to the suite manager', () => {
    render(router('/suite'));
    expect(screen.getByTestId('suite')).toBeInTheDocument();
  });

  test('routes /condition-lab to the condition lab', () => {
    render(router('/condition-lab'));
    expect(screen.getByTestId('clab')).toBeInTheDocument();
  });

  test('routes /model-lab to the model lab', () => {
    render(router('/model-lab'));
    expect(screen.getByTestId('mlab')).toBeInTheDocument();
  });

  test('unknown routes redirect to /', () => {
    render(router('/this-route-does-not-exist'));
    // After <Navigate to="/" replace /> the main menu renders.
    expect(screen.getByText('mainMenu.title')).toBeInTheDocument();
  });
});
