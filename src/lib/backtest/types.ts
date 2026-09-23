import type { Drawing } from "@/lib/drawings/types";
import type { Symbol, Timeframe } from "@/lib/market/types";

export type Bias = "bullish" | "bearish" | "neutral" | "";
export type Direction = "long" | "short";
export type PremiumDiscount = "premium" | "discount" | "equilibrium" | "";

/** Manual ICT analysis — every field is typed by the trader. Nothing is auto-detected. */
export interface Analysis {
  htfBias: Bias;
  currentBias: Bias;
  dol: string;
  erl: string;
  irl: string;
  premiumDiscount: PremiumDiscount;
  liquidity: {
    bsl: string;
    ssl: string;
    pdh: string;
    pdl: string;
    asiaHigh: string;
    asiaLow: string;
    londonHigh: string;
    londonLow: string;
    sessionHigh: string;
    sessionLow: string;
  };
  structure: { hh: string; hl: string; lh: string; ll: string; mss: string };
  setup: {
    sweep: string;
    displacement: string;
    fvg: string;
    ob: string;
    setupType: string;
    direction: Direction | "";
  };
  notes: string;
  confidence: number; // 1-5
  reasonForTrade: string;
  reasonForNoTrade: string;
}

export const emptyAnalysis = (): Analysis => ({
  htfBias: "",
  currentBias: "",
  dol: "",
  erl: "",
  irl: "",
  premiumDiscount: "",
  liquidity: {
    bsl: "",
    ssl: "",
    pdh: "",
    pdl: "",
    asiaHigh: "",
    asiaLow: "",
    londonHigh: "",
    londonLow: "",
    sessionHigh: "",
    sessionLow: "",
  },
  structure: { hh: "", hl: "", lh: "", ll: "", mss: "" },
  setup: { sweep: "", displacement: "", fvg: "", ob: "", setupType: "", direction: "" },
  notes: "",
  confidence: 3,
  reasonForTrade: "",
  reasonForNoTrade: "",
});

/**
 * Trade lifecycle (the trader defines every level; the app only measures):
 *   draft    — levels being placed, no order yet (not evaluated)
 *   planned  — order placed at `plannedAt`; waiting for price to reach entry
 *   active   — replay traded through the entry (activatedAt)
 *   closed   — stop, target or manual close reached (closedAt)
 * Status is DERIVED from the replay clock by `evaluateTrade` — it is never
 * typed in by hand and never uses a candle that has not closed yet.
 */
export type TradeStatus = "draft" | "planned" | "active" | "closed";
export type TradeResult = "win" | "loss" | "breakeven";
export type EntryType = "limit" | "market";
export type CloseReason = "tp" | "sl" | "manual";

/** A manual stop/target change while the trade is live; applies to M1 candles opening at or after `at`. */
export interface LevelAdjustment {
  at: number;
  stopLoss: number;
  takeProfit: number;
}

export interface TradePlan {
  id: string;
  direction: Direction;
  entry: number;
  /** ORIGINAL planned stop — defines 1R */
  stopLoss: number;
  /** ORIGINAL planned target */
  takeProfit: number;
  /** snapshot / legacy; the live status is derived by the replay engine */
  status: TradeStatus;
  /** replay time the order was placed (armed). For drafts: when the draft was created. */
  plannedAt: number;
  /** replay time the draft was first created — hides the plan when rewinding before it */
  createdAt?: number;
  /** true once "Place order" / "Enter at market" was pressed */
  armed?: boolean;
  entryType?: EntryType;
  /** last closed price when the order was placed — decides stop-vs-limit trigger side */
  refPrice?: number;
  adjustments?: LevelAdjustment[];
  /** replay time the trader pressed "Close at market" */
  manualCloseAt?: number;
  /* ---- measured snapshot (written when the trade is journaled) ---- */
  activatedAt?: number;
  closedAt?: number;
  closeReason?: CloseReason;
  /** legacy field from v1 records */
  observed?: { hit: "tp" | "sl"; at: number } | null;
  result?: TradeResult;
  exitPrice?: number;
  resultR?: number;
  maxFavorableR?: number;
  maxAdverseR?: number;
  timeInTradeSec?: number;
  /** stop and target were both inside one M1 candle — stop assumed first */
  ambiguous?: boolean;
  /** effective stop / target at close (after adjustments) */
  finalStopLoss?: number;
  finalTakeProfit?: number;
}

