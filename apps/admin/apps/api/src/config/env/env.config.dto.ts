import { IsEnum, IsNumberString, IsOptional, IsString, Matches } from 'class-validator';
import { Enveronements } from './types';

/**
 * The environment surface Tilawa Admin actually reads.
 *
 * Dropped from the ported DTO, with reasons: `MONGODB_URI` (SQLite now),
 * `TRACE_*` (OpenTelemetry is gone), the Google/GitHub/Facebook client ids
 * (social sign-in is deferred to P5, so requiring them would block a boot that
 * needs none of them), `EMAIL_SERVICE`/`MAILER_HOST`/`MAILER_PORT` (mail goes
 * through Gmail's service preset), and `BACKEND_*` (`PORT` covers it).
 *
 * Nothing here is `@IsDefined()`: keys that are genuinely required are enforced
 * in `envValidate` against `NODE_ENV`, so development and test can boot on
 * defaults while production refuses to start without its secrets.
 */
export class EnvConfigDTO {
  @IsEnum(Enveronements)
  @IsOptional()
  NODE_ENV: Enveronements = Enveronements.DEVELOPMENT;

  @IsString()
  @IsOptional()
  APP_NAME = 'Tilawa Admin';

  @IsString()
  @IsOptional()
  APP_VERSION = '0.1.0';

  @IsString()
  @IsOptional()
  WEBSITE = 'http://localhost:9320';

  /** Optional at every layer: compose, the app default and the edge all agree (T1.12). */
  @IsNumberString()
  @IsOptional()
  PORT = '9310';

  @IsString()
  @IsOptional()
  DB_PATH = './data/tilawa-admin.sqlite';

  @IsString()
  @IsOptional()
  COOKIE_JWT_SECRET?: string;

  @IsNumberString()
  @IsOptional()
  COOKIE_JWT_TTL_MS = '604800000';

  @IsString()
  @IsOptional()
  TEMP_JWT_SECRET?: string;

  @IsNumberString()
  @IsOptional()
  TEMP_JWT_TTL_MS = '900000';

  /** Peppers API-key hashing: sha256(pepper + key). Required in production. */
  @IsString()
  @IsOptional()
  TILAWA_PEPPER?: string;

  @IsString()
  @IsOptional()
  EMAIL?: string;

  @IsString()
  @IsOptional()
  EMAIL_APP_SPECIFIC_PASS?: string;

  @IsString()
  @Matches(
    /^(https?:\/\/([a-zA-Z0-9.-]+|localhost|127\.0\.0\.1)(:[0-9]+)?(\/\w*)?)(,(https?:\/\/([a-zA-Z0-9.-]+|localhost|127\.0\.0\.1)(:[0-9]+)?(\/\w*)?))*$/,
    { message: 'CORS_ORIGIN must be a comma-separated list of absolute URLs' },
  )
  @IsOptional()
  CORS_ORIGIN = 'http://localhost:9320,http://127.0.0.1:9320';
}
