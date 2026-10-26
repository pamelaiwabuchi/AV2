import bcrypt from "bcrypt";
import { prisma } from "../src/lib/prisma.js";
import * as usuarioService from "../src/services/usuarioService.js";
import * as organizacaoService from "../src/services/organizacaoService.js";
import * as contratoService from "../src/services/contratoService.js";
import * as destinoService from "../src/services/destinoService.js";
import * as loteService from "../src/services/loteService.js";
import * as equipamentoService from "../src/services/equipamentoService.js";
import type { DadosEquipamentoNovo } from "../src/repositories/equipamentoRepository.js";
import type { StatusRastreamento } from "../src/generated/prisma/enums.js";

const CUSTO_BCRYPT = 10;

async function criarAdministrador() {
    const login = process.env.ADMIN_LOGIN;
    const senha = process.env.ADMIN_SENHA;

    if (!login || !senha) {
        throw new Error("Defina ADMIN_LOGIN e ADMIN_SENHA no arquivo .env");
    }

    const existente = await prisma.usuario.findUnique({ where: { login } });

    if (existente) {
        console.log(`Administrador "${login}" já existe, nada foi alterado.`);
        return;
    }

    const hashSenha = await bcrypt.hash(senha, CUSTO_BCRYPT);

    await prisma.usuario.create({
        data: {
            nome: "Administrador",
            login,
            hashSenha,
            papel: "ADMINISTRADOR",
        },
    });

    console.log(`Administrador "${login}" criado.`);
}

async function criarParametros() {
    const quantidade = await prisma.parametros.count();

    if (quantidade > 0) {
        console.log("Parâmetros já existem, nada foi alterado.");
        return;
    }

    await prisma.parametros.create({
        data: {
            aliquotaImposto: 0,
            depreciacaoComputadorMesa: 20,
            depreciacaoNotebook: 20,
            depreciacaoMonitor: 20,
            depreciacaoImpressora: 10,
            depreciacaoServidor: 20,
            depreciacaoRoteador: 20,
            depreciacaoCaboEstruturado: 10,
            depreciacaoFonteAlimentacao: 10,
        },
    });

    console.log("Parâmetros criados.");
}

function dia(diasAPartirDeHoje: number) {
    const data = new Date();
    data.setDate(data.getDate() + diasAPartirDeHoje);
    return new Date(Date.UTC(data.getFullYear(), data.getMonth(), data.getDate()));
}

function equipamento(tipo: DadosEquipamentoNovo["tipo"], marca: string, peso: number): DadosEquipamentoNovo {
    return {
        tipo,
        marca,
        modelo: "Modelo padrão",
        anoFabricacao: 2019,
        estadoFisico: "USADO_LEVE",
        pesoQuilogramas: peso,
    };
}

async function mover(idAdmin: string, ids: string[], novoStatus: StatusRastreamento, destinoId: string | null) {
    await equipamentoService.movimentarVarios(ids, {
        novoStatus,
        destinoId,
        observacao: null,
        idUsuario: idAdmin,
    });
}

async function criarUsuariosDeExemplo(idAdmin: string) {
    await usuarioService.criar("Ana Operadora", "ana.operadora", "Greencode1", "OPERADOR_CADASTRO", idAdmin);
    await usuarioService.criar("Bruno Gestor", "bruno.gestor", "Greencode1", "GESTOR_ALMOXARIFADO", idAdmin);
    await usuarioService.criar("Carla Auditora", "carla.auditora", "Greencode1", "AUDITOR", idAdmin);
}

