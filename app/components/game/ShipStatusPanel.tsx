import type { PlacedShip } from "~/domain/types";
import { SHIPS } from "~/domain/types";

interface ShipStatusPanelProps {
  sunkShips: PlacedShip[];
  shipsRemaining: number;
  label?: string;
}

const SHIP_ICONS: Record<string, string> = {
  carrier: "🚢",
  battleship: "⚓",
  cruiser: "🛳️",
  submarine: "🤿",
  destroyer: "⛵",
};

export function ShipStatusPanel({ sunkShips, shipsRemaining, label = "Enemy Fleet" }: ShipStatusPanelProps) {
  const sunkTypes = new Set(sunkShips.map((s) => s.type));

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-700 p-3">
      <p className="text-gray-400 text-xs font-medium mb-2">{label}</p>
      <div className="space-y-1">
        {SHIPS.map((ship) => {
          const isSunk = sunkTypes.has(ship.type);
          return (
            <div
              key={ship.type}
              className={`flex items-center gap-2 text-sm ${isSunk ? "text-red-400 line-through opacity-60" : "text-gray-300"}`}
            >
              <span>{SHIP_ICONS[ship.type]}</span>
              <span className="capitalize">{ship.label}</span>
              <span className="ml-auto text-xs text-gray-500">({ship.size})</span>
              {isSunk && <span className="text-red-400 text-xs">SUNK</span>}
            </div>
          );
        })}
      </div>
      <p className="text-gray-500 text-xs mt-2">{shipsRemaining} ship{shipsRemaining !== 1 ? "s" : ""} remaining</p>
    </div>
  );
}
