import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'member@gincana.local' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'ChangeMe123!' })
  @IsString()
  @MinLength(6)
  @MaxLength(128)
  password!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  deviceInfo?: string;
}

export class RegisterLeaderDto {
  @ApiProperty({ example: 'Ana Silva' })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @ApiProperty({ example: 'ana@exemplo.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 6 })
  @IsString()
  @MinLength(6)
  @MaxLength(128)
  password!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  deviceInfo?: string;
}

export class CreateOwnTeamDto {
  @ApiProperty({ example: 'Equipe Esperança' })
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  teamName!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  deviceInfo?: string;
}

export class RefreshDto {
  @ApiProperty()
  @IsString()
  @MinLength(32)
  refreshToken!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  deviceInfo?: string;
}

export class LogoutDto {
  @ApiProperty()
  @IsString()
  @MinLength(32)
  refreshToken!: string;
}
