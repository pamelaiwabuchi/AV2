import type { FastifyInstance } from "fastify";
import { PapelUsuario } from "../generated/prisma/enums.js";
import * as usuarioService from "../services/usuarioService.js";
import { exigirPapel } from "../plugins/autenticacao.js";
import { esquemaId, esquemaPagina, textoObrigatorio } from "../utils/esquemas.js";
import type { PedidoAlteracaoUsuario } from "../services/usuarioService.js";
import { exigirAlgumCampo } from "../utils/alteracoes.js";

interface ParametrosId {
    id: string;
}

interface ConsultaLista {
    pagina: number;
}

interface CorpoCriar {
    nome: string;
    login: string;
    senha: string;
    papel: string;
}

interface CorpoAtualizar extends PedidoAlteracaoUsuario {
    versao: number;
}

interface CorpoSenha {
    novaSenha: string;
}

const somenteAdmin = exigirPapel();

const esquemaCriar = {
    body: {
        type: "object",
        required: ["nome", "login", "senha", "papel"],
        properties: {
            nome: textoObrigatorio,
            login: textoObrigatorio,
            senha: textoObrigatorio,
            papel: { type: "string", enum: Object.values(PapelUsuario) },
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
    const opcoesListar = { schema: { querystring: esquemaPagina }, onRequest: somenteAdmin };
    const opcoesBuscar = { schema: { params: esquemaId }, onRequest: somenteAdmin };
    const opcoesCriar = { schema: esquemaCriar, onRequest: somenteAdmin };
    const opcoesAtualizar = { schema: esquemaAtualizar, onRequest: somenteAdmin };
    const opcoesSenha = { schema: esquemaSenha, onRequest: somenteAdmin };

    app.get<{ Querystring: ConsultaLista }>("/usuarios", opcoesListar, async (request) => {
        return usuarioService.listar(request.query.pagina);
    });

    app.get<{ Params: ParametrosId }>("/usuarios/:id", opcoesBuscar, async (request) => {
        return usuarioService.buscar(request.params.id);
    });

    app.post<{ Body: CorpoCriar }>("/usuarios", opcoesCriar, async (request, reply) => {
        const { nome, login, senha, papel } = request.body;
        const usuario = await usuarioService.criar(nome, login, senha, papel, request.user.id);

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
