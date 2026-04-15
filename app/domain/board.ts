import type { PlacedShip } from "./types";
import { SHIPS } from "./types";

export { SHIPS };

export const BOARD_SIZE = 10;

export function posKey(row: number, col: number): string {
  return `${row},${col}`;
}

export function parseKey(key: string): { row: number; col: number } {
  const [row, col] = key.split(",").map(Number);
  return { row, col };
}

export function getShipSize(type: string): number {
  return SHIPS.find((s) => s.type === type)?.size ?? 1;
}

export function getShipCells(ship: PlacedShip): { row: number; col: number }[] {
  const cells: { row: number; col: number }[] = [];
  const size = getShipSize(ship.type);
  for (let i = 0; i < size; i++) {
    cells.push(
      ship.orientation === "h"
        ? { row: ship.origin.row, col: ship.origin.col + i }
        : { row: ship.origin.row + i, col: ship.origin.col }
    );
  }
  return cells;
}

export function isInBounds(ship: PlacedShip): boolean {
  return getShipCells(ship).every(
    ({ row, col }) => row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE
  );
}

export function shipsOverlap(ships: PlacedShip[]): boolean {
  const occupied = new Set<string>();
  for (const ship of ships) {
    for (const cell of getShipCells(ship)) {
      const key = posKey(cell.row, cell.col);
      if (occupied.has(key)) return true;
      occupied.add(key);
    }
  }
  return false;
}

export function isShipSunk(ship: PlacedShip): boolean {
  const cells = getShipCells(ship);
  return cells.every((c) => ship.hits.includes(posKey(c.row, c.col)));
}

export function findShipAtCell(fleet: PlacedShip[], row: number, col: number): PlacedShip | null {
  const key = posKey(row, col);
  return fleet.find((ship) => getShipCells(ship).some((c) => posKey(c.row, c.col) === key)) ?? null;
}

export function randomFleet(): PlacedShip[] {
  const placed: PlacedShip[] = [];
  for (const shipDef of SHIPS) {
    let ship: PlacedShip;
    let attempts = 0;
    do {
      const orientation: "h" | "v" = Math.random() < 0.5 ? "h" : "v";
      const maxRow = orientation === "h" ? BOARD_SIZE - 1 : BOARD_SIZE - shipDef.size;
      const maxCol = orientation === "h" ? BOARD_SIZE - shipDef.size : BOARD_SIZE - 1;
      const row = Math.floor(Math.random() * (maxRow + 1));
      const col = Math.floor(Math.random() * (maxCol + 1));
      ship = { type: shipDef.type, origin: { row, col }, orientation, hits: [] };
      attempts++;
    } while ((isInBounds(ship) === false || shipsOverlap([...placed, ship])) && attempts < 1000);
    placed.push(ship);
  }
  return placed;
}
