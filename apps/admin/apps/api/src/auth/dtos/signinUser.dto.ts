import { IsNotEmpty, IsEmail, IsString, ValidateNested } from 'class-validator';
import { IsUser } from '../decorators/isUser.validation.decorator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
class SigninDTO {
  @ApiProperty({
    example: 'johndoe@email.com',
    description: 'The email of the person',
    required: true,
  })
  @IsNotEmpty()
  @IsEmail({}, { message: 'Please enter a valid email' })
  readonly email: string;

  @ApiProperty({
    example: 'Password123',
    description: 'The password of the person',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  readonly password: string;
}
export class signinUserDTO {
  @ApiProperty({ type: SigninDTO })
  @IsUser()
  @ValidateNested()
  @Type(() => SigninDTO)
  readonly user: SigninDTO;
}
