import * as bcrypt from 'bcrypt';
import { Transaction } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { v5 as uuidv5 } from 'uuid';
import {
  ActivityStatus,
  CampaignStatus,
  EntityStatus,
  MembershipRole,
  PlatformRole,
  ScoringType,
  SubmissionStatus,
} from '../../common/enums';
import {
  Activity,
  ActivityItemType,
  AuditLog,
  Campaign,
  Membership,
  Organization,
  Submission,
  SubmissionItem,
  SubmissionParticipant,
  User,
  ValidationEvent,
} from '../models';
import { ScoringEngine } from '../../modules/submissions/scoring.engine';

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

type SubmissionSeed = {
  id: string;
  activityName: string;
  authorEmail: string;
  actionDate: string;
  status: SubmissionStatus;
  institutionName?: string;
  quantity?: number;
  unit?: string;
  durationMinutes?: number;
  notes: string;
  items?: Array<[name: string, quantity: number]>;
  participantEmails: string[];
  approvedPoints?: number;
  validationReason?: string;
};

const TEAM_SEED_NAMESPACE = '639e90ab-4d87-4a6c-a7bd-927bc1ef3541';

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

const demoSubmissions: SubmissionSeed[] = [
  {
    id: '00000000-0000-4000-8000-000000001001',
    activityName: 'Pet Solidário',
    authorEmail: 'member@gincana.local',
    actionDate: '2026-08-12',
    status: SubmissionStatus.DRAFT,
    institutionName: 'Associação Patas Felizes',
    quantity: 24,
    unit: 'itens',
    notes: 'Rascunho preenchido para demonstrar uma atividade ainda não enviada.',
    items: [
      ['ração', 18],
      ['medicamento', 2],
      ['cobertor', 4],
    ],
    participantEmails: ['member@gincana.local'],
  },
  {
    id: '00000000-0000-4000-8000-000000001002',
    activityName: 'Campanha do Agasalho',
    authorEmail: 'manager@gincana.local',
    actionDate: '2026-08-20',
    status: SubmissionStatus.NEEDS_CHANGES,
    institutionName: 'Centro Comunitário Esperança',
    quantity: 22,
    unit: 'peças',
    notes: 'Aguardando a correção solicitada pela administração.',
    items: [
      ['casaco', 6],
      ['cobertor', 4],
      ['meia', 12],
    ],
    participantEmails: ['manager@gincana.local', 'member@gincana.local'],
    validationReason: 'Inclua uma foto geral das peças separadas para doação.',
  },
  {
    id: '00000000-0000-4000-8000-000000001003',
    activityName: 'Sopa Solidária',
    authorEmail: 'member@gincana.local',
    actionDate: '2026-09-05',
    status: SubmissionStatus.SUBMITTED,
    institutionName: 'Casa de Acolhimento São Lucas',
    quantity: 18,
    unit: 'litro',
    notes: 'Atividade enviada e aguardando a análise da administração.',
    participantEmails: ['manager@gincana.local', 'member@gincana.local'],
  },
  {
    id: '00000000-0000-4000-8000-000000001004',
    activityName: 'Alimentos Não Perecíveis',
    authorEmail: 'manager@gincana.local',
    actionDate: '2026-09-18',
    status: SubmissionStatus.UNDER_REVIEW,
    institutionName: 'Banco de Alimentos Municipal',
    quantity: 14,
    unit: 'itens',
    notes: 'Conferência das quantidades em andamento.',
    items: [
      ['item de até 1 kg', 6],
      ['item a partir de 1 kg', 8],
    ],
    participantEmails: ['manager@gincana.local', 'member@gincana.local'],
  },
  {
    id: '00000000-0000-4000-8000-000000001005',
    activityName: 'Dia do Bem GP',
    authorEmail: 'manager@gincana.local',
    actionDate: '2026-10-04',
    status: SubmissionStatus.APPROVED,
    institutionName: 'Praça do Bairro Primavera',
    durationMinutes: 240,
    notes: 'Ação comunitária concluída e aprovada integralmente.',
    participantEmails: ['manager@gincana.local', 'member@gincana.local'],
  },
  {
    id: '00000000-0000-4000-8000-000000001006',
    activityName: 'Banco de Sangue',
    authorEmail: 'member@gincana.local',
    actionDate: '2026-10-22',
    status: SubmissionStatus.APPROVED,
    institutionName: 'Hemocentro Regional',
    quantity: 2,
    unit: 'doador',
    notes: 'Doação coletiva concluída e validada.',
    participantEmails: ['manager@gincana.local', 'member@gincana.local'],
  },
  {
    id: '00000000-0000-4000-8000-000000001007',
    activityName: 'Biblioteca do Futuro',
    authorEmail: 'manager@gincana.local',
    actionDate: '2026-11-08',
    status: SubmissionStatus.PARTIALLY_APPROVED,
    institutionName: 'Biblioteca Comunitária Girassol',
    quantity: 17,
    unit: 'livros',
    notes: 'Atividade finalizada com aprovação parcial dos itens.',
    items: [
      ['literatura', 8],
      ['didático', 4],
      ['gibi/HQ', 5],
    ],
    participantEmails: ['manager@gincana.local', 'member@gincana.local'],
    approvedPoints: 180,
    validationReason: 'Dois livros apresentaram avarias e não foram pontuados.',
  },
  {
    id: '00000000-0000-4000-8000-000000001008',
    activityName: 'Conexão com Idosos',
    authorEmail: 'member@gincana.local',
    actionDate: '2026-11-19',
    status: SubmissionStatus.REJECTED,
    institutionName: 'Residencial Vida Serena',
    durationMinutes: 90,
    notes: 'Exemplo de atividade finalizada sem pontuação.',
    participantEmails: ['manager@gincana.local', 'member@gincana.local'],
    validationReason: 'A evidência enviada não permitiu confirmar a data da ação.',
  },
  {
    id: '00000000-0000-4000-8000-000000001009',
    activityName: 'Campanha do Agasalho',
    authorEmail: 'member@gincana.local',
    actionDate: '2026-09-27',
    status: SubmissionStatus.APPROVED,
    institutionName: 'Centro Comunitário Esperança',
    quantity: 19,
    unit: 'peças',
    notes: 'Segunda participação na campanha, concluída e aprovada.',
    items: [
      ['blusa de frio', 5],
      ['calça', 4],
      ['manta', 3],
      ['touca', 7],
    ],
    participantEmails: ['manager@gincana.local', 'member@gincana.local'],
  },
  {
    id: '00000000-0000-4000-8000-000000001010',
    activityName: 'Sopa Solidária',
    authorEmail: 'manager@gincana.local',
    actionDate: '2026-10-12',
    status: SubmissionStatus.SUBMITTED,
    institutionName: 'Casa de Acolhimento São Lucas',
    quantity: 24,
    unit: 'litro',
    notes: 'Segunda edição enviada e aguardando validação.',
    participantEmails: ['manager@gincana.local', 'member@gincana.local'],
  },
  {
    id: '00000000-0000-4000-8000-000000001011',
    activityName: 'Pet Solidário',
    authorEmail: 'member@gincana.local',
    actionDate: '2026-11-14',
    status: SubmissionStatus.APPROVED,
    institutionName: 'Associação Patas Felizes',
    quantity: 31,
    unit: 'itens',
    notes: 'Segunda arrecadação para a associação, aprovada.',
    items: [
      ['ração', 22],
      ['cobertor', 5],
      ['brinquedo', 4],
    ],
    participantEmails: ['manager@gincana.local', 'member@gincana.local'],
  },
  {
    id: '00000000-0000-4000-8000-000000001012',
    activityName: 'Dia do Bem GP',
    authorEmail: 'manager@gincana.local',
    actionDate: '2026-11-29',
    status: SubmissionStatus.APPROVED,
    institutionName: 'Parque Municipal',
    durationMinutes: 180,
    notes: 'Segunda ação presencial concluída pela equipe.',
    participantEmails: ['manager@gincana.local', 'member@gincana.local'],
  },
  {
    id: '00000000-0000-4000-8000-000000001013',
    activityName: 'Alimentos Não Perecíveis',
    authorEmail: 'member@gincana.local',
    actionDate: '2026-12-08',
    status: SubmissionStatus.APPROVED,
    institutionName: 'Banco de Alimentos Municipal',
    quantity: 24,
    unit: 'itens',
    notes: 'Arrecadação de encerramento aprovada integralmente.',
    items: [
      ['item de até 1 kg', 10],
      ['item a partir de 1 kg', 14],
    ],
    participantEmails: ['manager@gincana.local', 'member@gincana.local'],
  },
  {
    id: '00000000-0000-4000-8000-000000001014',
    activityName: 'Sopa Solidária',
    authorEmail: 'manager@gincana.local',
    actionDate: '2026-12-19',
    status: SubmissionStatus.APPROVED,
    institutionName: 'Casa de Acolhimento São Lucas',
    quantity: 30,
    unit: 'litro',
    notes: 'Terceira edição da atividade, concluída e aprovada.',
    participantEmails: ['manager@gincana.local', 'member@gincana.local'],
  },
];

