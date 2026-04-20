import type { PlacedShip, PublicPlayerState } from "~/domain/types";
import { DualBoardLayout } from "./DualBoardLayout";

interface ActivePhaseProps {
  mySeat: number;
  myFleet: PlacedShip[];
  players: PublicPlayerState[];
  currentTurn: number;
  onFire: (row: number, col: number) => void;
}

export function ActivePhase({ mySeat, myFleet, players, currentTurn, onFire }: ActivePhaseProps) {
  const me = players.find((p) => p.seat === mySeat);
  const opponent = players.find((p) => p.seat !== mySeat);

  if (!me || !opponent) {
    return (
      <p style={{
        fontFamily: "var(--serif)",
        fontStyle: "italic",
        fontSize: "13px",
        color: "rgba(246,239,224,0.35)",
      }}>Waiting for players...</p>
    );
  }

  const isMyTurn = currentTurn === mySeat;

  return (
    <DualBoardLayout
      myFleet={myFleet}
      myIncomingAttacks={opponent.attacks}
      myAttacks={me.attacks}
      opponentSunkShips={me.sunkShips}
      myShipsRemaining={me.shipsRemaining}
      opponentShipsRemaining={opponent.shipsRemaining}
      isMyTurn={isMyTurn}
      onFire={onFire}
      myName={me.name}
      opponentName={opponent.name}
    />
  );
}
