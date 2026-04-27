/**
 * Deferred PostHog loader.
 *
 * posthog-js is ~176KB minified — loading it eagerly before first paint adds
 * noticeable delay on slow mobile networks. We expose a proxy that buffers
 * any calls (.identify / .capture / .reset) until the real library has been
 * loaded via dynamic import after the browser is idle (post-first-paint).
 */

let realPosthog = null;
const queue = [];

function flushQueue() {
  if (!realPosthog) return;
  while (queue.length) {
    const { method, args } = queue.shift();
    try {
      realPosthog[method]?.(...args);
    } catch (_) {
      // best-effort analytics — never break the app for tracking errors
    }
  }
}

function enqueue(method, args) {
  if (realPosthog) {
    try {
      realPosthog[method]?.(...args);
    } catch (_) {
      // ignore
    }
  } else {
    queue.push({ method, args });
  }
}

const proxy = {
  identify: (...args) => enqueue("identify", args),
  capture: (...args) => enqueue("capture", args),
  reset: (...args) => enqueue("reset", args),
  register: (...args) => enqueue("register", args),
  unregister: (...args) => enqueue("unregister", args),
  isFeatureEnabled: () => false,
  getFeatureFlag: () => undefined,
  onFeatureFlags: () => () => {},
};

function loadPosthog() {
  const posthogKey = import.meta.env.VITE_POSTHOG_KEY;
  if (!posthogKey) return; // analytics disabled in this env

  import("posthog-js")
    .then(({ default: posthog }) => {
      posthog.init(posthogKey, {
        api_host: import.meta.env.VITE_POSTHOG_HOST || "https://eu.i.posthog.com",
        capture_pageview: false,
      });
      realPosthog = posthog;
      flushQueue();
    })
    .catch(() => {
      // network failed — drop the queue silently
      queue.length = 0;
    });
}

if (typeof window !== "undefined") {
  // Defer until the browser is idle so analytics never delays first paint.
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(loadPosthog, { timeout: 4000 });
  } else {
    setTimeout(loadPosthog, 1500);
  }
}

export default proxy;
