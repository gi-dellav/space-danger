"use client"

import { Button } from "@/components/ui/button"
import { GOODS_BY_ID, SYSTEMS_BY_ID } from "@/lib/game/data"
import { cargoUsed } from "@/lib/game/engine"
import type { Action } from "@/lib/game/engine"
import type { GameState } from "@/lib/game/types"
import { cn } from "@/lib/utils"
import { useEffect, useRef, useState } from "react"
import { Panel } from "./ui"

function QuantityStepper({
  value,
  onChange,
  max,
}: {
  value: number
  onChange: (n: number) => void
  max: number
}) {
  const clamp = (n: number) => Math.min(max, Math.max(1, Math.round(n) || 1))
  return (
    <div className="inline-flex items-center gap-0.5">
      <button
        type="button"
        className="flex h-6 w-5 items-center justify-center rounded-l-sm border border-border bg-secondary text-xs text-muted-foreground hover:bg-primary hover:text-primary-foreground disabled:opacity-30"
        disabled={value <= 1}
        onClick={() => onChange(value - 1)}
      >
        −
      </button>
      <input
        type="text"
        inputMode="numeric"
        className="h-6 w-10 border-y border-border bg-transparent text-center text-xs tabular-nums text-foreground outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value)
          if (e.target.value !== "" && !isNaN(n)) onChange(clamp(n))
          else if (e.target.value === "") onChange(1)
        }}
        onFocus={(e) => e.target.select()}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp") { e.preventDefault(); onChange(clamp(value + 1)) }
          if (e.key === "ArrowDown") { e.preventDefault(); onChange(clamp(value - 1)) }
        }}
      />
      <button
        type="button"
        className="flex h-6 w-5 items-center justify-center rounded-r-sm border border-border bg-secondary text-xs text-muted-foreground hover:bg-primary hover:text-primary-foreground disabled:opacity-30"
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
      >
        +
      </button>
    </div>
  )
}

export function MarketView({
  state,
  dispatch,
}: {
  state: GameState
  dispatch: (a: Action) => void
}) {
  const system = SYSTEMS_BY_ID[state.currentSystemId]
  const free = state.ship.cargoCapacity - cargoUsed(state.cargo)

  const [buyQtys, setBuyQtys] = useState<Record<string, number>>({})
  const [sellQtys, setSellQtys] = useState<Record<string, number>>({})

  // Reset quantities when docked system changes
  const prevSystemRef = useRef(state.currentSystemId)
  useEffect(() => {
    if (prevSystemRef.current !== state.currentSystemId) {
      prevSystemRef.current = state.currentSystemId
      setBuyQtys({})
      setSellQtys({})
    }
  }, [state.currentSystemId])

  const getBuyQty = (goodId: string) => buyQtys[goodId] ?? 1
  const setBuyQty = (goodId: string, n: number) =>
    setBuyQtys((prev) => ({ ...prev, [goodId]: n }))
  const getSellQty = (goodId: string) => sellQtys[goodId] ?? 1
  const setSellQty = (goodId: string, n: number) =>
    setSellQtys((prev) => ({ ...prev, [goodId]: n }))

  return (
    <Panel
      title={`${system.name} Commodity Market`}
      right={
        <span className="text-[0.7rem] uppercase tracking-wider text-muted-foreground">
          {system.id === "riedquat" ? "Casino" : system.economy} · Hold free: <span className="text-foreground">{free}t</span>
        </span>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-left text-[0.65rem] uppercase tracking-wider text-muted-foreground">
              <th className="pb-2 pr-2 font-medium">Commodity</th>
              <th className="pb-2 px-2 text-right font-medium">Price</th>
              <th className="pb-2 px-2 text-right font-medium">Gal. Avg</th>
              <th className="pb-2 px-2 text-right font-medium">Avail.</th>
              <th className="pb-2 px-2 text-right font-medium">Held</th>
              <th className="pb-2 pl-2 text-right font-medium">Trade</th>
            </tr>
          </thead>
          <tbody>
            {state.market.map((m) => {
              const good = GOODS_BY_ID[m.goodId]
              const isMissile = m.goodId === "missiles"
              const held = isMissile ? state.ship.missiles : (state.cargo[m.goodId] ?? 0)
              const buyQty = getBuyQty(m.goodId)
              const sellQty = getSellQty(m.goodId)
              const maxAffordable = Math.floor(state.credits / m.price)
              const maxMissileCap = isMissile ? Math.max(0, 8 - state.ship.missiles) : Infinity
              const maxBuy = isMissile
                ? Math.min(m.quantity, maxMissileCap, maxAffordable)
                : Math.min(m.quantity, free, maxAffordable)
              const canBuy = maxBuy > 0
              const canSell = held > 0
              const lastPrice = state.lastBuyPrice[m.goodId]
              const trend = m.price > good.basePrice ? "↑" : m.price < good.basePrice ? "↓" : "·"
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
                    {good.basePrice.toLocaleString()}
                    <span className={cn("ml-1 text-[0.65rem]", trend === "↑" ? "text-destructive" : trend === "↓" ? "text-success" : "text-muted-foreground")}>{trend}</span>
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">
                    {m.quantity}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    <span className={held > 0 ? "text-accent" : "text-muted-foreground"}>
                      {held}{isMissile ? " mounted" : ""}
                    </span>
                    {lastPrice !== undefined && held > 0 && (
                      <span className="block text-[0.6rem] text-muted-foreground">
                        @ {lastPrice.toLocaleString()} cr
                      </span>
                    )}
                  </td>
                  <td className="py-2 pl-2">
                    <div className="flex flex-col gap-1 items-end">
                      <div className="flex items-center gap-1.5">
                        <QuantityStepper
                          value={buyQty}
                          onChange={(n) => setBuyQty(m.goodId, n)}
                          max={Math.max(1, maxBuy)}
                        />
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={!canBuy || buyQty > maxBuy}
                          onClick={() => dispatch({ type: "BUY", goodId: m.goodId, qty: buyQty })}
                          className="h-7 px-2 text-xs"
                        >
                          Buy {buyQty > 1 ? buyQty : ""}
                        </Button>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <QuantityStepper
                          value={sellQty}
                          onChange={(n) => setSellQty(m.goodId, n)}
                          max={Math.max(1, held)}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!canSell}
                          onClick={() => dispatch({ type: "SELL", goodId: m.goodId, qty: sellQty })}
                          className="h-7 px-2 text-xs"
                        >
                          Sell {sellQty > 1 ? sellQty : ""}
                        </Button>
                      </div>
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
