import type { GameStatus } from "../app/domain/types";

/**
 * Mirror the Durable Object phase onto the D1 Game row that Tabledeck's
 * weekly stats read.
 *
 * D1 only has waiting | active | finished. The match leaves "waiting" when
 * both seats are filled and play begins (guessing), so that is persisted as
 * active. A normal win or a forfeit is persisted as finished with finishedAt.
 * Winner score is 1 so profile win-rate (which compares scores) is not a tie
 * at 0–0.
 */
export async function syncGameStatusToD1(
  db: D1Database,
  gameId: string,
  status: GameStatus,
  winner: number | null,
): Promise<void> {
  if (status === "finished") {
    await db
      .prepare(
        `UPDATE Game
         SET status = 'finished',
             finishedAt = COALESCE(finishedAt, datetime('now'))
         WHERE id = ?`,
      )
      .bind(gameId)
      .run();
    if (winner !== null) {
      await db
        .prepare(
          `UPDATE GamePlayer
           SET score = CASE WHEN seat = ? THEN 1 ELSE 0 END
           WHERE gameId = ?`,
        )
        .bind(winner, gameId)
        .run();
    }
    return;
  }

  // guessing, placing, and the shooting phase are all "the game has started".
  if (status === "guessing" || status === "placing" || status === "active") {
    await db
      .prepare(`UPDATE Game SET status = 'active' WHERE id = ? AND status = 'waiting'`)
      .bind(gameId)
      .run();
  }
}
