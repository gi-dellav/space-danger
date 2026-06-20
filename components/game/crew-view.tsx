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
}

const ROLE_ICON: Record<CrewRole, string> = {
  pilot: "✦",
  gunner: "✧",
  engineer: "⚒",
  medic: "✚",
}

interface CrewViewProps {
  state: GameState
  onHire: (role: CrewRole) => void
  onFire: (crewId: number) => void
}

export default function CrewView({ state, onHire, onFire }: CrewViewProps) {
  const system = state.currentSystemId
  const availRoles: CrewRole[] = ["pilot", "gunner", "engineer", "medic"]
  const canHire = state.crew.length < 4

  return (
    <Panel title="Crew Quarters">
      <div className="space-y-3">
        {state.crew.length === 0 && (
          <p className="text-sm text-muted-foreground">No crew aboard. Visit a station bar to recruit.</p>
        )}
        {state.crew.map((c) => (
          <div key={c.id} className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <span className="text-sm font-medium">{ROLE_ICON[c.role]} {c.name}</span>
              <span className="text-xs text-muted-foreground ml-2">{ROLE_LABEL[c.role]}</span>
              <p className="text-xs text-muted-foreground mt-0.5">
                {CREW_ROLE_BONUS[c.role].description} · {c.wagePerTurn} cr/turn
              </p>
            </div>
            <Button size="xs" variant="ghost" onClick={() => onFire(c.id)}>
              Dismiss
            </Button>
          </div>
        ))}

        {canHire && (
          <div className="mt-4">
            <p className="text-sm font-medium mb-2">Station Bar — Available Crew</p>
            <div className="space-y-2">
              {availRoles
                .filter((r) => !state.crew.some((c) => c.role === r))
                .map((r) => {
                  const wage = CREW_WAGE[r]
                  const bonus = CREW_ROLE_BONUS[r]
                  const signingBonus = wage * 2
                  const canAfford = state.credits >= signingBonus
                  return (
                    <div key={r} className="flex items-center justify-between rounded border border-border p-2">
                      <div>
                        <span className="text-sm">{ROLE_ICON[r]} {ROLE_LABEL[r]}</span>
                        <span className="text-xs text-muted-foreground ml-2">{bonus.description}</span>
                        <br />
                        <span className="text-xs text-muted-foreground">
                          {wage} cr/turn · {signingBonus} cr signing
                        </span>
                      </div>
                      <Button
                        size="xs"
                        variant="secondary"
                        disabled={!canAfford}
                        onClick={() => onHire(r)}
                      >
                        {canAfford ? `Hire (${signingBonus} cr)` : "Too expensive"}
                      </Button>
                    </div>
                  )
                })}
            </div>
          </div>
        )}
      </div>
    </Panel>
  )
}
