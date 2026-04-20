import type { PlacedShip } from "~/domain/types";
import { BOARD_SIZE, posKey, getShipCells } from "~/domain/board";
import { BoardCell } from "./BoardCell";
import { ShipSvg } from "../ships/ShipSvg";

const CELL_SIZE = 34;

// Column labels A–J
const COL_LABELS = ["A","B","C","D","E","F","G","H","I","J"];

interface AttackBoardProps {
  attacks: Record<string, "hit" | "miss">;
  sunkShips: PlacedShip[];
  isMyTurn: boolean;
  onFire: (row: number, col: number) => void;
  label?: string;
}

export function AttackBoard({
  attacks,
  sunkShips,
  isMyTurn,
  onFire,
  label = "Opponent's Grid",
}: AttackBoardProps) {
  const sunkCells = new Set<string>();
  for (const ship of sunkShips) {
    for (const cell of getShipCells(ship)) {
      sunkCells.add(posKey(cell.row, cell.col));
    }
  }

  const getCellState = (row: number, col: number) => {
    const key = posKey(row, col);
    const attack = attacks[key];
    if (attack === "hit") return "hit";
    if (attack === "miss") return "miss";
    return "empty";
  };

  const isCellClickable = (row: number, col: number) => {
    if (!isMyTurn) return false;
    const key = posKey(row, col);
    return !attacks[key];
  };

  const borderColor = isMyTurn
    ? "2px solid rgba(201,162,74,0.55)"
    : "2px solid rgba(255,255,255,0.08)";

  const outerGlow = isMyTurn
    ? "0 0 18px rgba(201,162,74,0.2), inset 0 0 24px rgba(0,0,0,0.35)"
    : "inset 0 0 24px rgba(0,0,0,0.35)";

  return (
    <div>
      {/* Label */}
      <p style={{
        fontFamily: "var(--serif)",
        fontVariant: "small-caps",
        letterSpacing: "0.22em",
        fontSize: "11px",
        color: isMyTurn ? "var(--gold)" : "rgba(246,239,224,0.45)",
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
            color: "rgba(255,255,255,0.25)",
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
              color: "rgba(255,255,255,0.25)",
              paddingRight: "3px",
            }}>{row + 1}</div>
          ))}
        </div>

        {/* Board */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${BOARD_SIZE}, ${CELL_SIZE}px)`,
            gridTemplateRows: `repeat(${BOARD_SIZE}, ${CELL_SIZE}px)`,
            position: "relative",
            border: borderColor,
            borderRadius: 4,
            overflow: "visible",
            boxShadow: outerGlow,
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
                clickable={isCellClickable(row, col)}
                onClick={isMyTurn ? onFire : undefined}
                boardType="attack"
              />
            ))
          )}

          {/* Revealed sunk ships */}
          {sunkShips.map((ship) => {
            const cells = getShipCells(ship);
            if (cells.length === 0) return null;
            const first = cells[0];
            return (
              <div
                key={`sunk-${ship.type}`}
                style={{
                  position: "absolute",
                  top: first.row * CELL_SIZE,
                  left: first.col * CELL_SIZE,
                  pointerEvents: "none",
                  zIndex: 2,
                  opacity: 0.65,
                }}
              >
                <ShipSvg
                  type={ship.type}
                  orientation={ship.orientation}
                  cellSize={CELL_SIZE}
                  sunk
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
