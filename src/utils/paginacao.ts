export function montarPagina<T>(itens: T[], total: number, pagina: number, tamanhoPagina: number) {
    return {
        itens,
        pagina,
        totalPaginas: Math.max(1, Math.ceil(total / tamanhoPagina)),
        total,
    };
}
