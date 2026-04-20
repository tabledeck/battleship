interface BattleshipIconProps {
  size?: number;
  className?: string;
}

export function BattleshipIcon({ size = 32, className = "" }: BattleshipIconProps) {
  return (
    <svg
      width={size}
      height={size * 0.45}
      viewBox="0 0 64 28"
      fill="none"
      className={className}
    >
      {/* Hull */}
      <path d="M6 22 L10 13 L54 13 L58 22 Z" fill="#17294b" stroke="#0f1d33" strokeWidth="1"/>
      {/* Bridge superstructure */}
      <rect x="24" y="7" width="16" height="6" rx="1" fill="#17294b" stroke="#0f1d33" strokeWidth="0.8"/>
      {/* Gun turret */}
      <rect x="28" y="4" width="8" height="4" rx="1" fill="#17294b" stroke="#0f1d33" strokeWidth="0.7"/>
      {/* Deck stripe */}
      <rect x="10" y="12.5" width="44" height="1.5" fill="#f6efe0" opacity="0.3"/>
      {/* Portholes */}
      <circle cx="18" cy="18" r="1.8" fill="#c9a24a" opacity="0.85"/>
      <circle cx="30" cy="18" r="1.8" fill="#c9a24a" opacity="0.85"/>
      <circle cx="42" cy="18" r="1.8" fill="#c9a24a" opacity="0.85"/>
      {/* Rivets */}
      <circle cx="12" cy="16" r="1" fill="#0f1d33"/>
      <circle cx="52" cy="16" r="1" fill="#0f1d33"/>
    </svg>
  );
}
