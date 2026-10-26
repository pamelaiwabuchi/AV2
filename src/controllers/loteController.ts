import type { FastifyInstance } from "fastify";
import * as loteService from "../services/loteService.js";
import { exigirPapel } from "../plugins/autenticacao.js";
import { esquemaId, textoObrigatorio } from "../utils/esquemas.js";
import { StatusLote } from "../generated/prisma/enums.js";
import { camposEquipamentoNovo, obrigatoriosEquipamentoNovo } from "./equipamentoController.js";
import type { DadosEquipamentoNovo } from "../repositories/equipamentoRepository.js";
import type { DadosEdicaoLote, FiltrosLote } from "../repositories/loteRepository.js";
import { exigirAlgumCampo } from "../utils/alteracoes.js";
import { filtroDeAno } from "../utils/datas.js";
import { contemTexto, filtroDeEmpresa } from "../utils/filtros.js";

interface ParametrosId {
    id: string;
}

interface ConsultaLista {
    pagina: number;
    status?: StatusLote;
    organizacaoId?: string;
    organizacaoNome?: string;
    organizacaoCnpj?: string;
    notaFiscal?: string;
    transportadora?: string;
    anoEntrada?: number;
}

interface CorpoCriar {
    organizacaoId: string;
    dataEntrada: string;
    notaFiscal: string;
    transportadora: string;
    observacoes?: string;
    equipamentos: DadosEquipamentoNovo[];
}

interface CorpoEditar extends Partial<DadosEdicaoLote> {
    versao: number;
}

interface CorpoVersao {
    versao: number;
}

const esquemaEquipamentoNovo = {
    type: "object",
    required: obrigatoriosEquipamentoNovo,
    additionalProperties: false,
    properties: camposEquipamentoNovo,
};

const esquemaListar = {
    querystring: {
        type: "object",
        properties: {
            pagina: { type: "integer", minimum: 1, default: 1 },
            status: { type: "string", enum: Object.values(StatusLote) },
            organizacaoId: { type: "string", format: "uuid" },
            organizacaoNome: { type: "string" },
            organizacaoCnpj: { type: "string" },
            notaFiscal: { type: "string" },
            transportadora: { type: "string" },
            anoEntrada: { type: "integer" },
        },
    },
};

const esquemaCriar = {
    body: {
        type: "object",
        required: ["organizacaoId", "dataEntrada", "notaFiscal", "transportadora", "equipamentos"],
        additionalProperties: false,
        properties: {
            organizacaoId: { type: "string", format: "uuid" },
            dataEntrada: { type: "string", format: "date" },
            notaFiscal: textoObrigatorio,
            transportadora: textoObrigatorio,
            observacoes: textoObrigatorio,
            equipamentos: { type: "array", minItems: 1, items: esquemaEquipamentoNovo },
        },
    },
};

const esquemaEditar = {
    params: esquemaId,
    body: {
        type: "object",
        required: ["versao"],
        additionalProperties: false,
        properties: {
            notaFiscal: textoObrigatorio,
            transportadora: textoObrigatorio,
            observacoes: { ...textoObrigatorio, nullable: true },
            versao: { type: "integer" },
        },
    },
};

const esquemaCancelar = {
    params: esquemaId,
    body: {
        type: "object",
        required: ["versao"],
        properties: { versao: { type: "integer" } },
    },
};

const esquemaAdicionar = {
    params: esquemaId,
    body: esquemaEquipamentoNovo,
};

const podeConsultar = exigirPapel("GESTOR_ALMOXARIFADO", "OPERADOR_CADASTRO", "AUDITOR");
const podeAlterar = exigirPapel("GESTOR_ALMOXARIFADO");

function montarFiltros(consulta: ConsultaLista) {
    const filtros: FiltrosLote = {};

    if (consulta.status) {
        filtros.statusProcessamento = consulta.status;
    }

    if (consulta.organizacaoId) {
        filtros.organizacaoId = consulta.organizacaoId;
    }

    const organizacao = filtroDeEmpresa(consulta.organizacaoNome, consulta.organizacaoCnpj);

    if (organizacao) {
        filtros.organizacao = organizacao;
    }

    if (consulta.notaFiscal) {
        filtros.notaFiscal = contemTexto(consulta.notaFiscal);
    }

    if (consulta.transportadora) {
        filtros.transportadora = contemTexto(consulta.transportadora);
    }

    if (consulta.anoEntrada !== undefined) {
        filtros.dataEntrada = filtroDeAno(consulta.anoEntrada);
    }

    return filtros;
}

export async function loteController(app: FastifyInstance) {
    const opcoesListar = { schema: esquemaListar, onRequest: podeConsultar };
    const opcoesBuscar = { schema: { params: esquemaId }, onRequest: podeConsultar };
    const opcoesCriar = { schema: esquemaCriar, onRequest: podeAlterar };
    const opcoesEditar = { schema: esquemaEditar, onRequest: podeAlterar };
    const opcoesCancelar = { schema: esquemaCancelar, onRequest: podeAlterar };
    const opcoesAdicionar = { schema: esquemaAdicionar, onRequest: podeAlterar };

    app.get<{ Querystring: ConsultaLista }>("/lotes", opcoesListar, async (request) => {
        return loteService.listar(request.query.pagina, montarFiltros(request.query));
    });

    app.get("/lotes/parados", { onRequest: podeConsultar }, async () => {
        return loteService.listarParados();
    });

    app.get<{ Params: ParametrosId }>("/lotes/:id", opcoesBuscar, async (request) => {
        return loteService.buscar(request.params.id);
    });

    app.post<{ Body: CorpoCriar }>("/lotes", opcoesCriar, async (request, reply) => {
        const { equipamentos, dataEntrada, observacoes, ...resto } = request.body;
        const dados = { ...resto, dataEntrada: new Date(dataEntrada), observacoes: observacoes ?? null };

        const lote = await loteService.criar(dados, equipamentos, request.user.id);
        return reply.status(201).send(lote);
    });

    app.patch<{ Params: ParametrosId; Body: CorpoEditar }>("/lotes/:id", opcoesEditar, async (request) => {
        const { versao, ...dados } = request.body;
        exigirAlgumCampo(dados);
        return loteService.editar(request.params.id, versao, dados, request.user.id);
    });

    app.patch<{ Params: ParametrosId; Body: CorpoVersao }>("/lotes/:id/cancelar", opcoesCancelar, async (request) => {
        return loteService.cancelar(request.params.id, request.body.versao, request.user.id);
    });

    app.post<{ Params: ParametrosId; Body: DadosEquipamentoNovo }>("/lotes/:id/equipamentos", opcoesAdicionar, async (request, reply) => {
        const lote = await loteService.adicionarEquipamento(request.params.id, request.body, request.user.id);
        return reply.status(201).send(lote);
    });
}
