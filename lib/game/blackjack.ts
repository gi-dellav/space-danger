import type { Card, BlackjackState, Suit, Rank } from "./types"

const SUITS: Suit[] = ["hearts", "diamonds", "clubs", "spades"]
const RANKS: Rank[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"]

function createDeck(): Card[] {
  const deck: Card[] = []
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank })
    }
  }
  return deck
}

function shuffle(deck: Card[]): Card[] {
  const d = [...deck]
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[d[i], d[j]] = [d[j], d[i]]
  }
  return d
}

function rankValue(rank: Rank): number {
  if (rank === "A") return 11
  if (["K", "Q", "J"].includes(rank)) return 10
  return parseInt(rank, 10)
}

export function handValue(hand: Card[]): number {
  let total = 0
  let aces = 0
  for (const card of hand) {
    total += rankValue(card.rank)
    if (card.rank === "A") aces++
  }
  while (total > 21 && aces > 0) {
    total -= 10
    aces--
  }
  return total
}

function draw(deck: Card[], count: number): { drawn: Card[]; deck: Card[] } {
  const drawn = deck.slice(0, count)
  return { drawn, deck: deck.slice(count) }
}

export function startHand(bet: number): BlackjackState {
  let deck = shuffle(createDeck())
  const { drawn: playerHand, deck: d1 } = draw(deck, 2)
  const { drawn: dealerCards, deck: d2 } = draw(d1, 2)
  const dealerHidden = dealerCards[1]
  const dealerHand = [dealerCards[0]]

  // Natural blackjack check
  const pv = handValue(playerHand)
  if (pv === 21) {
    const dv = handValue([dealerCards[0], dealerHidden])
    if (dv === 21) {
      return { deck: d2, playerHand, dealerHand: dealerCards, dealerHidden: null, bet, phase: "result", result: "push" }
    }
    return { deck: d2, playerHand, dealerHand: dealerCards, dealerHidden: null, bet, phase: "result", result: "blackjack" }
  }

  return { deck: d2, playerHand, dealerHand, dealerHidden, bet, phase: "player", result: null }
}

export function hit(state: BlackjackState): BlackjackState {
  if (state.phase !== "player") return state
  const { drawn, deck } = draw(state.deck, 1)
  const playerHand = [...state.playerHand, ...drawn]
  const pv = handValue(playerHand)
  if (pv > 21) {
    return { ...state, deck, playerHand, dealerHidden: null, dealerHand: [...state.dealerHand, state.dealerHidden!], phase: "result", result: "lose" }
  }
  if (pv === 21) return stand({ ...state, deck, playerHand })
  return { ...state, deck, playerHand }
}

export function stand(state: BlackjackState): BlackjackState {
  if (state.phase !== "player" && state.phase !== "bet") return state
  const dealerHidden = state.dealerHidden!
  let dealerHand = [...state.dealerHand, dealerHidden]
  let deck = state.deck

  // Dealer draws until 17+
  while (handValue(dealerHand) < 17) {
    const { drawn, deck: d2 } = draw(deck, 1)
    dealerHand = [...dealerHand, ...drawn]
    deck = d2
  }

  const pv = handValue(state.playerHand)
  const dv = handValue(dealerHand)

  let result: string
  if (dv > 21) result = "win"
  else if (pv === dv) result = "push"
  else if (pv > 21) result = "lose"
  else if (pv > dv) result = "win"
  else result = "lose"

  return { ...state, deck, dealerHand, dealerHidden: null, phase: "result", result }
}

export function doubleDown(state: BlackjackState): BlackjackState {
  if (state.phase !== "player" || state.playerHand.length > 2) return state
  const { drawn, deck } = draw(state.deck, 1)
  const playerHand = [...state.playerHand, ...drawn]
  const pv = handValue(playerHand)
  if (pv > 21) {
    return { ...state, deck, playerHand, dealerHidden: null, dealerHand: [...state.dealerHand, state.dealerHidden!], bet: state.bet * 2, phase: "result", result: "lose" }
  }
  return stand({ ...state, deck, playerHand, bet: state.bet * 2 })
}

export function resolvePayout(state: BlackjackState): number {
  if (state.phase !== "result" || !state.result) return 0
  if (state.result === "blackjack") return Math.round(state.bet * 2.5)
  if (state.result === "win") return state.bet * 2
  if (state.result === "push") return state.bet
  return 0
}
