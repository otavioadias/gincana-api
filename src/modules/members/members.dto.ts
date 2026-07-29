import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { EntityStatus, MembershipRole } from '../../common/enums';

export class CreateMemberDto {
  @ApiProperty() @IsString() @MaxLength(160) name!: string;
  @ApiProperty() @IsEmail() email!: string;
  @ApiProperty({ enum: MembershipRole }) @IsEnum(MembershipRole) role!: MembershipRole;
  @ApiProperty() @IsString() @MinLength(6) @MaxLength(128) temporaryPassword!: string;
}

export class UpdateMemberDto extends PartialType(CreateMemberDto) {
  @IsOptional() @IsEnum(EntityStatus) status?: EntityStatus;
}

export class ParticipantDto {
  @ApiProperty({ format: 'uuid', description: 'Membership identifier' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: EntityStatus, example: EntityStatus.ACTIVE })
  status!: EntityStatus;
}
