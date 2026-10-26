import "dotenv/config";
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { criarApp } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";

// Estes testes usam os dados do seed (npx prisma db seed) e só fazem consultas,
// para não deixar registros no banco (Auditoria e Movimentacao não podem ser apagadas).

const app = criarApp();
let tokenAdmin = "";
let tokenGestor = "";
let tokenAuditor = "";

function token(id: string, papel: "ADMINISTRADOR" | "GESTOR_ALMOXARIFADO" | "AUDITOR") {
    return app.jwt.sign({ id, papel, precisaTrocarSenha: false });
}

function pedir(url: string, tokenUsado: string) {
    return app.inject({ url, headers: { authorization: `Bearer ${tokenUsado}` } });
}

before(async () => {
    await app.ready();
    const admin = await prisma.usuario.findUniqueOrThrow({ where: { login: process.env.ADMIN_LOGIN! } });
    tokenAdmin = token(admin.id, "ADMINISTRADOR");
    tokenGestor = token(admin.id, "GESTOR_ALMOXARIFADO");
    tokenAuditor = token(admin.id, "AUDITOR");
});

after(async () => {
    await app.close();
    await prisma.$disconnect();
});

test("GET /health responde ok", async () => {
    const resposta = await app.inject({ url: "/health" });
    assert.equal(resposta.statusCode, 200);
});

test("rota protegida sem token responde 401", async () => {
    const resposta = await app.inject({ url: "/lotes" });
    assert.equal(resposta.statusCode, 401);
});

test("login com usuário inexistente responde 401 com mensagem genérica", async () => {
    const resposta = await app.inject({ method: "POST", url: "/auth/login", payload: { login: "ninguem", senha: "x" } });
    assert.equal(resposta.statusCode, 401);
    assert.equal(resposta.json().erro, "Login ou senha inválidos");
});

test("login sem senha é barrado pela validação (400)", async () => {
    const resposta = await app.inject({ method: "POST", url: "/auth/login", payload: { login: "admin" } });
    assert.equal(resposta.statusCode, 400);
});

test("gestor não lista usuários (403) e auditor não altera parâmetros (403)", async () => {
    assert.equal((await pedir("/usuarios", tokenGestor)).statusCode, 403);

    const resposta = await app.inject({
        method: "PATCH",
        url: "/parametros",
        headers: { authorization: `Bearer ${tokenAuditor}` },
        payload: {},
    });
    assert.equal(resposta.statusCode, 403);
});

test("departamentos do seed e funcionários de um departamento (só ADMINISTRADOR)", async () => {
    const lista = await pedir("/departamentos?busca=almoxarifado", tokenAdmin);
    assert.equal(lista.statusCode, 200);
    const almoxarifado = lista.json().itens.find((departamento: { nome: string }) => departamento.nome === "Almoxarifado");
    assert.ok(almoxarifado);

    const usuarios = await pedir(`/departamentos/${almoxarifado.id}/usuarios`, tokenAdmin);
    const logins = usuarios.json().itens.map((usuario: { login: string }) => usuario.login);
    assert.ok(logins.includes("bruno.gestor"));

    assert.equal((await pedir("/departamentos", tokenGestor)).statusCode, 403);
});

test("usuário pode ser buscado pelo login e filtrado pelo nome do departamento", async () => {
    const porLogin = await pedir("/usuarios/login/carla.auditora", tokenAdmin);
    assert.equal(porLogin.statusCode, 200);
    assert.equal(porLogin.json().departamento.nome, "Financeiro");

    const filtrados = await pedir("/usuarios?departamento=comercial", tokenAdmin);
    const logins = filtrados.json().itens.map((usuario: { login: string }) => usuario.login);
    assert.ok(logins.includes("ana.operadora"));
});

// Estes testes não contam registros: conferem que o filtro traz os dados do seed
// e só eles, para continuarem passando quando alguém cadastra coisas novas.
test("filtros por nome e CNPJ (com ou sem pontuação)", async () => {
    const porNome = (await pedir("/lotes?organizacaoNome=techcorp", tokenAdmin)).json();
    const porCnpj = (await pedir("/lotes?organizacaoCnpj=52.601.815/0001-20", tokenAdmin)).json();
    const notasPorNome = porNome.itens.map((lote: { notaFiscal: string }) => lote.notaFiscal);
    const cnpjsPorCnpj = porCnpj.itens.map((lote: { organizacao: { cnpj: string } }) => lote.organizacao.cnpj);

    assert.ok(notasPorNome.includes("NF-1001"));
    assert.equal(notasPorNome.includes("NF-2001"), false);
    assert.ok(cnpjsPorCnpj.length > 0);
    assert.ok(cnpjsPorCnpj.every((cnpj: string) => cnpj === "52601815000120"));

    const porParceiro = (await pedir("/equipamentos?destinoNome=ecopeças", tokenAdmin)).json();
    const parceiros = porParceiro.itens.map((equipamento: { destino: { razaoSocial: string } }) => equipamento.destino.razaoSocial);
    assert.ok(parceiros.length > 0);
    assert.ok(parceiros.every((nome: string) => nome === "EcoPeças Distribuidora"));
});

