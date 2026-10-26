-- Função genérica de auditoria: grava em "Auditoria" toda inclusão, alteração ou exclusão.
-- O usuário vem de set_config('app.usuario_id', ...), feito em src/lib/transacao.ts.
CREATE OR REPLACE FUNCTION registrar_auditoria() RETURNS trigger AS $$
DECLARE
    usuario TEXT := NULLIF(current_setting('app.usuario_id', true), '');
    antes JSONB := NULL;
    depois JSONB := NULL;
BEGIN
    IF TG_OP <> 'INSERT' THEN
        antes := to_jsonb(OLD);
    END IF;

    IF TG_OP <> 'DELETE' THEN
        depois := to_jsonb(NEW);
    END IF;

    -- A senha nunca vai para a auditoria: só registramos que ela mudou.
    IF (antes ->> 'hashSenha') IS DISTINCT FROM (depois ->> 'hashSenha') AND TG_OP = 'UPDATE' THEN
        depois := depois || '{"hashSenha": "(senha alterada)"}';
    ELSE
        depois := depois - 'hashSenha';
    END IF;

    antes := antes - 'hashSenha';

    INSERT INTO "Auditoria" ("tabela", "operacao", "registroId", "usuarioId", "dadosAntes", "dadosDepois")
    VALUES (TG_TABLE_NAME, TG_OP, COALESCE(depois ->> 'id', antes ->> 'id')::uuid, usuario::uuid, antes, depois);

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auditoria_usuario AFTER INSERT OR UPDATE OR DELETE ON "Usuario"
    FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();

CREATE TRIGGER auditoria_organizacao AFTER INSERT OR UPDATE OR DELETE ON "Organizacao"
    FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();

CREATE TRIGGER auditoria_contrato AFTER INSERT OR UPDATE OR DELETE ON "Contrato"
    FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();

CREATE TRIGGER auditoria_destino AFTER INSERT OR UPDATE OR DELETE ON "Destino"
    FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();

CREATE TRIGGER auditoria_lote AFTER INSERT OR UPDATE OR DELETE ON "Lote"
    FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();

CREATE TRIGGER auditoria_equipamento AFTER INSERT OR UPDATE OR DELETE ON "Equipamento"
    FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();

CREATE TRIGGER auditoria_movimentacao AFTER INSERT OR UPDATE OR DELETE ON "Movimentacao"
    FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();

CREATE TRIGGER auditoria_parametros AFTER INSERT OR UPDATE OR DELETE ON "Parametros"
    FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();

-- Auditoria e Movimentacao são históricos: nunca podem ser alterados nem apagados.
CREATE OR REPLACE FUNCTION impedir_alteracao() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'A tabela % é um histórico e não pode ser alterada nem apagada', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER protege_auditoria BEFORE UPDATE OR DELETE ON "Auditoria"
    FOR EACH ROW EXECUTE FUNCTION impedir_alteracao();

CREATE TRIGGER protege_movimentacao BEFORE UPDATE OR DELETE ON "Movimentacao"
    FOR EACH ROW EXECUTE FUNCTION impedir_alteracao();
