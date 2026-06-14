"use client"

import { Button } from "@/components/ui/button"
import { SYSTEMS, SYSTEMS_BY_ID } from "@/lib/game/data"
import { distanceBetween, fuelCost } from "@/lib/game/engine"
import type { Action } from "@/lib/game/engine"
import type { GameState } from "@/lib/game/types"
import { cn } from "@/lib/utils"
import { Panel } from "./ui"

const DANGER_LABEL = ["Safe", "Low", "Moderate", "High", "Anarchy"]
const DANGER_TONE = [
  "text-success",
  "text-success",
  "text-primary",
  "text-destructive",
  "text-destructive",
]

export function NavigationView({
  state,
  dispatch,
}: {
  state: GameState
  dispatch: (a: Action) => void
}) {
  const current = SYSTEMS_BY_ID[state.currentSystemId]
  const destinations = SYSTEMS.filter((s) => s.id !== current.id)
    .map((s) => ({
      system: s,
      dist: distanceBetween(current, s),
      cost: fuelCost(current, s),
    }))
    .sort((a, b) => a.dist - b.dist)

  return (
    <Panel
      title="Galaxy Navigation"
      right={
        <span className="text-[0.7rem] uppercase tracking-wider text-muted-foreground">
          Range: <span className="text-foreground">{state.ship.fuel} ly</span>
        </span>
      }
    >
      <ul className="flex flex-col gap-2">
        {destinations.map(({ system, cost }) => {
          const reachable = cost <= state.ship.fuel
          return (
            <li
              key={system.id}
              className="flex flex-col gap-2 rounded-md border border-border/60 bg-secondary/40 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2">
                  <span className="font-heading font-semibold text-foreground">{system.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {system.economy} · Tech {system.techLevel}
                  </span>
                  <span className={cn("text-xs uppercase tracking-wide", DANGER_TONE[system.danger])}>
                    {DANGER_LABEL[system.danger]}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{system.description}</p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span
                  className={cn(
                    "text-xs tabular-nums",
                    reachable ? "text-accent" : "text-destructive",
                  )}
                >
                  {cost} ly
                </span>
                <Button
                  size="sm"
                  disabled={!reachable}
                  onClick={() => dispatch({ type: "JUMP", systemId: system.id })}
                  className="h-8"
                >
                  {reachable ? "Jump" : "No fuel"}
                </Button>
              </div>
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}