export function riskDistance(t: Pick<TradePlan, "entry" | "stopLoss">) {
  return Math.abs(t.entry - t.stopLoss);
}
export function rewardDistance(t: Pick<TradePlan, "entry" | "takeProfit">) {
  return Math.abs(t.takeProfit - t.entry);
}
export function rrRatio(t: Pick<TradePlan, "entry" | "stopLoss" | "takeProfit">) {
  const r = riskDistance(t);
  return r === 0 ? 0 : rewardDistance(t) / r;
}
export function resultRAt(t: Pick<TradePlan, "entry" | "stopLoss" | "direction">, exit: number) {
  const r = riskDistance(t);
  if (r === 0) return 0;
  const pnl = t.direction === "long" ? exit - t.entry : t.entry - exit;
  return pnl / r;
}
export function classifyResult(r: number): TradeResult {
  if (r > 0.05) return "win";
  if (r < -0.05) return "loss";
  return "breakeven";
}

/** Levels must be on the correct side for the direction. Returns a message or null. */
export function validateLevels(t: Pick<TradePlan, "direction" | "entry" | "stopLoss" | "takeProfit">): string | null {
  if (![t.entry, t.stopLoss, t.takeProfit].every((v) => Number.isFinite(v) && v > 0)) return "Enter valid prices";
  if (t.direction === "long") {
    if (t.stopLoss >= t.entry) return "Long stop must be below entry";
    if (t.takeProfit <= t.entry) return "Long target must be above entry";
  } else {
    if (t.stopLoss <= t.entry) return "Short stop must be above entry";
    if (t.takeProfit >= t.entry) return "Short target must be below entry";
  }
  return null;
}

export const WORKFLOW_STEPS = [
  { id: "context", label: "Analyze market context" },
  { id: "liquidity", label: "Mark liquidity" },
  { id: "dol", label: "Identify DOL" },
  { id: "poi", label: "Mark POIs" },
  { id: "wait", label: "Wait for price to develop" },
  { id: "sweep", label: "Mark sweep" },
  { id: "displacement", label: "Identify displacement" },
  { id: "mss", label: "Confirm MSS" },
  { id: "plan", label: "Plan entry, SL, TP" },
  { id: "replay", label: "Replay forward" },
  { id: "record", label: "Record outcome" },
  { id: "journal", label: "Journal" },
] as const;

export type WorkflowStepId = (typeof WORKFLOW_STEPS)[number]["id"];

export interface ReplaySession {
  id: string;
  name: string;
  symbol: Symbol;
  timeframe: Timeframe;
  startTime: number; // UTC seconds
  currentTime: number; // UTC seconds — the replay clock
  speed: number; // candles per second
  drawings: Drawing[];
  analysis: Analysis;
  trade: TradePlan | null;
  workflowDone: WorkflowStepId[];
  createdAt: number; // wall clock ms
  updatedAt: number;
}

export type NoTradeReason =
  | "no_setup"
  | "setup_invalidated"
  | "missed_setup"
  | "rules_not_met"
  | "poor_conditions"
  | "waiting_confirmation"
  | "other";

export const NO_TRADE_REASONS: { id: NoTradeReason; label: string }[] = [
  { id: "no_setup", label: "No trade" },
  { id: "setup_invalidated", label: "Setup invalidated" },
  { id: "missed_setup", label: "Missed setup" },
  { id: "rules_not_met", label: "Did not meet rules" },
  { id: "poor_conditions", label: "Poor conditions" },
  { id: "waiting_confirmation", label: "Waiting for confirmation" },
  { id: "other", label: "Other reason" },
];

export interface JournalRecord {
  id: string;
  kind: "trade" | "no_trade";
  sessionId: string;
  symbol: Symbol;
  timeframe: Timeframe;
  /** replay time of the decision (UTC seconds) */
  decisionTime: number;
  session: string; // Asia / London / New York
  analysis: Analysis;
  trade: TradePlan | null;
  noTradeReason?: NoTradeReason;
  mistakes: string;
  notes: string;
  /** chart state snapshot for later review */
  drawings: Drawing[];
  createdAt: number;
}
