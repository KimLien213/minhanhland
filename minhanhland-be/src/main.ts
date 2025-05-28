import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module'; 
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableCors({
    origin: ['http://localhost:5173', 'https://43fe-1-55-100-207.ngrok-free.app', 'http://localhost:54240'],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    allowedHeaders: 'Content-Type, Authorization',
    credentials: true,
  });
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
  }); 
  await app.listen(3000);
}
bootstrap();
