import { SKULL_PATH, logoPath } from '@/data/logos';

// A brand mark in the current text colour. Without one, nothing, or an empty slot so lists stay aligned.
export function Logo({ slug, size = 14, reserve = false }: { slug: string; size?: number; reserve?: boolean }) {
  const d = logoPath(slug);
  if (!d) return reserve ? <span style={{ width: size, flex: 'none' }} /> : null;
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true" style={{ flex: 'none' }}>
      <path d={d} />
    </svg>
  );
}

export function Skull({ size = 12, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill={color} fillRule="evenodd" role="img" aria-label="all down" style={{ flex: 'none' }}>
      <path d={SKULL_PATH} />
    </svg>
  );
}
