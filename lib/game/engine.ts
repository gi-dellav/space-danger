import {
  CASINO_SYSTEM_IDS,
  CREW_NAMES,
  CREW_ROLE_BONUS,
  CREW_WAGE,
  DIFFICULTY_CONFIG,
  ECONOMY_PROFILE,
  FACTIONS,
  FACTIONS_BY_ID,
  GOODS,
  GOODS_BY_ID,
  STARTING_CREDITS,
  STARTING_SHIP,
  STARTING_SYSTEM_ID,
  SYSTEMS,
  SYSTEMS_BY_ID,
  UPGRADES,
} from "./data"
import type {
  CrewMember,
  CrewRole,
  Difficulty,
  Enemy,
  FactionId,
  GameEvent,
  GameState,
  LogEntry,
  LogTone,
  MarketEntry,
  StarSystem,
} from "./types"
import { startHand, hit, stand, doubleDown, resolvePayout, handValue } from "./blackjack"
import { saveGame } from "./save"

/* ---------------------------------- utils --------------------------------- */

const rand = (min: number, max: number) => Math.random() * (max - min) + min
const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1))
const chance = (p: number) => Math.random() < p
const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v))

export function distanceBetween(a: StarSystem, b: StarSystem): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2) / 10
}

export function fuelCost(a: StarSystem, b: StarSystem): number {
  return Math.max(1, Math.ceil(distanceBetween(a, b)))
}

// Number of turns (legs) a voyage takes. One unit of fuel is burned per leg.
export function legsFor(a: StarSystem, b: StarSystem): number {
  return clamp(Math.max(1, Math.round(distanceBetween(a, b))), 1, 4)
}

export function cargoUsed(cargo: Record<string, number>): number {
  return Object.values(cargo).reduce((sum, n) => sum + n, 0)
}

// True when the commander is docked at a station (command phase, no voyage).
export function isDocked(state: GameState): boolean {
  return state.phase === "command" && state.voyage === null
}

// True when the commander is mid-voyage in deep space.
export function isInTransit(state: GameState): boolean {
  return state.phase === "command" && state.voyage !== null
}

export function combatRating(kills: number): string {
  if (kills >= 200) return "ELITE"
  if (kills >= 100) return "Deadly"
  if (kills >= 50) return "Dangerous"
  if (kills >= 24) return "Competent"
  if (kills >= 12) return "Average"
  if (kills >= 4) return "Poor"
  if (kills >= 1) return "Mostly Harmless"
  return "Harmless"
}

export function repLabel(rep: number): string {
  if (rep >= 10) return "Hero"
  if (rep >= 8) return "Allied"
  if (rep >= 5) return "Friendly"
  if (rep >= 2) return "Cordial"
  if (rep >= -1) return "Neutral"
  if (rep >= -4) return "Wary"
  if (rep >= -7) return "Unfriendly"
  return "Hostile"
}

export function repPriceMult(rep: number): number {
  if (rep >= 10) return 0.8
  if (rep >= 8) return 0.85
  if (rep >= 5) return 0.9
  if (rep >= 2) return 0.95
  if (rep >= -1) return 1.0
  if (rep >= -4) return 1.1
  if (rep >= -7) return 1.2
  return 1.35
}

/* --------------------------------- market --------------------------------- */

function systemFactionRep(state: GameState): number {
  const sys = SYSTEMS_BY_ID[state.currentSystemId]
  return state.factionRep[sys.factionId] ?? 0
}

export function generateMarket(system: StarSystem, factionRep?: number): MarketEntry[] {
  const profile = ECONOMY_PROFILE[system.economy]
  const repMult = factionRep !== undefined ? repPriceMult(factionRep) : 1
  const entries = GOODS.map((good) => {
    let mult = 1
    let qty = randInt(8, 22)

    if (profile.produces.includes(good.id)) {
      mult = rand(0.35, 0.58)
      qty = randInt(28, 56)
    } else if (profile.demands.includes(good.id)) {
      mult = rand(1.65, 2.25)
      qty = randInt(1, 7)
    } else {
      mult = rand(0.9, 1.18)
    }

    // High-tech worlds make tech goods cheaper, primitive worlds make them dear.
    if (["computers", "medicine", "luxuries"].includes(good.id)) {
      mult *= 1.25 - system.techLevel * 0.04
    }

    if (good.illegal) {
      // Contraband only shows up in lawless or low-tech ports.
      const available =
        system.danger >= 3
          ? chance(0.85)
          : system.techLevel <= 4
            ? chance(0.45)
            : chance(0.12)
      // High-tech anarchy worlds have more stock flowing through their black markets.
      qty = available
        ? system.danger >= 3 && system.techLevel >= 5
          ? randInt(8, 22)
          : randInt(3, 14)
        : 0
      // High-tech, high-law worlds pay a premium for what little arrives.
      mult = system.danger >= 3 ? rand(0.7, 1.0) : rand(1.4, 2.1)
    }

    const price = Math.max(1, Math.round(good.basePrice * mult * repMult * rand(0.92, 1.08)))
    return { goodId: good.id, price, quantity: qty }
  })
  // Missiles are a specialty item — available at tech >= 4 systems
  if (system.techLevel >= 4) {
    const missileGood = GOODS_BY_ID["missiles"]
    const mult = system.techLevel >= 7 ? rand(0.6, 0.85) : rand(0.9, 1.2)
    const qty = randInt(1, 5)
    const price = Math.max(1, Math.round(missileGood.basePrice * mult * repMult * rand(0.92, 1.08)))
    entries.push({ goodId: "missiles", price, quantity: qty })
  }
  return entries
}

/* ------------------------------- missions --------------------------------- */

function pickTargetSystem(
  currentId: string,
  minDistance: number,
  maxDistance: number,
): StarSystem | null {
  const current = SYSTEMS_BY_ID[currentId]
  const candidates = SYSTEMS.filter((s) => {
    if (s.id === currentId) return false
    const d = distanceBetween(current, s)
    return d >= minDistance && d <= maxDistance
  })
  if (candidates.length === 0) return null
  return candidates[randInt(0, candidates.length - 1)]
}

export function generateMissions(
  system: StarSystem,
  currentTurn: number,
): import("./types").Mission[] {
  // Number of missions based on tech level and economy
  const countBase = system.techLevel >= 8 ? 3 : system.techLevel >= 5 ? 2 : 1
  const count = Math.min(4, countBase + (chance(0.4) ? 1 : 0))

  const missions: import("./types").Mission[] = []
  const usedTypes = new Set<string>()

  const missionTemplates: Array<{
    type: import("./types").MissionType
    weight: number
    minTech: number
    generate: () => import("./types").Mission | null
  }> = [
    // --- delivery ---
    {
      type: "delivery",
      weight: 10,
      minTech: 1,
      generate() {
        const target = pickTargetSystem(system.id, 1, 4)
        if (!target) return null
        const profile = ECONOMY_PROFILE[target.economy]
        const candidates = GOODS.filter((g) => !g.illegal && profile.demands.includes(g.id))
        const good = candidates.length > 0 ? candidates[randInt(0, candidates.length - 1)] : GOODS.filter(g => !g.illegal)[randInt(0, GOODS.filter(g => !g.illegal).length - 1)]
        const qty = randInt(3, 8)
        const reward = Math.round(good.basePrice * qty * rand(1.2, 1.8))
        const deadline = currentTurn + legsFor(system, target) + randInt(2, 5)
        return {
          id: 0,
          type: "delivery",
          title: `Supply ${target.name}`,
          description: `Deliver ${qty}t of ${good.name} to ${target.name}. ${target.economy} worlds are paying premium rates.`,
          targetSystemId: target.id,
          factionId: target.factionId,
          requiredGoodId: good.id,
          requiredQty: qty,
          deadlineTurn: deadline,
          reward,
          completed: false,
          failed: false,
        }
      },
    },
    // --- courier ---
    {
      type: "courier",
      weight: 8,
      minTech: 3,
      generate() {
        const target = pickTargetSystem(system.id, 1, 3)
        if (!target) return null
        const deadline = currentTurn + legsFor(system, target) + randInt(1, 3)
        const reward = randInt(180, 500)
        return {
          id: 0,
          type: "courier",
          title: `Data Courier to ${target.name}`,
          description: `A corporate client needs a secure data chip delivered to ${target.name}. No cargo space required.`,
          targetSystemId: target.id,
          factionId: target.factionId,
          deadlineTurn: deadline,
          reward,
          completed: false,
          failed: false,
        }
      },
    },
    // --- bounty ---
    {
      type: "bounty",
      weight: 7,
      minTech: 1,
      generate() {
        const target = pickTargetSystem(system.id, 1, 3)
        if (!target) return null
        const deadline = currentTurn + legsFor(system, target) + randInt(3, 7)
        const reward = randInt(400, 1200)
        return {
          id: 0,
          type: "bounty",
          title: `Pirate Hunt near ${target.name}`,
          description: `A known pirate is operating in the ${target.name} sector. Destroy their ship and claim the bounty.`,
          targetSystemId: target.id,
          factionId: target.factionId,
          deadlineTurn: deadline,
          reward,
          completed: false,
          failed: false,
        }
      },
    },
    // --- smuggle ---
    {
      type: "smuggle",
      weight: 5,
      minTech: 2,
      generate() {
        const target = pickTargetSystem(system.id, 1, 3)
        if (!target) return null
        const illegalGoods = GOODS.filter((g) => g.illegal)
        const good = illegalGoods[randInt(0, illegalGoods.length - 1)]
        const qty = randInt(2, 5)
        const reward = Math.round(good.basePrice * qty * rand(2.0, 3.0))
        const deadline = currentTurn + legsFor(system, target) + randInt(3, 6)
        return {
          id: 0,
          type: "smuggle",
          title: `Discreet Delivery to ${target.name}`,
          description: `A shadowy figure needs ${qty}t of ${good.name} moved to ${target.name}. High risk, high reward — avoid police scans.`,
          targetSystemId: target.id,
          factionId: target.factionId,
          requiredGoodId: good.id,
          requiredQty: qty,
          deadlineTurn: deadline,
          reward,
          completed: false,
          failed: false,
        }
      },
    },
    // --- passenger ---
    {
      type: "passenger",
      weight: 6,
      minTech: 2,
      generate() {
        const target = pickTargetSystem(system.id, 1, 3)
        if (!target) return null
        const deadline = currentTurn + legsFor(system, target) + randInt(2, 4)
        const reward = randInt(300, 800)
        return {
          id: 0,
          type: "passenger",
          title: `Passenger to ${target.name}`,
          description: `A nervous passenger needs discrete transport to ${target.name}. Takes 1t of cabin space. May attract unwanted attention.`,
          targetSystemId: target.id,
          factionId: target.factionId,
          requiredQty: 1,
          deadlineTurn: deadline,
          reward,
          completed: false,
          failed: false,
        }
      },
    },
    // --- mining ---
    {
      type: "mining",
      weight: 5,
      minTech: 2,
      generate() {
        const target = pickTargetSystem(system.id, 1, 3)
        if (!target) return null
        const qty = randInt(3, 7)
        const reward = Math.round(95 * qty * rand(1.5, 2.2))
        const deadline = currentTurn + legsFor(system, target) + randInt(4, 8)
        return {
          id: 0,
          type: "mining",
          title: `Ore Contract for ${target.name}`,
          description: `A refinery on ${target.name} needs ${qty}t of raw Minerals. Mine them from asteroid fields on your way.`,
          targetSystemId: target.id,
          factionId: target.factionId,
          requiredGoodId: "minerals",
          requiredQty: qty,
          deadlineTurn: deadline,
          reward,
          completed: false,
          failed: false,
        }
      },
    },
    // --- rescue ---
    {
      type: "rescue",
      weight: 4,
      minTech: 3,
      generate() {
        const target = pickTargetSystem(system.id, 1, 3)
        if (!target) return null
        const deadline = currentTurn + legsFor(system, target) + randInt(2, 4)
        const reward = randInt(500, 1000)
        return {
          id: 0,
          type: "rescue",
          title: `Search & Rescue: ${target.name} Sector`,
          description: `A distress beacon has been traced to the ${target.name} spacelane. Investigate and rescue any survivors.`,
          targetSystemId: target.id,
          factionId: target.factionId,
          deadlineTurn: deadline,
          reward,
          completed: false,
          failed: false,
        }
      },
    },
    // --- exploration ---
    {
      type: "exploration",
      weight: 4,
      minTech: 4,
      generate() {
        const target = pickTargetSystem(system.id, 2, 5)
        if (!target) return null
        const deadline = currentTurn + legsFor(system, target) + randInt(3, 6)
        const reward = randInt(600, 1500)
        return {
          id: 0,
          type: "exploration",
          title: `Chart ${target.name}`,
          description: `The Explorers' Guild wants updated navigation data from ${target.name}. A long haul, but the pay is excellent.`,
          targetSystemId: target.id,
          factionId: target.factionId,
          deadlineTurn: deadline,
          reward,
          completed: false,
          failed: false,
        }
      },
    },
  ]

  const eligible = missionTemplates.filter((t) => system.techLevel >= t.minTech)
  if (eligible.length === 0) return []

  // Weighted random pick, no duplicates
  for (let i = 0; i < count && eligible.length > 0; i++) {
    const totalWeight = eligible.reduce((s, t) => s + (usedTypes.has(t.type) ? 0 : t.weight), 0)
    if (totalWeight <= 0) break
    let roll = rand(0, totalWeight)
    let picked: (typeof eligible)[0] | null = null
    for (const tpl of eligible) {
      if (usedTypes.has(tpl.type)) continue
      roll -= tpl.weight
      if (roll <= 0 || tpl === eligible[eligible.length - 1]) {
        picked = tpl
        break
      }
    }
    if (!picked) break
    const mission = picked.generate()
    if (mission) {
      usedTypes.add(picked.type)
      missions.push(mission)
    }
  }

  return missions
}

