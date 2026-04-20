import type { ShipType, Orientation } from "~/domain/types";
import { getShipSize } from "~/domain/board";

interface ShipSvgProps {
  type: ShipType;
  orientation: Orientation;
  cellSize: number;
  sunk?: boolean;
  className?: string;
}

// Tabledeck Battleship palette: navy hull, bone deck stripe, gold portholes
const SHIP_COLORS = {
  live: {
    body:    "#17294b",  // navy-mid hull
    stroke:  "#0f1d33",  // navy outline
    deck:    "#f6efe0",  // bone deck stripe
    porthole: "#c9a24a", // gold portholes
    rivet:   "#0c1828",  // dark rivet
  },
  sunk: {
    body:    "#3a4a5e",  // desaturated steel
    stroke:  "#2a3848",
    deck:    "#6a7080",
    porthole: "#5a6070",
    rivet:   "#2a3040",
  },
};

export function ShipSvg({ type, orientation, cellSize, sunk = false, className }: ShipSvgProps) {
  const size = getShipSize(type);
  const isH = orientation === "h";

  const totalW = isH ? cellSize * size : cellSize;
  const totalH = isH ? cellSize : cellSize * size;

  const margin = cellSize * 0.08;
  const bodyW = totalW - margin * 2;
  const bodyH = totalH - margin * 2;
  const rx = Math.min(bodyW, bodyH) * 0.28;

  const colors = sunk ? SHIP_COLORS.sunk : SHIP_COLORS.live;

  // Portholes
  const numPortholes = Math.max(1, size - 1);
  const portholeRadius = cellSize * 0.1;

  const portholes: { x: number; y: number }[] = [];
  for (let i = 0; i < numPortholes; i++) {
    if (isH) {
      portholes.push({
        x: margin + cellSize * (i + 0.6),
        y: totalH / 2,
      });
    } else {
      portholes.push({
        x: totalW / 2,
        y: margin + cellSize * (i + 0.6),
      });
    }
  }

  // Rivets along hull (2 or 3 per long edge)
  const rivetRadius = cellSize * 0.055;
  const rivets: { x: number; y: number }[] = [];
  const rivetCount = Math.min(4, size + 1);
  for (let i = 0; i < rivetCount; i++) {
    const t = (i + 1) / (rivetCount + 1);
    if (isH) {
      rivets.push({ x: margin + bodyW * t, y: margin + rivetRadius * 1.5 });
      rivets.push({ x: margin + bodyW * t, y: margin + bodyH - rivetRadius * 1.5 });
    } else {
      rivets.push({ x: margin + rivetRadius * 1.5, y: margin + bodyH * t });
      rivets.push({ x: margin + bodyW - rivetRadius * 1.5, y: margin + bodyH * t });
    }
  }

  // Deck stripe
  const bowSize = Math.min(bodyW, bodyH) * 0.3;
  const deckStripeOpacity = 0.45;

  return (
    <svg
      width={totalW}
      height={totalH}
      viewBox={`0 0 ${totalW} ${totalH}`}
      className={className}
      style={{ display: "block" }}
    >
      {/* Drop shadow */}
      <rect
        x={margin + 1.5}
        y={margin + 1.5}
        width={bodyW}
        height={bodyH}
        rx={rx}
        fill="rgba(0,0,0,0.35)"
      />
      {/* Hull */}
      <rect
        x={margin}
        y={margin}
        width={bodyW}
        height={bodyH}
        rx={rx}
        fill={colors.body}
        stroke={colors.stroke}
        strokeWidth={1}
      />
      {/* Deck stripe (bone) */}
      {isH ? (
        <rect
          x={margin + bowSize}
          y={margin + bodyH * 0.22}
          width={bodyW - bowSize * 1.4}
          height={bodyH * 0.56}
          rx={rx * 0.25}
          fill={colors.deck}
          opacity={deckStripeOpacity}
        />
      ) : (
        <rect
          x={margin + bodyW * 0.22}
          y={margin + bowSize}
          width={bodyW * 0.56}
          height={bodyH - bowSize * 1.4}
          rx={rx * 0.25}
          fill={colors.deck}
          opacity={deckStripeOpacity}
        />
      )}
      {/* Gold portholes */}
      {portholes.map((p, i) => (
        <g key={i}>
          <circle
            cx={p.x}
            cy={p.y}
            r={portholeRadius}
            fill={colors.porthole}
            opacity={0.9}
          />
          <circle
            cx={p.x - portholeRadius * 0.3}
            cy={p.y - portholeRadius * 0.3}
            r={portholeRadius * 0.35}
            fill="rgba(255,255,255,0.4)"
          />
        </g>
      ))}
      {/* Rivets */}
      {rivets.map((r, i) => (
        <circle
          key={`rv-${i}`}
          cx={r.x}
          cy={r.y}
          r={rivetRadius}
          fill={colors.rivet}
          opacity={0.7}
        />
      ))}
      {/* Submarine conning tower */}
      {type === "submarine" && (
        <rect
          x={isH ? margin + cellSize * 0.3 : margin + bodyW * 0.3}
          y={isH ? margin : margin + bodyH * 0.05}
          width={isH ? cellSize * 0.35 : bodyW * 0.4}
          height={isH ? bodyH * 0.5 : cellSize * 0.35}
          rx={rivetRadius * 2}
          fill={colors.body}
          stroke={colors.stroke}
          strokeWidth={0.8}
        />
      )}
      {/* Sunk: red diagonal strike */}
      {sunk && (
        <>
          <line
            x1={margin}
            y1={margin}
            x2={margin + bodyW}
            y2={margin + bodyH}
            stroke="#c8372a"
            strokeWidth={Math.max(2, cellSize * 0.1)}
            strokeLinecap="round"
            opacity={0.75}
          />
          <line
            x1={margin + bodyW}
            y1={margin}
            x2={margin}
            y2={margin + bodyH}
            stroke="#c8372a"
            strokeWidth={Math.max(2, cellSize * 0.1)}
            strokeLinecap="round"
            opacity={0.75}
          />
        </>
      )}
    </svg>
  );
}
