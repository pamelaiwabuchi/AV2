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

async function equipamentosDoLoteFinalizado() {
    const lote = (await pedir("/lotes?status=FINALIZADO", tokenAuditor)).json().itens[0];
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
    const resposta = await pedir("/lotes?status=FINALIZADO", tokenAuditor);
    assert.equal(resposta.json().itens[0].notaFiscal, "NF-1001");
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
