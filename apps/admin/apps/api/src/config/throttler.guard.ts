import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * The throttler, bound as `APP_GUARD` so the `@Throttle` decorators actually
 * enforce something.
 *
 * It is a subclass for one reason: an integration suite signs in far more often
 * than five times per fifteen minutes — that is the point of the limit — and
 * `overrideProvider(APP_GUARD)` does not reach a guard registered this way. Test
 * runs therefore skip the bucket, and no other environment does.
 */
@Injectable()
export class UslubThrottlerGuard extends ThrottlerGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (process.env.NODE_ENV === 'test') {
      return true;
    }
    return super.canActivate(context);
  }
}
