import { Injectable } from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter, Gauge, Histogram } from 'prom-client';

@Injectable()
export class MetricsService {
  constructor(
    @InjectMetric('http_requests_total')
    private readonly requestCounter: Counter,

    @InjectMetric('http_request_duration_seconds')
    private readonly requestDuration: Histogram,

    @InjectMetric('active_ws_connections')
    private readonly wsConnections: Gauge,
  ) {}

  recordRequest(
    method: string,
    route: string,
    status: number,
    durationMs: number,
  ) {
    this.requestCounter.inc({ method, route, status });
    this.requestDuration.observe({ method, route }, durationMs / 1000);
  }

  setWsConnections(count: number) {
    this.wsConnections.set(count);
  }
}
