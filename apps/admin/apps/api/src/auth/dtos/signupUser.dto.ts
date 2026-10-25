import {
  IsNotEmpty,
  IsEmail,
  MinLength,
  Matches,
  IsNotIn,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { IsUser } from '../decorators/isUser.validation.decorator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  COMMON_PASSWORDS,
  PASSWORD_MIN_LENGTH,
  PASSWORD_PATTERN,
  PASSWORD_PATTERN_MESSAGE,
} from './password.policy';
class SignupDTO {
  @ApiProperty({
    example: 'JohnDoe',
    description: 'The name of the person',
    required: true,
  })
  @IsNotEmpty()
  @MinLength(4, { message: 'Name must contain at least 4 characters' })
  @MaxLength(20, { message: 'Name must contain a maximum of 20 characters' })
  name: string;

  @ApiProperty({
    example: 'johndoe@email.com',
    description: 'The email of the person',
    required: true,
  })
  @IsNotEmpty()
  @IsEmail()
  readonly email: string;

  @ApiProperty({
    example: 'Password123',
    description: 'The password of the person',
    required: true,
  })
  @MinLength(PASSWORD_MIN_LENGTH, {
    message: `Password must contain at least ${PASSWORD_MIN_LENGTH} characters`,
  })
  @Matches(PASSWORD_PATTERN, {
    message: PASSWORD_PATTERN_MESSAGE,
  })
  @IsNotIn(COMMON_PASSWORDS, {
    message: 'This password is too common. Please choose a stronger password.',
  })
  // Can't make it readonly because we have to hach it before saving to the database
  password: string;
}
export class SignupUserDTO {
  @ApiProperty({ type: SignupDTO })
  @IsUser()
  @ValidateNested()
  @Type(() => SignupDTO)
  readonly user: SignupDTO;
}
