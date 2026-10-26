export function hojeSemHora() {
    const agora = new Date();
    return new Date(Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate()));
}
