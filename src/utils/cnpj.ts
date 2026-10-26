import { ErroRegraNegocio } from "../errors/erros.js";

function calcularDigito(numeros: string, pesos: number[]) {
    let soma = 0;

    for (let i = 0; i < pesos.length; i++) {
        soma = soma + Number(numeros[i]) * pesos[i]!;
    }

    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
}

export function validarCnpj(cnpjInformado: string) {
    const cnpj = cnpjInformado.replace(/\D/g, "");

    if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) {
        throw new ErroRegraNegocio("CNPJ inválido");
    }

    const primeiro = calcularDigito(cnpj, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
    const segundo = calcularDigito(cnpj, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);

    if (primeiro !== Number(cnpj[12]) || segundo !== Number(cnpj[13])) {
        throw new ErroRegraNegocio("CNPJ inválido");
    }

    return cnpj;
}
