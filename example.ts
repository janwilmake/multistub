import { DurableObject } from "cloudflare:workers";
import { getGlobalStubs } from "./multistub";

export class GlobalDurableObject extends DurableObject {
  private storage: DurableObjectStorage;

  constructor(state: DurableObjectState, env: any) {
    super(state, env);
    this.storage = state.storage;
  }

  async setMessage(message: string): Promise<void> {
    await this.storage.put("message", message);
  }

  async getMessage(): Promise<string> {
    const message = await this.storage.get<string>("message");
    return message || "No message set";
  }

  // Required empty fetch method
  async fetch(request: Request): Promise<Response> {
    return new Response("Direct DO access not supported", { status: 404 });
  }
}

export default {
  async fetch(
    request: Request,
    env: any,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);
    const { reader, writer } = getGlobalStubs<GlobalDurableObject>(
      request,
      env,
      ctx,
    );

    // GET /set/{message} - Set a message (writes to all global DOs)
    if (url.pathname.startsWith("/set/")) {
      const message = url.pathname.split("/set/")[1];
      if (!message) {
        return new Response("Message is required", { status: 400 });
      }

      try {
        await writer.setMessage(decodeURIComponent(message));
        return new Response("Message set successfully");
      } catch (error) {
        return new Response("Failed to set message", { status: 500 });
      }
    }

    // GET / - Get message from closest DO (fast read)
    if (url.pathname === "/") {
      try {
        const message = await reader.getMessage();
        return new Response(message);
      } catch (error) {
        return new Response("Failed to get message", { status: 500 });
      }
    }

    return new Response("Not found", { status: 404 });
  },
};
