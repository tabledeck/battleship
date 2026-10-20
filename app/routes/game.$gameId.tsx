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
import { useSounds } from "~/hooks/useSounds";
import type { EndReason } from "~/domain/types";

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
  let initialState: Record<string, unknown> = { status: "waiting", players: [], guesses: [null, null], currentTurn: 0, moveCount: 0, winner: null, endReason: null, forfeitedBy: null };
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
          endReason: rawState.endReason ?? null,
          forfeitedBy: rawState.forfeitedBy ?? null,
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
  endReason: EndReason;
  forfeitedBy: number | null;
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
    endReason: r.endReason ?? null,
    forfeitedBy: r.forfeitedBy ?? null,
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
  const [myGuess, setMyGuess] = useState<number | null>(() => {
    const guesses = (initialState as { guesses?: (number | null)[] }).guesses;
    if (initialSeat < 0 || !guesses) return null;
    return guesses[initialSeat] ?? null;
  });
  const [guessReveal, setGuessReveal] = useState<{ guesses: (number | null)[]; guessTarget: number; firstSeat: number } | null>(null);

  // UI state
  const [copied, setCopied] = useState(false);
  const [creatingRematch, setCreatingRematch] = useState(false);
  const [rematchError, setRematchError] = useState("");
  const [chatMessages, setChatMessages] = useState<
    Array<{ seat: number; text: string; playerName: string; timestamp: number }>
  >([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [lastShotResult, setLastShotResult] = useState<{ row: number; col: number; result: "hit" | "miss"; sunk?: string } | null>(null);
  const [notice, setNotice] = useState("");
  const [forfeitOpen, setForfeitOpen] = useState(false);
  const [hideResult, setHideResult] = useState(false);
  const [rematchOffer, setRematchOffer] = useState<string | null>(null);
  const [liveShareUrl, setLiveShareUrl] = useState(shareUrl);
  const { play, muted, toggleMute } = useSounds();

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

  useEffect(() => {
    setLiveShareUrl(`${window.location.origin}/game/${gameId}`);
  }, [gameId]);

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
            if (mySeat >= 0 && s.guesses[mySeat] != null) setMyGuess(s.guesses[mySeat]);
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
            setLastShotResult({ row: sr.row, col: sr.col, result: sr.result, sunk: sr.sunk });
            play(sr.result === "hit" ? "score" : "miss");
            if (sr.gameOver) play("gameOver");
            setTimeout(() => setLastShotResult(null), 2200);
            break;
          }

          case "game_over": {
            const go = msg as Extract<ServerMessage, { type: "game_over" }>;
            setGameState((prev) => ({
              ...prev,
              status: "finished",
              winner: go.winner,
              endReason: go.reason,
              forfeitedBy: go.forfeitedBy,
            }));
            setForfeitOpen(false);
            play("gameOver");
            break;
          }

          case "rematch_offered": {
            const offer = msg as Extract<ServerMessage, { type: "rematch_offered" }>;
            if (offer.fromSeat !== mySeat) setRematchOffer(offer.gameId);
            break;
          }

          case "error": {
            setNotice(msg.message);
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
      [gameState.players, mySeat, play],
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

  const handleCopyLink = async () => {
    const url = liveShareUrl;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "Battleship", text: "Join my Battleship game on Tabledeck", url });
        return;
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setNotice("Couldn't copy automatically. Select the link and copy it.");
    }
  };

  const handleRematch = async () => {
    if (creatingRematch) return;
    setCreatingRematch(true);
    setRematchError("");

    try {
      const response = await fetch("/api/game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rematchOf: gameId }),
      });
      const body = (await response.json()) as { gameId?: string; error?: string };

      if (!response.ok || !body.gameId) {
        setRematchError(body.error ?? "Failed to create rematch.");
        setCreatingRematch(false);
        return;
      }

      send({ type: "rematch_invite", gameId: body.gameId });
      window.setTimeout(() => {
        window.location.href = `/game/${body.gameId}`;
      }, 250);
    } catch {
      setRematchError("Network error. Please try again.");
      setCreatingRematch(false);
    }
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

  const handleForfeit = () => {
    send({ type: "forfeit" });
    setForfeitOpen(false);
  };

  const { status, players, currentTurn, winner, guesses, endReason, forfeitedBy } = gameState;
  const sortedPlayers = [...players].sort((a, b) => a.seat - b.seat);
  const me = players.find((p) => p.seat === mySeat);
  const myReady = me?.ready ?? false;
  const opponent = players.find((p) => p.seat !== mySeat);
  const opponentReady = opponent?.ready ?? false;
  const winnerPlayer = winner !== null ? players.find((p) => p.seat === winner) : null;
  const canForfeit = mySeat >= 0 && (status === "guessing" || status === "placing" || status === "active");

  const requestLeave = () => {
    if (canForfeit) setForfeitOpen(true);
    else window.location.href = "/";
  };

  const lastChime = useRef("");
  useEffect(() => {
    const key = `${status}:${currentTurn}:${mySeat}`;
    if (lastChime.current === key) return;
    const prev = lastChime.current;
    lastChime.current = key;
    if (!prev) return;
    if (status === "active" && currentTurn === mySeat) play("yourTurn");
  }, [status, currentTurn, mySeat, play]);

  const phaseOrder = ["waiting", "guessing", "placing", "active"] as const;
  const phaseIndex = status === "finished" ? 3 : Math.max(0, phaseOrder.indexOf(status as typeof phaseOrder[number]));

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
    maxHeight: "calc(100dvh - 32px)",
    overflowY: "auto",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.7), inset 0 0 0 1px rgba(26,22,18,0.22), 0 8px 32px rgba(0,0,0,0.7)",
    position: "relative",
    color: "var(--ink)",
  };

  return (
    <div
      className="min-h-screen game-surface flex flex-col items-center px-3 py-2"
      style={{ gap: "12px", paddingTop: "calc(8px + env(safe-area-inset-top))" }}
      data-phase={status}
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
            }}>{dbPlayers.length === 0 ? "Name your command" : "Join this engagement"}</h2>
            <p style={{
              fontFamily: "var(--sans)",
              fontSize: "14px",
              lineHeight: 1.45,
              color: "var(--ink-soft)",
              marginBottom: "20px",
            }}>
              {dbPlayers.length === 0
                ? "Pick a name, then share the link. The game starts as soon as your opponent joins."
                : "Pick a name to take the open seat. You'll guess a number, place ships, then fire."}{" "}
              Or{" "}
              <a href="/login" style={{ color: "var(--ink)", fontWeight: 600, textDecoration: "underline" }}>sign in</a>.
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
              {joinFetcher.state !== "idle" ? "Joining..." : "Take command"}
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
      {status === "finished" && !hideResult && (
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
              {winnerPlayer?.seat === mySeat ? "Victory" : "Defeat"}
            </h2>
            <p style={{
              fontFamily: "var(--serif)",
              fontStyle: "italic",
              fontSize: "15px",
              color: "var(--ink-soft)",
              marginBottom: "24px",
            }}>
              {endReason === "forfeit"
                ? forfeitedBy === mySeat
                  ? "You forfeited. Your opponent takes the win."
                  : `${players.find((p) => p.seat === forfeitedBy)?.name ?? "Your opponent"} forfeited.`
                : `${winnerPlayer?.name ?? "Someone"} sunk the fleet.`}
            </p>
            {rematchError && (
              <p style={{ fontFamily: "var(--sans)", fontSize: "12px", color: "var(--copper)", marginBottom: "12px" }}>
                {rematchError}
              </p>
            )}
            <div style={{ display: "flex", justifyContent: "center", gap: "10px", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={handleRematch}
                disabled={creatingRematch}
                className="btn-primary"
              >
                {creatingRematch ? "Launching..." : "Rematch"}
              </button>
              <button type="button" className="btn-secondary" onClick={() => setHideResult(true)}>
                See the boards
              </button>
              <a href="/" className="btn-secondary" style={{ display: "inline-flex", alignItems: "center", color: "var(--ink)" }}>
                Leave
              </a>
            </div>
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

      {forfeitOpen && (
        <div style={modalOverlay}>
          <div style={modalBox}>
            <h2 style={{
              fontFamily: "var(--serif)",
              fontVariant: "small-caps",
              letterSpacing: "0.14em",
              fontSize: "22px",
              marginTop: 0,
            }}>Forfeit this engagement?</h2>
            <p style={{ fontFamily: "var(--sans)", fontSize: "14px", lineHeight: 1.45, color: "var(--ink-soft)" }}>
              Your opponent wins immediately. This is recorded as a finished game.
            </p>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "8px" }}>
              <button type="button" className="btn-primary" onClick={() => setForfeitOpen(false)}>Keep playing</button>
              <button type="button" className="btn-secondary" onClick={handleForfeit} data-testid="confirm-forfeit">Forfeit</button>
            </div>
          </div>
        </div>
      )}

      <header className="bs-topbar bs-shell">
        <div className="bs-topbar-brand">
          <button type="button" className="btn-ghost" onClick={requestLeave}>Home</button>
          <h1>Battleship</h1>
        </div>
        <div className="bs-topbar-actions">
          <button type="button" className="btn-ghost" onClick={handleCopyLink}>
            {copied ? "Copied" : "Share"}
          </button>
          {canForfeit && (
            <button type="button" className="btn-ghost" onClick={() => setForfeitOpen(true)} data-testid="forfeit">
              Forfeit
            </button>
          )}
          <button type="button" className="btn-ghost" onClick={toggleMute} aria-pressed={muted} aria-label={muted ? "Unmute sounds" : "Mute sounds"}>
            {muted ? "Muted" : "Mute"}
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
      </header>

      <div className="bs-phase bs-shell" aria-label="Game progress">
        {["Join", "Guess", "Deploy", "Battle"].map((label, i) => (
          <span key={label} className={i === phaseIndex ? "is-now" : i < phaseIndex ? "is-done" : ""}>
            {label}
          </span>
        ))}
      </div>

      {notice && (
        <p role="alert" className="bs-shell" style={{ color: "#ffb4a8", fontFamily: "var(--sans)", fontSize: "14px", textAlign: "center", margin: 0 }}>
          {notice}
        </p>
      )}

      {rematchOffer && (
        <div className="bs-offer bs-shell">
          <span>Your opponent started a rematch.</span>
          <a className="btn-primary" href={`/game/${rematchOffer}`}>Join rematch</a>
        </div>
      )}

      {status === "finished" && hideResult && (
        <div className="bs-shell" style={{ textAlign: "center" }}>
          <button type="button" className="btn-ghost" onClick={() => setHideResult(false)}>Show result</button>
        </div>
      )}

      <div className="bs-players bs-shell">
        {sortedPlayers.map((p) => {
          const isTurn = p.seat === currentTurn && status === "active";
          let meta = p.seat === mySeat ? "You" : "Opponent";
          if (!p.connected) meta += " · offline";
          else if (status === "placing") meta += p.ready ? " · fleet ready" : " · placing ships";
          else if (status === "guessing") meta += guesses[p.seat] != null ? " · number locked" : " · choosing a number";
          else if (isTurn) meta += " · firing";
          else if (status === "active") meta += " · waiting";
          else if (status === "finished" && winner === p.seat) meta += " · winner";
          return (
            <div key={p.seat} className={`bs-player-card ${isTurn ? "is-turn" : ""}`}>
              <span className="bs-player-name">{p.name}</span>
              <div className="bs-player-meta">{meta}</div>
            </div>
          );
        })}
        {sortedPlayers.length < maxPlayers && status === "waiting" && (
          <div className="bs-player-card">
            <span className="bs-player-name">Open seat</span>
            <div className="bs-player-meta">Waiting for opponent</div>
          </div>
        )}
      </div>

      {status === "waiting" && !showNameModal && (
        <div className="bs-panel bs-shell">
          <div style={{ position: "absolute", top: "10px", left: "10px" }} className="rivet" />
          <div style={{ position: "absolute", top: "10px", right: "10px" }} className="rivet" />
          <h2 className="bs-panel-title">Waiting for your opponent</h2>
          <p className="bs-help">
            {sortedPlayers.length}/{maxPlayers} seated. Send this link. The moment they join, you both pick a number, place ships, then take turns firing.
          </p>
          <div className="bs-share-row">
            <input readOnly value={liveShareUrl} aria-label="Invite link" onFocus={(e) => e.currentTarget.select()} />
            <button type="button" onClick={handleCopyLink} className="btn-primary">
              {copied ? "Copied" : "Share link"}
            </button>
          </div>
        </div>
      )}

      {status === "guessing" && (
        <div className="bs-panel bs-shell">
          <div style={{ position: "absolute", top: "10px", left: "10px" }} className="rivet" />
          <div style={{ position: "absolute", top: "10px", right: "10px" }} className="rivet" />
          <h2 className="bs-panel-title">Who fires first?</h2>
          <p className="bs-help">
            Pick a number from 1 to 10. Closest to the secret number shoots first. After that, you each place a fleet.
          </p>
          {mySeat >= 0 && myGuess === null ? (
            <div className="bs-guess-grid">
              {[1,2,3,4,5,6,7,8,9,10].map((n) => (
                <button key={n} type="button" onClick={() => handleGuessNumber(n)}>{n}</button>
              ))}
            </div>
          ) : (
            <p className="bs-status-line" style={{ marginBottom: 12 }}>
              {mySeat >= 0 ? `Locked in: ${myGuess}. Waiting for the other number.` : "Spectating"}
            </p>
          )}
          <div>
            {sortedPlayers.map((p) => (
              <p key={p.seat} className="bs-status-line">
                {p.name}: {guesses[p.seat] != null ? "number locked" : "still choosing"}
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

      {(status === "active" || (status === "finished" && hideResult)) && mySeat >= 0 && (
        <ActivePhase
          mySeat={mySeat}
          myFleet={myFleet}
          players={players}
          currentTurn={currentTurn}
          onFire={handleFireShot}
          over={status === "finished"}
        />
      )}

      {lastShotResult && (
        <div
          className="bs-toast"
          role="status"
          style={{
            background: lastShotResult.result === "hit"
              ? "radial-gradient(circle at 35% 35%, #e15a44 0%, #c8372a 55%, #8b1f17 100%)"
              : "linear-gradient(180deg, var(--bone) 0%, #c4b587 100%)",
            color: lastShotResult.result === "hit" ? "var(--bone)" : "var(--ink)",
          }}
        >
          {lastShotResult.sunk
            ? `Sunk the ${lastShotResult.sunk}`
            : lastShotResult.result === "hit" ? "Hit" : "Miss"}
        </div>
      )}
    </div>
  );
}
