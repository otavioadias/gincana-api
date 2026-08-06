import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AuthenticatedPrincipal } from '../../common/auth.types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  MemberRankingQueryDto,
  RankingEntryDto,
  RankingQueryDto,
  TeamMemberRankingDto,
} from './dashboards.dto';
import { RankingsService } from './rankings.service';

@ApiTags('ranking')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ranking')
export class RankingsController {
  constructor(private readonly rankings: RankingsService) {}

  @Get()
  @ApiOkResponse({ type: [RankingEntryDto] })
  findAll(@Query() query: RankingQueryDto): Promise<RankingEntryDto[]> {
    return this.rankings.findAll(query.campaignId);
  }

  @Get('members')
  @ApiOkResponse({ type: TeamMemberRankingDto })
  findMembers(
    @CurrentUser() user: AuthenticatedPrincipal,
    @Query() query: MemberRankingQueryDto,
  ): Promise<TeamMemberRankingDto> {
    return this.rankings.findMembers(
      user,
      query.organizationId,
      query.campaignId,
    );
  }
}
