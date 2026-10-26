export const esquemaId = {
    type: "object",
    required: ["id"],
    properties: {
        id: { type: "string", format: "uuid" },
    },
};

export const esquemaPagina = {
    type: "object",
    properties: {
        pagina: { type: "integer", minimum: 1, default: 1 },
    },
};

export const textoObrigatorio = { type: "string", minLength: 1 };
