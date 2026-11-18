import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';

export class CreateBackupTargetDTO {
  @IsString()
  @Length(1, 60)
  label!: string;

  @IsString()
  @Length(1, 255)
  host!: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  port!: number;

  @IsString()
  @Length(1, 64)
  username!: string;

  @IsString()
  @Length(1, 255)
  remoteDir!: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class UpdateBackupTargetDTO extends CreateBackupTargetDTO {}

export class BackupCredentialDTO {
  @IsOptional()
  @IsString()
  @Length(1, 4096)
  password?: string;

  @IsOptional()
  @IsString()
  @Length(1, 16384)
  privateKey?: string;
}
