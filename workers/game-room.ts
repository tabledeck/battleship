import { BaseGameRoomDO } from "@tabledeck/game-room/server";
import type { GameState, GameSettings, PlayerState, PlacedShip } from "../app/domain/types";
import {
  posKey,
  isInBounds,
  shipsOverlap,
  isShipSunk,
  findShipAtCell,
} from "../app/domain/board";
import {
  initializeGame,
  createPlayer,
  serializeGameState,
  publicGameState,
  getPrivateState,
  deserializeGameState,
} from "../app/domain/game-logic";
import { ClientMessage } from "../app/domain/messages";
import { syncGameStatusToD1 } from "./status-sync";

export class BattleshipRoomDO extends BaseGameRoomDO<GameState, GameSettings, Env> {
  // ── Abstract implementations ─────────────────────────────────────────────

  protected initializeState(settings: GameSettings): GameState {
    return initializeGame(settings);
  }

  /**
   * Used for BOTH DO storage and initial WS game_state broadcast via base class.
   * We include the full fleet here so the DO state survives eviction/hibernation.
   * Direct WS broadcasts in game handlers use publicGameState() to strip fleet.
   */
  protected serializeState(state: GameState): Record<string, unknown> {
    return serializeGameState(state);
  }

  protected deserializeState(data: Record<string, unknown>): GameState {
    return deserializeGameState(data);
  }

  protected isPlayerSeated(state: GameState, seat: number): boolean {
    return state.players[seat] != null;
  }

  protected getPlayerName(state: GameState, seat: number): string | null {
    return state.players[seat]?.name ?? null;
  }

  protected seatPlayer(state: GameState, seat: number, name: string): GameState {
    const players = [...state.players] as (PlayerState | null)[];
    players[seat] = createPlayer(seat, name);
    return { ...state, players };
  }

  protected getSeatedCount(state: GameState): number {
    return state.players.filter(Boolean).length;
  }

  /**
   * Override base class WS connect message — send public state (no fleet) + private fleet.
   * The base class normally sends serializeState() which includes fleet (needed for storage).
   * By overriding getPrivateStateForSeat, the WS connect message becomes:
   *   { type: "game_state", state: <public>, yourFleet: [...] }
   * But the base class always uses serializeState() as the `state` field.
   * So we use a workaround: include the stripped state in getPrivateStateForSeat
   * and the client ignores the full state field on the initial connect.
   * Actually: getPrivateStateForSeat merges INTO the game_state message, overriding `state`.
   */
  protected getPrivateStateForSeat(seat: number): Record<string, unknown> {
    if (!this.gameState) return {};
    return {
      state: publicGameState(this.gameState),
      ...getPrivateState(this.gameState, seat),
    };
  }

  protected onPlayerDisconnected(seat: number): void {
    const player = this.gameState?.players[seat];
    if (player) player.connected = false;
  }

  protected async onAllPlayersSeated(): Promise<void> {
    const state = this.gameState!;
    state.status = "guessing";
    state.guessTarget = Math.floor(Math.random() * 10) + 1;
    await this.persistState();
    this.broadcastPublicState(state);
    // Both seats are filled and the match has begun. D1 "active" is what
    // weekly stats count as a started game — not the later shooting phase.
    await this.syncStatusToDB();
  }

  protected async onGameMessage(
    ws: WebSocket,
    rawMsg: unknown,
    seat: number,
    _playerName: string,
  ): Promise<void> {
    if (!this.gameState || !this.settings) return;

    const result = ClientMessage.safeParse(rawMsg);
    if (!result.success) {
      ws.send(JSON.stringify({ type: "error", message: "Invalid message" }));
      return;
    }

    const msg = result.data;
    const state = this.gameState;

    try {
      switch (msg.type) {
        case "guess_number":
          await this.handleGuess(ws, seat, msg.number, state);
          break;

        case "place_ships":
          await this.handlePlaceShips(ws, seat, msg.ships as Omit<PlacedShip, "hits">[], state);
          break;

        case "fire_shot":
          await this.handleFireShot(ws, seat, msg.row, msg.col, state);
          break;

        case "chat":
          this.broadcast(JSON.stringify({ type: "chat_broadcast", seat, text: msg.text }));
          break;

        case "forfeit":
          await this.handleForfeit(seat, state);
          break;

        case "rematch_invite":
          this.broadcast(JSON.stringify({
            type: "rematch_offered",
            gameId: msg.gameId,
            fromSeat: seat,
          }));
          break;

        case "ping":
          ws.send(JSON.stringify({ type: "pong" }));
          break;
      }
    } catch (err) {
      console.error("[battleship] Unexpected error in game message handler:", err);
      ws.send(JSON.stringify({ type: "error", message: "Unexpected server error" }));
    }
  }

  // ── Game handlers ────────────────────────────────────────────────────────

  private async handleGuess(ws: WebSocket, seat: number, number: number, state: GameState) {
    if (state.status !== "guessing") return;
    if (state.guesses[seat] != null) return;

    state.guesses[seat] = number;
    this.broadcastPublicState(state);

    const seated = state.players.filter((p): p is NonNullable<typeof p> => p != null);
    const allGuessed = seated.length >= 2 && seated.every((p) => state.guesses[p.seat] != null);

    if (!allGuessed) {
      await this.persistState();
      return;
    }

    await this.persistState();
    await new Promise((r) => setTimeout(r, 1500));

    const target = state.guessTarget!;
    let bestSeat = 0;
    let bestDist = Infinity;
    state.players.forEach((p, i) => {
      if (!p) return;
      const dist = Math.abs((state.guesses[i] ?? 0) - target);
      if (dist < bestDist || (dist === bestDist && i < bestSeat)) {
        bestDist = dist;
        bestSeat = i;
      }
    });

    this.broadcast(JSON.stringify({
      type: "guess_reveal",
      guesses: state.guesses,
      guessTarget: target,
      firstSeat: bestSeat,
    }));

    await new Promise((r) => setTimeout(r, 2000));

    state.status = "placing";
    state.currentTurn = bestSeat;
    await this.persistState();
    this.broadcastPublicState(state);
  }

