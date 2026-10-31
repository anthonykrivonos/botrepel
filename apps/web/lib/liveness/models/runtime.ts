import { resolve } from "node:path";
import * as ort from "onnxruntime-web";
import { MODELS_DIR, wasmDir } from "./paths";
import manifest from "../../../models/manifest.json";

/**
 * onnxruntime-web's WASM backend, in Bun: one thread, no worker proxy, sessions loaded once per process
 * after their bytes are checked against models/manifest.json. The backend runs one inference at a
 * time, so analyses take turns; a few may wait, and the rest are refused rather than queued without
 * bound.
 */
export type ModelName = keyof typeof manifest.models;

export interface ModelSpec {
  readonly file: string;
  readonly sha256: string;
  readonly bytes: number;
}

export class ModelsBusyError extends Error {}

/** Analyses that may wait for the one running; beyond this a request is refused. */
const QUEUE_LIMIT = 4;

let configured = false;
const sessions = new Map<ModelName, Promise<ort.InferenceSession>>();

async function configure(): Promise<void> {
  if (configured) {
    return;
  }
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.proxy = false;
  ort.env.wasm.wasmPaths = `${await wasmDir()}/`;
  configured = true;
}

export const sha256 = (bytes: Uint8Array): string => new Bun.CryptoHasher("sha256").update(bytes).digest("hex");

/** The bytes of a model file, or an error naming the mismatch: a wrong model would judge every check. */
export function checkedModel(bytes: Uint8Array, spec: ModelSpec): Uint8Array {
  const digest = sha256(bytes);
  if (bytes.byteLength !== spec.bytes || digest !== spec.sha256) {
    throw new Error(`${spec.file} doesn't match models/manifest.json (${bytes.byteLength} bytes, sha256 ${digest}).`);
  }
  return bytes;
}

async function load(name: ModelName): Promise<ort.InferenceSession> {
  await configure();
  const spec = manifest.models[name];
  const bytes = checkedModel(new Uint8Array(await Bun.file(resolve(MODELS_DIR(), spec.file)).arrayBuffer()), spec);
  return ort.InferenceSession.create(bytes, { executionProviders: ["wasm"], graphOptimizationLevel: "all" });
}

/** A model's session, loaded on first use; a failed load is retried on the next call. */
export function session(name: ModelName): Promise<ort.InferenceSession> {
  let pending = sessions.get(name);
  if (!pending) {
    pending = load(name).catch((error: unknown) => {
      sessions.delete(name);
      throw error;
    });
    sessions.set(name, pending);
  }
  return pending;
}

let running = false;
const waiting: (() => void)[] = [];

/** Runs `work` once no other analysis is running; refuses when too many are already waiting. */
export async function withModelSlot<T>(work: () => Promise<T>): Promise<T> {
  if (running) {
    if (waiting.length >= QUEUE_LIMIT) {
      throw new ModelsBusyError("The pose analyzer is busy.");
    }
    await new Promise<void>((wake) => waiting.push(wake));
  }
  running = true;
  try {
    return await work();
  } finally {
    const next = waiting.shift();
    if (next) {
      next();
    } else {
      running = false;
    }
  }
}

export { ort };
