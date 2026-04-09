import posthog from "posthog-js";

const posthogKey = import.meta.env.VITE_POSTHOG_KEY;

if (posthogKey) {
  posthog.init(posthogKey, {
    api_host: import.meta.env.VITE_POSTHOG_HOST || "https://eu.i.posthog.com",
    capture_pageview: false,
  });
}

export default posthog;