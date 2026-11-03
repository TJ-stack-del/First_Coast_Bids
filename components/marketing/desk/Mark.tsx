// The Benchmark mark: circle, triangle, crosshair. Decorative wherever it
// appears (the wordmark or the line next to it carries the name).
export function Mark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="5 5 230 230" aria-hidden="true" focusable="false">
      <circle cx="120" cy="120" r="108" fill="none" stroke="currentColor" strokeWidth="14" />
      <path d="M120 58 L170 144 L70 144 Z" fill="none" stroke="currentColor" strokeWidth="13" />
      <line x1="48" y1="118" x2="192" y2="118" stroke="var(--color-accent)" strokeWidth="11" />
      <line x1="120" y1="40" x2="120" y2="160" stroke="var(--color-accent)" strokeWidth="11" />
      <circle cx="120" cy="118" r="12" fill="currentColor" />
    </svg>
  );
}
