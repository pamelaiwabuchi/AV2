import type { FastifyInstance } from "fastify";
import * as organizacaoService from "../services/organizacaoService.js";
import { exigirPapel } from "../plugins/autenticacao.js";
import { esquemaId, textoObrigatorio } from "../utils/esquemas.js";
import type { AlteracoesOrganizacao, DadosOrganizacao } from "../repositories/organizacaoRepository.js";
import { exigirAlgumCampo } from "../utils/alteracoes.js";

interface ParametrosId {
    id: string;
}

interface ConsultaLista {
    pagina: number;
    busca: string;
}

interface CorpoAtualizar extends AlteracoesOrganizacao {
    versao: number;
}

const camposOrganizacao = {
    razaoSocial: textoObrigatorio,
    cnpj: textoObrigatorio,
    inscricaoEstadual: textoObrigatorio,
    enderecoCompleto: textoObrigatorio,
    telefone: textoObrigatorio,
    email: { type: "string", format: "email" },
};

const obrigatorios = ["razaoSocial", "cnpj", "inscricaoEstadual", "enderecoCompleto", "telefone", "email"];

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
        properties: camposOrganizacao,
    },
};

const esquemaAtualizar = {
    params: esquemaId,
    body: {
        type: "object",
        required: ["versao"],
        additionalProperties: false,
        properties: {
            ...camposOrganizacao,
            ativo: { type: "boolean" },
            versao: { type: "integer" },
        },
    },
};

const podeConsultar = exigirPapel("OPERADOR_CADASTRO", "AUDITOR");
const podeAlterar = exigirPapel("OPERADOR_CADASTRO");
const podeVerResumo = exigirPapel("GESTOR_ALMOXARIFADO", "OPERADOR_CADASTRO", "AUDITOR");

export async function organizacaoController(app: FastifyInstance) {
    const opcoesListar = { schema: esquemaListar, onRequest: podeConsultar };
    const opcoesBuscar = { schema: { params: esquemaId }, onRequest: podeConsultar };
    const opcoesCriar = { schema: esquemaCriar, onRequest: podeAlterar };
    const opcoesAtualizar = { schema: esquemaAtualizar, onRequest: podeAlterar };

    app.get<{ Querystring: ConsultaLista }>("/organizacoes", opcoesListar, async (request) => {
        return organizacaoService.listar(request.query.pagina, request.query.busca);
    });

    app.get("/organizacoes/resumo", { onRequest: podeVerResumo }, async () => {
        return organizacaoService.listarResumo();
    });

    app.get<{ Params: ParametrosId }>("/organizacoes/:id", opcoesBuscar, async (request) => {
        return organizacaoService.buscar(request.params.id);
    });

    app.post<{ Body: DadosOrganizacao }>("/organizacoes", opcoesCriar, async (request, reply) => {
        const organizacao = await organizacaoService.criar(request.body, request.user.id);
        return reply.status(201).send(organizacao);
    });

    app.patch<{ Params: ParametrosId; Body: CorpoAtualizar }>("/organizacoes/:id", opcoesAtualizar, async (request) => {
        const { versao, ...alteracoes } = request.body;
        exigirAlgumCampo(alteracoes);
        return organizacaoService.atualizar(request.params.id, versao, alteracoes, request.user.id);
    });
}
