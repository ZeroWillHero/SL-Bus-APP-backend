import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { GlobalHttpExceptionFilter } from './common/filters/global-http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const allowedOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  const apiVersion = process.env.npm_package_version ?? '1.0.0';
  const localServerUrl =
    process.env.SWAGGER_LOCAL_URL ?? `http://localhost:${process.env.PORT ?? 4000}`;
  const productionServerUrl =
    process.env.SWAGGER_PROD_URL ?? 'https://api.codescapelabs.com';

  const config = new DocumentBuilder()
    .setTitle('SL BUS Swagger API')
    .setDescription('API documentation')
    .setVersion(apiVersion)
    .addServer(localServerUrl, 'Local development')
    .addServer(productionServerUrl, 'Production')
    .addBearerAuth() // 🔐 for JWT auth
    .build();

  const document = SwaggerModule.createDocument(app, config);
  app.use(cookieParser());

  SwaggerModule.setup('api/v1/swagger-ui', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });
  app.useGlobalFilters(new GlobalHttpExceptionFilter());
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new ResponseInterceptor(),
  );
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
