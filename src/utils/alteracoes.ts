import { ErroApp } from "../errors/erros.js";

export function exigirAlgumCampo(alteracoes: object) {
    if (Object.keys(alteracoes).length === 0) {
        throw new ErroApp("Informe pelo menos um campo para alterar", 400);
    }
}
