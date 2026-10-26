import type { Contrato } from "../generated/prisma/client.js";
import { ErroConflito, ErroNaoEncontrado, ErroRegraNegocio } from "../errors/erros.js";
import { hojeSemHora } from "../utils/datas.js";
import * as contratoRepository from "../repositories/contratoRepository.js";
import { executarTransacao } from "../lib/transacao.js";
import * as organizacaoRepository from "../repositories/organizacaoRepository.js";
import type { DadosContrato, FiltrosContrato } from "../repositories/contratoRepository.js";

type Situacao = "FUTURO" | "VIGENTE" | "ENCERRADO";

function calcularSituacao(contrato: Contrato): Situacao {
    const hoje = hojeSemHora();

    if (contrato.dataAssinatura > hoje) {
        return "FUTURO";
    }

    if (contrato.dataVencimento < hoje) {
        return "ENCERRADO";
    }

    return "VIGENTE";
}

function comSituacao<T extends Contrato>(contrato: T) {
    const situacao = calcularSituacao(contrato);
    return { ...contrato, situacao, vigente: situacao === "VIGENTE" };
}

async function buscarOuFalhar(id: string) {
    const contrato = await contratoRepository.buscarContratoPorId(id);

    if (!contrato) {
        throw new ErroNaoEncontrado("Contrato não encontrado");
    }

    return contrato;
}

function exigirSituacao(contrato: Contrato, esperada: Situacao, acao: string) {
    if (calcularSituacao(contrato) !== esperada) {
        throw new ErroRegraNegocio(`Só é possível ${acao} um contrato ${esperada}`);
    }
}

function validarDados(dados: DadosContrato) {
    if (dados.dataVencimento <= dados.dataAssinatura) {
        throw new ErroRegraNegocio("A data de vencimento precisa ser depois da data de assinatura");
    }

    if (dados.valorMensal <= 0) {
        throw new ErroRegraNegocio("O valor mensal precisa ser maior que zero");
    }
}

async function garantirSemSobreposicao(organizacaoId: string, inicio: Date, fim: Date, ignorarId: string | null) {
    const sobrepoe = await contratoRepository.existeSobreposicao(organizacaoId, inicio, fim, ignorarId);

    if (sobrepoe) {
        throw new ErroRegraNegocio("O período se sobrepõe a outro contrato desta organização");
    }
}

function garantirAtualizou(atualizou: boolean) {
    if (!atualizou) {
        throw new ErroConflito("O contrato foi alterado por outra pessoa. Recarregue e tente de novo");
    }
}

export async function listar(pagina: number, filtros: FiltrosContrato) {
    const resultado = await contratoRepository.listarContratos(pagina, filtros);
    return { ...resultado, itens: resultado.itens.map(comSituacao) };
}

export async function listarDaOrganizacao(organizacaoId: string) {
    const contratos = await contratoRepository.listarContratosDaOrganizacao(organizacaoId);
    return contratos.map(comSituacao);
}

export async function buscar(id: string) {
    const contrato = await buscarOuFalhar(id);
    return comSituacao(contrato);
}

export async function criar(organizacaoId: string, dados: DadosContrato, idUsuario: string) {
    const organizacao = await organizacaoRepository.buscarOrganizacaoPorId(organizacaoId);

    if (!organizacao) {
        throw new ErroNaoEncontrado("Organização não encontrada");
    }

    validarDados(dados);
    await garantirSemSobreposicao(organizacaoId, dados.dataAssinatura, dados.dataVencimento, null);

    const contrato = await executarTransacao(idUsuario, async (tx) => {
        return contratoRepository.criarContrato(tx, organizacaoId, dados);
    });

    return comSituacao(contrato);
}

export async function editar(id: string, versao: number, alteracoes: Partial<DadosContrato>, idUsuario: string) {
    const contrato = await buscarOuFalhar(id);
    exigirSituacao(contrato, "FUTURO", "editar");

    // Junta o que já está gravado com o que mudou, para validar o contrato como vai ficar.
    const contratoAlterado: DadosContrato = {
        dataAssinatura: contrato.dataAssinatura,
        dataVencimento: contrato.dataVencimento,
        clausulas: contrato.clausulas,
        valorMensal: Number(contrato.valorMensal),
        renovacaoAutomatica: contrato.renovacaoAutomatica,
        ...alteracoes,
    };
    validarDados(contratoAlterado);
    await garantirSemSobreposicao(contrato.organizacaoId, contratoAlterado.dataAssinatura, contratoAlterado.dataVencimento, id);

    await executarTransacao(idUsuario, async (tx) => {
        garantirAtualizou(await contratoRepository.atualizarContrato(tx, id, versao, alteracoes));
    });

    return buscar(id);
}

export async function renovar(id: string, versao: number, novoVencimento: Date, idUsuario: string) {
    const contrato = await buscarOuFalhar(id);
    exigirSituacao(contrato, "VIGENTE", "renovar");

    if (novoVencimento <= contrato.dataVencimento) {
        throw new ErroRegraNegocio("O novo vencimento precisa ser depois do vencimento atual");
    }

    await garantirSemSobreposicao(contrato.organizacaoId, contrato.dataAssinatura, novoVencimento, id);

    await executarTransacao(idUsuario, async (tx) => {
        garantirAtualizou(await contratoRepository.atualizarContrato(tx, id, versao, { dataVencimento: novoVencimento }));
    });

    return buscar(id);
}

export async function encerrar(id: string, versao: number, idUsuario: string) {
    const contrato = await buscarOuFalhar(id);
    exigirSituacao(contrato, "VIGENTE", "encerrar");

    await executarTransacao(idUsuario, async (tx) => {
        garantirAtualizou(await contratoRepository.atualizarContrato(tx, id, versao, { dataVencimento: hojeSemHora() }));
    });

    return buscar(id);
}

export async function apagar(id: string, idUsuario: string) {
    const contrato = await buscarOuFalhar(id);
    exigirSituacao(contrato, "FUTURO", "apagar");

    await executarTransacao(idUsuario, async (tx) => {
        await contratoRepository.apagarContrato(tx, id);
    });
}
