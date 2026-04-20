import type { PlacedShip } from "~/domain/types";
import { SHIPS } from "~/domain/types";
import { CarrierIcon } from "~/components/icons/battleship/CarrierIcon";
import { BattleshipIcon } from "~/components/icons/battleship/BattleshipIcon";
import { CruiserIcon } from "~/components/icons/battleship/CruiserIcon";
import { SubmarineIcon } from "~/components/icons/battleship/SubmarineIcon";
import { DestroyerIcon } from "~/components/icons/battleship/DestroyerIcon";

interface ShipStatusPanelProps {
  sunkShips: PlacedShip[];
  shipsRemaining: number;
  label?: string;
}

function ShipIcon({ type, size = 32 }: { type: string; size?: number }) {
  switch (type) {
    case "carrier":    return <CarrierIcon size={size} />;
    case "battleship": return <BattleshipIcon size={size} />;
    case "cruiser":    return <CruiserIcon size={size} />;
    case "submarine":  return <SubmarineIcon size={size} />;
    case "destroyer":  return <DestroyerIcon size={size} />;
    default:           return null;
  }
}

// Small damage track socket
function DamageSocket({ filled }: { filled: boolean }) {
  return (
    <div style={{
      width: 10,
      height: 10,
      borderRadius: "50%",
      background: filled
        ? "radial-gradient(circle at 35% 35%, #e15a44 0%, #c8372a 55%, #8b1f17 100%)"
        : "rgba(246,239,224,0.08)",
      border: filled ? "none" : "1px solid rgba(246,239,224,0.18)",
      boxShadow: filled
        ? "inset 0 1px 1px rgba(255,255,255,0.3), 0 1px 2px rgba(0,0,0,0.4)"
        : "inset 0 1px 0 rgba(0,0,0,0.3)",
    }} />
  );
}

export function ShipStatusPanel({ sunkShips, shipsRemaining, label = "Enemy Fleet" }: ShipStatusPanelProps) {
  const sunkTypes = new Map(sunkShips.map((s) => [s.type, s]));

  return (
    <div style={{
      background: "linear-gradient(180deg, rgba(15,29,51,0.9) 0%, rgba(8,21,37,0.95) 100%)",
      border: "1px solid rgba(100,160,255,0.15)",
      borderRadius: "6px",
      padding: "12px 14px",
      boxShadow: "inset 0 1px 0 rgba(100,160,255,0.08), 0 4px 12px rgba(0,0,0,0.4)",
    }}>
      {/* Label */}
      <p style={{
        fontFamily: "var(--serif)",
        fontVariant: "small-caps",
        letterSpacing: "0.24em",
        fontSize: "10px",
        color: "var(--gold-hi)",
        opacity: 0.7,
        marginBottom: "10px",
        lineHeight: 1,
      }}>{label}</p>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {SHIPS.map((ship) => {
          const isSunk = sunkTypes.has(ship.type);
          return (
            <div
              key={ship.type}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                opacity: isSunk ? 0.4 : 1,
                transition: "opacity 0.3s ease",
                position: "relative",
              }}
            >
              {/* Ship silhouette icon */}
              <div style={{ flexShrink: 0, opacity: isSunk ? 0.5 : 0.9 }}>
                <ShipIcon type={ship.type} size={32} />
              </div>

              {/* Name */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{
                  fontFamily: "var(--serif)",
                  fontVariant: "small-caps",
                  fontSize: "11px",
                  letterSpacing: "0.12em",
                  color: isSunk ? "rgba(246,239,224,0.4)" : "var(--bone)",
                  display: "block",
                  lineHeight: 1.2,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}>
                  {ship.label}
                  <span style={{
                    fontFamily: "var(--mono)",
                    fontSize: "9px",
                    marginLeft: "4px",
                    opacity: 0.5,
                  }}>·{ship.size}</span>
                </span>

                {/* Damage track */}
                <div style={{ display: "flex", gap: "3px", marginTop: "4px" }}>
                  {Array.from({ length: ship.size }, (_, i) => {
                    const sunkShip = sunkTypes.get(ship.type);
                    const hitCount = sunkShip ? sunkShip.hits.length : 0;
                    return <DamageSocket key={i} filled={i < hitCount} />;
                  })}
                </div>
              </div>

              {/* SUNK stamp */}
              {isSunk && (
                <div className="sunk-stamp" style={{ flexShrink: 0 }}>
                  Sunk
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p style={{
        fontFamily: "var(--mono)",
        fontSize: "10px",
        color: "rgba(246,239,224,0.35)",
        marginTop: "10px",
        fontVariantNumeric: "tabular-nums",
      }}>
        {shipsRemaining} ship{shipsRemaining !== 1 ? "s" : ""} afloat
      </p>
    </div>
  );
}
