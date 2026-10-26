import { executarTransacao } from "../lib/transacao.js";
import type { Transacao } from "../lib/transacao.js";
import { ErroConflito, ErroNaoEncontrado, ErroRegraNegocio } from "../errors/erros.js";
import { hojeSemHora } from "../utils/datas.js";
import * as loteRepository from "../repositories/loteRepository.js";
import * as equipamentoRepository from "../repositories/equipamentoRepository.js";
import * as organizacaoRepository from "../repositories/organizacaoRepository.js";
import * as parametrosRepository from "../repositories/parametrosRepository.js";
import * as movimentacaoService from "./movimentacaoService.js";
import { validarAnoFabricacao } from "./equipamentoService.js";
import type { DadosEdicaoLote, DadosLote, FiltrosLote } from "../repositories/loteRepository.js";
import type { DadosEquipamentoNovo } from "../repositories/equipamentoRepository.js";

const DIAS_MAXIMOS_ENTRADA = 90;
const UM_DIA = 24 * 60 * 60 * 1000;

async function buscarOuFalhar(id: string) {
    const lote = await loteRepository.buscarLotePorId(id);

    if (!lote) {
        throw new ErroNaoEncontrado("Lote não encontrado");
    }

    return lote;
}

function garantirAtualizou(atualizou: boolean) {
    if (!atualizou) {
        throw new ErroConflito("O lote foi alterado por outra pessoa. Recarregue e tente de novo");
    }
}

async function validarOrganizacao(organizacaoId: string) {
    const organizacao = await organizacaoRepository.buscarOrganizacaoPorId(organizacaoId);

    if (!organizacao || !organizacao.ativo) {
        throw new ErroRegraNegocio("Organização não encontrada ou desativada");
    }

    const temContrato = await organizacaoRepository.temContratoVigente(organizacaoId);

    if (!temContrato) {
        throw new ErroRegraNegocio("A organização não tem contrato vigente");
    }
}

function validarDataEntrada(dataEntrada: Date) {
    const hoje = hojeSemHora();
    const limite = new Date(hoje.getTime() - DIAS_MAXIMOS_ENTRADA * UM_DIA);

    if (dataEntrada > hoje) {
        throw new ErroRegraNegocio("A data de entrada não pode ser no futuro");
    }

    if (dataEntrada < limite) {
        throw new ErroRegraNegocio(`A data de entrada não pode ser de mais de ${DIAS_MAXIMOS_ENTRADA} dias atrás`);
    }
}

function validarEquipamentosNovos(equipamentos: DadosEquipamentoNovo[]) {
    for (const equipamento of equipamentos) {
        validarAnoFabricacao(equipamento.anoFabricacao);
    }
}

// Formato GC-AAAA-000001: prefixo da empresa, ano do cadastro e número sequencial.
function montarCodigoDeBarras(numero: number) {
    const ano = new Date().getFullYear();
    return `GC-${ano}-${String(numero).padStart(6, "0")}`;
}

async function adicionarNoLote(tx: Transacao, loteId: string, posicao: number, dados: DadosEquipamentoNovo, idUsuario: string) {
    const codigo = montarCodigoDeBarras(await equipamentoRepository.proximoNumeroDeCodigo(tx));
    const equipamento = await equipamentoRepository.criarEquipamento(tx, loteId, posicao, codigo, dados);
    await movimentacaoService.registrarEntrada(tx, equipamento.id, idUsuario);
}

export async function listar(pagina: number, filtros: FiltrosLote) {
    return loteRepository.listarLotes(pagina, filtros);
}

export async function listarParados() {
    const parametros = await parametrosRepository.buscarParametros();
    const dataLimite = new Date(hojeSemHora().getTime() - parametros.diasLoteParado * UM_DIA);

    return loteRepository.listarLotesParados(dataLimite);
}

export async function buscar(id: string) {
    const lote = await buscarOuFalhar(id);
    let pesoTotalKg = 0;

    for (const equipamento of lote.equipamentos) {
        if (equipamento.statusRastreamento !== "CANCELADO") {
            pesoTotalKg = pesoTotalKg + Number(equipamento.pesoQuilogramas);
        }
    }

    return { ...lote, pesoTotalKg: Math.round(pesoTotalKg * 1000) / 1000 };
}

export async function criar(dados: DadosLote, equipamentos: DadosEquipamentoNovo[], idUsuario: string) {
    await validarOrganizacao(dados.organizacaoId);
    validarDataEntrada(dados.dataEntrada);
    validarEquipamentosNovos(equipamentos);

    const lote = await executarTransacao(idUsuario, async (tx) => {
        const novoLote = await loteRepository.criarLote(tx, dados);

        for (let i = 0; i < equipamentos.length; i++) {
            await adicionarNoLote(tx, novoLote.id, i + 1, equipamentos[i]!, idUsuario);
        }

        return novoLote;
    });

    return buscar(lote.id);
}

export async function editar(id: string, versao: number, dados: Partial<DadosEdicaoLote>, idUsuario: string) {
    const lote = await buscarOuFalhar(id);

    if (lote.statusProcessamento !== "RECEBIDO") {
        throw new ErroRegraNegocio("Só é possível editar um lote RECEBIDO");
    }

    await executarTransacao(idUsuario, async (tx) => {
        garantirAtualizou(await loteRepository.atualizarDadosLote(tx, id, versao, dados));
    });

    return buscar(id);
}

export async function cancelar(id: string, versao: number, idUsuario: string) {
    const lote = await buscarOuFalhar(id);

    if (lote.statusProcessamento !== "RECEBIDO") {
        throw new ErroRegraNegocio("Só é possível cancelar um lote RECEBIDO");
    }

    await executarTransacao(idUsuario, async (tx) => {
        for (const equipamento of lote.equipamentos) {
            if (equipamento.statusRastreamento === "CANCELADO") {
                continue;
            }

            await movimentacaoService.registrarMudancaDeStatus(tx, equipamento, equipamento.versao, {
                novoStatus: "CANCELADO",
                destinoId: equipamento.destinoId,
                observacao: "Lote cancelado",
                idUsuario,
            });
        }

        garantirAtualizou(await loteRepository.cancelarLote(tx, id, versao));
    });

    return buscar(id);
}

export async function adicionarEquipamento(loteId: string, dados: DadosEquipamentoNovo, idUsuario: string) {
    const lote = await buscarOuFalhar(loteId);

    if (lote.statusProcessamento === "CANCELADO" || lote.statusProcessamento === "FINALIZADO") {
        throw new ErroRegraNegocio(`Não é possível adicionar equipamento a um lote ${lote.statusProcessamento}`);
    }

    validarEquipamentosNovos([dados]);

    await executarTransacao(idUsuario, async (tx) => {
        const posicao = (await equipamentoRepository.buscarMaiorPosicaoDoLote(tx, loteId)) + 1;
        await adicionarNoLote(tx, loteId, posicao, dados, idUsuario);
        await movimentacaoService.recalcularStatusLote(tx, loteId);
    });

    return buscar(loteId);
}
