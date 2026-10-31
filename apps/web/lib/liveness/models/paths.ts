import { resolve } from "node:path";

/**
 * Where the model files and the runtime's wasm live, relative to the working directory: the repo root
 * in development and tests, and the function's root on Vercel, where `includeFiles` keeps the same
 * layout (api/app.ts finds the bundle the same way).
 */
const root = (): string => process.cwd();

export const MODELS_DIR = (): string => resolve(root(), "apps/web/models");

/** The runtime's wasm and its loader; `bun run build` copies them next to the bundle for deployments. */
export const WASM_FILES = ["ort-wasm-simd-threaded.wasm", "ort-wasm-simd-threaded.mjs"] as const;
const BUILT_WASM_DIR = "apps/web/.build/ort";
const PACKAGE_WASM_DIR = "node_modules/onnxruntime-web/dist";

/** The built copy when there is one, else the package's own files. */
export async function wasmDir(): Promise<string> {
  const built = resolve(root(), BUILT_WASM_DIR);
  return (await Bun.file(resolve(built, WASM_FILES[0])).exists()) ? built : resolve(root(), PACKAGE_WASM_DIR);
}
