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
pnpm db:migrate
pnpm db:seed
pnpm start:dev
```

A API fica em `http://localhost:3000`. A documentação Swagger fica em
`http://localhost:3000/docs` e o JSON OpenAPI em
`http://localhost:3000/docs/openapi.json`.

Para gerar uma cópia estática do contrato:

```powershell
pnpm openapi:export
```

O console do MinIO fica em `http://localhost:9001`.

## Credenciais de demonstração

Todos os usuários usam a senha definida em `DEMO_PASSWORD` (por padrão,
`ChangeMe123!`) e entram com `mustChangePassword: true`.

| Perfil | E-mail |
| --- | --- |
| ADMIN | `admin@gincana.local` |
| MANAGER | `manager@gincana.local` |
| MEMBER | `member@gincana.local` |

A organização semeada usa o slug `gp-cargo-demo`.

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
TLS. Execute migrations como etapa separada do deploy antes de trocar o tráfego.

Na imagem compilada, os comandos correspondentes são:

```powershell
pnpm db:migrate:prod
pnpm db:seed:prod
```

## Observações de produto

- A participação mínima usa a quantidade atual de memberships
  ativas. Se a equipe precisar preservar o tamanho histórico na data da ação,
  será necessário criar snapshots de composição.
- Recuperação de senha e convites por e-mail ficaram fora das rotas mínimas; a
  criação de membros usa senha temporária com troca obrigatória.
