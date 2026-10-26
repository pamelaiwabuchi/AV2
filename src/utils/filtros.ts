// Busca por um pedaço do texto, sem diferenciar maiúsculas: "dell" acha "Dell Latitude".
export function contemTexto(texto: string) {
    return { contains: texto, mode: "insensitive" as const };
}

// Filtro por razão social e/ou CNPJ, usado para organização e destino.
// O CNPJ também aceita só um pedaço, com ou sem pontuação: "52.601" acha 52601815000120.
// Devolve undefined quando nenhum dos dois foi informado.
export function filtroDeEmpresa(nome: string | undefined, cnpj: string | undefined) {
    if (!nome && !cnpj) {
        return undefined;
    }

    const filtro: { razaoSocial?: ReturnType<typeof contemTexto>; cnpj?: { contains: string } } = {};

    if (nome) {
        filtro.razaoSocial = contemTexto(nome);
    }

    if (cnpj) {
        filtro.cnpj = { contains: cnpj.replace(/\D/g, "") };
    }

    return filtro;
}
