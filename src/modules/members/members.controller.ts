import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AuthenticatedPrincipal } from '../../common/auth.types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { MembershipRole, PlatformRole } from '../../common/enums';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CreateMemberDto, ParticipantDto, UpdateMemberDto } from './members.dto';
import { MembersService } from './members.service';

@ApiTags('members')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles(MembershipRole.MANAGER)
@Controller('members')
export class MembersController {
  constructor(private readonly members: MembersService) {}

  @ApiOkResponse({ type: [ParticipantDto] })
  @Roles(
    MembershipRole.MANAGER,
    MembershipRole.MEMBER,
    PlatformRole.VALIDATOR,
  )
  @Get('participants')
  findParticipants(@CurrentUser() user: AuthenticatedPrincipal) {
    return this.members.findParticipants(user.organizationId!);
  }

  @Roles(MembershipRole.MANAGER, MembershipRole.MEMBER)
  @Get()
  findAll(@CurrentUser() user: AuthenticatedPrincipal) {
    return user.membershipRole === MembershipRole.MANAGER
      ? this.members.findAll(user.organizationId!)
      : this.members.findParticipants(user.organizationId!);
  }

  @Get(':id') findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedPrincipal) {
    return this.members.findOne(user.organizationId!, id);
  }
  @Post() create(@Body() input: CreateMemberDto, @CurrentUser() user: AuthenticatedPrincipal) {
    return this.members.create(user.organizationId!, input);
  }
  @Patch(':id') update(@Param('id') id: string, @Body() input: UpdateMemberDto, @CurrentUser() user: AuthenticatedPrincipal) {
    return this.members.update(user.organizationId!, id, input);
  }
  @Delete(':id') remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedPrincipal) {
    return this.members.remove(user.organizationId!, id);
  }
}
