// Messages between the page and the model worker.
import type { Progress } from "../model/loader";

export const MAX_TOKENS = 64;

export interface Prediction {
  id: number;
  token: string;
  prob: number;
  /** Probability of the same token without interventions. */
  clean: number;
}

export interface Steer {
  /** The steering vector is resid(plus) - resid(minus) at the last token, entering `layer`. */
  plus: string;
  minus: string;
  layer: number;
  alpha: number;
}

export interface Interventions {
  /** [layer, head] pairs to zero out. */
  ablate: [number, number][];
  steer: Steer | null;
}

export type Request =
  | { type: "load"; base: string }
  | ({ type: "run"; id: number; text?: string; ids?: number[] } & Interventions)
  | { type: "lens"; id: number; pos: number };

export interface RunReply {
  type: "result";
  id: number;
  ids: number[];
  tokens: string[];
  /** True when the prompt was cut to the last MAX_TOKENS tokens. */
  truncated: boolean;
  /** True when ablations or steering changed this run. */
  intervened: boolean;
  top: Prediction[];
  /** Per layer: [nHead, T, T] attention probabilities (of the intervened run). */
  attn: Float32Array[];
  nLayer: number;
  nHead: number;
  ms: number;
}

export interface LensRow {
  /** Top 5 tokens when the residual stream at this depth is decoded directly. */
  top: { token: string; prob: number }[];
  /** Probability of the model's final top token at this depth. */
  final: number;
}

export interface LensReply {
  type: "lens";
  id: number;
  pos: number;
  finalToken: string;
  /** nLayer + 1 rows: the embeddings, then the output of each block. */
  rows: LensRow[];
}

export type Reply =
  | ({ type: "progress" } & Progress)
  | { type: "ready"; ms: number }
  | RunReply
  | LensReply
  | { type: "error"; id?: number; message: string };
