import type { FastifyInstance } from "fastify";
import * as equipamentoService from "../services/equipamentoService.js";
import { exigirPapel } from "../plugins/autenticacao.js";
import { esquemaId, textoObrigatorio } from "../utils/esquemas.js";
import { EstadoFisico, StatusRastreamento, TipoEquipamento } from "../generated/prisma/enums.js";
import type { DadosEquipamento, FiltrosEquipamento } from "../repositories/equipamentoRepository.js";
import type { Prisma } from "../generated/prisma/client.js";
import { exigirAlgumCampo } from "../utils/alteracoes.js";
import { filtroDeAno } from "../utils/datas.js";
import { contemTexto, filtroDeEmpresa } from "../utils/filtros.js";

interface ParametrosId {
    id: string;
}

interface ParametrosCodigo {
    codigo: string;
}

interface ConsultaLista {
    pagina: number;
    status?: StatusRastreamento;
    tipo?: TipoEquipamento;
    loteId?: string;
    codigo?: string;
    marca?: string;
    modelo?: string;
    anoFabricacao?: number;
    estadoFisico?: EstadoFisico;
    destinoId?: string;
    destinoNome?: string;
    destinoCnpj?: string;
    organizacaoId?: string;
    organizacaoNome?: string;
    organizacaoCnpj?: string;
    anoEntrada?: number;
}

interface CorpoEditar extends Partial<DadosEquipamento> {
    versao: number;
}

interface CorpoAvaliar {
    estadoFisico: EstadoFisico;
    justificativa?: string;
    versao: number;
}

interface CorpoMovimentar {
    novoStatus: StatusRastreamento;
    destinoId?: string;
    observacao?: string;
    versao: number;
}

interface CorpoCorrigir {
    movimentacaoId: string;
    justificativa: string;
    versao: number;
}

interface CorpoMovimentarVarios {
    codigos: string[];
    novoStatus: StatusRastreamento;
    destinoId?: string;
    observacao?: string;
}

export const camposEquipamento = {
    tipo: { type: "string", enum: Object.values(TipoEquipamento) },
    marca: textoObrigatorio,
    modelo: textoObrigatorio,
    anoFabricacao: { type: "integer", minimum: 1950 },
    pesoQuilogramas: { type: "number", exclusiveMinimum: 0 },
};

export const camposEquipamentoNovo = {
    ...camposEquipamento,
    estadoFisico: { type: "string", enum: Object.values(EstadoFisico) },
};

export const obrigatoriosEquipamentoNovo = [
    "tipo", "marca", "modelo", "anoFabricacao", "estadoFisico", "pesoQuilogramas",
];

const statusRastreamento = { type: "string", enum: Object.values(StatusRastreamento) };

const esquemaListar = {
    querystring: {
        type: "object",
        properties: {
            pagina: { type: "integer", minimum: 1, default: 1 },
            status: statusRastreamento,
            tipo: { type: "string", enum: Object.values(TipoEquipamento) },
            loteId: { type: "string", format: "uuid" },
            codigo: { type: "string" },
            marca: { type: "string" },
            modelo: { type: "string" },
            anoFabricacao: { type: "integer" },
            estadoFisico: { type: "string", enum: Object.values(EstadoFisico) },
            destinoId: { type: "string", format: "uuid" },
            destinoNome: { type: "string" },
            destinoCnpj: { type: "string" },
            organizacaoId: { type: "string", format: "uuid" },
            organizacaoNome: { type: "string" },
            organizacaoCnpj: { type: "string" },
            anoEntrada: { type: "integer" },
        },
    },
};

const esquemaEditar = {
    params: esquemaId,
    body: {
        type: "object",
        required: ["versao"],
        additionalProperties: false,
        properties: { ...camposEquipamento, versao: { type: "integer" } },
    },
};

