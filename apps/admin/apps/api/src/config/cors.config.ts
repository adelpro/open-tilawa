import { ConfigService } from '@nestjs/config';

const configService = new ConfigService();
const allowedOrigins = configService.get<string>('CORS_ORIGIN');

export const corsConfigs = {
  // `string | undefined` on purpose: `@types/cors` types the origin-less case
  // (same-origin, curl, a health probe) as undefined, and a narrower parameter
  // type made the Docker build fail while an incremental local build did not.
  origin: function (
    origin: string | undefined,
    cb: (err: Error | null, allow?: boolean) => void,
  ) {
    // Remove ||!origin to block Postman request
    // If there is no allowedOrigins in the env file, pass true
    // To test other origins, add 'Origin' to the request header in postman

    if (!allowedOrigins || !origin || allowedOrigins.indexOf(origin) !== -1) {
      cb(null, true);
    } else {
      cb(new Error('origin not allowed by Cors'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
};
