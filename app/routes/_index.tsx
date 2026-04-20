import { useState } from "react";
import { useNavigate } from "react-router";
import type { Route } from "./+types/_index";
import { getOptionalUserFromContext } from "~/domain/utils/global-context.server";

export function meta() {
  return [
    { title: "Battleship Online — Free Multiplayer Game" },
    { name: "description", content: "Play Battleship online free with 2 players. The classic naval warfare game — share a link and play anywhere, no download required." },
    { property: "og:type", content: "website" },
    { property: "og:site_name", content: "Tabledeck" },
    { property: "og:title", content: "Battleship Online — Free Multiplayer Game" },
    { property: "og:description", content: "Play Battleship online free. Share a link and play anywhere, no download required." },
    { property: "og:url", content: "https://battleship.tabledeck.us" },
    { name: "twitter:card", content: "summary" },
    { name: "twitter:title", content: "Battleship Online — Free Multiplayer Game" },
    { name: "twitter:description", content: "Play Battleship online free with 2 players. Share a link and play anywhere." },
  ];
}

export const links: Route.LinksFunction = () => [
  { rel: "canonical", href: "https://battleship.tabledeck.us" },
];

export async function loader({ context }: Route.LoaderArgs) {
  const user = getOptionalUserFromContext(context);
  return { user: user ? { name: user.name, email: user.email } : null };
}

