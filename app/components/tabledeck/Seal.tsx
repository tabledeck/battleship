import type { ReactNode } from "react";

interface SealProps {
  children?: ReactNode;
  className?: string;
}

export function Seal({ children, className = "" }: SealProps) {
  return (
    <div className={`td-seal ${className}`}>
      {children ?? (
        <svg viewBox="0 0 32 32" fill="none" width="30" height="30">
          {/* Anchor silhouette */}
          <circle cx="16" cy="10" r="3" stroke="#e8c872" strokeWidth="1.4"/>
          <line x1="16" y1="13" x2="16" y2="26" stroke="#e8c872" strokeWidth="1.4"/>
          <path d="M10 26c2-3 4-3 6-3s4 0 6 3" stroke="#e8c872" strokeWidth="1.4" fill="none" strokeLinecap="round"/>
          <path d="M10 20c0 0 4 2 6 0s6 0 6 0" stroke="#e8c872" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
        </svg>
      )}
    </div>
  );
}
