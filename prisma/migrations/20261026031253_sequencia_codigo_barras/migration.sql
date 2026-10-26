-- Contador usado para gerar o código de barras dos equipamentos (GC-AAAA-000001).
-- O próprio banco garante que o mesmo número nunca sai duas vezes, mesmo com
-- dois cadastros ao mesmo tempo.
CREATE SEQUENCE "codigo_equipamento_seq";