/* ---------------------------------- log ----------------------------------- */

function log(state: GameState, text: string, tone: LogTone = "info"): GameState {
  const entry: LogEntry = { id: state.nextLogId, text, tone }
  const next = [...state.log, entry]
  // keep the most recent 20 entries
  const trimmed = next.length > 20 ? next.slice(next.length - 20) : next
  return { ...state, log: trimmed, nextLogId: state.nextLogId + 1 }
}

/* ------------------------------- initial state ----------------------------- */

export function createInitialState(): GameState {
  const start = SYSTEMS_BY_ID[STARTING_SYSTEM_ID]
  return {
    phase: "menu",
    turn: 1,
    difficulty: "normal",
    credits: STARTING_CREDITS,
    ship: { ...STARTING_SHIP },
    cargo: {},
    currentSystemId: STARTING_SYSTEM_ID,
    market: generateMarket(start),
    voyage: null,
    event: null,
    enemy: null,
    playerEvading: false,
    destroyedShips: 0,
    snapshot: null,
    report: null,
    log: [],
    nextLogId: 1,
    missions: [],
    nextMissionId: 1,
    scannerLevel: 0,
    installedUpgrades: [],
    factionRep: { federation: 0, combine: 0, imperial: 0, cartel: 0 },
    crew: [],
    nextCrewId: 1,
    availableCrew: [],
    casino: null,
    lastBuyPrice: {},
    pendingFactionMission: null,
    factionMissionRequestedThisTurn: false,
  }
}

export function startNewGame(difficulty: Difficulty = "normal"): GameState {
  let s = { ...createInitialState(), difficulty }
  const startSystem = SYSTEMS_BY_ID[s.currentSystemId]
  s = {
    ...s,
    phase: "command",
    availableCrew: generateAvailableCrew(startSystem, [], s.factionRep[startSystem.factionId]),
  }
  s = log(
    s,
    `Turn 1. Commander, you are docked at ${startSystem.name} with ${STARTING_CREDITS} credits. Good hunting.`,
    "system",
  )
  return s
}

/* --------------------------------- enemies -------------------------------- */

const PIRATE_NAMES = [
  "Cobra Mk III 'Vulture'",
  "Sidewinder Raider",
  "Mamba Interceptor",
  "Krait Pirate",
  "Asp Marauder",
  "Gecko Corsair",
]

function createPirate(danger: number, turn: number, difficulty: Difficulty): Enemy {
  const cfg = DIFFICULTY_CONFIG[difficulty]
  const turnTier = Math.floor(turn * cfg.combatScale / 10)
  const tier = danger + randInt(0, 1) + turnTier
  const maxHull = randInt(28, 46) + tier * 8
  const maxShield = randInt(0, 14) + tier * 6
  return {
    name: PIRATE_NAMES[randInt(0, PIRATE_NAMES.length - 1)],
    hull: maxHull,
    maxHull,
    shield: maxShield,
    maxShield,
    damage: randInt(6, 10) + tier * 2,
    bounty: (maxHull + maxShield) * randInt(3, 6),
  }
}

function crewSkillSum(crew: CrewMember[], role: CrewRole): number {
  return crew
    .filter((c) => c.role === role)
    .reduce((s, c) => s + (c.skill ?? 1), 0)
}

function crewEvadeBonus(crew: CrewMember[]): number {
  const skill = crewSkillSum(crew, "pilot")
  if (skill === 0) return 0
  return Math.min(0.15, skill * (CREW_ROLE_BONUS.pilot.effect.evadeChancePerSkill ?? 0.03))
}

function crewDamageMult(crew: CrewMember[]): number {
  const skill = crewSkillSum(crew, "gunner")
  if (skill === 0) return 1
  const bonus = skill * (CREW_ROLE_BONUS.gunner.effect.weaponDamageMultPerSkill ?? 0.06)
  return 1 + Math.min(0.5, bonus)
}

function crewHullRepair(crew: CrewMember[]): number {
  const skill = crewSkillSum(crew, "engineer")
  if (skill === 0) return 0
  return skill * (CREW_ROLE_BONUS.engineer.effect.hullRepairPerSkill ?? 3)
}

function crewShieldRegen(crew: CrewMember[]): number {
  const skill = crewSkillSum(crew, "medic")
  if (skill === 0) return 0
  return skill * (CREW_ROLE_BONUS.medic.effect.shieldRegenPerSkill ?? 2)
}

function crewFuelSave(crew: CrewMember[]): number {
  const skill = crewSkillSum(crew, "navigator")
  return Math.floor(skill / 2)
}

function crewPoliceEvade(crew: CrewMember[]): number {
  const skill = crewSkillSum(crew, "smuggler")
  if (skill === 0) return 0
  return Math.min(0.20, skill * (CREW_ROLE_BONUS.smuggler.effect.policeEvadePerSkill ?? 0.04))
}

function crewWageFor(role: CrewRole, skill: number): number {
  return Math.round(CREW_WAGE[role] * (0.6 + skill * 0.4))
}

function crewTotalWages(crew: CrewMember[]): number {
  return crew.reduce((s, c) => s + c.wagePerTurn, 0)
}

const ALL_CREW_ROLES: CrewRole[] = ["pilot", "gunner", "engineer", "medic", "navigator", "smuggler"]

function generateAvailableCrew(system: StarSystem, currentCrew: CrewMember[], factionRep: number): CrewMember[] {
  const maxSkill = system.techLevel >= 8 ? 5 : system.techLevel >= 4 ? 3 : 2
  const poolCount = randInt(1, 3)

  // Determine eligible roles (no duplicates with current crew)
  const hiredRoles = new Set(currentCrew.map((c) => c.role))
  let eligibleRoles = ALL_CREW_ROLES.filter((r) => !hiredRoles.has(r))

  // Smugglers don't appear at Federation stations
  if (system.factionId === "federation") {
    eligibleRoles = eligibleRoles.filter((r) => r !== "smuggler")
  }

  if (eligibleRoles.length === 0) return []

  // Pick random subset
  const shuffled = eligibleRoles.sort(() => Math.random() - 0.5)
  const selected = shuffled.slice(0, Math.min(poolCount, eligibleRoles.length))

  const pool: CrewMember[] = []
  let nextId = Date.now() // placeholder IDs — real ID assigned on hire
  for (const role of selected) {
    // Weighted skill: mostly 1-2, rare 4-5
    let skill: number
    const r = Math.random()
    if (maxSkill >= 5 && r < 0.08) skill = 5
    else if (maxSkill >= 4 && r < 0.20) skill = 4
    else if (r < 0.45) skill = 3
    else if (r < 0.75) skill = 2
    else skill = 1
    skill = Math.min(skill, maxSkill)

    const wage = crewWageFor(role, skill)
    pool.push({
      id: pool.length,
      name: CREW_NAMES[randInt(0, CREW_NAMES.length - 1)],
      role,
      wagePerTurn: wage,
      skill,
    })
  }
  return pool
}

function changeRep(state: GameState, factionId: FactionId, delta: number): GameState {
  const newRep = clamp((state.factionRep[factionId] ?? 0) + delta, -10, 10)
  let s = { ...state, factionRep: { ...state.factionRep, [factionId]: newRep } }
  // Cross-faction rivalry: gain with one, lose with rival
  const faction = FACTIONS_BY_ID[factionId]
  if (faction.rival && delta > 0) {
    const rivalLoss = Math.min(delta, 2) // max -2 to rival per gain
    const rivalNew = clamp((s.factionRep[faction.rival] ?? 0) - rivalLoss, -10, 10)
    s = { ...s, factionRep: { ...s.factionRep, [faction.rival]: rivalNew } }
  }
  return s
}

function payCrewWages(state: GameState): GameState {
  if (state.crew.length === 0) return state
  const wages = crewTotalWages(state.crew)
  if (state.credits < wages) {
    // Crew abandons if unpaid
    return {
      ...state,
      crew: [],
      credits: Math.max(0, state.credits),
    }
  }
  return { ...state, credits: state.credits - wages }
}

function scannerBonus(level: number): { chanceBoost: number; cargoBoost: number } {
  if (level <= 0) return { chanceBoost: 0, cargoBoost: 0 }
  return { chanceBoost: level * 0.15, cargoBoost: level }
}

function createPolice(turn: number, difficulty: Difficulty): Enemy {
  const cfg = DIFFICULTY_CONFIG[difficulty]
  const turnTier = Math.floor(turn * cfg.combatScale / 10)
  const maxHull = randInt(55, 75) + turnTier * 6
  const maxShield = randInt(30, 45) + turnTier * 4
  return {
    name: "System Police Viper",
    hull: maxHull,
    maxHull,
    shield: maxShield,
    maxShield,
    damage: randInt(10, 14) + turnTier,
    bounty: 0,
  }
}

/* ------------------------------ event creation ----------------------------- */

