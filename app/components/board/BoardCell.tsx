interface BoardCellProps {
  row: number;
  col: number;
  state: "empty" | "ship" | "hit" | "miss" | "preview-valid" | "preview-invalid";
  onClick?: (row: number, col: number) => void;
  clickable?: boolean;
  cellSize?: number;
  boardType?: "fleet" | "attack";
}

export function BoardCell({
  row,
  col,
  state,
  onClick,
  clickable = false,
  cellSize = 36,
  boardType = "attack",
}: BoardCellProps) {
  // Determine background class based on board type and state
  let bgClass = boardType === "fleet" ? "bg-grid-paper" : "bg-grid-steel";

  if (state === "ship") {
    bgClass = "bg-grid-paper"; // ships are always on fleet board
  } else if (state === "preview-valid") {
    bgClass = "bg-grid-paper";
  } else if (state === "preview-invalid") {
    bgClass = "bg-grid-paper";
  }

  // Border class varies by board type
  const borderClass = boardType === "fleet"
    ? "border border-navy/10"
    : "border border-white/10";

  // Extra styling for preview states
  const previewClass = state === "preview-valid"
    ? "drag-preview-valid"
    : state === "preview-invalid"
    ? "drag-preview-invalid"
    : "";

  const hoverClass = clickable
    ? "hover:brightness-125 transition-all duration-100 cursor-pointer"
    : "cursor-default";

  return (
    <div
      style={{ width: cellSize, height: cellSize, flexShrink: 0 }}
      className={`${bgClass} ${borderClass} ${previewClass} ${hoverClass} flex items-center justify-center relative box-border`}
      onClick={clickable && onClick ? () => onClick(row, col) : undefined}
    >
      {state === "hit" && <div className="peg-hit" />}
      {state === "miss" && <div className="peg-miss" />}
    </div>
  );
}
