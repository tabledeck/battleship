import { useEffect, useState } from "react";

/**
 * Fit a 10×10 board into the viewport without CSS scaling.
 * Scaling made phone cells ~17px and left a huge empty gap.
 * One board is shown below 900px, so the cells can stay tappable.
 */
export function useCellSize() {
  const [size, setSize] = useState(28);

  useEffect(() => {
    const compute = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const narrow = w < 900;
      const boards = narrow ? 1 : 2;
      // Placement is the tighter case: page padding, card padding, frame,
      // row-number gutter, and the grid border all sit outside the 10 cells.
      // Battle omits the card, so sizing for placement also fits the fight.
      const outer = narrow ? 52 : 24;
      const gap = narrow ? 0 : 24;
      const frameAndGutter = narrow ? 40 : 52;
      const byW = Math.floor(((w - outer - gap) / boards - frameAndGutter) / 10);
      // Short landscape phones scroll a little rather than shrinking cells
      // down to the point they can't be tapped.
      const max = h < 520 ? 32 : 40;
      const next = Math.max(26, Math.min(max, byW));
      setSize(Number.isFinite(next) ? next : 28);
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);

  return size;
}
