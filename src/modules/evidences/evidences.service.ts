import { createHash, randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { UniqueConstraintError } from 'sequelize';
import { Evidence, Submission } from '../../database/models';
import { SubmissionStatus } from '../../common/enums';
import { StorageService } from './storage.service';

type UploadFile = Express.Multer.File;

const ALLOWED: Record<string, { extensions: string[]; signature: (buffer: Buffer) => boolean }> = {
  'image/jpeg': {
    extensions: ['.jpg', '.jpeg'],
    signature: (buffer) => buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])),
  },
  'image/png': {
    extensions: ['.png'],
    signature: (buffer) => buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  'image/webp': {
    extensions: ['.webp'],
    signature: (buffer) =>
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP',
  },
  'application/pdf': {
    extensions: ['.pdf'],
    signature: (buffer) => buffer.subarray(0, 5).toString('ascii') === '%PDF-',
  },
};

@Injectable()
export class EvidencesService {
  constructor(
    @InjectModel(Evidence) private readonly evidences: typeof Evidence,
    @InjectModel(Submission) private readonly submissions: typeof Submission,
    private readonly storage: StorageService,
  ) {}

  async upload(
    organizationId: string,
    submissionId: string,
    userId: string,
    file: UploadFile,
  ): Promise<Evidence> {
    if (!file) throw new BadRequestException('File is required');
    const submission = await this.findEditableSubmission(organizationId, submissionId, userId);
    const rule = ALLOWED[file.mimetype];
    const extension = extname(file.originalname).toLowerCase();
    if (!rule || !rule.extensions.includes(extension) || !rule.signature(file.buffer)) {
      throw new BadRequestException('File MIME, extension, or signature is not allowed');
    }
    const checksum = createHash('sha256').update(file.buffer).digest('hex');
    if (await this.evidences.findOne({ where: { organizationId, checksum } })) {
      throw new ConflictException('This evidence was already linked to a submission');
    }
    const storageKey = `${organizationId}/${submission.id}/${randomUUID()}${extension}`;
    await this.storage.put(storageKey, file.buffer, file.mimetype, checksum);
    try {
      return await this.evidences.create({
        organizationId,
        submissionId,
        uploadedBy: userId,
        storageKey,
        originalName: file.originalname.slice(0, 255),
        mimeType: file.mimetype,
        sizeBytes: String(file.size),
        checksum,
      });
    } catch (error) {
      await this.storage.delete(storageKey);
      if (error instanceof UniqueConstraintError) {
        throw new ConflictException('This evidence was already linked');
      }
      throw error;
    }
  }

  async remove(
    organizationId: string,
    submissionId: string,
    evidenceId: string,
    userId: string,
  ): Promise<void> {
    await this.findEditableSubmission(organizationId, submissionId, userId);
    const evidence = await this.evidences.findOne({
      where: { id: evidenceId, submissionId, organizationId },
    });
    if (!evidence) throw new NotFoundException('Evidence not found');
    await this.storage.delete(evidence.storageKey);
    await evidence.destroy();
  }

  async signedUrl(organizationId: string, submissionId: string, evidenceId: string): Promise<{ url: string }> {
    const evidence = await this.evidences.findOne({
      where: { id: evidenceId, submissionId, organizationId },
    });
    if (!evidence) throw new NotFoundException('Evidence not found');
    return { url: await this.storage.signedReadUrl(evidence.storageKey) };
  }

  async signedUrlForValidation(
    submissionId: string,
    evidenceId: string,
  ): Promise<{ url: string }> {
    const evidence = await this.evidences.findOne({
      where: { id: evidenceId, submissionId },
    });
    if (!evidence) throw new NotFoundException('Evidence not found');
    return { url: await this.storage.signedReadUrl(evidence.storageKey) };
  }

  private async findEditableSubmission(
    organizationId: string,
    submissionId: string,
    userId: string,
  ): Promise<Submission> {
    const submission = await this.submissions.findOne({ where: { id: submissionId, organizationId } });
    if (!submission) throw new NotFoundException('Submission not found');
    if (submission.createdBy !== userId) throw new ForbiddenException('Only the author can edit evidences');
    if (![SubmissionStatus.DRAFT, SubmissionStatus.NEEDS_CHANGES].includes(submission.status)) {
      throw new BadRequestException('Evidences can only be changed while the submission is editable');
    }
    return submission;
  }
}
