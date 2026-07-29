import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AuthenticatedPrincipal } from '../auth.types';
import { AllowedRole, ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<AllowedRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles?.length) return true;
    const request = context.switchToHttp().getRequest<Request & { user: AuthenticatedPrincipal }>();
    const { platformRole, membershipRole } = request.user;
    if (roles.includes(platformRole) || (membershipRole && roles.includes(membershipRole))) return true;
    throw new ForbiddenException('Insufficient role for this operation');
  }
}
