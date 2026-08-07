import "reflect-metadata";
import { NestFactory, Reflector } from "@nestjs/core";
import { ClassSerializerInterceptor, Logger, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./common/filters/http-exception.filter";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const corsOrigins = configService.get<string[]>("app.corsOrigins") ?? [];

  app.enableCors({
    origin: (requestOrigin, callback) => {
      const isAllowed =
        requestOrigin === undefined || corsOrigins.includes(requestOrigin);
      callback(null, isAllowed);
    },
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    })
  );

  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  app.useGlobalFilters(new AllExceptionsFilter());

  const config = new DocumentBuilder()
    .setTitle("File Central API")
    .setDescription("MongoDB stores metadata/permissions, MinIO stores binary objects.")
    .setVersion("1.0")
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api", app, document);

  const port = configService.getOrThrow<number>("app.port");
  await app.listen(port);
  const logger = new Logger("Bootstrap");
  logger.log(`File Central API running on http://localhost:${port}`);
  logger.log(`Swagger API on http://localhost:${port}/api`);
}
void bootstrap();
