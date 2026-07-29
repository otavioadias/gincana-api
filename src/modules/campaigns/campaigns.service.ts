import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { CampaignStatus } from '../../common/enums';
import { Campaign } from '../../database/models';
import { CreateCampaignDto, UpdateCampaignDto } from './campaigns.dto';

@Injectable()
export class CampaignsService {
  constructor(@InjectModel(Campaign) private readonly campaigns: typeof Campaign) {}

  findAll(organizationId: string): Promise<Campaign[]> {
    return this.campaigns.findAll({ where: { organizationId }, order: [['startsAt', 'DESC']] });
  }

  async findOne(organizationId: string, id: string): Promise<Campaign> {
    const campaign = await this.campaigns.findOne({ where: { id, organizationId } });
    if (!campaign) throw new NotFoundException('Campaign not found');
    return campaign;
  }

  create(organizationId: string, input: CreateCampaignDto): Promise<Campaign> {
    this.validateDates(input.startsAt, input.endsAt);
    return this.campaigns.create({
      organizationId,
      name: input.name,
      description: input.description ?? null,
      startsAt: input.startsAt.slice(0, 10),
      endsAt: input.endsAt.slice(0, 10),
      status: input.status ?? CampaignStatus.DRAFT,
      minimumActionsPerMonth: input.minimumActionsPerMonth ?? 1,
    });
  }

  async update(organizationId: string, id: string, input: UpdateCampaignDto): Promise<Campaign> {
    const campaign = await this.findOne(organizationId, id);
    this.validateDates(input.startsAt ?? campaign.startsAt, input.endsAt ?? campaign.endsAt);
    await campaign.update({
      ...input,
      ...(input.startsAt ? { startsAt: input.startsAt.slice(0, 10) } : {}),
      ...(input.endsAt ? { endsAt: input.endsAt.slice(0, 10) } : {}),
    });
    return campaign;
  }

  async remove(organizationId: string, id: string): Promise<void> {
    const campaign = await this.findOne(organizationId, id);
    await campaign.update({ status: CampaignStatus.ARCHIVED });
  }

  private validateDates(startsAt: string, endsAt: string): void {
    if (endsAt < startsAt) throw new BadRequestException('Campaign end must not precede start');
  }
}
