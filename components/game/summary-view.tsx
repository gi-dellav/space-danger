"use client"

import { Button } from "@/components/ui/button"
import type { Action } from "@/lib/game/engine"
import type { GameState, LogTone } from "@/lib/game/types"
import { cn } from "@/lib/utils"
import { Panel } from "./ui"

const TONE_CLASS: Record<LogTone, string> = {
  info: "text-muted-foreground",
  good: "text-success",
  bad: "text-destructive",
  combat: "text-accent",
  system: "text-primary",
}

function Delta({ label, value, unit, invert }: { label: string; value: number; unit: string; invert?: boolean }) {
  const positive = invert ? value < 0 : value > 0
  const negative = invert ? value > 0 : value < 0
  const tone = value === 0 ? "text-muted-foreground" : positive ? "text-success" : "text-destructive"
  const sign = value > 0 ? "+" : ""
  return (
    <div className="flex flex-col rounded-md border border-border bg-secondary/40 px-3 py-2">
      <span className="text-[0.65rem] uppercase tracking-[0.15em] text-muted-foreground">{label}</span>
      <span className={cn("font-heading text-base font-semibold tabular-nums", tone)}>
        {value === 0 ? "—" : `${sign}${value.toLocaleString()} ${unit}`}
      </span>
    </div>
  )
}

export function SummaryView({
  state,
  dispatch,
}: {
  state: GameState
  dispatch: (a: Action) => void
}) {
  const report = state.report
  if (!report) return null

  return (
    <Panel title={`Turn ${report.turn} Report`} className="mx-auto w-full max-w-2xl">
      <div className="flex flex-col gap-5">
        <div>
          <h3 className="font-heading text-xl font-bold text-primary">{report.headline}</h3>
          <p className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">
            {report.arrived ? "Voyage complete — docking" : "Turn resolved"}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Delta label="Credits" value={report.creditsDelta} unit="cr" />
          <Delta label="Hull" value={report.hullDelta} unit="" />
          <Delta label="Fuel" value={report.fuelDelta} unit="ly" />
        </div>

        <div className="rounded-md border border-border bg-background/40 p-3">
          <p className="mb-2 text-[0.7rem] uppercase tracking-wider text-muted-foreground">
            This turn
          </p>
          {report.entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing of note.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {report.entries.map((e) => (
                <li key={e.id} className={cn("text-sm leading-snug", TONE_CLASS[e.tone])}>
                  {e.text}
                </li>
              ))}
            </ul>
          )}
        </div>

        <Button className="w-full" onClick={() => dispatch({ type: "END_TURN" })}>
          {report.arrived ? "Dock & Begin Next Turn" : "Begin Next Turn"}
        </Button>
      </div>
    </Panel>
  )
}
