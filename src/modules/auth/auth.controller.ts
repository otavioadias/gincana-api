import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthenticatedPrincipal } from '../../common/auth.types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PlatformRole } from '../../common/enums';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import {
  CreateOwnTeamDto,
  LoginDto,
  LogoutDto,
  RefreshDto,
  RegisterManagerDto,
} from './auth.dto';
import { AuthService, TokenPair } from './auth.service';

@ApiTags('auth')
@Controller()
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('auth/login')
  @HttpCode(200)
  login(@Body() input: LoginDto): Promise<TokenPair> {
    return this.auth.login(input);
  }

  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('auth/register-manager')
  registerManager(@Body() input: RegisterManagerDto): Promise<TokenPair> {
    return this.auth.registerManager(input);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(PlatformRole.USER)
  @Post('teams')
  createTeam(
    @Body() input: CreateOwnTeamDto,
    @CurrentUser() user: AuthenticatedPrincipal,
  ): Promise<TokenPair> {
    return this.auth.createTeam(user.userId, input);
  }

  @Post('auth/refresh')
  @HttpCode(200)
  refresh(@Body() input: RefreshDto): Promise<TokenPair> {
    return this.auth.rotate(input.refreshToken, input.deviceInfo);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('auth/logout')
  @HttpCode(204)
  logout(@Body() input: LogoutDto): Promise<void> {
    return this.auth.logout(input.refreshToken);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: AuthenticatedPrincipal): AuthenticatedPrincipal {
    return user;
  }
}