// All possible non-combat leg events (weight, generator)
function legEventTemplates(
  state: GameState,
  region: StarSystem,
): Array<{ weight: number; generate: () => GameEvent | null }> {
  const carryingContraband = GOODS.some((g) => g.illegal && (state.cargo[g.id] ?? 0) > 0)
  const factionId = region.factionId
  const tradable = GOODS.filter((g) => !g.illegal)

  return [
    // --- Faction events ---
    {
      weight: 5,
      generate() {
        if (factionId !== "federation") return null
        return {
          kind: "fed_patrol",
          title: "Federation Patrol",
          text: "A Federation patrol wing requests a cargo manifest check. They're polite but armed.",
          options: [
            { id: "comply", label: "Transmit manifest" },
            { id: "refuse", label: "Refuse and alter course" },
          ],
        }
      },
    },
    {
      weight: 4,
      generate() {
        if (factionId !== "imperial") return null
        return {
          kind: "imp_warship",
          title: "Imperial Warship",
          text: "An Imperial warship demands you yield for inspection. Their guns are already tracking.",
          options: [
            { id: "yield", label: "Yield and comply" },
            { id: "resist", label: "Resist and engage drives" },
          ],
        }
      },
    },
    {
      weight: 5,
      generate() {
        if (factionId !== "combine") return null
        const reward = randInt(200, 500)
        return {
          kind: "combine_escort",
          title: "Combine Convoy Escort",
          text: `A Combine freighter convoy offers ${reward} cr for a temporary escort through this sector.`,
          options: [
            { id: "accept", label: `Accept escort contract (${reward} cr)` },
            { id: "decline", label: "Decline" },
          ],
          unitPrice: reward,
        }
      },
    },
    {
      weight: 5,
      generate() {
        if (factionId !== "cartel") return null
        const toll = randInt(150, 400)
        return {
          kind: "cartel_toll",
          title: "Cartel Passage Toll",
          text: `A Cartel raider demands ${toll} cr as a "passage toll" to continue through this space.`,
          options: [
            { id: "pay", label: `Pay ${toll} cr` },
            { id: "fight", label: "Refuse — they'll have to earn it" },
          ],
          unitPrice: toll,
        }
      },
    },
    {
      weight: 3,
      generate() {
        const rivals: Record<FactionId, string> = { federation: "Cartel", combine: "Imperial", imperial: "Combine", cartel: "Federation" }
        const rivalName = rivals[factionId]
        return {
          kind: "bounty_hunter",
          title: "Bounty Hunter Intercept",
          text: `A ${rivalName}-backed bounty hunter locks onto your jump signature. "You've made enemies, commander."`,
          options: [
            { id: "bribe", label: "Offer 200 cr to look the other way" },
            { id: "fight", label: "Battle stations!" },
          ],
        }
      },
    },
    {
      weight: 4,
      generate() {
        if (!carryingContraband && chance(0.5)) return null
        const good = GOODS.find((g) => g.illegal && (state.cargo[g.id] ?? 0) > 0) || GOODS.filter((g) => g.illegal)[randInt(0, GOODS.filter((g) => g.illegal).length - 1)]
        const qty = randInt(2, 4)
        return {
          kind: "smuggler_hide",
          title: "Smuggler's Plea",
          text: `A smuggler fleeing a Federation scan begs you to hold ${qty}t of ${good.name}. "I'll split the profit when we reach port!"`,
          options: [
            { id: "help", label: `Take ${qty}t of ${good.name}` },
            { id: "decline", label: "Not my problem" },
          ],
          goodId: good.id,
          qty,
        }
      },
    },
    {
      weight: 3,
      generate() {
        if (factionId !== "imperial") return null
        const bribe = randInt(100, 300)
        return {
          kind: "imp_checkpoint",
          title: "Imperial Checkpoint",
          text: `An Imperial checkpoint blocks the spacelane. The officer demands ${bribe} cr to expedite clearance.`,
          options: [
            { id: "bribe", label: `Pay ${bribe} cr bribe` },
            { id: "divert", label: "Take the long way around" },
          ],
          unitPrice: bribe,
        }
      },
    },
    {
      weight: 3,
      generate() {
        if (factionId !== "combine") return null
        return {
          kind: "combine_distress",
          title: "Combine Distress Call",
          text: "A Combine transport screams for help — but the signal pattern looks suspiciously like a Cartel trap.",
          options: [
            { id: "investigate", label: "Investigate (could be legitimate)" },
            { id: "ignore", label: "Ignore — too risky" },
          ],
        }
      },
    },
    {
      weight: 4,
      generate() {
        if (factionId !== "cartel") return null
        const good = GOODS.filter((g) => g.illegal)[randInt(0, GOODS.filter((g) => g.illegal).length - 1)]
        const unitPrice = Math.round(good.basePrice * rand(0.3, 0.5))
        const qty = randInt(2, 5)
        return {
          kind: "cartel_informant",
          title: "Cartel Informant",
          text: `A Cartel informant offers ${qty}t of ${good.name} at ${unitPrice} cr each — well below black market rates.`,
          options: [
            { id: "buy", label: `Buy ${qty}t for ${unitPrice * qty} cr` },
            { id: "decline", label: "Decline" },
          ],
          goodId: good.id,
          unitPrice,
          qty,
        }
      },
    },
    {
      weight: 4,
      generate() {
        if (factionId !== "federation") return null
        return {
          kind: "fed_rescue",
          title: "Federation Rescue Op",
          text: "A Federation rescue operation is underway — a medical frigate was hit by pirates. They could use cover, or... the cargo pods are drifting unguarded.",
          options: [
            { id: "assist", label: "Assist the rescue (honour)" },
            { id: "loot", label: "Loot the cargo pods (profit)" },
          ],
        }
      },
    },
    // --- NEW Faction events ---
    {
      weight: 4,
      generate() {
        if (factionId !== "imperial") return null
        return {
          kind: "imp_bounty",
          title: "Imperial Bounty Notice",
          text: "The Imperial Directorate posts a bounty on a notorious pirate lord operating nearby. Hunt them down for glory and credits.",
          options: [
            { id: "accept_bounty", label: "Accept the bounty hunt" },
            { id: "decline_bounty", label: "Decline" },
          ],
        }
      },
    },
    {
      weight: 4,
      generate() {
        if (factionId !== "combine") return null
        return {
          kind: "combine_research",
          title: "Combine Research Data",
          text: "A Combine lab transport was attacked — priceless research data is drifting in a wrecked courier. Retrieve it for a reward.",
          options: [
            { id: "recover", label: "Recover the research data" },
            { id: "ignore", label: "Not interested" },
          ],
        }
      },
    },
    {
      weight: 5,
      generate() {
        if (factionId !== "cartel") return null
        const target = SYSTEMS.filter((s) => s.id !== state.currentSystemId && s.id !== region.id)
        const dest = target[randInt(0, target.length - 1)]
        const good = GOODS.filter((g) => g.illegal)[randInt(0, GOODS.filter((g) => g.illegal).length - 1)]
        const qty = randInt(2, 4)
        const reward = Math.round(good.basePrice * qty * rand(1.8, 2.5))
        return {
          kind: "cartel_smuggle",
          title: "Cartel Smuggling Run",
          text: `A Cartel contact needs ${qty}t of ${good.name} moved to ${dest.name}. They'll front the cargo — get it past the patrols. Reward: ${reward} cr.`,
          options: [
            { id: "accept_smuggle", label: `Take the run to ${dest.name}` },
            { id: "decline", label: "Too hot to handle" },
          ],
          goodId: good.id,
          qty,
          unitPrice: reward,
        }
      },
    },
    {
      weight: 4,
      generate() {
        if (factionId !== "federation") return null
        return {
          kind: "fed_relief",
          title: "Federation Relief Convoy",
          text: "A Federation relief convoy is under attack by raiders! They're calling for any nearby ships to assist.",
          options: [
            { id: "defend", label: "Defend the convoy" },
            { id: "ignore", label: "Stay out of it" },
          ],
        }
      },
    },
    // --- NEW Independent events ---
    {
      weight: 5,
      generate() {
        return {
          kind: "cargo_pod",
          title: "Abandoned Cargo Pod",
          text: "A cargo pod drifts in space, its beacon flashing. Scans show intact goods — but the pod's hull shows recent laser scoring. Could be bait.",
          options: [
            { id: "salvage", label: "Tractor the pod aboard" },
            { id: "leave", label: "Leave it — too suspicious" },
          ],
        }
      },
    },
    {
      weight: 4,
      generate() {
        const nearest = SYSTEMS.filter((s) => s.id !== state.currentSystemId && s.id !== region.id)
        const dest = nearest[randInt(0, nearest.length - 1)]
        const reward = randInt(200, 500)
        return {
          kind: "refugee_ship",
          title: "Refugee Ship",
          text: `A cramped refugee ship hails you — ${randInt(15, 40)} souls fleeing conflict, desperate for transport to ${dest.name}. They can pay ${reward} cr. Takes 1t of cabin space.`,
          options: [
            { id: "help", label: `Transport them to ${dest.name} (${reward} cr)` },
            { id: "decline", label: "No room for passengers" },
          ],
          goodId: dest.id,
          unitPrice: reward,
        }
      },
    },
    {
      weight: 3,
      generate() {
        return {
          kind: "stowaway",
          title: "Stowaway Discovered",
          text: "Your engineer reports a stowaway hiding in the cargo bay — a young kid fleeing a Cartel press gang. They beg to stay aboard.",
          options: [
            { id: "help", label: "Let them stay (free crew recruit)" },
            { id: "turnin", label: "Turn them over to the Cartel for a reward" },
          ],
        }
      },
    },
    {
      weight: 4,
      generate() {
        if (chance(0.5)) {
          return {
            kind: "sensor_ghost",
            title: "Sensor Ghost",
            text: "Your long-range scanner pings a massive contact — then it vanishes. Could be a sensor ghost... or a stealthed ship playing dead.",
            options: [
              { id: "investigate", label: "Investigate the ghost contact" },
              { id: "ignore", label: "Ignore — sensor glitch" },
            ],
          }
        }
        return null
      },
    },
    {
      weight: 3,
      generate() {
        return {
          kind: "comet_fragment",
          title: "Comet Fragment",
          text: "A rare comet core drifts through the sector — rich in exotic isotopes worth a fortune. Mining it is risky but potentially lucrative.",
          options: [
            { id: "mine", label: "Deploy mining laser on the comet" },
            { id: "skip", label: "Skip — too volatile" },
          ],
        }
      },
    },
    {
      weight: 4,
      generate() {
        return {
          kind: "quarantine_zone",
          title: "Quarantine Zone",
          text: "A medical blockade cordons off this sector — a Class-3 biohazard warning. Passing through risks contamination, but going around adds a turn.",
          options: [
            { id: "sneak", label: "Sneak through the quarantine" },
            { id: "detour", label: "Take the long way around (+1 turn)" },
          ],
        }
      },
    },
    // --- Independent events ---
    {
      weight: 6,
      generate() {
        return {
          kind: "derelict",
          title: "Derelict Ship Adrift",
          text: "Your scanner pings a powered-down hulk drifting in the dark. It might hold salvage — or a nasty surprise.",
          options: [
            { id: "salvage", label: "Board and salvage" },
            { id: "ignore", label: "Leave it alone" },
          ],
        }
      },
    },
    {
      weight: 6,
      generate() {
        return {
          kind: "asteroid",
          title: "Asteroid Field",
          text: "Your route passes through a dense asteroid field rich with ore — and hull-cracking rocks.",
          options: [
            { id: "mine", label: "Mine the asteroids" },
            { id: "avoid", label: "Plot a safe course around" },
          ],
        }
      },
    },
    {
      weight: 3,
      generate() {
        return {
          kind: "solar_flare",
          title: "Solar Flare",
          text: "A sudden solar flare washes over your ship, scrambling your shield generators.",
          options: [
            { id: "brace", label: "Brace and reroute power" },
            { id: "drift", label: "Drift through — conserve systems" },
          ],
        }
      },
    },
    {
      weight: 2,
      generate() {
        const dest = SYSTEMS.filter((s) => s.id !== state.currentSystemId && s.id !== region.id)
        const target = dest[randInt(0, dest.length - 1)]
        return {
          kind: "wormhole",
          title: "Unstable Wormhole",
          text: `A swirling wormhole crackles open ahead. Scanners show it leads somewhere near ${target.name}. It could collapse any second.`,
          options: [
            { id: "enter", label: `Enter — jump to ${target.name}` },
            { id: "avoid", label: "Back away slowly" },
          ],
          goodId: target.id,
        }
      },
    },
    {
      weight: 5,
      generate() {
        return {
          kind: "distress",
          title: "Distress Beacon",
          text: "A faint distress call crackles over the comm. A stranded trader begs for assistance nearby.",
          options: [
            { id: "help", label: "Investigate the signal" },
            { id: "ignore", label: "Ignore and proceed" },
          ],
        }
      },
    },
    {
      weight: 4,
      generate() {
        return {
          kind: "pirate_ambush",
          title: "Pirate Ambush",
          text: "Pirates burst from an asteroid blind spot! They had the perfect hiding place.",
          options: [
            { id: "fight", label: "Evasive combat!" },
            { id: "flee", label: "Full power to engines — flee!" },
          ],
        }
      },
    },
    {
      weight: 2,
      generate() {
        return {
          kind: "alien_artifact",
          title: "Mysterious Alien Artifact",
          text: "A strange crystalline object drifts in space, pulsing with an eerie blue light. It's unlike any known technology.",
          options: [
            { id: "grab", label: "Tractor it aboard" },
            { id: "leave", label: "Leave it drifting" },
          ],
        }
      },
    },
    {
      weight: 4,
      generate() {
        return {
          kind: "fuel_leak",
          title: "Fuel Leak Detected",
          text: "Your engineer reports a micro-fracture in the fuel line. You're venting plasma — lose extra fuel this leg.",
          options: [
            { id: "patch", label: "Attempt a patch (may fail)" },
            { id: "burn", label: "Burn hard and minimize the loss" },
          ],
        }
      },
    },
    {
      weight: 3,
      generate() {
        const nearest = SYSTEMS.filter((s) => s.id !== state.currentSystemId && s.id !== region.id)
        const alt = nearest[randInt(0, nearest.length - 1)]
        return {
          kind: "nav_glitch",
          title: "Navigation Computer Glitch",
          text: `Your nav computer glitches — the plotted route is corrupted. Nearest safe system is ${alt.name}.`,
          options: [
            { id: "reroute", label: `Reroute to ${alt.name}` },
            { id: "manual", label: "Manual navigation (risk getting lost)" },
          ],
          goodId: alt.id,
        }
      },
    },
    {
      weight: 5,
      generate() {
        const good = tradable[randInt(0, tradable.length - 1)]
        const theirGood = tradable[randInt(0, tradable.length - 1)]
        const qty = randInt(2, 6)
        return {
          kind: "convoy_swap",
          title: "Trade Convoy Offer",
          text: `A passing convoy offers to swap — they'll trade ${qty}t of ${theirGood.name} for ${qty}t of ${good.name}.`,
          options: [
            { id: "accept", label: `Swap for ${theirGood.name}` },
            { id: "decline", label: "Decline" },
          ],
          goodId: theirGood.id,
          qty,
        }
      },
    },
    {
      weight: 4,
      generate() {
        return {
          kind: "mining_field",
          title: "Uncharted Mining Field",
          text: "Scanners detect a rich, uncharted asteroid field dense with rare ore. Spend 1 extra turn mining?",
          options: [
            { id: "mine", label: "Stop and mine (1 extra turn)" },
            { id: "skip", label: "Skip — stay on schedule" },
          ],
        }
      },
    },
    {
      weight: 5,
      generate() {
        const good = tradable[randInt(0, tradable.length - 1)]
        const unitPrice = Math.round(good.basePrice * rand(0.5, 0.75))
        const qty = randInt(3, 8)
        return {
          kind: "trader",
          title: "Free Trader Rendezvous",
          text: `A friendly free trader offers ${qty}t of ${good.name} at ${unitPrice} cr each — well below market.`,
          options: [
            { id: "buy", label: `Buy ${qty}t for ${unitPrice * qty} cr` },
            { id: "decline", label: "Decline the offer" },
          ],
          goodId: good.id,
          unitPrice,
          qty,
        }
      },
    },
  ]
}

// Roll the encounter for a single leg. `silent` greatly reduces hostile contact.
function pickLegEvent(
  state: GameState,
  region: StarSystem,
  silent: boolean,
): "combat" | GameEvent | null {
  const dangerMult = silent ? 0.15 : 1
  const r = Math.random()
  const pirateChance = (0.1 + region.danger * 0.12) * dangerMult
  const carryingContraband = GOODS.some(
    (g) => g.illegal && (state.cargo[g.id] ?? 0) > 0,
  )

  if (r < pirateChance) return "combat"

  // Police interdiction — more likely if you're dirty or have low rep
  const rep = state.factionRep[region.factionId] ?? 0
  const policeBase = carryingContraband ? 0.28 : 0.08
  const policeRepMult = rep >= 8 ? 0.2 : rep >= 5 ? 0.5 : rep <= -8 ? 2.5 : rep <= -4 ? 1.8 : 1
  const smugglerEvade = crewPoliceEvade(state.crew)
  const policeChance = policeBase * dangerMult * policeRepMult * (1 - smugglerEvade)
  if (r < pirateChance + policeChance) {
    return {
      kind: "police",
      title: "Police Interdiction",
      text: carryingContraband
        ? `A ${region.name} police Viper signals you to halt for a cargo scan. Your manifest includes contraband...`
        : `A ${region.name} police Viper hails you for a routine cargo scan.`,
      options: [
        { id: "submit", label: "Submit to scan" },
        { id: "run", label: "Run for it" },
      ],
    }
  }

  // Non-combat encounters — pick from weighted templates
  const r2 = Math.random()
  if (r2 < 0.55) {
    // Generate all valid events
    const allTemplates = legEventTemplates(state, region)
    const generated: { weight: number; event: GameEvent }[] = []
    for (const tpl of allTemplates) {
      const ev = tpl.generate()
      if (ev) generated.push({ weight: tpl.weight, event: ev })
    }
    if (generated.length > 0) {
      const totalWeight = generated.reduce((s, g) => s + g.weight, 0)
      let roll = rand(0, totalWeight)
      for (const g of generated) {
        roll -= g.weight
        if (roll <= 0) return g.event
      }
      return generated[0].event
    }
  }

  return null // clear leg
}

/* ----------------------------- turn lifecycle ------------------------------ */

