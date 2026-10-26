import type { Equipamento, Parametros } from "../generated/prisma/client.js";
import type { TipoEquipamento } from "../generated/prisma/enums.js";
import { EstadoFisico } from "../generated/prisma/enums.js";
import type { Transacao } from "../lib/transacao.js";
import { executarTransacao } from "../lib/transacao.js";
import { ErroConflito, ErroNaoEncontrado, ErroRegraNegocio } from "../errors/erros.js";
import { STATUS_COM_DESTINO, ehStatusFinal, podeMudarStatus } from "../utils/regrasStatus.js";
import * as equipamentoRepository from "../repositories/equipamentoRepository.js";
import * as destinoRepository from "../repositories/destinoRepository.js";
import * as parametrosRepository from "../repositories/parametrosRepository.js";
import * as movimentacaoService from "./movimentacaoService.js";
import type { DadosEquipamento, FiltrosEquipamento } from "../repositories/equipamentoRepository.js";
import type { PedidoMudanca } from "./movimentacaoService.js";

function taxaDeDepreciacao(tipo: TipoEquipamento, parametros: Parametros) {
    const taxas: Record<TipoEquipamento, unknown> = {
        COMPUTADOR_MESA: parametros.depreciacaoComputadorMesa,
        NOTEBOOK: parametros.depreciacaoNotebook,
        MONITOR: parametros.depreciacaoMonitor,
        IMPRESSORA: parametros.depreciacaoImpressora,
        SERVIDOR: parametros.depreciacaoServidor,
        ROTEADOR: parametros.depreciacaoRoteador,
        CABO_ESTRUTURADO: parametros.depreciacaoCaboEstruturado,
        FONTE_ALIMENTACAO: parametros.depreciacaoFonteAlimentacao,
    };

    return Number(taxas[tipo]);
}

async function comDepreciacao(equipamento: Equipamento) {
    const parametros = await parametrosRepository.buscarParametros();
    const taxaAnual = taxaDeDepreciacao(equipamento.tipo, parametros);
    const idade = new Date().getFullYear() - equipamento.anoFabricacao;
    const percentual = Math.min(100, taxaAnual * idade);

    return { ...equipamento, depreciacao: { taxaAnual, idadeEmAnos: idade, percentual } };
}

async function buscarOuFalhar(id: string, db?: Transacao) {
    const equipamento = await equipamentoRepository.buscarEquipamentoPorId(id, db);

    if (!equipamento) {
        throw new ErroNaoEncontrado("Equipamento não encontrado");
    }

    return equipamento;
}

function garantirAtualizou(atualizou: boolean) {
    if (!atualizou) {
        throw new ErroConflito("O equipamento foi alterado por outra pessoa. Recarregue e tente de novo");
    }
}

export function validarAnoFabricacao(ano: number) {
    if (ano > new Date().getFullYear()) {
        throw new ErroRegraNegocio("O ano de fabricação não pode ser no futuro");
    }
}

async function resolverDestino(equipamento: Equipamento, pedido: PedidoMudanca) {
    if (!STATUS_COM_DESTINO.includes(pedido.novoStatus)) {
        return equipamento.destinoId;
    }

    if (!pedido.destinoId) {
        throw new ErroRegraNegocio(`Informe o destinoId para mover para ${pedido.novoStatus}`);
    }

    const destino = await destinoRepository.buscarDestinoPorId(pedido.destinoId);

    if (!destino || !destino.ativo) {
        throw new ErroRegraNegocio("Destino não encontrado ou desativado");
    }

    return destino.id;
}

async function garantirQueNaoEhOUltimo(tx: Transacao, equipamento: Equipamento) {
    const doLote = await equipamentoRepository.listarEquipamentosDoLote(tx, equipamento.loteId);
    const outrosAtivos = doLote.filter((outro) => outro.id !== equipamento.id && outro.statusRastreamento !== "CANCELADO");

    if (outrosAtivos.length === 0) {
        throw new ErroRegraNegocio("Este é o último equipamento ativo do lote. Para cancelar todos, cancele o lote");
    }
}

async function aplicarMovimentacao(tx: Transacao, equipamento: Equipamento, versao: number, pedido: PedidoMudanca) {
    const atual = equipamento.statusRastreamento;

    if (!podeMudarStatus(atual, pedido.novoStatus)) {
        throw new ErroRegraNegocio(`O equipamento ${equipamento.codigoBarrasInterno} não pode ir de ${atual} para ${pedido.novoStatus}`);
    }

    if (pedido.novoStatus === "CANCELADO") {
        await garantirQueNaoEhOUltimo(tx, equipamento);
    }

    const destinoId = await resolverDestino(equipamento, pedido);
    await movimentacaoService.registrarMudancaDeStatus(tx, equipamento, versao, { ...pedido, destinoId });
}