const esquemaAvaliar = {
    params: esquemaId,
    body: {
        type: "object",
        required: ["estadoFisico", "versao"],
        properties: {
            estadoFisico: { type: "string", enum: Object.values(EstadoFisico) },
            justificativa: textoObrigatorio,
            versao: { type: "integer" },
        },
    },
};

const camposMovimentacao = {
    novoStatus: statusRastreamento,
    destinoId: { type: "string", format: "uuid" },
    observacao: textoObrigatorio,
};

const esquemaMovimentar = {
    params: esquemaId,
    body: {
        type: "object",
        required: ["novoStatus", "versao"],
        properties: { ...camposMovimentacao, versao: { type: "integer" } },
    },
};

const esquemaCorrigir = {
    params: esquemaId,
    body: {
        type: "object",
        required: ["movimentacaoId", "justificativa", "versao"],
        properties: {
            movimentacaoId: { type: "string", format: "uuid" },
            justificativa: textoObrigatorio,
            versao: { type: "integer" },
        },
    },
};

const esquemaMovimentarPorCodigo = {
    params: {
        type: "object",
        required: ["codigo"],
        properties: { codigo: textoObrigatorio },
    },
    body: esquemaMovimentar.body,
};

const esquemaMovimentarVarios = {
    body: {
        type: "object",
        required: ["codigos", "novoStatus"],
        properties: {
            ...camposMovimentacao,
            codigos: { type: "array", minItems: 1, uniqueItems: true, items: textoObrigatorio },
        },
    },
};

const podeConsultar = exigirPapel("GESTOR_ALMOXARIFADO", "OPERADOR_CADASTRO", "AUDITOR");
const podeVerHistorico = exigirPapel("GESTOR_ALMOXARIFADO", "AUDITOR");
const podeAlterar = exigirPapel("GESTOR_ALMOXARIFADO");

function montarFiltros(consulta: ConsultaLista) {
    const filtros: FiltrosEquipamento = {};

    if (consulta.status) {
        filtros.statusRastreamento = consulta.status;
    }

    if (consulta.tipo) {
        filtros.tipo = consulta.tipo;
    }

    if (consulta.loteId) {
        filtros.loteId = consulta.loteId;
    }

    if (consulta.codigo) {
        filtros.codigoBarrasInterno = contemTexto(consulta.codigo);
    }

    if (consulta.marca) {
        filtros.marca = contemTexto(consulta.marca);
    }

    if (consulta.modelo) {
        filtros.modelo = contemTexto(consulta.modelo);
    }

    if (consulta.anoFabricacao !== undefined) {
        filtros.anoFabricacao = consulta.anoFabricacao;
    }

    if (consulta.estadoFisico) {
        filtros.estadoFisico = consulta.estadoFisico;
    }

    if (consulta.destinoId) {
        filtros.destinoId = consulta.destinoId;
    }

    const destino = filtroDeEmpresa(consulta.destinoNome, consulta.destinoCnpj);

    if (destino) {
        filtros.destino = destino;
    }

    filtros.lote = montarFiltroDoLote(consulta);
    return filtros;
}

// Organização e ano de entrada ficam no lote do equipamento.
function montarFiltroDoLote(consulta: ConsultaLista) {
    const filtroLote: Prisma.LoteWhereInput = {};

    if (consulta.organizacaoId) {
        filtroLote.organizacaoId = consulta.organizacaoId;
    }

    const organizacao = filtroDeEmpresa(consulta.organizacaoNome, consulta.organizacaoCnpj);

    if (organizacao) {
        filtroLote.organizacao = organizacao;
    }

    if (consulta.anoEntrada !== undefined) {
        filtroLote.dataEntrada = filtroDeAno(consulta.anoEntrada);
    }

    return filtroLote;
}

