import type { FastifyInstance } from "fastify";
import { StatusRastreamento } from "../generated/prisma/enums.js";
import * as movimentacaoService from "../services/movimentacaoService.js";
import { exigirPapel } from "../plugins/autenticacao.js";
import { filtroDePeriodo } from "../utils/datas.js";

interface ConsultaLista {
    pagina: number;
    destino?: StatusRastreamento;
    responsavelId?: string;
    responsavelLogin?: string;
    inicio?: string;
    fim?: string;
}

const esquemaListar = {
    querystring: {
        type: "object",
        properties: {
            pagina: { type: "integer", minimum: 1, default: 1 },
            destino: { type: "string", enum: Object.values(StatusRastreamento) },
            responsavelId: { type: "string", format: "uuid" },
            responsavelLogin: { type: "string" },
            inicio: { type: "string", format: "date" },
            fim: { type: "string", format: "date" },
        },
    },
};

const podeConsultar = exigirPapel("GESTOR_ALMOXARIFADO", "AUDITOR");

export async function movimentacaoController(app: FastifyInstance) {
    app.get<{ Querystring: ConsultaLista }>("/movimentacoes", { schema: esquemaListar, onRequest: podeConsultar }, async (request) => {
        const { pagina, inicio, fim, responsavelLogin, ...filtros } = request.query;
        const filtroLogin = responsavelLogin ? { responsavel: { login: responsavelLogin } } : {};

        return movimentacaoService.listar(pagina, { ...filtros, ...filtroLogin, dataHora: filtroDePeriodo(inicio, fim) });
    });
}
