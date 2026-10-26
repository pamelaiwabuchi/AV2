/*
  Warnings:

  - Added the required column `departamentoId` to the `Usuario` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "departamentoId" UUID NOT NULL;

-- CreateTable
CREATE TABLE "Departamento" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "dataCadastro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "versao" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Departamento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Departamento_nome_key" ON "Departamento"("nome");

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_departamentoId_fkey" FOREIGN KEY ("departamentoId") REFERENCES "Departamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Departamento também é auditado, igual às outras tabelas.
CREATE TRIGGER auditoria_departamento AFTER INSERT OR UPDATE OR DELETE ON "Departamento"
    FOR EACH ROW EXECUTE FUNCTION registrar_auditoria();
