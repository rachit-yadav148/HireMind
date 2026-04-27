/**
 * Module-level cache for the /auth/bootstrap response.
 * AuthContext populates this; CreditContext reads it to avoid a second round trip.
 */
const cache = {
  creditStatus: null,
};

export function setCachedCredits(data) {
  cache.creditStatus = data;
}

export function getCachedCredits() {
  return cache.creditStatus;
}

export function clearBootstrapCache() {
  cache.creditStatus = null;
}
