"use client"

import { Button } from "@/components/ui/button"
import type { Action } from "@/lib/game/engine"
import type { GameState } from "@/lib/game/types"
import { Panel } from "./ui"

export function EventView({
  state,
  dispatch,
}: {
  state: GameState
  dispatch: (a: Action) => void
}) {
  const event = state.event
  if (!event) return null

  return (
    <Panel title="Incoming Transmission" className="mx-auto w-full max-w-2xl">
      <div className="flex flex-col gap-5">
        <div>
          <h3 className="font-heading text-xl font-bold text-primary">{event.title}</h3>
          <p className="mt-2 text-pretty leading-relaxed text-foreground">{event.text}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          {event.options.map((opt) => (
            <Button
              key={opt.id}
              variant={opt.id === event.options[0].id ? "default" : "secondary"}
              className="flex-1"
              onClick={() => dispatch({ type: "EVENT_CHOICE", optionId: opt.id })}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>
    </Panel>
  )
}
