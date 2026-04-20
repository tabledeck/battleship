import { redirect } from "react-router";
import type { Route } from "./+types/login";
import { getOptionalUserFromContext } from "~/domain/utils/global-context.server";
import { useState } from "react";
import { signIn } from "~/lib/auth-client";

export function meta() {
  return [{ title: "Login — Battleship" }];
}

export async function loader({ context }: Route.LoaderArgs) {
  const user = getOptionalUserFromContext(context);
  if (user) throw redirect("/");
  return null;
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await signIn.email({ email, password });
      if (result.error) {
        setError("Invalid email or password.");
      } else {
        window.location.href = "/";
      }
    } catch {
      setError("Something went wrong. Please try again.");
    }
    setLoading(false);
  };

  return (
    <div
      className="min-h-screen blueprint-grid flex flex-col items-center justify-center p-4"
      style={{ position: "relative" }}
    >
      {/* Radial glow */}
      <div style={{
        position: "absolute",
        inset: 0,
        background: "radial-gradient(ellipse at 50% 40%, rgba(100,160,255,0.04) 0%, transparent 60%)",
        pointerEvents: "none",
      }} />

      {/* Wordmark */}
      <div style={{ textAlign: "center", marginBottom: "36px" }}>
        <a href="/" style={{ textDecoration: "none" }}>
          <h1 style={{
            fontFamily: "var(--serif)",
            fontVariant: "small-caps",
            fontWeight: 700,
            fontSize: "36px",
            letterSpacing: "0.22em",
            color: "var(--gold-hi)",
            margin: 0,
            textShadow: "0 1px 0 rgba(0,0,0,0.5)",
          }}>Battleship</h1>
        </a>
        <p style={{
          fontFamily: "var(--serif)",
          fontStyle: "italic",
          fontSize: "13px",
          color: "rgba(246,239,224,0.35)",
          marginTop: "6px",
        }}>Sign in to track your game history</p>
      </div>

      {/* Login form plaque */}
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

        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          <div>
            <label className="td-input-label">Email</label>
            <input
              type="email"
              placeholder="fleet@example.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="td-input"
              style={{ color: "var(--ink)" }}
            />
          </div>
          <div>
            <label className="td-input-label">Password</label>
            <input
              type="password"
              placeholder="••••••••"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="td-input"
              style={{ color: "var(--ink)" }}
            />
          </div>

          {error && (
            <p style={{
              fontFamily: "var(--sans)",
              fontSize: "12px",
              color: "var(--copper)",
              textAlign: "center",
            }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
            style={{ width: "100%", marginTop: "4px" }}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>

          <p style={{
            fontFamily: "var(--serif)",
            fontStyle: "italic",
            fontSize: "12px",
            textAlign: "center",
            color: "var(--ink-soft)",
          }}>
            No account?{" "}
            <a href="/signup" style={{ color: "var(--ink)", fontWeight: 600, textDecoration: "underline" }}>
              Sign up
            </a>
          </p>

          <a
            href="/"
            style={{
              fontFamily: "var(--serif)",
              fontVariant: "small-caps",
              fontSize: "11px",
              letterSpacing: "0.18em",
              color: "var(--ink-faint)",
              textAlign: "center",
              textDecoration: "none",
            }}
          >
            Play as guest instead
          </a>
        </form>
      </div>
    </div>
  );
}
