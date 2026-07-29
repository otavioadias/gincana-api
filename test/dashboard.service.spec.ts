import { Sequelize } from 'sequelize-typescript';
import { Goal, Organization, Submission } from '../src/database/models';
import { DashboardsService } from '../src/modules/dashboards/dashboards.service';
import { GoalsService } from '../src/modules/goals/goals.service';

describe('DashboardsService official scoring', () => {
  it('returns approved totals separately from pending preliminary points', async () => {
    let invocation = 0;
    let summarySql = '';
    let summaryOptions: unknown;
    const query = jest.fn((sql: string, options: unknown) => {
      invocation += 1;
      if (invocation === 1) {
        summarySql = sql;
        summaryOptions = options;
        return Promise.resolve([{
          approvedPoints: '300',
          pendingPoints: '500',
          totalPoints: '800',
          approvedActions: '1',
          pendingActions: '1',
          totalActions: '2',
          myApprovedPoints: '300',
          myPendingPoints: '0',
          myTotalPoints: '300',
          myApprovedActions: '1',
          myPendingActions: '0',
          myTotalActions: '1',
          activeParticipants: '2',
        }]);
      }
      return Promise.resolve([{
        month: '2026-07',
        approvedActions: '1',
        pendingActions: '1',
        totalActions: '2',
      }]);
    });
    const sequelize = { query } as unknown as Sequelize;
    const submissions = {} as typeof Submission;
    const goals = { findAll: jest.fn().mockResolvedValue([]) } as unknown as typeof Goal;
    const service = new DashboardsService(
      sequelize,
      submissions,
      goals,
      {} as typeof Organization,
      {} as GoalsService,
    );
    const summary = await service.summary('organization-a', 'user-a');

    expect(summary.approvedPoints).toBe(300);
    expect(summary.pendingPoints).toBe(500);
    expect(summary.totalPoints).toBe(800);
    expect(summary.myTotalPoints).toBe(300);
    expect(summarySql).toContain("status IN ('APPROVED', 'PARTIALLY_APPROVED')");
    expect(summarySql).toContain("status IN ('SUBMITTED', 'UNDER_REVIEW', 'NEEDS_CHANGES')");
    expect(summaryOptions).toMatchObject({
      replacements: { organizationId: 'organization-a', userId: 'user-a', campaignId: null },
    });
  });
});
