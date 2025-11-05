const GLOBAL_FLAG = "__SEMIO_DEBUG_DERIVED__";

let eventCounter = 0;

type DebugGlobal = typeof globalThis & {
  [GLOBAL_FLAG]?: boolean;
  process?: { env?: Record<string, string | undefined> };
  performance?: { now: () => number };
};

const globalRef: DebugGlobal = globalThis as DebugGlobal;

function hasNodeEnvFlag(): boolean {
  return globalRef.process?.env?.SEMIO_DEBUG_DERIVED === "true";
}

function hasGlobalFlag(): boolean {
  return globalRef[GLOBAL_FLAG] === true;
}

function shouldLogDerived(): boolean {
  return hasGlobalFlag() || hasNodeEnvFlag();
}

export type DerivedDebugDetails = Record<string, unknown> | undefined;

export function logDerivedEvent(
  source: string,
  phase: string,
  details?: () => DerivedDebugDetails,
): void {
  if (!shouldLogDerived()) return;

  const timestamp =
    typeof globalRef.performance?.now === "function"
      ? globalRef.performance.now().toFixed(3)
      : Date.now().toString();

  const payload = (() => {
    if (!details) return undefined;
    try {
      return details();
    } catch (error) {
      return { error };
    }
  })();

  const id = ++eventCounter;
  console.info(`[derived:${id.toString()}] ${timestamp}ms ${source}::${phase}`, payload);
}

export function enableDerivedDebugLogging(flag: boolean): void {
  globalRef[GLOBAL_FLAG] = flag;
}
