import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TwoFaTOTPDTO {
  @ApiProperty({ example: '123456', description: 'The six-digit authenticator code' })
  @IsString()
  @MinLength(6)
  @MaxLength(12)
  @Matches(/^\d+$/, { message: 'TOTP must be digits' })
  readonly TOTP!: string;
}

export class TwoFaEmailCodeVerifyDTO {
  @ApiProperty({ example: '019283', description: 'The six-digit emailed code' })
  @IsString()
  @Matches(/^\d{6}$/, { message: 'code must be six digits' })
  readonly code!: string;
}

export class TwoFaRecoveryDTO {
  @ApiProperty({ example: '4f3a-9d21', description: 'An unused recovery code' })
  @IsString()
  @MinLength(6)
  @MaxLength(16)
  readonly code!: string;
}

export class TwoFaRegenerateDTO {
  @ApiProperty({ example: '123456', description: 'A current authenticator code' })
  @IsString()
  @Matches(/^\d+$/, { message: 'code must be digits' })
  @MinLength(6)
  @MaxLength(12)
  readonly code!: string;
}

export class TwoFaDisableDTO {
  @ApiProperty({ description: 'The account password, as proof of presence' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  readonly password!: string;

  @ApiProperty({ example: '123456', description: 'A current authenticator code' })
  @IsString()
  @Matches(/^\d+$/, { message: 'TOTP must be digits' })
  @MinLength(6)
  @MaxLength(12)
  readonly TOTP!: string;
}
