import type { ButtonHTMLAttributes, ReactNode } from "react";

interface BtnSecondaryProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
}

export function BtnSecondary({ children, className = "", ...props }: BtnSecondaryProps) {
  return (
    <button className={`btn-secondary ${className}`} {...props}>
      {children}
    </button>
  );
}
