import { useDroppable } from "@dnd-kit/core";
import type { PlacedShip } from "~/domain/types";
import { BOARD_SIZE, posKey, getShipCells, getShipSize } from "~/domain/board";
import { BoardCell } from "./BoardCell";
import { ShipSvg } from "../ships/ShipSvg";

const CELL_SIZE = 34;

interface FleetBoardProps {
  /** Your placed fleet (confirmed or pending during placement) */
  fleet: PlacedShip[];
  /** Attacks made BY your opponent on your grid */
  incomingAttacks: Record<string, "hit" | "miss">;
  /** Whether this board should accept drops (during placement phase) */
  droppable?: boolean;
  /** Preview ship while dragging over this board */
  previewShip?: PlacedShip | null;
  /** Highlight these cells red (overlap preview) */
  label?: string;
}

export function FleetBoard({
  fleet,
  incomingAttacks,
  droppable = false,
  previewShip = null,
  label = "Your Fleet",
}: FleetBoardProps) {
  const { setNodeRef, isOver } = useDroppable({ id: "fleet-board" });

  // Build cell lookup
  const shipCells = new Map<string, PlacedShip>();
  for (const ship of fleet) {
    for (const cell of getShipCells(ship)) {
      shipCells.set(posKey(cell.row, cell.col), ship);
    }
  }

  // Preview cells
  const previewCells = new Map<string, "valid" | "invalid">();
  if (previewShip && droppable) {
    const cells = getShipCells(previewShip);
    const isValid = cells.every(
      (c) =>
        c.row >= 0 && c.row < BOARD_SIZE &&
        c.col >= 0 && c.col < BOARD_SIZE &&
        !shipCells.has(posKey(c.row, c.col))
    );
    for (const c of cells) {
      previewCells.set(posKey(c.row, c.col), isValid ? "valid" : "invalid");
    }
  }

  const getCellState = (row: number, col: number) => {
    const key = posKey(row, col);
    if (previewCells.has(key)) {
      return previewCells.get(key) === "valid" ? "preview-valid" : "preview-invalid";
    }
    const attack = incomingAttacks[key];
    if (attack === "hit") return "hit";
    if (attack === "miss") return "miss";
    if (shipCells.has(key)) return "ship";
    return "empty";
  };

  return (
    <div>
      <p className="text-gray-400 text-xs mb-1 font-medium">{label}</p>
      <div
        ref={droppable ? setNodeRef : undefined}
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${BOARD_SIZE}, ${CELL_SIZE}px)`,
          gridTemplateRows: `repeat(${BOARD_SIZE}, ${CELL_SIZE}px)`,
          position: "relative",
          border: isOver ? "2px solid rgba(59,130,246,0.6)" : "2px solid rgba(255,255,255,0.06)",
          borderRadius: 4,
          overflow: "visible",
          backgroundColor: "rgba(7, 24, 55, 0.8)",
          boxShadow: "inset 0 0 20px rgba(0,0,0,0.5)",
        }}
      >
        {/* Grid cells */}
        {Array.from({ length: BOARD_SIZE }, (_, row) =>
          Array.from({ length: BOARD_SIZE }, (_, col) => (
            <BoardCell
              key={`${row},${col}`}
              row={row}
              col={col}
              state={getCellState(row, col)}
              cellSize={CELL_SIZE}
            />
          ))
        )}

        {/* Ship SVG overlays */}
        {fleet.map((ship) => {
          const cells = getShipCells(ship);
          if (cells.length === 0) return null;
          const first = cells[0];
          const isSunk = ship.hits.length >= getShipSize(ship.type);
          return (
            <div
              key={`ship-${ship.type}`}
              style={{
                position: "absolute",
                top: first.row * CELL_SIZE,
                left: first.col * CELL_SIZE,
                pointerEvents: "none",
                zIndex: 2,
                opacity: isSunk ? 0.5 : 1,
              }}
            >
              <ShipSvg
                type={ship.type}
                orientation={ship.orientation}
                cellSize={CELL_SIZE}
                sunk={isSunk}
              />
            </div>
          );
        })}

        {/* Preview ship overlay */}
        {previewShip && droppable && (() => {
          const cells = getShipCells(previewShip);
          if (cells.length === 0) return null;
          const first = cells[0];
          return (
            <div
              style={{
                position: "absolute",
                top: first.row * CELL_SIZE,
                left: first.col * CELL_SIZE,
                pointerEvents: "none",
                zIndex: 3,
                opacity: 0.7,
              }}
            >
              <ShipSvg
                type={previewShip.type}
                orientation={previewShip.orientation}
                cellSize={CELL_SIZE}
              />
            </div>
          );
        })()}
      </div>
    </div>
  );
}
