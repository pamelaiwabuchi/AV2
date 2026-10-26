import type { FastifyError, FastifySchemaValidationError } from "fastify";

const mensagensDoFastify: Record<string, string> = {
    FST_ERR_CTP_EMPTY_JSON_BODY: "O corpo da requisição está vazio, mas deveria ter um JSON",
    FST_ERR_CTP_INVALID_JSON_BODY: "O corpo da requisição não é um JSON válido (confira vírgulas, aspas e chaves)",
    FST_ERR_CTP_INVALID_MEDIA_TYPE: "Formato não suportado: envie o corpo como JSON",
    FST_ERR_CTP_BODY_TOO_LARGE: "O corpo da requisição é grande demais",
};

const nomesDosTipos: Record<string, string> = {
    string: "texto",
    number: "número",
    integer: "número inteiro",
    boolean: "verdadeiro ou falso (true/false)",
    array: "lista",
    object: "objeto",
};

const nomesDosFormatos: Record<string, string> = {
    uuid: "um id no formato UUID",
    date: "uma data no formato AAAA-MM-DD",
    email: "um e-mail válido",
};

function nomeDoCampo(erro: FastifySchemaValidationError) {
    const caminho = erro.instancePath.replace(/^\//, "").replaceAll("/", ".");

    if (erro.keyword !== "required") {
        return caminho;
    }

    const campoQueFaltou = String(erro.params.missingProperty);
    return caminho ? `${caminho}.${campoQueFaltou}` : campoQueFaltou;
}

function traduzirValidacao(erro: FastifySchemaValidationError) {
    const campo = nomeDoCampo(erro);
    const params = erro.params;

    if (!campo) {
        return "Os dados enviados estão em um formato inválido";
    }

    switch (erro.keyword) {
        case "required":
            return `O campo "${campo}" é obrigatório`;
        case "type":
            return `O campo "${campo}" precisa ser ${nomesDosTipos[String(params.type)] ?? params.type}`;
        case "enum":
            return `O campo "${campo}" precisa ser um destes valores: ${(params.allowedValues as string[]).join(", ")}`;
        case "format":
            return `O campo "${campo}" precisa ser ${nomesDosFormatos[String(params.format)] ?? "num formato válido"}`;
        case "minLength":
            return `O campo "${campo}" não pode ficar vazio`;
        case "minItems":
            return `O campo "${campo}" precisa ter pelo menos ${params.limit} item(ns)`;
        case "uniqueItems":
            return `O campo "${campo}" tem itens repetidos`;
        case "minimum":
            return `O campo "${campo}" precisa ser no mínimo ${params.limit}`;
        case "maximum":
            return `O campo "${campo}" precisa ser no máximo ${params.limit}`;
        case "exclusiveMinimum":
            return `O campo "${campo}" precisa ser maior que ${params.limit}`;
        default:
            return `O campo "${campo}" é inválido`;
    }
}

export function mensagemEmPortugues(erro: FastifyError) {
    const primeiroErroDeValidacao = erro.validation?.[0];

    if (primeiroErroDeValidacao) {
        return traduzirValidacao(primeiroErroDeValidacao);
    }

    return mensagensDoFastify[erro.code] ?? erro.message;
}
