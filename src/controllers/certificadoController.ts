import type { FastifyInstance, FastifyReply } from "fastify";
import * as certificadoService from "../services/certificadoService.js";
import { exigirPapel } from "../plugins/autenticacao.js";
import { esquemaIdComExemplo, ID_LOTE_EXEMPLO, ID_ORGANIZACAO_EXEMPLO } from "../utils/esquemas.js";

interface ParametrosId {
    id: string;
}

interface ConsultaPeriodo {
    inicio: string;
    fim: string;
}

const anoAtual = new Date().getFullYear();

const esquemaPeriodo = {
    params: esquemaIdComExemplo(ID_ORGANIZACAO_EXEMPLO),
    querystring: {
        type: "object",
        required: ["inicio", "fim"],
        properties: {
            inicio: { type: "string", format: "date", examples: [`${anoAtual}-01-01`] },
            fim: { type: "string", format: "date", examples: [`${anoAtual}-12-31`] },
        },
    },
};

const podeEmitir = exigirPapel("GESTOR_ALMOXARIFADO", "OPERADOR_CADASTRO", "AUDITOR");

function enviarPdf(reply: FastifyReply, certificado: { numero: string; pdf: Buffer }) {
    return reply
        .type("application/pdf")
        .header("Content-Disposition", `attachment; filename="${certificado.numero}.pdf"`)
        .send(certificado.pdf);
}

export async function certificadoController(app: FastifyInstance) {
    app.get<{ Params: ParametrosId }>("/lotes/:id/certificado", { schema: { params: esquemaIdComExemplo(ID_LOTE_EXEMPLO) }, onRequest: podeEmitir }, async (request, reply) => {
        const certificado = await certificadoService.certificadoDoLote(request.params.id, request.user.id);
        return enviarPdf(reply, certificado);
    });

    app.get<{ Params: ParametrosId; Querystring: ConsultaPeriodo }>("/organizacoes/:id/certificado", { schema: esquemaPeriodo, onRequest: podeEmitir }, async (request, reply) => {
        const { inicio, fim } = request.query;
        const certificado = await certificadoService.certificadoDoPeriodo(request.params.id, new Date(inicio), new Date(fim), request.user.id);
        return enviarPdf(reply, certificado);
    });
}
