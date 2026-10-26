import { prisma } from "../lib/prisma.js";
import type { Transacao } from "../lib/transacao.js";

export async function buscarParametros() {
    const parametros = await prisma.parametros.findFirst();

    if (!parametros) {
        throw new Error("A tabela Parametros está vazia. Rode o seed: npx prisma db seed");
    }

    return parametros;
}

export interface DadosParametros {
    aliquotaImposto: number;
    depreciacaoComputadorMesa: number;
    depreciacaoNotebook: number;
    depreciacaoMonitor: number;
    depreciacaoImpressora: number;
    depreciacaoServidor: number;
    depreciacaoRoteador: number;
    depreciacaoCaboEstruturado: number;
    depreciacaoFonteAlimentacao: number;
    diasLoteParado: number;
}

export async function atualizarParametros(tx: Transacao, id: string, versao: number, dados: Partial<DadosParametros>) {
    const resultado = await tx.parametros.updateMany({
        where: { id, versao },
        data: { ...dados, versao: { increment: 1 } },
    });

    return resultado.count === 1;
}
