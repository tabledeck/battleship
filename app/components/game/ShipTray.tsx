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
      }}
      className="flex flex-col items-start gap-1 p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors border border-gray-700"
    >
      <span className="text-gray-400 text-xs font-medium">{shipDef.label}</span>
      <div className="flex items-center gap-1">
        <ShipSvg
          type={shipDef.type}
          orientation="h"
          cellSize={TRAY_CELL_SIZE}
        />
      </div>
      <span className="text-gray-600 text-xs">{shipDef.size} cells</span>
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
      <div className="text-gray-500 text-sm p-3 text-center">
        All ships placed!
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-gray-400 text-xs font-medium">Ships to place:</p>
      <div className="flex flex-wrap gap-2">
        {ships.map((ship) => (
          <DraggableShip key={ship.type} shipDef={ship} orientation={orientation} />
        ))}
      </div>
    </div>
  );
}
