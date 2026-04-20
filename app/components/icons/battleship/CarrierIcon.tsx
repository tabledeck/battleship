interface CarrierIconProps {
  size?: number;
  className?: string;
}

export function CarrierIcon({ size = 32, className = "" }: CarrierIconProps) {
  return (
    <svg
      width={size}
      height={size * 0.4}
      viewBox="0 0 80 32"
      fill="none"
      className={className}
    >
      {/* Hull */}
      <path
        d="M4 24 L8 14 L72 14 L76 24 Z"
        fill="#17294b"
        stroke="#0f1d33"
        strokeWidth="1"
      />
      {/* Deck superstructure */}
      <rect x="16" y="8" width="48" height="6" rx="1" fill="#17294b" stroke="#0f1d33" strokeWidth="0.8"/>
      {/* Flight deck strip */}
      <rect x="8" y="13" width="64" height="2" fill="#f6efe0" opacity="0.35"/>
      {/* Portholes */}
      <circle cx="20" cy="20" r="2" fill="#c9a24a" opacity="0.85"/>
      <circle cx="32" cy="20" r="2" fill="#c9a24a" opacity="0.85"/>
      <circle cx="44" cy="20" r="2" fill="#c9a24a" opacity="0.85"/>
      <circle cx="56" cy="20" r="2" fill="#c9a24a" opacity="0.85"/>
      {/* Rivets */}
      <circle cx="10" cy="17" r="1.2" fill="#0f1d33"/>
      <circle cx="70" cy="17" r="1.2" fill="#0f1d33"/>
      {/* Water line */}
      <path d="M4 24 Q40 27 76 24" stroke="#0f1d33" strokeWidth="0.5" fill="none" opacity="0.4"/>
    </svg>
  );
}
