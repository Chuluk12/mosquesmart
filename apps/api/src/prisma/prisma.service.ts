import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Thin wrapper around PrismaClient so it can be injected via Nest's DI
 * container and its connection lifecycle is tied to the app's lifecycle.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Connected to PostgreSQL via Prisma');
    } catch (err) {
      this.logger.error('Failed to connect to database', err as Error);
      throw err;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
