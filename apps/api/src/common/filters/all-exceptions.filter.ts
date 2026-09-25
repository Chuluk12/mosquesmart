import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Response } from 'express';

/**
 * Ensures every error becomes a clean JSON response instead of crashing the
 * process or leaking stack traces, so a bad request from one client can
 * never take the whole API down.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    if (status >= 500) {
      this.logger.error(exception instanceof Error ? exception.stack : exception);
    }

    response.status(status).json({
      statusCode: status,
      message: typeof message === 'string' ? message : (message as any).message ?? message,
      timestamp: new Date().toISOString(),
    });
  }
}
