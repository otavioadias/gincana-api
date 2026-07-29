import { NotFoundException } from '@nestjs/common';
import { Campaign } from '../src/database/models';
import { CampaignsService } from '../src/modules/campaigns/campaigns.service';

describe('CampaignsService shared competition', () => {
  it('looks up only globally shared campaigns', async () => {
    const findOne = jest.fn().mockResolvedValue(null);
    const model = { findOne } as unknown as typeof Campaign;
    const service = new CampaignsService(model);

    await expect(service.findOne('campaign-a')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(findOne).toHaveBeenCalledWith({
      where: { id: 'campaign-a', organizationId: null },
    });
  });
});
