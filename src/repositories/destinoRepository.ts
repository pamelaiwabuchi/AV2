import { prisma } from "../lib/prisma.js";
import type { Transacao } from "../lib/transacao.js";
import { montarPagina } from "../utils/paginacao.js";

const TAMANHO_PAGINA = 20;

export interface AlteracoesDestino extends Partial<DadosDestino> {
    ativo?: boolean;
}

export interface DadosDestino {
    razaoSocial: string;
    cnpj: string;
    enderecoCompleto: string;
    telefone: string;
    email: string;
}

export async function listarDestinos(pagina: number, busca: string, somenteAtivos: boolean) {
    const filtroAtivo = somenteAtivos ? { ativo: true } : {};
    const where = {
        ...filtroAtivo,
        OR: [
            { razaoSocial: { contains: busca, mode: "insensitive" as const } },
            { cnpj: { contains: busca.replace(/\D/g, "") || busca } },
        ],
    };

    const [itens, total] = await Promise.all([
        prisma.destino.findMany({
            where,
            orderBy: { razaoSocial: "asc" },
            skip: (pagina - 1) * TAMANHO_PAGINA,
            take: TAMANHO_PAGINA,
        }),
        prisma.destino.count({ where }),
    ]);

    return montarPagina(itens, total, pagina, TAMANHO_PAGINA);
}

export async function buscarDestinoPorId(id: string) {
    return prisma.destino.findUnique({ where: { id } });
}

export async function buscarDestinoPorCnpj(cnpj: string) {
    return prisma.destino.findUnique({ where: { cnpj } });
}

export async function criarDestino(tx: Transacao, dados: DadosDestino) {
    return tx.destino.create({ data: dados });
}

export async function atualizarDestino(tx: Transacao, id: string, versao: number, alteracoes: AlteracoesDestino) {
    const resultado = await tx.destino.updateMany({
        where: { id, versao },
        data: { ...alteracoes, versao: { increment: 1 } },
    });

    return resultado.count === 1;
}
