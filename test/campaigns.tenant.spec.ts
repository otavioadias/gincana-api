import { NotFoundException } from '@nestjs/common';
import { Campaign } from '../src/database/models';
import { CampaignsService } from '../src/modules/campaigns/campaigns.service';

describe('CampaignsService tenant isolation', () => {
  it('always scopes lookup by the authenticated organization', async () => {
    const findOne = jest.fn().mockResolvedValue(null);
    const model = { findOne } as unknown as typeof Campaign;
    const service = new CampaignsService(model);

    await expect(service.findOne('organization-a', 'campaign-from-b')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(findOne).toHaveBeenCalledWith({
      where: { id: 'campaign-from-b', organizationId: 'organization-a' },
    });
  });
});
