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
    Array<{ seat: number; text: string; playerName: string; timestamp: number }>
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
              { seat: cb.seat, text: cb.text, playerName: senderName, timestamp: Date.now() },
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

  // Shared modal overlay style
  const modalOverlay: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "rgba(4,10,20,0.82)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 50,
    padding: "16px",
  };

  // Shared modal box style (uses scroll/plaque aesthetic)
  const modalBox: React.CSSProperties = {
    background: "linear-gradient(180deg, var(--bone) 0%, #e2d4b0 100%)",
    borderRadius: "10px",
    padding: "28px",
    width: "100%",
    maxWidth: "360px",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.7), inset 0 0 0 1px rgba(26,22,18,0.22), 0 8px 32px rgba(0,0,0,0.7)",
    position: "relative",
    color: "var(--ink)",
  };

  return (
    <div
      className="min-h-screen game-surface flex flex-col items-center p-2"
      style={{ gap: "12px" }}
    >
      {/* Guest name modal */}
      {showNameModal && (
        <div style={modalOverlay}>
          <div style={modalBox}>
            {/* Rivets */}
            <div style={{ position: "absolute", top: "10px", left: "10px" }} className="rivet" />
            <div style={{ position: "absolute", top: "10px", right: "10px" }} className="rivet" />

            <h2 style={{
              fontFamily: "var(--serif)",
              fontVariant: "small-caps",
              fontWeight: 600,
              fontSize: "20px",
              letterSpacing: "0.2em",
              color: "var(--ink)",
              marginBottom: "6px",
              marginTop: 0,
            }}>Join Game</h2>
            <p style={{
              fontFamily: "var(--sans)",
              fontSize: "12px",
              color: "var(--ink-soft)",
              marginBottom: "20px",
            }}>
              Enter a name to play as a guest, or{" "}
              <a href="/login" style={{ color: "var(--ink)", fontWeight: 600, textDecoration: "underline" }}>sign in</a>{" "}
              for a profile.
            </p>
            {(joinFetcher.data as any)?.error && (
              <p style={{ fontFamily: "var(--sans)", fontSize: "12px", color: "var(--copper)", marginBottom: "10px", textAlign: "center" }}>
                {(joinFetcher.data as any).error}
              </p>
            )}
            <div style={{ marginBottom: "16px" }}>
              <label className="td-input-label" style={{ color: "var(--ink-soft)" }}>Your Name</label>
              <input
                autoFocus
                type="text"
                placeholder="Captain..."
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleJoinAsGuest()}
                maxLength={20}
                disabled={joinFetcher.state !== "idle"}
                className="td-input"
                style={{ color: "var(--ink)", borderBottomColor: "rgba(26,22,18,0.3)" }}
              />
            </div>
            <button
              onClick={handleJoinAsGuest}
              disabled={joinFetcher.state !== "idle" || !guestName.trim()}
              className="btn-primary"
              style={{ width: "100%" }}
            >
              {joinFetcher.state !== "idle" ? "Joining..." : "Board Ship"}
            </button>
            <a
              href="/"
              style={{
                display: "block",
                textAlign: "center",
                fontFamily: "var(--serif)",
                fontVariant: "small-caps",
                fontSize: "11px",
                color: "var(--ink-faint)",
                marginTop: "14px",
                textDecoration: "none",
                letterSpacing: "0.16em",
              }}
            >
              Cancel
            </a>
          </div>
        </div>
      )}

      {/* Game over modal */}
      {status === "finished" && (
        <div style={modalOverlay}>
          <div style={{ ...modalBox, textAlign: "center" }}>
            <div style={{ position: "absolute", top: "10px", left: "10px" }} className="rivet" />
            <div style={{ position: "absolute", top: "10px", right: "10px" }} className="rivet" />

            <h2 style={{
              fontFamily: "var(--serif)",
              fontVariant: "small-caps",
              fontWeight: 700,
              fontSize: "26px",
              letterSpacing: "0.16em",
              color: winnerPlayer?.seat === mySeat ? "var(--ink)" : "var(--copper)",
              marginTop: 0,
              marginBottom: "8px",
            }}>
              {winnerPlayer?.seat === mySeat ? "Victory!" : "Defeated"}
            </h2>
            <p style={{
              fontFamily: "var(--serif)",
              fontStyle: "italic",
              fontSize: "14px",
              color: "var(--ink-soft)",
              marginBottom: "24px",
            }}>
              {winnerPlayer?.name ?? "Someone"} sunk all the ships.
            </p>
            <a href="/" className="btn-primary" style={{ display: "inline-flex" }}>
              New Engagement
            </a>
          </div>
        </div>
      )}

      {/* Guess reveal overlay */}
      {guessReveal && (
        <div style={{ ...modalOverlay, zIndex: 40 }}>
          <div style={{ ...modalBox, textAlign: "center" }}>
            <h3 style={{
              fontFamily: "var(--serif)",
              fontVariant: "small-caps",
              fontSize: "16px",
              letterSpacing: "0.2em",
              color: "var(--ink)",
              marginTop: 0,
              marginBottom: "6px",
            }}>Secret Number: {guessReveal.guessTarget}</h3>
            <div style={{ marginBottom: "16px" }}>
              {sortedPlayers.map((p) => (
                <p key={p.seat} style={{ fontFamily: "var(--sans)", fontSize: "13px", color: "var(--ink-soft)", margin: "4px 0" }}>
                  {p.name}: guessed {guessReveal.guesses[p.seat] ?? "?"}
                </p>
              ))}
            </div>
            <p style={{ fontFamily: "var(--serif)", fontWeight: 600, fontSize: "14px", color: "var(--walnut)" }}>
              {players.find((p) => p.seat === guessReveal.firstSeat)?.name ?? "Player"} opens fire first.
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="w-full max-w-4xl" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0" }}>
        <a
          href="/"
          style={{
            fontFamily: "var(--serif)",
            fontVariant: "small-caps",
            fontSize: "11px",
            letterSpacing: "0.22em",
            color: "rgba(246,239,224,0.4)",
            textDecoration: "none",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--gold)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(246,239,224,0.4)")}
        >
          Home
        </a>
        <h1 style={{
          fontFamily: "var(--serif)",
          fontVariant: "small-caps",
          fontWeight: 600,
          fontSize: "20px",
          letterSpacing: "0.3em",
          color: "var(--gold-hi)",
          margin: 0,
          textShadow: "0 1px 0 rgba(0,0,0,0.4)",
        }}>Battleship</h1>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button
            onClick={handleCopyLink}
            className="btn-ghost"
            style={{ padding: "4px 10px" }}
          >
            {copied ? "Copied!" : "Share Link"}
          </button>
          {mySeat >= 0 && (
            <Chat
              messages={chatMessages}
              yourSeat={mySeat}
              onSend={(text) => send({ type: "chat", text })}
              isOpen={chatOpen}
              onToggle={() => setChatOpen((v) => !v)}
            />
          )}
        </div>
      </div>

      {/* Player list */}
      <div className="w-full max-w-4xl" style={{ display: "flex", gap: "8px" }}>
        {sortedPlayers.map((p) => {
          const isActive = p.seat === currentTurn && status === "active";
          return (
            <div
              key={p.seat}
              style={{
                flex: 1,
                borderRadius: "6px",
                padding: "8px 12px",
                border: isActive
                  ? "1px solid rgba(201,162,74,0.45)"
                  : "1px solid rgba(100,160,255,0.12)",
                background: isActive
                  ? "linear-gradient(90deg, rgba(201,162,74,0.12), transparent 80%)"
                  : "rgba(15,29,51,0.6)",
                boxShadow: isActive ? "inset 2px 0 0 var(--gold)" : "none",
              }}
            >
              <span style={{
                fontFamily: "var(--serif)",
                fontWeight: 600,
                fontSize: "14px",
                color: isActive ? "var(--gold-hi)" : "var(--bone)",
                opacity: isActive ? 1 : 0.7,
              }}>{p.name}</span>
              {p.seat === mySeat && (
                <span style={{
                  fontFamily: "var(--mono)",
                  fontSize: "9px",
                  color: "rgba(246,239,224,0.3)",
                  marginLeft: "6px",
                  letterSpacing: "0.1em",
                }}>(you)</span>
              )}
              {!p.connected && (
                <span style={{
                  display: "inline-block",
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  background: "rgba(120,120,120,0.5)",
                  marginLeft: "6px",
                  verticalAlign: "middle",
                }} />
              )}
              {status === "placing" && (
                <span style={{
                  fontFamily: "var(--mono)",
                  fontSize: "10px",
                  marginLeft: "8px",
                  color: p.ready ? "var(--gold)" : "rgba(246,239,224,0.3)",
                  letterSpacing: "0.06em",
                }}>
                  {p.ready ? "Ready" : "Placing..."}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Waiting phase */}
      {status === "waiting" && (
        <div style={{
          background: "linear-gradient(180deg, rgba(15,29,51,0.95) 0%, rgba(8,21,37,0.98) 100%)",
          border: "1px solid rgba(100,160,255,0.15)",
          borderRadius: "10px",
          padding: "20px 24px",
          width: "100%",
          maxWidth: "896px",
          textAlign: "center",
          boxShadow: "inset 0 1px 0 rgba(100,160,255,0.08), 0 8px 24px rgba(0,0,0,0.5)",
          position: "relative",
        }}>
          <div style={{ position: "absolute", top: "10px", left: "10px" }} className="rivet" />
          <div style={{ position: "absolute", top: "10px", right: "10px" }} className="rivet" />
          <p style={{
            fontFamily: "var(--serif)",
            fontVariant: "small-caps",
            fontSize: "14px",
            letterSpacing: "0.22em",
            color: "var(--gold-hi)",
            opacity: 0.8,
            marginBottom: "14px",
          }}>
            Awaiting Fleet · {sortedPlayers.length}/{maxPlayers}
          </p>
          <button onClick={handleCopyLink} className="btn-primary">
            {copied ? "Link Copied!" : "Copy Invite Link"}
          </button>
          <p style={{
            fontFamily: "var(--mono)",
            fontSize: "10px",
            color: "rgba(246,239,224,0.25)",
            marginTop: "10px",
          }}>{shareUrl}</p>
        </div>
      )}

      {/* Guessing phase */}
      {status === "guessing" && (
        <div style={{
          background: "linear-gradient(180deg, rgba(15,29,51,0.95) 0%, rgba(8,21,37,0.98) 100%)",
          border: "1px solid rgba(100,160,255,0.15)",
          borderRadius: "10px",
          padding: "24px",
          width: "100%",
          maxWidth: "896px",
          textAlign: "center",
          position: "relative",
        }}>
          <div style={{ position: "absolute", top: "10px", left: "10px" }} className="rivet" />
          <div style={{ position: "absolute", top: "10px", right: "10px" }} className="rivet" />
          <p style={{
            fontFamily: "var(--serif)",
            fontVariant: "small-caps",
            fontWeight: 600,
            fontSize: "16px",
            letterSpacing: "0.22em",
            color: "var(--gold-hi)",
            marginBottom: "4px",
          }}>Guess a Number 1–10</p>
          <p style={{
            fontFamily: "var(--serif)",
            fontStyle: "italic",
            fontSize: "12px",
            color: "rgba(246,239,224,0.45)",
            marginBottom: "18px",
          }}>Closest to the secret number opens fire first.</p>

          {mySeat >= 0 && myGuess === null ? (
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "8px", marginBottom: "16px" }}>
              {[1,2,3,4,5,6,7,8,9,10].map((n) => (
                <button
                  key={n}
                  onClick={() => handleGuessNumber(n)}
                  style={{
                    width: "42px",
                    height: "42px",
                    borderRadius: "6px",
                    background: "linear-gradient(180deg, var(--bone) 0%, #e2d4b0 100%)",
                    border: "1px solid rgba(26,22,18,0.3)",
                    color: "var(--ink)",
                    fontFamily: "var(--mono)",
                    fontWeight: 700,
                    fontSize: "15px",
                    cursor: "pointer",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.7), 0 2px 4px rgba(0,0,0,0.3)",
                    transition: "transform 0.1s ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-2px)")}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = "none")}
                >
                  {n}
                </button>
              ))}
            </div>
          ) : (
            <p style={{
              fontFamily: "var(--serif)",
              fontVariant: "small-caps",
              fontSize: "13px",
              color: "var(--gold)",
              letterSpacing: "0.18em",
              marginBottom: "16px",
            }}>
              {mySeat >= 0 ? `You guessed ${myGuess}` : "Spectating"}
            </p>
          )}
          <div>
            {sortedPlayers.map((p) => (
              <p key={p.seat} style={{ fontFamily: "var(--sans)", fontSize: "12px", color: "rgba(246,239,224,0.45)", margin: "4px 0" }}>
                {p.name}: {guesses[p.seat] !== undefined && guesses[p.seat] !== null ? "ready" : "waiting..."}
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
        <div style={{
          position: "fixed",
          bottom: "24px",
          left: "50%",
          transform: "translateX(-50%)",
          padding: "10px 24px",
          borderRadius: "999px",
          fontFamily: "var(--serif)",
          fontVariant: "small-caps",
          fontWeight: 700,
          fontSize: "16px",
          letterSpacing: "0.22em",
          zIndex: 30,
          boxShadow: "0 4px 14px rgba(0,0,0,0.6)",
          background: lastShotResult.result === "hit"
            ? "radial-gradient(circle at 35% 35%, #e15a44 0%, #c8372a 55%, #8b1f17 100%)"
            : "linear-gradient(180deg, var(--bone) 0%, #c4b587 100%)",
          color: lastShotResult.result === "hit" ? "var(--bone)" : "var(--ink)",
          border: lastShotResult.result === "hit"
            ? "1px solid rgba(200,55,42,0.5)"
            : "1px solid rgba(26,22,18,0.25)",
        }}>
          {lastShotResult.result === "hit" ? "Hit!" : "Miss"}
        </div>
      )}
    </div>
  );
}
