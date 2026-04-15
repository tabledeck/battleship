import { z } from "zod";

const PlacedShipSchema = z.object({
  type: z.enum(["carrier", "battleship", "cruiser", "submarine", "destroyer"]),
  origin: z.object({
    row: z.number().int().min(0).max(9),
    col: z.number().int().min(0).max(9),
  }),
  orientation: z.enum(["h", "v"]),
});

export const ClientMessage = z.discriminatedUnion("type", [
  z.object({ type: z.literal("guess_number"), number: z.number().int().min(1).max(10) }),
  z.object({ type: z.literal("place_ships"), ships: z.array(PlacedShipSchema).length(5) }),
  z.object({ type: z.literal("fire_shot"), row: z.number().int().min(0).max(9), col: z.number().int().min(0).max(9) }),
  z.object({ type: z.literal("chat"), text: z.string().min(1).max(200) }),
  z.object({ type: z.literal("ping") }),
]);

export type ClientMessageType = z.infer<typeof ClientMessage>;

// Server-to-client message types (for TypeScript use in the client)
export type ServerMessage =
  | { type: "game_state"; state: Record<string, unknown>; yourFleet?: unknown[] }
  | { type: "guess_reveal"; guesses: (number | null)[]; guessTarget: number; firstSeat: number }
  | { type: "placement_ready"; seat: number }
  | { type: "all_placed"; state: Record<string, unknown>; firstTurn: number }
  | { type: "shot_result"; seat: number; row: number; col: number; result: "hit" | "miss"; nextTurn: number; sunk?: string; sunkShip?: unknown; gameOver?: boolean; winner?: number }
  | { type: "chat_broadcast"; seat: number; text: string }
  | { type: "player_joined"; seat: number; name: string }
  | { type: "player_disconnected"; seat: number }
  | { type: "error"; message: string }
  | { type: "pong" };
