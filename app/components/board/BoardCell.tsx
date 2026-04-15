interface BoardCellProps {
  row: number;
  col: number;
  state: "empty" | "ship" | "hit" | "miss" | "preview-valid" | "preview-invalid";
  onClick?: (row: number, col: number) => void;
  clickable?: boolean;
  cellSize?: number;
}

export function BoardCell({ row, col, state, onClick, clickable = false, cellSize = 36 }: BoardCellProps) {
  const baseStyle: React.CSSProperties = {
    width: cellSize,
    height: cellSize,
    border: "1px solid rgba(255,255,255,0.08)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: clickable ? "pointer" : "default",
    position: "relative",
    boxSizing: "border-box",
    flexShrink: 0,
  };

  let bgColor = "rgba(14, 40, 80, 0.6)"; // deep navy empty
  let marker: React.ReactNode = null;

  switch (state) {
    case "ship":
      bgColor = "rgba(30, 60, 120, 0.4)";
      break;
    case "hit":
      bgColor = "rgba(185, 28, 28, 0.35)";
      marker = (
        <svg width={cellSize * 0.55} height={cellSize * 0.55} viewBox="0 0 20 20">
          <line x1="3" y1="3" x2="17" y2="17" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" />
          <line x1="17" y1="3" x2="3" y2="17" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" />
        </svg>
      );
      break;
    case "miss":
      bgColor = "rgba(14, 40, 80, 0.6)";
      marker = (
        <svg width={cellSize * 0.45} height={cellSize * 0.45} viewBox="0 0 20 20">
          <circle cx="10" cy="10" r="7" fill="none" stroke="#94a3b8" strokeWidth="2.5" />
        </svg>
      );
      break;
    case "preview-valid":
      bgColor = "rgba(37, 99, 235, 0.4)";
      break;
    case "preview-invalid":
      bgColor = "rgba(185, 28, 28, 0.4)";
      break;
    default:
      break;
  }

  return (
    <div
      style={{ ...baseStyle, backgroundColor: bgColor }}
      onClick={clickable && onClick ? () => onClick(row, col) : undefined}
      className={clickable ? "hover:brightness-150 transition-all" : ""}
    >
      {marker}
    </div>
  );
}
