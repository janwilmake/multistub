/**
 * Configuration for a single DO in the multi-stub
 */
export interface MultiStubConfig {
  name?: string;
  id?: string;
  config?: DurableObjectNamespaceGetDurableObjectOptions;
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
