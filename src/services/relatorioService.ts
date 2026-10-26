import type { PapelUsuario } from "../generated/prisma/enums.js";
import { ErroNaoEncontrado, ErroRegraNegocio } from "../errors/erros.js";
import * as relatorioRepository from "../repositories/relatorioRepository.js";
import * as organizacaoRepository from "../repositories/organizacaoRepository.js";
import * as loteService from "./loteService.js";
import * as parametrosRepository from "../repositories/parametrosRepository.js";

const UM_DIA = 24 * 60 * 60 * 1000;

function arredondar(valor: number) {
    return Math.round(valor * 1000) / 1000;
}

function inicioDoMes() {
    const agora = new Date();
    return new Date(Date.UTC(agora.getFullYear(), agora.getMonth(), 1));
}

async function painelDoAlmoxarifado() {
    const lotes = await relatorioRepository.contarLotesPorStatus();
    const equipamentos = await relatorioRepository.contarEquipamentosPorStatus();
    const parados = await loteService.listarParados();
    const kgRecebidosNoMes = await relatorioRepository.somarPesoRecebidoDesde(inicioDoMes());

    return {
        lotesPorStatus: lotes.map((item) => ({ status: item.statusProcessamento, quantidade: item._count })),
        equipamentosPorStatus: equipamentos.map((item) => ({ status: item.statusRastreamento, quantidade: item._count })),
        lotesParados: parados.length,
        kgRecebidosNoMes: arredondar(kgRecebidosNoMes),
    };
}

async function painelDoCadastro() {
    return {
        organizacoesAtivas: await relatorioRepository.contarOrganizacoesAtivas(),
        contratosVigentes: await relatorioRepository.contarContratosVigentes(),
    };
}

export async function montarPainel(papel: PapelUsuario) {
    if (papel === "GESTOR_ALMOXARIFADO") {
        return { almoxarifado: await painelDoAlmoxarifado() };
    }

    if (papel === "OPERADOR_CADASTRO") {
        return { cadastro: await painelDoCadastro() };
    }

    return {
        almoxarifado: await painelDoAlmoxarifado(),
        cadastro: await painelDoCadastro(),
    };
}

export async function relatorioDestinacao(organizacaoId: string, inicio: Date, fim: Date) {
    if (fim < inicio) {
        throw new ErroRegraNegocio("A data final precisa ser igual ou depois da data inicial");
    }

    const organizacao = await organizacaoRepository.buscarOrganizacaoPorId(organizacaoId);

    if (!organizacao) {
        throw new ErroNaoEncontrado("Organização não encontrada");
    }

    const fimInclusivo = new Date(fim.getTime() + UM_DIA);
    const destinacoes = await relatorioRepository.listarDestinacoes(organizacaoId, inicio, fimInclusivo);
    const resumo: Record<string, { quantidade: number; kg: number }> = {};
    let kgTotal = 0;

    for (const item of destinacoes) {
        const peso = Number(item.equipamento.pesoQuilogramas);
        const categoria = resumo[item.destino] ?? { quantidade: 0, kg: 0 };

        categoria.quantidade = categoria.quantidade + 1;
        categoria.kg = arredondar(categoria.kg + peso);
        resumo[item.destino] = categoria;
        kgTotal = kgTotal + peso;
    }

    return {
        organizacao: { razaoSocial: organizacao.razaoSocial, cnpj: organizacao.cnpj },
        periodo: { inicio, fim },
        totalEquipamentos: destinacoes.length,
        kgTotal: arredondar(kgTotal),
        porDestinacao: resumo,
        equipamentos: destinacoes.map((item) => ({
            codigoBarrasInterno: item.equipamento.codigoBarrasInterno,
            tipo: item.equipamento.tipo,
            pesoQuilogramas: Number(item.equipamento.pesoQuilogramas),
            destinacao: item.destino,
            parceiro: item.equipamento.destino,
            data: item.dataHora,
        })),
    };
}

function diasEntre(inicio: Date, fim: Date) {
    return Math.round((fim.getTime() - inicio.getTime()) / UM_DIA) + 1;
}

function arredondarCentavos(valor: number) {
    return Math.round(valor * 100) / 100;
}

export async function relatorioFinanceiro(inicio: Date, fim: Date) {
    if (fim < inicio) {
        throw new ErroRegraNegocio("A data final precisa ser igual ou depois da data inicial");
    }

    const parametros = await parametrosRepository.buscarParametros();
    const aliquota = Number(parametros.aliquotaImposto);
    const contratos = await relatorioRepository.listarContratosNoPeriodo(inicio, fim);
    const porOrganizacao: Record<string, { razaoSocial: string; cnpj: string; receitaBruta: number }> = {};

    for (const contrato of contratos) {
        const comeco = contrato.dataAssinatura > inicio ? contrato.dataAssinatura : inicio;
        const termino = contrato.dataVencimento < fim ? contrato.dataVencimento : fim;
        const valor = (Number(contrato.valorMensal) / 30) * diasEntre(comeco, termino);

        const linha = porOrganizacao[contrato.organizacaoId] ?? {
            razaoSocial: contrato.organizacao.razaoSocial,
            cnpj: contrato.organizacao.cnpj,
            receitaBruta: 0,
        };

        linha.receitaBruta = linha.receitaBruta + valor;
        porOrganizacao[contrato.organizacaoId] = linha;
    }

    const organizacoes = Object.values(porOrganizacao).map((linha) => {
        const impostos = (linha.receitaBruta * aliquota) / 100;

        return {
            razaoSocial: linha.razaoSocial,
            cnpj: linha.cnpj,
            receitaBruta: arredondarCentavos(linha.receitaBruta),
            impostos: arredondarCentavos(impostos),
            receitaLiquida: arredondarCentavos(linha.receitaBruta - impostos),
        };
    });

    let totalBruto = 0;
    let totalImpostos = 0;

    for (const linha of organizacoes) {
        totalBruto = totalBruto + linha.receitaBruta;
        totalImpostos = totalImpostos + linha.impostos;
    }

    return {
        periodo: { inicio, fim, dias: diasEntre(inicio, fim) },
        aliquotaImposto: aliquota,
        organizacoes,
        total: {
            receitaBruta: arredondarCentavos(totalBruto),
            impostos: arredondarCentavos(totalImpostos),
            receitaLiquida: arredondarCentavos(totalBruto - totalImpostos),
        },
    };
}
