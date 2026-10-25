import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { SqliteError } from 'better-sqlite3';

/**
 * Replaces the ported Mongo exception filter. Maps storage failures onto HTTP
 * without leaking SQL: a constraint violation is a client mistake, a busy
 * database is transient, anything else is ours and gets logged as such.
 */
@Catch(SqliteError)
export class DatabaseExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DatabaseExceptionFilter.name);

  catch(exception: Error & { code?: string }, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const code = exception.code ?? 'SQLITE_ERROR';

    const isConstraint = code.startsWith('SQLITE_CONSTRAINT');
    const isBusy = code === 'SQLITE_BUSY' || code === 'SQLITE_BUSY_TIMEOUT';

    if (!isConstraint && !isBusy) {
      this.logger.error(`${code}: ${exception.message}`);
    }

    const status = isConstraint
      ? HttpStatus.CONFLICT
      : isBusy
        ? HttpStatus.SERVICE_UNAVAILABLE
        : HttpStatus.INTERNAL_SERVER_ERROR;

    response.status(status).json({
      statusCode: status,
      message: isConstraint
        ? 'That value is already taken'
        : isBusy
          ? 'The service is busy, try again'
          : 'Internal server error',
    });
  }
}