// Check and complete missions that have been fulfilled.
function checkMissionCompletions(state: GameState): GameState {
  let s = state
  const here = s.currentSystemId
  const active = s.missions.filter((m) => !m.completed && !m.failed)
  for (const mission of active) {
    // Only complete if docked at the target system
    if (mission.targetSystemId !== here) continue

    // Delivery / Smuggle / Mining: docked at target with required goods in hold
    if (
      (mission.type === "delivery" ||
        mission.type === "smuggle" ||
        mission.type === "mining") &&
      mission.requiredGoodId &&
      mission.requiredQty
    ) {
      const held = s.cargo[mission.requiredGoodId] ?? 0
      if (held >= mission.requiredQty) {
        const destFaction = mission.factionId ?? SYSTEMS_BY_ID[mission.targetSystemId]?.factionId ?? "federation"
        s = {
          ...s,
          cargo: { ...s.cargo, [mission.requiredGoodId!]: held - mission.requiredQty },
          credits: s.credits + mission.reward,
          missions: s.missions.map((m) =>
            m.id === mission.id ? { ...m, completed: true } : m,
          ),
          factionRep: { ...s.factionRep, [destFaction]: Math.min(10, (s.factionRep[destFaction] ?? 0) + 1) },
        }
        if (s.cargo[mission.requiredGoodId!] <= 0) {
          const c = { ...s.cargo }
          delete c[mission.requiredGoodId!]
          s = { ...s, cargo: c }
        }
        s = log(s, `Mission complete: ${mission.title}. Earned ${mission.reward} cr.`, "good")
      }
    }
    // Courier / Exploration / Rescue / Passenger: just reach the target
    if (
      mission.type === "courier" ||
      mission.type === "exploration" ||
      mission.type === "rescue" ||
      mission.type === "passenger"
    ) {
      const destFaction = mission.factionId ?? SYSTEMS_BY_ID[mission.targetSystemId]?.factionId ?? "federation"
      s = {
        ...s,
        credits: s.credits + mission.reward,
        missions: s.missions.map((m) =>
          m.id === mission.id ? { ...m, completed: true } : m,
        ),
        factionRep: { ...s.factionRep, [destFaction]: Math.min(10, (s.factionRep[destFaction] ?? 0) + 1) },
      }
      s = log(s, `Mission complete: ${mission.title}. Earned ${mission.reward} cr.`, "good")
    }
  }
  return s
}

// Check for deadline failures
function checkMissionDeadlines(state: GameState): GameState {
  let s = state
  const active = s.missions.filter((m) => !m.completed && !m.failed)
  for (const mission of active) {
    if (s.turn > mission.deadlineTurn) {
      s = {
        ...s,
        missions: s.missions.map((m) =>
          m.id === mission.id ? { ...m, failed: true } : m,
        ),
      }
      s = log(s, `Mission expired: ${mission.title} — deadline passed.`, "bad")
    }
  }
  return s
}

// End the current leg/turn and return to the command phase.
function settleLeg(state: GameState): GameState {
  let s = checkMissionDeadlines(state)
  // Engineer hull repair (after possible deadline damage)
  const hullRepair = crewHullRepair(s.crew)
  if (hullRepair > 0 && s.ship.hull < s.ship.maxHull && s.ship.hull > 0) {
    const newHull = Math.min(s.ship.maxHull, s.ship.hull + hullRepair)
    s = { ...s, ship: { ...s.ship, hull: newHull } }
  }
  // Pay crew wages every turn
  if (s.crew.length > 0) {
    s = payCrewWages(s)
  }
  const v = s.voyage
  const arrived = v !== null && v.legsDone >= v.legsTotal
  // Exploration trips return to origin system
  const destId = arrived && v.exploration && v.originSystemId ? v.originSystemId : v?.destinationId ?? s.currentSystemId
  if (arrived) {
    const dest = SYSTEMS_BY_ID[destId]
    // Check hostile docking
    const destRep = s.factionRep[dest.factionId] ?? 0
    if (destRep <= -8 && dest.danger < 3) {
      // Denied docking at high-security stations
      const escape = nearestSystem(dest.id)
      s = log(s, `${dest.name} Control denies docking clearance. Hostile standing. Diverting to ${escape.name}.`, "bad")
      s = {
        ...s,
        phase: "command",
        currentSystemId: escape.id,
        voyage: null,
        snapshot: null,
        report: null,
        enemy: null,
        event: null,
        playerEvading: false,
        pendingFactionMission: null,
        factionMissionRequestedThisTurn: false,
        market: generateMarket(escape, s.factionRep[escape.factionId]),
        availableCrew: generateAvailableCrew(escape, s.crew, s.factionRep[escape.factionId]),
      }
    } else {
      s = {
        ...s,
        phase: "command",
        currentSystemId: dest.id,
        voyage: null,
        snapshot: null,
        report: null,
        enemy: null,
        event: null,
        playerEvading: false,
        pendingFactionMission: null,
        factionMissionRequestedThisTurn: false,
        market: generateMarket(dest, s.factionRep[dest.factionId]),
        availableCrew: generateAvailableCrew(dest, s.crew, s.factionRep[dest.factionId]),
      }
      s = log(
        s,
        `Docked at ${dest.name} Station. (${dest.economy}, Tech ${dest.techLevel})`,
        "system",
      )
    }
    s = checkMissionCompletions(s)
    return s
  }
  return {
    ...s,
    phase: "command",
    snapshot: null,
    report: null,
    enemy: null,
    event: null,
    playerEvading: false,
  }
}

// Advance one leg of the active voyage: burn fuel, roll an event, resolve or defer.
function advanceLeg(state: GameState, silent: boolean): GameState {
  if (!state.voyage) return state
  let s = state

  const fuelSave = crewFuelSave(s.crew)
  const fuelUse = Math.max(1, (silent ? 2 : 1) - fuelSave)
  const legsDone = s.voyage!.legsDone + 1
  const region = SYSTEMS_BY_ID[s.voyage!.destinationId]
  s = {
    ...s,
    turn: s.turn + 1,
    ship: { ...s.ship, fuel: Math.max(0, s.ship.fuel - fuelUse) },
    voyage: { ...s.voyage!, legsDone },
  }

  const exploration = s.voyage!.exploration

  if (legsDone === 1) {
    const label = exploration === "ambush" ? "On patrol — hunting pirates" : exploration === "asteroids" ? "Prospecting — mining run" : `course set for ${region.name} — ${s.voyage!.legsTotal} leg run`
    s = log(
      s,
      `Turn ${s.turn}: ${label}. Drive engaged.`,
      "system",
    )
  } else {
    const label = exploration === "ambush" ? `Sweep ${legsDone}/${s.voyage!.legsTotal} — scanning for prey` : exploration === "asteroids" ? `Sector ${legsDone}/${s.voyage!.legsTotal} — scanning for ore` : `leg ${legsDone}/${s.voyage!.legsTotal} toward ${region.name}`
    s = log(
      s,
      `Turn ${s.turn}: ${label}.`,
      "system",
    )
  }
  if (silent) s = log(s, "Running silent — minimal emissions.", "info")

  s = checkMissionDeadlines(s)

  let outcome: "combat" | GameEvent | null
  if (exploration) {
    outcome = pickExplorationEvent(s, region, exploration)
  } else {
    outcome = pickLegEvent(s, region, silent)
  }

  if (outcome === "combat") {
    const enemy = exploration === "ambush"
      ? createPirate(region.danger + 1, s.turn, s.difficulty)
      : createPirate(region.danger, s.turn, s.difficulty)
    s = { ...s, phase: "combat", enemy, playerEvading: !exploration }
    const msg = exploration === "ambush" ? `Target spotted! A ${enemy.name} — closing for the ambush!` : `Mass-lock! A ${enemy.name} drops out of warp and opens fire!`
    s = log(s, msg, "combat")
    return s
  }
  if (outcome && typeof outcome === "object") {
    s = { ...s, phase: "event", event: outcome }
    s = log(s, `${outcome.title}.`, "info")
    return s
  }

  s = log(
    s,
    exploration ? (exploration === "ambush" ? "Patrol sweep — no contacts." : "Sector scanned — no ore deposits found.") : (silent ? "Silent running — you slip through undetected." : "Clear space — no contacts."),
    "info",
  )
  return settleLeg(s)
}

// Roll encounter for exploration trips (ambush or asteroid biased)
function pickExplorationEvent(
  state: GameState,
  region: StarSystem,
  kind: "ambush" | "asteroids",
): "combat" | GameEvent | null {
  const r = Math.random()

  if (kind === "ambush") {
    // ~55% ambush opportunity, ~15% danger, ~15% random event, ~15% nothing
    if (r < 0.55) {
      return {
        kind: "ambush_opportunity",
        title: "Target Detected",
        text: `Scanners lock onto a ship in ${region.name} space. They haven't spotted you — perfect ambush position.`,
        options: [
          { id: "engage", label: "Ambush now — first strike!" },
          { id: "letgo", label: "Let them pass" },
        ],
      }
    }
    if (r < 0.70) {
      // Dangerous counter-ambush
      return "combat"
    }
    if (r < 0.85) {
      // Pick a random standard event
      const tpls = legEventTemplates(state, region)
      const generated: { weight: number; event: GameEvent }[] = []
      for (const tpl of tpls) {
        const ev = tpl.generate()
        if (ev) generated.push({ weight: tpl.weight, event: ev })
      }
      if (generated.length > 0) {
        const totalWeight = generated.reduce((s, g) => s + g.weight, 0)
        let roll = rand(0, totalWeight)
        for (const g of generated) {
          roll -= g.weight
          if (roll <= 0) return g.event
        }
        return generated[0].event
      }
    }
    return null
  }

  // Asteroids — ~50% mining, ~15% wreck/salvage, ~10% pirates, ~15% danger, ~10% nothing
  if (r < 0.50) {
    return {
      kind: "asteroid_field_explore",
      title: "Rich Asteroid Field",
      text: "A dense field of mineral-rich asteroids stretches before you. Prime for mining, but watch for unstable rocks.",
      options: [
        { id: "mine", label: "Deploy mining laser" },
        { id: "avoid", label: "Too risky — navigate around" },
      ],
    }
  }
  if (r < 0.65) {
    return {
      kind: "derelict",
      title: "Derelict Ship Adrift",
      text: "Your scanner pings a powered-down hulk drifting in the dark. It might hold salvage — or a nasty surprise.",
      options: [
        { id: "salvage", label: "Board and salvage" },
        { id: "ignore", label: "Leave it alone" },
      ],
    }
  }
  if (r < 0.75) {
    return "combat"
  }
  if (r < 0.90) {
    return {
      kind: "unstable_asteroid",
      title: "Unstable Asteroid",
      text: "A massive asteroid cracks apart ahead — debris is flying toward your ship!",
      options: [
        { id: "dodge", label: "Evasive maneuvers" },
        { id: "brace", label: "Brace for impact" },
      ],
    }
  }
  return null
}

/* --------------------------------- actions -------------------------------- */

export type Action =
  | { type: "NEW_GAME"; difficulty: Difficulty }
  | { type: "BUY"; goodId: string; qty: number }
  | { type: "SELL"; goodId: string; qty: number }
  | { type: "DEPART"; systemId: string }
  | { type: "ADVANCE" }
  | { type: "RUN_SILENT" }
  | { type: "ABORT" }
  | { type: "LAYOVER" }
  | { type: "EXPLORE_AMBUSH" }
  | { type: "EXPLORE_ASTEROIDS" }
  | { type: "EVENT_CHOICE"; optionId: string }
  | { type: "COMBAT_ACTION"; action: "fire" | "missile" | "evade" | "flee" }
  | { type: "BUY_UPGRADE"; upgradeId: string }
  | { type: "REFUEL" }
  | { type: "REPAIR" }
  | { type: "ACCEPT_MISSION"; mission: import("./types").Mission }
  | { type: "ABANDON_MISSION"; missionId: number }
  | { type: "HIRE_CREW"; index: number }
  | { type: "FIRE_CREW"; crewId: number }
  | { type: "ENTER_CASINO" }
  | { type: "LEAVE_CASINO" }
  | { type: "CASINO_BET"; amount: number }
  | { type: "CASINO_HIT" }
  | { type: "CASINO_STAND" }
  | { type: "CASINO_DOUBLE" }
  | { type: "REQUEST_FACTION_MISSION"; factionId: FactionId }
  | { type: "REFUSE_FACTION_MISSION" }

/* --------------------------------- combat ---------------------------------- */

function damageEnemy(enemy: Enemy, dmg: number): Enemy {
  let remaining = dmg
  let shield = enemy.shield
  if (shield > 0) {
    const absorbed = Math.min(shield, remaining)
    shield -= absorbed
    remaining -= absorbed
  }
  const hull = enemy.hull - remaining
  return { ...enemy, shield, hull }
}

function applyDamageToShip(state: GameState, dmg: number): GameState {
  let remaining = dmg
  let { shield, hull } = state.ship
  if (shield > 0) {
    const absorbed = Math.min(shield, remaining)
    shield -= absorbed
    remaining -= absorbed
  }
  hull -= remaining
  return { ...state, ship: { ...state.ship, shield, hull } }
}

function enemyTurn(state: GameState, enemy: Enemy): GameState {
  let s = state
  // Regenerate a sliver of player shield each round.
  if (!s.playerEvading) {
    s = {
      ...s,
      ship: {
        ...s.ship,
        shield: clamp(s.ship.shield + 4 + crewShieldRegen(s.crew), 0, s.ship.maxShield),
      },
    }
  }

  const evadeChance = 0.55 + crewEvadeBonus(s.crew)
  if (s.playerEvading && chance(evadeChance)) {
    s = log(s, `You juke hard — the ${enemy.name}'s shots go wide.`, "combat")
    s = { ...s, playerEvading: false }
    return s
  }

  const dmg = Math.round(enemy.damage * rand(0.8, 1.2))
  s = applyDamageToShip(s, dmg)
  s = log(s, `The ${enemy.name} hits you for ${dmg} damage.`, "bad")
  s = { ...s, playerEvading: false }

  if (s.ship.hull <= 0) {
    s = { ...s, ship: { ...s.ship, hull: 0 }, phase: "gameover" }
    s = log(s, "Your hull is breached! Your ship is lost to the void...", "bad")
  }
  return s
}

