import { Controller, Get, VERSION_NEUTRAL } from "@nestjs/common";
import { HealthCheck, HealthCheckService, MongooseHealthIndicator } from "@nestjs/terminus";

@Controller({
  path: "health",
  version: VERSION_NEUTRAL,
})
export class HealthController {
  constructor(private readonly health: HealthCheckService, private readonly mongoose: MongooseHealthIndicator) {}

  @Get("live")
  liveness(): {
    status: "ok";
    timestamp: string;
  } {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
    };
  }

  @Get("ready")
  @HealthCheck()
  readiness() {
    return this.health.check([() => this.mongoose.pingCheck("mongodb")]);
  }
}
