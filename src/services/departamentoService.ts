import { ErroConflito, ErroNaoEncontrado } from "../errors/erros.js";
import * as departamentoRepository from "../repositories/departamentoRepository.js";
import * as usuarioRepository from "../repositories/usuarioRepository.js";
import { executarTransacao } from "../lib/transacao.js";
import type { AlteracoesDepartamento, FiltrosDepartamento } from "../repositories/departamentoRepository.js";

async function buscarOuFalhar(id: string) {
    const departamento = await departamentoRepository.buscarDepartamentoPorId(id);

    if (!departamento) {
        throw new ErroNaoEncontrado("Departamento não encontrado");
    }

    return departamento;
}

// "RH" e "rh" contam como o mesmo nome.
async function garantirNomeLivre(nome: string, idAtual: string | null) {
    const existente = await departamentoRepository.buscarDepartamentoPorNome(nome);

    if (existente && existente.id !== idAtual) {
        throw new ErroConflito(`Já existe o departamento "${existente.nome}"`);
    }
}

export async function listar(pagina: number, filtros: FiltrosDepartamento) {
    return departamentoRepository.listarDepartamentos(pagina, filtros);
}

export async function buscar(id: string) {
    return buscarOuFalhar(id);
}

export async function listarUsuarios(id: string, pagina: number, busca: string) {
    await buscarOuFalhar(id);
    return usuarioRepository.listarUsuarios(pagina, { departamentoId: id, busca, ativo: true });
}

export async function criar(nome: string, idUsuario: string) {
    const nomeLimpo = nome.trim();
    await garantirNomeLivre(nomeLimpo, null);

    return executarTransacao(idUsuario, async (tx) => {
        return departamentoRepository.criarDepartamento(tx, nomeLimpo);
    });
}

export async function atualizar(id: string, versao: number, alteracoes: AlteracoesDepartamento, idUsuario: string) {
    await buscarOuFalhar(id);

    const dados = { ...alteracoes };

    if (alteracoes.nome !== undefined) {
        dados.nome = alteracoes.nome.trim();
        await garantirNomeLivre(dados.nome, id);
    }

    const atualizou = await executarTransacao(idUsuario, async (tx) => {
        return departamentoRepository.atualizarDepartamento(tx, id, versao, dados);
    });

    if (!atualizou) {
        throw new ErroConflito("O departamento foi alterado por outra pessoa. Recarregue e tente de novo");
    }

    return buscarOuFalhar(id);
}
