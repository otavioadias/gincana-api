import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthenticatedPrincipal } from '../../common/auth.types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { MembershipRole } from '../../common/enums';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { TeamProfileDto, UpdateTeamThemeDto } from './team-settings.dto';
import { TeamSettingsService } from './team-settings.service';

@ApiTags('team-settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('team-settings')
export class TeamSettingsController {
  constructor(private readonly settings: TeamSettingsService) {}

  @ApiOkResponse({ type: TeamProfileDto })
  @Get()
  find(@CurrentUser() user: AuthenticatedPrincipal) {
    return this.settings.find(user.organizationId!);
  }

  @Roles(MembershipRole.MANAGER)
  @ApiOkResponse({ type: TeamProfileDto })
  @Patch('theme')
  updateTheme(
    @Body() input: UpdateTeamThemeDto,
    @CurrentUser() user: AuthenticatedPrincipal,
  ) {
    return this.settings.updateTheme(user.organizationId!, user.userId, input);
  }

  @Roles(MembershipRole.MANAGER)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOkResponse({ type: TeamProfileDto })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  @Post('logo')
  uploadLogo(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedPrincipal,
  ) {
    if (file?.size > 5 * 1024 * 1024) {
      throw new BadRequestException('Logo must not exceed 5 MB');
    }
    return this.settings.uploadLogo(user.organizationId!, user.userId, file);
  }

  @Roles(MembershipRole.MANAGER)
  @Delete('logo')
  removeLogo(@CurrentUser() user: AuthenticatedPrincipal) {
    return this.settings.removeLogo(user.organizationId!, user.userId);
  }
}
