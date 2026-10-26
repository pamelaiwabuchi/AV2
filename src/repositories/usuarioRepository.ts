import { prisma } from "../lib/prisma.js";
import type { PapelUsuario } from "../generated/prisma/enums.js";
import type { Transacao } from "../lib/transacao.js";
import { montarPagina } from "../utils/paginacao.js";

const TAMANHO_PAGINA = 20;

export interface AlteracoesUsuario {
    nome?: string;
    papel?: PapelUsuario;
    ativo?: boolean;
}

export async function buscarUsuarioPorLogin(login: string) {
    return prisma.usuario.findUnique({ where: { login } });
}

export async function buscarUsuarioPorId(id: string) {
    return prisma.usuario.findUnique({ where: { id } });
}

export async function registrarFalhaLogin(tx: Transacao, id: string, tentativas: number, bloqueadoAte: Date | null) {
    await tx.usuario.update({
        where: { id },
        data: { tentativasLogin: tentativas, bloqueadoAte },
    });
}

export async function registrarLoginComSucesso(tx: Transacao, id: string) {
    await tx.usuario.update({
        where: { id },
        data: { tentativasLogin: 0, bloqueadoAte: null, ultimoAcesso: new Date() },
    });
}

export async function atualizarSenha(tx: Transacao, id: string, versao: number, hashSenha: string, precisaTrocarSenha: boolean) {
    const resultado = await tx.usuario.updateMany({
        where: { id, versao },
        data: {
            hashSenha,
            precisaTrocarSenha,
            tentativasLogin: 0,
            bloqueadoAte: null,
            versao: { increment: 1 },
        },
    });

    return resultado.count === 1;
}

export async function listarUsuarios(pagina: number) {
    const [itens, total] = await Promise.all([
        prisma.usuario.findMany({
            omit: { hashSenha: true },
            orderBy: { nome: "asc" },
            skip: (pagina - 1) * TAMANHO_PAGINA,
            take: TAMANHO_PAGINA,
        }),
        prisma.usuario.count(),
    ]);

    return montarPagina(itens, total, pagina, TAMANHO_PAGINA);
}

export async function buscarUsuarioSemSenha(id: string) {
    return prisma.usuario.findUnique({
        where: { id },
        omit: { hashSenha: true },
    });
}

export async function criarUsuario(tx: Transacao, nome: string, login: string, hashSenha: string, papel: PapelUsuario) {
    return tx.usuario.create({
        data: { nome, login, hashSenha, papel },
        omit: { hashSenha: true },
    });
}

export async function atualizarUsuario(tx: Transacao, id: string, versao: number, alteracoes: AlteracoesUsuario) {
    const resultado = await tx.usuario.updateMany({
        where: { id, versao },
        data: { ...alteracoes, versao: { increment: 1 } },
    });

    return resultado.count === 1;
}
