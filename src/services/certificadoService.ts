import { ErroApp, ErroNaoEncontrado, ErroRegraNegocio } from "../errors/erros.js";
import * as certificadoRepository from "../repositories/certificadoRepository.js";
import * as organizacaoRepository from "../repositories/organizacaoRepository.js";
import * as usuarioRepository from "../repositories/usuarioRepository.js";
import { validarCnpj } from "../utils/cnpj.js";
import { somarDias } from "../utils/datas.js";
import { gerarPdfCertificado } from "../utils/pdfCertificado.js";
import type { EquipamentoDoCertificado, LoteDoCertificado } from "../utils/pdfCertificado.js";

type LoteDoBanco = NonNullable<Awaited<ReturnType<typeof certificadoRepository.buscarLoteParaCertificado>>>;

function dadosDaEmpresa() {
    const razaoSocial = process.env.EMPRESA_RAZAO_SOCIAL;
    const cnpj = process.env.EMPRESA_CNPJ;

    if (!razaoSocial || !cnpj) {
        throw new ErroApp("O certificado não pode ser emitido: defina EMPRESA_RAZAO_SOCIAL e EMPRESA_CNPJ no .env", 500);
    }

    return { razaoSocial, cnpj: validarCnpj(cnpj) };
}

async function nomeDoUsuario(id: string) {
    const usuario = await usuarioRepository.buscarUsuarioSemSenha(id);
    return usuario?.nome ?? "usuário desconhecido";
}

function converterLote(lote: LoteDoBanco): LoteDoCertificado {
    return {
        notaFiscal: lote.notaFiscal,
        transportadora: lote.transportadora,
        dataEntrada: lote.dataEntrada,
        dataFinalizacao: lote.dataStatus,
    };
}

// A destinação vem da última baixa: ela saiu de PECAS_REAPROVEITADAS, MATERIAL_RECICLAVEL ou DESCARTE_SEGURO.
function converterEquipamentos(lote: LoteDoBanco): EquipamentoDoCertificado[] {
    return lote.equipamentos.map((equipamento) => ({
        codigo: equipamento.codigoBarrasInterno,
        notaFiscal: lote.notaFiscal,
        tipo: equipamento.tipo,
        marcaModelo: `${equipamento.marca} ${equipamento.modelo}`,
        pesoKg: Number(equipamento.pesoQuilogramas),
        destinacao: equipamento.historicoMovimentacao[0]?.origem ?? "",
        parceiro: equipamento.destino?.razaoSocial ?? "",
        parceiroCnpj: equipamento.destino?.cnpj ?? "",
    }));
}

function diaSemTraco(data: Date) {
    return data.toISOString().slice(0, 10).replaceAll("-", "");
}

export async function certificadoDoLote(loteId: string, idUsuario: string) {
    const lote = await certificadoRepository.buscarLoteParaCertificado(loteId);

    if (!lote) {
        throw new ErroNaoEncontrado("Lote não encontrado");
    }

    if (lote.statusProcessamento !== "FINALIZADO") {
        throw new ErroRegraNegocio(`Só é possível emitir o certificado de um lote FINALIZADO (este está ${lote.statusProcessamento})`);
    }

    const numero = `CDF-${lote.organizacao.cnpj}-${lote.notaFiscal}`;
    const pdf = await gerarPdfCertificado({
        numero,
        referencia: `lote ${lote.id}`,
        emitidoEm: new Date(),
        emitidoPor: await nomeDoUsuario(idUsuario),
        empresa: dadosDaEmpresa(),
        cliente: lote.organizacao,
        periodo: null,
        lotes: [converterLote(lote)],
        equipamentos: converterEquipamentos(lote),
    });

    return { numero, pdf };
}

export async function certificadoDoPeriodo(organizacaoId: string, inicio: Date, fim: Date, idUsuario: string) {
    if (fim < inicio) {
        throw new ErroRegraNegocio("A data final precisa ser igual ou depois da data inicial");
    }

    const organizacao = await organizacaoRepository.buscarOrganizacaoPorId(organizacaoId);

    if (!organizacao) {
        throw new ErroNaoEncontrado("Organização não encontrada");
    }

    const lotes = await certificadoRepository.listarLotesFinalizadosNoPeriodo(organizacaoId, inicio, somarDias(fim, 1));

    if (lotes.length === 0) {
        throw new ErroRegraNegocio("Esta organização não tem nenhum lote finalizado nesse período");
    }

    const numero = `CDF-${organizacao.cnpj}-${diaSemTraco(inicio)}-${diaSemTraco(fim)}`;
    const pdf = await gerarPdfCertificado({
        numero,
        referencia: `organização ${organizacao.id}`,
        emitidoEm: new Date(),
        emitidoPor: await nomeDoUsuario(idUsuario),
        empresa: dadosDaEmpresa(),
        cliente: { razaoSocial: organizacao.razaoSocial, cnpj: organizacao.cnpj, enderecoCompleto: organizacao.enderecoCompleto },
        periodo: { inicio, fim },
        lotes: lotes.map(converterLote),
        equipamentos: lotes.flatMap(converterEquipamentos),
    });

    return { numero, pdf };
}
