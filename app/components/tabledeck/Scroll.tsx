import type { ReactNode } from "react";

interface ScrollProps {
  children: ReactNode;
  className?: string;
}

export function Scroll({ children, className = "" }: ScrollProps) {
  return (
    <div className={`td-scroll ${className}`}>
      {children}
    </div>
  );
}
