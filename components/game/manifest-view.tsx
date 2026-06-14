"use client"

import { GOODS_BY_ID } from "@/lib/game/data"
import { cargoUsed } from "@/lib/game/engine"
import type { GameState } from "@/lib/game/types"
import { Panel } from "./ui"

export function ManifestView({ state }: { state: GameState }) {
  const entries = Object.entries(state.cargo).filter(([, qty]) => qty > 0)
  const used = cargoUsed(state.cargo)

  return (
    <div className="flex flex-col gap-4">
      <Panel
        title="Cargo Manifest"
        right={
          <span className="text-[0.7rem] uppercase tracking-wider text-muted-foreground">
            {used} / {state.ship.cargoCapacity} t
          </span>
        }
      >
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">Cargo hold is empty.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {entries.map(([id, qty]) => {
              const good = GOODS_BY_ID[id]
              return (
                <li
                  key={id}
                  className="flex items-center justify-between border-b border-border/40 py-1.5 text-sm last:border-0"
                >
                  <span className="text-foreground">
                    {good.name}
                    {good.illegal && (
                      <span className="ml-2 rounded-sm border border-destructive/60 px-1 text-[0.6rem] uppercase tracking-wider text-destructive">
                        illegal
                      </span>
                    )}
                  </span>
                  <span className="tabular-nums text-accent">{qty} t</span>
                </li>
              )
            })}
          </ul>
        )}
      </Panel>

      <Panel title="Ship Specifications">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <SpecRow label="Max Hull" value={state.ship.maxHull} />
          <SpecRow label="Max Shields" value={state.ship.maxShield} />
          <SpecRow label="Laser Damage" value={state.ship.weaponDamage} />
          <SpecRow label="Missiles" value={state.ship.missiles} />
          <SpecRow label="Cargo Capacity" value={`${state.ship.cargoCapacity} t`} />
          <SpecRow label="Jump Range" value={`${state.ship.maxFuel} ly`} />
        </dl>
      </Panel>
    </div>
  )
}

function SpecRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-border/40 py-1.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums text-foreground">{value}</dd>
    </div>
  )
}
