# multistub

Creates a multi-stub that executes methods on multiple DOs. Returns the response from the first DO, executes others in background.

This creates a **broadcast execution pattern** where:

- One operation gets executed across multiple Durable Objects simultaneously
- You get the primary response immediately (from first DO)
- Secondary operations happen in background via `waitUntil`
- All DOs are identical instances from same namespace but with different IDs/names

I have not yet fathomed what this could enable, but just think about it! Inspo: https://letmeprompt.com/httpspastebincon-f34s3w0

Brainstormed usecases so far:

- **Global read replication**: https://github.com/janwilmake/multistub-global
- **Offloading Heavy Calculations**: https://letmeprompt.com/httpsuithubcomj-fs9jv40
- **Mesh Network Databases**: Agent Swarm, Chat apps, push-based gossip: https://letmeprompt.com/httpsuithubcomj-rkdgt00
