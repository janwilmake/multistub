https://pastebin.contextarea.com/xJxPyTz.md

the idea here is to create multiple queries and execute them in the main connected DO but also in mirror. I think it'd also be useful to have something called multistub for cloudflare; an easy way to get the rpc of a stub but execute that function on several provided DO names.

the api should be getMultiStub(namespace, ctx, config: {name?:string,id?:string, config?: DurableObjectNamespaceGetDurableObjectOptions}[]) => DurableObjectStub<T>

this should basically have a class that looks like the DO but every function you invoke it actually invokes that function on all DOs of these names. The response is only the response of the first name, the rest is handled in ctx.waitUntil

# Iteration 2

Ran into [wrangler:error] TypeError: Illegal invocation: function called with incorrect `this` reference. See https://developers.cloudflare.com/workers/observability/errors/#illegal-invocation-errors for details.

All llm suggestions didn't work. after instructing this, it worked: please make a new implementation with a proxy where we just get the called method name and still continue doing the original stub call not to lose the context. we assume the property called is a function still

https://letmeprompt.com/httpspastebincon-s5mztf0
