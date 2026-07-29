import * as bcrypt from 'bcrypt';
import { Sequelize } from 'sequelize-typescript';
import {
  ActivityStatus,
  CampaignStatus,
  EntityStatus,
  MembershipRole,
  PlatformRole,
  ScoringType,
} from '../../common/enums';
import {
  Activity,
  ActivityItemType,
  Campaign,
  Membership,
  Organization,
  User,
} from '../models';

type ItemSeed = [name: string, points: number, unit?: string];
type ActivitySeed = {
  name: string;
  scoringType: ScoringType;
  points?: number;
  unit?: string;
  minimumQuantity?: number;
  minimumParticipants?: number;
  maxOccurrences?: number;
  minimumParticipationPercent?: number;
  repeatable?: boolean;
  rulesJson?: Record<string, unknown>;
  items?: ItemSeed[];
};

const activities: ActivitySeed[] = [
  {
    name: 'Dia do Bem GP',
    scoringType: ScoringType.FIXED,
    points: 300,
    minimumParticipationPercent: 50,
    rulesJson: { institutionRequired: true, inPersonRequired: true },
  },
  {
    name: 'Campanha do Agasalho',
    scoringType: ScoringType.PER_ITEM,
    items: [
      ['casaco', 25], ['blusa de frio', 25], ['calça', 25], ['cobertor', 15],
      ['manta', 10], ['meia', 5], ['luva', 5], ['touca', 5], ['cachecol', 5],
    ],
  },
  { name: 'Sopa Solidária', scoringType: ScoringType.FIXED, points: 300, unit: 'litro', minimumQuantity: 5 },
  {
    name: 'Natal dos Sonhos', scoringType: ScoringType.FIXED, points: 300,
    repeatable: true, unit: 'carta', rulesJson: { oneLetterPerActiveMember: true },
  },
  {
    name: 'Banco de Sangue',
    scoringType: ScoringType.PER_MEMBER,
    points: 250,
    unit: 'doador',
    minimumParticipants: 1,
  },
  {
    name: 'Kits de Higiene', scoringType: ScoringType.PER_COMPLETE_KIT, points: 350,
    unit: 'kit', rulesJson: { minimumDistinctItems: 5 },
  },
  { name: 'Tampinhas que Transformam', scoringType: ScoringType.FIXED, points: 250, unit: 'unidade', minimumQuantity: 25 },
  {
    name: 'Mochilas do Futuro', scoringType: ScoringType.FIXED, points: 450,
    rulesJson: { minimumDistinctSchoolItems: 5 },
  },
  {
    name: 'Conexão com Idosos', scoringType: ScoringType.FIXED, points: 500,
    maxOccurrences: 1,
    minimumParticipationPercent: 50,
    rulesJson: { minimumDurationMinutes: 60, institutionRequired: true },
  },
  {
    name: 'Pet Solidário', scoringType: ScoringType.PER_ITEM,
    items: [
      ['ração', 25, 'kg'], ['medicamento', 30], ['cobertor', 15],
      ['brinquedo', 10], ['produto de limpeza', 20],
    ],
  },
  {
    name: 'Biblioteca do Futuro', scoringType: ScoringType.PER_ITEM,
    items: [
      ['infantil', 5], ['literatura', 10], ['infantojuvenil', 5], ['didático', 20],
      ['paradidático', 15], ['dicionário', 20], ['gibi/HQ', 10],
    ],
  },
  {
    name: 'Inclusão e Diversidade',
    scoringType: ScoringType.FIXED,
    points: 500,
    minimumParticipationPercent: 50,
    rulesJson: { institutionRequired: true },
  },
  {
    name: 'Alimentos Não Perecíveis',
    scoringType: ScoringType.PER_ITEM,
    items: [
      ['item de até 1 kg', 50, 'unidade'],
      ['item a partir de 1 kg', 100, 'kg'],
    ],
  },
];

