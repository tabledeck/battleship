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
      {/* Turn indicator — stencil chip */}
      <div style={{ textAlign: "center", marginBottom: "18px" }}>
        <span className="stencil-chip">
          {isMyTurn
            ? "Captain · Your Move"
            : `Awaiting ${opponentName}`}
        </span>
      </div>

      {/* Desktop: side by side. Mobile: attack board first */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "24px", justifyContent: "center" }}>

        {/* Attack board (opponent's grid) */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {/* Steel board frame */}
          <div className="board-frame">
            {/* Rivets at corners */}
            <div style={{ position: "absolute", top: "9px", left: "9px" }} className="rivet" />
            <div style={{ position: "absolute", top: "9px", right: "9px" }} className="rivet" />
            <div style={{ position: "absolute", bottom: "9px", left: "9px" }} className="rivet" />
            <div style={{ position: "absolute", bottom: "9px", right: "9px" }} className="rivet" />
            <AttackBoard
              attacks={myAttacks}
              sunkShips={opponentSunkShips}
              isMyTurn={isMyTurn}
              onFire={onFire}
              label={`${opponentName}'s Grid`}
            />
          </div>
          <ShipStatusPanel
            sunkShips={opponentSunkShips}
            shipsRemaining={opponentShipsRemaining}
            label="Enemy Fleet Status"
          />
        </div>

        {/* Fleet board (your grid) */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {/* Steel board frame (slightly warmer tint for "yours") */}
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
            {/* Rivets at corners */}
            <div style={{ position: "absolute", top: "9px", left: "9px" }} className="rivet" />
            <div style={{ position: "absolute", top: "9px", right: "9px" }} className="rivet" />
            <div style={{ position: "absolute", bottom: "9px", left: "9px" }} className="rivet" />
            <div style={{ position: "absolute", bottom: "9px", right: "9px" }} className="rivet" />
            <FleetBoard
              fleet={myFleet}
              incomingAttacks={myIncomingAttacks}
              label={`${myName}'s Fleet`}
            />
          </div>

          {/* Fleet count panel */}
          <div style={{
            background: "linear-gradient(180deg, rgba(15,29,51,0.9) 0%, rgba(8,21,37,0.95) 100%)",
            border: "1px solid rgba(100,160,255,0.15)",
            borderRadius: "6px",
            padding: "10px 14px",
          }}>
            <p style={{
              fontFamily: "var(--serif)",
              fontVariant: "small-caps",
              letterSpacing: "0.22em",
              fontSize: "10px",
              color: "var(--gold-hi)",
              opacity: 0.7,
            }}>Your Fleet</p>
            <p style={{
              fontFamily: "var(--mono)",
              fontSize: "13px",
              color: "var(--bone)",
              marginTop: "4px",
              fontVariantNumeric: "tabular-nums",
            }}>
              {myShipsRemaining} ship{myShipsRemaining !== 1 ? "s" : ""} remaining
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
