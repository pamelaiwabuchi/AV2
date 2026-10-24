-- AlterTable
ALTER TABLE "Parametros" ADD COLUMN     "diasLoteParado" INTEGER NOT NULL DEFAULT 30;

-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "bloqueadoAte" TIMESTAMP(3),
ADD COLUMN     "precisaTrocarSenha" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "tentativasLogin" INTEGER NOT NULL DEFAULT 0;
