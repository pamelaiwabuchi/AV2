const UM_DIA = 24 * 60 * 60 * 1000;

export function hojeSemHora() {
    const agora = new Date();
    return new Date(Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate()));
}

export function somarDias(data: Date, dias: number) {
    return new Date(data.getTime() + dias * UM_DIA);
}

// Filtro de data para o Prisma. O dia "fim" entra inteiro: vai até o começo do dia seguinte.
export function filtroDePeriodo(inicio: string | undefined, fim: string | undefined) {
    const filtro: { gte?: Date; lt?: Date } = {};

    if (inicio) {
        filtro.gte = new Date(inicio);
    }

    if (fim) {
        filtro.lt = somarDias(new Date(fim), 1);
    }

    return filtro;
}
