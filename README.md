# Gincana Solidária API

API REST multi-tenant para campanhas solidárias, evidências, validação, pontuação,
metas e dashboards. O projeto usa NestJS, TypeScript strict, PostgreSQL,
Sequelize, JWT e storage S3 compatível.

## Requisitos

- Node.js 22 LTS
- pnpm 11
- Docker com Docker Compose

## Execução local

```powershell
Copy-Item .env.example .env
docker compose up -d postgres minio
pnpm install
pnpm start:dev
```

O comando de inicialização aplica automaticamente todas as migrations e, em
seguida, todos os seeds antes de abrir a API. Para preparar somente o banco,
sem iniciar o servidor, use `pnpm db:setup`.

A API fica em `http://localhost:3000`. A documentação Swagger fica em
`http://localhost:3000/docs` e o JSON OpenAPI em
`http://localhost:3000/docs/openapi.json`.

Para gerar uma cópia estática do contrato:

```powershell
pnpm openapi:export
```

O console do MinIO fica em `http://localhost:9001`.

## Credenciais de demonstração

Os usuários de demonstração usam a senha definida em `DEMO_PASSWORD` (por
padrão, `ChangeMe123!`) e entram com `mustChangePassword: true`. As contas
administrativas abaixo são mantidas ativas pelo seed e têm acesso geral à
plataforma:

| Perfil | E-mail | Senha padrão |
| --- | --- | --- |
| ADMIN | `admin@gincana.local` | `ADMIN_PASSWORD` ou `DEMO_PASSWORD` |
| ADMIN | `afigueiredo@gpcargo.com.br` | `FIGUEIREDO_PASSWORD` |
| ADMIN | `eaugusto@gpcargo.com.br` | `EAUGUSTO_PASSWORD` |
| ADMIN | `iarmond@gpcargo.com.br` | `IARMOND_PASSWORD` |
| MANAGER | `manager@gincana.local` | `DEMO_PASSWORD` |
| MEMBER | `member@gincana.local` | `DEMO_PASSWORD` |

A organização semeada usa o slug `gp-cargo-demo`.

O seed adiciona três integrantes simulados a cada equipe ativa e inclui quatorze
atividades por equipe em diferentes etapas do fluxo: rascunho preenchido,
aguardando correção, enviada, em análise, aprovada, parcialmente aprovada e
rejeitada. Algumas modalidades se repetem em meses e datas diferentes, com
quantidades e participantes variados por equipe. Itens, pontuação e histórico
de validação alimentam as listagens, o ranking, a regularidade e os dashboards.
O comando pode ser executado novamente sem duplicar esses registros e também
passa a contemplar equipes criadas posteriormente.

Os integrantes adicionais seguem o padrão
`ana.<slug>@gincana.local`, `bruno.<slug>@gincana.local` e
`carla.<slug>@gincana.local`, usando a mesma senha de demonstração.

## Papéis e equipes

- Existe um único papel de plataforma: `ADMIN`. Ele administra a gincana,
  acompanha todas as equipes e revisa suas tarefas.
- Dentro de cada equipe existem `MANAGER` e `MEMBER`.
- O primeiro manager pode se registrar em `POST /auth/register-manager` e criar
  sua equipe em `POST /teams`.
- Managers adicionam integrantes e podem criar ou promover outros managers para
  ajudar na gestão. Não há limite de um manager por equipe.
- O admin também pode criar equipes com seu manager inicial em
  `POST /admin/organizations`.
- Login usa somente e-mail e senha; o identificador interno da organização não é
  solicitado na interface.
- Senhas e senhas temporárias aceitam a partir de 6 caracteres.

## Gincana compartilhada

- Campanhas, modalidades, limites, itens e metas são globais e aparecem
  igualmente para todas as equipes.
- Submissões, participantes, disponibilidade, pontuação, regularidade e tema
  continuam isolados por equipe.
- O admin acompanha o resumo de todas as equipes em
  `GET /admin/dashboard/teams` e uma equipe específica em
  `GET /admin/dashboard/teams/{organizationId}`.
- Todo usuário autenticado acessa o ranking geral em `GET /ranking`, que retorna
  posição, foto, nome, pontuação aprovada e data da última atualização de cada
  equipe. O parâmetro opcional `campaignId` restringe a pontuação a uma
  campanha.
