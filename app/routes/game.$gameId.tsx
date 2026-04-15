import { useState, useCallback, useEffect, useRef } from "react";
import { data, redirect, useFetcher } from "react-router";
import type { Route } from "./+types/game.$gameId";
import { getPrisma } from "~/db.server";
import { getOptionalUserFromContext } from "~/domain/utils/global-context.server";
import type { PlacedShip, PublicPlayerState, GameStatus } from "~/domain/types";
import type { ServerMessage } from "~/domain/messages";
import { Chat } from "~/components/chat/Chat";
import { PlacementPhase } from "~/components/game/PlacementPhase";
import { ActivePhase } from "~/components/game/ActivePhase";
import { useGameWebSocket } from "@tabledeck/game-room/client";

export function meta({ params }: Route.MetaArgs) {
  return [{ title: `Game ${params.gameId} — Battleship` }];
}

export async function loader({ params, request, context }: Route.LoaderArgs) {
  const { gameId } = params;
  const db = getPrisma(context);

  const game = await db.game.findUnique({
    where: { id: gameId },
    include: { players: { include: { user: true } } },
  });

  if (!game) throw redirect("/");

  const user = getOptionalUserFromContext(context);
  const settings = JSON.parse(game.settings) as { maxPlayers: number };

  // Determine this visitor's seat
  let mySeat = -1;
  let myName = "Guest";

  if (user) {
    const myPlayer = game.players.find((p) => p.userId === user.id);
    if (myPlayer) {
      mySeat = myPlayer.seat;
      myName = user.name || user.email;
    } else if (game.players.length < game.maxPlayers && game.status === "waiting") {
      const usedSeats = new Set(game.players.map((p) => p.seat));
      for (let s = 0; s < game.maxPlayers; s++) {
        if (!usedSeats.has(s)) {
          mySeat = s;
          break;
        }
      }
      myName = user.name || user.email;
      if (mySeat >= 0) {
        await db.user.upsert({
          where: { id: user.id },
          create: { id: user.id, email: user.email, name: user.name || "" },
          update: { name: user.name || "", email: user.email },
        });
        await db.gamePlayer.create({
          data: { gameId, userId: user.id, seat: mySeat },
        });
      }
    }
  } else {
    // Guest cookie check — cookie name: bs_<gameId>
    const cookieHeader = request.headers.get("Cookie") ?? "";
    const cookieName = `bs_${gameId}`;
    const match = cookieHeader
      .split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${cookieName}=`));
    if (match) {
      const [rawSeat, ...nameParts] = match.slice(cookieName.length + 1).split(":");
      const savedSeat = parseInt(rawSeat, 10);
      const savedName = decodeURIComponent(nameParts.join(":"));
      const existing = game.players.find((p) => p.seat === savedSeat && p.guestName === savedName);
      if (existing) {
        mySeat = savedSeat;
        myName = savedName;
      }
    }
  }

  const url = new URL(request.url);
  const shareUrl = `${url.protocol}//${url.host}/game/${gameId}`;

  // Notify DO about this seated player
  if (mySeat >= 0) {
    try {
      const env = (context as any).cloudflare?.env as Env | undefined;
      if (env) {
        const doId = env.GAME_ROOM.idFromName(gameId);
        const stub = env.GAME_ROOM.get(doId);
        await stub.fetch(new Request("http://internal/join", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ seat: mySeat, name: myName }),
        }));
      }
    } catch {
      // Non-fatal
    }
  }

  // Fetch game state from DO for SSR
  let initialState: Record<string, unknown> = { status: "waiting", players: [], guesses: [null, null], currentTurn: 0, moveCount: 0, winner: null };
  let yourFleet: PlacedShip[] = [];
  try {
    const env = (context as any).cloudflare?.env as Env | undefined;
    if (env) {
      const doId = env.GAME_ROOM.idFromName(gameId);
      const stub = env.GAME_ROOM.get(doId);
      const stateRes = await stub.fetch(new Request(`http://internal/state`));
      if (stateRes.ok) {
        const stateData = (await stateRes.json()) as { state: Record<string, unknown> };
        // state from DO includes fleet (for storage) — we strip it before sending to client
        const rawState = stateData.state as any;
        initialState = {
          status: rawState.status ?? "waiting",
          players: (rawState.players ?? []).map((p: any) => ({
            seat: p.seat,
            name: p.name,
            connected: p.connected,
            ready: p.ready,
            attacks: p.attacks ?? {},
            sunkShips: p.sunkShips ?? [],
            shipsRemaining: p.shipsRemaining ?? 5,
          })),
          currentTurn: rawState.currentTurn ?? 0,
          moveCount: rawState.moveCount ?? 0,
          winner: rawState.winner ?? null,
          guesses: rawState.guesses ?? [null, null],
        };
        // Extract this player's fleet if present
        if (mySeat >= 0 && rawState.players) {
          const myPlayer = rawState.players.find((p: any) => p.seat === mySeat);
          if (myPlayer?.fleet) {
            yourFleet = myPlayer.fleet;
          }
        }
      }
    }
  } catch {
    // DO not initialized yet
  }

  return data({
    gameId,
    mySeat,
    myName,
    shareUrl,
    maxPlayers: game.maxPlayers,
    gameStatus: game.status,
    dbPlayers: game.players.map((p) => ({
      seat: p.seat,
      name: p.user?.name || p.user?.email || p.guestName || "Guest",
    })),
    initialState,
    yourFleet,
  });
}

