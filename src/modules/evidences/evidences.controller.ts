import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthenticatedPrincipal } from '../../common/auth.types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { EvidencesService } from './evidences.service';

@ApiTags('evidences')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('submissions/:submissionId/evidences')
export class EvidencesController {
  constructor(
    private readonly evidences: EvidencesService,
  ) {}

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: Number(process.env.UPLOAD_MAX_BYTES ?? 10_485_760) },
    }),
  )
  @Post()
  upload(
    @Param('submissionId') submissionId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedPrincipal,
  ) {
    if (file?.size > Number(process.env.UPLOAD_MAX_BYTES ?? 10_485_760)) {
      throw new BadRequestException('Upload exceeds configured size limit');
    }
    return this.evidences.upload(user.organizationId!, submissionId, user.userId, file);
  }

  @Get(':evidenceId/url')
  signedUrl(
    @Param('submissionId') submissionId: string,
    @Param('evidenceId') evidenceId: string,
    @CurrentUser() user: AuthenticatedPrincipal,
  ) {
    return this.evidences.signedUrl(user.organizationId!, submissionId, evidenceId);
  }

  @Delete(':evidenceId')
  remove(
    @Param('submissionId') submissionId: string,
    @Param('evidenceId') evidenceId: string,
    @CurrentUser() user: AuthenticatedPrincipal,
  ) {
    return this.evidences.remove(user.organizationId!, submissionId, evidenceId, user.userId);
  }
}
