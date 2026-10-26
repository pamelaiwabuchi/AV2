import type { FastifyInstance } from "fastify";
import * as destinoService from "../services/destinoService.js";
import { exigirPapel } from "../plugins/autenticacao.js";
import { esquemaId, textoObrigatorio } from "../utils/esquemas.js";
import type { AlteracoesDestino, DadosDestino } from "../repositories/destinoRepository.js";
import { exigirAlgumCampo } from "../utils/alteracoes.js";

interface ParametrosId {
    id: string;
}

interface ConsultaLista {
    pagina: number;
    busca: string;
}

interface CorpoAtualizar extends AlteracoesDestino {
    versao: number;
}

const camposDestino = {
    razaoSocial: textoObrigatorio,
    cnpj: textoObrigatorio,
    enderecoCompleto: textoObrigatorio,
    telefone: textoObrigatorio,
    email: { type: "string", format: "email" },
};

const obrigatorios = ["razaoSocial", "cnpj", "enderecoCompleto", "telefone", "email"];

const esquemaListar = {
    querystring: {
        type: "object",
        properties: {
            pagina: { type: "integer", minimum: 1, default: 1 },
            busca: { type: "string", default: "" },
        },
    },
};

const esquemaCriar = {
    body: {
        type: "object",
        required: obrigatorios,
        additionalProperties: false,
        properties: camposDestino,
    },
};

const esquemaAtualizar = {
    params: esquemaId,
    body: {
        type: "object",
        required: ["versao"],
        additionalProperties: false,
        properties: {
            ...camposDestino,
            ativo: { type: "boolean" },
            versao: { type: "integer" },
        },
    },
};

const podeConsultar = exigirPapel("OPERADOR_CADASTRO", "GESTOR_ALMOXARIFADO", "AUDITOR");
const podeAlterar = exigirPapel("OPERADOR_CADASTRO");

export async function destinoController(app: FastifyInstance) {
    const opcoesListar = { schema: esquemaListar, onRequest: podeConsultar };
    const opcoesBuscar = { schema: { params: esquemaId }, onRequest: podeConsultar };
    const opcoesCriar = { schema: esquemaCriar, onRequest: podeAlterar };
    const opcoesAtualizar = { schema: esquemaAtualizar, onRequest: podeAlterar };

    app.get<{ Querystring: ConsultaLista }>("/destinos", opcoesListar, async (request) => {
        const somenteAtivos = request.user.papel === "GESTOR_ALMOXARIFADO";
        return destinoService.listar(request.query.pagina, request.query.busca, somenteAtivos);
    });

    app.get<{ Params: ParametrosId }>("/destinos/:id", opcoesBuscar, async (request) => {
        const somenteAtivos = request.user.papel === "GESTOR_ALMOXARIFADO";
        return destinoService.buscar(request.params.id, somenteAtivos);
    });

    app.post<{ Body: DadosDestino }>("/destinos", opcoesCriar, async (request, reply) => {
        const destino = await destinoService.criar(request.body, request.user.id);
        return reply.status(201).send(destino);
    });

    app.patch<{ Params: ParametrosId; Body: CorpoAtualizar }>("/destinos/:id", opcoesAtualizar, async (request) => {
        const { versao, ...alteracoes } = request.body;
        exigirAlgumCampo(alteracoes);
        return destinoService.atualizar(request.params.id, versao, alteracoes, request.user.id);
    });
}
