import bcrypt from "bcrypt";
import { PapelUsuario } from "../generated/prisma/enums.js";
import { ErroConflito, ErroNaoEncontrado, ErroRegraNegocio } from "../errors/erros.js";
import { validarForcaSenha } from "./authService.js";
import * as usuarioRepository from "../repositories/usuarioRepository.js";
import { executarTransacao } from "../lib/transacao.js";

const CUSTO_BCRYPT = 10;

export interface PedidoAlteracaoUsuario {
    nome?: string;
    papel?: string;
    ativo?: boolean;
}

function validarPapel(papel: string) {
    const papeisValidos: string[] = Object.values(PapelUsuario);

    if (!papeisValidos.includes(papel)) {
        throw new ErroRegraNegocio(`Papel inválido. Use um destes: ${papeisValidos.join(", ")}`);
    }

    return papel as PapelUsuario;
}

async function buscarOuFalhar(id: string) {
    const usuario = await usuarioRepository.buscarUsuarioSemSenha(id);

    if (!usuario) {
        throw new ErroNaoEncontrado("Usuário não encontrado");
    }

    return usuario;
}

export async function listar(pagina: number, filtros: usuarioRepository.FiltrosUsuario) {
    return usuarioRepository.listarUsuarios(pagina, filtros);
}

export async function buscar(id: string) {
    return buscarOuFalhar(id);
}

export async function criar(nome: string, login: string, senha: string, papel: string, idAdmin: string) {
    const papelValido = validarPapel(papel);
    validarForcaSenha(senha);

    const existente = await usuarioRepository.buscarUsuarioPorLogin(login);

    if (existente) {
        throw new ErroConflito(`O login "${login}" já está em uso`);
    }

    const hashSenha = await bcrypt.hash(senha, CUSTO_BCRYPT);

    return executarTransacao(idAdmin, async (tx) => {
        return usuarioRepository.criarUsuario(tx, nome, login, hashSenha, papelValido);
    });
}

export async function atualizar(id: string, idAdmin: string, versao: number, pedido: PedidoAlteracaoUsuario) {
    await buscarOuFalhar(id);

    if (id === idAdmin && pedido.ativo === false) {
        throw new ErroRegraNegocio("Você não pode desativar o seu próprio usuário");
    }

    const { papel, ...outrosCampos } = pedido;
    const alteracoes: usuarioRepository.AlteracoesUsuario = { ...outrosCampos };

    if (papel !== undefined) {
        alteracoes.papel = validarPapel(papel);
    }

    const atualizou = await executarTransacao(idAdmin, async (tx) => {
        return usuarioRepository.atualizarUsuario(tx, id, versao, alteracoes);
    });

    if (!atualizou) {
        throw new ErroConflito("O usuário foi alterado por outra pessoa. Recarregue e tente de novo");
    }

    return buscarOuFalhar(id);
}

export async function redefinirSenha(id: string, novaSenha: string, idAdmin: string) {
    const usuario = await buscarOuFalhar(id);
    validarForcaSenha(novaSenha);

    const hashSenha = await bcrypt.hash(novaSenha, CUSTO_BCRYPT);
    const atualizou = await executarTransacao(idAdmin, async (tx) => {
        return usuarioRepository.atualizarSenha(tx, id, usuario.versao, hashSenha, true);
    });

    if (!atualizou) {
        throw new ErroConflito("O usuário foi alterado por outra pessoa. Tente de novo");
    }
}
