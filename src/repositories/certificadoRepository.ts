import { prisma } from "../lib/prisma.js";

// O que o certificado precisa de cada lote: o cliente, os equipamentos não cancelados,
// o parceiro de cada um e a última baixa (a origem dela diz qual foi a destinação).
const dadosDoLote = {
    organizacao: { select: { razaoSocial: true, cnpj: true, enderecoCompleto: true } },
    equipamentos: {
        where: { statusRastreamento: { not: "CANCELADO" as const } },
        orderBy: { posicaoNoLote: "asc" as const },
        include: {
            destino: { select: { razaoSocial: true, cnpj: true } },
            historicoMovimentacao: {
                where: { destino: "BAIXA_DEFINITIVA" as const },
                orderBy: { dataHora: "desc" as const },
                take: 1,
            },
        },
    },
};

export async function buscarLoteParaCertificado(id: string) {
    return prisma.lote.findUnique({
        where: { id },
        include: dadosDoLote,
    });
}

export async function listarLotesFinalizadosNoPeriodo(organizacaoId: string, inicio: Date, fimExclusivo: Date) {
    return prisma.lote.findMany({
        where: {
            organizacaoId,
            statusProcessamento: "FINALIZADO",
            dataStatus: { gte: inicio, lt: fimExclusivo },
        },
        include: dadosDoLote,
        orderBy: { dataStatus: "asc" },
    });
}
