"use client"

import { Button } from "@/components/ui/button"
import type { Action } from "@/lib/game/engine"
import type { GameState } from "@/lib/game/types"
import { Panel, StatBar } from "./ui"

export function CombatView({
  state,
  dispatch,
}: {
  state: GameState
  dispatch: (a: Action) => void
}) {
  const enemy = state.enemy
  if (!enemy) return null

  return (
    <Panel title="Combat — Red Alert" className="mx-auto w-full max-w-2xl">
      <div className="flex flex-col gap-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-3 rounded-md border border-destructive/40 bg-secondary/40 p-4">
            <div className="flex items-center justify-between">
              <span className="font-heading font-semibold text-destructive">Hostile</span>
              <span className="text-xs uppercase tracking-wider text-muted-foreground">
                {enemy.name}
              </span>
            </div>
            <StatBar label="Hull" value={enemy.hull} max={enemy.maxHull} tone="destructive" />
            <StatBar label="Shields" value={enemy.shield} max={enemy.maxShield} tone="accent" />
            <p className="text-xs text-muted-foreground">
              Threat output ~{enemy.damage} dmg · Bounty {enemy.bounty.toLocaleString()} cr
            </p>
          </div>

          <div className="flex flex-col gap-3 rounded-md border border-border bg-secondary/40 p-4">
            <div className="flex items-center justify-between">
              <span className="font-heading font-semibold text-primary">Your Ship</span>
              {state.playerEvading && (
                <span className="text-xs uppercase tracking-wider text-accent">evading</span>
              )}
            </div>
            <StatBar label="Hull" value={state.ship.hull} max={state.ship.maxHull} tone="destructive" />
            <StatBar label="Shields" value={state.ship.shield} max={state.ship.maxShield} tone="accent" />
            <p className="text-xs text-muted-foreground">
              Laser ~{state.ship.weaponDamage} dmg · Missiles {state.ship.missiles}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Button onClick={() => dispatch({ type: "COMBAT_ACTION", action: "fire" })}>
            Fire Lasers
          </Button>
          <Button
            variant="secondary"
            disabled={state.ship.missiles <= 0}
            onClick={() => dispatch({ type: "COMBAT_ACTION", action: "missile" })}
          >
            Missile ({state.ship.missiles})
          </Button>
          <Button
            variant="secondary"
            onClick={() => dispatch({ type: "COMBAT_ACTION", action: "evade" })}
          >
            Evade
          </Button>
          <Button
            variant="outline"
            onClick={() => dispatch({ type: "COMBAT_ACTION", action: "flee" })}
          >
            Flee
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Fire to deal damage, launch a missile for a heavy hit, evade to dodge the next volley and
          recharge shields, or attempt to flee into hyperspace.
        </p>
      </div>
    </Panel>
  )
}
