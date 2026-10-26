import type { FastifyInstance } from "fastify";
import { exigirPapel } from "../plugins/autenticacao.js";
import { ErroConflito } from "../errors/erros.js";
import { executarTransacao } from "../lib/transacao.js";
import { filtroDePeriodo } from "../utils/datas.js";
import * as auditoriaRepository from "../repositories/auditoriaRepository.js";
import * as parametrosRepository from "../repositories/parametrosRepository.js";
import * as usuarioService from "../services/usuarioService.js";
import type { FiltrosAuditoria } from "../repositories/auditoriaRepository.js";
import type { DadosParametros } from "../repositories/parametrosRepository.js";
import { exigirAlgumCampo } from "../utils/alteracoes.js";

interface ConsultaAuditoria extends FiltrosAuditoria {
    pagina: number;
    usuarioLogin?: string;
    inicio?: string;
    fim?: string;
}

interface CorpoParametros extends Partial<DadosParametros> {
    versao: number;
}

const percentual = { type: "number", minimum: 0, maximum: 100 };

const esquemaAuditoria = {
    querystring: {
        type: "object",
        properties: {
            pagina: { type: "integer", minimum: 1, default: 1 },
            tabela: { type: "string" },
            registroId: { type: "string", format: "uuid" },
            usuarioId: { type: "string", format: "uuid" },
            usuarioLogin: { type: "string" },
            inicio: { type: "string", format: "date" },
            fim: { type: "string", format: "date" },
        },
    },
};

const esquemaParametros = {
    body: {
        type: "object",
        required: ["versao"],
        additionalProperties: false,
        properties: {
            aliquotaImposto: percentual,
            depreciacaoComputadorMesa: percentual,
            depreciacaoNotebook: percentual,
            depreciacaoMonitor: percentual,
            depreciacaoImpressora: percentual,
            depreciacaoServidor: percentual,
            depreciacaoRoteador: percentual,
            depreciacaoCaboEstruturado: percentual,
            depreciacaoFonteAlimentacao: percentual,
            diasLoteParado: { type: "integer", minimum: 1 },
            versao: { type: "integer" },
        },
    },
};

const podeConsultar = exigirPapel("AUDITOR");
const somenteAdmin = exigirPapel();

export async function auditoriaController(app: FastifyInstance) {
    const opcoesAuditoria = { schema: esquemaAuditoria, onRequest: podeConsultar };
    const opcoesParametros = { schema: esquemaParametros, onRequest: somenteAdmin };

    app.get<{ Querystring: ConsultaAuditoria }>("/auditoria", opcoesAuditoria, async (request) => {
        const { pagina, inicio, fim, usuarioLogin, ...filtros } = request.query;

        // A Auditoria guarda só o id de quem alterou; o login é trocado pelo id aqui.
        if (usuarioLogin) {
            const usuario = await usuarioService.buscarPorLogin(usuarioLogin);
            filtros.usuarioId = usuario.id;
        }

        return auditoriaRepository.listarAuditoria(pagina, { ...filtros, dataHora: filtroDePeriodo(inicio, fim) });
    });

    app.get("/parametros", { onRequest: podeConsultar }, async () => {
        return parametrosRepository.buscarParametros();
    });

    app.patch<{ Body: CorpoParametros }>("/parametros", opcoesParametros, async (request) => {
        const { versao, ...dados } = request.body;
        exigirAlgumCampo(dados);
        const atual = await parametrosRepository.buscarParametros();

        const atualizou = await executarTransacao(request.user.id, async (tx) => {
            return parametrosRepository.atualizarParametros(tx, atual.id, versao, dados);
        });

        if (!atualizou) {
            throw new ErroConflito("Os parâmetros foram alterados por outra pessoa. Recarregue e tente de novo");
        }

        return parametrosRepository.buscarParametros();
    });
}
