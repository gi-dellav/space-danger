"use client"

import { Button } from "@/components/ui/button"
import { SYSTEMS_BY_ID } from "@/lib/game/data"
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

export function TransitView({
  state,
  dispatch,
}: {
  state: GameState
  dispatch: (a: Action) => void
}) {
  const v = state.voyage
  if (!v) return null
  const dest = SYSTEMS_BY_ID[v.destinationId]
  const legsLeft = v.legsTotal - v.legsDone
  const outOfFuel = state.ship.fuel < 1
  const isExploration = v.exploration !== undefined
  const origin = v.originSystemId ? SYSTEMS_BY_ID[v.originSystemId] : dest

  const title = v.exploration === "ambush"
    ? "On Patrol — Hunting Pirates"
    : v.exploration === "asteroids"
    ? "Prospecting — Mining Run"
    : "In Transit — Command Phase"

  const progressLabel = v.exploration === "ambush"
    ? "Sweep"
    : v.exploration === "asteroids"
    ? "Sector"
    : "Progress"

  const flavorText = v.exploration === "ambush"
    ? (legsLeft > 1 ? `${legsLeft} sweeps remaining — scanning for prey in deep space.` : `Final sweep — one more pass before returning to ${origin.name}.`)
    : v.exploration === "asteroids"
    ? (legsLeft > 1 ? `${legsLeft} sectors remaining — hunting for rich ore deposits.` : `Final sector — one more scan before returning to ${origin.name}.`)
    : (legsLeft > 1
      ? `${legsLeft} legs remaining. The next jump enters ${dest.name} space.`
      : `Final leg — the next jump docks you at ${dest.name}.`)

  const destLabel = isExploration ? `Returning to ${origin.name}` : dest.name
  const destDetail = isExploration
    ? `Patrol from ${origin.name}`
    : `${dest.id === "riedquat" ? "Casino" : dest.economy} · Tech ${dest.techLevel} · ` +
      `${DANGER_LABEL[dest.danger]} space`

  const abortLabel = isExploration ? "Abort & Return" : "Abort Voyage"

  return (
    <Panel
      title={title}
      right={
        <span className="text-[0.7rem] uppercase tracking-wider text-muted-foreground">
          Fuel: <span className="text-foreground">{state.ship.fuel} ly</span>
        </span>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="rounded-md border border-border/60 bg-secondary/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[0.7rem] uppercase tracking-wider text-muted-foreground">
                {isExploration ? "Base" : "Destination"}
              </p>
              <p className="font-heading text-lg font-semibold text-accent">{destLabel}</p>
              <p className="text-xs text-muted-foreground">
                {isExploration ? (
                  destDetail
                ) : (
                  <>
                    {dest.id === "riedquat" ? "Casino" : dest.economy} · Tech {dest.techLevel} ·{" "}
                    <span className={cn("uppercase", DANGER_TONE[dest.danger])}>
                      {DANGER_LABEL[dest.danger]} space
                    </span>
                  </>
                )}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[0.7rem] uppercase tracking-wider text-muted-foreground">
                {progressLabel}
              </p>
              <p className="font-heading text-lg font-semibold tabular-nums text-foreground">
                {v.legsDone}/{v.legsTotal}
              </p>
            </div>
          </div>

          {/* Leg pips */}
          <div className="mt-3 flex gap-1.5" aria-hidden="true">
            {Array.from({ length: v.legsTotal }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-2 flex-1 rounded-full",
                  i < v.legsDone ? "bg-success" : "bg-secondary",
                )}
              />
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {flavorText}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Button disabled={outOfFuel} onClick={() => dispatch({ type: "ADVANCE" })}>
            Engage Drive (1 ly)
          </Button>
          <Button
            variant="secondary"
            disabled={state.ship.fuel < 2}
            onClick={() => dispatch({ type: "RUN_SILENT" })}
          >
            Run Silent (2 ly)
          </Button>
          <Button variant="outline" onClick={() => dispatch({ type: "ABORT" })}>
            {abortLabel}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          <span className="text-foreground">Engage</span> advances one leg and may trigger a contact.{" "}
          <span className="text-foreground">Run Silent</span> burns extra fuel to slip past most
          threats. <span className="text-foreground">Abort</span> limps back to base.
        </p>
      </div>
    </Panel>
  )
}
