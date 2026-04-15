import type { BaseSettings } from "@tabledeck/game-room/server";

export type ShipType = "carrier" | "battleship" | "cruiser" | "submarine" | "destroyer";

export type Orientation = "h" | "v";

export interface ShipDef {
  type: ShipType;
  size: number;
  label: string;
}

export const SHIPS: ShipDef[] = [
  { type: "carrier",    size: 5, label: "Carrier" },
  { type: "battleship", size: 4, label: "Battleship" },
  { type: "cruiser",    size: 3, label: "Cruiser" },
  { type: "submarine",  size: 3, label: "Submarine" },
  { type: "destroyer",  size: 2, label: "Destroyer" },
];

export interface PlacedShip {
  type: ShipType;
  origin: { row: number; col: number };
  orientation: Orientation;
  hits: string[]; // "row,col" keys
}

export interface PlayerState {
  seat: number;
  name: string;
  connected: boolean;
  fleet: PlacedShip[] | null;    // null until placement confirmed — NEVER serialized to opponent
  ready: boolean;
  attacks: Record<string, "hit" | "miss">;  // keyed "row,col"
  sunkShips: PlacedShip[];       // opponent ships revealed when fully sunk
  shipsRemaining: number;
}

export type GameStatus = "waiting" | "guessing" | "placing" | "active" | "finished";

export interface GameState {
  status: GameStatus;
  players: (PlayerState | null)[];
  currentTurn: number;
  moveCount: number;
  winner: number | null;
  guesses: (number | null)[];
  guessTarget: number | null;
}

export interface GameSettings extends BaseSettings {
  maxPlayers: 2;
}

// Public subset — no fleet data
export type PublicPlayerState = Omit<PlayerState, "fleet">;
