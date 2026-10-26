import type { FastifyInstance } from "fastify";
import { StatusRastreamento } from "../generated/prisma/enums.js";
import * as movimentacaoService from "../services/movimentacaoService.js";
import { exigirPapel } from "../plugins/autenticacao.js";
import { filtroDePeriodoOuAno } from "../utils/datas.js";
import { contemTexto } from "../utils/filtros.js";

interface ConsultaLista {
    pagina: number;
    destino?: StatusRastreamento;
    responsavelId?: string;
    responsavelLogin?: string;
    codigo?: string;
    inicio?: string;
    fim?: string;
    ano?: number;
}

const esquemaListar = {
    querystring: {
        type: "object",
        properties: {
            pagina: { type: "integer", minimum: 1, default: 1 },
            destino: { type: "string", enum: Object.values(StatusRastreamento) },
            responsavelId: { type: "string", format: "uuid" },
            responsavelLogin: { type: "string" },
            codigo: { type: "string" },
            inicio: { type: "string", format: "date" },
            fim: { type: "string", format: "date" },
            ano: { type: "integer" },
        },
    },
};

const podeConsultar = exigirPapel("GESTOR_ALMOXARIFADO", "AUDITOR");

export async function movimentacaoController(app: FastifyInstance) {
    app.get<{ Querystring: ConsultaLista }>("/movimentacoes", { schema: esquemaListar, onRequest: podeConsultar }, async (request) => {
        const { pagina, inicio, fim, ano, responsavelLogin, codigo, ...filtros } = request.query;
        const filtroLogin = responsavelLogin ? { responsavel: { login: responsavelLogin } } : {};
        const filtroCodigo = codigo ? { equipamento: { codigoBarrasInterno: contemTexto(codigo) } } : {};
        const dataHora = filtroDePeriodoOuAno(inicio, fim, ano);

        return movimentacaoService.listar(pagina, { ...filtros, ...filtroLogin, ...filtroCodigo, dataHora });
    });
}
