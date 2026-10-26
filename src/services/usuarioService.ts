import bcrypt from "bcrypt";
import { PapelUsuario } from "../generated/prisma/enums.js";
import { ErroConflito, ErroNaoEncontrado, ErroRegraNegocio } from "../errors/erros.js";
import { validarForcaSenha } from "./authService.js";
import * as usuarioRepository from "../repositories/usuarioRepository.js";
import * as departamentoRepository from "../repositories/departamentoRepository.js";
import { executarTransacao } from "../lib/transacao.js";

const CUSTO_BCRYPT = 10;

export interface PedidoAlteracaoUsuario {
    nome?: string;
    papel?: string;
    ativo?: boolean;
    departamentoId?: string;
}

export interface PedidoNovoUsuario {
    nome: string;
    login: string;
    senha: string;
    papel: string;
    departamentoId: string;
}

function validarPapel(papel: string) {
    const papeisValidos: string[] = Object.values(PapelUsuario);

    if (!papeisValidos.includes(papel)) {
        throw new ErroRegraNegocio(`Papel inválido. Use um destes: ${papeisValidos.join(", ")}`);
    }

    return papel as PapelUsuario;
}

// Departamento desativado não recebe usuário novo (quem já está nele continua).
async function garantirDepartamentoAtivo(departamentoId: string) {
    const departamento = await departamentoRepository.buscarDepartamentoPorId(departamentoId);

    if (!departamento || !departamento.ativo) {
        throw new ErroRegraNegocio("Departamento não encontrado ou desativado");
    }
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

export async function buscarPorLogin(login: string) {
    const usuario = await usuarioRepository.buscarUsuarioSemSenhaPorLogin(login);

    if (!usuario) {
        throw new ErroNaoEncontrado(`Nenhum usuário com o login "${login}"`);
    }

    return usuario;
}

export async function criar(pedido: PedidoNovoUsuario, idAdmin: string) {
    const papelValido = validarPapel(pedido.papel);
    validarForcaSenha(pedido.senha);
    await garantirDepartamentoAtivo(pedido.departamentoId);

    const existente = await usuarioRepository.buscarUsuarioPorLogin(pedido.login);

    if (existente) {
        throw new ErroConflito(`O login "${pedido.login}" já está em uso`);
    }

    const hashSenha = await bcrypt.hash(pedido.senha, CUSTO_BCRYPT);
    const dados = {
        nome: pedido.nome,
        login: pedido.login,
        hashSenha,
        papel: papelValido,
        departamentoId: pedido.departamentoId,
    };

    return executarTransacao(idAdmin, async (tx) => {
        return usuarioRepository.criarUsuario(tx, dados);
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

    if (pedido.departamentoId !== undefined) {
        await garantirDepartamentoAtivo(pedido.departamentoId);
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