function shiftedDate(date: string, days: number): string {
  const shifted = new Date(`${date}T00:00:00.000Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}

function validationId(submissionId: string): string {
  if (submissionId.startsWith('00000000-0000-4000-8000-000000001')) {
    return `10000000-0000-4000-8000-${submissionId.slice(-12)}`;
  }
  return uuidv5(`validation:${submissionId}`, TEAM_SEED_NAMESPACE);
}

function auditId(submissionId: string): string {
  if (submissionId.startsWith('00000000-0000-4000-8000-000000001')) {
    return `20000000-0000-4000-8000-${submissionId.slice(-12)}`;
  }
  return uuidv5(`audit:${submissionId}`, TEAM_SEED_NAMESPACE);
}

function submissionSeedsForTeam(
  organization: Organization,
  memberEmails: string[],
  variant: number,
): SubmissionSeed[] {
  return demoSubmissions.map((seed, index) => {
    const authorIndex = index % memberEmails.length;
    const minimumParticipation =
      seed.activityName === 'Dia do Bem GP' ||
      seed.activityName === 'Conexão com Idosos';
    const participantCount = minimumParticipation
      ? Math.ceil(memberEmails.length / 2)
      : Math.min(memberEmails.length, 2 + ((variant + index) % 2));
    const participantEmails = Array.from(
      { length: participantCount },
      (_, offset) => memberEmails[(authorIndex + offset) % memberEmails.length],
    );
    const itemMultiplier = 1 + variant * 0.25;
    const items = seed.items?.map(
      ([name, quantity]) =>
        [name, Math.max(1, Math.round(quantity * itemMultiplier))] as [
          string,
          number,
        ],
    );
    const itemQuantity = items?.reduce((total, [, quantity]) => total + quantity, 0);
    const quantity =
      itemQuantity ??
      (seed.quantity === undefined
        ? undefined
        : Math.max(1, Math.round(seed.quantity * itemMultiplier)));
    return {
      ...seed,
      id:
        organization.slug === 'gp-cargo-demo'
          ? seed.id
          : uuidv5(
              `submission:${organization.slug}:${index + 1}`,
              TEAM_SEED_NAMESPACE,
            ),
      authorEmail: memberEmails[authorIndex],
      actionDate: shiftedDate(seed.actionDate, variant),
      institutionName: `${seed.institutionName ?? 'Instituição parceira'} — ${organization.name}`,
      quantity,
      items,
      participantEmails,
      approvedPoints:
        seed.approvedPoints === undefined
          ? undefined
          : seed.approvedPoints + variant * 20,
      notes: `${seed.notes} Equipe: ${organization.name}.`,
    };
  });
}

async function seedSubmissions(
  organization: Organization,
  campaign: Campaign,
  seeds: SubmissionSeed[],
  usersByEmail: Map<string, User>,
  membershipsByEmail: Map<string, Membership>,
  admin: User,
  transaction: Transaction,
): Promise<void> {
  const scoring = new ScoringEngine();
  for (const seed of seeds) {
    const activity = await Activity.findOne({
      where: {
        organizationId: null,
        campaignId: campaign.id,
        name: seed.activityName,
      },
      transaction,
    });
    if (!activity) {
      throw new Error(`Seed activity not found: ${seed.activityName}`);
    }
    const author = usersByEmail.get(seed.authorEmail);
    if (!author) throw new Error(`Seed user not found: ${seed.authorEmail}`);
    const itemTypes = await ActivityItemType.findAll({
      where: { activityId: activity.id },
      transaction,
    });
    const itemTypesByName = new Map(itemTypes.map((item) => [item.name, item]));
    const submissionItems = (seed.items ?? []).map(([name, quantity]) => {
      const itemType = itemTypesByName.get(name);
      if (!itemType) {
        throw new Error(`Seed item type not found: ${seed.activityName}/${name}`);
      }
      return { itemType, quantity };
    });
    const calculatedPoints = scoring.calculate({
      activity: {
        scoringType: activity.scoringType,
        points: Number(activity.points),
        rulesJson: activity.rulesJson,
      },
      quantity: seed.quantity ?? 0,
      participantCount: seed.participantEmails.length,
      items: submissionItems.map(({ itemType, quantity }) => ({
        quantity,
        pointsPerUnit: Number(itemType.pointsPerUnit),
      })),
    });
    const storedCalculatedPoints =
      seed.status === SubmissionStatus.DRAFT ? 0 : calculatedPoints;
    const approvedPoints =
      seed.status === SubmissionStatus.APPROVED
        ? calculatedPoints
        : seed.status === SubmissionStatus.PARTIALLY_APPROVED
          ? (seed.approvedPoints ?? 0)
          : 0;
    const submissionValues = {
      organizationId: organization.id,
      campaignId: campaign.id,
      activityId: activity.id,
      createdBy: author.id,
      actionDate: seed.actionDate,
      institutionName: seed.institutionName ?? null,
      quantity: seed.quantity === undefined ? null : String(seed.quantity),
      unit: seed.unit ?? activity.unit,
      detailsJson:
        seed.durationMinutes === undefined
          ? {}
          : { durationMinutes: seed.durationMinutes },
      status: seed.status,
      calculatedPoints: String(storedCalculatedPoints),
      approvedPoints: String(approvedPoints),
      notes: seed.notes,
    };
    const [submission] = await Submission.findOrCreate({
      where: { id: seed.id },
      defaults: { id: seed.id, ...submissionValues },
      transaction,
    });
    await submission.update(submissionValues, { transaction });

    await SubmissionItem.destroy({
      where: { submissionId: submission.id },
      transaction,
    });
    if (submissionItems.length > 0) {
      await SubmissionItem.bulkCreate(
        submissionItems.map(({ itemType, quantity }) => ({
          submissionId: submission.id,
          activityItemTypeId: itemType.id,
          quantity: String(quantity),
          calculatedPoints: String(quantity * Number(itemType.pointsPerUnit)),
        })),
        { transaction },
      );
    }

    await SubmissionParticipant.destroy({
      where: { submissionId: submission.id },
      transaction,
    });
    const participantMemberships = seed.participantEmails.map((email) => {
      const membership = membershipsByEmail.get(email);
      if (!membership) throw new Error(`Seed membership not found: ${email}`);
      return membership;
    });
    await SubmissionParticipant.bulkCreate(
      participantMemberships.map((membership) => ({
        submissionId: submission.id,
        membershipId: membership.id,
      })),
      { transaction },
    );

    if (
      [
        SubmissionStatus.NEEDS_CHANGES,
        SubmissionStatus.APPROVED,
        SubmissionStatus.PARTIALLY_APPROVED,
        SubmissionStatus.REJECTED,
      ].includes(seed.status)
    ) {
      const eventId = validationId(seed.id);
      const validationValues = {
        submissionId: submission.id,
        adminId: admin.id,
        fromStatus: SubmissionStatus.SUBMITTED,
        toStatus: seed.status,
        pointsBefore: '0',
        pointsAfter: String(approvedPoints),
        reason: seed.validationReason ?? null,
      };
      const [validationEvent] = await ValidationEvent.findOrCreate({
        where: { id: eventId },
        defaults: { id: eventId, ...validationValues },
        transaction,
      });
      await validationEvent.update(validationValues, { transaction });

      const logId = auditId(seed.id);
      const auditValues = {
        organizationId: organization.id,
        actorUserId: admin.id,
        action: 'SUBMISSION_VALIDATED',
        entityType: 'Submission',
        entityId: submission.id,
        metadataJson: {
          fromStatus: SubmissionStatus.SUBMITTED,
          toStatus: seed.status,
          pointsBefore: 0,
          pointsAfter: approvedPoints,
        },
      };
      const [auditLog] = await AuditLog.findOrCreate({
        where: { id: logId },
        defaults: { id: logId, ...auditValues },
        transaction,
      });
      await auditLog.update(auditValues, { transaction });
    }
  }
}

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
      ['Manager Demo', 'manager@gincana.local', PlatformRole.USER, MembershipRole.MANAGER],
      ['Member Demo', 'member@gincana.local', PlatformRole.USER, MembershipRole.MEMBER],
    ] as const;
    const usersByEmail = new Map<string, User>();
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
      usersByEmail.set(email, user);
      if (role) {
        const [membership] = await Membership.findOrCreate({
          where: { organizationId: organization.id, userId: user.id },
          defaults: {
            organizationId: organization.id, userId: user.id, role,
            status: EntityStatus.ACTIVE, joinedAt: new Date(),
          },
          transaction,
        });
        await membership.update(
          { role, status: EntityStatus.ACTIVE },
          { transaction },
        );
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
    const admin = await User.findOne({
      where: { email: 'admin@gincana.local' },
      transaction,
    });
    if (!admin) throw new Error('Seed admin user not found; run the admin seed first');
    const organizations = await Organization.findAll({
      where: { status: EntityStatus.ACTIVE },
      order: [['name', 'ASC']],
      transaction,
    });
    const seededMembers = [
      ['Ana', 'ana'],
      ['Bruno', 'bruno'],
      ['Carla', 'carla'],
    ] as const;
    for (const currentOrganization of organizations) {
      for (const [name, emailPrefix] of seededMembers) {
        const email = `${emailPrefix}.${currentOrganization.slug}@gincana.local`;
        const [user] = await User.findOrCreate({
          where: { email },
          defaults: {
            name: `${name} ${currentOrganization.name}`,
            email,
            passwordHash,
            platformRole: PlatformRole.USER,
            mustChangePassword: true,
            status: EntityStatus.ACTIVE,
          },
          transaction,
        });
        await user.update(
          {
            name: `${name} ${currentOrganization.name}`,
            platformRole: PlatformRole.USER,
            status: EntityStatus.ACTIVE,
          },
          { transaction },
        );
        const [membership] = await Membership.findOrCreate({
          where: {
            organizationId: currentOrganization.id,
            userId: user.id,
          },
          defaults: {
            organizationId: currentOrganization.id,
            userId: user.id,
            role: MembershipRole.MEMBER,
            status: EntityStatus.ACTIVE,
            joinedAt: new Date(),
          },
          transaction,
        });
        await membership.update(
          { role: MembershipRole.MEMBER, status: EntityStatus.ACTIVE },
          { transaction },
        );
      }
      const teamMemberships = await Membership.findAll({
        where: {
          organizationId: currentOrganization.id,
          status: EntityStatus.ACTIVE,
        },
        include: [{ model: User, where: { status: EntityStatus.ACTIVE } }],
        transaction,
      });
      teamMemberships.sort((left, right) => {
        const leftRole = left.role === MembershipRole.MANAGER ? 0 : 1;
        const rightRole = right.role === MembershipRole.MANAGER ? 0 : 1;
        return leftRole - rightRole ||
          left.user!.email.localeCompare(right.user!.email);
      });
      const teamUsersByEmail = new Map(
        teamMemberships.map((membership) => [
          membership.user!.email,
          membership.user!,
        ]),
      );
      const teamMembershipsByEmail = new Map(
        teamMemberships.map((membership) => [
          membership.user!.email,
          membership,
        ]),
      );
      const memberEmails = teamMemberships.map(
        (membership) => membership.user!.email,
      );
      const variant =
        [...currentOrganization.slug].reduce(
          (total, character) => total + character.charCodeAt(0),
          0,
        ) % 4;
      await seedSubmissions(
        currentOrganization,
        campaign,
        submissionSeedsForTeam(currentOrganization, memberEmails, variant),
        teamUsersByEmail,
        teamMembershipsByEmail,
        admin,
        transaction,
      );
    }
  });
}