export async function action({ params, request, context }: Route.ActionArgs) {
  const { gameId } = params;
  const body = await request.json() as { guestName?: string };

  if (body.guestName) {
    const db = getPrisma(context);
    const game = await db.game.findUnique({ where: { id: gameId }, include: { players: true } });
    if (!game) return data({ error: "Game not found" }, { status: 404 });
    if (game.status === "finished") return data({ error: "Game is over" }, { status: 400 });

    const usedSeats = new Set(game.players.map((p) => p.seat));
    let seat = -1;
    for (let s = 0; s < game.maxPlayers; s++) {
      if (!usedSeats.has(s)) { seat = s; break; }
    }
    if (seat === -1) return data({ error: "Game is full" }, { status: 400 });

    await db.gamePlayer.create({
      data: { gameId, guestName: body.guestName, seat },
    });

    // Notify the DO
    try {
      const env = (context as any).cloudflare?.env as Env | undefined;
      if (env) {
        const doId = env.GAME_ROOM.idFromName(gameId);
        const stub = env.GAME_ROOM.get(doId);
        await stub.fetch(new Request("http://internal/join", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ seat, name: body.guestName }),
        }));
      }
    } catch {
      // Non-fatal
    }

    const cookieName = `bs_${gameId}`;
    const cookieValue = `${seat}:${encodeURIComponent(body.guestName)}`;
    return data(
      { seat, name: body.guestName },
      {
        headers: {
          "Set-Cookie": `${cookieName}=${cookieValue}; Path=/; Max-Age=86400; SameSite=Lax`,
        },
      },
    );
  }

  return data({ error: "Unknown action" }, { status: 400 });
}

// ─── Component ─────────────────────────────────────────────────────────────────

interface PublicGameState {
  status: GameStatus;
  players: PublicPlayerState[];
  currentTurn: number;
  moveCount: number;
  winner: number | null;
  guesses: (number | null)[];
}

function parsePublicState(raw: Record<string, unknown>): PublicGameState {
  const r = raw as any;
  return {
    status: r.status ?? "waiting",
    players: (r.players ?? []) as PublicPlayerState[],
    currentTurn: r.currentTurn ?? 0,
    moveCount: r.moveCount ?? 0,
    winner: r.winner ?? null,
    guesses: r.guesses ?? [null, null],
  };
}

