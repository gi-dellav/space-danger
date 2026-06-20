"use client"

import type { GameState } from "@/lib/game/types"
import { FACTIONS } from "@/lib/game/data"
import { repLabel } from "@/lib/game/engine"
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

export default function FactionsView({ state }: { state: GameState }) {
  return (
    <Panel title="Faction Standing">
      <div className="space-y-4">
        {FACTIONS.map((f) => {
          const rep = state.factionRep[f.id] ?? 0
          const label = repLabel(rep)
          const pct = ((rep + 10) / 20) * 100
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
            </div>
          )
        })}
      </div>
    </Panel>
  )
}
