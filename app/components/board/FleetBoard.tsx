import { useDroppable } from "@dnd-kit/core";
import type { PlacedShip } from "~/domain/types";
import { BOARD_SIZE, posKey, getShipCells, getShipSize } from "~/domain/board";
import { BoardCell } from "./BoardCell";
import { ShipSvg } from "../ships/ShipSvg";

const CELL_SIZE = 34;

// Column labels A–J
const COL_LABELS = ["A","B","C","D","E","F","G","H","I","J"];

interface FleetBoardProps {
  fleet: PlacedShip[];
  incomingAttacks: Record<string, "hit" | "miss">;
  droppable?: boolean;
  previewShip?: PlacedShip | null;
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

  const shipCells = new Map<string, PlacedShip>();
  for (const ship of fleet) {
    for (const cell of getShipCells(ship)) {
      shipCells.set(posKey(cell.row, cell.col), ship);
    }
  }

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

  const borderColor = isOver
    ? "2px solid rgba(201,162,74,0.7)"
    : "2px solid rgba(15,29,51,0.4)";

  return (
    <div>
      {/* Label */}
      <p style={{
        fontFamily: "var(--serif)",
        fontVariant: "small-caps",
        letterSpacing: "0.22em",
        fontSize: "11px",
        color: "var(--ink-soft)",
        marginBottom: "6px",
      }}>{label}</p>

      {/* Column labels */}
      <div style={{ display: "flex", paddingLeft: "20px", marginBottom: "2px" }}>
        {COL_LABELS.map((l) => (
          <div key={l} style={{
            width: CELL_SIZE,
            textAlign: "center",
            fontFamily: "var(--mono)",
            fontSize: "9px",
            color: "rgba(15,29,51,0.5)",
            lineHeight: 1,
          }}>{l}</div>
        ))}
      </div>

      <div style={{ display: "flex" }}>
        {/* Row numbers */}
        <div style={{ display: "flex", flexDirection: "column", marginRight: "2px" }}>
          {Array.from({ length: BOARD_SIZE }, (_, row) => (
            <div key={row} style={{
              height: CELL_SIZE,
              width: "18px",
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              fontFamily: "var(--mono)",
              fontSize: "9px",
              color: "rgba(15,29,51,0.5)",
              paddingRight: "3px",
            }}>{row + 1}</div>
          ))}
        </div>

        {/* Board */}
        <div
          ref={droppable ? setNodeRef : undefined}
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${BOARD_SIZE}, ${CELL_SIZE}px)`,
            gridTemplateRows: `repeat(${BOARD_SIZE}, ${CELL_SIZE}px)`,
            position: "relative",
            border: borderColor,
            borderRadius: 4,
            overflow: "visible",
            boxShadow: "inset 0 0 24px rgba(15,29,51,0.15)",
          }}
        >
          {Array.from({ length: BOARD_SIZE }, (_, row) =>
            Array.from({ length: BOARD_SIZE }, (_, col) => (
              <BoardCell
                key={`${row},${col}`}
                row={row}
                col={col}
                state={getCellState(row, col)}
                cellSize={CELL_SIZE}
                boardType="fleet"
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
                  opacity: isSunk ? 0.55 : 1,
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
                  opacity: 0.75,
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
    </div>
  );
}
