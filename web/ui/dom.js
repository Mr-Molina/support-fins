const noop = () => {};
const fallbackEl = {
  addEventListener: noop,
  removeEventListener: noop,
  setAttribute: noop,
  appendChild: noop,
  removeChild: noop,
  classList: { add: noop, remove: noop, toggle: noop },
  style: {},
  querySelector: () => null,
  querySelectorAll: () => [],
};

export const el = (id) => (typeof document !== 'undefined' ? document.getElementById(id) : fallbackEl);
