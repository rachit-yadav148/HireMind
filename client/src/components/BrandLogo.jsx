/** Asset: `client/public/brand-logo.png`. Circular clip (`rounded-full`), no frame — bump version when replacing. */
export const BRAND_LOGO_ASSET_VERSION = "20260501";
export const BRAND_LOGO_URL = `/brand-logo.png?v=${BRAND_LOGO_ASSET_VERSION}`;

export default function BrandLogo({ className = "", alt = "HireMind" }) {
  return (
    <img
      src={BRAND_LOGO_URL}
      alt={alt}
      className={`rounded-full object-contain select-none ${className}`.trim()}
      width={512}
      height={512}
      decoding="async"
    />
  );
}

/** Gradient HireMind wordmark — pair with `<BrandLogo alt="" />` when the logo is decorative */
export function BrandWordmarkText({ className = "font-display font-bold text-xl text-white tracking-tight" }) {
  return (
    <span className={className}>
      Hire
      <span className="bg-gradient-to-r from-cyan-300 via-brand-400 to-fuchsia-400 bg-clip-text text-transparent">
        Mind
      </span>
    </span>
  );
}
