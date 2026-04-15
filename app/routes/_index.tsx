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
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-4">
      {/* Header */}
      <a href="https://tabledeck.us" className="absolute top-4 left-4 text-gray-500 hover:text-gray-300 text-sm">
        ← tabledeck.us
      </a>
      <div className="absolute top-4 right-4 flex gap-3">
        {user ? (
          <>
            <a href="/profile" className="text-gray-300 hover:text-white text-sm">
              {user.name || user.email}
            </a>
            <a href="/logout" className="text-gray-500 hover:text-gray-300 text-sm">
              Logout
            </a>
          </>
        ) : (
          <>
            <a href="/login" className="text-gray-300 hover:text-white text-sm">
              Login
            </a>
            <a href="/signup" className="text-blue-400 hover:text-blue-300 text-sm font-medium">
              Sign Up
            </a>
          </>
        )}
      </div>

      {/* Hero */}
      <div className="text-center mb-12">
        <div className="text-6xl mb-4">🚢</div>
        <h1 className="text-5xl font-bold text-white mb-3">Battleship</h1>
        <p className="text-gray-400 text-lg max-w-md">
          The classic naval strategy game. Place your fleet, then sink your
          opponent's ships one shot at a time. Share a link to play with a friend.
        </p>
      </div>

      {/* Create Game */}
      <div className="bg-gray-900 rounded-2xl p-8 w-full max-w-sm border border-gray-800">
        <h2 className="text-white font-semibold text-xl mb-2">New Game</h2>
        <p className="text-gray-500 text-sm mb-6">2 players — you and a friend</p>

        <button
          onClick={createGame}
          disabled={creating}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-xl py-3 text-lg transition-colors"
        >
          {creating ? "Creating..." : "Create Game"}
        </button>

        <p className="text-gray-500 text-xs text-center mt-4">
          You'll get a shareable link to send to your friend
        </p>
      </div>

      {/* How to play */}
      <div className="mt-10 text-center max-w-sm">
        <h3 className="text-gray-400 font-medium mb-3">How to play</h3>
        <ol className="text-gray-500 text-sm space-y-1 text-left">
          <li>1. Create a game and share the link</li>
          <li>2. Both players guess a number 1–10 — closest goes first</li>
          <li>3. Place your 5 ships on the grid</li>
          <li>4. Take turns firing shots at each other's grid</li>
          <li>5. First to sink all opponent ships wins!</li>
        </ol>
      </div>
    </div>
  );
}
