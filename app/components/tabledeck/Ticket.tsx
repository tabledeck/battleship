import type { ReactNode } from "react";

interface TicketProps {
  label: string;
  value: ReactNode;
  className?: string;
}

export function Ticket({ label, value, className = "" }: TicketProps) {
  return (
    <div className={`td-ticket ${className}`}>
      <span style={{
        fontFamily: "var(--serif)",
        fontVariant: "small-caps",
        fontWeight: 600,
        fontSize: "10.5px",
        letterSpacing: "0.26em",
        color: "var(--ink-soft)",
        display: "block",
        lineHeight: 1,
      }}>{label}</span>
      <span style={{
        fontFamily: "var(--serif)",
        fontWeight: 600,
        fontSize: "22px",
        lineHeight: 1,
        marginTop: "4px",
        color: "var(--ink)",
        display: "block",
      }}>{value}</span>
    </div>
  );
}
