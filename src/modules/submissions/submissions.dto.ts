import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { SubmissionStatus } from '../../common/enums';

export class SubmissionItemDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  activityItemTypeId!: string;

  @ApiProperty({ minimum: 0, example: 3 })
  @IsNumber()
  @Min(0)
  quantity!: number;
}

export class SubmissionDetailsDto {
  @ApiPropertyOptional({ minimum: 0, example: 60 })
  @IsOptional()
  @IsInt()
  @Min(0)
  durationMinutes?: number;
}

export class CreateSubmissionDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  campaignId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  activityId!: string;

  @ApiProperty({ format: 'date', example: '2026-09-20' })
  @IsDateString()
  actionDate!: string;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  institutionName?: string;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  quantity?: number;

  @ApiPropertyOptional({ maxLength: 40 })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  unit?: string;

  @ApiPropertyOptional({ type: SubmissionDetailsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SubmissionDetailsDto)
  details?: SubmissionDetailsDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ type: [SubmissionItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubmissionItemDto)
  items?: SubmissionItemDto[];

  @ApiPropertyOptional({ type: [String], format: 'uuid' })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  participantIds?: string[];
}

export class UpdateSubmissionDto extends PartialType(CreateSubmissionDto) {}

export class ValidateSubmissionDto {
  @ApiProperty({
    enum: [
      SubmissionStatus.APPROVED,
      SubmissionStatus.PARTIALLY_APPROVED,
      SubmissionStatus.REJECTED,
      SubmissionStatus.NEEDS_CHANGES,
    ],
  })
  @IsEnum(SubmissionStatus)
  status!:
    | SubmissionStatus.APPROVED
    | SubmissionStatus.PARTIALLY_APPROVED
    | SubmissionStatus.REJECTED
    | SubmissionStatus.NEEDS_CHANGES;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  approvedPoints?: number;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}
