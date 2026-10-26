import type { StatusLote } from "../generated/prisma/enums.js";
import type { Transacao } from "../lib/transacao.js";
import { prisma } from "../lib/prisma.js";
import { montarPagina } from "../utils/paginacao.js";
import type { Prisma } from "../generated/prisma/client.js";

const TAMANHO_PAGINA = 20;

export interface DadosEdicaoLote {
    notaFiscal: string;
    transportadora: string;
    observacoes: string | null;
}

export interface DadosLote extends DadosEdicaoLote {
    organizacaoId: string;
    dataEntrada: Date;
}

export type FiltrosLote = Prisma.LoteWhereInput;

export async function listarLotes(pagina: number, filtros: FiltrosLote) {
    const [itens, total] = await Promise.all([
        prisma.lote.findMany({
            where: filtros,
            include: { organizacao: { select: { razaoSocial: true, cnpj: true } } },
            orderBy: { dataEntrada: "desc" },
            skip: (pagina - 1) * TAMANHO_PAGINA,
            take: TAMANHO_PAGINA,
        }),
        prisma.lote.count({ where: filtros }),
    ]);

    return montarPagina(itens, total, pagina, TAMANHO_PAGINA);
}

export async function listarLotesParados(dataLimite: Date) {
    return prisma.lote.findMany({
        where: {
            statusProcessamento: { in: ["RECEBIDO", "EM_TRIAGEM"] },
            dataStatus: { lt: dataLimite },
        },
        include: { organizacao: { select: { razaoSocial: true } } },
        orderBy: { dataStatus: "asc" },
    });
}

export async function buscarLotePorId(id: string, db: Transacao = prisma) {
    return db.lote.findUnique({
        where: { id },
        include: {
            organizacao: { select: { razaoSocial: true, cnpj: true } },
            equipamentos: { orderBy: { posicaoNoLote: "asc" } },
        },
    });
}

export async function criarLote(tx: Transacao, dados: DadosLote) {
    return tx.lote.create({ data: dados });
}

export async function atualizarDadosLote(tx: Transacao, id: string, versao: number, dados: Partial<DadosEdicaoLote>) {
    const resultado = await tx.lote.updateMany({
        where: { id, versao },
        data: { ...dados, versao: { increment: 1 } },
    });

    return resultado.count === 1;
}

// Trava a linha do lote até o fim da transação: outra transação que tentar travar
// o mesmo lote espera esta terminar (commit ou rollback).
export async function travarLote(tx: Transacao, id: string) {
    await tx.$executeRaw`SELECT id FROM "Lote" WHERE id = ${id}::uuid FOR UPDATE`;
}

export async function atualizarStatusLote(tx: Transacao, id: string, status: StatusLote) {
    await tx.lote.update({
        where: { id },
        data: { statusProcessamento: status, dataStatus: new Date(), versao: { increment: 1 } },
    });
}

export async function cancelarLote(tx: Transacao, id: string, versao: number) {
    const resultado = await tx.lote.updateMany({
        where: { id, versao },
        data: { statusProcessamento: "CANCELADO", dataStatus: new Date(), versao: { increment: 1 } },
    });

    return resultado.count === 1;
}
