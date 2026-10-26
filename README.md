# AV2 - GreenCode

> Do descarte ao destino: cada equipamento rastreado.

API RESTful para **logística reversa de equipamentos eletrônicos**, desenvolvida em Node.js e TypeScript com Fastify, Prisma ORM e PostgreSQL.

O greencode acompanha o caminho de equipamentos descartados por organizações clientes: do contrato com a organização, passando pela chegada dos lotes e pela triagem de cada equipamento, até o destino final (reaproveitamento de peças, reciclagem, descarte seguro) e a baixa definitiva. Cada equipamento recebe do sistema um código de barras interno (ex.: `GC-2026-000123`) e pode ser rastreado do começo ao fim.

Esta é a evolução da [AV1](https://github.com/pamelaiwabuchi/AV1), que era uma aplicação de linha de comando com arquivos criptografados. Agora o sistema é um servidor monolítico com banco de dados relacional.

---

## Início rápido

Precisa só do [Docker](https://www.docker.com/) instalado. Os comandos são os mesmos no Linux e no Windows:

```bash
git clone https://github.com/pamelaiwabuchi/AV2.git
cd AV2
docker compose up -d --build
```

1. Abra <http://localhost:3333/docs>.
2. Em `POST /auth/login`, entre com `{ "login": "admin", "senha": "Greencode1" }`.
3. Clique em **Authorize**, cole o token e troque a senha em `PATCH /auth/senha` (a do seed é provisória).
4. Use o token novo no **Authorize**. Pronto: o [roteiro rápido de teste](#roteiro-rápido-de-teste-uns-5-minutos) mostra o que experimentar.

Para desligar: `docker compose down`. Para instalar sem Docker, veja a [seção 2](#2-instalação).

---

## Sumário

1. [Requisitos](#1-requisitos)
2. [Instalação (Linux e Windows)](#2-instalação)
3. [Como usar](#3-como-usar)
4. [Usuários e permissões](#4-usuários-e-permissões)
5. [Rotas da API](#5-rotas-da-api)
6. [Arquitetura](#6-arquitetura)
7. [Regras de negócio](#7-regras-de-negócio)
8. [Decisões e justificativas](#8-decisões-e-justificativas)
9. [Testes](#9-testes)
10. [Limitações conhecidas e melhorias futuras](#10-limitações-conhecidas-e-melhorias-futuras)

---

## 1. Requisitos

- **Git**
- **Com Docker:** só o Docker (no Windows, o Docker Desktop).
- **Sem Docker:** **Node.js 22 ou mais novo** (confira com `node --version`) e **PostgreSQL 14 ou mais novo**.

Funciona em **Windows 10 ou superior** e **Ubuntu 24.04 ou superior** (e derivados). Desenvolvido no Arch Linux.

---

## 2. Instalação

Há dois jeitos: com Docker (2.1), que sobe o banco e a API com um comando, ou instalando tudo no sistema (2.2 a 2.5).

### 2.1 Com Docker

```bash
git clone https://github.com/pamelaiwabuchi/AV2.git
cd AV2
docker compose up -d --build
```

Os comandos são os mesmos no Linux e no Windows. O `.env` é opcional: sem ele, o `docker-compose.yml` usa valores padrão (administrador `admin` com a senha provisória `Greencode1`). Para usar outros valores, crie o `.env` como na [seção 2.3](#23-baixar-e-configurar-o-projeto); o `DATABASE_URL` dele é ignorado, porque o Compose aponta a API para o banco do Docker.

> Em produção, defina um `JWT_SECRET` próprio no `.env`. O padrão do Compose serve só para testes.

O `docker compose up` cria dois contêineres:

- **banco**: PostgreSQL 18, sem porta aberta para fora (só a API fala com ele). Os dados ficam no volume `dados-banco` e sobrevivem quando os contêineres são desligados.
- **api**: montada pelo `Dockerfile`. Só liga quando o banco responde (healthcheck). Ao ligar, aplica as migrações, roda o seed (que não duplica dados) e sobe o servidor na porta 3333.

Para conferir: <http://localhost:3333/health>.

| Comando | O que faz |
|---|---|
| `docker compose logs -f api` | Mostra o log da API |
| `docker compose down` | Desliga (mantém os dados) |
| `docker compose down -v` | Desliga e **apaga** o banco do Docker |

> Não rode o Docker e o `npm run dev` ao mesmo tempo: os dois usam a porta 3333.

### 2.2 Instalar o PostgreSQL e criar o banco

**Ubuntu:**

```bash
sudo apt update
sudo apt install postgresql
sudo -u postgres psql -c "CREATE ROLE greencode WITH LOGIN PASSWORD 'greencode' CREATEDB;"
sudo -u postgres createdb -O greencode greencode
```

**Windows:**

1. Baixe e instale o PostgreSQL em <https://www.postgresql.org/download/windows/> (guarde a senha do usuário `postgres` que o instalador pedir).
2. Abra o **SQL Shell (psql)**, que vem com o instalador, entre como `postgres` e rode:

```sql
CREATE ROLE greencode WITH LOGIN PASSWORD 'greencode' CREATEDB;
CREATE DATABASE greencode OWNER greencode;
```

> O `CREATEDB` só é necessário para quem for desenvolver (`npx prisma migrate dev`), porque esse comando cria um banco temporário para conferir as migrações. Para só instalar e rodar, ele pode ser omitido.

### 2.3 Baixar e configurar o projeto

```bash
git clone https://github.com/pamelaiwabuchi/AV2.git
cd AV2
npm install
```

Crie o `.env` a partir do `.env.example` (funciona em qualquer sistema e não sobrescreve um `.env` que já exista):

```bash
npm run configurar
```

Abra o `.env` e preencha:

| Variável | O que é | Exemplo |
|---|---|---|
| `DATABASE_URL` | Endereço do banco | `postgresql://greencode:greencode@localhost:5432/greencode` |
| `PORT` | Porta do servidor | `3333` |
| `JWT_SECRET` | Texto secreto usado para assinar os tokens. Use um texto longo e aleatório | (veja abaixo) |
| `ADMIN_LOGIN` | Login do primeiro administrador, criado pelo seed | `admin` |
| `ADMIN_SENHA` | Senha provisória do primeiro administrador | `troque-esta-senha` |
| `EMPRESA_RAZAO_SOCIAL` | Nome da empresa que emite os certificados de destinação | `GreenCode Logística Reversa Ltda` |
| `EMPRESA_CNPJ` | CNPJ da empresa emissora (precisa ser válido) | `47.638.125/0001-05` |

Para gerar um `JWT_SECRET` aleatório:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2.4 Criar as tabelas e os dados iniciais

```bash
npx prisma migrate deploy
npx prisma generate
npx prisma db seed
```

- `migrate deploy` cria as tabelas, o trigger de auditoria e as proteções do banco.
- `generate` gera o Prisma Client (o código TypeScript de acesso ao banco), em `src/generated/prisma`.
- `db seed` cria o administrador, os parâmetros globais e uma **massa de dados de exemplo** (ver [seção 4](#4-usuários-e-permissões)).

### 2.5 Rodar

```bash
npm run dev
```

O servidor sobe na porta do `.env`. Para conferir: <http://localhost:3333/health>.

**Em produção:**

```bash
npm run build
npm start
```

Para desligar, use **Ctrl+C**: o servidor para de aceitar requisições, espera as que estão em andamento terminarem e fecha a conexão com o banco (graceful shutdown).

---

## 3. Como usar

A documentação interativa (Swagger) fica em **<http://localhost:3333/docs>**. Lá dá para ver e testar todas as rotas.

1. Faça login em `POST /auth/login`:

```json
{ "login": "admin", "senha": "troque-esta-senha" }
```

(use os valores de `ADMIN_LOGIN` e `ADMIN_SENHA` do seu `.env`)

2. A resposta traz um **token** e o aviso `"precisaTrocarSenha": true`. Toda senha criada pelo administrador (inclusive a do seed) é provisória: até ser trocada, as outras rotas respondem **403** com a mensagem "Troque sua senha antes de continuar".
3. Clique em **Authorize** no Swagger, cole o token e clique em **Authorize** e **Close**.
4. Troque a senha em `PATCH /auth/senha`:

```json
{ "senhaAtual": "troque-esta-senha", "novaSenha": "Admin2026" }
```

A nova senha precisa ter 8 caracteres, 1 maiúscula e 1 número. A resposta traz um **token novo**.
5. Clique em **Authorize** de novo, depois em **Logout**, cole o token novo e clique em **Authorize**. Agora todas as rotas do seu papel estão liberadas.

Fora do Swagger, o token vai no cabeçalho de cada requisição:

```
Authorization: Bearer <token>
```

O token vale **30 minutos**.

Todo erro responde no mesmo formato: `{ "erro": "mensagem" }`, com o código HTTP correspondente:

| Código | Significado |
|---|---|
| 400 | Dados no formato errado (campo faltando, tipo errado, id que não é UUID). A mensagem diz qual campo, em português, ex.: `O campo "login" é obrigatório` |
| 401 | Sem login, token inválido/expirado, senha errada ou conta bloqueada |
| 403 | Logado, mas sem permissão (ou com troca de senha pendente) |
| 404 | Registro não encontrado |
| 409 | Conflito: valor único repetido (CNPJ, login) ou registro alterado por outra pessoa (versão desatualizada) |
| 422 | Regra de negócio violada (ex.: cancelar um lote que já entrou em triagem) |

**Editar e a `versao`.** Todo registro editável tem o campo `versao`. Para editar, consulte o registro antes (a resposta traz a `versao`) e mande esse número junto no PATCH. A resposta do PATCH já traz a versão nova. Se outra pessoa tiver alterado o registro nesse meio-tempo, a resposta é **409**: consulte de novo e repita.

**Listagens.** As listagens respondem neste formato:

```json
{ "itens": [ ... ], "pagina": 1, "totalPaginas": 3, "total": 47 }
```

### Roteiro rápido de teste (uns 5 minutos)

Usa os dados do seed. Faça primeiro os passos 1 a 5 acima, com o `admin`.

1. **Painel:** `GET /painel` mostra os números gerais.
2. **Lotes:** `GET /lotes` lista os 4 lotes do seed. O lote `NF-1002` está RECEBIDO e parado (aparece também em `GET /lotes/parados`).
3. **Consultar um equipamento:** `GET /equipamentos/codigo/GC-2026-000007`. Anote a `versao` da resposta.
4. **Movimentar pelo código de barras:** `POST /equipamentos/codigo/GC-2026-000007/movimentar` com `{ "novoStatus": "EM_TRIAGEM", "versao": <a do passo 3> }`. Resposta **200**; o lote `NF-1002` passa sozinho para EM_TRIAGEM.
5. **Conflito de versão:** repita o passo 4 com a **mesma** versão. Resposta **409**, porque o equipamento já mudou.
6. **Regra de transição:** `POST /equipamentos/codigo/GC-2026-000007/movimentar` com `{ "novoStatus": "BAIXA_DEFINITIVA", "versao": <a nova> }`. Resposta **422**: não dá para pular a triagem.
7. **Histórico:** copie o `id` do GC-2026-000007 e abra `GET /equipamentos/{id}/historico`. Aparecem a entrada no lote e a movimentação do passo 4, com o responsável.
8. **Auditoria:** `GET /auditoria?tabela=Equipamento` mostra quem alterou o quê e quando.
9. **Validação:** `POST /organizacoes` com `{ "razaoSocial": "Teste" }`. Resposta **400** dizendo qual campo falta.
10. **Permissão:** faça login como `carla.auditora` (senha `Greencode1`), troque a senha e use o token novo no Authorize. `POST /organizacoes` responde **403**: o auditor só consulta.

---

## 4. Usuários e permissões

### Dados de exemplo do seed

| Login | Papel | Departamento | Senha provisória |
|---|---|---|---|
| `admin` | ADMINISTRADOR | TI | a do `.env` (`ADMIN_SENHA`) |
| `ana.operadora` | OPERADOR_CADASTRO | Comercial | `Greencode1` |
| `bruno.gestor` | GESTOR_ALMOXARIFADO | Almoxarifado | `Greencode1` |
| `carla.auditora` | AUDITOR | Financeiro | `Greencode1` |

O seed cria 8 departamentos (Administrativo, RH, Financeiro, Comercial, Almoxarifado, Triagem, Reciclagem e TI). Também cria 3 organizações (uma delas, o Hospital Bem Estar, sem contrato: não pode receber lote), 3 contratos, 2 destinos parceiros e 4 lotes, um em cada situação: **finalizado**, **em triagem**, **recebido e parado há 35 dias** e **cancelado**. Os equipamentos vão de `GC-2026-000001` a `GC-2026-000009` (o ano é o do dia em que o seed rodou).

### Permissões (princípio do menor privilégio)

O **ADMINISTRADOR** pode tudo. Os demais:

| Módulo | OPERADOR_CADASTRO | GESTOR_ALMOXARIFADO | AUDITOR |
|---|---|---|---|
| Usuários e departamentos | — | — | — |
| Organizações | tudo | só o resumo (ativas com contrato vigente) | consulta |
| Contratos | tudo | — | consulta |
| Destinos | tudo | consulta (só os ativos) | consulta |
| Lotes e equipamentos | consulta | tudo | consulta |
| Histórico (movimentações) | — | consulta | consulta |
| Relatório de destinação | sim | sim | sim |
| Relatório financeiro | — | — | sim |
| Auditoria e parâmetros | — | — | consulta |

Todo usuário vê o próprio perfil, o próprio painel e troca a própria senha.

---

## 5. Rotas da API

A lista completa, com os campos de cada rota, está no Swagger (`/docs`). Resumo:

Nas listagens, os filtros de texto (nome, razão social, marca, nota fiscal etc.) aceitam só um pedaço e não diferenciam maiúsculas: `organizacaoNome=tech` acha "TechCorp". O CNPJ também aceita um pedaço, com ou sem pontuação. Em vez do id, organização e destino podem ser filtrados pelo nome ou pelo CNPJ, e usuário pelo login.

As rotas de edição usam **PATCH**: mande só os campos que quer mudar, junto com a `versao` atual do registro (ex.: `{ "nome": "Ana Silva", "versao": 1 }`). O que não for enviado continua como está. Sem nenhum campo além da versão, a resposta é 400.

**Autenticação**

| Rota | O que faz |
|---|---|
| `POST /auth/login` | Login; devolve o token |
| `PATCH /auth/senha` | Troca a própria senha (exige a atual) |
| `GET /auth/perfil` | Dados do usuário logado |

**Usuários** (só administrador)

| Rota | O que faz |
|---|---|
| `GET /usuarios?pagina=1&busca=&papel=&departamentoId=&departamento=&ativo=&bloqueado=` | Lista, com busca por nome ou login e filtros (ex.: `busca=ana&departamento=rh` mostra as Anas do RH; `bloqueado=true` mostra quem errou a senha 5 vezes) |
| `GET /usuarios/:id` | Mostra um |
| `GET /usuarios/login/:login` | Mostra um pelo login (ex.: `ana.operadora`), sem precisar do id |
| `POST /usuarios` | Cria, com senha provisória e departamento (`departamentoId`) |
| `PATCH /usuarios/:id` | Edita nome, papel, departamento e/ou ativo (desativar = `ativo: false`) |
| `PATCH /usuarios/:id/senha` | Redefine a senha ("esqueci a senha") e desbloqueia a conta |

**Departamentos** (só administrador)

| Rota | O que faz |
|---|---|
| `GET /departamentos?pagina=1&busca=&ativo=` | Lista, com a quantidade de usuários de cada um |
| `GET /departamentos/:id` | Mostra um |
| `GET /departamentos/:id/usuarios?pagina=1&busca=` | Funcionários ativos do departamento (nome, login, papel) |
| `POST /departamentos` | Cria; o nome não pode repetir (`RH` e `rh` contam como iguais) |
| `PATCH /departamentos/:id` | Edita o nome e/ou ativo (desativar = `ativo: false`) |

**Organizações, contratos e destinos**

| Rota | O que faz |
|---|---|
| `GET /organizacoes?pagina=1&busca=` | Lista, com busca por razão social ou CNPJ |
| `GET /organizacoes/resumo` | Ativas com contrato vigente (lista do gestor) |
| `GET /organizacoes/:id` | Mostra uma, com `temContratoVigente` |
| `POST /organizacoes` · `PATCH /organizacoes/:id` | Cria · edita (desativar = `ativo: false`) |
| `GET /contratos?pagina=1&situacao=&vencendoEmDias=&ano=&organizacaoId=&organizacaoNome=&organizacaoCnpj=` | Lista todos os contratos, do vencimento mais próximo ao mais distante (ex.: `vencendoEmDias=30` mostra os vigentes que vencem nos próximos 30 dias; `ano=2026` mostra os que valeram em algum dia de 2026) |
| `GET /organizacoes/:id/contratos` | Histórico de contratos de uma organização, com a situação de cada um |
| `GET /contratos/:id` | Mostra um contrato |
| `POST /contratos` | Cria |
| `PATCH /contratos/:id` · `DELETE /contratos/:id` | Edita · apaga (só contrato futuro) |
| `PATCH /contratos/:id/renovar` · `PATCH /contratos/:id/encerrar` | Renova · encerra (só contrato vigente) |
| `GET /destinos?pagina=1&busca=` · `GET /destinos/:id` | Lista · mostra |
| `POST /destinos` · `PATCH /destinos/:id` | Cria · edita (desativar = `ativo: false`) |

**Lotes e equipamentos**

| Rota | O que faz |
|---|---|
| `GET /lotes?pagina=1&status=&anoEntrada=&notaFiscal=&transportadora=&organizacaoId=&organizacaoNome=&organizacaoCnpj=` | Lista, com filtros |
| `GET /lotes/parados` | Lotes parados no mesmo status há mais dias que o configurado |
| `GET /lotes/:id` | Mostra um, com os equipamentos e o peso total |
| `POST /lotes` | Registra a chegada de um lote, já com os equipamentos |
| `PATCH /lotes/:id` | Edita nota fiscal, transportadora e/ou observações (`observacoes: null` apaga) |
| `PATCH /lotes/:id/cancelar` | Cancela o lote e todos os equipamentos dele |
| `POST /lotes/:id/equipamentos` | Adiciona um equipamento |
| `GET /equipamentos?pagina=1&status=&tipo=&codigo=&marca=&modelo=&anoFabricacao=&anoEntrada=&estadoFisico=&loteId=&organizacaoId=&organizacaoNome=&organizacaoCnpj=&destinoId=&destinoNome=&destinoCnpj=` | Lista, com filtros (ex.: `organizacaoNome=tech&tipo=NOTEBOOK`) |
| `GET /equipamentos/codigo/:codigo` | Busca pelo código de barras, com a depreciação |
| `GET /equipamentos/:id` | Mostra um, com a depreciação |
| `GET /equipamentos/:id/historico` | Linha do tempo das movimentações |
| `PATCH /equipamentos/:id` | Edita tipo, marca, modelo, ano e/ou peso |
| `PATCH /equipamentos/:id/avaliacao` | Avalia o estado físico |
| `POST /equipamentos/:id/movimentar` | Muda o status pelo id (gera a movimentação) |
| `POST /equipamentos/:id/corrigir` | Desfaz uma movimentação errada e as seguintes (`movimentacaoId`, `justificativa`, `versao`) |
| `POST /equipamentos/codigo/:codigo/movimentar` | Muda o status pelo código de barras, ex.: `GC-2026-000007` |
| `POST /equipamentos/movimentar-varios` | Muda o status de vários de uma vez, pelos códigos de barras (`"codigos": ["GC-2026-000007", "GC-2026-000008"]`), tudo ou nada |
| `GET /movimentacoes?pagina=1&inicio=&fim=&ano=&destino=&codigo=&responsavelId=&responsavelLogin=` | Todas as movimentações, com filtros (ex.: tudo o que foi para `DESCARTE_SEGURO` no mês, ou tudo o que `bruno.gestor` fez) |

**Painel, relatórios, auditoria e parâmetros**

| Rota | O que faz |
|---|---|
| `GET /painel` | Números resumidos; cada papel vê a sua parte (o cadastro inclui os contratos que vencem nos próximos 30 dias) |
| `GET /relatorios/destinacao?organizacaoId=&inicio=&fim=` | Kg por destinação e parceiro, no período; sem `organizacaoId`, soma todas as organizações |
| `GET /relatorios/financeiro?inicio=&fim=` | Receita bruta, impostos e líquida por organização, no período |
| `GET /lotes/:id/certificado` | Baixa o certificado de destinação final (PDF) de um lote FINALIZADO |
| `GET /organizacoes/:id/certificado?inicio=&fim=` | Baixa o certificado (PDF) com os lotes da organização finalizados no período |
| `GET /auditoria?pagina=1&inicio=&fim=&ano=&tabela=&registroId=&usuarioId=&usuarioLogin=` | Registro de todas as alterações, com filtro de período ou ano; o usuário pode ser informado pelo id ou pelo login |
| `GET /parametros` · `PATCH /parametros` | Consulta · altera alíquota, depreciação e dias de lote parado |

As datas usam o formato `AAAA-MM-DD`. As listagens são paginadas (20 por página; 50 na auditoria) e informam `pagina`, `totalPaginas` e `total`.

---

## 6. Arquitetura

O código segue o padrão **Controller → Service → Repository**, sugerido no enunciado:

```
src/
├── server.ts          # sobe o servidor (porta do .env) e faz o graceful shutdown
├── app.ts             # monta o Fastify: tratador central de erros, JWT, Swagger e rotas
├── controllers/       # HTTP: recebe a requisição, valida o formato (JSON Schema), confere a permissão
├── services/          # regras de negócio: validações, transições de status, cálculos financeiros
├── repositories/      # acesso ao banco, pelo Prisma Client
├── plugins/           # JWT e permissões (autenticacao.ts), Swagger (documentacao.ts)
├── lib/               # conexão com o banco (prisma.ts) e transação auditada (transacao.ts)
├── errors/            # classes de erro (ErroNaoEncontrado → 404, ErroConflito → 409...)
└── utils/             # CNPJ, datas, regras de status, pedaços de schema reaproveitados
prisma/
├── schema.prisma      # modelos do banco
├── migrations/        # migrações versionadas (inclui o SQL do trigger de auditoria)
└── seed.ts            # dados iniciais e de exemplo
tests/                 # testes automatizados
Dockerfile             # imagem da API
docker-compose.yml     # sobe o banco e a API juntos
```

O caminho de uma requisição, por exemplo `POST /lotes`:

1. O **controller** confere o token e o papel (`onRequest`), e o Fastify confere o formato do corpo pelo JSON Schema.
2. O **service** aplica as regras: organização ativa e com contrato vigente, data de entrada válida, códigos de barras únicos.
3. Dentro de uma **transação**, os **repositories** gravam o lote, os equipamentos e a movimentação de entrada de cada um.
4. O **trigger** do PostgreSQL grava tudo na Auditoria, com o usuário que fez a operação.
5. Se qualquer passo falhar, o tratador central de erros (`app.ts`) responde com o código HTTP certo.

### Modelos

`Usuario`, `Departamento`, `Organizacao`, `Contrato`, `Destino`, `Lote`, `Equipamento`, `Movimentacao`, `Parametros` e `Auditoria`.

- Organizacao 1 → N Contrato
- Organizacao 1 → N Lote
- Lote 1 → N Equipamento
- Equipamento 1 → N Movimentacao
- Destino 1 → N Equipamento
- Usuario 1 → N Movimentacao (responsável)
- Departamento 1 → N Usuario

Todos os ids são **UUID**.

---

## 7. Regras de negócio

### Contratos
- Uma organização pode ter **vários contratos** (histórico), mas os períodos **não podem se sobrepor**.
- O contrato **vigente** é calculado na consulta: hoje está entre a assinatura e o vencimento. Cada contrato aparece como `FUTURO`, `VIGENTE` ou `ENCERRADO`.
- Contrato **futuro**: pode ser editado e apagado.
- Contrato **vigente**: só pode ser **renovado** (vencimento mais longe) ou **encerrado** (vencimento = hoje). O encerrado continua vigente até o fim do dia, o que permite desfazer um engano no mesmo dia.
- Contrato **encerrado**: não muda mais.

### Lotes
- Só pode ser criado para organização **ativa e com contrato vigente**.
- Nasce com **pelo menos um equipamento**, numa única transação.
- A data de entrada não pode ser futura nem ter mais de **90 dias**.
- Pode ser editado e cancelado só enquanto `RECEBIDO`. Cancelar o lote cancela todos os equipamentos dele, na mesma transação.
- Não recebe equipamento novo se estiver `CANCELADO` ou `FINALIZADO`.
- O **status do lote muda sozinho**, na mesma transação de cada movimentação, ignorando os equipamentos cancelados:

| Status | Quando |
|---|---|
| `RECEBIDO` | Ao criar |
| `EM_TRIAGEM` | O primeiro equipamento sai de `AGUARDANDO_TRIAGEM` |
| `TRIAGEM_CONCLUIDA` | Nenhum equipamento em `AGUARDANDO_TRIAGEM` ou `EM_TRIAGEM` |
| `ENCAMINHADO` | Todos já têm destino (peças, reciclável ou descarte) |
| `FINALIZADO` | Todos em `BAIXA_DEFINITIVA` |

- O lote guarda **desde quando** está no status atual (`dataStatus`). Um lote é considerado **parado** quando fica em `RECEBIDO` ou `EM_TRIAGEM` por mais dias que o configurado em Parametros (padrão: 30).

### Equipamentos
- O código de barras é **gerado pelo sistema** no formato `GC-AAAA-000000`: prefixo da empresa, ano do cadastro e um número sequencial vindo de uma `SEQUENCE` do PostgreSQL, que nunca entrega o mesmo número duas vezes, mesmo com cadastros simultâneos. O código não carrega tipo nem cliente, porque esses dados podem ser corrigidos depois e a etiqueta impressa não muda. Se um cadastro falhar, o número usado é descartado (a sequência pode ter "buracos", o que é normal). A posição no lote também é numerada automaticamente.
- Pode ser editado só enquanto `AGUARDANDO_TRIAGEM`.
- O **estado físico** muda pela avaliação, em qualquer status não final. Se cair **2 ou mais níveis**, a justificativa é obrigatória.
- O **status** muda só pela movimentação, seguindo estas transições:

| De | Para |
|---|---|
| `AGUARDANDO_TRIAGEM` | `EM_TRIAGEM`, `CANCELADO` |
| `EM_TRIAGEM` | `AGUARDANDO_DESMONTE`, `PECAS_REAPROVEITADAS`, `MATERIAL_RECICLAVEL`, `DESCARTE_SEGURO` |
| `AGUARDANDO_DESMONTE` | `EM_DESMONTE` |
| `EM_DESMONTE` | `PECAS_REAPROVEITADAS`, `MATERIAL_RECICLAVEL`, `DESCARTE_SEGURO` |
| `PECAS_REAPROVEITADAS`, `MATERIAL_RECICLAVEL`, `DESCARTE_SEGURO` | `BAIXA_DEFINITIVA` |
| `BAIXA_DEFINITIVA`, `CANCELADO` | (finais) |

- Para ir a `PECAS_REAPROVEITADAS`, `MATERIAL_RECICLAVEL` ou `DESCARTE_SEGURO`, é obrigatório informar o **destino** (parceiro ativo).
- O último equipamento ativo de um lote não pode ser cancelado: para cancelar todos, cancela-se o lote.
- **Toda mudança de status gera uma Movimentacao**, na mesma transação. A movimentação nunca é editada nem apagada.
- **Correção de movimentação errada** (`POST /equipamentos/:id/corrigir`, GESTOR): o gestor escolhe no histórico a movimentação errada, e o sistema desfaz **ela e todas as seguintes**. O equipamento volta ao status em que estava antes dela, mesmo que já esteja em `BAIXA_DEFINITIVA`. Regras:
  - justificativa obrigatória; a correção é gravada como uma movimentação nova, com `movimentacaoCorrigidaId` apontando para a escolhida. Nada é apagado, então o histórico mostra o erro e a correção;
  - se o equipamento volta para antes da escolha do parceiro, o parceiro de destino é retirado, e o nome dele fica escrito na observação da correção (a auditoria também guarda o valor anterior);
  - não corrige a entrada no lote (para isso existe o cancelamento), nem uma movimentação que já foi desfeita por outra correção;
  - um cancelamento individual pode ser desfeito; o de um equipamento cujo lote foi cancelado, não;
  - o status do lote é recalculado na mesma transação, e o relatório de destinação ignora as movimentações desfeitas.
- **Depreciação** (método linear, como na AV1): taxa anual do tipo × idade (ano atual − ano de fabricação), com limite de 100%.

### Usuários e segurança
- Senhas guardadas com **bcrypt**. Nova senha: mínimo de 8 caracteres, 1 maiúscula e 1 número.
- **5 senhas erradas seguidas** bloqueiam a conta por **15 minutos**. Depois disso ela volta a funcionar, mas só com a senha certa.
- Toda senha criada ou redefinida pelo administrador é **provisória**: até trocá-la, a pessoa só consegue trocar a senha e ver o próprio perfil.
- "Esqueci a senha": a pessoa fala com o administrador, que redefine a senha e desbloqueia a conta.
- O administrador não pode desativar o próprio usuário.
- Todo usuário pertence a um **departamento** (setor da empresa). Departamento e papel são independentes: o papel diz o que a pessoa pode fazer no sistema; o departamento, onde ela trabalha. Só o administrador cadastra departamentos e vê os funcionários de cada um.

### Nada é apagado de verdade
- Usuário, departamento, organização e destino são **desativados** (`ativo = false`). Departamento desativado não recebe usuário novo (quem já está nele continua); organização desativada não recebe lote; destino desativado não recebe equipamento.
- Lote e equipamento são **cancelados** (status `CANCELADO`).
- A única exceção é o contrato futuro, que ainda não começou.

### Certificado de destinação final (PDF)
- Inspirado no **CDF** usado no Brasil: o documento com que a empresa declara ao cliente que os resíduos dele tiveram destinação adequada.
- Por **lote** ou por **organização e período** (inclui os lotes que ficaram FINALIZADOS dentro do período). Só lotes **FINALIZADOS**, porque antes disso o destino ainda não aconteceu.
- Emitido por GESTOR, OPERADOR_CADASTRO e AUDITOR (e ADMINISTRADOR). Gerado na hora com a biblioteca **pdfkit**, sem ficar guardado: reflete sempre o estado atual do lote.
- Traz o emitente (dados do `.env`), o cliente, os lotes, a tabela de equipamentos (código, tipo, marca e modelo, peso, destinação e parceiro com CNPJ), os totais por destinação, uma declaração e quem emitiu. A destinação de cada equipamento vem da sua última baixa definitiva.

### Relatório financeiro
Como na AV1: cada contrato entra com **valor mensal ÷ 30 × dias vigentes dentro do período**. Depois vêm a receita bruta, os impostos (pela alíquota dos parâmetros) e a receita líquida, por organização e no total.

---

## 8. Decisões e justificativas

### Itens pedidos no enunciado

| Item | Como foi feito |
|---|---|
| Prisma + PostgreSQL | `prisma/schema.prisma`, com migrações versionadas |
| JWT | `@fastify/jwt`, token de 30 minutos com id, papel e `precisaTrocarSenha` |
| `$transaction` | Criar lote com equipamentos; movimentar equipamento (atualiza o equipamento, grava a movimentação e recalcula o lote); movimentar vários; cancelar lote; adicionar equipamento. Todas as gravações passam por `executarTransacao` (`src/lib/transacao.ts`). Para o status automático do lote não ficar errado quando duas pessoas movimentam equipamentos do mesmo lote ao mesmo tempo, o recálculo trava a linha do lote (`SELECT ... FOR UPDATE`) e a segunda transação espera a primeira terminar |
| Versionamento otimista | Campo `versao` em Usuario, Organizacao, Contrato, Destino, Lote, Equipamento e Parametros. A alteração só acontece se a versão enviada for a atual (`updateMany where { id, versao }`); senão responde **409** |
| Seed | `prisma/seed.ts`, com massa de dados em estados variados. Ele usa os próprios services, então os dados passam pelas mesmas regras do sistema |
| Unicidade | `@unique` em CNPJ (Organizacao e Destino), `codigoBarrasInterno` e `login`. Os services conferem antes de gravar, e o banco garante mesmo assim (erro `P2002` → 409) |
| Triggers ou constraints | Trigger de **auditoria** em 9 tabelas e trigger que **impede alterar ou apagar** Auditoria e Movimentacao |
| Porta por variável de ambiente | `PORT` no `.env` |
| Graceful shutdown | `src/server.ts` trata `SIGINT` e `SIGTERM` |
| API documentada | Swagger em `/docs`, gerado a partir dos JSON Schemas das rotas |

### Mudanças em relação ao enunciado e à AV1

- **Vários contratos por organização.** O enunciado diz que a organização tem "um contrato opcional". Optou-se por guardar o **histórico**: quando um contrato vence e outro é assinado, o antigo continua consultável (e entra no relatório financeiro proporcionalmente). A regra de não sobreposição garante que só exista um vigente por vez.
- **Vigência calculada, sem coluna.** Uma coluna `vigente` ficaria errada sozinha na virada do dia, já que nenhum `UPDATE` acontece. Um job agendado resolveria só em parte (fica errado entre uma execução e outra, e não roda com o servidor desligado). O PostgreSQL também não aceita coluna gerada com `CURRENT_DATE`. Por isso a vigência é calculada a cada consulta.
- **Modelo Destino (novo).** O enunciado e a AV1 só tinham o status do destino (peças, reciclável, descarte). Para emitir o relatório de destinação, que é o comprovante que o cliente pede, o sistema também guarda **para qual parceiro** cada equipamento foi.
- **Usuario no lugar de Credencial; JWT no lugar de Sessao.** A coluna `salt` saiu, porque o bcrypt guarda o salt dentro do próprio hash. Usuario ganhou `nome`, `ativo`, `versao` e os campos de segurança (bloqueio e troca obrigatória de senha).
- **Movimentação de entrada.** Ao entrar no lote, cada equipamento já ganha uma movimentação com origem vazia e destino `AGUARDANDO_TRIAGEM`. Assim o histórico mostra o equipamento desde a chegada.
- **Cancelamento em vez de exclusão**, para não perder rastreabilidade.
- **Auditoria por trigger, e não no código.** Uma função genérica no PostgreSQL (`registrar_auditoria`) é ligada a todas as tabelas. Nenhuma alteração escapa da auditoria, nem as feitas fora da API. O usuário chega ao banco por `set_config('app.usuario_id', ...)` dentro de cada transação. A senha nunca é gravada: aparece só `"(senha alterada)"`.
- **Validação com JSON Schema do Fastify.** Ela confere o **formato** (campo obrigatório, tipo, UUID, data, e-mail) antes de a rota rodar, e alimenta o Swagger. As **regras de negócio** (CNPJ válido, senha forte, transições) ficam nos services e respondem 422, com mensagens em português.
- **Permissão antes da validação.** As permissões rodam no hook `onRequest`, antes da validação do corpo. Assim, quem não tem permissão recebe 403, e não detalhes sobre o formato dos dados.
- **Docker com banco e API.** Quem for rodar o projeto só precisa do Docker, sem instalar e configurar o PostgreSQL. A porta do banco não é aberta para fora (só a API usa, e não briga com um PostgreSQL já instalado na 5432). O seed roda a cada inicialização porque não duplica dados. O servidor é iniciado com `exec` para receber o sinal de desligamento do Docker e fazer o graceful shutdown.

### Alternativas consideradas e rejeitadas

| Alternativa | Por que não |
|---|---|
| Coluna `contratoVigente` + job periódico | Fica desatualizada entre execuções e com o servidor desligado |
| View no banco com a vigência | Pouco ganho: a vigência já aparece em todas as respostas da API |
| Recuperação de senha por e-mail | Exigiria servidor de e-mail; o administrador redefine a senha |
| CHECK constraints para todas as regras | As regras já ficam nos services, com mensagens claras; os triggers protegem o que não pode mudar |
| Parâmetros em tabela chave-valor | Colunas fixas e tipadas evitam valores no formato errado |

### Melhorias que a AV1 apontava e que foram feitas

| Limitação da AV1 | Na AV2 |
|---|---|
| Senhas com SHA-256 | bcrypt |
| Sem limite de tentativas de login | Bloqueio de 15 minutos depois de 5 erros |
| Sem política de senha forte | 8 caracteres, 1 maiúscula e 1 número |
| Sem CRUD completo / sem editar cliente | CRUD completo em todos os módulos |
| Lote sem a data da mudança de status | Campo `dataStatus` no lote |
| Chave de criptografia ao lado dos dados, crescimento do journal | Deixaram de existir: os dados estão no PostgreSQL e o histórico na tabela Auditoria |

---

## 9. Testes

```bash
npm test
```

São 25 testes automatizados (Node test runner):

- `tests/regras.test.ts`: regras puras, sem banco (CNPJ, força da senha, transições de status, cálculo do status do lote).
- `tests/api.test.ts`: requisições à API (sem subir a porta, com `app.inject`) usando os dados do seed. Conferem permissões (401, 403), validação (400), resumo do gestor, depreciação, status do lote finalizado, histórico em ordem, lotes parados, painel por papel, departamentos, filtros por nome, CNPJ e ano, auditoria sem senha e a proteção do trigger. Eles procuram os dados do seed pelo nome ou pela nota fiscal, sem contar registros, então continuam passando depois que você cadastra dados novos pelo Swagger.

> Rode o `npx prisma db seed` antes. Os testes de API só fazem consultas, porque Auditoria e Movimentacao não podem ser apagadas: testes que gravam deixariam registros permanentes no banco. O fluxo de escrita completo (criar lote, triagem, destinação, baixa, cancelamento) é exercitado pelo próprio seed, que usa os services do sistema.

---

## 10. Limitações conhecidas e melhorias futuras

- **Token depois da desativação.** O JWT não consulta o banco. Um usuário desativado continua com acesso até o token vencer (no máximo 30 minutos).
- **Dependência do relógio do servidor.** "Hoje" (vigência, lotes parados, bloqueio, depreciação) vem do relógio do servidor.
- **Sobreposição de contratos em pedidos simultâneos.** A checagem é feita no service. Dois pedidos exatamente ao mesmo tempo para a mesma organização poderiam passar os dois. Melhoria: uma constraint de exclusão do PostgreSQL (`EXCLUDE USING gist`) nos períodos.
- **Testes de escrita.** Melhoria: um banco separado só para testes, recriado a cada execução, para testar também as gravações.
- **Front-end (SPA)**, consumindo esta API.
