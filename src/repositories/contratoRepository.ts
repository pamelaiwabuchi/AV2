import { prisma } from "../lib/prisma.js";
import type { Transacao } from "../lib/transacao.js";

export interface DadosContrato {
    dataAssinatura: Date;
    dataVencimento: Date;
    clausulas: string[];
    valorMensal: number;
    renovacaoAutomatica: boolean;
}

export async function listarContratosDaOrganizacao(organizacaoId: string) {
    return prisma.contrato.findMany({
        where: { organizacaoId },
        orderBy: { dataAssinatura: "desc" },
    });
}

export async function buscarContratoPorId(id: string) {
    return prisma.contrato.findUnique({ where: { id } });
}

export async function existeSobreposicao(organizacaoId: string, inicio: Date, fim: Date, ignorarId: string | null) {
    const sobrepostos = await prisma.contrato.findMany({
        where: {
            organizacaoId,
            dataAssinatura: { lte: fim },
            dataVencimento: { gte: inicio },
        },
        select: { id: true },
    });

    return sobrepostos.some((contrato) => contrato.id !== ignorarId);
}

export async function criarContrato(tx: Transacao, organizacaoId: string, dados: DadosContrato) {
    return tx.contrato.create({ data: { ...dados, organizacaoId } });
}

export async function atualizarContrato(tx: Transacao, id: string, versao: number, dados: Partial<DadosContrato>) {
    const resultado = await tx.contrato.updateMany({
        where: { id, versao },
        data: { ...dados, versao: { increment: 1 } },
    });

    return resultado.count === 1;
}

export async function apagarContrato(tx: Transacao, id: string) {
    await tx.contrato.delete({ where: { id } });
}
