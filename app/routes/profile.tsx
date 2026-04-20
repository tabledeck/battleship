import { redirect } from "react-router";
import type { Route } from "./+types/profile";
import { getPrisma } from "~/db.server";
import { getOptionalUserFromContext } from "~/domain/utils/global-context.server";

export function meta() {
  return [{ title: "Profile — Battleship" }];
}

export async function loader({ context }: Route.LoaderArgs) {
  const user = getOptionalUserFromContext(context);
  if (!user) throw redirect("/login");

  const db = getPrisma(context);
  const gamePlayers = await db.gamePlayer.findMany({
    where: { userId: user.id },
    include: {
      game: {
        select: {
          id: true,
          status: true,
          maxPlayers: true,
          createdAt: true,
          finishedAt: true,
          players: {
            select: { seat: true, score: true, user: { select: { name: true, email: true } }, guestName: true },
          },
        },
      },
    },
    orderBy: { game: { createdAt: "desc" } },
    take: 20,
  });

  return {
    user: { name: user.name, email: user.email },
    games: gamePlayers.map((gp) => ({
      gameId: gp.game.id,
      status: gp.game.status,
      myScore: gp.score,
      seat: gp.seat,
      createdAt: gp.game.createdAt.toISOString(),
      finishedAt: gp.game.finishedAt?.toISOString() ?? null,
      players: gp.game.players.map((p) => ({
        seat: p.seat,
        score: p.score,
        name: p.user?.name || p.user?.email || p.guestName || "Guest",
      })),
    })),
  };
}

export default function Profile({ loaderData }: Route.ComponentProps) {
  const { user, games } = loaderData;

  const wins = games.filter((g) => {
    if (g.status !== "finished") return false;
    const maxScore = Math.max(...g.players.map((p) => p.score));
    return g.myScore === maxScore;
  }).length;

  const finished = games.filter((g) => g.status === "finished").length;

  const statusLabel = (s: string) => {
    if (s === "finished") return { label: "Finished", color: "rgba(246,239,224,0.35)" };
    if (s === "active")   return { label: "Active", color: "var(--gold)" };
    return { label: s, color: "rgba(246,239,224,0.25)" };
  };

  return (
    <div
      className="min-h-screen game-surface"
      style={{ padding: "24px 16px", maxWidth: "640px", margin: "0 auto" }}
    >
      {/* Nav */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "24px" }}>
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
        <a
          href="/logout"
          style={{
            fontFamily: "var(--serif)",
            fontVariant: "small-caps",
            fontSize: "11px",
            letterSpacing: "0.18em",
            color: "rgba(246,239,224,0.3)",
            textDecoration: "none",
          }}
        >
          Logout
        </a>
      </div>

      {/* Profile plaque */}
      <div className="td-plaque" style={{
        flexDirection: "column",
        alignItems: "flex-start",
        width: "100%",
        marginBottom: "24px",
        position: "relative",
      }}>
        <div style={{ position: "absolute", top: "10px", left: "10px" }} className="rivet" />
        <div style={{ position: "absolute", top: "10px", right: "10px" }} className="rivet" />

        <h1 style={{
          fontFamily: "var(--serif)",
          fontWeight: 600,
          fontSize: "24px",
          color: "var(--ink)",
          margin: 0,
          marginBottom: "2px",
        }}>{user.name || user.email}</h1>
        <p style={{
          fontFamily: "var(--sans)",
          fontSize: "12px",
          color: "var(--ink-faint)",
        }}>{user.email}</p>

        {/* Stats */}
        <div style={{ display: "flex", gap: "28px", marginTop: "16px" }}>
          {[
            { val: finished, label: "Engagements" },
            { val: wins, label: "Victories" },
            { val: finished > 0 ? `${Math.round((wins / finished) * 100)}%` : "—", label: "Win Rate" },
          ].map(({ val, label }) => (
            <div key={label} style={{ textAlign: "center" }}>
              <p style={{
                fontFamily: "var(--mono)",
                fontWeight: 700,
                fontSize: "22px",
                color: "var(--ink)",
                margin: 0,
                fontVariantNumeric: "tabular-nums",
              }}>{val}</p>
              <p style={{
                fontFamily: "var(--serif)",
                fontVariant: "small-caps",
                fontSize: "9.5px",
                letterSpacing: "0.2em",
                color: "var(--ink-faint)",
                marginTop: "2px",
              }}>{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Recent games */}
      <p style={{
        fontFamily: "var(--serif)",
        fontVariant: "small-caps",
        letterSpacing: "0.28em",
        fontSize: "10.5px",
        color: "rgba(201,162,74,0.5)",
        marginBottom: "12px",
      }}>Fleet Log</p>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {games.length === 0 && (
          <p style={{
            fontFamily: "var(--serif)",
            fontStyle: "italic",
            fontSize: "13px",
            color: "rgba(246,239,224,0.3)",
          }}>No engagements on record. Deploy a fleet!</p>
        )}
        {games.map((g) => {
          const { label, color } = statusLabel(g.status);
          return (
            <a
              key={g.gameId}
              href={`/game/${g.gameId}`}
              style={{
                display: "block",
                background: "rgba(15,29,51,0.7)",
                border: "1px solid rgba(100,160,255,0.12)",
                borderRadius: "6px",
                padding: "12px 16px",
                textDecoration: "none",
                transition: "border-color 0.15s ease",
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.borderColor = "rgba(201,162,74,0.3)")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.borderColor = "rgba(100,160,255,0.12)")}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                <span style={{
                  fontFamily: "var(--mono)",
                  fontSize: "11px",
                  color: "rgba(246,239,224,0.35)",
                  letterSpacing: "0.06em",
                }}>#{g.gameId.slice(0, 8)}</span>
                <span style={{
                  fontFamily: "var(--serif)",
                  fontVariant: "small-caps",
                  fontSize: "9.5px",
                  letterSpacing: "0.18em",
                  color,
                }}>{label}</span>
              </div>
              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                {g.players
                  .sort((a, b) => b.score - a.score)
                  .map((p) => (
                    <span
                      key={p.seat}
                      style={{
                        fontFamily: "var(--serif)",
                        fontSize: "12px",
                        color: p.seat === g.seat ? "var(--gold-hi)" : "rgba(246,239,224,0.45)",
                        fontWeight: p.seat === g.seat ? 600 : 400,
                      }}
                    >
                      {p.name}: {p.score}
                    </span>
                  ))}
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}
