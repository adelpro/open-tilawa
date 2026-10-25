import { Controller, Get, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CSRF_COOKIE, CSRF_HEADER } from './csrf.constants';
import { CsrfService } from './csrf.service';

/**
 * The token endpoint. Public on purpose: the sign-in page needs a token before
 * the caller has a session, and issuing one grants nothing.
 *
 * It answers both halves at once — the cookie the browser keeps, and the same
 * value in the body for clients that would rather hold it in memory.
 */
@ApiTags('csrf')
@Controller('csrf')
export class CsrfController {
  constructor(private readonly csrf: CsrfService) {}

  @Get()
  @ApiOperation({ summary: `Issue a CSRF token (echo it in ${CSRF_HEADER})` })
  @ApiResponse({ status: 200, description: 'Token issued and set as a cookie' })
  issue(@Res({ passthrough: true }) response: Response): {
    token: string;
    header: string;
    cookie: string;
  } {
    const token = this.csrf.issue();
    response.cookie(CSRF_COOKIE, token, this.csrf.cookieOptions());
    // `no-store`: a cached token is a token somebody else may reuse.
    response.setHeader('Cache-Control', 'no-store');
    return { token, header: CSRF_HEADER, cookie: CSRF_COOKIE };
  }
}
