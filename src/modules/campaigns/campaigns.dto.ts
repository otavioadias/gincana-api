import { PartialType } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { CampaignStatus } from '../../common/enums';

export class CreateCampaignDto {
  @IsString() @MaxLength(180) name!: string;
  @IsOptional() @IsString() description?: string;
  @IsDateString() startsAt!: string;
  @IsDateString() endsAt!: string;
  @IsOptional() @IsEnum(CampaignStatus) status?: CampaignStatus;
  @IsOptional() @IsInt() @Min(0) minimumActionsPerMonth?: number;
}

export class UpdateCampaignDto extends PartialType(CreateCampaignDto) {}
