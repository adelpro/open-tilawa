import { ValidationError, validateSync } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { Logger } from '@nestjs/common';
import { EnvConfigDTO } from './env.config.dto';
import { Enveronements } from './types';

/**
 * Validates the environment and names every problem at once.
 *
 * Two deviations from the ported version, both deliberate:
 *
 * 1. **It throws instead of `process.exit(1)`.** Exiting from inside a config
 *    validator kills the process mid-test and mid-boot with no diagnosable
 *    error; throwing lets Nest report it and lets a test assert on it.
 * 2. **Required keys are required only in production.** Development and test
 *    boot on defaults, so a developer (or CI) does not need mail credentials
 *    and two JWT secrets to run the suite. Production refuses to start without
 *    them, which is the case where the check earns its keep.
 */
const REQUIRED_IN_PRODUCTION = ['COOKIE_JWT_SECRET', 'TEMP_JWT_SECRET', 'TILAWA_PEPPER'] as const;

/**
 * Mail is a capability, not a boot requirement: an instance whose operator has
 * not configured a provider must still serve sign-in and the console, and the
 * mailer already refuses loudly (503 + a warning) on the routes that need it.
 */
const MAIL_KEYS = ['EMAIL', 'EMAIL_APP_SPECIFIC_PASS'] as const;

/**
 * `WEBSITE` is only ever used to build links inside activation and reset mail,
 * so a loopback value ships a message nobody outside the host can open. Dev
 * needs it, production cannot be right with it.
 */
const LOOPBACK = /^(https?:\/\/)?(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/|$)/i;

const logger = new Logger('envValidate');

export function envValidate(config: Record<string, unknown>): EnvConfigDTO {
  const validatedConfig = plainToClass(EnvConfigDTO, config, { enableImplicitConversion: true });
  const errors = validateSync(validatedConfig, { skipMissingProperties: true });

  if (errors.length > 0) {
    const message = errors
      .map((error: ValidationError) => {
        const constraints = error.constraints ?? {};
        return `  ${error.property}: ${Object.values(constraints).join(', ')}`;
      })
      .join('\n');
    throw new Error(`Environment validation failed:\n${message}`);
  }

  if (validatedConfig.NODE_ENV === Enveronements.PRODUCTION) {
    const missing = REQUIRED_IN_PRODUCTION.filter((key) => {
      const value = config[key];
      return value === undefined || value === null || String(value).trim() === '';
    });
    if (missing.length > 0) {
      throw new Error(
        `Refusing to start in production without: ${missing.join(', ')}. ` +
          'Set them in .env (see .env.example).',
      );
    }
    if (LOOPBACK.test(validatedConfig.WEBSITE)) {
      throw new Error(
        `Refusing to start in production with WEBSITE=${validatedConfig.WEBSITE}. ` +
          'Activation and reset mail link to this value, so it must be the public ' +
          'origin (for example https://console.tilawah.cc).',
      );
    }
    if (MAIL_KEYS.some((key) => !config[key])) {
      logger.warn(
        'mail is not configured — set it at /console/settings (the EMAIL pair only bootstraps the setup token); activation, password reset and email 2FA will answer 503 until then',
      );
    }
  } else {
    const missing = REQUIRED_IN_PRODUCTION.filter((key) => !config[key]);
    if (missing.length > 0) {
      logger.debug(`running in ${validatedConfig.NODE_ENV} without: ${missing.join(', ')}`);
    }
  }

  return validatedConfig;
}
