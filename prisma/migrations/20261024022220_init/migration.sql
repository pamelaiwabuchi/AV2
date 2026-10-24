-- CreateEnum
CREATE TYPE "PapelUsuario" AS ENUM ('ADMINISTRADOR', 'OPERADOR_CADASTRO', 'GESTOR_ALMOXARIFADO', 'AUDITOR');

-- CreateEnum
CREATE TYPE "StatusLote" AS ENUM ('RECEBIDO', 'EM_TRIAGEM', 'TRIAGEM_CONCLUIDA', 'ENCAMINHADO', 'FINALIZADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "StatusRastreamento" AS ENUM ('AGUARDANDO_TRIAGEM', 'EM_TRIAGEM', 'AGUARDANDO_DESMONTE', 'EM_DESMONTE', 'PECAS_REAPROVEITADAS', 'MATERIAL_RECICLAVEL', 'DESCARTE_SEGURO', 'BAIXA_DEFINITIVA', 'CANCELADO');

-- CreateEnum
CREATE TYPE "EstadoFisico" AS ENUM ('NOVO', 'BOM_ESTADO', 'USADO_LEVE', 'USADO_MODERADO', 'DANIFICADO_LEVE', 'DANIFICADO_GRAVE', 'INSERVIVEL');

-- CreateEnum
CREATE TYPE "TipoEquipamento" AS ENUM ('COMPUTADOR_MESA', 'NOTEBOOK', 'MONITOR', 'IMPRESSORA', 'SERVIDOR', 'ROTEADOR', 'CABO_ESTRUTURADO', 'FONTE_ALIMENTACAO');

-- CreateTable
CREATE TABLE "Organizacao" (
    "id" UUID NOT NULL,
    "razaoSocial" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,
    "inscricaoEstadual" TEXT NOT NULL,
    "enderecoCompleto" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "dataCadastro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "versao" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Organizacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contrato" (
    "id" UUID NOT NULL,
    "organizacaoId" UUID NOT NULL,
    "dataAssinatura" DATE NOT NULL,
    "dataVencimento" DATE NOT NULL,
    "clausulas" TEXT[],
    "valorMensal" DECIMAL(12,2) NOT NULL,
    "renovacaoAutomatica" BOOLEAN NOT NULL,
    "versao" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Contrato_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lote" (
    "id" UUID NOT NULL,
    "dataEntrada" DATE NOT NULL,
    "organizacaoId" UUID NOT NULL,
    "notaFiscal" TEXT NOT NULL,
    "transportadora" TEXT NOT NULL,
    "statusProcessamento" "StatusLote" NOT NULL DEFAULT 'RECEBIDO',
    "observacoes" TEXT,
    "versao" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Lote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Equipamento" (
    "id" UUID NOT NULL,
    "codigoBarrasInterno" TEXT NOT NULL,
    "tipo" "TipoEquipamento" NOT NULL,
    "marca" TEXT NOT NULL,
    "modelo" TEXT NOT NULL,
    "anoFabricacao" INTEGER NOT NULL,
    "estadoFisico" "EstadoFisico" NOT NULL,
    "pesoQuilogramas" DECIMAL(12,3) NOT NULL,
    "loteId" UUID NOT NULL,
    "posicaoNoLote" INTEGER NOT NULL,
    "statusRastreamento" "StatusRastreamento" NOT NULL DEFAULT 'AGUARDANDO_TRIAGEM',
    "destinoId" UUID,
    "versao" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Equipamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Movimentacao" (
    "id" UUID NOT NULL,
    "equipamentoId" UUID NOT NULL,
    "dataHora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "origem" "StatusRastreamento",
    "destino" "StatusRastreamento" NOT NULL,
    "responsavelId" UUID NOT NULL,
    "observacao" TEXT,

    CONSTRAINT "Movimentacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "login" TEXT NOT NULL,
    "hashSenha" TEXT NOT NULL,
    "papel" "PapelUsuario" NOT NULL,
    "ultimoAcesso" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "versao" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Destino" (
    "id" UUID NOT NULL,
    "razaoSocial" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,
    "enderecoCompleto" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "dataCadastro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "versao" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Destino_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Parametros" (
    "id" UUID NOT NULL,
    "aliquotaImposto" DECIMAL(5,2) NOT NULL,
    "depreciacaoComputadorMesa" DECIMAL(5,2) NOT NULL,
    "depreciacaoNotebook" DECIMAL(5,2) NOT NULL,
    "depreciacaoMonitor" DECIMAL(5,2) NOT NULL,
    "depreciacaoImpressora" DECIMAL(5,2) NOT NULL,
    "depreciacaoServidor" DECIMAL(5,2) NOT NULL,
    "depreciacaoRoteador" DECIMAL(5,2) NOT NULL,
    "depreciacaoCaboEstruturado" DECIMAL(5,2) NOT NULL,
    "depreciacaoFonteAlimentacao" DECIMAL(5,2) NOT NULL,
    "versao" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Parametros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Auditoria" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tabela" TEXT NOT NULL,
    "operacao" TEXT NOT NULL,
    "registroId" UUID NOT NULL,
    "usuarioId" UUID,
    "dadosAntes" JSONB,
    "dadosDepois" JSONB,
    "dataHora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organizacao_cnpj_key" ON "Organizacao"("cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "Equipamento_codigoBarrasInterno_key" ON "Equipamento"("codigoBarrasInterno");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_login_key" ON "Usuario"("login");

-- CreateIndex
CREATE UNIQUE INDEX "Destino_cnpj_key" ON "Destino"("cnpj");

-- AddForeignKey
ALTER TABLE "Contrato" ADD CONSTRAINT "Contrato_organizacaoId_fkey" FOREIGN KEY ("organizacaoId") REFERENCES "Organizacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lote" ADD CONSTRAINT "Lote_organizacaoId_fkey" FOREIGN KEY ("organizacaoId") REFERENCES "Organizacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Equipamento" ADD CONSTRAINT "Equipamento_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "Lote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Equipamento" ADD CONSTRAINT "Equipamento_destinoId_fkey" FOREIGN KEY ("destinoId") REFERENCES "Destino"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movimentacao" ADD CONSTRAINT "Movimentacao_equipamentoId_fkey" FOREIGN KEY ("equipamentoId") REFERENCES "Equipamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movimentacao" ADD CONSTRAINT "Movimentacao_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
