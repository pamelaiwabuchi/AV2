export const esquemaId = {
    type: "object",
    required: ["id"],
    properties: {
        id: { type: "string", format: "uuid" },
    },
};

// Ids fixos do seed, já preenchidos nos exemplos do Swagger
export const ID_LOTE_EXEMPLO = "00000000-0000-4000-8000-000000001001"; // lote FINALIZADO NF-1001
export const ID_ORGANIZACAO_EXEMPLO = "00000000-0000-4000-8000-000000000001"; // TechCorp
export const ID_DEPARTAMENTO_EXEMPLO = "00000000-0000-4000-8000-000000000101"; // Comercial

export function esquemaIdComExemplo(idExemplo: string) {
    return {
        type: "object",
        required: ["id"],
        properties: {
            id: { type: "string", format: "uuid", examples: [idExemplo] },
        },
    };
}

export const textoObrigatorio = { type: "string", minLength: 1 };
