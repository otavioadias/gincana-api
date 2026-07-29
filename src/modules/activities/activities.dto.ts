import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  ActivityStatus,
  AvailabilityBlockScope,
  ScoringType,
} from '../../common/enums';

export class ActivityItemTypeDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty({ example: 'casaco' })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiProperty({ minimum: 0, example: 25 })
  @IsNumber()
  @Min(0)
  pointsPerUnit!: number;

  @ApiProperty({ example: 'unidade' })
  @IsString()
  @MaxLength(40)
  unit!: string;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minimumQuantity?: number;
}

export class CreateActivityDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  campaignId!: string;

  @ApiProperty({ maxLength: 180 })
  @IsString()
  @MaxLength(180)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: ScoringType })
  @IsEnum(ScoringType)
  scoringType!: ScoringType;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  points?: number;

  @ApiPropertyOptional({ maxLength: 40 })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  unit?: string;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minimumQuantity?: number | null;

  @ApiPropertyOptional({ minimum: 1, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  minimumParticipants?: number | null;

  @ApiPropertyOptional({ minimum: 0, maximum: 100, nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  minimumParticipationPercent?: number | null;

  @ApiPropertyOptional({ minimum: 1, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxOccurrences?: number | null;

  @ApiPropertyOptional({ minimum: 1, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxOccurrencesPerMonth?: number | null;

  @ApiPropertyOptional({ minimum: 1, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxOccurrencesPerParticipant?: number | null;

  @ApiPropertyOptional({ minimum: 1, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxOccurrencesPerParticipantPerMonth?: number | null;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  repeatable?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  evidenceRequired?: boolean;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  rulesJson?: Record<string, unknown>;

  @ApiPropertyOptional({ enum: ActivityStatus })
  @IsOptional()
  @IsEnum(ActivityStatus)
  status?: ActivityStatus;

  @ApiPropertyOptional({ type: [ActivityItemTypeDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ActivityItemTypeDto)
  itemTypes?: ActivityItemTypeDto[];
}

export class UpdateActivityDto extends PartialType(CreateActivityDto) {}

export class ActivityAvailabilityQueryDto {
  @ApiProperty({ example: '2026-09-20', format: 'date' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  actionDate!: string;
}

export class ActivityAvailabilityDto {
  @ApiProperty()
  available!: boolean;

  @ApiPropertyOptional({ nullable: true, example: 'Maximum reached' })
  reason!: string | null;

  @ApiPropertyOptional({ enum: AvailabilityBlockScope, nullable: true })
  blockScope!: AvailabilityBlockScope | null;

  @ApiPropertyOptional({ format: 'date', nullable: true })
  blockedUntil!: string | null;

  @ApiProperty({ minimum: 0 })
  approvedOccurrences!: number;

  @ApiProperty({ minimum: 0 })
  approvedOccurrencesThisMonth!: number;

  @ApiPropertyOptional({ minimum: 0, nullable: true })
  remainingOccurrences!: number | null;

  @ApiPropertyOptional({ minimum: 0, nullable: true })
  remainingOccurrencesThisMonth!: number | null;
}
