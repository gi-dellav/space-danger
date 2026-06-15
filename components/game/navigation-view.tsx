"use client"

import { Button } from "@/components/ui/button"
import { SYSTEMS, SYSTEMS_BY_ID } from "@/lib/game/data"
import { legsFor } from "@/lib/game/engine"
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
    .map((s) => ({ system: s, legs: legsFor(current, s) }))
    .sort((a, b) => a.legs - b.legs)

  return (
    <Panel
      title="Set Course"
      right={
        <span className="text-[0.7rem] uppercase tracking-wider text-muted-foreground">
          Fuel: <span className="text-foreground">{state.ship.fuel} ly</span>
        </span>
      }
    >
      <p className="mb-3 text-xs text-muted-foreground">
        Each voyage is run one leg per turn — every leg burns 1 ly and may spring an encounter.
        Choose a destination to plot your course, or lay over to wait out the local market.
      </p>

      <ul className="flex flex-col gap-2">
        {destinations.map(({ system, legs }) => {
          const reachable = legs <= state.ship.fuel
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
                  {legs} ly
                </span>
                <Button
                  size="sm"
                  disabled={!reachable}
                  onClick={() => dispatch({ type: "DEPART", systemId: system.id })}
                  className="h-8"
                >
                  {reachable ? "Depart" : "No fuel"}
                </Button>
              </div>
            </li>
          )
        })}
      </ul>

      <div className="mt-4 flex items-center justify-between gap-3 rounded-md border border-border/60 bg-secondary/40 p-3">
        <div className="min-w-0">
          <p className="font-heading text-sm font-semibold text-foreground">Lay Over</p>
          <p className="text-xs text-muted-foreground">
            Spend a turn docked at {current.name}. Markets shift and prices reset. <span className="text-foreground">150 cr</span>
          </p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          className="h-8 shrink-0"
          disabled={state.credits < 150}
          onClick={() => dispatch({ type: "LAYOVER" })}
        >
          {state.credits < 150 ? "Can't afford" : "Pass Turn"}
        </Button>
      </div>
    </Panel>
  )
}
