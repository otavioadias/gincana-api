import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class UpdateTeamThemeDto {
  @ApiProperty({ example: '#164E63', pattern: '^#[0-9A-Fa-f]{6}$' })
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/)
  primaryColor!: string;

  @ApiProperty({ example: '#F59E0B', pattern: '^#[0-9A-Fa-f]{6}$' })
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/)
  secondaryColor!: string;
}

export class TeamProfileDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty({ example: '#164E63' })
  primaryColor!: string;

  @ApiProperty({ example: '#F59E0B' })
  secondaryColor!: string;

  @ApiProperty()
  hasLogo!: boolean;

  @ApiPropertyOptional({ nullable: true })
  logoUrl!: string | null;
}
