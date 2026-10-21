# MEGA — Painel administrativo

Painel em português para gerenciar usuários e acessos, com login, menu lateral, perfil no cabeçalho, indicadores, busca, filtros, paginação e exportação CSV. O acesso às áreas e ações é definido por RBAC: usuários recebem uma ou mais regras, e cada regra agrega permissões. Contas inativas não acessam o painel.

## Tecnologias

TanStack Start, React, TypeScript, Vite, Radix UI, Lucide, Netlify Functions, Netlify Identity e Netlify Database (Postgres), com Drizzle ORM.

## Desenvolvimento local

Use Node.js 22.13 ou superior e pnpm. Instale as dependências com `pnpm install`, vincule o projeto com `netlify link` e inicie a emulação com `netlify dev --port 8889`. A integração com a plataforma fornece os serviços de autenticação e banco.

## Banco e acesso inicial

O esquema está em `db/schema.ts`. As migrações em `netlify/database/migrations` são aplicadas automaticamente pela plataforma durante o deploy. Para alterar o esquema, execute `pnpm exec drizzle-kit generate --name descricao_da_alteracao` e inclua os arquivos gerados.

A migração inicial inclui o registro do administrador. No primeiro login com as credenciais iniciais fornecidas na solicitação, o sistema provisiona a conta confirmada no Netlify Identity e associa seu identificador ao registro do banco. A verificação inicial fica apenas no servidor, por hash; senhas em texto não são armazenadas no repositório. Logins posteriores usam a senha atual do Identity. Altere a senha em **Meu perfil** após o primeiro acesso.

O administrador principal não pode ser excluído, desativado ou convertido em membro. O cadastro público não concede acesso ao painel: a autorização exige um registro ativo no banco criado pelo administrador.

O build e as validações são executados pelo pipeline da plataforma.

## Regras e permissões (RBAC)

O Postgres mantém usuários, regras e permissões em tabelas relacionais, com chaves estrangeiras e tabelas de associação muitos para muitos. Os códigos de permissão são únicos. A migração RBAC adiciona a regra protegida Admin e as permissões users:read, users:write, roles:read e roles:write, vinculando admin@mega.local e preservando o acesso dos administradores existentes.

As páginas /users, /roles e /permissions usam o mesmo painel autenticado. Os menus aparecem somente para quem possui permissões da área correspondente. Leitura e escrita são verificadas separadamente; users:* e roles:* também podem representar todas as ações da respectiva área. O acesso direto por URL sem permissão mostra “Privilégios insuficientes”. Gerenciar permissões utiliza roles:read e roles:write. Atribuir regras a usuários exige users:write e roles:write.

O evento de login do Identity consulta as relações no banco e inclui app_metadata.roles e app_metadata.permissions no JWT emitido pelo serviço, sem códigos duplicados. O navegador lê esses dados ao hidratar a sessão e os cruza com as permissões atuais da API. Novos acessos concedidos aparecem após autenticar novamente; revogações são respeitadas imediatamente pelo servidor, que consulta o banco em cada operação. O JWT nunca é assinado no navegador.

O seed Admin e suas quatro permissões são protegidos contra edição e exclusão. Não é possível remover a regra Admin do administrador principal, desativá-lo ou excluí-lo. Alterações que reduzam o próprio acesso também são bloqueadas.
