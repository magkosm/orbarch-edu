// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// Node globals used by react-router v7 (data router uses URL/TextEncoder for
// its history / submit helpers). Jest 27 + jsdom don't expose TextEncoder
// globally, but the library references it at module load time.
const { TextEncoder, TextDecoder } = require('util');
if (typeof global.TextEncoder === 'undefined') global.TextEncoder = TextEncoder;
if (typeof global.TextDecoder === 'undefined') global.TextDecoder = TextDecoder;

// jsdom does not implement window.matchMedia, but App.js uses it in a useEffect
// (mobile portrait/landscape scaling). Polyfill it so components that read
// match media queries can mount under Jest. Returns a non-matching MediaQueryList.
// See: https://jestjs.io/docs/manual-mocks#mocking-methods-which-are-not-implemented-in-jsdom
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},        // deprecated alias kept for older callers
    removeListener: () => {},     // deprecated alias kept for older callers
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// jsdom also lacks matchMedia + window.resizeTo; mock the latter so any resize
// handler tests don't blow up. App.js attaches a 'resize' listener.
window.resizeTo = (width, height) => {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: height });
  window.dispatchEvent(new Event('resize'));
};

// HTMLMediaElement.play returns a promise in browsers; stub it so any component
// that touches <audio> (CommunicationsTask, NBackTest) doesn't reject under tests.
window.HTMLMediaElement.prototype.play = () => Promise.resolve();
window.HTMLMediaElement.prototype.pause = () => {};

// scrollTo is not implemented in jsdom.
window.scrollTo = () => {};
