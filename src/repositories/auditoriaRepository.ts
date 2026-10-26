import { prisma } from "../lib/prisma.js";
import { montarPagina } from "../utils/paginacao.js";

const TAMANHO_PAGINA = 50;

export interface FiltrosAuditoria {
    tabela?: string;
    registroId?: string;
    usuarioId?: string;
    dataHora?: { gte?: Date; lt?: Date };
}

export async function listarAuditoria(pagina: number, filtros: FiltrosAuditoria) {
    const [itens, total] = await Promise.all([
        prisma.auditoria.findMany({
            where: filtros,
            orderBy: { dataHora: "desc" },
            skip: (pagina - 1) * TAMANHO_PAGINA,
            take: TAMANHO_PAGINA,
        }),
        prisma.auditoria.count({ where: filtros }),
    ]);

    return montarPagina(itens, total, pagina, TAMANHO_PAGINA);
}
