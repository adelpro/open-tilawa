import { Provider } from '../../auth/types/providers.type';
import { ApiProperty } from '@nestjs/swagger';

export class AuthenticatedUserResponseDTO {
  @ApiProperty({
    example: '42',
    description: 'The unique identifier for the user.',
  })
  public id: string | number;

  @ApiProperty({
    example: 'example@example.com',
    description: 'The email address of the user.',
  })
  public email: string;

  @ApiProperty({
    example: 'John Doe',
    description: 'The name of the user.',
  })
  public name: string;

  @ApiProperty({
    example: 'true',
    description: 'The provider used for authentication.',
  })
  isActivated: boolean;

  @ApiProperty({
    example: 'true',
    description: 'The provider used for authentication.',
  })
  isTwoFAEnabled: boolean;

  @ApiProperty({
    example: 'local',
    description: 'The provider used for authentication.',
  })
  public provider: Provider;
  constructor(
    id: string | number,
    email: string,
    name: string,
    isActivated: boolean,
    isTwoFAEnabled: boolean,
    provider: Provider,
  ) {
    this.id = id;
    this.email = email;
    this.name = name;
    this.isActivated = isActivated;
    this.isTwoFAEnabled = isTwoFAEnabled;
    this.provider = provider;
  }
}
