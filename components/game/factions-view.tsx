"use client"

import { Button } from "@/components/ui/button"
import type { Action } from "@/lib/game/engine"
import { repLabel } from "@/lib/game/engine"
import { FACTIONS, SYSTEMS_BY_ID, GOODS_BY_ID } from "@/lib/game/data"
import type { GameState } from "@/lib/game/types"
import { Panel, StatBar } from "./ui"

const REP_COLORS: Record<string, string> = {
  Hero: "text-emerald-400",
  Allied: "text-emerald-500",
  Friendly: "text-green-500",
  Cordial: "text-lime-500",
  Neutral: "text-muted-foreground",
  Wary: "text-amber-500",
  Unfriendly: "text-orange-500",
  Hostile: "text-red-500",
}

const REP_BG: Record<string, string> = {
  Hero: "bg-emerald-400",
  Allied: "bg-emerald-500",
  Friendly: "bg-green-500",
  Cordial: "bg-lime-500",
  Neutral: "bg-muted-foreground",
  Wary: "bg-amber-500",
  Unfriendly: "bg-orange-500",
  Hostile: "bg-red-500",
}

export default function FactionsView({
  state,
  dispatch,
}: {
  state: GameState
  dispatch: (a: Action) => void
}) {
  const pending = state.pendingFactionMission

  return (
    <div className="flex flex-col gap-4">
      {/* War cooldown banner */}
      {state.warCooldown > 0 && (
        <div className="rounded-md border border-amber-500/40 bg-amber-950/20 px-3 py-2 text-xs text-amber-400">
          War fatigue: cannot declare war for {state.warCooldown} more turn{state.warCooldown > 1 ? "s" : ""}.
        </div>
      )}

      <Panel title="Faction Standing">
        <div className="space-y-4">
          {FACTIONS.map((f) => {
            const rep = state.factionRep[f.id] ?? 0
            const label = repLabel(rep)
            const pct = ((rep + 10) / 20) * 100
            const canRequest = !state.factionMissionRequestedThisTurn && !state.pendingFactionMission
            const canDeclareWar = state.warCooldown <= 0 && rep > -9
            const factionTrades = state.factionTrades.filter((t) => t.factionId === f.id)

            // Calculate war reward preview
            const warReward = (() => {
              if (!canDeclareWar || !f.rival) return 0
              const targetRepBonus = Math.max(0, rep + 10)
              const rivalRep = state.factionRep[f.rival] ?? 0
              const rivalRepBonus = Math.max(0, rivalRep + 10)
              return state.turn * 50 + targetRepBonus * 100 + rivalRepBonus * 80
            })()

            return (
              <div key={f.id} className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm" style={{ color: f.color }}>
                    {f.name}
                  </span>
                  <span className={`text-xs font-semibold ${REP_COLORS[label] ?? "text-muted-foreground"}`}>
                    {label} ({rep > 0 ? "+" : ""}{rep})
                  </span>
                </div>
                <StatBar label="" value={pct} max={100} tone="primary" />
                <p className="text-xs text-muted-foreground mt-1">{f.description}</p>
                {label === "Hostile" && (
                  <p className="text-xs text-red-500 mt-1 font-semibold">⚠ DOCKING DENIED at high-security stations</p>
                )}

                {/* Faction trade offers */}
                {factionTrades.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {factionTrades.map((trade, i) => {
                      const good = GOODS_BY_ID[trade.goodId]
                      const baseTotal = good ? good.basePrice * trade.qty : trade.price
                      const discountPct = baseTotal > 0 ? Math.round((1 - trade.price / baseTotal) * 100) : 0
                      return (
                        <div
                          key={`${trade.goodId}-${i}`}
                          className="flex items-center justify-between rounded-md border border-emerald-500/30 bg-emerald-950/15 px-3 py-2"
                        >
                          <div className="text-xs">
                            <span className="font-semibold text-emerald-400">Buy {trade.qty}t {good?.name ?? trade.goodId}</span>
                            <span className="text-muted-foreground ml-1">
                              for {trade.price.toLocaleString()} cr ({discountPct}% off)
                            </span>
                          </div>
                          <Button
                            size="sm"
                            variant="default"
                            className="h-7 text-xs bg-emerald-600 hover:bg-emerald-500"
                            onClick={() =>
                              dispatch({ type: "BUY_FACTION_TRADE", factionId: f.id, index: state.factionTrades.indexOf(trade) })
                            }
                          >
                            Buy
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                )}

                <div className="mt-2 flex gap-2 flex-wrap">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    disabled={!canRequest}
                    onClick={() => dispatch({ type: "REQUEST_FACTION_MISSION", factionId: f.id })}
                  >
                    Request Mission
                  </Button>
                  {canDeclareWar && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs border-red-500/40 text-red-400 hover:bg-red-950/30"
                      onClick={() => {
                        if (window.confirm(`Declare war on ${f.name}?\n\nRep will drop to -10 (Hostile).\nRival faction will welcome you.\nReward: ~${warReward.toLocaleString()} cr.\n\n20-turn cooldown before next declaration.`)) {
                          dispatch({ type: "DECLARE_WAR", factionId: f.id })
                        }
                      }}
                    >
                      Declare War (+{warReward.toLocaleString()} cr)
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        {state.factionMissionRequestedThisTurn && !state.pendingFactionMission && (
          <p className="mt-3 text-xs text-muted-foreground">
            Faction mission already requested this turn. Dock at another station to request again.
          </p>
        )}
      </Panel>

      {pending && (
        <Panel title="Faction Mission Offer">
          <div className="flex flex-col gap-3 rounded-md border border-border/60 bg-secondary/40 p-3">
            <div>
              <span className="font-heading font-semibold text-foreground text-sm">
                {pending.title}
              </span>
              <p className="mt-0.5 text-xs text-muted-foreground">{pending.description}</p>
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[0.65rem] text-muted-foreground">
                <span>
                  Target:{" "}
                  <span className="text-foreground">
                    {SYSTEMS_BY_ID[pending.targetSystemId]?.name ?? "?"}
                  </span>
                </span>
                {pending.requiredGoodId && pending.requiredQty ? (
                  <span>
                    Cargo:{" "}
                    <span className="text-foreground">
                      {pending.requiredQty}t {GOODS_BY_ID[pending.requiredGoodId]?.name ?? pending.requiredGoodId}
                    </span>
                  </span>
                ) : null}
                <span>
                  Deadline:{" "}
                  <span className="text-foreground">Turn {pending.deadlineTurn}</span>
                </span>
                <span>
                  Reward:{" "}
                  <span className="text-primary">{pending.reward.toLocaleString()} cr</span>
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="default"
                className="h-8 text-xs"
                onClick={() => {
                  dispatch({ type: "ACCEPT_MISSION", mission: pending })
                  dispatch({ type: "REFUSE_FACTION_MISSION" })
                }}
              >
                Accept
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                onClick={() => dispatch({ type: "REFUSE_FACTION_MISSION" })}
              >
                Refuse
              </Button>
            </div>
          </div>
        </Panel>
      )}
    </div>
  )
}
