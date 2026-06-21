export type EconomyType =
  | "Agricultural"
  | "Extraction"
  | "Refinery"
  | "Industrial"
  | "High-Tech"

export type FactionId = "federation" | "combine" | "imperial" | "cartel"

export interface Faction {
  id: FactionId
  name: string
  description: string
  color: string
  rival: FactionId | null
}

export interface Good {
  id: string
  name: string
  basePrice: number
  illegal?: boolean
}

export interface StarSystem {
  id: string
  name: string
  economy: EconomyType
  techLevel: number // 1 - 10
  government: string
  factionId: FactionId
  danger: number // 0 (safe) - 4 (anarchy)
  x: number
  y: number
  description: string
}

export interface MarketEntry {
  goodId: string
  price: number
  quantity: number // units available to buy at this station
}

export interface Ship {
  hull: number
  maxHull: number
  shield: number
  maxShield: number
  weaponDamage: number
  cargoCapacity: number
  maxFuel: number
  fuel: number
  missiles: number
}

export interface Enemy {
  name: string
  hull: number
  maxHull: number
  shield: number
  maxShield: number
  damage: number
  bounty: number
}

// The turn cycle: command (MOVE) -> event (EVENT) -> combat (RESOLVE) -> summary (END)
export type Phase = "menu" | "command" | "event" | "combat" | "gameover"

export interface GameEvent {
  kind: string
  title: string
  text: string
  options: { id: string; label: string }[]
  // optional payload used when resolving the event
  goodId?: string
  unitPrice?: number
  qty?: number
}

// An in-progress voyage between two systems, traversed one leg per turn.
export interface Voyage {
  destinationId: string
  legsTotal: number
  legsDone: number
}

// Captured at the start of a move so the end-of-turn summary can show deltas.
export interface MoveSnapshot {
  credits: number
  hull: number
  fuel: number
  logId: number
}

// The end-of-turn recap shown during the "summary" phase.
export interface TurnReport {
  turn: number
  headline: string
  entries: LogEntry[]
  creditsDelta: number
  hullDelta: number
  fuelDelta: number
  arrived: boolean
}

export type LogTone = "info" | "good" | "bad" | "combat" | "system"

export interface LogEntry {
  id: number
  text: string
  tone: LogTone
}

export type MissionType =
  | "delivery"
  | "courier"
  | "bounty"
  | "smuggle"
  | "passenger"
  | "mining"
  | "rescue"
  | "exploration"

export interface Mission {
  id: number
  type: MissionType
  title: string
  description: string
  targetSystemId: string
  factionId?: FactionId
  requiredGoodId?: string
  requiredQty?: number
  deadlineTurn: number
  reward: number
  completed: boolean
  failed: boolean
}

export type CrewRole = "pilot" | "gunner" | "engineer" | "medic" | "navigator" | "smuggler"

export interface CrewMember {
  id: number
  name: string
  role: CrewRole
  wagePerTurn: number
  skill: number // 1-5, scales the role bonus
}

export type Suit = "hearts" | "diamonds" | "clubs" | "spades"
export type Rank = "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K"

export interface Card {
  suit: Suit
  rank: Rank
}

export type BlackjackPhase = "lobby" | "bet" | "player" | "dealer" | "result"

export interface BlackjackState {
  deck: Card[]
  playerHand: Card[]
  dealerHand: Card[]
  dealerHidden: Card | null
  bet: number
  phase: BlackjackPhase
  result: string | null // "win", "lose", "push", "blackjack"
}

export interface GameState {
  phase: Phase
  turn: number
  credits: number
  ship: Ship
  cargo: Record<string, number>
  currentSystemId: string
  market: MarketEntry[]
  voyage: Voyage | null
  event: GameEvent | null
  enemy: Enemy | null
  playerEvading: boolean
  destroyedShips: number
  snapshot: MoveSnapshot | null
  report: TurnReport | null
  log: LogEntry[]
  nextLogId: number
  missions: Mission[]
  nextMissionId: number
  scannerLevel: number
  installedUpgrades: string[]
  factionRep: Record<FactionId, number>
  crew: CrewMember[]
  nextCrewId: number
  availableCrew: CrewMember[]
  casino: BlackjackState | null
}