function handleEnemyDestroyed(state: GameState): GameState {
  let s = state
  const enemy = s.enemy!
  const bounty = enemy.bounty
  s = {
    ...s,
    enemy: null,
    destroyedShips: s.destroyedShips + 1,
    credits: s.credits + bounty,
  }
  if (bounty > 0) {
    s = log(s, `${enemy.name} destroyed! Bounty collected: ${bounty} cr.`, "good")
  } else {
    s = log(s, `${enemy.name} destroyed.`, "good")
  }

  // Chance to scoop loose cargo from the wreck.
  const bonus = scannerBonus(s.scannerLevel)
  if (chance(0.5 + bonus.chanceBoost)) {
    const free = s.ship.cargoCapacity - cargoUsed(s.cargo)
    if (free > 0) {
      const good = GOODS[randInt(0, GOODS.length - 1)]
      const amount = Math.min(free, randInt(1 + bonus.cargoBoost, 4 + bonus.cargoBoost))
      s = {
        ...s,
        cargo: { ...s.cargo, [good.id]: (s.cargo[good.id] ?? 0) + amount },
      }
      s = log(s, `Scooped ${amount}t of ${good.name} from the wreckage.`, "good")
    }
  }

  s = log(s, "Threat eliminated.", "good")

  // Faction reputation changes
  const region = SYSTEMS_BY_ID[s.voyage?.destinationId ?? s.currentSystemId]
  if (enemy.bounty > 0) {
    // Pirate kill: +rep with current region's faction
    const factionId = region.factionId
    s = { ...s, factionRep: { ...s.factionRep, [factionId]: Math.min(10, (s.factionRep[factionId] ?? 0) + 2) } }
    // +1 with Imperial and Combine too
    s = { ...s, factionRep: { ...s.factionRep, imperial: Math.min(10, (s.factionRep.imperial ?? 0) + 1), combine: Math.min(10, (s.factionRep.combine ?? 0) + 1) } }
    if (factionId !== "cartel") {
      s = { ...s, factionRep: { ...s.factionRep, cartel: Math.max(-10, (s.factionRep.cartel ?? 0) - 1) } }
    }
  } else {
    // Police kill: -rep with current region's faction, +rep with cartel
    const factionId = region.factionId
    s = { ...s, factionRep: { ...s.factionRep, [factionId]: Math.max(-10, (s.factionRep[factionId] ?? 0) - 3), cartel: Math.min(10, (s.factionRep.cartel ?? 0) + 1) } }
    s = log(s, `${factionId === "cartel" ? "Cartel" : "Authorities"} won't forget this.`, "bad")
  }

  // Check bounty missions
  const destId = s.voyage?.destinationId ?? s.currentSystemId
  const activeBounties = s.missions.filter(
    (m) => !m.completed && !m.failed && m.type === "bounty" && m.targetSystemId === destId,
  )
  for (const mission of activeBounties) {
    s = {
      ...s,
      credits: s.credits + mission.reward,
      missions: s.missions.map((m) =>
        m.id === mission.id ? { ...m, completed: true } : m,
      ),
    }
    s = log(s, `Bounty complete: ${mission.title}. Earned ${mission.reward} cr.`, "good")
  }

  return settleLeg(s)
}

// Find the closest system to the commander's current origin (for escapes/aborts).
function nearestSystem(fromId: string): StarSystem {
  const from = SYSTEMS_BY_ID[fromId]
  return SYSTEMS.filter((sys) => sys.id !== fromId).sort(
    (a, b) => distanceBetween(from, a) - distanceBetween(from, b),
  )[0]
}

/* --------------------------------- reducer --------------------------------- */

