import { ErroConflito, ErroNaoEncontrado } from "../errors/erros.js";
import { validarCnpj } from "../utils/cnpj.js";
import * as destinoRepository from "../repositories/destinoRepository.js";
import { executarTransacao } from "../lib/transacao.js";
import type { AlteracoesDestino, DadosDestino } from "../repositories/destinoRepository.js";

async function buscarOuFalhar(id: string, somenteAtivos: boolean) {
    const destino = await destinoRepository.buscarDestinoPorId(id);

    if (!destino || (somenteAtivos && !destino.ativo)) {
        throw new ErroNaoEncontrado("Destino não encontrado");
    }

    return destino;
}

async function garantirCnpjLivre(cnpj: string, idAtual: string | null) {
    const existente = await destinoRepository.buscarDestinoPorCnpj(cnpj);

    if (existente && existente.id !== idAtual) {
        throw new ErroConflito("Já existe um destino com esse CNPJ");
    }
}

export async function listar(pagina: number, busca: string, somenteAtivos: boolean) {
    return destinoRepository.listarDestinos(pagina, busca, somenteAtivos);
}

export async function buscar(id: string, somenteAtivos: boolean) {
    return buscarOuFalhar(id, somenteAtivos);
}

export async function criar(dados: DadosDestino, idUsuario: string) {
    const cnpj = validarCnpj(dados.cnpj);
    await garantirCnpjLivre(cnpj, null);

    return executarTransacao(idUsuario, async (tx) => {
        return destinoRepository.criarDestino(tx, { ...dados, cnpj });
    });
}

export async function atualizar(id: string, versao: number, alteracoes: AlteracoesDestino, idUsuario: string) {
    await buscarOuFalhar(id, false);

    const dados = { ...alteracoes };

    if (alteracoes.cnpj !== undefined) {
        dados.cnpj = validarCnpj(alteracoes.cnpj);
        await garantirCnpjLivre(dados.cnpj, id);
    }

    const atualizou = await executarTransacao(idUsuario, async (tx) => {
        return destinoRepository.atualizarDestino(tx, id, versao, dados);
    });

    if (!atualizou) {
        throw new ErroConflito("O destino foi alterado por outra pessoa. Recarregue e tente de novo");
    }

    return buscarOuFalhar(id, false);
}