export async function listar(pagina: number, filtros: FiltrosEquipamento) {
    return equipamentoRepository.listarEquipamentos(pagina, filtros);
}

export async function buscar(id: string) {
    const equipamento = await buscarOuFalhar(id);
    return comDepreciacao(equipamento);
}

export async function buscarPorCodigo(codigo: string) {
    const equipamento = await equipamentoRepository.buscarEquipamentoPorCodigo(codigo);

    if (!equipamento) {
        throw new ErroNaoEncontrado(`Nenhum equipamento com o código ${codigo}`);
    }

    return comDepreciacao(equipamento);
}

export async function historico(id: string) {
    await buscarOuFalhar(id);
    return movimentacaoService.listarHistorico(id);
}

export async function editar(id: string, versao: number, dados: Partial<DadosEquipamento>, idUsuario: string) {
    const equipamento = await buscarOuFalhar(id);

    if (equipamento.statusRastreamento !== "AGUARDANDO_TRIAGEM") {
        throw new ErroRegraNegocio("Só é possível editar um equipamento AGUARDANDO_TRIAGEM");
    }

    if (dados.anoFabricacao !== undefined) {
        validarAnoFabricacao(dados.anoFabricacao);
    }

    await executarTransacao(idUsuario, async (tx) => {
        garantirAtualizou(await equipamentoRepository.atualizarDadosEquipamento(tx, id, versao, dados));
    });

    return buscarOuFalhar(id);
}

export async function avaliar(id: string, versao: number, estadoFisico: EstadoFisico, justificativa: string | null, idUsuario: string) {
    const equipamento = await buscarOuFalhar(id);

    if (ehStatusFinal(equipamento.statusRastreamento)) {
        throw new ErroRegraNegocio(`Não é possível avaliar um equipamento em ${equipamento.statusRastreamento}`);
    }

    const ordem: string[] = Object.values(EstadoFisico);
    const niveisQueCaiu = ordem.indexOf(estadoFisico) - ordem.indexOf(equipamento.estadoFisico);

    if (niveisQueCaiu >= 2 && !justificativa) {
        throw new ErroRegraNegocio("O estado físico caiu 2 ou mais níveis: a justificativa é obrigatória");
    }

    await executarTransacao(idUsuario, async (tx) => {
        garantirAtualizou(await equipamentoRepository.atualizarAvaliacao(tx, id, versao, estadoFisico, justificativa));
    });

    return buscarOuFalhar(id);
}

export async function movimentar(id: string, versao: number, pedido: PedidoMudanca) {
    await executarTransacao(pedido.idUsuario, async (tx) => {
        const equipamento = await buscarOuFalhar(id, tx);
        await aplicarMovimentacao(tx, equipamento, versao, pedido);
        await movimentacaoService.recalcularStatusLote(tx, equipamento.loteId);
    });

    return buscarOuFalhar(id);
}

export async function movimentarVarios(ids: string[], pedido: PedidoMudanca) {
    await executarTransacao(pedido.idUsuario, async (tx) => {
        const lotesAfetados = new Set<string>();

        for (const id of ids) {
            const equipamento = await buscarOuFalhar(id, tx);
            await aplicarMovimentacao(tx, equipamento, equipamento.versao, pedido);
            lotesAfetados.add(equipamento.loteId);
        }

        for (const loteId of lotesAfetados) {
            await movimentacaoService.recalcularStatusLote(tx, loteId);
        }
    });

    return { movimentados: ids.length, novoStatus: pedido.novoStatus };
}

async function buscarIdPorCodigo(codigo: string) {
    const equipamento = await equipamentoRepository.buscarEquipamentoPorCodigo(codigo);

    if (!equipamento) {
        throw new ErroNaoEncontrado(`Nenhum equipamento com o código ${codigo}`);
    }

    return equipamento.id;
}

export async function movimentarPorCodigo(codigo: string, versao: number, pedido: PedidoMudanca) {
    const id = await buscarIdPorCodigo(codigo);
    return movimentar(id, versao, pedido);
}

export async function movimentarVariosPorCodigo(codigos: string[], pedido: PedidoMudanca) {
    const ids: string[] = [];

    for (const codigo of codigos) {
        ids.push(await buscarIdPorCodigo(codigo));
    }

    return movimentarVarios(ids, pedido);
}
