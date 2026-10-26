import type { Equipamento } from "../generated/prisma/client.js";
import type { StatusRastreamento } from "../generated/prisma/enums.js";
import type { Transacao } from "../lib/transacao.js";
import { ErroConflito } from "../errors/erros.js";
import { calcularStatusLote } from "../utils/regrasStatus.js";
import * as equipamentoRepository from "../repositories/equipamentoRepository.js";
import * as loteRepository from "../repositories/loteRepository.js";
import * as movimentacaoRepository from "../repositories/movimentacaoRepository.js";

export interface PedidoMudanca {
    novoStatus: StatusRastreamento;
    destinoId: string | null;
    observacao: string | null;
    idUsuario: string;
}

export async function registrarEntrada(tx: Transacao, equipamentoId: string, idUsuario: string) {
    await movimentacaoRepository.criarMovimentacao(tx, {
        equipamentoId,
        origem: null,
        destino: "AGUARDANDO_TRIAGEM",
        responsavelId: idUsuario,
        observacao: "Entrada no lote",
    });
}

export async function registrarMudancaDeStatus(tx: Transacao, equipamento: Equipamento, versao: number, pedido: PedidoMudanca) {
    const atualizou = await equipamentoRepository.atualizarStatusEquipamento(
        tx,
        equipamento.id,
        versao,
        pedido.novoStatus,
        pedido.destinoId,
    );

    if (!atualizou) {
        throw new ErroConflito(`O equipamento ${equipamento.codigoBarrasInterno} foi alterado por outra pessoa. Recarregue e tente de novo`);
    }

    await movimentacaoRepository.criarMovimentacao(tx, {
        equipamentoId: equipamento.id,
        origem: equipamento.statusRastreamento,
        destino: pedido.novoStatus,
        responsavelId: pedido.idUsuario,
        observacao: pedido.observacao,
    });
}

export async function recalcularStatusLote(tx: Transacao, loteId: string) {
    const lote = await loteRepository.buscarLotePorId(loteId, tx);

    if (!lote || lote.statusProcessamento === "CANCELADO") {
        return;
    }

    const statusDosEquipamentos = lote.equipamentos.map((equipamento) => equipamento.statusRastreamento);
    const novoStatus = calcularStatusLote(statusDosEquipamentos);

    if (novoStatus !== lote.statusProcessamento) {
        await loteRepository.atualizarStatusLote(tx, loteId, novoStatus);
    }
}

export async function listarHistorico(equipamentoId: string) {
    return movimentacaoRepository.listarHistoricoDoEquipamento(equipamentoId);
}
