"use client"

import { Button } from "@/components/ui/button"
import type { Action } from "@/lib/game/engine"
import { handValue } from "@/lib/game/blackjack"
import type { GameState, Card, Suit } from "@/lib/game/types"
import { useState } from "react"
import { Panel } from "./ui"

const SUIT_SYMBOL: Record<Suit, string> = {
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
  spades: "♠",
}

function cardLabel(c: Card): string {
  return `${c.rank}${SUIT_SYMBOL[c.suit]}`
}

function cardColor(suit: Suit): string {
  return suit === "hearts" || suit === "diamonds" ? "text-red-500" : "text-foreground"
}

export function CasinoView({
  state,
  dispatch,
}: {
  state: GameState
  dispatch: (a: Action) => void
}) {
  const [betInput, setBetInput] = useState(50)
  const casino = state.casino

  // Lobby state
  if (!casino || casino.phase === "lobby") {
    return (
      <Panel title="Crimson Casino — Riedquat">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Welcome to the Crimson Casino. The blackjack table minimum is 10 cr.
          </p>
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium">Bet amount:</label>
            <input
              type="number"
              className="h-8 w-24 rounded border border-border bg-background px-2 text-sm text-foreground"
              value={betInput}
              min={10}
              step={5}
              onChange={(e) => setBetInput(Math.max(10, parseInt(e.target.value) || 10))}
            />
            <Button
              size="sm"
              variant="secondary"
              disabled={betInput > state.credits || betInput < 10}
              onClick={() => dispatch({ type: "CASINO_BET", amount: betInput })}
            >
              Place Bet ({betInput} cr)
            </Button>
          </div>
          <Button variant="ghost" size="sm" onClick={() => dispatch({ type: "LEAVE_CASINO" })}>
            Leave Casino
          </Button>
        </div>
      </Panel>
    )
  }

  const pv = handValue(casino.playerHand)
  const dealerVisible = casino.dealerHand[casino.dealerHand.length - 1]
  const dvHidden = casino.dealerHidden
  const result = casino.result

  return (
    <Panel title={`Blackjack — Bet: ${casino.bet} cr`}>
      <div className="space-y-4">
        {/* Dealer hand */}
        <div>
          <p className="text-sm font-medium mb-1">
            Dealer{" "}
            {result !== null && dvHidden === null && (
              <span className="text-muted-foreground">({handValue(casino.dealerHand)})</span>
            )}
          </p>
          <div className="flex gap-1.5 flex-wrap">
            {casino.dealerHand.map((c, i) => (
              <span key={i} className={`text-lg font-mono ${cardColor(c.suit)}`}>
                {cardLabel(c)}
              </span>
            ))}
            {dvHidden && (
              <span className="text-lg font-mono text-muted-foreground">🂠</span>
            )}
          </div>
        </div>

        {/* Player hand */}
        <div>
          <p className="text-sm font-medium mb-1">
            Your Hand <span className="text-muted-foreground">({pv})</span>
          </p>
          <div className="flex gap-1.5 flex-wrap">
            {casino.playerHand.map((c, i) => (
              <span key={i} className={`text-lg font-mono ${cardColor(c.suit)}`}>
                {cardLabel(c)}
              </span>
            ))}
          </div>
        </div>

        {/* Result */}
        {result !== null && (
          <div className={`text-sm font-bold ${result === "win" || result === "blackjack" ? "text-green-500" : result === "push" ? "text-yellow-500" : "text-red-500"}`}>
            {result === "blackjack" && "🎉 Blackjack! Pays 3:2 🎉"}
            {result === "win" && "You win!"}
            {result === "push" && "Push — bet returned."}
            {result === "lose" && "You lose."}
          </div>
        )}

        {/* Actions */}
        {casino.phase === "player" && (
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="secondary" onClick={() => dispatch({ type: "CASINO_HIT" })}>
              Hit
            </Button>
            <Button size="sm" variant="secondary" onClick={() => dispatch({ type: "CASINO_STAND" })}>
              Stand
            </Button>
            {casino.playerHand.length === 2 && state.credits >= casino.bet && (
              <Button size="sm" variant="secondary" onClick={() => dispatch({ type: "CASINO_DOUBLE" })}>
                Double ({casino.bet} cr)
              </Button>
            )}
          </div>
        )}

        {casino.phase === "result" && (
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => dispatch({ type: "CASINO_BET", amount: casino.bet })}>
              Same Bet ({casino.bet} cr)
            </Button>
            <Button size="sm" variant="ghost" onClick={() => dispatch({ type: "LEAVE_CASINO" })}>
              Cash Out
            </Button>
          </div>
        )}
      </div>
    </Panel>
  )
}
