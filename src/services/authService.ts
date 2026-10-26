import bcrypt from "bcrypt";
import type { Usuario } from "../generated/prisma/client.js";
import type { DadosToken } from "../plugins/autenticacao.js";
import { ErroConflito, ErroNaoAutenticado, ErroNaoEncontrado, ErroRegraNegocio } from "../errors/erros.js";
import * as usuarioRepository from "../repositories/usuarioRepository.js";
import { executarTransacao } from "../lib/transacao.js";

const MAXIMO_TENTATIVAS = 5;
const MINUTOS_BLOQUEIO = 15;
const CUSTO_BCRYPT = 10;

function estaBloqueado(usuario: Usuario) {
    return usuario.bloqueadoAte !== null && usuario.bloqueadoAte > new Date();
}

function formatarHora(data: Date) {
    return data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

async function registrarSenhaErrada(usuario: Usuario) {
    const bloqueioJaPassou = usuario.bloqueadoAte !== null;
    const tentativasAnteriores = bloqueioJaPassou ? 0 : usuario.tentativasLogin;
    const tentativas = tentativasAnteriores + 1;

    if (tentativas < MAXIMO_TENTATIVAS) {
        await executarTransacao(usuario.id, async (tx) => {
            await usuarioRepository.registrarFalhaLogin(tx, usuario.id, tentativas, null);
        });
        return;
    }

    const bloqueadoAte = new Date(Date.now() + MINUTOS_BLOQUEIO * 60 * 1000);
    await executarTransacao(usuario.id, async (tx) => {
        await usuarioRepository.registrarFalhaLogin(tx, usuario.id, tentativas, bloqueadoAte);
    });
    throw new ErroNaoAutenticado(`Senha errada ${MAXIMO_TENTATIVAS} vezes. Conta bloqueada até ${formatarHora(bloqueadoAte)}`);
}

export function validarForcaSenha(senha: string) {
    const temMaiuscula = /[A-Z]/.test(senha);
    const temNumero = /[0-9]/.test(senha);

    if (senha.length < 8 || !temMaiuscula || !temNumero) {
        throw new ErroRegraNegocio("A senha precisa ter pelo menos 8 caracteres, 1 letra maiúscula e 1 número");
    }
}

function montarDadosToken(usuario: Usuario, precisaTrocarSenha: boolean): DadosToken {
    return {
        id: usuario.id,
        papel: usuario.papel,
        precisaTrocarSenha,
    };
}

export async function login(loginInformado: string, senha: string) {
    const usuario = await usuarioRepository.buscarUsuarioPorLogin(loginInformado);

    if (!usuario || !usuario.ativo) {
        throw new ErroNaoAutenticado("Login ou senha inválidos");
    }

    if (estaBloqueado(usuario)) {
        throw new ErroNaoAutenticado(`Conta bloqueada até ${formatarHora(usuario.bloqueadoAte!)}`);
    }

    const senhaCorreta = await bcrypt.compare(senha, usuario.hashSenha);

    if (!senhaCorreta) {
        await registrarSenhaErrada(usuario);
        throw new ErroNaoAutenticado("Login ou senha inválidos");
    }

    await executarTransacao(usuario.id, async (tx) => {
        await usuarioRepository.registrarLoginComSucesso(tx, usuario.id);
    });

    return montarDadosToken(usuario, usuario.precisaTrocarSenha);
}

export async function trocarSenha(idUsuario: string, senhaAtual: string, novaSenha: string) {
    const usuario = await usuarioRepository.buscarUsuarioPorId(idUsuario);

    if (!usuario || !usuario.ativo) {
        throw new ErroNaoAutenticado("Usuário não encontrado ou desativado");
    }

    if (estaBloqueado(usuario)) {
        throw new ErroNaoAutenticado(`Conta bloqueada até ${formatarHora(usuario.bloqueadoAte!)}`);
    }

    const senhaCorreta = await bcrypt.compare(senhaAtual, usuario.hashSenha);

    if (!senhaCorreta) {
        await registrarSenhaErrada(usuario);
        throw new ErroRegraNegocio("Senha atual incorreta");
    }

    if (senhaAtual === novaSenha) {
        throw new ErroRegraNegocio("A nova senha precisa ser diferente da atual");
    }

    validarForcaSenha(novaSenha);

    const hashSenha = await bcrypt.hash(novaSenha, CUSTO_BCRYPT);

    await executarTransacao(usuario.id, async (tx) => {
        const atualizou = await usuarioRepository.atualizarSenha(tx, usuario.id, usuario.versao, hashSenha, false);

        if (!atualizou) {
            throw new ErroConflito("O usuário foi alterado por outra pessoa. Tente novamente");
        }

        await usuarioRepository.registrarLoginComSucesso(tx, usuario.id);
    });

    return montarDadosToken(usuario, false);
}

export async function buscarPerfil(idUsuario: string) {
    const usuario = await usuarioRepository.buscarUsuarioPorId(idUsuario);

    if (!usuario) {
        throw new ErroNaoEncontrado("Usuário não encontrado");
    }

    return {
        id: usuario.id,
        nome: usuario.nome,
        login: usuario.login,
        papel: usuario.papel,
        ativo: usuario.ativo,
        ultimoAcesso: usuario.ultimoAcesso,
        precisaTrocarSenha: usuario.precisaTrocarSenha,
    };
}
