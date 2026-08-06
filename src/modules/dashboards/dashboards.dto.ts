import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class TeamReferenceDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;
}

export class AdminTeamSummaryDto {
  @ApiProperty({ type: TeamReferenceDto })
  team!: TeamReferenceDto;

  @ApiProperty()
  approvedPoints!: number;

  @ApiProperty()
  pendingPoints!: number;

  @ApiProperty()
  totalPoints!: number;

  @ApiProperty()
  approvedActions!: number;

  @ApiProperty()
  pendingActions!: number;

  @ApiProperty()
  totalActions!: number;

  @ApiProperty()
  activeParticipants!: number;

  @ApiProperty()
  disqualified!: boolean;

  @ApiProperty({ type: 'array', items: { type: 'object' } })
  regularity!: Array<Record<string, unknown>>;

  @ApiProperty({ type: 'array', items: { type: 'object' } })
  goals!: Array<Record<string, unknown>>;
}

export class RankingQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  campaignId?: string;
}

export class MemberRankingQueryDto extends RankingQueryDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Required for admins and ignored when it matches the user team.',
  })
  @IsOptional()
  @IsUUID()
  organizationId?: string;
}

export class RankingEntryDto {
  @ApiProperty({ minimum: 1, example: 1 })
  position!: number;

  @ApiProperty({ format: 'uuid' })
  organizationId!: string;

  @ApiProperty({ example: 'Equipe Azul' })
  name!: string;

  @ApiProperty({ example: 'equipe-azul' })
  slug!: string;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Temporary signed URL for the team logo.',
  })
  photoUrl!: string | null;

  @ApiProperty({ example: 4685 })
  points!: number;

  @ApiProperty({
    nullable: true,
    type: String,
    format: 'date-time',
    description: 'Most recent team or submission update.',
  })
  lastUpdatedAt!: string | null;
}

export class MemberRankingEntryDto {
  @ApiProperty({ minimum: 1, example: 1 })
  position!: number;

  @ApiProperty({ format: 'uuid' })
  membershipId!: string;

  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiProperty({ example: 'Ana Silva' })
  name!: string;

  @ApiProperty({ example: 1250 })
  points!: number;

  @ApiProperty({ example: 4 })
  approvedActions!: number;

  @ApiProperty({
    nullable: true,
    type: String,
    format: 'date-time',
    description: 'Most recent membership or submission update.',
  })
  lastUpdatedAt!: string | null;
}

export class TeamMemberRankingDto {
  @ApiProperty({ type: TeamReferenceDto })
  team!: TeamReferenceDto;

  @ApiProperty({ type: [MemberRankingEntryDto] })
  ranking!: MemberRankingEntryDto[];
}
