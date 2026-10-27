export const esquemaId = {
    type: "object",
    required: ["id"],
    properties: {
        id: { type: "string", format: "uuid" },
    },
};

// Id fixo do lote FINALIZADO do seed (NF-1001), já preenchido no Swagger do certificado
export const ID_LOTE_EXEMPLO = "00000000-0000-4000-8000-000000001001";

export const esquemaIdLoteExemplo = {
    type: "object",
    required: ["id"],
    properties: {
        id: { type: "string", format: "uuid", examples: [ID_LOTE_EXEMPLO] },
    },
};

export const textoObrigatorio = { type: "string", minLength: 1 };
