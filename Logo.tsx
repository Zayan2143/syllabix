export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className="logo">
      <rect width="64" height="64" rx="15" fill="#0F1E3D" />
      <rect x="13" y="16" width="26" height="7" rx="3.5" fill="#FFFFFF" />
      <circle cx="47" cy="19.5" r="5.5" fill="#22C55E" />
      <path d="M44.6 19.6l1.7 1.7 3.2-3.4" fill="none" stroke="#0F1E3D" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="13" y="28.5" width="38" height="7" rx="3.5" fill="#FFFFFF" opacity=".92" />
      <rect x="13" y="41" width="38" height="7" rx="3.5" fill="#FFFFFF" opacity=".22" />
      <rect x="13" y="41" width="22" height="7" rx="3.5" fill="#60A5FA" />
    </svg>
  );
}
