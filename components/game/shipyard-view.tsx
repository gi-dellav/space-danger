"use client"

import { Button } from "@/components/ui/button"
import { SYSTEMS_BY_ID, UPGRADES } from "@/lib/game/data"
import type { Action } from "@/lib/game/engine"
import type { GameState } from "@/lib/game/types"
import { cn } from "@/lib/utils"
import { Panel } from "./ui"

export function ShipyardView({
  state,
  dispatch,
}: {
  state: GameState
  dispatch: (a: Action) => void
}) {
  const system = SYSTEMS_BY_ID[state.currentSystemId]
  const fuelMissing = state.ship.maxFuel - state.ship.fuel
  const hullMissing = state.ship.maxHull - state.ship.hull
  const refuelCost = fuelMissing * 20
  const repairCost = hullMissing * 12

  return (
    <div className="flex flex-col gap-4">
      <Panel title="Station Services">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-center justify-between rounded-md border border-border/60 bg-secondary/40 p-3">
            <div>
              <p className="text-sm text-foreground">Refuel</p>
              <p className="text-xs text-muted-foreground">
                {fuelMissing > 0 ? `Fill ${fuelMissing} ly · ${refuelCost} cr` : "Tanks full"}
              </p>
            </div>
            <Button
              size="sm"
              variant="secondary"
              disabled={fuelMissing <= 0}
              onClick={() => dispatch({ type: "REFUEL" })}
            >
              Refuel
            </Button>
          </div>
          <div className="flex items-center justify-between rounded-md border border-border/60 bg-secondary/40 p-3">
            <div>
              <p className="text-sm text-foreground">Repair Hull</p>
              <p className="text-xs text-muted-foreground">
                {hullMissing > 0 ? `Restore ${hullMissing} hull · ${repairCost} cr` : "Hull intact"}
              </p>
            </div>
            <Button
              size="sm"
              variant="secondary"
              disabled={hullMissing <= 0}
              onClick={() => dispatch({ type: "REPAIR" })}
            >
              Repair
            </Button>
          </div>
        </div>
      </Panel>

      <Panel
        title="Outfitting"
        right={
          <span className="text-[0.7rem] uppercase tracking-wider text-muted-foreground">
            Tech Level {system.techLevel}
          </span>
        }
      >
        <ul className="flex flex-col gap-2">
          {UPGRADES.map((u) => {
            const lockedTech = system.techLevel < u.minTechLevel
            const tooPoor = state.credits < u.cost
            const disabled = lockedTech || tooPoor
            return (
              <li
                key={u.id}
                className="flex flex-col gap-2 rounded-md border border-border/60 bg-secondary/40 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm text-foreground">{u.name}</p>
                  <p className="text-xs text-muted-foreground">{u.description}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span
                    className={cn(
                      "text-sm tabular-nums",
                      tooPoor ? "text-destructive" : "text-primary",
                    )}
                  >
                    {u.cost.toLocaleString()} cr
                  </span>
                  <Button
                    size="sm"
                    disabled={disabled}
                    onClick={() => dispatch({ type: "BUY_UPGRADE", upgradeId: u.id })}
                    className="h-8"
                  >
                    {lockedTech ? `Tech ${u.minTechLevel}` : "Install"}
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      </Panel>
    </div>
  )
}
