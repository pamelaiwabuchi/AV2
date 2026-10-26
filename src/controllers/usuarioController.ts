import type { FastifyInstance } from "fastify";
import { PapelUsuario } from "../generated/prisma/enums.js";
import * as usuarioService from "../services/usuarioService.js";
import { exigirPapel } from "../plugins/autenticacao.js";
import { esquemaId, textoObrigatorio } from "../utils/esquemas.js";
import type { PedidoAlteracaoUsuario, PedidoNovoUsuario } from "../services/usuarioService.js";
import type { FiltrosUsuario } from "../repositories/usuarioRepository.js";
import { exigirAlgumCampo } from "../utils/alteracoes.js";

interface ParametrosId {
    id: string;
}

interface ConsultaLista extends FiltrosUsuario {
    pagina: number;
}

const esquemaListar = {
    querystring: {
        type: "object",
        properties: {
            pagina: { type: "integer", minimum: 1, default: 1 },
            busca: { type: "string" },
            papel: { type: "string", enum: Object.values(PapelUsuario) },
            ativo: { type: "boolean" },
            bloqueado: { type: "boolean" },
            departamentoId: { type: "string", format: "uuid" },
            departamento: { type: "string" },
        },
    },
};

interface ParametrosLogin {
    login: string;
}

interface CorpoAtualizar extends PedidoAlteracaoUsuario {
    versao: number;
}

interface CorpoSenha {
    novaSenha: string;
}

const somenteAdmin = exigirPapel();

const esquemaLogin = {
    params: {
        type: "object",
        required: ["login"],
        properties: {
            login: textoObrigatorio,
        },
    },
};

const esquemaCriar = {
    body: {
        type: "object",
        required: ["nome", "login", "senha", "papel", "departamentoId"],
        properties: {
            nome: textoObrigatorio,
            login: textoObrigatorio,
            senha: textoObrigatorio,
            papel: { type: "string", enum: Object.values(PapelUsuario) },
            departamentoId: { type: "string", format: "uuid" },
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
            papel: { type: "string", enum: Object.values(PapelUsuario) },
            ativo: { type: "boolean" },
            departamentoId: { type: "string", format: "uuid" },
            versao: { type: "integer" },
        },
    },
};

const esquemaSenha = {
    params: esquemaId,
    body: {
        type: "object",
        required: ["novaSenha"],
        properties: {
            novaSenha: textoObrigatorio,
        },
    },
};

export async function usuarioController(app: FastifyInstance) {
    const opcoesListar = { schema: esquemaListar, onRequest: somenteAdmin };
    const opcoesBuscar = { schema: { params: esquemaId }, onRequest: somenteAdmin };
    const opcoesBuscarLogin = { schema: esquemaLogin, onRequest: somenteAdmin };
    const opcoesCriar = { schema: esquemaCriar, onRequest: somenteAdmin };
    const opcoesAtualizar = { schema: esquemaAtualizar, onRequest: somenteAdmin };
    const opcoesSenha = { schema: esquemaSenha, onRequest: somenteAdmin };

    app.get<{ Querystring: ConsultaLista }>("/usuarios", opcoesListar, async (request) => {
        const { pagina, ...filtros } = request.query;
        return usuarioService.listar(pagina, filtros);
    });

    app.get<{ Params: ParametrosId }>("/usuarios/:id", opcoesBuscar, async (request) => {
        return usuarioService.buscar(request.params.id);
    });

    app.get<{ Params: ParametrosLogin }>("/usuarios/login/:login", opcoesBuscarLogin, async (request) => {
        return usuarioService.buscarPorLogin(request.params.login);
    });

    app.post<{ Body: PedidoNovoUsuario }>("/usuarios", opcoesCriar, async (request, reply) => {
        const usuario = await usuarioService.criar(request.body, request.user.id);

        return reply.status(201).send(usuario);
    });

    app.patch<{ Params: ParametrosId; Body: CorpoAtualizar }>("/usuarios/:id", opcoesAtualizar, async (request) => {
        const { versao, ...pedido } = request.body;
        exigirAlgumCampo(pedido);
        return usuarioService.atualizar(request.params.id, request.user.id, versao, pedido);
    });

    app.patch<{ Params: ParametrosId; Body: CorpoSenha }>("/usuarios/:id/senha", opcoesSenha, async (request, reply) => {
        await usuarioService.redefinirSenha(request.params.id, request.body.novaSenha, request.user.id);
        return reply.status(204).send();
    });
}
