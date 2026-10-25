import { Logger } from '@nestjs/common';

/**
 * Replaces the ported `formatedLogger`, which pulled in `nest-winston` and a
 * separate logger config. Uslub logs through the Nest `Logger`, so stdout is
 * the single sink and the container needs no logging stack.
 */
export function formatedLogger(context: string): Logger {
  return new Logger(context);
}
