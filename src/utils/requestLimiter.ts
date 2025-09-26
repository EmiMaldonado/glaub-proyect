// Emergency request rate limiter to prevent infinite loops
class RequestLimiter {
  private static instance: RequestLimiter;
  private requestCounts: Map<string, number> = new Map();
  private lastReset: number = Date.now();
  private readonly MAX_REQUESTS = 50;
  private readonly RESET_INTERVAL = 30000; // 30 seconds
  
  static getInstance(): RequestLimiter {
    if (!RequestLimiter.instance) {
      RequestLimiter.instance = new RequestLimiter();
    }
    return RequestLimiter.instance;
  }

  canMakeRequest(key: string): boolean {
    this.cleanup();
    
    const current = this.requestCounts.get(key) || 0;
    if (current >= this.MAX_REQUESTS) {
      console.warn(`🚨 Rate limit exceeded for ${key}: ${current}/${this.MAX_REQUESTS}`);
      return false;
    }
    
    this.requestCounts.set(key, current + 1);
    return true;
  }

  private cleanup(): void {
    const now = Date.now();
    if (now - this.lastReset > this.RESET_INTERVAL) {
      this.requestCounts.clear();
      this.lastReset = now;
      console.log('🔄 Rate limiter reset');
    }
  }

  getCurrentCount(key: string): number {
    return this.requestCounts.get(key) || 0;
  }
}

export const requestLimiter = RequestLimiter.getInstance();