- O ranking individual usa `GET /ranking/members`. Managers e members sempre
  visualizam apenas integrantes da própria equipe. Para admin, o parâmetro
  `organizationId` é obrigatório e seleciona a equipe consultada. A pontuação
  individual pertence ao autor da atividade e considera somente aprovações
  totais ou parciais.
- O admin lista tarefas de todas as equipes em `GET /admin/submissions`, podendo
  filtrar por `organizationId`, `campaignId` e `status`.
- Aprovação direta é feita em `POST /admin/submissions/{id}/approve`.
  Aprovação parcial, pedido de ajustes e rejeição usam
  `POST /admin/submissions/{id}/validate`.

## Comandos

```powershell
pnpm lint
pnpm test
pnpm test:cov
pnpm build
pnpm db:migrate
pnpm db:migrate:down
pnpm db:seed
pnpm db:setup
pnpm openapi:export
```

O arquivo [requests.http](./requests.http) contém exemplos de login, refresh,
consulta, criação de rascunho e upload.

## Arquitetura e segurança

- Para managers e membros, o tenant é derivado da membership ativa no login e
  gravado no JWT. O admin recebe JWT sem tenant.
- Campanhas, atividades e metas usam escopo global (`organizationId = null`).
- Todo lookup de submissões, evidências, membros, disponibilidade, identidade
  visual e dashboard de equipe inclui `organizationId`.
- Endpoints administrativos exigem `PlatformRole.ADMIN`; quando operam sobre
  uma equipe específica, recebem o identificador explicitamente.
- Senhas usam bcrypt. Refresh tokens são aleatórios, persistidos somente como
  SHA-256 e rotacionados de forma transacional.
- Aprovação altera pontuação, cria `validation_events` e `audit_logs` na mesma
  transação.
- Evidências ficam no MinIO/S3; o banco guarda apenas metadados. MIME declarado,
  extensão e assinatura binária são conferidos. O checksum é único por
  organização, impedindo reutilização sem revelar duplicidade entre tenants.
- URLs de leitura são assinadas e curtas. O upload usa memória apenas durante a
  requisição e nunca persiste no filesystem da API.
- `synchronize` está desativado. O schema nasce exclusivamente das migrations.

### Regras da campanha 2026

- A campanha de demonstração começa em `2026-08-05`.
- A mesma modalidade pode ser repetida em datas diferentes. `Conexão com
  Idosos` é a única modalidade oficial limitada a uma ocorrência por equipe.
- Limites de equipe e participante podem ser configurados por campanha ou mês.
  Aprovações são serializadas por atividade e revalidam esses limites.
- A pontuação só entra no placar após aprovação total ou parcial.
- Alimentos de até 1 kg valem 50 pontos por unidade; itens a partir de 1 kg
  valem 100 pontos por kg. Não há faixas cumulativas para essa modalidade.
- Kits completos são derivados da menor quantidade entre pelo menos cinco
  categorias, sempre arredondada para baixo.
- Duração, instituição, cartas por integrante, composição de kits/mochilas e
  participação mínima são validadas no envio.

Pontuação calculada é apenas uma prévia. O dashboard mantém `approvedPoints` e
`pendingPoints` separados e também retorna `totalPoints`, que mostra os dois no
andamento geral. O mesmo resumo apresenta o recorte individual de quem está
autenticado.

## Docker de produção

O `Dockerfile` usa estágios separados para dependências, build e runtime, remove
dependências de desenvolvimento e executa com o usuário `node`.

```powershell
docker build -t gincana-api .
docker run --env-file .env -p 3000:3000 gincana-api
```

Em produção, use PostgreSQL gerenciado, bucket privado externo, segredos fortes e
TLS. A imagem executa `db:setup:prod` antes de iniciar a API, aplicando migrations
pendentes e todos os seeds de maneira idempotente.

Na imagem compilada, os comandos correspondentes são:

```powershell
pnpm db:migrate:prod
pnpm db:seed:prod
pnpm db:setup:prod
```

## Observações de produto

- A participação mínima usa a quantidade atual de memberships
  ativas. Se a equipe precisar preservar o tamanho histórico na data da ação,
  será necessário criar snapshots de composição.
- Recuperação de senha e convites por e-mail ficaram fora das rotas mínimas; a
  criação de membros usa senha temporária com troca obrigatória.
