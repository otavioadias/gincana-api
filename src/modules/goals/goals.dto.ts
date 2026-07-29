import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { GoalStatus, GoalType } from '../../common/enums';

export class CreateGoalDto {
  @ApiProperty({ maxLength: 180 })
  @IsString()
  @MaxLength(180)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  campaignId!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  activityId?: string | null;

  @ApiProperty({ enum: GoalType })
  @IsEnum(GoalType)
  type!: GoalType;

  @ApiProperty({ format: 'date' })
  @IsDateString()
  startsAt!: string;

  @ApiProperty({ format: 'date' })
  @IsDateString()
  endsAt!: string;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  targetPoints?: number;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  targetActions?: number;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  targetParticipants?: number;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  targetQuantity?: number;

  @ApiPropertyOptional({ maxLength: 40 })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  unit?: string;
}

export class UpdateGoalDto extends PartialType(CreateGoalDto) {}

export class CreateMonthlyPlanDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  campaignId!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  activityId?: string;

  @ApiProperty({ example: 'Plano mensal', maxLength: 140 })
  @IsString()
  @MaxLength(140)
  titlePrefix!: string;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  targetPoints?: number;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  targetActions?: number;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  targetParticipants?: number;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  targetQuantity?: number;

  @ApiPropertyOptional({ maxLength: 40 })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  unit?: string;
}

class GoalMetricDto {
  @ApiProperty() points!: number;
  @ApiProperty() actions!: number;
  @ApiProperty() participants!: number;
  @ApiProperty() quantity!: number;
}

export class GoalProgressDto {
  @ApiProperty({ type: GoalMetricDto })
  achieved!: GoalMetricDto;

  @ApiProperty({ type: GoalMetricDto })
  targets!: GoalMetricDto;

  @ApiProperty({ type: GoalMetricDto })
  remaining!: GoalMetricDto;

  @ApiProperty({ type: GoalMetricDto })
  percentages!: GoalMetricDto;

  @ApiProperty()
  overallPercentage!: number;

  @ApiProperty({ enum: GoalStatus })
  status!: GoalStatus;
}
