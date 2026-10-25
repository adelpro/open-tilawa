import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';
import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_PATTERN,
  PASSWORD_PATTERN_MESSAGE,
} from './password.policy';

export class SendResetEmailDTO {
  @ApiProperty({ example: 'johndoe@email.com' })
  @IsNotEmpty()
  @IsEmail({}, { message: 'Please enter a valid email' })
  readonly email: string;
}

export class ResetPasswordDTO {
  @ApiProperty({ description: 'The token carried by the emailed reset link' })
  @IsNotEmpty()
  @IsString()
  readonly token: string;

  @ApiProperty({
    example: 'Password123',
    description: 'The new password; the one policy for every password entry point',
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH, {
    message: `Password must contain at least ${PASSWORD_MIN_LENGTH} characters`,
  })
  @Matches(PASSWORD_PATTERN, {
    message: PASSWORD_PATTERN_MESSAGE,
  })
  readonly password: string;
}
