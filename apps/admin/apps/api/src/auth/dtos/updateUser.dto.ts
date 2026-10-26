import {
  IsEmail,
  IsIn,
  IsOptional,
  MinLength,
  MaxLength,
  ValidateNested,
  IsString,
} from 'class-validator';
import { IsUser } from '../decorators/isUser.validation.decorator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
class UpdateDTO {
  @ApiProperty({
    example: 'John Doe',
    description: 'The name of the person',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MinLength(4, { message: 'Name must contain at least 4 characters' })
  @MaxLength(20, { message: 'Name must contain a maximum of 20 characters' })
  name: string;

  @ApiProperty({
    example: 'johndoe@email.com',
    description: 'The name of the person',
    required: false,
  })
  @IsEmail()
  @IsOptional()
  email: string;

  @ApiProperty({
    example: 'Web Developer',
    description: 'About the user',
    required: false,
  })
  @IsOptional()
  @IsString()
  about: string;

  @ApiProperty({
    example: 'ar',
    description: 'Interface language: en or ar',
    required: false,
    enum: ['en', 'ar'],
  })
  @IsOptional()
  @IsIn(['en', 'ar'], { message: 'locale must be en or ar' })
  locale: 'en' | 'ar';

  @ApiProperty({
    example: 'system',
    description: 'Interface theme: light, dark, or follow the operating system',
    required: false,
    enum: ['light', 'dark', 'system'],
  })
  @IsOptional()
  @IsIn(['light', 'dark', 'system'], { message: 'theme must be light, dark or system' })
  theme: 'light' | 'dark' | 'system';

}

export class UpdateUserDTO {
  @IsUser()
  @ValidateNested()
  @Type(() => UpdateDTO)
  readonly user: UpdateDTO;
}
