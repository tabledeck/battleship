interface SubmarineIconProps {
  size?: number;
  className?: string;
}

export function SubmarineIcon({ size = 32, className = "" }: SubmarineIconProps) {
  return (
    <svg
      width={size}
      height={size * 0.5}
      viewBox="0 0 54 26"
      fill="none"
      className={className}
    >
      {/* Main hull (ellipse) */}
      <ellipse cx="27" cy="17" rx="22" ry="7" fill="#17294b" stroke="#0f1d33" strokeWidth="1"/>
      {/* Conning tower */}
      <rect x="20" y="8" width="10" height="9" rx="2" fill="#17294b" stroke="#0f1d33" strokeWidth="0.8"/>
      {/* Periscope */}
      <rect x="24" y="3" width="2" height="6" rx="1" fill="#17294b" stroke="#0f1d33" strokeWidth="0.7"/>
      <rect x="23" y="3" width="4" height="2" rx="1" fill="#c9a24a" opacity="0.85"/>
      {/* Portholes */}
      <circle cx="16" cy="17" r="1.6" fill="#c9a24a" opacity="0.85"/>
      <circle cx="27" cy="17" r="1.6" fill="#c9a24a" opacity="0.85"/>
      <circle cx="38" cy="17" r="1.6" fill="#c9a24a" opacity="0.85"/>
      {/* Rivets */}
      <circle cx="8" cy="16" r="0.9" fill="#0f1d33"/>
      <circle cx="46" cy="16" r="0.9" fill="#0f1d33"/>
    </svg>
  );
}
