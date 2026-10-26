import type { FastifyInstance } from "fastify";
import * as relatorioService from "../services/relatorioService.js";
import { exigirLogin, exigirPapel } from "../plugins/autenticacao.js";

interface ConsultaDestinacao {
    organizacaoId?: string;
    inicio: string;
    fim: string;
}

const esquemaDestinacao = {
    querystring: {
        type: "object",
        required: ["inicio", "fim"],
        properties: {
            organizacaoId: { type: "string", format: "uuid" },
            inicio: { type: "string", format: "date" },
            fim: { type: "string", format: "date" },
        },
    },
};

interface ConsultaPeriodo {
    inicio: string;
    fim: string;
}

const esquemaFinanceiro = {
    querystring: {
        type: "object",
        required: ["inicio", "fim"],
        properties: {
            inicio: { type: "string", format: "date" },
            fim: { type: "string", format: "date" },
        },
    },
};

const podeVerRelatorio = exigirPapel("GESTOR_ALMOXARIFADO", "OPERADOR_CADASTRO", "AUDITOR");
const podeVerFinanceiro = exigirPapel("AUDITOR");

export async function relatorioController(app: FastifyInstance) {
    const opcoesDestinacao = { schema: esquemaDestinacao, onRequest: podeVerRelatorio };
    const opcoesFinanceiro = { schema: esquemaFinanceiro, onRequest: podeVerFinanceiro };

    app.get("/painel", { onRequest: exigirLogin }, async (request) => {
        return relatorioService.montarPainel(request.user.papel);
    });

    app.get<{ Querystring: ConsultaDestinacao }>("/relatorios/destinacao", opcoesDestinacao, async (request) => {
        const { organizacaoId, inicio, fim } = request.query;
        return relatorioService.relatorioDestinacao(organizacaoId, new Date(inicio), new Date(fim));
    });

    app.get<{ Querystring: ConsultaPeriodo }>("/relatorios/financeiro", opcoesFinanceiro, async (request) => {
        const { inicio, fim } = request.query;
        return relatorioService.relatorioFinanceiro(new Date(inicio), new Date(fim));
    });
}
