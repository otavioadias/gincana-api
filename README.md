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
| SUPER_ADMIN | `admin@gincana.local` |
| MANAGER | `manager@gincana.local` |
| VALIDATOR | `validator@gincana.local` |
| MEMBER | `member@gincana.local` |

A organização semeada usa o slug `gp-cargo-demo`.

## Regras de equipe

- O primeiro acesso de líder é criado em `POST /auth/register-leader`, ainda sem
  vínculo com equipe.
- Somente uma conta `LEADER` sem membership ativa pode criar sua equipe em
  `POST /teams`. Quem cria entra automaticamente como `MANAGER` e também pode
  participar e registrar ações.
- Líderes adicionam integrantes e podem criar ou promover outros líderes.
- `VALIDATOR` é perfil de plataforma: não pertence a equipe e usa a fila global
  `/validation/submissions` para analisar ações de qualquer equipe.
- `SUPER_ADMIN` também não pertence a equipe; pode criar uma equipe já com seu
  líder inicial em `/admin/organizations`.
- Login usa somente e-mail e senha; o identificador interno da organização não é
  solicitado na interface.
- Senhas e senhas temporárias aceitam a partir de 6 caracteres.

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

- Para participantes e líderes, o tenant é derivado da membership ativa no login
  e gravado no JWT. Validadores e administradores recebem JWT sem tenant.
  Nenhum controller aceita `organizationId` de negócio no corpo da requisição.
- Todo lookup de campanhas, atividades, submissões, evidências, metas e dashboard
  inclui `organizationId`.
- A fila global de validação é a exceção explícita: exige `PlatformRole.VALIDATOR`,
  resolve a equipe pela submissão e não expõe as demais áreas internas.
- `SUPER_ADMIN` não recebe membership de tenant e, por isso, não passa pelo
  `TenantGuard` das rotas internas.
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