export default function GameRoom({ loaderData }: Route.ComponentProps) {
  const {
    gameId,
    mySeat: initialSeat,
    myName: initialName,
    shareUrl,
    maxPlayers,
    gameStatus,
    dbPlayers,
    initialState,
    yourFleet: initialFleet,
  } = loaderData;

  // Guest join state
  const [guestName, setGuestName] = useState("");
  const [showNameModal, setShowNameModal] = useState(
    initialSeat === -1 && gameStatus === "waiting",
  );
  const [mySeat, setMySeat] = useState(initialSeat);
  const [myName, setMyName] = useState(initialName);
  const joinFetcher = useFetcher<typeof action>();

  // Game state
  const [gameState, setGameState] = useState<PublicGameState>(() => parsePublicState(initialState));
  const [myFleet, setMyFleet] = useState<PlacedShip[]>(initialFleet);
  const [myGuess, setMyGuess] = useState<number | null>(null);
  const [guessReveal, setGuessReveal] = useState<{ guesses: (number | null)[]; guessTarget: number; firstSeat: number } | null>(null);

  // UI state
  const [copied, setCopied] = useState(false);
  const [chatMessages, setChatMessages] = useState<
    Array<{ seat: number; presetId: number; playerName: string; timestamp: number }>
  >([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [lastShotResult, setLastShotResult] = useState<{ row: number; col: number; result: "hit" | "miss" } | null>(null);

  // Merge DB players on first load
  useEffect(() => {
    setGameState((prev) => {
      const byKey = new Map(prev.players.map((p) => [p.seat, p]));
      for (const dp of dbPlayers) {
        if (!byKey.has(dp.seat)) {
          byKey.set(dp.seat, {
            seat: dp.seat,
            name: dp.name,
            connected: false,
            ready: false,
            attacks: {},
            sunkShips: [],
            shipsRemaining: 5,
          });
        }
      }
      return { ...prev, players: [...byKey.values()].sort((a, b) => a.seat - b.seat) };
    });
  }, [dbPlayers]);

  const { send } = useGameWebSocket({
    gameId,
    seat: mySeat,
    name: myName,
    onMessage: useCallback(
      (rawMsg: unknown) => {
        const msg = rawMsg as ServerMessage;

        switch (msg.type) {
          case "game_state": {
            const s = parsePublicState(msg.state as Record<string, unknown>);
            setGameState(s);
            if ((msg as any).yourFleet) {
              setMyFleet((msg as any).yourFleet as PlacedShip[]);
            }
            break;
          }

          case "guess_reveal": {
            setGuessReveal({
              guesses: msg.guesses,
              guessTarget: msg.guessTarget,
              firstSeat: msg.firstSeat,
            });
            // Hide after 3s
            setTimeout(() => setGuessReveal(null), 3000);
            break;
          }

          case "placement_ready":
            // State update will come via game_state broadcast
            break;

          case "all_placed": {
            setGameState(parsePublicState((msg as any).state as Record<string, unknown>));
            break;
          }

          case "shot_result": {
            const sr = msg as Extract<ServerMessage, { type: "shot_result" }>;
            setLastShotResult({ row: sr.row, col: sr.col, result: sr.result });
            setTimeout(() => setLastShotResult(null), 2000);
            // game_state broadcast will follow
            break;
          }

          case "player_joined": {
            const pj = msg as Extract<ServerMessage, { type: "player_joined" }>;
            setGameState((prev) => {
              const exists = prev.players.find((p) => p.seat === pj.seat);
              if (exists) {
                return {
                  ...prev,
                  players: prev.players.map((p) =>
                    p.seat === pj.seat ? { ...p, name: pj.name } : p
                  ),
                };
              }
              return {
                ...prev,
                players: [
                  ...prev.players,
                  {
                    seat: pj.seat,
                    name: pj.name,
                    connected: true,
                    ready: false,
                    attacks: {},
                    sunkShips: [],
                    shipsRemaining: 5,
                  },
                ].sort((a, b) => a.seat - b.seat),
              };
            });
            break;
          }

          case "player_disconnected": {
            const pd = msg as Extract<ServerMessage, { type: "player_disconnected" }>;
            setGameState((prev) => ({
              ...prev,
              players: prev.players.map((p) =>
                p.seat === pd.seat ? { ...p, connected: false } : p
              ),
            }));
            break;
          }

          case "chat_broadcast": {
            const cb = msg as Extract<ServerMessage, { type: "chat_broadcast" }>;
            const senderName =
              gameState.players.find((p) => p.seat === cb.seat)?.name ?? "Player";
            setChatMessages((prev) => [
              ...prev,
              { seat: cb.seat, presetId: cb.presetId, playerName: senderName, timestamp: Date.now() },
            ]);
            break;
          }
        }
      },
      [gameState.players],
    ),
  });

  // Send join_game on mount
  const joinedRef = useRef(false);
  useEffect(() => {
    if (!joinedRef.current && mySeat >= 0) {
      joinedRef.current = true;
      setTimeout(() => {
        send({ type: "join_game", name: myName, seat: mySeat });
      }, 500);
    }
  }, [mySeat, myName, send]);

  const handleJoinAsGuest = () => {
    if (!guestName.trim() || joinFetcher.state !== "idle") return;
    joinFetcher.submit(
      { guestName: guestName.trim() },
      { method: "POST", encType: "application/json" },
    );
  };

  useEffect(() => {
    if (joinFetcher.state !== "idle" || !joinFetcher.data) return;
    const result = joinFetcher.data as { seat?: number; name?: string; error?: string };
    if (result.seat !== undefined && result.name) {
      setMySeat(result.seat);
      setMyName(result.name);
      setShowNameModal(false);
      setGameState((prev) => {
        if (prev.players.find((p) => p.seat === result.seat)) return prev;
        return {
          ...prev,
          players: [
            ...prev.players,
            {
              seat: result.seat!,
              name: result.name!,
              connected: true,
              ready: false,
              attacks: {},
              sunkShips: [],
              shipsRemaining: 5,
            },
          ].sort((a, b) => a.seat - b.seat),
        };
      });
    }
  }, [joinFetcher.state, joinFetcher.data]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGuessNumber = (n: number) => {
    if (myGuess !== null || gameState.status !== "guessing") return;
    setMyGuess(n);
    send({ type: "guess_number", number: n });
  };

  const handlePlaceShips = (ships: PlacedShip[]) => {
    setMyFleet(ships);
    send({ type: "place_ships", ships });
  };

  const handleFireShot = (row: number, col: number) => {
    send({ type: "fire_shot", row, col });
  };

  const { status, players, currentTurn, winner, guesses } = gameState;
  const sortedPlayers = [...players].sort((a, b) => a.seat - b.seat);
  const me = players.find((p) => p.seat === mySeat);
  const myReady = me?.ready ?? false;
  const opponent = players.find((p) => p.seat !== mySeat);
  const opponentReady = opponent?.ready ?? false;
  const winnerPlayer = winner !== null ? players.find((p) => p.seat === winner) : null;

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center p-2 gap-3">
      {/* Guest name modal */}
      {showNameModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-sm border border-gray-700">
            <h2 className="text-white font-bold text-xl mb-1">Join Game</h2>
            <p className="text-gray-400 text-sm mb-4">
              Enter a name to play as a guest, or{" "}
              <a href="/login" className="text-blue-400 hover:underline">sign in</a>{" "}
              for a profile.
            </p>
            {(joinFetcher.data as any)?.error && (
              <p className="text-red-400 text-sm mb-3">{(joinFetcher.data as any).error}</p>
            )}
            <input
              autoFocus
              type="text"
              placeholder="Your name"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleJoinAsGuest()}
              maxLength={20}
              disabled={joinFetcher.state !== "idle"}
              className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 mb-3 disabled:opacity-50"
            />
            <button
              onClick={handleJoinAsGuest}
              disabled={joinFetcher.state !== "idle" || !guestName.trim()}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg px-4 py-3"
            >
              {joinFetcher.state !== "idle" ? "Joining..." : "Join"}
            </button>
            <a href="/" className="block w-full text-center text-gray-400 hover:text-white text-sm mt-3 py-2">
              Cancel
            </a>
          </div>
        </div>
      )}

      {/* Game over modal */}
      {status === "finished" && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-sm border border-gray-700 text-center">
            <h2 className="text-white font-bold text-2xl mb-2">
              {winnerPlayer?.seat === mySeat ? "You Win!" : "You Lose!"}
            </h2>
            <p className="text-gray-400 text-lg mb-6">
              {winnerPlayer?.name ?? "Someone"} sunk all the ships!
            </p>
            <a
              href="/"
              className="block bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg px-4 py-3"
            >
              New Game
            </a>
          </div>
        </div>
      )}

      {/* Guess reveal overlay */}
      {guessReveal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-40 p-4">
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-sm border border-blue-700 text-center">
            <h3 className="text-white font-bold text-xl mb-2">Secret number: {guessReveal.guessTarget}</h3>
            <div className="space-y-1 mb-4">
              {sortedPlayers.map((p) => (
                <p key={p.seat} className="text-gray-300">
                  {p.name}: guessed {guessReveal.guesses[p.seat] ?? "?"}
                </p>
              ))}
            </div>
            <p className="text-blue-400 font-semibold">
              {players.find((p) => p.seat === guessReveal.firstSeat)?.name ?? "Player"} goes first!
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="w-full max-w-4xl flex items-center justify-between">
        <a href="/" className="text-gray-400 hover:text-white text-sm">← Home</a>
        <h1 className="text-white font-bold">Battleship</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={handleCopyLink}
            className="text-blue-400 hover:text-blue-300 text-sm"
          >
            {copied ? "Copied!" : "Share link"}
          </button>
          {mySeat >= 0 && (
            <Chat
              messages={chatMessages}
              yourSeat={mySeat}
              onSend={(presetId) => send({ type: "chat", presetId })}
              isOpen={chatOpen}
              onToggle={() => setChatOpen((v) => !v)}
            />
          )}
        </div>
      </div>

      {/* Player list (always shown) */}
      <div className="w-full max-w-4xl flex gap-2">
        {sortedPlayers.map((p) => (
          <div
            key={p.seat}
            className={`flex-1 rounded-lg px-3 py-2 text-sm border ${
              p.seat === currentTurn && status === "active"
                ? "bg-blue-900/40 border-blue-700 text-blue-300"
                : "bg-gray-900 border-gray-700 text-gray-300"
            }`}
          >
            <span className="font-medium">{p.name}</span>
            {p.seat === mySeat && <span className="text-gray-500 text-xs ml-1">(you)</span>}
            {!p.connected && <span className="text-gray-600 text-xs ml-1">⚫</span>}
            {status === "placing" && (
              <span className={`text-xs ml-2 ${p.ready ? "text-green-400" : "text-gray-500"}`}>
                {p.ready ? "Ready" : "Placing..."}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Waiting phase */}
      {status === "waiting" && (
        <div className="bg-gray-900 rounded-xl border border-gray-700 p-4 w-full max-w-4xl text-center">
          <p className="text-white font-medium mb-2">
            Waiting for players ({sortedPlayers.length}/{maxPlayers})
          </p>
          <button
            onClick={handleCopyLink}
            className="bg-blue-700 hover:bg-blue-600 text-white rounded-lg px-4 py-2 text-sm"
          >
            {copied ? "Copied!" : "Copy invite link"}
          </button>
          <p className="text-gray-500 text-xs mt-2">{shareUrl}</p>
        </div>
      )}

      {/* Guessing phase */}
      {status === "guessing" && (
        <div className="bg-gray-900 rounded-xl border border-gray-700 p-5 w-full max-w-4xl text-center">
          <p className="text-white font-bold text-lg mb-1">Guess a number 1–10</p>
          <p className="text-gray-400 text-sm mb-4">Closest to the secret number goes first!</p>
          {mySeat >= 0 && myGuess === null ? (
            <div className="flex flex-wrap justify-center gap-2 mb-4">
              {[1,2,3,4,5,6,7,8,9,10].map((n) => (
                <button
                  key={n}
                  onClick={() => handleGuessNumber(n)}
                  className="w-10 h-10 rounded-lg bg-gray-700 hover:bg-blue-600 text-white font-bold text-sm transition-colors"
                >
                  {n}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-blue-400 font-medium mb-4">
              {mySeat >= 0 ? `You guessed ${myGuess}` : "Spectating"}
            </p>
          )}
          <div className="space-y-1">
            {sortedPlayers.map((p) => (
              <p key={p.seat} className="text-gray-400 text-sm">
                {p.name}: {guesses[p.seat] !== undefined && guesses[p.seat] !== null ? "guessed ✓" : "waiting..."}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Placement phase */}
      {status === "placing" && mySeat >= 0 && (
        <PlacementPhase
          onConfirm={handlePlaceShips}
          myReady={myReady}
          opponentReady={opponentReady}
        />
      )}

      {/* Active phase */}
      {status === "active" && mySeat >= 0 && (
        <ActivePhase
          mySeat={mySeat}
          myFleet={myFleet}
          players={players}
          currentTurn={currentTurn}
          onFire={handleFireShot}
        />
      )}

      {/* Shot result toast */}
      {lastShotResult && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-3 rounded-xl text-white font-bold text-lg z-30 shadow-lg ${
          lastShotResult.result === "hit" ? "bg-red-700" : "bg-gray-700"
        }`}>
          {lastShotResult.result === "hit" ? "HIT!" : "Miss"}
        </div>
      )}
    </div>
  );
}
