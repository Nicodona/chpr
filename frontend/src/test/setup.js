import "@testing-library/jest-dom/vitest";

// jsdom doesn't implement IntersectionObserver — ResourceTile's lazy-mount uses it.
class IO {
  constructor() {}
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.IntersectionObserver = globalThis.IntersectionObserver || IO;
