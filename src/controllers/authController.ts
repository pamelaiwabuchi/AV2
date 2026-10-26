import type { FastifyInstance } from "fastify";
import * as authService from "../services/authService.js";
import { verificarToken } from "../plugins/autenticacao.js";
import { textoObrigatorio } from "../utils/esquemas.js";

interface CorpoLogin {
    login: string;
    senha: string;
}

interface CorpoTrocarSenha {
    senhaAtual: string;
    novaSenha: string;
}

const esquemaLogin = {
    body: {
        type: "object",
        required: ["login", "senha"],
        properties: {
            login: textoObrigatorio,
            senha: textoObrigatorio,
        },
    },
};

const esquemaTrocarSenha = {
    body: {
        type: "object",
        required: ["senhaAtual", "novaSenha"],
        properties: {
            senhaAtual: textoObrigatorio,
            novaSenha: textoObrigatorio,
        },
    },
};

export async function authController(app: FastifyInstance) {
    app.post<{ Body: CorpoLogin }>("/auth/login", { schema: esquemaLogin }, async (request, reply) => {
        const dados = await authService.login(request.body.login, request.body.senha);
        const token = await reply.jwtSign(dados);

        return { token, precisaTrocarSenha: dados.precisaTrocarSenha };
    });

    const opcoesTrocarSenha = { schema: esquemaTrocarSenha, onRequest: verificarToken };

    app.patch<{ Body: CorpoTrocarSenha }>("/auth/senha", opcoesTrocarSenha, async (request, reply) => {
        const { senhaAtual, novaSenha } = request.body;
        const dados = await authService.trocarSenha(request.user.id, senhaAtual, novaSenha);
        const token = await reply.jwtSign(dados);

        return { token };
    });

    app.get("/auth/perfil", { onRequest: verificarToken }, async (request) => {
        return authService.buscarPerfil(request.user.id);
    });
}