export async function equipamentoController(app: FastifyInstance) {
    const opcoesListar = { schema: esquemaListar, onRequest: podeConsultar };
    const opcoesBuscar = { schema: { params: esquemaId }, onRequest: podeConsultar };
    const opcoesHistorico = { schema: { params: esquemaId }, onRequest: podeVerHistorico };
    const opcoesEditar = { schema: esquemaEditar, onRequest: podeAlterar };
    const opcoesAvaliar = { schema: esquemaAvaliar, onRequest: podeAlterar };
    const opcoesMovimentar = { schema: esquemaMovimentar, onRequest: podeAlterar };
    const opcoesMovimentarPorCodigo = { schema: esquemaMovimentarPorCodigo, onRequest: podeAlterar };
    const opcoesCorrigir = { schema: esquemaCorrigir, onRequest: podeAlterar };
    const opcoesMovimentarVarios = { schema: esquemaMovimentarVarios, onRequest: podeAlterar };

    app.get<{ Querystring: ConsultaLista }>("/equipamentos", opcoesListar, async (request) => {
        return equipamentoService.listar(request.query.pagina, montarFiltros(request.query));
    });

    app.get<{ Params: ParametrosCodigo }>("/equipamentos/codigo/:codigo", { onRequest: podeConsultar }, async (request) => {
        return equipamentoService.buscarPorCodigo(request.params.codigo);
    });

    app.get<{ Params: ParametrosId }>("/equipamentos/:id", opcoesBuscar, async (request) => {
        return equipamentoService.buscar(request.params.id);
    });

    app.get<{ Params: ParametrosId }>("/equipamentos/:id/historico", opcoesHistorico, async (request) => {
        return equipamentoService.historico(request.params.id);
    });

    app.patch<{ Params: ParametrosId; Body: CorpoEditar }>("/equipamentos/:id", opcoesEditar, async (request) => {
        const { versao, ...dados } = request.body;
        exigirAlgumCampo(dados);
        return equipamentoService.editar(request.params.id, versao, dados, request.user.id);
    });

    app.patch<{ Params: ParametrosId; Body: CorpoAvaliar }>("/equipamentos/:id/avaliacao", opcoesAvaliar, async (request) => {
        const { estadoFisico, justificativa, versao } = request.body;
        return equipamentoService.avaliar(request.params.id, versao, estadoFisico, justificativa ?? null, request.user.id);
    });

    app.post<{ Params: ParametrosId; Body: CorpoMovimentar }>("/equipamentos/:id/movimentar", opcoesMovimentar, async (request) => {
        const { novoStatus, destinoId, observacao, versao } = request.body;
        const pedido = { novoStatus, destinoId: destinoId ?? null, observacao: observacao ?? null, idUsuario: request.user.id };

        return equipamentoService.movimentar(request.params.id, versao, pedido);
    });

    app.post<{ Params: ParametrosId; Body: CorpoCorrigir }>("/equipamentos/:id/corrigir", opcoesCorrigir, async (request) => {
        const { movimentacaoId, justificativa, versao } = request.body;
        const pedido = { movimentacaoId, justificativa, idUsuario: request.user.id };

        return equipamentoService.corrigir(request.params.id, versao, pedido);
    });

    app.post<{ Params: ParametrosCodigo; Body: CorpoMovimentar }>("/equipamentos/codigo/:codigo/movimentar", opcoesMovimentarPorCodigo, async (request) => {
        const { novoStatus, destinoId, observacao, versao } = request.body;
        const pedido = { novoStatus, destinoId: destinoId ?? null, observacao: observacao ?? null, idUsuario: request.user.id };

        return equipamentoService.movimentarPorCodigo(request.params.codigo, versao, pedido);
    });

    app.post<{ Body: CorpoMovimentarVarios }>("/equipamentos/movimentar-varios", opcoesMovimentarVarios, async (request) => {
        const { codigos, novoStatus, destinoId, observacao } = request.body;
        const pedido = { novoStatus, destinoId: destinoId ?? null, observacao: observacao ?? null, idUsuario: request.user.id };

        return equipamentoService.movimentarVariosPorCodigo(codigos, pedido);
    });
}
