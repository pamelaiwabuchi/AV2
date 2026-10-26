import { prisma } from "../lib/prisma.js";
import type { PapelUsuario } from "../generated/prisma/enums.js";
import type { Transacao } from "../lib/transacao.js";
import { montarPagina } from "../utils/paginacao.js";
import type { Prisma } from "../generated/prisma/client.js";

const TAMANHO_PAGINA = 20;

export interface FiltrosUsuario {
    busca?: string;
    papel?: PapelUsuario;
    ativo?: boolean;
    bloqueado?: boolean;
    departamentoId?: string;
    departamento?: string;
}

export interface AlteracoesUsuario {
    nome?: string;
    papel?: PapelUsuario;
    ativo?: boolean;
    departamentoId?: string;
}

const comDepartamento = { departamento: { select: { id: true, nome: true } } };

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

function montarFiltroUsuarios(filtros: FiltrosUsuario) {
    const agora = new Date();
    const condicoes: Prisma.UsuarioWhereInput[] = [];

    if (filtros.busca) {
        condicoes.push({
            OR: [
                { nome: { contains: filtros.busca, mode: "insensitive" } },
                { login: { contains: filtros.busca, mode: "insensitive" } },
            ],
        });
    }

    if (filtros.papel) {
        condicoes.push({ papel: filtros.papel });
    }

    if (filtros.departamentoId) {
        condicoes.push({ departamentoId: filtros.departamentoId });
    }

    if (filtros.departamento) {
        condicoes.push({ departamento: { nome: { contains: filtros.departamento, mode: "insensitive" } } });
    }

    if (filtros.ativo !== undefined) {
        condicoes.push({ ativo: filtros.ativo });
    }

    if (filtros.bloqueado === true) {
        condicoes.push({ bloqueadoAte: { gt: agora } });
    }

    if (filtros.bloqueado === false) {
        condicoes.push({ OR: [{ bloqueadoAte: null }, { bloqueadoAte: { lte: agora } }] });
    }

    return { AND: condicoes };
}

export async function listarUsuarios(pagina: number, filtros: FiltrosUsuario) {
    const where = montarFiltroUsuarios(filtros);

    const [itens, total] = await Promise.all([
        prisma.usuario.findMany({
            where,
            omit: { hashSenha: true },
            include: comDepartamento,
            orderBy: { nome: "asc" },
            skip: (pagina - 1) * TAMANHO_PAGINA,
            take: TAMANHO_PAGINA,
        }),
        prisma.usuario.count({ where }),
    ]);

    return montarPagina(itens, total, pagina, TAMANHO_PAGINA);
}

export async function buscarUsuarioSemSenha(id: string) {
    return prisma.usuario.findUnique({
        where: { id },
        omit: { hashSenha: true },
        include: comDepartamento,
    });
}

export async function buscarUsuarioSemSenhaPorLogin(login: string) {
    return prisma.usuario.findUnique({
        where: { login },
        omit: { hashSenha: true },
        include: comDepartamento,
    });
}

export interface DadosUsuarioNovo {
    nome: string;
    login: string;
    hashSenha: string;
    papel: PapelUsuario;
    departamentoId: string;
}

export async function criarUsuario(tx: Transacao, dados: DadosUsuarioNovo) {
    return tx.usuario.create({
        data: dados,
        omit: { hashSenha: true },
        include: comDepartamento,
    });
}

export async function atualizarUsuario(tx: Transacao, id: string, versao: number, alteracoes: AlteracoesUsuario) {
    const resultado = await tx.usuario.updateMany({
        where: { id, versao },
        data: { ...alteracoes, versao: { increment: 1 } },
    });

    return resultado.count === 1;
}
