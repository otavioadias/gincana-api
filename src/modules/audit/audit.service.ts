import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Transaction } from 'sequelize';
import { AuditLog } from '../../database/models';

@Injectable()
export class AuditService {
  constructor(@InjectModel(AuditLog) private readonly auditLogs: typeof AuditLog) {}

  async record(
    values: {
      organizationId: string | null;
      actorUserId: string | null;
      action: string;
      entityType: string;
      entityId: string | null;
      metadataJson?: Record<string, unknown>;
    },
    transaction?: Transaction,
  ): Promise<void> {
    await this.auditLogs.create(
      { ...values, metadataJson: values.metadataJson ?? {} },
      { transaction },
    );
  }
}
