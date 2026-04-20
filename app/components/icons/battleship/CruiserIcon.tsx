interface CruiserIconProps {
  size?: number;
  className?: string;
}

export function CruiserIcon({ size = 32, className = "" }: CruiserIconProps) {
  return (
    <svg
      width={size}
      height={size * 0.45}
      viewBox="0 0 54 24"
      fill="none"
      className={className}
    >
      {/* Hull */}
      <path d="M5 19 L9 11 L45 11 L49 19 Z" fill="#17294b" stroke="#0f1d33" strokeWidth="1"/>
      {/* Bridge */}
      <rect x="20" y="6" width="14" height="5" rx="1" fill="#17294b" stroke="#0f1d33" strokeWidth="0.8"/>
      {/* Deck stripe */}
      <rect x="9" y="10.5" width="36" height="1.5" fill="#f6efe0" opacity="0.3"/>
      {/* Portholes */}
      <circle cx="16" cy="15.5" r="1.6" fill="#c9a24a" opacity="0.85"/>
      <circle cx="27" cy="15.5" r="1.6" fill="#c9a24a" opacity="0.85"/>
      <circle cx="38" cy="15.5" r="1.6" fill="#c9a24a" opacity="0.85"/>
      {/* Rivets */}
      <circle cx="11" cy="14" r="0.9" fill="#0f1d33"/>
      <circle cx="43" cy="14" r="0.9" fill="#0f1d33"/>
    </svg>
  );
}
