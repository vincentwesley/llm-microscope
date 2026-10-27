// Messages between the page and the model worker.
import type { Progress } from "../model/loader";

export const MAX_TOKENS = 64;

export interface Prediction {
  id: number;
  token: string;
  prob: number;
}

export type Request =
  | { type: "load"; base: string }
  | { type: "run"; id: number; text?: string; ids?: number[] };

export interface RunReply {
  type: "result";
  id: number;
  ids: number[];
  tokens: string[];
  /** True when the prompt was cut to the last MAX_TOKENS tokens. */
  truncated: boolean;
  top: Prediction[];
  /** Per layer: [nHead, T, T] attention probabilities. */
  attn: Float32Array[];
  nLayer: number;
  nHead: number;
  ms: number;
}

export type Reply =
  | ({ type: "progress" } & Progress)
  | { type: "ready"; ms: number }
  | RunReply
  | { type: "error"; id?: number; message: string };
