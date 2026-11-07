import { DurableObject } from "cloudflare:workers";

export class RateLimiter extends DurableObject {
  async check(key: string, limit = 60, windowMs = 60_000): Promise<{ allowed: boolean; remaining: number }> {
    const now = Date.now();
    const storageKey = `rl:${key}`;
    let data = (await this.ctx.storage.get<{ count: number; reset: number }>(storageKey)) || {
      count: 0,
      reset: now + windowMs,
    };

    if (now > data.reset) {
      data = { count: 0, reset: now + windowMs };
    }

    data.count += 1;
    await this.ctx.storage.put(storageKey, data);

    const allowed = data.count <= limit;
    return { allowed, remaining: Math.max(0, limit - data.count) };
  }
}