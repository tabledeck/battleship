import { useState, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToWindowEdges } from "@dnd-kit/modifiers";
import type { PlacedShip, Orientation, ShipType } from "~/domain/types";
import { SHIPS } from "~/domain/types";
import { BOARD_SIZE, posKey, getShipCells, isInBounds, shipsOverlap, randomFleet } from "~/domain/board";
import { FleetBoard } from "../board/FleetBoard";
import { ShipTray } from "./ShipTray";
import { ShipSvg } from "../ships/ShipSvg";

const CELL_SIZE = 34;

interface PlacementPhaseProps {
  onConfirm: (ships: PlacedShip[]) => void;
  myReady: boolean;
  opponentReady: boolean;
}

export function PlacementPhase({ onConfirm, myReady, opponentReady }: PlacementPhaseProps) {
  const [fleet, setFleet] = useState<PlacedShip[]>([]);
  const [orientation, setOrientation] = useState<Orientation>("h");
  const [draggingType, setDraggingType] = useState<ShipType | null>(null);
  const [previewShip, setPreviewShip] = useState<PlacedShip | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  const placedTypes = new Set(fleet.map((s) => s.type));
  const unplacedShips = SHIPS.filter((s) => !placedTypes.has(s.type));
  const allPlaced = unplacedShips.length === 0;

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const shipType = event.active.data.current?.shipType as ShipType | undefined;
    if (shipType) setDraggingType(shipType);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setDraggingType(null);
      setPreviewShip(null);

      const shipType = event.active.data.current?.shipType as ShipType | undefined;
      const over = event.over;
      const translated = event.active.rect.current.translated;

      if (!shipType || !over || !translated) return;

      // Use the visual position of the overlay relative to the droppable grid rect.
      // This is accurate regardless of where within the draggable the user grabbed.
      const overRect = over.rect;
      const col = Math.floor((translated.left - overRect.left) / CELL_SIZE);
      const row = Math.floor((translated.top - overRect.top) / CELL_SIZE);

      if (col < 0 || col >= BOARD_SIZE || row < 0 || row >= BOARD_SIZE) return;

      const ship: PlacedShip = {
        type: shipType,
        origin: { row, col },
        orientation,
        hits: [],
      };

      if (!isInBounds(ship)) return;

      const existingWithoutThisType = fleet.filter((s) => s.type !== shipType);
      if (shipsOverlap([...existingWithoutThisType, ship])) return;

      setFleet([...existingWithoutThisType, ship]);
    },
    [fleet, orientation],
  );

  const removeShip = (type: ShipType) => {
    setFleet((prev) => prev.filter((s) => s.type !== type));
  };

  const randomize = () => {
    setFleet(randomFleet());
  };

  const handleConfirm = () => {
    if (!allPlaced || myReady) return;
    onConfirm(fleet);
  };

  // Incoming attacks are empty during placement
  const emptyAttacks: Record<string, "hit" | "miss"> = {};

  return (
    <DndContext
      sensors={sensors}
      modifiers={[restrictToWindowEdges]}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col gap-4 w-full max-w-2xl">
        <div className="bg-gray-900 rounded-xl border border-gray-700 p-4">
          <h2 className="text-white font-bold text-lg mb-1">Place Your Ships</h2>
          <p className="text-gray-400 text-sm mb-4">
            Drag ships onto your grid. Press R or the rotate button to change orientation.
          </p>

          <div className="flex flex-wrap gap-4 items-start">
            {/* Fleet board */}
            <div id="fleet-board-grid">
              <FleetBoard
                fleet={fleet}
                incomingAttacks={emptyAttacks}
                droppable={!myReady}
                previewShip={previewShip}
                label="Your Grid"
              />
            </div>

            {/* Controls */}
            <div className="flex flex-col gap-3 flex-1 min-w-48">
              <div className="flex gap-2">
                <button
                  onClick={() => setOrientation((o) => (o === "h" ? "v" : "h"))}
                  disabled={myReady}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-white text-sm rounded-lg py-2 px-3 transition-colors"
                >
                  Rotate ({orientation === "h" ? "Horizontal" : "Vertical"})
                </button>
                <button
                  onClick={randomize}
                  disabled={myReady}
                  className="bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-white text-sm rounded-lg py-2 px-3 transition-colors"
                >
                  Random
                </button>
                <button
                  onClick={() => setFleet([])}
                  disabled={myReady || fleet.length === 0}
                  className="bg-gray-700 hover:bg-red-900 disabled:opacity-40 text-white text-sm rounded-lg py-2 px-3 transition-colors"
                >
                  Clear
                </button>
              </div>

              {/* Ship tray */}
              {!myReady && (
                <ShipTray ships={unplacedShips} orientation={orientation} />
              )}

              {/* Placed ships list with remove buttons */}
              {fleet.length > 0 && !myReady && (
                <div className="flex flex-col gap-1">
                  <p className="text-gray-400 text-xs font-medium">Placed:</p>
                  {fleet.map((ship) => (
                    <div key={ship.type} className="flex items-center justify-between text-sm">
                      <span className="text-gray-300 capitalize">{ship.type}</span>
                      <button
                        onClick={() => removeShip(ship.type)}
                        className="text-gray-500 hover:text-red-400 text-xs transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={handleConfirm}
                disabled={!allPlaced || myReady}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg py-2.5 text-sm transition-colors"
              >
                {myReady ? "Waiting for opponent..." : "Confirm Placement"}
              </button>

              {myReady && opponentReady && (
                <p className="text-green-400 text-sm text-center font-medium">
                  Both ready — starting game!
                </p>
              )}
              {myReady && !opponentReady && (
                <p className="text-gray-500 text-xs text-center">
                  Opponent is still placing ships...
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Drag overlay showing ship being dragged */}
      <DragOverlay>
        {draggingType && (
          <ShipSvg
            type={draggingType}
            orientation={orientation}
            cellSize={CELL_SIZE}
          />
        )}
      </DragOverlay>
    </DndContext>
  );
}
