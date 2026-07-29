import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { AuthenticatedPrincipal } from '../auth.types';

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & { user: AuthenticatedPrincipal }>();
    if (!request.user.organizationId || !request.user.membershipId) {
      throw new ForbiddenException('An active organization membership is required');
    }
    return true;
  }
}
