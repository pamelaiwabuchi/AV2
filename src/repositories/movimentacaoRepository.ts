import type { StatusRastreamento } from "../generated/prisma/enums.js";
import type { Transacao } from "../lib/transacao.js";
import { prisma } from "../lib/prisma.js";

export interface DadosMovimentacao {
    equipamentoId: string;
    origem: StatusRastreamento | null;
    destino: StatusRastreamento;
    responsavelId: string;
    observacao: string | null;
}

export async function criarMovimentacao(tx: Transacao, dados: DadosMovimentacao) {
    await tx.movimentacao.create({ data: dados });
}

export async function listarHistoricoDoEquipamento(equipamentoId: string) {
    return prisma.movimentacao.findMany({
        where: { equipamentoId },
        include: { responsavel: { select: { nome: true, login: true } } },
        orderBy: { dataHora: "asc" },
    });
}
