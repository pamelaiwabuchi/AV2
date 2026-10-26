export const esquemaId = {
    type: "object",
    required: ["id"],
    properties: {
        id: { type: "string", format: "uuid" },
    },
};

export const textoObrigatorio = { type: "string", minLength: 1 };
