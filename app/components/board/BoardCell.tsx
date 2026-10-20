interface BoardCellProps {
  row: number;
  col: number;
  state: "empty" | "ship" | "hit" | "miss" | "preview-valid" | "preview-invalid";
  onClick?: (row: number, col: number) => void;
  clickable?: boolean;
  cellSize?: number;
  boardType?: "fleet" | "attack";
  ariaLabel?: string;
}

export function BoardCell({
  row,
  col,
  state,
  onClick,
  clickable = false,
  cellSize = 36,
  boardType = "attack",
  ariaLabel,
}: BoardCellProps) {
  let bgClass = boardType === "fleet" ? "bg-grid-paper" : "bg-grid-steel";

  if (state === "ship" || state === "preview-valid" || state === "preview-invalid") {
    bgClass = "bg-grid-paper";
  }

  const borderClass = boardType === "fleet"
    ? "border border-navy/10"
    : "border border-white/10";

  const previewClass = state === "preview-valid"
    ? "drag-preview-valid"
    : state === "preview-invalid"
    ? "drag-preview-invalid"
    : "";

  const hoverClass = clickable
    ? "hover:brightness-125 active:brightness-90 transition-all duration-100 cursor-pointer"
    : "cursor-default";

  const pegStyle = { zIndex: 4 } as const;
  const interactive = Boolean(clickable && onClick);

  const shared = {
    style: { width: cellSize, height: cellSize, flexShrink: 0 } as const,
    className: `bs-cell ${bgClass} ${borderClass} ${previewClass} ${hoverClass} flex items-center justify-center relative box-border`,
    "data-row": row,
    "data-col": col,
    "data-board": boardType,
    "aria-label": ariaLabel,
  };

  const inner = (
    <>
      {state === "hit" && <div className="peg-hit" style={pegStyle} />}
      {state === "miss" && <div className="peg-miss" style={pegStyle} />}
    </>
  );

  if (interactive) {
    return (
      <button
        type="button"
        {...shared}
        onClick={() => onClick!(row, col)}
      >
        {inner}
      </button>
    );
  }

  return <div {...shared}>{inner}</div>;
}
