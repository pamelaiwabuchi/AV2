import { ErroConflito, ErroNaoEncontrado } from "../errors/erros.js";
import { validarCnpj } from "../utils/cnpj.js";
import * as organizacaoRepository from "../repositories/organizacaoRepository.js";
import { executarTransacao } from "../lib/transacao.js";
import type { AlteracoesOrganizacao, DadosOrganizacao } from "../repositories/organizacaoRepository.js";

async function buscarOuFalhar(id: string) {
    const organizacao = await organizacaoRepository.buscarOrganizacaoPorId(id);

    if (!organizacao) {
        throw new ErroNaoEncontrado("Organização não encontrada");
    }

    return organizacao;
}

async function garantirCnpjLivre(cnpj: string, idAtual: string | null) {
    const existente = await organizacaoRepository.buscarOrganizacaoPorCnpj(cnpj);

    if (existente && existente.id !== idAtual) {
        throw new ErroConflito("Já existe uma organização com esse CNPJ");
    }
}

export async function listar(pagina: number, busca: string) {
    return organizacaoRepository.listarOrganizacoes(pagina, busca);
}

export async function listarResumo() {
    return organizacaoRepository.listarResumoParaGestor();
}

export async function buscar(id: string) {
    const organizacao = await buscarOuFalhar(id);
    const contratoVigente = await organizacaoRepository.temContratoVigente(id);

    return { ...organizacao, temContratoVigente: contratoVigente };
}

export async function criar(dados: DadosOrganizacao, idUsuario: string) {
    const cnpj = validarCnpj(dados.cnpj);
    await garantirCnpjLivre(cnpj, null);

    return executarTransacao(idUsuario, async (tx) => {
        return organizacaoRepository.criarOrganizacao(tx, { ...dados, cnpj });
    });
}

export async function atualizar(id: string, versao: number, alteracoes: AlteracoesOrganizacao, idUsuario: string) {
    await buscarOuFalhar(id);

    const dados = { ...alteracoes };

    if (alteracoes.cnpj !== undefined) {
        dados.cnpj = validarCnpj(alteracoes.cnpj);
        await garantirCnpjLivre(dados.cnpj, id);
    }

    const atualizou = await executarTransacao(idUsuario, async (tx) => {
        return organizacaoRepository.atualizarOrganizacao(tx, id, versao, dados);
    });

    if (!atualizou) {
        throw new ErroConflito("A organização foi alterada por outra pessoa. Recarregue e tente de novo");
    }

    return buscar(id);
}
