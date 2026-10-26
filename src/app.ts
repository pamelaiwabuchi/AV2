import Fastify from "fastify";
import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { Prisma } from "./generated/prisma/client.js";
import { ErroApp } from "./errors/erros.js";
import { mensagemEmPortugues } from "./errors/traducaoErros.js";
import { registrarJwt } from "./plugins/autenticacao.js";
import { registrarDocumentacao } from "./plugins/documentacao.js";
import { authController } from "./controllers/authController.js";
import { usuarioController } from "./controllers/usuarioController.js";
import { organizacaoController } from "./controllers/organizacaoController.js";
import { contratoController } from "./controllers/contratoController.js";
import { destinoController } from "./controllers/destinoController.js";
import { loteController } from "./controllers/loteController.js";
import { equipamentoController } from "./controllers/equipamentoController.js";
import { movimentacaoController } from "./controllers/movimentacaoController.js";
import { auditoriaController } from "./controllers/auditoriaController.js";
import { relatorioController } from "./controllers/relatorioController.js";

function tratarErro(erro: FastifyError, request: FastifyRequest, reply: FastifyReply) {
    if (erro instanceof ErroApp) {
        return reply.status(erro.statusCode).send({ erro: erro.message });
    }

    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") {
        return reply.status(409).send({ erro: "Já existe um registro com esse valor, que precisa ser único" });
    }

    if (erro.statusCode !== undefined && erro.statusCode < 500) {
        return reply.status(erro.statusCode).send({ erro: mensagemEmPortugues(erro) });
    }

    request.log.error(erro);
    return reply.status(500).send({ erro: "Erro interno do servidor" });
}

export function criarApp() {
    const app = Fastify({ logger: true });

    app.setErrorHandler(tratarErro);
    registrarJwt(app);
    registrarDocumentacao(app);

    app.register(async (sistema) => {
        sistema.get("/health", async () => {
            return { status: "ok" };
        });
    });

    app.register(authController);
    app.register(usuarioController);
    app.register(organizacaoController);
    app.register(contratoController);
    app.register(destinoController);
    app.register(loteController);
    app.register(equipamentoController);
    app.register(movimentacaoController);
    app.register(auditoriaController);
    app.register(relatorioController);

    return app;
}
