import { test } from "node:test";
import assert from "node:assert/strict";
import { validarCnpj } from "../src/utils/cnpj.js";
import { calcularStatusLote, podeMudarStatus } from "../src/utils/regrasStatus.js";
import { validarForcaSenha } from "../src/services/authService.js";

test("CNPJ válido com ou sem máscara vira só números", () => {
    assert.equal(validarCnpj("11.222.333/0001-81"), "11222333000181");
    assert.equal(validarCnpj("11222333000181"), "11222333000181");
});

test("CNPJ com dígito errado, tamanho errado ou repetido é recusado", () => {
    assert.throws(() => validarCnpj("11.222.333/0001-82"), /CNPJ inválido/);
    assert.throws(() => validarCnpj("123"), /CNPJ inválido/);
    assert.throws(() => validarCnpj("11111111111111"), /CNPJ inválido/);
});

test("senha forte precisa de 8 caracteres, 1 maiúscula e 1 número", () => {
    assert.doesNotThrow(() => validarForcaSenha("Abcd1234"));
    assert.throws(() => validarForcaSenha("Abc1234"));
    assert.throws(() => validarForcaSenha("abcd1234"));
    assert.throws(() => validarForcaSenha("Abcdefgh"));
});

test("transições de status permitidas e proibidas", () => {
    assert.equal(podeMudarStatus("AGUARDANDO_TRIAGEM", "EM_TRIAGEM"), true);
    assert.equal(podeMudarStatus("AGUARDANDO_TRIAGEM", "EM_DESMONTE"), false);
    assert.equal(podeMudarStatus("EM_TRIAGEM", "CANCELADO"), false);
    assert.equal(podeMudarStatus("DESCARTE_SEGURO", "BAIXA_DEFINITIVA"), true);
    assert.equal(podeMudarStatus("BAIXA_DEFINITIVA", "EM_TRIAGEM"), false);
});

test("status do lote é calculado pelos equipamentos, ignorando os cancelados", () => {
    assert.equal(calcularStatusLote(["AGUARDANDO_TRIAGEM", "AGUARDANDO_TRIAGEM"]), "RECEBIDO");
    assert.equal(calcularStatusLote(["EM_TRIAGEM", "AGUARDANDO_TRIAGEM"]), "EM_TRIAGEM");
    assert.equal(calcularStatusLote(["AGUARDANDO_DESMONTE", "MATERIAL_RECICLAVEL"]), "TRIAGEM_CONCLUIDA");
    assert.equal(calcularStatusLote(["PECAS_REAPROVEITADAS", "BAIXA_DEFINITIVA"]), "ENCAMINHADO");
    assert.equal(calcularStatusLote(["BAIXA_DEFINITIVA", "CANCELADO"]), "FINALIZADO");
});
