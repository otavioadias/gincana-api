import { ApiProperty, PartialType } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsHexColor,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { EntityStatus } from '../../common/enums';

export class CreateOrganizationDto {
  @ApiProperty() @IsString() @MaxLength(160) name!: string;
  @ApiProperty() @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) @MaxLength(100) slug!: string;
  @IsOptional() @IsHexColor() primaryColor?: string;
  @IsOptional() @IsHexColor() secondaryColor?: string;
  @ApiProperty() @IsString() @MaxLength(160) managerName!: string;
  @ApiProperty() @IsEmail() managerEmail!: string;
  @ApiProperty() @IsString() @MinLength(6) @MaxLength(128) managerTemporaryPassword!: string;
}

export class UpdateOrganizationDto extends PartialType(CreateOrganizationDto) {
  @IsOptional() @IsEnum(EntityStatus) status?: EntityStatus;
}
