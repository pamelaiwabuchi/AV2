import type { FastifyInstance } from "fastify";
import * as contratoService from "../services/contratoService.js";
import { exigirPapel } from "../plugins/autenticacao.js";
import { esquemaId } from "../utils/esquemas.js";
import type { DadosContrato, FiltrosContrato } from "../repositories/contratoRepository.js";
import { exigirAlgumCampo } from "../utils/alteracoes.js";

interface ConsultaLista extends FiltrosContrato {
    pagina: number;
}

const esquemaListar = {
    querystring: {
        type: "object",
        properties: {
            pagina: { type: "integer", minimum: 1, default: 1 },
            situacao: { type: "string", enum: ["FUTURO", "VIGENTE", "ENCERRADO"] },
            vencendoEmDias: { type: "integer", minimum: 0 },
            organizacaoId: { type: "string", format: "uuid" },
        },
    },
};

interface ParametrosId {
    id: string;
}

interface CorpoContrato {
    dataAssinatura: string;
    dataVencimento: string;
    clausulas: string[];
    valorMensal: number;
    renovacaoAutomatica: boolean;
}

interface CorpoCriar extends CorpoContrato {
    organizacaoId: string;
}

interface CorpoEditar extends Partial<CorpoContrato> {
    versao: number;
}

interface CorpoRenovar {
    novoVencimento: string;
    versao: number;
}

interface CorpoVersao {
    versao: number;
}

const camposContrato = {
    dataAssinatura: { type: "string", format: "date" },
    dataVencimento: { type: "string", format: "date" },
    clausulas: { type: "array", minItems: 1, items: { type: "string", minLength: 1 } },
    valorMensal: { type: "number" },
    renovacaoAutomatica: { type: "boolean" },
};

const obrigatorios = ["dataAssinatura", "dataVencimento", "clausulas", "valorMensal", "renovacaoAutomatica"];

const esquemaCriar = {
    body: {
        type: "object",
        required: [...obrigatorios, "organizacaoId"],
        additionalProperties: false,
        properties: { ...camposContrato, organizacaoId: { type: "string", format: "uuid" } },
    },
};

const esquemaEditar = {
    params: esquemaId,
    body: {
        type: "object",
        required: ["versao"],
        additionalProperties: false,
        properties: { ...camposContrato, versao: { type: "integer" } },
    },
};

const esquemaRenovar = {
    params: esquemaId,
    body: {
        type: "object",
        required: ["novoVencimento", "versao"],
        properties: {
            novoVencimento: { type: "string", format: "date" },
            versao: { type: "integer" },
        },
    },
};

const esquemaVersao = {
    params: esquemaId,
    body: {
        type: "object",
        required: ["versao"],
        properties: { versao: { type: "integer" } },
    },
};

function converterDatas(corpo: CorpoContrato) {
    return {
        dataAssinatura: new Date(corpo.dataAssinatura),
        dataVencimento: new Date(corpo.dataVencimento),
        clausulas: corpo.clausulas,
        valorMensal: corpo.valorMensal,
        renovacaoAutomatica: corpo.renovacaoAutomatica,
    };
}

function converterAlteracoes(corpo: CorpoEditar) {
    const { versao, dataAssinatura, dataVencimento, ...outrosCampos } = corpo;
    const alteracoes: Partial<DadosContrato> = { ...outrosCampos };

    if (dataAssinatura !== undefined) {
        alteracoes.dataAssinatura = new Date(dataAssinatura);
    }

    if (dataVencimento !== undefined) {
        alteracoes.dataVencimento = new Date(dataVencimento);
    }

    return alteracoes;
}

const podeConsultar = exigirPapel("OPERADOR_CADASTRO", "AUDITOR");
const podeAlterar = exigirPapel("OPERADOR_CADASTRO");

export async function contratoController(app: FastifyInstance) {
    const opcoesBuscar = { schema: { params: esquemaId }, onRequest: podeConsultar };
    const opcoesCriar = { schema: esquemaCriar, onRequest: podeAlterar };
    const opcoesEditar = { schema: esquemaEditar, onRequest: podeAlterar };
    const opcoesRenovar = { schema: esquemaRenovar, onRequest: podeAlterar };
    const opcoesEncerrar = { schema: esquemaVersao, onRequest: podeAlterar };
    const opcoesApagar = { schema: { params: esquemaId }, onRequest: podeAlterar };

    app.get<{ Querystring: ConsultaLista }>("/contratos", { schema: esquemaListar, onRequest: podeConsultar }, async (request) => {
        const { pagina, ...filtros } = request.query;
        return contratoService.listar(pagina, filtros);
    });

    app.get<{ Params: ParametrosId }>("/organizacoes/:id/contratos", opcoesBuscar, async (request) => {
        return contratoService.listarDaOrganizacao(request.params.id);
    });

    app.get<{ Params: ParametrosId }>("/contratos/:id", opcoesBuscar, async (request) => {
        return contratoService.buscar(request.params.id);
    });

    app.post<{ Body: CorpoCriar }>("/contratos", opcoesCriar, async (request, reply) => {
        const contrato = await contratoService.criar(request.body.organizacaoId, converterDatas(request.body), request.user.id);
        return reply.status(201).send(contrato);
    });

    app.patch<{ Params: ParametrosId; Body: CorpoEditar }>("/contratos/:id", opcoesEditar, async (request) => {
        const alteracoes = converterAlteracoes(request.body);
        exigirAlgumCampo(alteracoes);

        return contratoService.editar(request.params.id, request.body.versao, alteracoes, request.user.id);
    });

    app.patch<{ Params: ParametrosId; Body: CorpoRenovar }>("/contratos/:id/renovar", opcoesRenovar, async (request) => {
        const novoVencimento = new Date(request.body.novoVencimento);
        return contratoService.renovar(request.params.id, request.body.versao, novoVencimento, request.user.id);
    });

    app.patch<{ Params: ParametrosId; Body: CorpoVersao }>("/contratos/:id/encerrar", opcoesEncerrar, async (request) => {
        return contratoService.encerrar(request.params.id, request.body.versao, request.user.id);
    });

    app.delete<{ Params: ParametrosId }>("/contratos/:id", opcoesApagar, async (request, reply) => {
        await contratoService.apagar(request.params.id, request.user.id);
        return reply.status(204).send();
    });
}