export default function Index({ loaderData }: Route.ComponentProps) {
  const { user } = loaderData;
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);

  const createGame = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxPlayers: 2 }),
      });
      const { gameId } = (await res.json()) as { gameId: string };
      navigate(`/game/${gameId}`);
    } catch {
      setCreating(false);
    }
  };

  return (
    <div
      className="min-h-screen blueprint-grid flex flex-col items-center justify-center p-4"
      style={{ position: "relative", overflow: "hidden" }}
    >
      {/* Subtle radial light */}
      <div style={{
        position: "absolute",
        inset: 0,
        background: "radial-gradient(ellipse at 50% 40%, rgba(100,160,255,0.05) 0%, transparent 60%)",
        pointerEvents: "none",
      }} />

      {/* Nav row */}
      <div style={{ position: "absolute", top: "16px", left: "16px", right: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <a
          href="https://tabledeck.us"
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
          Tabledeck.us
        </a>
        <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
          {user ? (
            <>
              <a
                href="/profile"
                style={{ fontFamily: "var(--sans)", fontSize: "13px", color: "rgba(246,239,224,0.6)", textDecoration: "none" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--bone)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(246,239,224,0.6)")}
              >
                {user.name || user.email}
              </a>
              <a
                href="/logout"
                style={{ fontFamily: "var(--sans)", fontSize: "13px", color: "rgba(246,239,224,0.35)", textDecoration: "none" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(246,239,224,0.6)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(246,239,224,0.35)")}
              >
                Logout
              </a>
            </>
          ) : (
            <>
              <a
                href="/login"
                style={{ fontFamily: "var(--sans)", fontSize: "13px", color: "rgba(246,239,224,0.6)", textDecoration: "none" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--bone)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(246,239,224,0.6)")}
              >
                Login
              </a>
              <a
                href="/signup"
                style={{
                  fontFamily: "var(--serif)",
                  fontVariant: "small-caps",
                  fontSize: "12px",
                  letterSpacing: "0.18em",
                  color: "var(--gold-hi)",
                  textDecoration: "none",
                  padding: "4px 12px",
                  border: "1px solid rgba(201,162,74,0.35)",
                  borderRadius: "999px",
                }}
              >
                Sign Up
              </a>
            </>
          )}
        </div>
      </div>

      {/* Hero */}
      <div style={{ textAlign: "center", marginBottom: "48px", position: "relative" }}>
        {/* Stenciled BATTLESHIP wordmark */}
        <h1 style={{
          fontFamily: "var(--serif)",
          fontVariant: "small-caps",
          fontWeight: 700,
          fontSize: "clamp(42px, 8vw, 72px)",
          letterSpacing: "0.22em",
          color: "var(--gold-hi)",
          margin: 0,
          lineHeight: 1,
          textShadow: "0 1px 0 rgba(0,0,0,0.6), 0 0 40px rgba(201,162,74,0.18)",
          WebkitTextStroke: "1px rgba(201,162,74,0.3)",
        }}>
          Battleship
        </h1>

        {/* Subtitle */}
        <p style={{
          fontFamily: "var(--serif)",
          fontVariant: "small-caps",
          fontSize: "11px",
          letterSpacing: "0.42em",
          color: "rgba(246,239,224,0.35)",
          marginTop: "12px",
          marginBottom: 0,
        }}>
          Naval Strategy · Two Players
        </p>

        {/* Rule lines */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          marginTop: "14px",
          justifyContent: "center",
        }}>
          <div style={{ width: "60px", height: "1px", background: "linear-gradient(90deg, transparent, rgba(201,162,74,0.4))" }} />
          <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--gold)", opacity: 0.5 }} />
          <div style={{ width: "60px", height: "1px", background: "linear-gradient(90deg, rgba(201,162,74,0.4), transparent)" }} />
        </div>
      </div>

      {/* New Engagement plaque */}
      <div className="td-plaque" style={{
        flexDirection: "column",
        alignItems: "stretch",
        maxWidth: "360px",
        width: "100%",
        position: "relative",
      }}>
        {/* Rivets */}
        <div style={{ position: "absolute", top: "10px", left: "10px" }} className="rivet" />
        <div style={{ position: "absolute", top: "10px", right: "10px" }} className="rivet" />
        <div style={{ position: "absolute", bottom: "10px", left: "10px" }} className="rivet" />
        <div style={{ position: "absolute", bottom: "10px", right: "10px" }} className="rivet" />

        <div style={{ textAlign: "center", marginBottom: "4px" }}>
          <h2 style={{
            fontFamily: "var(--serif)",
            fontVariant: "small-caps",
            fontWeight: 600,
            fontSize: "18px",
            letterSpacing: "0.2em",
            color: "var(--ink)",
            margin: 0,
          }}>New Engagement</h2>
          <p style={{
            fontFamily: "var(--sans)",
            fontSize: "12px",
            color: "var(--ink-soft)",
            marginTop: "6px",
            marginBottom: "18px",
          }}>2 players · share a link · no download</p>
        </div>

        <button
          onClick={createGame}
          disabled={creating}
          className="btn-primary"
          style={{ width: "100%" }}
        >
          {creating ? "Preparing Fleet..." : "New Engagement"}
        </button>

        <p style={{
          fontFamily: "var(--serif)",
          fontStyle: "italic",
          fontSize: "11px",
          textAlign: "center",
          color: "var(--ink-faint)",
          marginTop: "12px",
        }}>
          You'll receive a shareable link to send to your opponent
        </p>
      </div>

      {/* How to play */}
      <div style={{
        marginTop: "48px",
        maxWidth: "420px",
        width: "100%",
      }}>
        <p style={{
          fontFamily: "var(--serif)",
          fontVariant: "small-caps",
          letterSpacing: "0.28em",
          fontSize: "10.5px",
          color: "rgba(201,162,74,0.5)",
          textAlign: "center",
          marginBottom: "16px",
        }}>Standing Orders</p>

        <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {[
            "Create a game and share the link with your opponent",
            "Both players guess a number 1–10 — closest goes first",
            "Place your 5 ships on the grid",
            "Take turns firing shots at each other's fleet",
            "First to sink all opponent ships wins",
          ].map((step, i) => (
            <li key={i} style={{
              display: "flex",
              gap: "12px",
              alignItems: "baseline",
              padding: "7px 0",
              borderBottom: i < 4 ? "1px dashed rgba(201,162,74,0.12)" : "none",
            }}>
              <span style={{
                fontFamily: "var(--mono)",
                fontSize: "11px",
                color: "var(--gold)",
                opacity: 0.55,
                flexShrink: 0,
                minWidth: "18px",
              }}>{i + 1}.</span>
              <span style={{
                fontFamily: "var(--sans)",
                fontSize: "12px",
                color: "rgba(246,239,224,0.45)",
                lineHeight: 1.5,
              }}>{step}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Footer mark */}
      <p style={{
        position: "absolute",
        bottom: "16px",
        fontFamily: "var(--serif)",
        fontVariant: "small-caps",
        fontSize: "10px",
        letterSpacing: "0.28em",
        color: "rgba(201,162,74,0.18)",
      }}>Tabledeck</p>
    </div>
  );
}
