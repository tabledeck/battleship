import { useState, useCallback, useEffect } from "react";
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
import { useCellSize } from "~/hooks/useCellSize";

// Rotate icon SVG
function RotateIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
      <path d="M3 3v5h5"/>
    </svg>
  );
}

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
  const [selected, setSelected] = useState<ShipType | null>(SHIPS[0].type);
  const [placeError, setPlaceError] = useState("");
  const cellSize = useCellSize();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "r" || e.key === "R") {
        setOrientation((o) => (o === "h" ? "v" : "h"));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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

      const overRect = over.rect;
      const col = Math.floor((translated.left - overRect.left) / cellSize);
      const row = Math.floor((translated.top - overRect.top) / cellSize);

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
    [fleet, orientation, cellSize],
  );

  const placeAt = (row: number, col: number) => {
    if (myReady || !selected) {
      setPlaceError(selected ? "" : "Choose a ship first.");
      return;
    }
    const ship: PlacedShip = { type: selected, origin: { row, col }, orientation, hits: [] };
    if (!isInBounds(ship)) {
      setPlaceError("That ship doesn't fit there. Try rotating it.");
      return;
    }
    const rest = fleet.filter((s) => s.type !== selected);
    if (shipsOverlap([...rest, ship])) {
      setPlaceError("Ships can't overlap.");
      return;
    }
    const nextFleet = [...rest, ship];
    setFleet(nextFleet);
    setPlaceError("");
    const next = SHIPS.find((s) => !nextFleet.some((p) => p.type === s.type));
    setSelected(next?.type ?? null);
  };

  const removeShip = (type: ShipType) => {
    setFleet((prev) => prev.filter((s) => s.type !== type));
  };

  const randomize = () => {
    setFleet(randomFleet());
    setSelected(null);
    setPlaceError("");
  };

  const handleConfirm = () => {
    if (!allPlaced || myReady) return;
    onConfirm(fleet);
  };

  const emptyAttacks: Record<string, "hit" | "miss"> = {};

  return (
    <DndContext
      sensors={sensors}
      modifiers={[restrictToWindowEdges]}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="bs-placement" style={{ display: "flex", flexDirection: "column", gap: "16px", width: "100%" }}>
        {/* Placement card */}
        <div className="bs-place-card">
          {/* Corner rivets */}
          <div style={{ position: "absolute", top: "10px", left: "10px" }} className="rivet" />
          <div style={{ position: "absolute", top: "10px", right: "10px" }} className="rivet" />

          {/* Header */}
          <h2 style={{
            fontFamily: "var(--serif)",
            fontVariant: "small-caps",
            fontWeight: 600,
            fontSize: "18px",
            letterSpacing: "0.22em",
            color: "var(--gold-hi)",
            marginBottom: "4px",
            marginTop: 0,
          }}>Deploy Your Fleet</h2>
          <p style={{
            fontFamily: "var(--sans)",
            fontSize: "13px",
            lineHeight: 1.45,
            color: "rgba(246,239,224,0.78)",
            marginBottom: "18px",
          }}>
            Tap a ship, then tap the grid. Rotate turns it. On a keyboard, press R. Or randomize a legal fleet.
          </p>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "20px", alignItems: "flex-start" }}>
            {/* Fleet board */}
            <div id="fleet-board-grid" className="board-frame" style={{ position: "relative" }}>
              <div style={{ position: "absolute", top: "9px", left: "9px" }} className="rivet" />
              <div style={{ position: "absolute", top: "9px", right: "9px" }} className="rivet" />
              <div style={{ position: "absolute", bottom: "9px", left: "9px" }} className="rivet" />
              <div style={{ position: "absolute", bottom: "9px", right: "9px" }} className="rivet" />
              <FleetBoard
                fleet={fleet}
                incomingAttacks={emptyAttacks}
                droppable={!myReady}
                previewShip={previewShip}
                label="Your grid"
                cellSize={cellSize}
                onCellClick={myReady ? undefined : placeAt}
              />
            </div>

            {/* Controls */}
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", flex: 1, minWidth: "180px" }}>
              {/* Rotate / Randomize / Clear buttons */}
              <div className="bs-place-actions">
                <button
                  onClick={() => setOrientation((o) => (o === "h" ? "v" : "h"))}
                  disabled={myReady}
                  className="btn-secondary"
                  type="button"
                >
                  <RotateIcon />
                  {orientation === "h" ? "Horizontal" : "Vertical"}
                </button>
                <button
                  onClick={randomize}
                  disabled={myReady}
                  className="btn-secondary"
                  type="button"
                  data-testid="randomize"
                >
                  Randomize
                </button>
                <button
                  onClick={() => { setFleet([]); setSelected(SHIPS[0].type); setPlaceError(""); }}
                  disabled={myReady || fleet.length === 0}
                  className="btn-secondary"
                  type="button"
                >
                  Clear
                </button>
              </div>

              {/* Ship tray */}
              {!myReady && (
                <ShipTray
                  ships={unplacedShips}
                  orientation={orientation}
                  selected={selected}
                  onSelect={(type) => { setSelected(type); setPlaceError(""); }}
                />
              )}

              {/* Placed ships list */}
              {fleet.length > 0 && !myReady && (
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <p style={{
                    fontFamily: "var(--serif)",
                    fontVariant: "small-caps",
                    fontSize: "10px",
                    letterSpacing: "0.2em",
                    color: "var(--gold-hi)",
                    opacity: 0.6,
                  }}>Placed</p>
                  {fleet.map((ship) => (
                    <div key={ship.type} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{
                        fontFamily: "var(--serif)",
                        fontVariant: "small-caps",
                        fontSize: "12px",
                        color: "var(--bone)",
                        opacity: 0.8,
                        textTransform: "capitalize",
                      }}>{ship.type}</span>
                      <button
                        onClick={() => removeShip(ship.type)}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          fontFamily: "var(--mono)",
                          fontSize: "12px",
                          color: "rgba(246,180,150,0.9)",
                          padding: "8px 10px",
                          minHeight: 44,
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--copper)")}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(163,68,30,0.7)")}
                      >
                        remove
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Confirm placement */}
              {placeError && (
                <p role="alert" style={{
                  fontFamily: "var(--sans)",
                  fontSize: "13px",
                  color: "#ffb4a8",
                  margin: 0,
                }}>{placeError}</p>
              )}
              <p style={{
                fontFamily: "var(--mono)",
                fontSize: "12px",
                color: "rgba(246,239,224,0.7)",
                margin: 0,
              }}>{fleet.length} of 5 ships placed{selected ? ` · ${selected} selected` : ""}</p>

              <button
                onClick={handleConfirm}
                disabled={!allPlaced || myReady}
                className="btn-primary"
                style={{ width: "100%", minHeight: 48 }}
                data-testid="confirm-fleet"
              >
                {myReady ? "Waiting for opponent…" : allPlaced ? "Confirm fleet" : "Place all 5 ships"}
              </button>

              {myReady && opponentReady && (
                <p style={{
                  fontFamily: "var(--serif)",
                  fontVariant: "small-caps",
                  fontSize: "12px",
                  textAlign: "center",
                  color: "var(--gold-hi)",
                  letterSpacing: "0.16em",
                }}>
                  All hands ready — Battle stations!
                </p>
              )}
              {myReady && !opponentReady && (
                <p style={{
                  fontFamily: "var(--serif)",
                  fontStyle: "italic",
                  fontSize: "11px",
                  textAlign: "center",
                  color: "rgba(246,239,224,0.35)",
                }}>
                  Opponent is still placing ships...
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {draggingType && (
          <ShipSvg
            type={draggingType}
            orientation={orientation}
            cellSize={cellSize}
          />
        )}
      </DragOverlay>
    </DndContext>
  );
}
