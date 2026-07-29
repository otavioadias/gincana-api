import { BadRequestException } from '@nestjs/common';
import { ScoringType } from '../../common/enums';

export interface ScoringActivity {
  scoringType: ScoringType;
  points: number;
  rulesJson: Record<string, unknown>;
}

export interface ScoringItem {
  quantity: number;
  pointsPerUnit: number;
}

export interface ScoringInput {
  activity: ScoringActivity;
  quantity: number;
  participantCount: number;
  items: ScoringItem[];
}

interface Tier {
  upTo: number | null;
  pointsPerUnit: number;
}

export class ScoringEngine {
  calculate(input: ScoringInput): number {
    const { activity, quantity, participantCount, items } = input;
    let points: number;
    switch (activity.scoringType) {
      case ScoringType.FIXED:
        points = activity.points;
        break;
      case ScoringType.PER_ITEM:
        points = items.reduce((total, item) => total + item.quantity * item.pointsPerUnit, 0);
        break;
      case ScoringType.PER_KG:
        points = quantity * activity.points;
        break;
      case ScoringType.PER_MEMBER:
        points = participantCount * activity.points;
        break;
      case ScoringType.PER_COMPLETE_KIT: {
        const minimumDistinct = this.numericRule(activity.rulesJson, 'minimumDistinctItems', 1);
        const eligibleItems = items.filter((item) => item.quantity > 0);
        if (eligibleItems.length < minimumDistinct) points = 0;
        else {
          const kits = Math.floor(
            Math.min(...eligibleItems.map((item) => item.quantity)),
          );
          points = kits * activity.points;
        }
        break;
      }
      case ScoringType.TIERED:
        points = this.calculateCumulativeTiers(quantity, activity.rulesJson);
        break;
      case ScoringType.MANUAL:
        points = 0;
        break;
      default:
        throw new BadRequestException('Unsupported scoring type');
    }
    if (!Number.isFinite(points) || points < 0) throw new BadRequestException('Invalid scoring result');
    return Math.round((points + Number.EPSILON) * 100) / 100;
  }

  private calculateCumulativeTiers(quantity: number, rules: Record<string, unknown>): number {
    const rawTiers = rules.tiers;
    if (!Array.isArray(rawTiers) || rawTiers.length === 0) {
      throw new BadRequestException('TIERED activity requires rulesJson.tiers');
    }
    const tiers = rawTiers.map((candidate): Tier => {
      if (
        typeof candidate !== 'object' ||
        candidate === null ||
        !('upTo' in candidate) ||
        !('pointsPerUnit' in candidate)
      ) {
        throw new BadRequestException('Invalid tier definition');
      }
      const record = candidate as { upTo: unknown; pointsPerUnit: unknown };
      const upTo = record.upTo === null ? null : Number(record.upTo);
      const pointsPerUnit = Number(record.pointsPerUnit);
      if ((upTo !== null && (!Number.isFinite(upTo) || upTo <= 0)) || !Number.isFinite(pointsPerUnit) || pointsPerUnit < 0) {
        throw new BadRequestException('Invalid tier values');
      }
      return { upTo, pointsPerUnit };
    });
    let previousLimit = 0;
    let remaining = quantity;
    let total = 0;
    for (const tier of tiers) {
      if (remaining <= 0) break;
      const capacity = tier.upTo === null ? remaining : tier.upTo - previousLimit;
      if (capacity <= 0) throw new BadRequestException('Tier limits must be ascending');
      const units = Math.min(remaining, capacity);
      total += units * tier.pointsPerUnit;
      remaining -= units;
      if (tier.upTo !== null) previousLimit = tier.upTo;
    }
    if (remaining > 0) throw new BadRequestException('Tiers do not cover the submitted quantity');
    return total;
  }

  private numericRule(rules: Record<string, unknown>, key: string, fallback: number): number {
    const value = Number(rules[key] ?? fallback);
    if (!Number.isFinite(value) || value < 0) throw new BadRequestException(`Invalid ${key} rule`);
    return value;
  }
}
