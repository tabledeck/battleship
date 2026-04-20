import { redirect } from "react-router";
import type { Route } from "./+types/signup";
import { getOptionalUserFromContext } from "~/domain/utils/global-context.server";
import { useState } from "react";
import { signUp } from "~/lib/auth-client";

export function meta() {
  return [{ title: "Sign Up — Battleship" }];
}

export async function loader({ context }: Route.LoaderArgs) {
  const user = getOptionalUserFromContext(context);
  if (user) throw redirect("/");
  return null;
}

export default function Signup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await signUp.email({ name, email, password });
      if (result.error) {
        setError(result.error.message ?? "Sign up failed.");
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
        }}>Create an account to save your games</p>
      </div>

      {/* Signup form plaque */}
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

        <form onSubmit={handleSignup} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          <div>
            <label className="td-input-label">Display Name</label>
            <input
              type="text"
              placeholder="Captain Ahab"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="td-input"
              style={{ color: "var(--ink)" }}
            />
          </div>
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
              placeholder="Min. 8 characters"
              required
              minLength={8}
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
            {loading ? "Creating account..." : "Create Account"}
          </button>

          <p style={{
            fontFamily: "var(--serif)",
            fontStyle: "italic",
            fontSize: "12px",
            textAlign: "center",
            color: "var(--ink-soft)",
          }}>
            Already have an account?{" "}
            <a href="/login" style={{ color: "var(--ink)", fontWeight: 600, textDecoration: "underline" }}>
              Sign in
            </a>
          </p>
        </form>
      </div>
    </div>
  );
}
