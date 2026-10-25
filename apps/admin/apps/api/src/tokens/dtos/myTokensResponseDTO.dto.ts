import { ApiProperty } from '@nestjs/swagger';
import type { SessionRecord } from '@tilawa-admin/core';

/**
 * Ported from the Mongo-era DTO, retyped onto sessions: a row is a device a
 * user is signed in on, not a token document with an `_id`.
 */
export class MyTokensResponseDTO {
  @ApiProperty({ example: 1, description: 'The session identifier.' })
  public id: number;

  @ApiProperty({ example: 'laptop', description: 'Device label, when the client sends one.' })
  public label?: string;

  @ApiProperty({
    example: '2026-10-19T20:00:00.000Z',
    description: 'When the session was created.',
  })
  public createdAt: string;

  @ApiProperty({ example: '2026-10-26T20:00:00.000Z', description: 'When the token expires.' })
  public expiresAt: string;

  constructor(session: SessionRecord, label?: string) {
    this.id = session.id;
    this.label = label;
    this.createdAt = session.created_at;
    this.expiresAt = session.expires_at;
  }
}
