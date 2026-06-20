"use client"

import { Button } from "@/components/ui/button"
import { GOODS_BY_ID, SYSTEMS_BY_ID } from "@/lib/game/data"
import { type Action, generateMissions } from "@/lib/game/engine"
import type { GameState, Mission } from "@/lib/game/types"
import { cn } from "@/lib/utils"
import { useMemo, useState } from "react"
import { Panel } from "./ui"

const TYPE_LABEL: Record<string, string> = {
  delivery: "Delivery",
  courier: "Courier",
  bounty: "Bounty",
  smuggle: "Smuggle",
  passenger: "Passenger",
  mining: "Mining",
  rescue: "Rescue",
  exploration: "Exploration",
}

const TYPE_TONE: Record<string, string> = {
  delivery: "text-primary",
  courier: "text-accent",
  bounty: "text-destructive",
  smuggle: "text-destructive",
  passenger: "text-accent",
  mining: "text-primary",
  rescue: "text-success",
  exploration: "text-success",
}

function MissionCard({
  mission,
  action,
  actionLabel,
  actionDisabled,
  actionVariant,
}: {
  mission: Mission
  action?: () => void
  actionLabel: string
  actionDisabled?: boolean
  actionVariant?: "secondary" | "outline" | "destructive"
}) {
  const target = SYSTEMS_BY_ID[mission.targetSystemId]
  const goodName = mission.requiredGoodId
    ? (GOODS_BY_ID[mission.requiredGoodId]?.name ?? mission.requiredGoodId)
    : null
  return (
    <li className="flex flex-col gap-2 rounded-md border border-border/60 bg-secondary/40 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2">
          <span className="font-heading font-semibold text-foreground text-sm">
            {mission.title}
          </span>
          <span
            className={cn(
              "text-[0.6rem] uppercase tracking-wider",
              TYPE_TONE[mission.type] ?? "text-muted-foreground",
            )}
          >
            {TYPE_LABEL[mission.type] ?? mission.type}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{mission.description}</p>
        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[0.65rem] text-muted-foreground">
          <span>
            Target:{" "}
            <span className="text-foreground">{target?.name ?? "?"}</span>
          </span>
          {goodName && mission.requiredQty && (
            <span>
              Cargo:{" "}
              <span className="text-foreground">
                {mission.requiredQty}t {goodName}
              </span>
            </span>
          )}
          <span>
            Deadline:{" "}
            <span className="text-foreground">Turn {mission.deadlineTurn}</span>
          </span>
          <span>
            Reward:{" "}
            <span className="text-primary">{mission.reward.toLocaleString()} cr</span>
          </span>
        </div>
      </div>
      <div className="shrink-0">
        <Button
          size="sm"
          variant={actionVariant ?? "secondary"}
          disabled={actionDisabled}
          onClick={action}
          className="h-8"
        >
          {actionLabel}
        </Button>
      </div>
    </li>
  )
}

export function MissionsView({
  state,
  dispatch,
}: {
  state: GameState
  dispatch: (a: Action) => void
}) {
  const system = SYSTEMS_BY_ID[state.currentSystemId]
  const [seed, setSeed] = useState(0)

  const available = useMemo(() => {
    // Re-generate when system changes or seed is bumped
    return generateMissions(system, state.turn)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [system.id, state.turn, seed])

  const activeMissions = state.missions.filter((m) => !m.completed && !m.failed)
  const completedMissions = state.missions.filter((m) => m.completed)
  const failedMissions = state.missions.filter((m) => m.failed)

  const canAcceptMore = activeMissions.length < 6

  return (
    <div className="flex flex-col gap-4">
      <Panel
        title="Mission Board"
        right={
          <span className="text-[0.7rem] uppercase tracking-wider text-muted-foreground">
            {available.length} available · Active:{" "}
            <span className="text-foreground">{activeMissions.length}</span>
          </span>
        }
      >
        {available.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No contracts posted at {system.name} right now. Try a higher-tech system or lay over
            to refresh the board.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {available.map((m, i) => (
              <MissionCard
                key={`avail-${i}`}
                mission={m}
                action={() => {
                  dispatch({ type: "ACCEPT_MISSION", mission: m })
                  setSeed((s) => s + 1)
                }}
                actionLabel="Accept"
                actionDisabled={!canAcceptMore}
              />
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Up to 6 active contracts at a time. Failing or abandoning a mission incurs a reputation
          penalty of 25% of the reward.
        </p>
      </Panel>

      {activeMissions.length > 0 && (
        <Panel
          title="Active Contracts"
          right={
            <span className="text-[0.7rem] uppercase tracking-wider text-muted-foreground">
              {activeMissions.length} contract{activeMissions.length > 1 ? "s" : ""}
            </span>
          }
        >
          <ul className="flex flex-col gap-2">
            {activeMissions.map((m) => (
              <MissionCard
                key={m.id}
                mission={m}
                action={() => dispatch({ type: "ABANDON_MISSION", missionId: m.id })}
                actionLabel="Abandon"
                actionVariant="outline"
              />
            ))}
          </ul>
        </Panel>
      )}

      {completedMissions.length > 0 && (
        <Panel title="Completed">
          <ul className="flex flex-col gap-1.5">
            {completedMissions.slice(-5).map((m) => (
              <li key={m.id} className="text-xs text-success flex justify-between">
                <span>{m.title}</span>
                <span className="tabular-nums">+{m.reward.toLocaleString()} cr</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {failedMissions.length > 0 && (
        <Panel title="Failed / Abandoned">
          <ul className="flex flex-col gap-1.5">
            {failedMissions.slice(-5).map((m) => (
              <li key={m.id} className="text-xs text-destructive flex justify-between">
                <span>{m.title}</span>
                <span className="tabular-nums">−{Math.floor(m.reward * 0.25).toLocaleString()} cr</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  )
}