test("filtro de ano nos contratos traz só os que valeram naquele ano", async () => {
    const ano = new Date().getFullYear();
    const resposta = (await pedir(`/contratos?ano=${ano}`, tokenAdmin)).json();
    const primeiroDia = `${ano}-01-01`;
    const ultimoDia = `${ano}-12-31`;

    assert.ok(resposta.itens.length > 0);

    for (const contrato of resposta.itens) {
        assert.ok(contrato.dataAssinatura.slice(0, 10) <= ultimoDia);
        assert.ok(contrato.dataVencimento.slice(0, 10) >= primeiroDia);
    }
});

test("listagem de usuários nunca devolve o hash da senha", async () => {
    const resposta = await pedir("/usuarios", tokenAdmin);
    assert.equal(resposta.statusCode, 200);
    assert.equal(resposta.body.includes("hashSenha"), false);
});

test("id que não é UUID responde 400", async () => {
    assert.equal((await pedir("/lotes/abc", tokenGestor)).statusCode, 400);
});

test("gestor vê o resumo de organizações só com as ativas e com contrato vigente", async () => {
    const resposta = await pedir("/organizacoes/resumo", tokenGestor);
    const nomes = resposta.json().map((organizacao: { razaoSocial: string }) => organizacao.razaoSocial);

    assert.ok(nomes.includes("TechCorp Soluções Ltda"));
    assert.equal(nomes.includes("Hospital Bem Estar"), false);
});

// Procura o lote do seed pela nota fiscal, e não pela posição na lista,
// porque lotes novos podem aparecer antes dele.
async function loteDoSeed(notaFiscal: string, papelToken: string) {
    const lotes = (await pedir(`/lotes?notaFiscal=${notaFiscal}`, papelToken)).json().itens;
    return lotes.find((lote: { notaFiscal: string }) => lote.notaFiscal === notaFiscal);
}

async function equipamentosDoLoteFinalizado() {
    const lote = await loteDoSeed("NF-1001", tokenAuditor);
    return (await pedir(`/lotes/${lote.id}`, tokenAuditor)).json().equipamentos;
}

test("código de barras gerado segue o padrão GC-AAAA-000000", async () => {
    const [notebook] = await equipamentosDoLoteFinalizado();
    assert.match(notebook.codigoBarrasInterno, /^GC-\d{4}-\d{6}$/);
});

test("busca por código de barras traz a depreciação", async () => {
    const monitor = (await equipamentosDoLoteFinalizado())[1];
    const resposta = await pedir(`/equipamentos/codigo/${monitor.codigoBarrasInterno}`, tokenGestor);
    assert.equal(resposta.statusCode, 200);
    assert.equal(resposta.json().depreciacao.percentual, 100);
});

test("lote finalizado do seed tem o status calculado certo", async () => {
    const lote = await loteDoSeed("NF-1001", tokenAuditor);
    assert.equal(lote.statusProcessamento, "FINALIZADO");
});

test("histórico do equipamento mostra todas as movimentações em ordem", async () => {
    const [equipamento] = await equipamentosDoLoteFinalizado();
    const historico = (await pedir(`/equipamentos/${equipamento.id}/historico`, tokenAuditor)).json();
    const destinos = historico.map((movimentacao: { destino: string }) => movimentacao.destino);

    assert.deepEqual(destinos, ["AGUARDANDO_TRIAGEM", "EM_TRIAGEM", "PECAS_REAPROVEITADAS", "BAIXA_DEFINITIVA"]);
});

test("lote parado do seed aparece em /lotes/parados", async () => {
    const resposta = await pedir("/lotes/parados", tokenGestor);
    const notas = resposta.json().map((lote: { notaFiscal: string }) => lote.notaFiscal);
    assert.ok(notas.includes("NF-1002"));
});

test("painel do gestor não mostra a parte de cadastro", async () => {
    const painel = (await pedir("/painel", tokenGestor)).json();
    assert.ok(painel.almoxarifado);
    assert.equal(painel.cadastro, undefined);
});

test("auditoria registra quem fez e nunca guarda o hash da senha", async () => {
    const resposta = await pedir("/auditoria?tabela=Usuario", tokenAuditor);
    assert.equal(resposta.statusCode, 200);
    assert.ok(resposta.json().itens.length > 0);
    assert.equal(resposta.body.includes("$2b$"), false);
});

test("banco recusa apagar a auditoria (trigger)", async () => {
    await assert.rejects(prisma.auditoria.deleteMany({}), /não pode ser alterada nem apagada/);
});
