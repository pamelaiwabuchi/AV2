import type { StatusRastreamento } from "../generated/prisma/enums.js";
import type { Transacao } from "../lib/transacao.js";
import { prisma } from "../lib/prisma.js";
import { montarPagina } from "../utils/paginacao.js";

const TAMANHO_PAGINA = 50;

export interface FiltrosMovimentacao {
    destino?: StatusRastreamento;
    responsavelId?: string;
    responsavel?: { login: string };
    equipamento?: { codigoBarrasInterno: { contains: string; mode: "insensitive" } };
    dataHora?: { gte?: Date; lt?: Date };
}

export interface DadosMovimentacao {
    equipamentoId: string;
    origem: StatusRastreamento | null;
    destino: StatusRastreamento;
    responsavelId: string;
    observacao: string | null;
    movimentacaoCorrigidaId?: string;
}

export async function criarMovimentacao(tx: Transacao, dados: DadosMovimentacao) {
    await tx.movimentacao.create({ data: dados });
}

export async function listarHistoricoDoEquipamento(equipamentoId: string, db: Transacao = prisma) {
    return db.movimentacao.findMany({
        where: { equipamentoId },
        include: { responsavel: { select: { nome: true, login: true } } },
        orderBy: { dataHora: "asc" },
    });
}

export async function listarMovimentacoes(pagina: number, filtros: FiltrosMovimentacao) {
    const [itens, total] = await Promise.all([
        prisma.movimentacao.findMany({
            where: filtros,
            include: {
                equipamento: { select: { codigoBarrasInterno: true, tipo: true, loteId: true } },
                responsavel: { select: { nome: true, login: true } },
            },
            orderBy: { dataHora: "desc" },
            skip: (pagina - 1) * TAMANHO_PAGINA,
            take: TAMANHO_PAGINA,
        }),
        prisma.movimentacao.count({ where: filtros }),
    ]);

    return montarPagina(itens, total, pagina, TAMANHO_PAGINA);
}
