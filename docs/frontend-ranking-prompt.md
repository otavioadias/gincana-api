# Prompt para implementar o ranking no frontend

Implemente a página autenticada de ranking usando os padrões visuais,
componentes, cliente HTTP, gerenciamento de autenticação e tratamento de erros
já existentes no projeto. Não altere o backend e não replique cálculos de
pontuação no cliente.

## Experiência da página

- Mantenha uma única página de ranking.
- Use duas opções em tabs ou segmented control:
  1. `Minha equipe` — visão padrão.
  2. `Ranking geral`.
- Destaque visualmente as três primeiras posições.
- Formate pontos em `pt-BR`, preservando casas decimais quando existirem.
- Formate `lastUpdatedAt` como data e hora local.
- Implemente estados de carregamento, erro, vazio e atualização/refetch.
- A página só deve estar disponível para usuários autenticados.

## Ranking da equipe

Consuma `GET /ranking/members`, sempre enviando o Bearer token.

Para `USER` (MANAGER ou MEMBER):

- Não envie `organizationId`.
- O backend identifica e restringe automaticamente a equipe do usuário.
- Destaque a linha do usuário autenticado comparando `userId`.

Para `ADMIN`:

- Exiba acima do ranking um seletor obrigatório de equipe.
- Carregue as opções por `GET /admin/organizations` e mostre somente equipes
  com `status: "ACTIVE"`.
- Ao selecionar uma equipe, consulte
  `GET /ranking/members?organizationId=<id>`.
- Se for útil para o fluxo atual, selecione inicialmente a primeira equipe
  ativa; caso contrário, apresente o estado “Selecione uma equipe”.
- Preserve a equipe selecionada enquanto o usuário alterna entre as duas tabs.

O endpoint retorna:

```ts
type TeamMemberRanking = {
  team: {
    id: string;
    name: string;
    slug: string;
  };
  ranking: Array<{
    position: number;
    membershipId: string;
    userId: string;
    name: string;
    points: number;
    approvedActions: number;
    lastUpdatedAt: string | null;
  }>;
};
```

Mostre posição, avatar com as iniciais do nome, nome, pontos, número de ações
aprovadas e última atualização. Não exiba informações de outras equipes nessa
visão.

## Ranking geral

Consuma `GET /ranking`, sempre enviando o Bearer token.

O endpoint retorna:

```ts
type TeamRankingEntry = {
  position: number;
  organizationId: string;
  name: string;
  slug: string;
  photoUrl: string | null;
  points: number;
  lastUpdatedAt: string | null;
};
```

Mostre foto/logo da equipe, nome, posição, pontuação e última atualização. Use
um avatar com as iniciais quando `photoUrl` for `null` ou quando a imagem falhar.

Se a aplicação já possuir campanha selecionada globalmente, envie
`campaignId=<id>` nos dois endpoints. Caso contrário, não envie o parâmetro.

## Regras e erros

- `401`: seguir o fluxo existente de renovação de token ou redirecionamento para
  login.
- `400` para admin no ranking individual: solicitar a seleção de uma equipe.
- `403`: mostrar mensagem de acesso negado; nunca tentar contornar a restrição
  no cliente.
- Não somar pontos no frontend. Use exatamente `points` retornado pela API.
- Não permitir que MEMBER ou MANAGER escolham ou injetem outro
  `organizationId`.

## Critérios de aceite

- Minha equipe é a visão inicial.
- MEMBER e MANAGER visualizam somente os membros da própria equipe.
- ADMIN consegue alternar a equipe pelo filtro.
- Ranking geral continua acessível a todos os usuários autenticados.
- Alternar tabs não causa perda desnecessária da seleção nem resultados
  piscando.
- Layout funciona em desktop e mobile.
- Inclua testes para alternância de visão, seleção de equipe pelo admin,
  destaque do usuário atual, estados vazios e erros 400/401/403.
