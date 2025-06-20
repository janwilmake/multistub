# Multistub - Easily create a stub for several DOs while only awaiting the response of the first

Usage example of `getGlobalStubs`:

```ts
const { reader, writer } = getGlobalStubs(request, env, ctx);

// Fast read from closest location
const data = await reader.getData();

// Write that gets replicated globally
await writer.updateData(newData);
```

See [example](example.ts) for an example using `getGlobalStubs`
