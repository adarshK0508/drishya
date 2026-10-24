// Avoid setInterval(16.666) truncation running prediction faster than authority.
export function fixedTicker(callback, hz = 60) {
  const step = 1000 / hz;
  let previous = performance.now(),
    accumulated = 0;
  const timer = setInterval(() => {
    const now = performance.now();
    accumulated += Math.min(100, now - previous);
    previous = now;
    while (accumulated >= step) {
      callback();
      accumulated -= step;
    }
  }, 4);
  return () => clearInterval(timer);
}
