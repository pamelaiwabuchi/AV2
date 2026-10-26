import type { EstadoFisico, StatusRastreamento, TipoEquipamento } from "../generated/prisma/enums.js";
import type { Transacao } from "../lib/transacao.js";
import { prisma } from "../lib/prisma.js";
import { montarPagina } from "../utils/paginacao.js";

const TAMANHO_PAGINA = 20;

export interface DadosEquipamento {
    tipo: TipoEquipamento;
    marca: string;
    modelo: string;
    anoFabricacao: number;
    pesoQuilogramas: number;
}

export interface DadosEquipamentoNovo extends DadosEquipamento {
    estadoFisico: EstadoFisico;
}

export interface FiltrosEquipamento {
    statusRastreamento?: StatusRastreamento;
    tipo?: TipoEquipamento;
    loteId?: string;
}

export async function listarEquipamentos(pagina: number, filtros: FiltrosEquipamento) {
    const [itens, total] = await Promise.all([
        prisma.equipamento.findMany({
            where: filtros,
            orderBy: { codigoBarrasInterno: "asc" },
            skip: (pagina - 1) * TAMANHO_PAGINA,
            take: TAMANHO_PAGINA,
        }),
        prisma.equipamento.count({ where: filtros }),
    ]);

    return montarPagina(itens, total, pagina, TAMANHO_PAGINA);
}

export async function buscarEquipamentoPorId(id: string, db: Transacao = prisma) {
    return db.equipamento.findUnique({ where: { id } });
}

export async function buscarEquipamentoPorCodigo(codigoBarrasInterno: string) {
    return prisma.equipamento.findUnique({ where: { codigoBarrasInterno } });
}

export async function proximoNumeroDeCodigo(tx: Transacao) {
    const [linha] = await tx.$queryRaw<{ numero: bigint }[]>`SELECT nextval('codigo_equipamento_seq') AS numero`;
    return Number(linha!.numero);
}

export async function buscarMaiorPosicaoDoLote(tx: Transacao, loteId: string) {
    const resultado = await tx.equipamento.aggregate({
        where: { loteId },
        _max: { posicaoNoLote: true },
    });

    return resultado._max.posicaoNoLote ?? 0;
}

export async function criarEquipamento(tx: Transacao, loteId: string, posicaoNoLote: number, codigoBarrasInterno: string, dados: DadosEquipamentoNovo) {
    return tx.equipamento.create({ data: { ...dados, codigoBarrasInterno, loteId, posicaoNoLote } });
}

export async function listarEquipamentosDoLote(tx: Transacao, loteId: string) {
    return tx.equipamento.findMany({ where: { loteId } });
}

export async function atualizarDadosEquipamento(tx: Transacao, id: string, versao: number, dados: Partial<DadosEquipamento>) {
    const resultado = await tx.equipamento.updateMany({
        where: { id, versao },
        data: { ...dados, versao: { increment: 1 } },
    });

    return resultado.count === 1;
}

export async function atualizarAvaliacao(tx: Transacao, id: string, versao: number, estadoFisico: EstadoFisico, justificativa: string | null) {
    const resultado = await tx.equipamento.updateMany({
        where: { id, versao },
        data: { estadoFisico, justificativaAvaliacao: justificativa, versao: { increment: 1 } },
    });

    return resultado.count === 1;
}

export async function atualizarStatusEquipamento(tx: Transacao, id: string, versao: number, status: StatusRastreamento, destinoId: string | null) {
    const resultado = await tx.equipamento.updateMany({
        where: { id, versao },
        data: { statusRastreamento: status, destinoId, versao: { increment: 1 } },
    });

    return resultado.count === 1;
}
