# MEGA admin

## Arquitetura

Aplicação TanStack Start com React e TypeScript. `src/routes/index.tsx` contém login, shell autenticado, visão geral e CRUD. `src/routes/__root.tsx` define o documento HTML em português, metadados e notificações. `src/styles.css` define o sistema visual responsivo, em verde e tons neutros. Componentes Radix reutilizáveis estão em `src/components/ui`.

`netlify/functions/panel.mts` atende `/api/session` e `/api/users`. Autenticação usa exclusivamente `@netlify/identity`. Cada operação consulta o usuário ativo e suas permissões no banco, sem confiar em papéis enviados pelo navegador. RBAC usa usuários com múltiplas regras, que agregam permissões únicas; o campo legado `role` não concede autorização; a criação de contas no Identity acontece somente no servidor. O administrador principal é protegido e administradores não podem remover o próprio acesso.

## Persistência e seed

`db/schema.ts` define usuários, regras, permissões e associações relacionais muitos para muitos; `db/index.ts` cria o cliente Drizzle pelo adaptador Netlify Database. As migrações ficam em `netlify/database/migrations`. Após mudar o esquema, gere a migração com Drizzle Kit; nunca aplique migrações manualmente. Use a linha beta de Drizzle conforme os requisitos do adaptador.

O seed da migração cria o registro `seed-admin`. A primeira autenticação com as credenciais iniciais provisiona sua conta Identity após verificar o hash da senha. O provisionamento só ocorre enquanto o registro não possui `identity_id`. Não redefina a senha de um administrador existente e não inclua senhas em texto ou tokens no repositório. O banco controla a autorização; contas Identity sem associação ativa não entram no painel.

## Convenções

Use TypeScript estrito, imports `@/` para módulos frontend e texto da interface em português. Preserve estados vazios, de carregamento, erros, acessibilidade de dialogs e menus e comportamento responsivo. Dados reais e indicadores vêm da API; não adicione usuários fictícios. Não execute builds, servidores ou testes locais durante runs do agente: o pipeline valida automaticamente. Para desenvolvimento humano use `netlify dev --port 8889`.

## Decisões

Senhas são administradas pelo Identity; o Postgres mantém dados de perfil, status e permissões. Sessões são hidratadas no navegador para renovação dos tokens. A exportação CSV respeita filtros e seleção e neutraliza fórmulas em células. O seed permanece protegido para garantir pelo menos um administrador. Não altere os IDs ou remova essas proteções sem solicitação explícita.

## RBAC

As páginas `/users`, `/roles` e `/permissions` compartilham o shell de `index.tsx`. O CRUD de regras e permissões está em `src/components/access-manager.tsx`. A API também atende `/api/roles` e `/api/permissions`. `db/rbac.ts` agrega as permissões e `netlify/functions/identity-rbac.mts` fornece as claims ao JWT no login. Use `users:read` e `users:write` para usuários, `roles:read` e `roles:write` para regras e permissões. Atribuir regras exige também `roles:write`. Preserve a regra `seed-role-admin` e as permissões do seed, além das proteções existentes do administrador inicial.
