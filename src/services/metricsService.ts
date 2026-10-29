export class MetricsService {
  private httpRequestsTotal = 0;
  private httpErrorsTotal = 0;
  private startTime = Date.now();

  public incRequests(): void {
    this.httpRequestsTotal++;
  }

  public incErrors(): void {
    this.httpErrorsTotal++;
  }

  public getMetricsText(): string {
    const uptimeSec = Math.floor((Date.now() - this.startTime) / 1000);
    const mem = process.memoryUsage();

    return [
      '# HELP stellar_bounty_requests_total Total HTTP requests handled',
      '# TYPE stellar_bounty_requests_total counter',
      `stellar_bounty_requests_total ${this.httpRequestsTotal}`,
      '# HELP stellar_bounty_errors_total Total HTTP 5xx server errors',
      '# TYPE stellar_bounty_errors_total counter',
      `stellar_bounty_errors_total ${this.httpErrorsTotal}`,
      '# HELP stellar_bounty_uptime_seconds Process uptime in seconds',
      '# TYPE stellar_bounty_uptime_seconds gauge',
      `stellar_bounty_uptime_seconds ${uptimeSec}`,
      '# HELP stellar_bounty_heap_bytes Node.js heap memory used',
      '# TYPE stellar_bounty_heap_bytes gauge',
      `stellar_bounty_heap_bytes ${mem.heapUsed}`,
    ].join('\n');
  }
}

export const metricsService = new MetricsService();