async function criarDadosDeExemplo() {
    if ((await prisma.organizacao.count()) > 0) {
        console.log("Dados de exemplo já existem, nada foi alterado.");
        return;
    }

    const admin = await prisma.usuario.findUniqueOrThrow({ where: { login: process.env.ADMIN_LOGIN! } });
    const idAdmin = admin.id;

    await criarUsuariosDeExemplo(idAdmin);

    const contato = { telefone: "(12) 3333-4444", enderecoCompleto: "Av. Principal, 100 - São José dos Campos/SP" };
    const techCorp = await organizacaoService.criar({ ...contato, razaoSocial: "TechCorp Soluções Ltda", cnpj: "52.601.815/0001-20", inscricaoEstadual: "123456789", email: "ti@techcorp.com.br" }, idAdmin);
    const escola = await organizacaoService.criar({ ...contato, razaoSocial: "Escola Futuro Verde", cnpj: "90.830.166/0001-28", inscricaoEstadual: "987654321", email: "contato@futuroverde.edu.br" }, idAdmin);
    await organizacaoService.criar({ ...contato, razaoSocial: "Hospital Bem Estar", cnpj: "13.186.091/0001-43", inscricaoEstadual: "555666777", email: "compras@bemestar.org.br" }, idAdmin);

    const clausulas = ["Coleta mensal de equipamentos", "Emissão de certificado de destinação"];
    await contratoService.criar(techCorp.id, { dataAssinatura: dia(-60), dataVencimento: dia(300), clausulas, valorMensal: 2500, renovacaoAutomatica: true }, idAdmin);
    await contratoService.criar(escola.id, { dataAssinatura: dia(-400), dataVencimento: dia(-21), clausulas, valorMensal: 1000, renovacaoAutomatica: false }, idAdmin);
    await contratoService.criar(escola.id, { dataAssinatura: dia(-20), dataVencimento: dia(345), clausulas, valorMensal: 1200, renovacaoAutomatica: false }, idAdmin);

    const recicla = await destinoService.criar({ ...contato, razaoSocial: "ReciclaMais Ltda", cnpj: "39.099.603/0001-28", email: "coleta@reciclamais.com.br" }, idAdmin);
    const ecoPecas = await destinoService.criar({ ...contato, razaoSocial: "EcoPeças Distribuidora", cnpj: "08.246.281/0001-79", email: "pecas@ecopecas.com.br" }, idAdmin);

    const finalizado = await loteService.criar(
        { organizacaoId: techCorp.id, dataEntrada: dia(-40), notaFiscal: "NF-1001", transportadora: "TransLog", observacoes: null },
        [equipamento("NOTEBOOK", "Dell", 2.3), equipamento("MONITOR", "LG", 4.5), equipamento("IMPRESSORA", "HP", 7.8)],
        idAdmin,
    );
    const [notebook, monitor, impressora] = finalizado.equipamentos.map((item) => item.id);
    await mover(idAdmin, [notebook!, monitor!, impressora!], "EM_TRIAGEM", null);
    await equipamentoService.avaliar(monitor!, 2, "DANIFICADO_GRAVE", "Tela trincada na chegada", idAdmin);
    await mover(idAdmin, [notebook!], "PECAS_REAPROVEITADAS", ecoPecas.id);
    await mover(idAdmin, [monitor!], "MATERIAL_RECICLAVEL", recicla.id);
    await mover(idAdmin, [impressora!], "DESCARTE_SEGURO", recicla.id);
    await mover(idAdmin, [notebook!, monitor!, impressora!], "BAIXA_DEFINITIVA", null);

    const emTriagem = await loteService.criar(
        { organizacaoId: escola.id, dataEntrada: dia(-5), notaFiscal: "NF-2001", transportadora: "Rápido Sul", observacoes: "Caixas sem etiqueta" },
        [equipamento("COMPUTADOR_MESA", "Positivo", 8.2), equipamento("SERVIDOR", "IBM", 25), equipamento("ROTEADOR", "TP-Link", 0.4)],
        idAdmin,
    );
    const [computador, servidor] = emTriagem.equipamentos.map((item) => item.id);
    await mover(idAdmin, [computador!, servidor!], "EM_TRIAGEM", null);
    await mover(idAdmin, [computador!], "AGUARDANDO_DESMONTE", null);

    const parado = await loteService.criar(
        { organizacaoId: techCorp.id, dataEntrada: dia(-35), notaFiscal: "NF-1002", transportadora: "TransLog", observacoes: null },
        [equipamento("CABO_ESTRUTURADO", "Furukawa", 12), equipamento("FONTE_ALIMENTACAO", "Corsair", 1.5)],
        idAdmin,
    );
    // Simula um lote parado: recebido há 35 dias sem andar (o sistema sozinho só grava a data de hoje).
    await prisma.lote.update({ where: { id: parado.id }, data: { dataStatus: dia(-35) } });

    const cancelado = await loteService.criar(
        { organizacaoId: escola.id, dataEntrada: dia(-2), notaFiscal: "NF-2002", transportadora: "Rápido Sul", observacoes: "Enviado por engano" },
        [equipamento("NOTEBOOK", "Lenovo", 2.1)],
        idAdmin,
    );
    await loteService.cancelar(cancelado.id, cancelado.versao, idAdmin);

    console.log("Dados de exemplo criados: 3 usuários, 3 organizações, 3 contratos, 2 destinos, 4 lotes e 9 equipamentos.");
}

async function main() {
    await criarAdministrador();
    await criarParametros();
    await criarDadosDeExemplo();
}

try {
    await main();
} finally {
    await prisma.$disconnect();
}
