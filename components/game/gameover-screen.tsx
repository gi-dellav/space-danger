"use client"

import { Button } from "@/components/ui/button"
import { combatRating } from "@/lib/game/engine"
import type { GameState } from "@/lib/game/types"
import { StatChip } from "./ui"

export function GameOverScreen({
  state,
  onRestart,
}: {
  state: GameState
  onRestart: () => void
}) {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="crt-scanlines w-full max-w-lg rounded-lg border border-destructive/50 bg-card p-8 text-center">
        <p className="text-xs uppercase tracking-[0.4em] text-destructive">Signal Lost</p>
        <h1 className="mt-3 font-heading text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          SHIP DESTROYED
        </h1>
        <p className="mx-auto mt-4 max-w-sm text-pretty leading-relaxed text-muted-foreground">
          Your ship was torn apart and your career as a trader ends here, scattered across the void.
        </p>

        <div className="mt-6 grid grid-cols-3 gap-2">
          <StatChip label="Credits" value={state.credits.toLocaleString()} tone="primary" />
          <StatChip label="Kills" value={state.destroyedShips} tone="accent" />
          <StatChip label="Turns" value={state.turn} />
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Final rank: <span className="text-accent">{combatRating(state.destroyedShips)}</span>
        </p>

        <Button size="lg" className="mt-8" onClick={onRestart}>
          New Career
        </Button>
      </div>
    </div>
  )
}
