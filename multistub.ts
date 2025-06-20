/**
 * Configuration for a single DO in the multi-stub
 */
export interface MultiStubConfig {
  name?: string;
  id?: string;
  config?: DurableObjectNamespaceGetDurableObjectOptions;
}

/**
 * Supported Cloudflare locations for DOs
 */
export type CloudflareLocation =
  | "wnam" // Western North America
  | "enam" // Eastern North America
  | "sam" // South America 2
  | "weur" // Western Europe
  | "eeur" // Eastern Europe
  | "apac" // Asia-Pacific
  | "oc" // Oceania
  | "afr" // Africa 2
  | "me"; // Middle East 2

/**
 * Gets global configuration for all DO locations
 */
export function getGlobalConfig(): MultiStubConfig[] {
  const locations: CloudflareLocation[] = [
    "wnam",
    "enam",
    "sam",
    "weur",
    "eeur",
    "apac",
    "oc",
    "afr",
    "me",
  ];

  return locations.map((location) => ({
    name: `global-${location}`,
    config: { locationHint: location },
  }));
}

/**
 * Determines the closest location based on request origin
 */
export function getClosestLocation(request: Request): CloudflareLocation {
  const cf = request.cf;

  if (!cf || !cf.colo) {
    return "wnam"; // Default fallback
  }

  const colo = cf.colo as string;

  // Mapping based on Cloudflare data center locations
  // This is a simplified mapping - you might want to expand this
  const locationMap: Record<string, CloudflareLocation> = {
    // Western North America
    SFO: "wnam",
    LAX: "wnam",
    SEA: "wnam",
    DEN: "wnam",
    PHX: "wnam",
    SJC: "wnam",
    PDX: "wnam",
    LAS: "wnam",
    SLC: "wnam",

    // Eastern North America
    NYC: "enam",
    MIA: "enam",
    ATL: "enam",
    BOS: "enam",
    CHI: "enam",
    DFW: "enam",
    IAD: "enam",
    ORD: "enam",
    YYZ: "enam",

    // South America
    GRU: "sam",
    SCL: "sam",
    BOG: "sam",
    LIM: "sam",
    EZE: "sam",

    // Western Europe
    LHR: "weur",
    CDG: "weur",
    AMS: "weur",
    FRA: "weur",
    MAD: "weur",
    MAN: "weur",
    DUB: "weur",
    ZUR: "weur",
    MXP: "weur",

    // Eastern Europe
    WAW: "eeur",
    BUD: "eeur",
    PRG: "eeur",
    VIE: "eeur",
    BUH: "eeur",
    SOF: "eeur",
    ATH: "eeur",
    HEL: "eeur",

    // Asia-Pacific
    NRT: "apac",
    HKG: "apac",
    SIN: "apac",
    ICN: "apac",
    TPE: "apac",
    BOM: "apac",
    DEL: "apac",
    BKK: "apac",
    KUL: "apac",
    MNL: "apac",
    CGK: "apac",
    PVG: "apac",

    // Oceania
    SYD: "oc",
    MEL: "oc",
    PER: "oc",
    BNE: "oc",
    AKL: "oc",

    // Africa
    CPT: "afr",
    JNB: "afr",
    LOS: "afr",
    CAI: "afr",
    CAS: "afr",

    // Middle East
    DXB: "me",
    DOH: "me",
    KWI: "me",
    BAH: "me",
    AMM: "me",
    TLV: "me",
    RUH: "me",
  };

  return locationMap[colo] || "wnam"; // Default to Western North America
}

/**
 * Gets the closest stub based on request origin
 */
export function getClosestStub<T extends object>(
  namespace: DurableObjectNamespace<any>,
  request: Request,
): T {
  const location = getClosestLocation(request);
  const config: MultiStubConfig = {
    name: `global-${location}`,
    config: { locationHint: location },
  };

  if (config.name) {
    //@ts-ignore
    return namespace.get(namespace.idFromName(config.name), config.config);
  } else {
    throw new Error("Failed to create closest stub");
  }
}

/**
 * Creates a multi-stub that executes methods on multiple DOs
 * Returns the response from the first DO, executes others in background
 */
export function getMultiStub<T extends object>(
  namespace: DurableObjectNamespace<any>,
  ctx: ExecutionContext,
  configs: MultiStubConfig[],
): T {
  if (configs.length === 0) {
    throw new Error("At least one DO configuration is required");
  }

  // Get all the stubs
  const stubs = configs.map((config) => {
    if (config.name) {
      //@ts-ignore
      return namespace.get(namespace.idFromName(config.name), config.config);
    } else if (config.id) {
      return namespace.get(namespace.idFromString(config.id), config.config);
    } else {
      throw new Error("Either name or id must be provided for each DO config");
    }
  });

  const primaryStub = stubs[0];
  const secondaryStubs = stubs.slice(1);

  // Create a proxy that intercepts method calls
  return new Proxy(primaryStub as T, {
    get(target, prop, receiver) {
      // Check if the property exists on the target and is a function
      const originalProperty = target[prop as keyof typeof target];

      // If it's not a function, just return the original property
      if (typeof originalProperty !== "function") {
        return originalProperty;
      }

      // Return a wrapped function that executes on all stubs
      return function (this: any, ...args: any[]) {
        // Execute on primary stub directly (preserves original context)
        // We call the method directly on the stub, not via apply
        const primaryResult = (
          primaryStub[prop as keyof typeof primaryStub] as Function
        )(...args);

        // Execute on secondary stubs in background if there are any
        if (secondaryStubs.length > 0) {
          const backgroundExecution = async () => {
            const promises = secondaryStubs.map(async (stub) => {
              try {
                // Call the method directly on each stub to preserve context
                const method = stub[prop as keyof typeof stub];
                if (typeof method === "function") {
                  await (method as Function)(...args);
                }
              } catch (error) {
                console.error(
                  `Multi-stub background execution error for ${prop.toString()}:`,
                  error,
                );
              }
            });

            await Promise.allSettled(promises);
          };

          ctx.waitUntil(backgroundExecution());
        }

        return primaryResult;
      };
    },
  });
}

/**
 * Global RPC stub wrapper that provides both global replication and closest location access
 */
export function getGlobalStubs<T extends object>(
  request: Request,
  env: { GLOBAL_DO: DurableObjectNamespace<any> },
  ctx: ExecutionContext,
): { reader: T; writer: T } {
  const globalConfigs = getGlobalConfig();
  const closestStub = getClosestStub<T>(env.GLOBAL_DO, request);
  const globalMultiStub = getMultiStub<T>(env.GLOBAL_DO, ctx, globalConfigs);

  return {
    reader: closestStub, // Fast reads from closest location
    writer: globalMultiStub, // Writes replicated globally
  };
}
