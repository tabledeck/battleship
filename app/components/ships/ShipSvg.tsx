import type { ShipType, Orientation } from "~/domain/types";
import { getShipSize } from "~/domain/board";

interface ShipSvgProps {
  type: ShipType;
  orientation: Orientation;
  cellSize: number;
  sunk?: boolean;
  className?: string;
}

const SHIP_COLORS: Record<ShipType, { body: string; accent: string; detail: string }> = {
  carrier:    { body: "#334155", accent: "#475569", detail: "#64748b" },
  battleship: { body: "#1e3a5f", accent: "#2d5a8e", detail: "#3b7cbf" },
  cruiser:    { body: "#1e3a5f", accent: "#2d5a8e", detail: "#60a5fa" },
  submarine:  { body: "#14432a", accent: "#1a5c38", detail: "#22c55e" },
  destroyer:  { body: "#3f3f46", accent: "#52525b", detail: "#a1a1aa" },
};

const SUNK_COLORS = { body: "#7f1d1d", accent: "#991b1b", detail: "#ef4444" };

export function ShipSvg({ type, orientation, cellSize, sunk = false, className }: ShipSvgProps) {
  const size = getShipSize(type);
  const isH = orientation === "h";

  const totalW = isH ? cellSize * size : cellSize;
  const totalH = isH ? cellSize : cellSize * size;

  const margin = cellSize * 0.06;
  const bodyW = totalW - margin * 2;
  const bodyH = totalH - margin * 2;
  const rx = Math.min(bodyW, bodyH) * 0.3;

  const colors = sunk ? SUNK_COLORS : SHIP_COLORS[type];

  // Portholes / details
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

  // Bow (pointed end) at the front
  const bowSize = Math.min(bodyW, bodyH) * 0.35;

  return (
    <svg
      width={totalW}
      height={totalH}
      viewBox={`0 0 ${totalW} ${totalH}`}
      className={className}
      style={{ display: "block" }}
    >
      {/* Shadow */}
      <rect
        x={margin + 1}
        y={margin + 1}
        width={bodyW}
        height={bodyH}
        rx={rx}
        fill="rgba(0,0,0,0.4)"
      />
      {/* Hull */}
      <rect
        x={margin}
        y={margin}
        width={bodyW}
        height={bodyH}
        rx={rx}
        fill={colors.body}
        stroke={colors.accent}
        strokeWidth={1}
      />
      {/* Deck stripe */}
      {isH ? (
        <rect
          x={margin + bowSize}
          y={margin + bodyH * 0.2}
          width={bodyW - bowSize * 1.5}
          height={bodyH * 0.6}
          rx={rx * 0.3}
          fill={colors.accent}
          opacity={0.5}
        />
      ) : (
        <rect
          x={margin + bodyW * 0.2}
          y={margin + bowSize}
          width={bodyW * 0.6}
          height={bodyH - bowSize * 1.5}
          rx={rx * 0.3}
          fill={colors.accent}
          opacity={0.5}
        />
      )}
      {/* Portholes */}
      {portholes.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={portholeRadius}
          fill={colors.detail}
          opacity={0.8}
        />
      ))}
      {/* Submarine periscope */}
      {type === "submarine" && (
        <circle
          cx={isH ? margin + cellSize * 0.5 : totalW / 2}
          cy={isH ? totalH / 2 : margin + cellSize * 0.5}
          r={cellSize * 0.14}
          fill={colors.detail}
          stroke={colors.accent}
          strokeWidth={1}
        />
      )}
    </svg>
  );
}
