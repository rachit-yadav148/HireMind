/** Best-effort: public egress IP/geo as seen from this process (helps debug Gemini "region" blocks on hosts like Render). */
export async function fetchApproximateEgressInfo(options = {}) {
  const ms = typeof options.timeoutMs === "number" ? options.timeoutMs : 4500;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch("https://ipinfo.io/json", { signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) return null;
    const j = await r.json().catch(() => null);
    if (!j || typeof j !== "object") return null;
    return {
      ip: j.ip,
      country: j.country,
      region: j.region,
      city: j.city,
      org: j.org,
      hostname: j.hostname,
    };
  } catch {
    clearTimeout(t);
    return null;
  }
}
