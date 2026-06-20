"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { listSaves, getSaveSlot, saveGame, loadGame, deleteSave, type SaveSlot } from "@/lib/game/save"
import type { GameState } from "@/lib/game/types"

interface SaveDialogProps {
  state: GameState
  systemName: string
  rating: string
  onLoad: (state: GameState) => void
  onClose: () => void
}

export default function SaveDialog({ state, systemName, rating, onLoad, onClose }: SaveDialogProps) {
  const [saves, setSaves] = useState<{ slot: string; info: SaveSlot | null }[]>([])
  const [mode, setMode] = useState<"save" | "load">("save")

  useEffect(() => {
    setSaves(listSaves())
  }, [])

  const refreshSaves = () => setSaves(listSaves())

  const handleSave = (slot: string) => {
    saveGame(slot, state, systemName, rating)
    refreshSaves()
  }

  const handleLoad = (slot: string) => {
    const loaded = loadGame(slot)
    if (loaded) {
      onLoad(loaded)
    }
  }

  const handleDelete = (slot: string) => {
    deleteSave(slot)
    refreshSaves()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-foreground">
            {mode === "save" ? "Save Career" : "Load Career"}
          </h2>
          <Button size="icon-xs" variant="ghost" onClick={onClose}>
            ✕
          </Button>
        </div>

        <div className="flex gap-2 mb-4">
          <Button
            size="sm"
            variant={mode === "save" ? "default" : "outline"}
            onClick={() => setMode("save")}
          >
            Save
          </Button>
          <Button
            size="sm"
            variant={mode === "load" ? "default" : "outline"}
            onClick={() => setMode("load")}
          >
            Load
          </Button>
        </div>

        <div className="space-y-2">
          {saves.map(({ slot, info }) => (
            <div
              key={slot}
              className="flex items-center justify-between rounded border border-border p-3"
            >
              <div>
                <span className="text-sm font-medium">Slot {slot}</span>
                {info ? (
                  <div className="text-xs text-muted-foreground">
                    Turn {info.turn} · {info.systemName} · {info.credits} cr · {info.rating}
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">Empty</span>
                )}
              </div>
              <div className="flex gap-1">
                {mode === "save" && (
                  <Button size="xs" variant="secondary" onClick={() => handleSave(slot)}>
                    Save
                  </Button>
                )}
                {mode === "load" && info && (
                  <Button size="xs" variant="secondary" onClick={() => handleLoad(slot)}>
                    Load
                  </Button>
                )}
                {info && (
                  <Button size="xs" variant="ghost" onClick={() => handleDelete(slot)}>
                    Del
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
