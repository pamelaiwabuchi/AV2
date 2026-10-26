import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import type { FastifyInstance, RouteOptions } from "fastify";
import { exemplos, grupoDaRota, grupos, resumos } from "./descricaoRotas.js";

function descreverRota(rota: RouteOptions) {
    if (rota.url.startsWith("/docs")) {
        return;
    }

    const chave = `${rota.method} ${rota.url}`;
    const schema = { ...rota.schema, tags: [grupoDaRota(rota.url)] };
    const resumo = resumos[chave];
    const exemplo = exemplos[chave];

    if (resumo) {
        schema.summary = resumo;
    }

    if (exemplo && schema.body) {
        schema.body = { ...(schema.body as object), examples: [exemplo] };
    }

    rota.schema = schema;
}

export function registrarDocumentacao(app: FastifyInstance) {
    app.addHook("onRoute", descreverRota);

    app.register(fastifySwagger, {
        openapi: {
            info: {
                title: "AV2 - GreenCode",
                description: "API de logística reversa de equipamentos eletrônicos. Como começar: 1) faça login em POST /auth/login; 2) copie o token e clique em Authorize; 3) no primeiro acesso, troque a senha provisória em PATCH /auth/senha; 4) clique em Authorize de novo, faça Logout e cole o token novo que veio na resposta. Para editar (PATCH), consulte o registro antes: a resposta traz o campo versao, que precisa ir junto na edição.",
                version: "1.0.0",
            },
            tags: grupos,
            components: {
                securitySchemes: {
                    token: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
                },
            },
            security: [{ token: [] }],
        },
    });

    app.register(fastifySwaggerUi, {
        routePrefix: "/docs",
        uiConfig: { persistAuthorization: true },
        theme: { title: "AV2-GreenCode" },
    });

}
