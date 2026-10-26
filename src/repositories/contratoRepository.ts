import { prisma } from "../lib/prisma.js";
import type { Transacao } from "../lib/transacao.js";
import type { Prisma } from "../generated/prisma/client.js";
import { hojeSemHora, somarDias } from "../utils/datas.js";
import { montarPagina } from "../utils/paginacao.js";
import { filtroDeEmpresa } from "../utils/filtros.js";

const TAMANHO_PAGINA = 20;

export interface FiltrosContrato {
    situacao?: "FUTURO" | "VIGENTE" | "ENCERRADO";
    vencendoEmDias?: number;
    organizacaoId?: string;
    organizacaoNome?: string;
    organizacaoCnpj?: string;
    ano?: number;
}

export interface DadosContrato {
    dataAssinatura: Date;
    dataVencimento: Date;
    clausulas: string[];
    valorMensal: number;
    renovacaoAutomatica: boolean;
}

export async function listarContratosDaOrganizacao(organizacaoId: string) {
    return prisma.contrato.findMany({
        where: { organizacaoId },
        orderBy: { dataAssinatura: "desc" },
    });
}

function montarFiltroContratos(filtros: FiltrosContrato) {
    const hoje = hojeSemHora();
    const condicoes: Prisma.ContratoWhereInput[] = [];

    if (filtros.organizacaoId) {
        condicoes.push({ organizacaoId: filtros.organizacaoId });
    }

    const organizacao = filtroDeEmpresa(filtros.organizacaoNome, filtros.organizacaoCnpj);

    if (organizacao) {
        condicoes.push({ organizacao });
    }

    // Contratos do ano: os que valeram em pelo menos um dia daquele ano.
    if (filtros.ano !== undefined) {
        const primeiroDia = new Date(Date.UTC(filtros.ano, 0, 1));
        const primeiroDiaDoAnoSeguinte = new Date(Date.UTC(filtros.ano + 1, 0, 1));
        condicoes.push({ dataAssinatura: { lt: primeiroDiaDoAnoSeguinte }, dataVencimento: { gte: primeiroDia } });
    }

    if (filtros.situacao === "FUTURO") {
        condicoes.push({ dataAssinatura: { gt: hoje } });
    }

    if (filtros.situacao === "ENCERRADO") {
        condicoes.push({ dataVencimento: { lt: hoje } });
    }

    if (filtros.situacao === "VIGENTE" || filtros.vencendoEmDias !== undefined) {
        condicoes.push({ dataAssinatura: { lte: hoje }, dataVencimento: { gte: hoje } });
    }

    if (filtros.vencendoEmDias !== undefined) {
        condicoes.push({ dataVencimento: { lte: somarDias(hoje, filtros.vencendoEmDias) } });
    }

    return { AND: condicoes };
}

export async function listarContratos(pagina: number, filtros: FiltrosContrato) {
    const where = montarFiltroContratos(filtros);

    const [itens, total] = await Promise.all([
        prisma.contrato.findMany({
            where,
            include: { organizacao: { select: { razaoSocial: true, cnpj: true } } },
            orderBy: { dataVencimento: "asc" },
            skip: (pagina - 1) * TAMANHO_PAGINA,
            take: TAMANHO_PAGINA,
        }),
        prisma.contrato.count({ where }),
    ]);

    return montarPagina(itens, total, pagina, TAMANHO_PAGINA);
}

export async function buscarContratoPorId(id: string) {
    return prisma.contrato.findUnique({ where: { id } });
}

export async function existeSobreposicao(organizacaoId: string, inicio: Date, fim: Date, ignorarId: string | null) {
    const sobrepostos = await prisma.contrato.findMany({
        where: {
            organizacaoId,
            dataAssinatura: { lte: fim },
            dataVencimento: { gte: inicio },
        },
        select: { id: true },
    });

    return sobrepostos.some((contrato) => contrato.id !== ignorarId);
}

export async function criarContrato(tx: Transacao, organizacaoId: string, dados: DadosContrato) {
    return tx.contrato.create({ data: { ...dados, organizacaoId } });
}

export async function atualizarContrato(tx: Transacao, id: string, versao: number, dados: Partial<DadosContrato>) {
    const resultado = await tx.contrato.updateMany({
        where: { id, versao },
        data: { ...dados, versao: { increment: 1 } },
    });

    return resultado.count === 1;
}

export async function apagarContrato(tx: Transacao, id: string) {
    await tx.contrato.delete({ where: { id } });
}
