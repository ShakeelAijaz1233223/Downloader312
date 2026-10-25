import '@testing-library/jest-dom';

// Polyfill ResizeObserver & IntersectionObserver for Recharts + Framer Motion in JSDOM
class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
class MockIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = MockResizeObserver;
globalThis.IntersectionObserver = MockIntersectionObserver;
window.scrollTo = () => {};
