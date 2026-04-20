import { useDraggable } from "@dnd-kit/core";
import type { ShipDef, Orientation } from "~/domain/types";
import { ShipSvg } from "../ships/ShipSvg";

const TRAY_CELL_SIZE = 28;

interface DraggableShipProps {
  shipDef: ShipDef;
  orientation: Orientation;
}

function DraggableShip({ shipDef, orientation }: DraggableShipProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `tray-${shipDef.type}`,
    data: { shipType: shipDef.type, orientation },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{
        opacity: isDragging ? 0.3 : 1,
        cursor: "grab",
        touchAction: "none",
        padding: "8px 10px",
        borderRadius: "6px",
        background: "rgba(23,41,75,0.7)",
        border: "1px solid rgba(100,160,255,0.14)",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: "4px",
        transition: "background 0.12s ease, border-color 0.12s ease",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = "rgba(23,41,75,0.95)";
        (e.currentTarget as HTMLElement).style.borderColor = "rgba(201,162,74,0.3)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = "rgba(23,41,75,0.7)";
        (e.currentTarget as HTMLElement).style.borderColor = "rgba(100,160,255,0.14)";
      }}
    >
      <span style={{
        fontFamily: "var(--serif)",
        fontVariant: "small-caps",
        fontSize: "10px",
        letterSpacing: "0.18em",
        color: "rgba(246,239,224,0.55)",
      }}>{shipDef.label}</span>
      <ShipSvg
        type={shipDef.type}
        orientation="h"
        cellSize={TRAY_CELL_SIZE}
      />
      <span style={{
        fontFamily: "var(--mono)",
        fontSize: "9px",
        color: "rgba(246,239,224,0.25)",
        letterSpacing: "0.1em",
      }}>{shipDef.size} decks</span>
    </div>
  );
}

interface ShipTrayProps {
  ships: ShipDef[];
  orientation: Orientation;
}

export function ShipTray({ ships, orientation }: ShipTrayProps) {
  if (ships.length === 0) {
    return (
      <div style={{
        fontFamily: "var(--serif)",
        fontVariant: "small-caps",
        fontSize: "11px",
        letterSpacing: "0.22em",
        color: "var(--gold)",
        textAlign: "center",
        padding: "12px",
        opacity: 0.7,
      }}>
        All ships deployed
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <p style={{
        fontFamily: "var(--serif)",
        fontVariant: "small-caps",
        fontSize: "10px",
        letterSpacing: "0.22em",
        color: "var(--gold-hi)",
        opacity: 0.6,
      }}>Ships to deploy:</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
        {ships.map((ship) => (
          <DraggableShip key={ship.type} shipDef={ship} orientation={orientation} />
        ))}
      </div>
    </div>
  );
}