export async function seedDemo(sequelize: Sequelize): Promise<void> {
  await sequelize.transaction(async (transaction) => {
    const [organization] = await Organization.findOrCreate({
      where: { slug: 'gp-cargo-demo' },
      defaults: {
        name: 'GP Cargo Demo',
        slug: 'gp-cargo-demo',
        status: EntityStatus.ACTIVE,
        primaryColor: '#005B96',
        secondaryColor: '#F2A900',
      },
      transaction,
    });
    const passwordHash = await bcrypt.hash(process.env.DEMO_PASSWORD ?? 'ChangeMe123!', 12);
    const users = [
      ['Admin', 'admin@gincana.local', PlatformRole.ADMIN, null],
      ['Manager Demo', 'manager@gincana.local', PlatformRole.USER, MembershipRole.MANAGER],
      ['Member Demo', 'member@gincana.local', PlatformRole.USER, MembershipRole.MEMBER],
    ] as const;
    for (const [name, email, platformRole, role] of users) {
      const [user] = await User.findOrCreate({
        where: { email },
        defaults: {
          name, email, passwordHash, platformRole, mustChangePassword: true,
          status: EntityStatus.ACTIVE,
        },
        transaction,
      });
      await user.update({ name, platformRole }, { transaction });
      if (role) {
        await Membership.findOrCreate({
          where: { organizationId: organization.id, userId: user.id },
          defaults: {
            organizationId: organization.id, userId: user.id, role,
            status: EntityStatus.ACTIVE, joinedAt: new Date(),
          },
          transaction,
        });
      }
    }
    const [campaign] = await Campaign.findOrCreate({
      where: { organizationId: null, name: 'Juntos Fazemos Mais 2026' },
      defaults: {
        organizationId: null,
        name: 'Juntos Fazemos Mais 2026',
        description: 'Campanha de demonstração da Gincana Solidária.',
        startsAt: '2026-08-05',
        endsAt: '2026-12-31',
        status: CampaignStatus.ACTIVE,
        minimumActionsPerMonth: 1,
      },
      transaction,
    });
    await campaign.update(
      {
        description: 'Campanha de demonstração da Gincana Solidária.',
        startsAt: '2026-08-05',
        endsAt: '2026-12-31',
        status: CampaignStatus.ACTIVE,
        minimumActionsPerMonth: 1,
      },
      { transaction },
    );
    for (const seed of activities) {
      const activityValues = {
        organizationId: null,
        campaignId: campaign.id,
        name: seed.name,
        description: null,
        scoringType: seed.scoringType,
        points: String(seed.points ?? 0),
        unit: seed.unit ?? null,
        minimumQuantity: seed.minimumQuantity ? String(seed.minimumQuantity) : null,
        minimumParticipants: seed.minimumParticipants ?? null,
        maxOccurrences: seed.maxOccurrences ?? null,
        maxOccurrencesPerMonth: null,
        maxOccurrencesPerParticipant: null,
        maxOccurrencesPerParticipantPerMonth: null,
        minimumParticipationPercent: seed.minimumParticipationPercent
          ? String(seed.minimumParticipationPercent) : null,
        repeatable: seed.repeatable ?? true,
        evidenceRequired: true,
        rulesJson: seed.rulesJson ?? {},
        status: ActivityStatus.ACTIVE,
      };
      const [activity] = await Activity.findOrCreate({
        where: { organizationId: null, campaignId: campaign.id, name: seed.name },
        defaults: activityValues,
        transaction,
      });
      await activity.update(activityValues, { transaction });
      for (const [name, points, unit = 'unidade'] of seed.items ?? []) {
        const [itemType] = await ActivityItemType.findOrCreate({
          where: { activityId: activity.id, name },
          defaults: {
            activityId: activity.id, name, pointsPerUnit: String(points), unit,
            minimumQuantity: null,
          },
          transaction,
        });
        await itemType.update(
          {
            pointsPerUnit: String(points),
            unit,
            minimumQuantity: null,
          },
          { transaction },
        );
      }
    }
  });
}
