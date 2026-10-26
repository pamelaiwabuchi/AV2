import type { StatusLote, StatusRastreamento } from "../generated/prisma/enums.js";

const transicoesPermitidas: Record<StatusRastreamento, StatusRastreamento[]> = {
    AGUARDANDO_TRIAGEM: ["EM_TRIAGEM", "CANCELADO"],
    EM_TRIAGEM: ["AGUARDANDO_DESMONTE", "PECAS_REAPROVEITADAS", "MATERIAL_RECICLAVEL", "DESCARTE_SEGURO"],
    AGUARDANDO_DESMONTE: ["EM_DESMONTE"],
    EM_DESMONTE: ["PECAS_REAPROVEITADAS", "MATERIAL_RECICLAVEL", "DESCARTE_SEGURO"],
    PECAS_REAPROVEITADAS: ["BAIXA_DEFINITIVA"],
    MATERIAL_RECICLAVEL: ["BAIXA_DEFINITIVA"],
    DESCARTE_SEGURO: ["BAIXA_DEFINITIVA"],
    BAIXA_DEFINITIVA: [],
    CANCELADO: [],
};

export const STATUS_COM_DESTINO: StatusRastreamento[] = ["PECAS_REAPROVEITADAS", "MATERIAL_RECICLAVEL", "DESCARTE_SEGURO"];

export function podeMudarStatus(atual: StatusRastreamento, novo: StatusRastreamento) {
    return transicoesPermitidas[atual].includes(novo);
}

export function ehStatusFinal(status: StatusRastreamento) {
    return transicoesPermitidas[status].length === 0;
}

export function calcularStatusLote(statusDosEquipamentos: StatusRastreamento[]): StatusLote {
    const ativos = statusDosEquipamentos.filter((status) => status !== "CANCELADO");

    if (ativos.every((status) => status === "BAIXA_DEFINITIVA")) {
        return "FINALIZADO";
    }

    if (ativos.every((status) => status === "BAIXA_DEFINITIVA" || STATUS_COM_DESTINO.includes(status))) {
        return "ENCAMINHADO";
    }

    if (ativos.every((status) => status !== "AGUARDANDO_TRIAGEM" && status !== "EM_TRIAGEM")) {
        return "TRIAGEM_CONCLUIDA";
    }

    if (ativos.some((status) => status !== "AGUARDANDO_TRIAGEM")) {
        return "EM_TRIAGEM";
    }

    return "RECEBIDO";
}
