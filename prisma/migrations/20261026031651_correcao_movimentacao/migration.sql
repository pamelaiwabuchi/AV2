-- AlterTable
ALTER TABLE "Movimentacao" ADD COLUMN     "movimentacaoCorrigidaId" UUID;

-- AddForeignKey
ALTER TABLE "Movimentacao" ADD CONSTRAINT "Movimentacao_movimentacaoCorrigidaId_fkey" FOREIGN KEY ("movimentacaoCorrigidaId") REFERENCES "Movimentacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;
