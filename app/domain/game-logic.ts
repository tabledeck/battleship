import type { GameState, GameSettings, PlayerState } from "./types";
import { SHIPS } from "./types";

export function initializeGame(settings: GameSettings): GameState {
  return {
    status: "waiting",
    players: [null, null],
    currentTurn: 0,
    moveCount: 0,
    winner: null,
    guesses: [null, null],
    guessTarget: null,
  };
}

export function createPlayer(seat: number, name: string): PlayerState {
  return {
    seat,
    name,
    connected: true,
    fleet: null,
    ready: false,
    attacks: {},
    sunkShips: [],
    shipsRemaining: SHIPS.length,
  };
}

// Serialize state for DO storage — includes full fleet data
export function serializeGameState(state: GameState): Record<string, unknown> {
  return {
    status: state.status,
    currentTurn: state.currentTurn,
    moveCount: state.moveCount,
    winner: state.winner,
    guesses: state.guesses,
    guessTarget: state.guessTarget,
    // Include fleet in storage serialization so it survives DO eviction
    players: state.players.map((p) =>
      p
        ? {
            seat: p.seat,
            name: p.name,
            connected: p.connected,
            fleet: p.fleet,
            ready: p.ready,
            attacks: p.attacks,
            sunkShips: p.sunkShips,
            shipsRemaining: p.shipsRemaining,
          }
        : null
    ),
  };
}

// Public state for WS broadcast — strips fleet data
export function publicGameState(state: GameState): Record<string, unknown> {
  return {
    status: state.status,
    currentTurn: state.currentTurn,
    moveCount: state.moveCount,
    winner: state.winner,
    guesses: state.guesses,
    players: state.players
      .filter(Boolean)
      .map((p) => ({
        seat: p!.seat,
        name: p!.name,
        connected: p!.connected,
        ready: p!.ready,
        attacks: p!.attacks,
        sunkShips: p!.sunkShips,
        shipsRemaining: p!.shipsRemaining,
        // fleet intentionally omitted
      })),
  };
}

// Private data for a specific seat — includes their own fleet
export function getPrivateState(state: GameState, seat: number): Record<string, unknown> {
  const player = state.players[seat];
  if (!player) return {};
  return {
    yourFleet: player.fleet ?? [],
  };
}

export function deserializeGameState(data: Record<string, unknown>): GameState {
  const raw = data as any;
  const players: (PlayerState | null)[] = [null, null];
  for (const p of raw.players ?? []) {
    if (!p) continue;
    players[p.seat] = {
      seat: p.seat,
      name: p.name ?? "Guest",
      connected: p.connected ?? false,
      fleet: p.fleet ?? null,
      ready: p.ready ?? false,
      attacks: p.attacks ?? {},
      sunkShips: p.sunkShips ?? [],
      shipsRemaining: p.shipsRemaining ?? SHIPS.length,
    };
  }
  return {
    status: raw.status ?? "waiting",
    players,
    currentTurn: raw.currentTurn ?? 0,
    moveCount: raw.moveCount ?? 0,
    winner: raw.winner ?? null,
    guesses: raw.guesses ?? [null, null],
    guessTarget: raw.guessTarget ?? null,
  };
}
