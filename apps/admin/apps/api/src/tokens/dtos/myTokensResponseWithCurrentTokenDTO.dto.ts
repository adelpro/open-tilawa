import { ApiProperty } from '@nestjs/swagger';
import type { SessionRecord } from '@tilawa-admin/core';
import { MyTokensResponseDTO } from './myTokensResponseDTO.dto';

/**
 * Adds the flag the UI needs to say "this one is you" without exposing the
 * token itself — tokens are only ever compared server-side, by hash.
 */
export class MyTokensResponseWithCurrentTokenDTO extends MyTokensResponseDTO {
  @ApiProperty({ example: true, description: 'True for the session making the request.' })
  public isCurrent: boolean;

  @ApiProperty({
    example: false,
    description: 'True when this device has passed the second factor and is trusted.',
  })
  public isTrusted: boolean;

  constructor(session: SessionRecord, isCurrent: boolean, isTrusted: boolean, label?: string) {
    super(session, label);
    this.isCurrent = isCurrent;
    this.isTrusted = isTrusted;
  }
}
