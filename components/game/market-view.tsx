"use client"

import { Button } from "@/components/ui/button"
import { GOODS_BY_ID, SYSTEMS_BY_ID } from "@/lib/game/data"
import { cargoUsed } from "@/lib/game/engine"
import type { Action } from "@/lib/game/engine"
import type { GameState } from "@/lib/game/types"
import { cn } from "@/lib/utils"
import { Panel } from "./ui"

export function MarketView({
  state,
  dispatch,
}: {
  state: GameState
  dispatch: (a: Action) => void
}) {
  const system = SYSTEMS_BY_ID[state.currentSystemId]
  const free = state.ship.cargoCapacity - cargoUsed(state.cargo)

  return (
    <Panel
      title={`${system.name} Commodity Market`}
      right={
        <span className="text-[0.7rem] uppercase tracking-wider text-muted-foreground">
          {system.economy} · Hold free: <span className="text-foreground">{free}t</span>
        </span>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-left text-[0.65rem] uppercase tracking-wider text-muted-foreground">
              <th className="pb-2 pr-2 font-medium">Commodity</th>
              <th className="pb-2 px-2 text-right font-medium">Price</th>
              <th className="pb-2 px-2 text-right font-medium">Avail.</th>
              <th className="pb-2 px-2 text-right font-medium">Held</th>
              <th className="pb-2 pl-2 text-right font-medium">Trade</th>
            </tr>
          </thead>
          <tbody>
            {state.market.map((m) => {
              const good = GOODS_BY_ID[m.goodId]
              const held = state.cargo[m.goodId] ?? 0
              const canBuy = m.quantity > 0 && state.credits >= m.price && free > 0
              const canSell = held > 0
              return (
                <tr key={m.goodId} className="border-t border-border/60">
                  <td className="py-2 pr-2">
                    <span className="text-foreground">{good.name}</span>
                    {good.illegal && (
                      <span className="ml-2 rounded-sm border border-destructive/60 px-1 text-[0.6rem] uppercase tracking-wider text-destructive">
                        illegal
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-primary">
                    {m.price.toLocaleString()}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">
                    {m.quantity}
                  </td>
                  <td
                    className={cn(
                      "px-2 py-2 text-right tabular-nums",
                      held > 0 ? "text-accent" : "text-muted-foreground",
                    )}
                  >
                    {held}
                  </td>
                  <td className="py-2 pl-2">
                    <div className="flex justify-end gap-1.5">
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={!canBuy}
                        onClick={() => dispatch({ type: "BUY", goodId: m.goodId, qty: 1 })}
                        className="h-7 px-2 text-xs"
                      >
                        Buy
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!canSell}
                        onClick={() => dispatch({ type: "SELL", goodId: m.goodId, qty: held })}
                        className="h-7 px-2 text-xs"
                      >
                        Sell all
                      </Button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Buy low where goods are produced, sell high where they&apos;re in demand. Contraband
        fetches a premium on high-tech worlds — if the police don&apos;t catch you.
      </p>
    </Panel>
  )
}
