import { prisma } from "../lib/prisma.js";
import type { Transacao } from "../lib/transacao.js";
import { montarPagina } from "../utils/paginacao.js";

const TAMANHO_PAGINA = 20;

export interface FiltrosDepartamento {
    busca?: string;
    ativo?: boolean;
}

export interface AlteracoesDepartamento {
    nome?: string;
    ativo?: boolean;
}

function montarFiltroDepartamentos(filtros: FiltrosDepartamento) {
    const filtroAtivo = filtros.ativo !== undefined ? { ativo: filtros.ativo } : {};
    const filtroBusca = filtros.busca ? { nome: { contains: filtros.busca, mode: "insensitive" as const } } : {};

    return { ...filtroAtivo, ...filtroBusca };
}

export async function listarDepartamentos(pagina: number, filtros: FiltrosDepartamento) {
    const where = montarFiltroDepartamentos(filtros);

    const [itens, total] = await Promise.all([
        prisma.departamento.findMany({
            where,
            include: { _count: { select: { usuarios: true } } },
            orderBy: { nome: "asc" },
            skip: (pagina - 1) * TAMANHO_PAGINA,
            take: TAMANHO_PAGINA,
        }),
        prisma.departamento.count({ where }),
    ]);

    return montarPagina(itens, total, pagina, TAMANHO_PAGINA);
}

export async function buscarDepartamentoPorId(id: string) {
    return prisma.departamento.findUnique({ where: { id } });
}

export async function buscarDepartamentoPorNome(nome: string) {
    return prisma.departamento.findFirst({
        where: { nome: { equals: nome, mode: "insensitive" } },
    });
}

export async function criarDepartamento(tx: Transacao, nome: string) {
    return tx.departamento.create({ data: { nome } });
}

export async function atualizarDepartamento(tx: Transacao, id: string, versao: number, alteracoes: AlteracoesDepartamento) {
    const resultado = await tx.departamento.updateMany({
        where: { id, versao },
        data: { ...alteracoes, versao: { increment: 1 } },
    });

    return resultado.count === 1;
}
