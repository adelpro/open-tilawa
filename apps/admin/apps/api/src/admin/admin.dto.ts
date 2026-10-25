import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayUnique,
  IsArray,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export const MANAGED_ROLES = ['user', 'admin', 'super_admin'] as const;

export class AdminCreateUserDTO {
  @ApiProperty({ example: 'Nadia' })
  @IsString()
  @IsNotEmpty()
  @MinLength(4)
  name: string;

  @ApiProperty({ example: 'nadia@example.com' })
  @IsEmail()
  email: string;

  /** Omitted means an account that can only be reached through a reset link. */
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  @MinLength(8)
  password?: string;

  /** Only a `super_admin` may pass anything other than `user`; see the service. */
  @ApiProperty({ enum: MANAGED_ROLES, required: false })
  @IsIn(MANAGED_ROLES)
  @IsOptional()
  role?: (typeof MANAGED_ROLES)[number];
}

export class AdminChangeRoleDTO {
  @ApiProperty({ enum: MANAGED_ROLES })
  @IsIn(MANAGED_ROLES)
  role: (typeof MANAGED_ROLES)[number];
}

export class AdminMintKeyDTO {
  @ApiProperty({ example: 'ci-runner' })
  @IsString()
  @IsNotEmpty()
  label: string;

  @ApiProperty({
    example: ['profile:read', 'gate:run'],
    required: false,
    description: 'Defaults to profile:read — the least a key can do.',
  })
  @IsArray()
  @ArrayUnique()
  @IsOptional()
  scopes?: string[];

  @ApiProperty({ required: false, description: 'ISO timestamp; omit for a key that never expires' })
  @IsString()
  @IsOptional()
  expiresAt?: string;
}
