import { prisma } from "../lib/prisma.js";
import { STATUS_COM_DESTINO } from "../utils/regrasStatus.js";
import { hojeSemHora, somarDias } from "../utils/datas.js";

export async function contarLotesPorStatus() {
    return prisma.lote.groupBy({
        by: ["statusProcessamento"],
        _count: true,
    });
}

export async function contarEquipamentosPorStatus() {
    return prisma.equipamento.groupBy({
        by: ["statusRastreamento"],
        _count: true,
    });
}

export async function somarPesoRecebidoDesde(inicio: Date) {
    const resultado = await prisma.equipamento.aggregate({
        where: {
            statusRastreamento: { not: "CANCELADO" },
            lote: { dataEntrada: { gte: inicio } },
        },
        _sum: { pesoQuilogramas: true },
    });

    return Number(resultado._sum.pesoQuilogramas ?? 0);
}

export async function contarOrganizacoesAtivas() {
    return prisma.organizacao.count({ where: { ativo: true } });
}

export async function contarContratosVigentes() {
    const hoje = hojeSemHora();

    return prisma.contrato.count({
        where: {
            dataAssinatura: { lte: hoje },
            dataVencimento: { gte: hoje },
        },
    });
}

export async function contarContratosVencendoEm(dias: number) {
    const hoje = hojeSemHora();

    return prisma.contrato.count({
        where: {
            dataAssinatura: { lte: hoje },
            dataVencimento: { gte: hoje, lte: somarDias(hoje, dias) },
        },
    });
}

export async function listarDestinacoes(organizacaoId: string | undefined, inicio: Date, fim: Date) {
    const filtroOrganizacao = organizacaoId ? { lote: { organizacaoId } } : {};

    return prisma.movimentacao.findMany({
        where: {
            destino: { in: STATUS_COM_DESTINO },
            dataHora: { gte: inicio, lt: fim },
            equipamento: filtroOrganizacao,
        },
        include: {
            equipamento: {
                select: {
                    codigoBarrasInterno: true,
                    tipo: true,
                    pesoQuilogramas: true,
                    destino: { select: { razaoSocial: true, cnpj: true } },
                    lote: { select: { organizacao: { select: { razaoSocial: true } } } },
                },
            },
        },
        orderBy: { dataHora: "asc" },
    });
}

export async function listarContratosNoPeriodo(inicio: Date, fim: Date) {
    return prisma.contrato.findMany({
        where: {
            dataAssinatura: { lte: fim },
            dataVencimento: { gte: inicio },
        },
        include: { organizacao: { select: { razaoSocial: true, cnpj: true } } },
        orderBy: { organizacao: { razaoSocial: "asc" } },
    });
}
