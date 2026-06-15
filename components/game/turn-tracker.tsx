"use client"

import { SYSTEMS_BY_ID } from "@/lib/game/data"
import type { GameState } from "@/lib/game/types"
import { cn } from "@/lib/utils"

const STEPS = ["Move", "Event", "Resolve", "End Turn"] as const

// Which step of the turn cycle the current phase maps to.
function activeStep(phase: GameState["phase"]): number {
  switch (phase) {
    case "command":
      return 0
    case "event":
      return 1
    case "combat":
      return 2
    case "summary":
      return 3
    default:
      return 0
  }
}

export function TurnTracker({ state }: { state: GameState }) {
  const active = activeStep(state.phase)
  const v = state.voyage
  const dest = v ? SYSTEMS_BY_ID[v.destinationId] : null

  return (
    <section className="rounded-md border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-2">
        <div className="flex items-baseline gap-2">
          <span className="text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">
            Turn
          </span>
          <span className="font-heading text-2xl font-bold tabular-nums text-primary">
            {state.turn}
          </span>
        </div>
        <div className="text-right text-xs">
          {dest ? (
            <span className="uppercase tracking-wider text-muted-foreground">
              Voyage:{" "}
              <span className="text-accent">{dest.name}</span>{" "}
              <span className="tabular-nums text-foreground">
                — leg {Math.min(v!.legsDone, v!.legsTotal)}/{v!.legsTotal}
              </span>
            </span>
          ) : (
            <span className="uppercase tracking-wider text-muted-foreground">
              Status: <span className="text-success">Docked</span>
            </span>
          )}
        </div>
      </div>

      <ol className="flex items-stretch gap-1 p-2" aria-label="Turn cycle">
        {STEPS.map((step, i) => {
          const done = i < active
          const current = i === active
          return (
            <li key={step} className="flex flex-1 items-center gap-1">
              <div
                className={cn(
                  "flex w-full flex-col items-center gap-1 rounded-sm border px-2 py-2 text-center transition-colors",
                  current
                    ? "border-primary bg-primary/10"
                    : done
                      ? "border-border bg-secondary/40"
                      : "border-border/50 bg-transparent",
                )}
              >
                <span
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full text-[0.65rem] font-bold tabular-nums",
                    current
                      ? "bg-primary text-primary-foreground"
                      : done
                        ? "bg-success/80 text-background"
                        : "bg-secondary text-muted-foreground",
                  )}
                >
                  {done ? "✓" : i + 1}
                </span>
                <span
                  className={cn(
                    "text-[0.6rem] font-semibold uppercase tracking-wider sm:text-[0.7rem]",
                    current ? "text-primary" : done ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {step}
                </span>
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
