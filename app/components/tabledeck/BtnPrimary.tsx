import type { ButtonHTMLAttributes, ReactNode } from "react";

interface BtnPrimaryProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
}

export function BtnPrimary({ children, className = "", ...props }: BtnPrimaryProps) {
  return (
    <button className={`btn-primary ${className}`} {...props}>
      {children}
    </button>
  );
}
