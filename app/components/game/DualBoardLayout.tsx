import type { PlacedShip } from "~/domain/types";
import { FleetBoard } from "../board/FleetBoard";
import { AttackBoard } from "../board/AttackBoard";
import { ShipStatusPanel } from "./ShipStatusPanel";

interface DualBoardLayoutProps {
  myFleet: PlacedShip[];
  myIncomingAttacks: Record<string, "hit" | "miss">;
  myAttacks: Record<string, "hit" | "miss">;
  opponentSunkShips: PlacedShip[];
  myShipsRemaining: number;
  opponentShipsRemaining: number;
  isMyTurn: boolean;
  onFire: (row: number, col: number) => void;
  myName: string;
  opponentName: string;
}

export function DualBoardLayout({
  myFleet,
  myIncomingAttacks,
  myAttacks,
  opponentSunkShips,
  myShipsRemaining,
  opponentShipsRemaining,
  isMyTurn,
  onFire,
  myName,
  opponentName,
}: DualBoardLayoutProps) {
  return (
    <div className="w-full max-w-4xl">
      {/* Turn indicator */}
      <div className={`text-center py-2 mb-4 rounded-lg text-sm font-semibold ${
        isMyTurn ? "bg-blue-900/40 text-blue-300 border border-blue-700" : "bg-gray-800 text-gray-400 border border-gray-700"
      }`}>
        {isMyTurn ? "Your turn — click the opponent's grid to fire!" : `${opponentName}'s turn...`}
      </div>

      {/* Desktop: side by side. Mobile: attack board first */}
      <div className="flex flex-col md:flex-row gap-6 justify-center">
        {/* Attack board (opponent's grid) — shown first on mobile */}
        <div className="flex flex-col gap-3">
          <AttackBoard
            attacks={myAttacks}
            sunkShips={opponentSunkShips}
            isMyTurn={isMyTurn}
            onFire={onFire}
            label={`${opponentName}'s Grid`}
          />
          <ShipStatusPanel
            sunkShips={opponentSunkShips}
            shipsRemaining={opponentShipsRemaining}
            label="Enemy Fleet Status"
          />
        </div>

        {/* Fleet board (your grid) */}
        <div className="flex flex-col gap-3">
          <FleetBoard
            fleet={myFleet}
            incomingAttacks={myIncomingAttacks}
            label={`${myName}'s Fleet`}
          />
          <div className="bg-gray-900 rounded-lg border border-gray-700 p-3">
            <p className="text-gray-400 text-xs font-medium">Your Fleet</p>
            <p className="text-gray-300 text-sm mt-1">
              {myShipsRemaining} ship{myShipsRemaining !== 1 ? "s" : ""} remaining
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