  private async handlePlaceShips(
    ws: WebSocket,
    seat: number,
    rawShips: Omit<PlacedShip, "hits">[],
    state: GameState,
  ) {
    if (state.status !== "placing") return;
    const player = state.players[seat];
    if (!player || player.ready) return;

    const ships: PlacedShip[] = rawShips.map((s) => ({ ...s, hits: [] }));

    const types = new Set(ships.map((s) => s.type));
    if (types.size !== 5) {
      ws.send(JSON.stringify({ type: "error", message: "Must place all 5 ships" }));
      return;
    }
    if (ships.some((s) => !isInBounds(s))) {
      ws.send(JSON.stringify({ type: "error", message: "Ships out of bounds" }));
      return;
    }
    if (shipsOverlap(ships)) {
      ws.send(JSON.stringify({ type: "error", message: "Ships overlap" }));
      return;
    }

    player.fleet = ships;
    player.ready = true;
    await this.persistState();

    this.broadcast(JSON.stringify({ type: "placement_ready", seat }));
    // Send the placing player their confirmed fleet
    ws.send(JSON.stringify({ type: "game_state", state: publicGameState(state), yourFleet: ships }));
    // Broadcast updated ready status to everyone
    this.broadcastPublicState(state);

    const allReady = state.players.filter(Boolean).every((p) => p!.ready);
    if (allReady) {
      state.status = "active";
      await this.persistState();
      await this.syncStatusToDB();
      this.broadcast(JSON.stringify({
        type: "all_placed",
        state: publicGameState(state),
        firstTurn: state.currentTurn,
      }));
    }
  }

  private async handleFireShot(
    ws: WebSocket,
    seat: number,
    row: number,
    col: number,
    state: GameState,
  ) {
    if (state.status !== "active") return;
    if (state.currentTurn !== seat) {
      ws.send(JSON.stringify({ type: "error", message: "Not your turn" }));
      return;
    }

    const key = posKey(row, col);
    const attacker = state.players[seat]!;

    if (attacker.attacks[key]) {
      ws.send(JSON.stringify({ type: "error", message: "Already fired here" }));
      return;
    }

    const opponentSeat = seat === 0 ? 1 : 0;
    const opponent = state.players[opponentSeat]!;
    const hitShip = findShipAtCell(opponent.fleet ?? [], row, col);

    let resultType: "hit" | "miss" = "miss";
    let sunkShip: PlacedShip | null = null;

    if (hitShip) {
      resultType = "hit";
      hitShip.hits.push(key);
      if (isShipSunk(hitShip)) {
        sunkShip = hitShip;
        opponent.shipsRemaining--;
        attacker.sunkShips.push({ ...hitShip });
      }
    }

    attacker.attacks[key] = resultType;
    state.moveCount++;

    const shotResult: Record<string, unknown> = {
      type: "shot_result",
      seat,
      row,
      col,
      result: resultType,
      nextTurn: opponentSeat,
    };

    if (sunkShip) {
      shotResult.sunk = sunkShip.type;
      shotResult.sunkShip = {
        type: sunkShip.type,
        origin: sunkShip.origin,
        orientation: sunkShip.orientation,
      };
    }

    if (opponent.shipsRemaining === 0) {
      state.status = "finished";
      state.winner = seat;
      state.endReason = "ships_sunk";
      state.forfeitedBy = null;
      shotResult.gameOver = true;
      shotResult.winner = seat;
      await this.syncStatusToDB();
    } else {
      state.currentTurn = opponentSeat;
    }

    await this.persistState();
    this.broadcast(JSON.stringify(shotResult));
    this.broadcastPublicState(state);
  }

  // ── Utilities ────────────────────────────────────────────────────────────

  /** Broadcast the public game state (fleet-stripped) to all connected clients. */
  private broadcastPublicState(state: GameState) {
    this.broadcast(JSON.stringify({ type: "game_state", state: publicGameState(state) }));
  }

  private async handleForfeit(seat: number, state: GameState) {
    if (state.status === "waiting" || state.status === "finished") return;
    const player = state.players[seat];
    if (!player) return;
    const opponentSeat = seat === 0 ? 1 : 0;
    if (!state.players[opponentSeat]) return;

    state.status = "finished";
    state.winner = opponentSeat;
    state.endReason = "forfeit";
    state.forfeitedBy = seat;
    await this.persistState();
    await this.syncStatusToDB();
    this.broadcast(JSON.stringify({
      type: "game_over",
      winner: opponentSeat,
      reason: "forfeit",
      forfeitedBy: seat,
    }));
    this.broadcastPublicState(state);
  }

  private async syncStatusToDB() {
    if (!this.gameId || !this.gameState) return;
    try {
      await syncGameStatusToD1(
        this.env.D1_DATABASE,
        this.gameId,
        this.gameState.status,
        this.gameState.winner,
      );
    } catch (err) {
      console.error("[battleship] D1 sync failed:", err);
    }
  }
}
