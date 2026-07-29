import { ApiProperty } from '@nestjs/swagger';

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
