import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { CampaignStatus } from '../../common/enums';
import { Campaign } from '../../database/models';
import { CreateCampaignDto, UpdateCampaignDto } from './campaigns.dto';

@Injectable()
export class CampaignsService {
  constructor(@InjectModel(Campaign) private readonly campaigns: typeof Campaign) {}

  findAll(): Promise<Campaign[]> {
    return this.campaigns.findAll({
      where: { organizationId: null },
      order: [['startsAt', 'DESC']],
    });
  }

  async findOne(id: string): Promise<Campaign> {
    const campaign = await this.campaigns.findOne({
      where: { id, organizationId: null },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    return campaign;
  }

  create(input: CreateCampaignDto): Promise<Campaign> {
    this.validateDates(input.startsAt, input.endsAt);
    return this.campaigns.create({
      organizationId: null,
      name: input.name,
      description: input.description ?? null,
      startsAt: input.startsAt.slice(0, 10),
      endsAt: input.endsAt.slice(0, 10),
      status: input.status ?? CampaignStatus.DRAFT,
      minimumActionsPerMonth: input.minimumActionsPerMonth ?? 1,
    });
  }

  async update(id: string, input: UpdateCampaignDto): Promise<Campaign> {
    const campaign = await this.findOne(id);
    this.validateDates(input.startsAt ?? campaign.startsAt, input.endsAt ?? campaign.endsAt);
    await campaign.update({
      ...input,
      ...(input.startsAt ? { startsAt: input.startsAt.slice(0, 10) } : {}),
      ...(input.endsAt ? { endsAt: input.endsAt.slice(0, 10) } : {}),
    });
    return campaign;
  }

  async remove(id: string): Promise<void> {
    const campaign = await this.findOne(id);
    await campaign.update({ status: CampaignStatus.ARCHIVED });
  }

  private validateDates(startsAt: string, endsAt: string): void {
    if (endsAt < startsAt) throw new BadRequestException('Campaign end must not precede start');
  }
}
