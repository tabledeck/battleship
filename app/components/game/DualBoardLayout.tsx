import { useEffect, useState } from "react";
import type { PlacedShip } from "~/domain/types";
import { FleetBoard } from "../board/FleetBoard";
import { AttackBoard } from "../board/AttackBoard";
import { ShipStatusPanel } from "./ShipStatusPanel";
import { useCellSize } from "~/hooks/useCellSize";

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
  over?: boolean;
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
  over = false,
}: DualBoardLayoutProps) {
  const cellSize = useCellSize();
  const [boardView, setBoardView] = useState<"attack" | "fleet">(isMyTurn ? "attack" : "fleet");

  useEffect(() => {
    setBoardView(isMyTurn ? "attack" : "fleet");
  }, [isMyTurn]);

  const banner = over
    ? "Engagement over"
    : isMyTurn
      ? "Your shot — tap the enemy grid"
      : `Waiting for ${opponentName} to fire`;

  return (
    <div className="w-full bs-play" data-testid="battle">
      <div className="bs-turn" data-testid="turn-banner" data-my-turn={isMyTurn ? "yes" : "no"}>
        <span className={`stencil-chip ${isMyTurn ? "" : "stencil-chip-wait"}`}>
          {banner}
        </span>
      </div>

      <div className="bs-board-switch" role="tablist" aria-label="Which grid">
        <button
          type="button"
          role="tab"
          aria-selected={boardView === "attack"}
          className={boardView === "attack" ? "is-on" : ""}
          onClick={() => setBoardView("attack")}
        >
          Enemy waters
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={boardView === "fleet"}
          className={boardView === "fleet" ? "is-on" : ""}
          onClick={() => setBoardView("fleet")}
        >
          Your fleet
        </button>
      </div>

      <div className="bs-boards" data-view={boardView}>
        <div className="bs-board-pane bs-board-attack">
          <div className="board-frame">
            <div style={{ position: "absolute", top: "9px", left: "9px" }} className="rivet" />
            <div style={{ position: "absolute", top: "9px", right: "9px" }} className="rivet" />
            <div style={{ position: "absolute", bottom: "9px", left: "9px" }} className="rivet" />
            <div style={{ position: "absolute", bottom: "9px", right: "9px" }} className="rivet" />
            <AttackBoard
              attacks={myAttacks}
              sunkShips={opponentSunkShips}
              isMyTurn={isMyTurn}
              onFire={onFire}
              label={`${opponentName}'s grid`}
              cellSize={cellSize}
            />
          </div>
          <ShipStatusPanel
            sunkShips={opponentSunkShips}
            shipsRemaining={opponentShipsRemaining}
            label="Enemy fleet"
          />
        </div>

        <div className="bs-board-pane bs-board-fleet">
          <div className="board-frame" style={{
            background: `
              repeating-linear-gradient(88deg,
                rgba(0,0,0,0.18) 0px,
                rgba(0,0,0,0.18) 1px,
                transparent 1px,
                transparent 6px
              ),
              linear-gradient(180deg, #1a3455 0%, #0f2240 60%, #081525 100%)`,
          }}>
            <div style={{ position: "absolute", top: "9px", left: "9px" }} className="rivet" />
            <div style={{ position: "absolute", top: "9px", right: "9px" }} className="rivet" />
            <div style={{ position: "absolute", bottom: "9px", left: "9px" }} className="rivet" />
            <div style={{ position: "absolute", bottom: "9px", right: "9px" }} className="rivet" />
            <FleetBoard
              fleet={myFleet}
              incomingAttacks={myIncomingAttacks}
              label={`${myName}'s fleet`}
              cellSize={cellSize}
            />
          </div>
          <div className="bs-fleet-count">
            <p className="bs-kicker">Your fleet</p>
            <p className="bs-count">
              {myShipsRemaining} ship{myShipsRemaining !== 1 ? "s" : ""} remaining
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
