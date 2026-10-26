import type { FastifyInstance } from "fastify";
import * as departamentoService from "../services/departamentoService.js";
import { exigirPapel } from "../plugins/autenticacao.js";
import { esquemaId, textoObrigatorio } from "../utils/esquemas.js";
import type { AlteracoesDepartamento, FiltrosDepartamento } from "../repositories/departamentoRepository.js";
import { exigirAlgumCampo } from "../utils/alteracoes.js";

interface ParametrosId {
    id: string;
}

interface ConsultaLista extends FiltrosDepartamento {
    pagina: number;
}

interface ConsultaUsuarios {
    pagina: number;
    busca: string;
}

interface CorpoCriar {
    nome: string;
}

interface CorpoAtualizar extends AlteracoesDepartamento {
    versao: number;
}

const esquemaListar = {
    querystring: {
        type: "object",
        properties: {
            pagina: { type: "integer", minimum: 1, default: 1 },
            busca: { type: "string" },
            ativo: { type: "boolean" },
        },
    },
};

const esquemaUsuarios = {
    params: esquemaId,
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
        required: ["nome"],
        additionalProperties: false,
        properties: {
            nome: textoObrigatorio,
        },
    },
};

const esquemaAtualizar = {
    params: esquemaId,
    body: {
        type: "object",
        required: ["versao"],
        additionalProperties: false,
        properties: {
            nome: textoObrigatorio,
            ativo: { type: "boolean" },
            versao: { type: "integer" },
        },
    },
};

const somenteAdmin = exigirPapel();

export async function departamentoController(app: FastifyInstance) {
    const opcoesListar = { schema: esquemaListar, onRequest: somenteAdmin };
    const opcoesBuscar = { schema: { params: esquemaId }, onRequest: somenteAdmin };
    const opcoesUsuarios = { schema: esquemaUsuarios, onRequest: somenteAdmin };
    const opcoesCriar = { schema: esquemaCriar, onRequest: somenteAdmin };
    const opcoesAtualizar = { schema: esquemaAtualizar, onRequest: somenteAdmin };

    app.get<{ Querystring: ConsultaLista }>("/departamentos", opcoesListar, async (request) => {
        const { pagina, ...filtros } = request.query;
        return departamentoService.listar(pagina, filtros);
    });

    app.get<{ Params: ParametrosId }>("/departamentos/:id", opcoesBuscar, async (request) => {
        return departamentoService.buscar(request.params.id);
    });

    app.get<{ Params: ParametrosId; Querystring: ConsultaUsuarios }>("/departamentos/:id/usuarios", opcoesUsuarios, async (request) => {
        return departamentoService.listarUsuarios(request.params.id, request.query.pagina, request.query.busca);
    });

    app.post<{ Body: CorpoCriar }>("/departamentos", opcoesCriar, async (request, reply) => {
        const departamento = await departamentoService.criar(request.body.nome, request.user.id);
        return reply.status(201).send(departamento);
    });

    app.patch<{ Params: ParametrosId; Body: CorpoAtualizar }>("/departamentos/:id", opcoesAtualizar, async (request) => {
        const { versao, ...alteracoes } = request.body;
        exigirAlgumCampo(alteracoes);
        return departamentoService.atualizar(request.params.id, versao, alteracoes, request.user.id);
    });
}
