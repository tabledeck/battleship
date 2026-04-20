interface DestroyerIconProps {
  size?: number;
  className?: string;
}

export function DestroyerIcon({ size = 32, className = "" }: DestroyerIconProps) {
  return (
    <svg
      width={size}
      height={size * 0.45}
      viewBox="0 0 44 20"
      fill="none"
      className={className}
    >
      {/* Hull */}
      <path d="M4 16 L8 9 L36 9 L40 16 Z" fill="#17294b" stroke="#0f1d33" strokeWidth="1"/>
      {/* Bridge */}
      <rect x="16" y="4" width="12" height="5" rx="1" fill="#17294b" stroke="#0f1d33" strokeWidth="0.8"/>
      {/* Deck stripe */}
      <rect x="8" y="8.5" width="28" height="1.2" fill="#f6efe0" opacity="0.3"/>
      {/* Portholes */}
      <circle cx="14" cy="12.5" r="1.4" fill="#c9a24a" opacity="0.85"/>
      <circle cx="30" cy="12.5" r="1.4" fill="#c9a24a" opacity="0.85"/>
      {/* Rivets */}
      <circle cx="10" cy="11" r="0.8" fill="#0f1d33"/>
      <circle cx="34" cy="11" r="0.8" fill="#0f1d33"/>
    </svg>
  );
}
