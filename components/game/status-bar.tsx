"use client"

import { FACTIONS_BY_ID, SYSTEMS_BY_ID } from "@/lib/game/data"
import { cargoUsed, combatRating, repLabel } from "@/lib/game/engine"
import type { GameState } from "@/lib/game/types"
import { StatBar, StatChip } from "./ui"

export function StatusBar({ state }: { state: GameState }) {
  const system = SYSTEMS_BY_ID[state.currentSystemId]
  const dest = state.voyage ? SYSTEMS_BY_ID[state.voyage.destinationId] : null
  const used = cargoUsed(state.cargo)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
            Hypernova <span className="text-primary">ZERO</span>
          </h1>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            {dest ? (
              <>
                In transit · <span className="text-accent">{system.name}</span> {"->"}{" "}
                <span className="text-accent">{dest.name}</span>
              </>
            ) : (
              <>
                Docked: <span className="text-accent">{system.name}</span> · {system.government}
            {" · "}
            <span style={{ color: FACTIONS_BY_ID[system.factionId]?.color }}>
              {FACTIONS_BY_ID[system.factionId]?.name}
            </span>
            {" · "}
            <span className="text-muted-foreground">{repLabel(state.factionRep[system.factionId] ?? 0)}</span>
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatChip label="Credits" value={`${state.credits.toLocaleString()} cr`} tone="primary" />
          <StatChip label="Rating" value={combatRating(state.destroyedShips)} tone="accent" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-md border border-border bg-card px-3 py-2">
          <StatBar label="Hull" value={state.ship.hull} max={state.ship.maxHull} tone="destructive" />
        </div>
        <div className="rounded-md border border-border bg-card px-3 py-2">
          <StatBar label="Shields" value={state.ship.shield} max={state.ship.maxShield} tone="accent" />
        </div>
        <div className="rounded-md border border-border bg-card px-3 py-2">
          <StatBar label="Fuel (ly)" value={state.ship.fuel} max={state.ship.maxFuel} tone="success" />
        </div>
        <div className="rounded-md border border-border bg-card px-3 py-2">
          <StatBar label="Cargo (t)" value={used} max={state.ship.cargoCapacity} tone="primary" />
        </div>
      </div>
    </div>
  )
}
