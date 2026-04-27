import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { GlobalHttpExceptionFilter } from './common/filters/global-http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = new DocumentBuilder()
    .setTitle('SL BUS Swagger API')
    .setDescription('API documentation')
    .setVersion('1.0')
    .addBearerAuth() // 🔐 for JWT auth
    .build();

  const document = SwaggerModule.createDocument(app, config);
  app.use(cookieParser());

  SwaggerModule.setup('api/v1/swagger-ui', app, document);
  app.useGlobalFilters(new GlobalHttpExceptionFilter());
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new ResponseInterceptor(),
  );
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
