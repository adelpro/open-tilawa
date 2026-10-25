import { Module } from '@nestjs/common';
import { AuthModule } from '../auth.module';
import { UsersModule } from '../../users/users.module';
import { OAuthClient, OAUTH_HTTP, defaultOAuthHttp } from './oauth.client';
import { IdentitiesController, OAuthController } from './oauth.controller';
import { OAuthService } from './oauth.service';

/**
 * Provider sign-in.
 *
 * Deliberately **not** built on `@nestjs/passport`. The two flows here are a redirect,
 * a token exchange and one profile read; passport would add a session requirement for
 * `state`, a strategy registry and a dependency, in exchange for hiding about forty
 * lines that are worth being able to read. The rule from P0 still holds: import the
 * *decisions* from the ported service, not its plumbing.
 *
 * `OAUTH_HTTP` is the seam tests use: a fetch-shaped function, so a provider can be
 * simulated without a network or a browser.
 */
@Module({
  imports: [AuthModule, UsersModule],
  controllers: [OAuthController, IdentitiesController],
  providers: [OAuthService, OAuthClient, { provide: OAUTH_HTTP, useValue: defaultOAuthHttp }],
  exports: [OAuthService],
})
export class OAuthModule {}