export function gameReducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case "NEW_GAME":
      return startNewGame(action.difficulty)

    case "BUY": {
      if (!isDocked(state)) return state
      const entry = state.market.find((m) => m.goodId === action.goodId)
      if (!entry) return state
      if (action.goodId === "missiles") {
        const maxMissiles = 8
        const maxAffordable = Math.floor(state.credits / entry.price)
        const qty = clamp(action.qty, 0, Math.min(entry.quantity, maxMissiles - state.ship.missiles, maxAffordable))
        if (qty <= 0) return state
        const cost = qty * entry.price
        return {
          ...state,
          credits: state.credits - cost,
          ship: { ...state.ship, missiles: state.ship.missiles + qty },
          market: state.market.map((m) =>
            m.goodId === action.goodId ? { ...m, quantity: m.quantity - qty } : m,
          ),
          lastBuyPrice: { ...state.lastBuyPrice, [action.goodId]: entry.price },
        }
      }
      const free = state.ship.cargoCapacity - cargoUsed(state.cargo)
      const maxAffordable = Math.floor(state.credits / entry.price)
      const qty = clamp(action.qty, 0, Math.min(entry.quantity, free, maxAffordable))
      if (qty <= 0) return state
      const cost = qty * entry.price
      let s: GameState = {
        ...state,
        credits: state.credits - cost,
        cargo: { ...state.cargo, [action.goodId]: (state.cargo[action.goodId] ?? 0) + qty },
        market: state.market.map((m) =>
          m.goodId === action.goodId ? { ...m, quantity: m.quantity - qty } : m,
        ),
        lastBuyPrice: { ...state.lastBuyPrice, [action.goodId]: entry.price },
      }
      return s
    }

    case "SELL": {
      if (!isDocked(state)) return state
      const entry = state.market.find((m) => m.goodId === action.goodId)
      if (!entry) return state
      if (action.goodId === "missiles") {
        const qty = clamp(action.qty, 0, state.ship.missiles)
        if (qty <= 0) return state
        const revenue = qty * entry.price
        let s: GameState = {
          ...state,
          credits: state.credits + revenue,
          ship: { ...state.ship, missiles: state.ship.missiles - qty },
          market: state.market.map((m) =>
            m.goodId === action.goodId ? { ...m, quantity: m.quantity + qty } : m,
          ),
        }
        s = log(s, `Sold ${qty} missiles for ${revenue} cr.`, "good")
        return s
      }
      const held = state.cargo[action.goodId] ?? 0
      const qty = clamp(action.qty, 0, held)
      if (qty <= 0) return state
      const revenue = qty * entry.price
      const newHeld = held - qty
      const cargo = { ...state.cargo }
      if (newHeld <= 0) delete cargo[action.goodId]
      else cargo[action.goodId] = newHeld
      let s: GameState = {
        ...state,
        credits: state.credits + revenue,
        cargo,
        market: state.market.map((m) =>
          m.goodId === action.goodId ? { ...m, quantity: m.quantity + qty } : m,
        ),
      }
      s = log(s, `Sold ${qty}t ${GOODS_BY_ID[action.goodId].name} for ${revenue} cr.`, "good")
      return s
    }

    case "REFUEL": {
      if (!isDocked(state)) return state
      const missing = state.ship.maxFuel - state.ship.fuel
      if (missing <= 0) return state
      const pricePer = 20
      const affordable = Math.min(missing, Math.floor(state.credits / pricePer))
      if (affordable <= 0) return log(state, "Not enough credits to refuel.", "bad")
      let s: GameState = {
        ...state,
        credits: state.credits - affordable * pricePer,
        ship: { ...state.ship, fuel: state.ship.fuel + affordable },
      }
      s = log(s, `Refueled ${affordable} ly for ${affordable * pricePer} cr.`, "info")
      return s
    }

    case "REPAIR": {
      if (!isDocked(state)) return state
      const missing = state.ship.maxHull - state.ship.hull
      if (missing <= 0) return state
      const pricePer = 12
      const affordable = Math.min(missing, Math.floor(state.credits / pricePer))
      if (affordable <= 0) return log(state, "Not enough credits to repair the hull.", "bad")
      let s: GameState = {
        ...state,
        credits: state.credits - affordable * pricePer,
        ship: { ...state.ship, hull: state.ship.hull + affordable },
      }
      s = log(s, `Repaired ${affordable} hull for ${affordable * pricePer} cr.`, "good")
      return s
    }

    case "BUY_UPGRADE": {
      if (!isDocked(state)) return state
      const upgrade = UPGRADES.find((u) => u.id === action.upgradeId)
      if (!upgrade) return state
      const system = SYSTEMS_BY_ID[state.currentSystemId]
      if (system.techLevel < upgrade.minTechLevel)
        return log(state, `${upgrade.name} requires Tech Level ${upgrade.minTechLevel}.`, "bad")
      const ownedCount = state.installedUpgrades.filter(id => id === upgrade.id).length
      const dynamicCost = Math.round(upgrade.cost * (1 + ownedCount + state.turn * DIFFICULTY_CONFIG[state.difficulty].upgradeCostScale))
      if (state.credits < dynamicCost)
        return log(state, `Not enough credits for ${upgrade.name} (${dynamicCost.toLocaleString()} cr).`, "bad")

      // Scanner is stackable
      if (upgrade.id === "scanner") {
        const newLevel = state.scannerLevel + 1
        let s: GameState = {
          ...state,
          credits: state.credits - dynamicCost,
          scannerLevel: newLevel,
          installedUpgrades: [...state.installedUpgrades, "scanner"],
        }
        s = log(s, `Installed Scanner Array Mk ${newLevel} for ${dynamicCost} cr. Salvage bonus: +${Math.round(newLevel * 15)}% chance, +${newLevel}t cargo.`, "good")
        return s
      }

      const ship = { ...state.ship }
      switch (upgrade.id) {
        case "cargo":
          ship.cargoCapacity += 10
          break
        case "shield":
          ship.maxShield += 30
          ship.shield += 30
          break
        case "laser":
          ship.weaponDamage += 8
          break
        case "hull":
          ship.maxHull += 40
          ship.hull += 40
          break
        case "fuel":
          ship.maxFuel += 5
          ship.fuel = ship.maxFuel
          break
      }
      let s: GameState = { ...state, ship, credits: state.credits - dynamicCost, installedUpgrades: [...state.installedUpgrades, upgrade.id] }
      s = log(s, `Installed ${upgrade.name} for ${dynamicCost} cr.`, "good")
      return s
    }

    /* ------------------------------ movement ------------------------------ */

    case "DEPART": {
      if (!isDocked(state)) return state
      const from = SYSTEMS_BY_ID[state.currentSystemId]
      const to = SYSTEMS_BY_ID[action.systemId]
      if (!to || to.id === from.id) return state
      const legs = legsFor(from, to)
      if (legs > state.ship.fuel)
        return log(state, `Insufficient fuel — that run needs ${legs} ly.`, "bad")
      const s: GameState = {
        ...state,
        voyage: { destinationId: to.id, legsTotal: legs, legsDone: 0 },
      }
      return advanceLeg(s, false)
    }

    case "ADVANCE": {
      if (!isInTransit(state)) return state
      if (state.ship.fuel < 1) return log(state, "Out of fuel — drive offline.", "bad")
      return advanceLeg(state, false)
    }

    case "RUN_SILENT": {
      if (!isInTransit(state)) return state
      if (state.ship.fuel < 2) return log(state, "Silent running needs 2 ly of fuel.", "bad")
      return advanceLeg(state, true)
    }

    case "ABORT": {
      if (!isInTransit(state)) return state
      // Break off the run and limp back to the last station.
      const home = SYSTEMS_BY_ID[state.currentSystemId]
      let s = state
      s = {
        ...s,
        turn: s.turn + 1,
        ship: { ...s.ship, fuel: Math.max(0, s.ship.fuel - 1) },
        voyage: { destinationId: home.id, legsTotal: 1, legsDone: 1 },
      }
      s = log(s, `Turn ${s.turn}: voyage aborted — limping back to ${home.name}.`, "system")
      return settleLeg(s)
    }

    case "LAYOVER": {
      if (!isDocked(state)) return state
      if (state.credits < 150)
        return log(state, "Not enough credits for a layover (150 cr).", "bad")
      const system = SYSTEMS_BY_ID[state.currentSystemId]
      let s = state
      s = {
        ...s,
        turn: s.turn + 1,
        credits: s.credits - 150,
        market: generateMarket(system, s.factionRep[system.factionId]),
        availableCrew: generateAvailableCrew(system, s.crew, s.factionRep[system.factionId]),
      }
      s = log(s, `Turn ${s.turn}: layover at ${system.name} — markets shift. (150 cr)`, "info")
      return settleLeg(s)
    }

    case "EXPLORE_AMBUSH": {
      if (!isDocked(state)) return state
      if (state.ship.fuel < 2) return log(state, "Need at least 2 ly fuel for an ambush patrol.", "bad")
      const system = SYSTEMS_BY_ID[state.currentSystemId]
      const legs = randInt(2, 4)
      const s: GameState = {
        ...state,
        voyage: { destinationId: system.id, legsTotal: legs, legsDone: 0, exploration: "ambush", originSystemId: system.id },
      }
      return advanceLeg(s, false)
    }

    case "EXPLORE_ASTEROIDS": {
      if (!isDocked(state)) return state
      if (state.ship.fuel < 2) return log(state, "Need at least 2 ly fuel for a mining expedition.", "bad")
      const system = SYSTEMS_BY_ID[state.currentSystemId]
      const legs = randInt(2, 4)
      const s: GameState = {
        ...state,
        voyage: { destinationId: system.id, legsTotal: legs, legsDone: 0, exploration: "asteroids", originSystemId: system.id },
      }
      return advanceLeg(s, false)
    }

    case "EVENT_CHOICE": {
      if (state.phase !== "event" || !state.event) return state
      const ev = state.event
      const region =
        SYSTEMS_BY_ID[state.voyage?.destinationId ?? state.currentSystemId]
      let s: GameState = { ...state, event: null }
      const factionId = region.factionId

      const adjustRep = (delta: number, fid?: FactionId) => {
        s = changeRep(s, fid ?? factionId, delta)
      }

      if (ev.kind === "police") {
        if (action.optionId === "submit") {
          let fine = 0
          const cargo = { ...s.cargo }
          for (const g of GOODS) {
            if (g.illegal && (cargo[g.id] ?? 0) > 0) {
              fine += cargo[g.id] * 40
              delete cargo[g.id]
            }
          }
          if (fine > 0) {
            const paid = Math.min(fine, s.credits)
            s = { ...s, cargo, credits: s.credits - paid }
            adjustRep(-1)
            s = log(s, `Contraband confiscated and fined ${paid} cr. Faction standing decreased.`, "bad")
          } else {
            s = log(s, "Scan complete. Manifest clean — cleared to proceed.", "good")
          }
          return settleLeg(s)
        }
        adjustRep(-3)
        s = { ...s, factionRep: { ...s.factionRep, cartel: Math.min(10, (s.factionRep.cartel ?? 0) + 1) } }
        const enemy = createPolice(s.turn, s.difficulty)
        s = { ...s, phase: "combat", enemy, playerEvading: false }
        s = log(s, "You gun the throttle! Police Viper gives chase and opens fire!", "combat")
        return s
      }

      if (ev.kind === "derelict") {
        if (action.optionId === "ignore") {
          s = log(s, "You leave the hulk drifting in the dark.", "info")
          return settleLeg(s)
        }
        if (chance(0.3)) {
          const enemy = createPirate(region.danger + 1, s.turn, s.difficulty)
          s = { ...s, phase: "combat", enemy, playerEvading: false }
          s = log(s, "It was a trap! Raiders were hiding in the hulk!", "combat")
          return s
        }
        const bonus = scannerBonus(s.scannerLevel)
        if (chance(0.5 + bonus.chanceBoost)) {
          const credits = randInt(150 + bonus.cargoBoost * 40, 600 + bonus.cargoBoost * 80)
          s = { ...s, credits: s.credits + credits }
          s = log(s, `Salvage successful — recovered ${credits} cr of valuables.`, "good")
        } else {
          const free = s.ship.cargoCapacity - cargoUsed(s.cargo)
          const good = GOODS.filter((g) => !g.illegal)[randInt(0, 7)]
          const amount = Math.min(free, randInt(2 + bonus.cargoBoost, 6 + bonus.cargoBoost))
          if (amount > 0) {
            s = { ...s, cargo: { ...s.cargo, [good.id]: (s.cargo[good.id] ?? 0) + amount } }
            s = log(s, `Recovered ${amount}t of ${good.name} from the wreck.`, "good")
          } else {
            s = log(s, "The wreck held cargo, but your hold is full.", "info")
          }
        }
        return settleLeg(s)
      }

      if (ev.kind === "distress") {
        if (action.optionId === "ignore") {
          s = log(s, "You ignore the signal and press on.", "info")
          return settleLeg(s)
        }
        if (chance(0.35)) {
          const enemy = createPirate(region.danger + 1, s.turn, s.difficulty)
          s = { ...s, phase: "combat", enemy, playerEvading: false }
          s = log(s, "The 'distress call' was bait — pirates spring an ambush!", "combat")
          return s
        }
        const reward = randInt(200, 700)
        s = { ...s, credits: s.credits + reward }
        adjustRep(1)
        s = log(s, `You rescue the stranded pilot. Grateful, they reward you ${reward} cr.`, "good")
        return settleLeg(s)
      }

      if (ev.kind === "asteroid") {
        if (action.optionId === "avoid") {
          s = log(s, "You plot a careful course around the field.", "info")
          return settleLeg(s)
        }
        const bonus = scannerBonus(s.scannerLevel)
        if (chance(0.4 - bonus.chanceBoost * 0.5)) {
          const dmg = randInt(8, 22)
          s = applyDamageToShip(s, dmg)
          s = log(s, `A rock slams your hull for ${dmg} damage!`, "bad")
          if (s.ship.hull <= 0) {
            s = { ...s, ship: { ...s.ship, hull: 0 }, phase: "gameover" }
            s = log(s, "The asteroid field tears your ship apart...", "bad")
            return s
          }
        } else {
          const free = s.ship.cargoCapacity - cargoUsed(s.cargo)
          const amount = Math.min(free, randInt(2 + bonus.cargoBoost, 7 + bonus.cargoBoost))
          if (amount > 0) {
            s = { ...s, cargo: { ...s.cargo, minerals: (s.cargo.minerals ?? 0) + amount } }
            s = log(s, `Mined ${amount}t of Minerals from the field.`, "good")
          } else {
            s = log(s, "Rich ore here, but your hold is full.", "info")
          }
        }
        return settleLeg(s)
      }

      if (ev.kind === "trader") {
        if (action.optionId === "decline") {
          s = log(s, "You wave the trader off and continue.", "info")
          return settleLeg(s)
        }
        const free = s.ship.cargoCapacity - cargoUsed(s.cargo)
        const qty = Math.min(ev.qty ?? 0, free)
        const cost = qty * (ev.unitPrice ?? 0)
        if (qty <= 0) {
          s = log(s, "Your hold is full — no room for the trader's goods.", "bad")
        } else if (cost > s.credits) {
          s = log(s, "You can't afford the trader's offer.", "bad")
        } else {
          s = { ...s, credits: s.credits - cost, cargo: { ...s.cargo, [ev.goodId!]: (s.cargo[ev.goodId!] ?? 0) + qty } }
        }
        return settleLeg(s)
      }

      // ---- Faction events ----
      if (ev.kind === "fed_patrol") {
        if (action.optionId === "comply") {
          adjustRep(1, "federation")
          s = log(s, "Manifest transmitted. Federation patrol clears you to proceed.", "good")
        } else {
          adjustRep(-2, "federation")
          s = log(s, "You alter course. The patrol marks your vessel as 'uncooperative'.", "bad")
        }
        return settleLeg(s)
      }

      if (ev.kind === "imp_warship") {
        if (action.optionId === "yield") {
          adjustRep(1, "imperial")
          s = log(s, "You comply with the inspection. The Imperial warship stands down.", "good")
        } else {
          adjustRep(-2, "imperial")
          const enemy = createPolice(s.turn, s.difficulty)
          s = { ...s, phase: "combat", enemy, playerEvading: false }
          s = log(s, "You resist! The Imperial warship opens fire!", "combat")
          return s
        }
        return settleLeg(s)
      }

      if (ev.kind === "combine_escort") {
        if (action.optionId === "accept") {
          const reward = ev.unitPrice ?? 250
          s = { ...s, credits: s.credits + reward }
          adjustRep(1, "combine")
          s = log(s, `Escort complete. Earned ${reward} cr.`, "good")
        } else {
          s = log(s, "You decline and continue alone.", "info")
        }
        return settleLeg(s)
      }

      if (ev.kind === "cartel_toll") {
        if (action.optionId === "pay") {
          const toll = ev.unitPrice ?? 200
          const paid = Math.min(toll, s.credits)
          s = { ...s, credits: s.credits - paid }
          adjustRep(1, "cartel")
          s = log(s, `You pay ${paid} cr. The Cartel raider grins and lets you pass.`, "info")
        } else {
          adjustRep(-2, "cartel")
          const enemy = createPirate(region.danger + 1, s.turn, s.difficulty)
          s = { ...s, phase: "combat", enemy, playerEvading: false }
          s = log(s, "\"Wrong answer.\" The Cartel raider opens fire!", "combat")
          return s
        }
        return settleLeg(s)
      }

      if (ev.kind === "bounty_hunter") {
        if (action.optionId === "bribe") {
          const paid = Math.min(200, s.credits)
          s = { ...s, credits: s.credits - paid }
          s = log(s, `You slip the bounty hunter ${paid} cr. "Didn't see a thing."`, "info")
        } else {
          const enemy: Enemy = { name: "Rival Bounty Hunter", hull: 65, maxHull: 65, shield: 30, maxShield: 30, damage: 14, bounty: 500 }
          s = { ...s, phase: "combat", enemy, playerEvading: false }
          s = log(s, "The bounty hunter's weapons power up. Battle stations!", "combat")
          return s
        }
        return settleLeg(s)
      }

      if (ev.kind === "smuggler_hide") {
        if (action.optionId === "help") {
          const free = s.ship.cargoCapacity - cargoUsed(s.cargo)
          const qty = Math.min(ev.qty ?? 2, free)
          if (qty > 0) {
            s = { ...s, cargo: { ...s.cargo, [ev.goodId!]: (s.cargo[ev.goodId!] ?? 0) + qty } }
            adjustRep(1, "cartel")
            adjustRep(-1, "federation")
            s = log(s, `You take ${qty}t of ${GOODS_BY_ID[ev.goodId!]?.name ?? "contraband"}.`, "info")
          } else {
            s = log(s, "Your hold is full — can't help the smuggler.", "bad")
          }
        } else {
          s = log(s, "Not your problem. You press on.", "info")
        }
        return settleLeg(s)
      }

      if (ev.kind === "imp_checkpoint") {
        if (action.optionId === "bribe") {
          const bribe = ev.unitPrice ?? 200
          const paid = Math.min(bribe, s.credits)
          s = { ...s, credits: s.credits - paid }
          adjustRep(-1, "imperial")
          s = log(s, `You pay ${paid} cr. The officer waves you through.`, "info")
        } else {
          s = { ...s, turn: s.turn + 1 }
          s = log(s, "You take the long way around — losing a turn but staying clean.", "info")
        }
        return settleLeg(s)
      }

      if (ev.kind === "combine_distress") {
        if (action.optionId === "investigate") {
          if (chance(0.5)) {
            const reward = randInt(300, 600)
            s = { ...s, credits: s.credits + reward }
            adjustRep(1, "combine")
            s = log(s, `It was a real emergency — you save the crew and earn ${reward} cr.`, "good")
          } else {
            const enemy = createPirate(region.danger + 1, s.turn, s.difficulty)
            s = { ...s, phase: "combat", enemy, playerEvading: false }
            s = log(s, "Cartel trap confirmed! Pirates spring from behind the wreck!", "combat")
            return s
          }
        } else {
          s = log(s, "You play it safe and press on.", "info")
        }
        return settleLeg(s)
      }

      if (ev.kind === "cartel_informant") {
        if (action.optionId === "buy") {
          const free = s.ship.cargoCapacity - cargoUsed(s.cargo)
          const qty = Math.min(ev.qty ?? 2, free)
          const cost = qty * (ev.unitPrice ?? 0)
          if (qty <= 0) {
            s = log(s, "Your hold is full.", "bad")
          } else if (cost > s.credits) {
            s = log(s, "Not enough credits.", "bad")
          } else {
            s = { ...s, credits: s.credits - cost, cargo: { ...s.cargo, [ev.goodId!]: (s.cargo[ev.goodId!] ?? 0) + qty } }
            adjustRep(1, "cartel")
            s = log(s, `Bought ${qty}t of ${GOODS_BY_ID[ev.goodId!]?.name ?? "goods"} on the black market.`, "good")
          }
        } else {
          s = log(s, "You decline the informant's offer.", "info")
        }
        return settleLeg(s)
      }

      if (ev.kind === "fed_rescue") {
        if (action.optionId === "assist") {
          adjustRep(2, "federation")
          s = log(s, "You cover the rescue op. The Federation thanks you for your honour.", "good")
        } else {
          const bonus = scannerBonus(s.scannerLevel)
          const good = GOODS[randInt(0, GOODS.length - 1)]
          const amount = randInt(2 + bonus.cargoBoost, 6 + bonus.cargoBoost)
          s = { ...s, cargo: { ...s.cargo, [good.id]: (s.cargo[good.id] ?? 0) + amount } }
          adjustRep(-3, "federation")
          adjustRep(1, "cartel")
          s = log(s, `You loot ${amount}t of ${good.name} from the drifting cargo. Your conscience twinges.`, "bad")
        }
        return settleLeg(s)
      }

      // ---- Independent events ----
      if (ev.kind === "solar_flare") {
        if (action.optionId === "brace") {
          const shieldLoss = randInt(5, 15)
          s = { ...s, ship: { ...s.ship, shield: Math.max(0, s.ship.shield - shieldLoss) } }
          s = log(s, `Shields absorb the flare — ${shieldLoss} shield lost.`, "bad")
        } else {
          s = { ...s, ship: { ...s.ship, shield: 0 } }
          s = log(s, "Shields are completely scrambled! You drift through with no protection.", "bad")
        }
        return settleLeg(s)
      }

      if (ev.kind === "wormhole") {
        if (action.optionId === "enter") {
          const targetId = ev.goodId ?? SYSTEMS.filter((sy) => sy.id !== region.id)[0].id
          const dest = SYSTEMS_BY_ID[targetId] ?? region
          s = { ...s, voyage: { destinationId: dest.id, legsTotal: 1, legsDone: 1 } }
          s = log(s, `You plunge into the wormhole — emerging near ${dest.name}!`, "system")
          return settleLeg(s)
        } else {
          s = log(s, "You back away. The wormhole collapses with a flash.", "info")
          return settleLeg(s)
        }
      }

      if (ev.kind === "pirate_ambush") {
        if (action.optionId === "fight") {
          const enemy = createPirate(region.danger + 1, s.turn, s.difficulty)
          s = { ...s, phase: "combat", enemy, playerEvading: false }
          s = log(s, "You swing into evasive combat — the pirate is on you!", "combat")
          return s
        } else {
          if (chance(0.55 + crewEvadeBonus(s.crew))) {
            s = log(s, "Full power to engines — you outrun the ambush!", "good")
          } else {
            const enemy = createPirate(region.danger, s.turn, s.difficulty)
            s = { ...s, phase: "combat", enemy, playerEvading: false }
            s = log(s, "They're faster! The pirate cuts you off!", "combat")
            return s
          }
        }
        return settleLeg(s)
      }

      if (ev.kind === "alien_artifact") {
        if (action.optionId === "grab") {
          if (chance(0.6)) {
            const credits = randInt(800, 2000)
            s = { ...s, credits: s.credits + credits }
            s = log(s, `The artifact is priceless! You sell the data for ${credits} cr.`, "good")
          } else {
            const dmg = randInt(15, 35)
            s = applyDamageToShip(s, dmg)
            s = log(s, `The artifact pulses with energy — ${dmg} damage to your ship!`, "bad")
            if (s.ship.hull <= 0) {
              s = { ...s, ship: { ...s.ship, hull: 0 }, phase: "gameover" }
              s = log(s, "The alien artifact overloads your reactor...", "bad")
              return s
            }
          }
        } else {
          s = log(s, "You leave the artifact drifting. Some mysteries are best left alone.", "info")
        }
        return settleLeg(s)
      }

      if (ev.kind === "fuel_leak") {
        if (action.optionId === "patch") {
          if (chance(0.5)) {
            s = log(s, "Patch holds! Fuel loss minimized.", "good")
          } else {
            s = { ...s, ship: { ...s.ship, fuel: Math.max(0, s.ship.fuel - 1) } }
            s = log(s, "Patch fails — you lose extra fuel.", "bad")
          }
        } else {
          s = { ...s, ship: { ...s.ship, fuel: Math.max(0, s.ship.fuel - 1) } }
          s = log(s, "You burn hard to minimize the leak. Lose 1 extra ly of fuel.", "info")
        }
        return settleLeg(s)
      }

      if (ev.kind === "nav_glitch") {
        if (action.optionId === "reroute") {
          const altId = ev.goodId ?? SYSTEMS.filter((sy) => sy.id !== region.id)[0].id
          const alt = SYSTEMS_BY_ID[altId] ?? region
          s = { ...s, voyage: { destinationId: alt.id, legsTotal: 1, legsDone: 1 } }
          s = log(s, `Nav computer reroutes to ${alt.name}.`, "info")
          return settleLeg(s)
        } else {
          if (chance(0.6)) {
            s = log(s, "You manually plot a course — smooth sailing.", "good")
          } else {
            s = { ...s, turn: s.turn + 1 }
            s = log(s, "You get slightly lost. Lose a turn reorienting.", "bad")
          }
        }
        return settleLeg(s)
      }

      if (ev.kind === "convoy_swap") {
        if (action.optionId === "accept") {
          const theirGood = ev.goodId!
          const qty = ev.qty ?? 3
          const held = Object.entries(s.cargo).find(([, v]) => v >= qty)
          if (held) {
            const newCargo = { ...s.cargo }
            newCargo[held[0]] -= qty
            if (newCargo[held[0]] <= 0) delete newCargo[held[0]]
            newCargo[theirGood] = (newCargo[theirGood] ?? 0) + qty
            s = { ...s, cargo: newCargo }
            s = log(s, `Swapped ${qty}t of ${GOODS_BY_ID[held[0]]?.name ?? "goods"} for ${GOODS_BY_ID[theirGood]?.name ?? "goods"}.`, "good")
          } else {
            s = log(s, "You don't have enough of any single good to swap.", "bad")
          }
        } else {
          s = log(s, "You decline the swap.", "info")
        }
        return settleLeg(s)
      }

      if (ev.kind === "mining_field") {
        if (action.optionId === "mine") {
          const free = s.ship.cargoCapacity - cargoUsed(s.cargo)
          const amount = Math.min(free, randInt(3, 8))
          if (amount > 0) {
            s = { ...s, cargo: { ...s.cargo, minerals: (s.cargo.minerals ?? 0) + amount } }
            s = { ...s, turn: s.turn + 1 }
            s = log(s, `Mined ${amount}t of rare Minerals from the uncharted field. (+1 turn)`, "good")
          } else {
            s = log(s, "Rich ore here, but your hold is full.", "info")
          }
        } else {
          s = log(s, "You mark the location and stay on schedule.", "info")
        }
        return settleLeg(s)
      }

      // ---- Exploration events ----
      if (ev.kind === "ambush_opportunity") {
        if (action.optionId === "engage") {
          const enemy = createPirate(region.danger, s.turn, s.difficulty)
          // First strike — player fires a free volley before combat
          const freeDmg = Math.round(s.ship.weaponDamage * crewDamageMult(s.crew) * rand(1.1, 1.4))
          const damagedEnemy = damageEnemy(enemy, freeDmg)
          s = { ...s, phase: "combat", enemy: damagedEnemy, playerEvading: false }
          s = log(s, `Ambush! Your first strike deals ${freeDmg} damage to the ${enemy.name}!`, "combat")
          return s
        }
        s = log(s, "You let the contact slip away. The hunt continues.", "info")
        return settleLeg(s)
      }

      if (ev.kind === "asteroid_field_explore") {
        if (action.optionId === "mine") {
          const bonus = scannerBonus(s.scannerLevel)
          if (chance(0.25)) {
            const dmg = randInt(8, 22)
            s = applyDamageToShip(s, dmg)
            s = log(s, `A rock slams your hull for ${dmg} damage while mining!`, "bad")
            if (s.ship.hull <= 0) {
              s = { ...s, ship: { ...s.ship, hull: 0 }, phase: "gameover" }
              s = log(s, "The asteroid field tears your ship apart...", "bad")
              return s
            }
          }
          const free = s.ship.cargoCapacity - cargoUsed(s.cargo)
          const amount = Math.min(free, randInt(3 + bonus.cargoBoost, 8 + bonus.cargoBoost))
          if (amount > 0) {
            s = { ...s, cargo: { ...s.cargo, minerals: (s.cargo.minerals ?? 0) + amount } }
            s = log(s, `Mined ${amount}t of Minerals from the field.`, "good")
          } else {
            s = log(s, "Rich ore here, but your hold is full.", "info")
          }
        } else {
          s = log(s, "You plot a careful course around the field.", "info")
        }
        return settleLeg(s)
      }

      if (ev.kind === "unstable_asteroid") {
        if (action.optionId === "dodge") {
          if (chance(0.6 + crewEvadeBonus(s.crew))) {
            s = log(s, "You weave through the debris field — no damage.", "good")
          } else {
            const dmg = randInt(10, 25)
            s = applyDamageToShip(s, dmg)
            s = log(s, `Debris clips your hull for ${dmg} damage!`, "bad")
            if (s.ship.hull <= 0) {
              s = { ...s, ship: { ...s.ship, hull: 0 }, phase: "gameover" }
              s = log(s, "The asteroid debris shreds your hull...", "bad")
              return s
            }
          }
        } else {
          const dmg = randInt(15, 30)
          s = applyDamageToShip(s, dmg)
          s = { ...s, ship: { ...s.ship, shield: Math.max(0, s.ship.shield - 5) } }
          s = log(s, `The asteroid slams into you for ${dmg} damage! Shields weakened.`, "bad")
          if (s.ship.hull <= 0) {
            s = { ...s, ship: { ...s.ship, hull: 0 }, phase: "gameover" }
            s = log(s, "The asteroid impact annihilates your ship...", "bad")
            return s
          }
        }
        return settleLeg(s)
      }

      // ---- NEW Faction events ----
      if (ev.kind === "imp_bounty") {
        if (action.optionId === "accept_bounty") {
          const enemy = createPirate(region.danger + 2, s.turn, s.difficulty)
          s = { ...s, phase: "combat", enemy, playerEvading: false }
          s = log(s, "The pirate lord's ship appears on scope. Weapons hot!", "combat")
          adjustRep(1, "imperial")
          return s
        }
        s = log(s, "You decline the bounty. The Imperial officer scowls.", "info")
        return settleLeg(s)
      }

      if (ev.kind === "combine_research") {
        if (action.optionId === "recover") {
          if (chance(0.35)) {
            const enemy = createPirate(region.danger + 1, s.turn, s.difficulty)
            s = { ...s, phase: "combat", enemy, playerEvading: false }
            s = log(s, "The raiders are still nearby! They spring an ambush!", "combat")
            return s
          }
          const reward = randInt(400, 900)
          s = { ...s, credits: s.credits + reward }
          adjustRep(1, "combine")
          s = log(s, `Research data recovered! Combine pays ${reward} cr.`, "good")
        } else {
          s = log(s, "You leave the wreck undisturbed.", "info")
        }
        return settleLeg(s)
      }

      if (ev.kind === "cartel_smuggle") {
        if (action.optionId === "accept_smuggle") {
          const free = s.ship.cargoCapacity - cargoUsed(s.cargo)
          const qty = Math.min(ev.qty ?? 2, free)
          const reward = ev.unitPrice ?? 500
          if (qty > 0) {
            s = { ...s, cargo: { ...s.cargo, [ev.goodId!]: (s.cargo[ev.goodId!] ?? 0) + qty }, credits: s.credits + Math.round(reward * 0.5) }
            adjustRep(1, "cartel")
            s = log(s, `Cartel fronts ${qty}t of ${GOODS_BY_ID[ev.goodId!]?.name ?? "goods"}. Half the ${reward} cr paid up front.`, "good")
          } else {
            s = log(s, "Your hold is full — can't take the cargo.", "bad")
          }
        } else {
          s = log(s, "You pass on the Cartel's offer.", "info")
        }
        return settleLeg(s)
      }

      if (ev.kind === "fed_relief") {
        if (action.optionId === "defend") {
          const enemy = createPirate(region.danger + 1, s.turn, s.difficulty)
          s = { ...s, phase: "combat", enemy, playerEvading: false }
          s = log(s, "You intercept the raiders! Defend the convoy!", "combat")
          adjustRep(1, "federation")
          return s
        }
        s = log(s, "You stay clear of the engagement.", "info")
        return settleLeg(s)
      }

      // ---- NEW Independent events ----
      if (ev.kind === "cargo_pod") {
        if (action.optionId === "salvage") {
          if (chance(0.3)) {
            const enemy = createPirate(region.danger + 1, s.turn, s.difficulty)
            s = { ...s, phase: "combat", enemy, playerEvading: false }
            s = log(s, "It was a trap! Pirates decloak near the pod!", "combat")
            return s
          }
          const bonus = scannerBonus(s.scannerLevel)
          const free = s.ship.cargoCapacity - cargoUsed(s.cargo)
          const good = GOODS.filter((g) => !g.illegal)[randInt(0, GOODS.filter((g) => !g.illegal).length - 1)]
          const amount = Math.min(free, randInt(1 + bonus.cargoBoost, 5 + bonus.cargoBoost))
          if (amount > 0) {
            s = { ...s, cargo: { ...s.cargo, [good.id]: (s.cargo[good.id] ?? 0) + amount } }
            s = log(s, `Recovered ${amount}t of ${good.name} from the cargo pod.`, "good")
          } else {
            s = log(s, "Cargo pod held goods, but your hold is full.", "info")
          }
        } else {
          s = log(s, "You leave the pod drifting — better safe than sorry.", "info")
        }
        return settleLeg(s)
      }

      if (ev.kind === "refugee_ship") {
        if (action.optionId === "help") {
          const free = s.ship.cargoCapacity - cargoUsed(s.cargo)
          const reward = ev.unitPrice ?? 300
          if (free >= 1) {
            s = { ...s, credits: s.credits + reward }
            s = log(s, `Refugees safely transported. They pool ${reward} cr in gratitude.`, "good")
          } else {
            s = log(s, "No cabin space available for the refugees.", "bad")
          }
        } else {
          s = log(s, "You apologise and press on. The refugee ship drifts away.", "info")
        }
        return settleLeg(s)
      }

      if (ev.kind === "stowaway") {
        if (action.optionId === "help") {
          if (s.crew.length >= 4) {
            s = log(s, "No bunks available. You give the kid some credits and drop them at the next port.", "info")
            s = { ...s, credits: s.credits - 50 }
            adjustRep(1, "federation")
          } else {
            const member: CrewMember = {
              id: s.nextCrewId,
              name: CREW_NAMES[randInt(0, CREW_NAMES.length - 1)],
              role: (["pilot", "gunner", "engineer", "medic", "navigator"] as CrewRole[])[randInt(0, 4)],
              wagePerTurn: 20,
              skill: randInt(1, 2),
            }
            s = { ...s, crew: [...s.crew, member], nextCrewId: s.nextCrewId + 1 }
            s = log(s, `${member.name} joins the crew as a ${member.role} (skill ${member.skill}, ${member.wagePerTurn} cr/turn).`, "good")
          }
          adjustRep(-1, "cartel")
        } else {
          const reward = randInt(100, 300)
          s = { ...s, credits: s.credits + reward }
          adjustRep(1, "cartel")
          s = log(s, `You turn the stowaway over to a Cartel agent. They pay you ${reward} cr.`, "bad")
        }
        return settleLeg(s)
      }

      if (ev.kind === "sensor_ghost") {
        if (action.optionId === "investigate") {
          if (chance(0.4)) {
            const enemy = createPirate(region.danger + 2, s.turn, s.difficulty)
            s = { ...s, phase: "combat", enemy, playerEvading: false }
            s = log(s, "Not a ghost — a stealthed pirate! They decloak and open fire!", "combat")
            return s
          }
          const reward = randInt(150, 400)
          s = { ...s, credits: s.credits + reward }
          s = log(s, `False alarm — but you find a drifting salvage beacon worth ${reward} cr.`, "good")
        } else {
          s = log(s, "You dismiss the contact. Probably nothing.", "info")
        }
        return settleLeg(s)
      }

      if (ev.kind === "comet_fragment") {
        if (action.optionId === "mine") {
          if (chance(0.3)) {
            const dmg = randInt(12, 28)
            s = applyDamageToShip(s, dmg)
            s = log(s, `The comet fragment destabilises! ${dmg} damage from ice shrapnel!`, "bad")
            if (s.ship.hull <= 0) {
              s = { ...s, ship: { ...s.ship, hull: 0 }, phase: "gameover" }
              s = log(s, "The comet explosion tears your ship apart...", "bad")
              return s
            }
          }
          const bonus = scannerBonus(s.scannerLevel)
          const free = s.ship.cargoCapacity - cargoUsed(s.cargo)
          const amount = Math.min(free, randInt(2 + bonus.cargoBoost, 5 + bonus.cargoBoost))
          if (amount > 0) {
            s = { ...s, cargo: { ...s.cargo, minerals: (s.cargo.minerals ?? 0) + amount } }
            s = log(s, `Mined ${amount}t of rare isotopes from the comet!`, "good")
          }
        } else {
          s = log(s, "You give the volatile comet a wide berth.", "info")
        }
        return settleLeg(s)
      }

      if (ev.kind === "quarantine_zone") {
        if (action.optionId === "sneak") {
          if (chance(0.5 + crewPoliceEvade(s.crew))) {
            s = log(s, "You slip through the blockade undetected. Clean passage.", "good")
          } else {
            const dmg = randInt(5, 15)
            s = applyDamageToShip(s, dmg)
            s = log(s, `Medical patrol scans you — radiation burst deals ${dmg} damage!`, "bad")
          }
        } else {
          s = { ...s, turn: s.turn + 1 }
          s = log(s, "You take the long route around the quarantine zone. (+1 turn)", "info")
        }
        return settleLeg(s)
      }

      return settleLeg(s)
    }

    case "ACCEPT_MISSION": {
      if (!isDocked(state)) return state
      const mission = action.mission
      const activeCount = state.missions.filter(m => !m.completed && !m.failed).length
      if (activeCount >= 4) return log(state, "Mission roster full (max 4).", "bad")
      if (state.missions.some((m) => m.id === mission.id)) return state
      const withId = { ...mission, id: state.nextMissionId, sourceSystemId: state.currentSystemId }
      let s: GameState = {
        ...state,
        missions: [...state.missions, withId],
        nextMissionId: state.nextMissionId + 1,
      }
      s = log(s, `Accepted mission: ${mission.title}. Deadline: turn ${mission.deadlineTurn}.`, "info")
      return s
    }

    case "ABANDON_MISSION": {
      const mission = state.missions.find((m) => m.id === action.missionId)
      if (!mission || mission.completed || mission.failed) return state
      const penalty = Math.floor(mission.reward * 0.25)
      const targetFaction = mission.factionId ?? SYSTEMS_BY_ID[mission.targetSystemId]?.factionId ?? "federation"
      let s: GameState = {
        ...state,
        credits: Math.max(0, state.credits - penalty),
        missions: state.missions.map((m) =>
          m.id === action.missionId ? { ...m, failed: true } : m,
        ),
        factionRep: {
          ...state.factionRep,
          [targetFaction]: Math.max(-10, (state.factionRep[targetFaction] ?? 0) - 2),
        },
      }
      s = log(s, `Abandoned mission: ${mission.title}. Lost rep with ${FACTIONS_BY_ID[targetFaction].name}.`, "bad")
      return s
    }

    case "HIRE_CREW": {
      if (!isDocked(state)) return state
      if (state.crew.length >= 4) return log(state, "No bunks available — crew quarters full.", "bad")
      const pool = state.availableCrew
      if (!pool || action.index < 0 || action.index >= pool.length) return log(state, "That crew member is no longer available.", "bad")
      const candidate = pool[action.index]
      const signingBonus = candidate.wagePerTurn * 4
      if (state.credits < signingBonus) return log(state, `Not enough credits for ${candidate.name}'s signing bonus (${signingBonus} cr).`, "bad")
      const member: CrewMember = { ...candidate, id: state.nextCrewId }
      const stars = "★".repeat(candidate.skill) + "☆".repeat(5 - candidate.skill)
      let s: GameState = {
        ...state,
        crew: [...state.crew, member],
        nextCrewId: state.nextCrewId + 1,
        credits: state.credits - signingBonus,
        availableCrew: pool.filter((_, i) => i !== action.index),
      }
      s = log(s, `Hired ${member.name} (${stars} ${member.role}) at ${member.wagePerTurn} cr/turn — signing bonus ${signingBonus} cr.`, "good")
      return s
    }

    case "FIRE_CREW": {
      const member = state.crew.find((c) => c.id === action.crewId)
      if (!member) return state
      let s: GameState = {
        ...state,
        crew: state.crew.filter((c) => c.id !== action.crewId),
      }
      s = log(s, `${member.name} (${member.role}) has left the ship.`, "info")
      return s
    }

    case "COMBAT_ACTION": {
      if (state.phase !== "combat" || !state.enemy) return state
      const currentEnemy = state.enemy
      let s: GameState = state

      if (action.action === "fire") {
        const dmg = Math.round(s.ship.weaponDamage * crewDamageMult(s.crew) * rand(0.8, 1.2))
        s = { ...s, enemy: damageEnemy(currentEnemy, dmg) }
        s = log(s, `You fire lasers for ${dmg} damage.`, "combat")
        if (s.enemy!.hull <= 0) return handleEnemyDestroyed(s)
        return enemyTurn(s, s.enemy!)
      }

      if (action.action === "missile") {
        if (s.ship.missiles <= 0) return log(s, "No missiles remaining!", "bad")
        const dmg = randInt(45, 70)
        const enemy = { ...currentEnemy, shield: Math.max(0, currentEnemy.shield - 10), hull: currentEnemy.hull - dmg }
        s = { ...s, enemy, ship: { ...s.ship, missiles: s.ship.missiles - 1 } }
        s = log(s, `Missile away! ${dmg} damage to the ${enemy.name}.`, "combat")
        if (enemy.hull <= 0) return handleEnemyDestroyed(s)
        return enemyTurn(s, enemy)
      }

      if (action.action === "evade") {
        s = { ...s, playerEvading: true }
        const baseRegen = 10 + crewShieldRegen(s.crew)
        const regen = Math.min(baseRegen, s.ship.maxShield - s.ship.shield)
        if (regen > 0) s = { ...s, ship: { ...s.ship, shield: s.ship.shield + regen } }
        s = log(s, "You throw the ship into evasive maneuvers and divert power to shields.", "combat")
        return enemyTurn(s, currentEnemy)
      }

      if (action.action === "flee") {
        if (chance(0.55 + crewEvadeBonus(s.crew))) {
          const escape = nearestSystem(s.currentSystemId)
          s = log(s, `You break away and micro-jump to ${escape.name}!`, "good")
          s = {
            ...s,
            voyage: { destinationId: escape.id, legsTotal: 1, legsDone: 1 },
          }
          return settleLeg(s)
        }
        s = log(s, "Escape failed — the enemy stays on your tail!", "bad")
        return enemyTurn(s, currentEnemy)
      }

      return s
    }

    case "ENTER_CASINO": {
      if (!isDocked(state)) return state
      if (!CASINO_SYSTEM_IDS.has(state.currentSystemId)) return log(state, "No casino at this station.", "bad")
      if (state.casino !== null) return state // already in casino
      if (state.credits < 10) return log(state, "You need at least 10 credits to enter the casino.", "bad")
      const lobbyState = startHand(0) // creates deck, etc. — used as lobby
      lobbyState.phase = "lobby"
      lobbyState.bet = 0
      return { ...state, casino: lobbyState }
    }

    case "LEAVE_CASINO": {
      if (state.casino === null) return state
      return { ...state, casino: null }
    }

    case "CASINO_BET": {
      if (!state.casino || (state.casino.phase !== "lobby" && state.casino.phase !== "result")) return state
      const amount = action.amount
      if (amount < 10) return log(state, "Minimum bet is 10 cr.", "bad")
      if (amount > state.credits) return log(state, "You don't have enough credits.", "bad")
      const bjState = startHand(amount)
      let s: GameState = { ...state, casino: bjState, credits: state.credits - amount }
      s = log(s, `You place a ${amount} cr bet at the Blackjack table.`, "info")
      return s
    }

    case "CASINO_HIT": {
      if (!state.casino || state.casino.phase !== "player") return state
      const next = hit(state.casino)
      let s: GameState = { ...state, casino: next }
      if (next.phase === "result") {
        const payout = resolvePayout(next)
        s = { ...s, credits: s.credits + payout }
        s = log(s, payout > next.bet ? `Blackjack! You win ${payout} cr.` : payout === next.bet ? "Push — your bet is returned." : "Bust! You lose.", payout >= next.bet ? "good" : "bad")
        const system = SYSTEMS_BY_ID[s.currentSystemId]
        saveGame("auto", s, system.name, combatRating(s.destroyedShips))
      }
      return s
    }

    case "CASINO_STAND": {
      if (!state.casino || state.casino.phase !== "player") return state
      const next = stand(state.casino)
      const payout = resolvePayout(next)
      let s: GameState = { ...state, casino: next, credits: state.credits + payout }
      const dealerVal = handValue(next.dealerHand)
      const playerVal = handValue(next.playerHand)
      s = log(s, payout > next.bet ? `You stand with ${playerVal}. Dealer has ${dealerVal}. You win ${payout} cr!` : payout === next.bet ? `Push — ${playerVal} vs ${dealerVal}. Bet returned.` : `You stand with ${playerVal}. Dealer has ${dealerVal}. You lose.`, payout >= next.bet ? "good" : "bad")
      const system = SYSTEMS_BY_ID[s.currentSystemId]
      saveGame("auto", s, system.name, combatRating(s.destroyedShips))
      return s
    }

    case "CASINO_DOUBLE": {
      if (!state.casino || state.casino.phase !== "player") return state
      const extra = state.casino.bet
      if (state.credits < extra) return log(state, "Not enough credits to double down.", "bad")
      const next = doubleDown(state.casino)
      const payout = resolvePayout(next)
      let s: GameState = { ...state, casino: next, credits: state.credits - extra + payout }
      s = log(s, payout > next.bet ? `Double down! You win ${payout} cr.` : payout === next.bet ? "Double down push — bet returned." : "Double down bust! You lose.", payout >= next.bet ? "good" : "bad")
      const system = SYSTEMS_BY_ID[s.currentSystemId]
      saveGame("auto", s, system.name, combatRating(s.destroyedShips))
      return s
    }

    case "REQUEST_FACTION_MISSION": {
      if (!isDocked(state)) return state
      if (state.factionMissionRequestedThisTurn) return log(state, "Already requested a faction mission this turn.", "bad")
      const faction = FACTIONS_BY_ID[action.factionId]
      const system = SYSTEMS_BY_ID[state.currentSystemId]
      const rep = state.factionRep[action.factionId] ?? 0

      const missionGenerators: Array<{
        faction: FactionId
        generate: () => import("./types").Mission | null
      }> = [
        {
          faction: "federation",
          generate() {
            const target = pickTargetSystem(system.id, 1, 3)
            if (!target) return null
            return {
              id: 0,
              type: "bounty",
              title: `Federation Patrol Duty: ${target.name}`,
              description: `Federation Command needs a pirate sweep near ${target.name}. Hunt down hostiles and keep the spacelanes safe.`,
              targetSystemId: target.id,
              factionId: "federation",
              deadlineTurn: state.turn + legsFor(system, target) + randInt(4, 7),
              reward: randInt(500, 1100),
              completed: false,
              failed: false,
            }
          },
        },
        {
          faction: "combine",
          generate() {
            const target = pickTargetSystem(system.id, 1, 3)
            if (!target) return null
            const good = (["computers", "medicine", "machinery"] as string[])[randInt(0, 2)]
            const qty = randInt(3, 7)
            return {
              id: 0,
              type: "delivery",
              title: `Combine Supply Contract: ${target.name}`,
              description: `The Combine needs ${qty}t of ${GOODS_BY_ID[good]?.name ?? good} delivered to ${target.name}. Priority corporate contract.`,
              targetSystemId: target.id,
              factionId: "combine",
              requiredGoodId: good,
              requiredQty: qty,
              deadlineTurn: state.turn + legsFor(system, target) + randInt(3, 6),
              reward: Math.round((GOODS_BY_ID[good]?.basePrice ?? 200) * qty * rand(1.5, 2.2)),
              completed: false,
              failed: false,
            }
          },
        },
        {
          faction: "imperial",
          generate() {
            const target = pickTargetSystem(system.id, 1, 3)
            if (!target) return null
            return {
              id: 0,
              type: "courier",
              title: `Imperial Dispatch to ${target.name}`,
              description: `The Imperial Directorate requires a secure diplomatic courier to ${target.name}. No cargo space needed — carry the sealed orders.`,
              targetSystemId: target.id,
              factionId: "imperial",
              deadlineTurn: state.turn + legsFor(system, target) + randInt(2, 4),
              reward: randInt(400, 900),
              completed: false,
              failed: false,
            }
          },
        },
        {
          faction: "cartel",
          generate() {
            const target = pickTargetSystem(system.id, 1, 3)
            if (!target) return null
            const good = GOODS.filter((g) => g.illegal)[randInt(0, GOODS.filter((g) => g.illegal).length - 1)]
            const qty = randInt(2, 4)
            return {
              id: 0,
              type: "smuggle",
              title: `Cartel Run to ${target.name}`,
              description: `A Cartel boss needs ${qty}t of ${good.name} moved discreetly to ${target.name}. Big risk, bigger payout.`,
              targetSystemId: target.id,
              factionId: "cartel",
              requiredGoodId: good.id,
              requiredQty: qty,
              deadlineTurn: state.turn + legsFor(system, target) + randInt(3, 6),
              reward: Math.round(good.basePrice * qty * rand(2.2, 3.2)),
              completed: false,
              failed: false,
            }
          },
        },
      ]

      const gen = missionGenerators.find((g) => g.faction === action.factionId)
      if (!gen) return log(state, "No mission available from this faction right now.", "bad")
      const mission = gen.generate()
      if (!mission) return log(state, "No suitable target systems in range.", "bad")

      return {
        ...state,
        pendingFactionMission: mission,
        factionMissionRequestedThisTurn: true,
      }
    }

    case "REFUSE_FACTION_MISSION": {
      if (!state.pendingFactionMission) return state
      return {
        ...state,
        pendingFactionMission: null,
      }
    }

    default:
      return state
  }
}
