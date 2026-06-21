"use client"

import type { CrewRole, GameState } from "@/lib/game/types"
import { CREW_ROLE_BONUS, CREW_WAGE } from "@/lib/game/data"
import { Panel } from "./ui"
import { Button } from "@/components/ui/button"

const ROLE_LABEL: Record<CrewRole, string> = {
  pilot: "Pilot",
  gunner: "Gunner",
  engineer: "Engineer",
  medic: "Medic",
  navigator: "Navigator",
  smuggler: "Smuggler",
}

const ROLE_ICON: Record<CrewRole, string> = {
  pilot: "✦",
  gunner: "✧",
  engineer: "⚒",
  medic: "✚",
  navigator: "◈",
  smuggler: "◆",
}

interface CrewViewProps {
  state: GameState
  onHire: (index: number) => void
  onFire: (crewId: number) => void
}

export default function CrewView({ state, onHire, onFire }: CrewViewProps) {
  const canHire = state.crew.length < 4
  const pool = state.availableCrew ?? []

  function renderStars(skill: number) {
    return "★".repeat(skill) + "☆".repeat(5 - skill)
  }

  return (
    <Panel title="Crew Quarters">
      <div className="space-y-3">
        {state.crew.length === 0 && (
          <p className="text-sm text-muted-foreground">No crew aboard. Visit a station bar to recruit.</p>
        )}
        {state.crew.map((c) => {
          const skill = c.skill ?? 1
          const stars = renderStars(skill)
          return (
            <div key={c.id} className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <span className="text-sm font-medium">{ROLE_ICON[c.role]} {c.name}</span>
                <span className="text-xs text-yellow-400 ml-1">{stars}</span>
                <span className="text-xs text-muted-foreground ml-2">{ROLE_LABEL[c.role]}</span>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {CREW_ROLE_BONUS[c.role].description} · {c.wagePerTurn} cr/turn
                </p>
              </div>
              <Button size="xs" variant="ghost" onClick={() => onFire(c.id)}>
                Dismiss
              </Button>
            </div>
          )
        })}

        {canHire && pool.length > 0 && (
          <div className="mt-4">
            <p className="text-sm font-medium mb-2">Station Bar — Available Crew</p>
            <div className="space-y-2">
              {pool.map((candidate, i) => {
                const skill = candidate.skill ?? 1
                const stars = renderStars(skill)
                const signingBonus = candidate.wagePerTurn * 4
                const canAfford = state.credits >= signingBonus
                return (
                  <div key={i} className="flex items-center justify-between rounded border border-border p-2">
                    <div>
                      <span className="text-sm">{ROLE_ICON[candidate.role]} {candidate.name}</span>
                      <span className="text-xs text-yellow-400 ml-1">{stars}</span>
                      <span className="text-xs text-muted-foreground ml-2">{ROLE_LABEL[candidate.role]}</span>
                      <br />
                      <span className="text-xs text-muted-foreground">
                        {candidate.wagePerTurn} cr/turn · {signingBonus} cr signing
                      </span>
                    </div>
                    <Button
                      size="xs"
                      variant="secondary"
                      disabled={!canAfford}
                      onClick={() => onHire(i)}
                    >
                      {canAfford ? `Hire (${signingBonus} cr)` : "Too expensive"}
                    </Button>
                  </div>
                )
              })}
            </div>
          </div>
        )}
        {canHire && pool.length === 0 && state.crew.length > 0 && (
          <p className="text-xs text-muted-foreground mt-2">No crew available at this station.</p>
        )}
      </div>
    </Panel>
  )
}
