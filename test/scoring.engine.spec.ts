import { BadRequestException } from '@nestjs/common';
import { ScoringType } from '../src/common/enums';
import { ScoringEngine } from '../src/modules/submissions/scoring.engine';

describe('ScoringEngine', () => {
  const engine = new ScoringEngine();
  const base = {
    quantity: 0,
    participantCount: 0,
    items: [],
  };

  it('calculates FIXED', () => {
    expect(
      engine.calculate({
        ...base,
        activity: { scoringType: ScoringType.FIXED, points: 300, rulesJson: {} },
      }),
    ).toBe(300);
  });

  it('calculates PER_ITEM using each category price', () => {
    expect(
      engine.calculate({
        ...base,
        activity: { scoringType: ScoringType.PER_ITEM, points: 0, rulesJson: {} },
        items: [
          { quantity: 2, pointsPerUnit: 25 },
          { quantity: 3, pointsPerUnit: 5 },
        ],
      }),
    ).toBe(65);
  });

  it('calculates PER_MEMBER', () => {
    expect(
      engine.calculate({
        ...base,
        participantCount: 4,
        activity: { scoringType: ScoringType.PER_MEMBER, points: 250, rulesJson: {} },
      }),
    ).toBe(1000);
  });

  it('calculates complete kits only with enough distinct item types', () => {
    expect(
      engine.calculate({
        ...base,
        activity: {
          scoringType: ScoringType.PER_COMPLETE_KIT,
          points: 350,
          rulesJson: { minimumDistinctItems: 5 },
        },
        items: Array.from({ length: 5 }, () => ({ quantity: 2, pointsPerUnit: 0 })),
      }),
    ).toBe(700);
  });

  it('does not trust a declared total to inflate complete kits', () => {
    expect(
      engine.calculate({
        ...base,
        quantity: 99,
        activity: {
          scoringType: ScoringType.PER_COMPLETE_KIT,
          points: 350,
          rulesJson: { minimumDistinctItems: 5 },
        },
        items: [
          { quantity: 3, pointsPerUnit: 0 },
          { quantity: 3, pointsPerUnit: 0 },
          { quantity: 2.9, pointsPerUnit: 0 },
          { quantity: 4, pointsPerUnit: 0 },
          { quantity: 8, pointsPerUnit: 0 },
        ],
      }),
    ).toBe(700);
  });

  it('calculates TIERED cumulatively instead of repricing prior weight', () => {
    expect(
      engine.calculate({
        ...base,
        quantity: 120,
        activity: {
          scoringType: ScoringType.TIERED,
          points: 0,
          rulesJson: {
            tiers: [
              { upTo: 50, pointsPerUnit: 2 },
              { upTo: 100, pointsPerUnit: 3 },
              { upTo: null, pointsPerUnit: 4 },
            ],
          },
        },
      }),
    ).toBe(330);
  });

  it('rejects malformed or incomplete tiers', () => {
    expect(() =>
      engine.calculate({
        ...base,
        quantity: 51,
        activity: {
          scoringType: ScoringType.TIERED,
          points: 0,
          rulesJson: { tiers: [{ upTo: 50, pointsPerUnit: 2 }] },
        },
      }),
    ).toThrow(BadRequestException);
  });
});
