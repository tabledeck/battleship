import type { PlacedShip } from "~/domain/types";
import { BOARD_SIZE, posKey, getShipCells } from "~/domain/board";
import { BoardCell } from "./BoardCell";
import { ShipSvg } from "../ships/ShipSvg";

const CELL_SIZE = 34;

interface AttackBoardProps {
  /** Attacks you have made on the opponent */
  attacks: Record<string, "hit" | "miss">;
  /** Opponent ships you have fully sunk (revealed) */
  sunkShips: PlacedShip[];
  /** Whether it's your turn — cells are clickable */
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
  // Occupied by revealed (sunk) ships
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

  return (
    <div>
      <p className="text-gray-400 text-xs mb-1 font-medium">{label}</p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${BOARD_SIZE}, ${CELL_SIZE}px)`,
          gridTemplateRows: `repeat(${BOARD_SIZE}, ${CELL_SIZE}px)`,
          position: "relative",
          border: isMyTurn
            ? "2px solid rgba(59,130,246,0.5)"
            : "2px solid rgba(255,255,255,0.06)",
          borderRadius: 4,
          overflow: "visible",
          backgroundColor: "rgba(7, 24, 55, 0.8)",
          boxShadow: isMyTurn
            ? "0 0 12px rgba(59,130,246,0.3), inset 0 0 20px rgba(0,0,0,0.5)"
            : "inset 0 0 20px rgba(0,0,0,0.5)",
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
                opacity: 0.6,
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
  );
}
