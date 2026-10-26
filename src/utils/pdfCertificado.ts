import PDFDocument from "pdfkit";

export interface EquipamentoDoCertificado {
    codigo: string;
    notaFiscal: string;
    tipo: string;
    marcaModelo: string;
    pesoKg: number;
    destinacao: string;
    parceiro: string;
    parceiroCnpj: string;
}

export interface LoteDoCertificado {
    notaFiscal: string;
    transportadora: string;
    dataEntrada: Date;
    dataFinalizacao: Date;
}

export interface DadosCertificado {
    numero: string;
    referencia: string;
    emitidoEm: Date;
    emitidoPor: string;
    empresa: { razaoSocial: string; cnpj: string };
    cliente: { razaoSocial: string; cnpj: string; enderecoCompleto: string };
    periodo: { inicio: Date; fim: Date } | null;
    lotes: LoteDoCertificado[];
    equipamentos: EquipamentoDoCertificado[];
}

type Documento = PDFKit.PDFDocument;

const MARGEM = 40;
const LARGURA = 515;
const COR_TITULO = "#1b5e20";

const colunas = [
    { titulo: "Código", largura: 80 },
    { titulo: "NF", largura: 50 },
    { titulo: "Tipo", largura: 70 },
    { titulo: "Marca / modelo", largura: 95 },
    { titulo: "Peso (kg)", largura: 45 },
    { titulo: "Destinação", largura: 80 },
    { titulo: "Parceiro (CNPJ)", largura: 95 },
];

const nomesDasDestinacoes: Record<string, string> = {
    PECAS_REAPROVEITADAS: "Reaproveitamento de peças",
    MATERIAL_RECICLAVEL: "Reciclagem",
    DESCARTE_SEGURO: "Descarte seguro",
};

const nomesDosTipos: Record<string, string> = {
    COMPUTADOR_MESA: "Computador de mesa",
    NOTEBOOK: "Notebook",
    MONITOR: "Monitor",
    IMPRESSORA: "Impressora",
    SERVIDOR: "Servidor",
    ROTEADOR: "Roteador",
    CABO_ESTRUTURADO: "Cabo estruturado",
    FONTE_ALIMENTACAO: "Fonte de alimentação",
};

// Datas sem hora (como a data de entrada) são gravadas à meia-noite UTC.
function formatarDia(data: Date) {
    return data.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

function formatarDataHora(data: Date) {
    return data.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function formatarCnpj(cnpj: string) {
    return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

function formatarKg(valor: number) {
    return valor.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 3 });
}

function titulo(doc: Documento, texto: string) {
    doc.moveDown(0.8);
    doc.font("Helvetica-Bold").fontSize(11).fillColor(COR_TITULO).text(texto, MARGEM, doc.y, { width: LARGURA });
    doc.fillColor("black").font("Helvetica").fontSize(10);
}

function linha(doc: Documento, rotulo: string, valor: string) {
    doc.font("Helvetica-Bold").text(`${rotulo}: `, MARGEM, doc.y, { continued: true, width: LARGURA });
    doc.font("Helvetica").text(valor);
}

function desenharCabecalho(doc: Documento, dados: DadosCertificado) {
    doc.font("Helvetica-Bold").fontSize(16).fillColor(COR_TITULO);
    doc.text("CERTIFICADO DE DESTINAÇÃO FINAL", MARGEM, MARGEM, { width: LARGURA, align: "center" });
    doc.font("Helvetica").fontSize(10).fillColor("black");
    doc.text(`Nº ${dados.numero}  ·  Emitido em ${formatarDataHora(dados.emitidoEm)}`, { width: LARGURA, align: "center" });

    titulo(doc, "Emitente");
    linha(doc, "Razão social", dados.empresa.razaoSocial);
    linha(doc, "CNPJ", formatarCnpj(dados.empresa.cnpj));

    titulo(doc, "Cliente (gerador dos resíduos)");
    linha(doc, "Razão social", dados.cliente.razaoSocial);
    linha(doc, "CNPJ", formatarCnpj(dados.cliente.cnpj));
    linha(doc, "Endereço", dados.cliente.enderecoCompleto);

    if (dados.periodo) {
        linha(doc, "Período", `${formatarDia(dados.periodo.inicio)} a ${formatarDia(dados.periodo.fim)}`);
    }
}

function desenharLotes(doc: Documento, lotes: LoteDoCertificado[]) {
    titulo(doc, lotes.length === 1 ? "Lote" : `Lotes (${lotes.length})`);

    for (const lote of lotes) {
        const entrada = formatarDia(lote.dataEntrada);
        const finalizacao = formatarDia(lote.dataFinalizacao);
        doc.text(`Nota fiscal: ${lote.notaFiscal}  ·  Transportadora: ${lote.transportadora}  ·  Entrada: ${entrada}  ·  Finalizado: ${finalizacao}`, MARGEM, doc.y, { width: LARGURA });
    }
}

function alturaDaLinha(doc: Documento, celulas: string[]) {
    const alturas = celulas.map((texto, i) => doc.heightOfString(texto, { width: colunas[i]!.largura - 4 }));
    return Math.max(...alturas) + 6;
}

function desenharLinhaDaTabela(doc: Documento, celulas: string[], negrito: boolean) {
    doc.font(negrito ? "Helvetica-Bold" : "Helvetica").fontSize(8);
    const altura = alturaDaLinha(doc, celulas);

    if (doc.y + altura > doc.page.height - MARGEM) {
        doc.addPage();

        if (!negrito) {
            desenharLinhaDaTabela(doc, colunas.map((coluna) => coluna.titulo), true);
            doc.font("Helvetica").fontSize(8);
        }
    }

    const topo = doc.y;
    let x = MARGEM;

    celulas.forEach((texto, i) => {
        doc.text(texto, x + 2, topo + 3, { width: colunas[i]!.largura - 4 });
        x = x + colunas[i]!.largura;
    });

    doc.moveTo(MARGEM, topo + altura).lineTo(MARGEM + LARGURA, topo + altura).strokeColor("#cccccc").stroke();
    doc.y = topo + altura;
}

function desenharEquipamentos(doc: Documento, equipamentos: EquipamentoDoCertificado[]) {
    titulo(doc, `Equipamentos (${equipamentos.length})`);
    doc.moveDown(0.3);
    desenharLinhaDaTabela(doc, colunas.map((coluna) => coluna.titulo), true);

    for (const item of equipamentos) {
        desenharLinhaDaTabela(doc, [
            item.codigo,
            item.notaFiscal,
            nomesDosTipos[item.tipo] ?? item.tipo,
            item.marcaModelo,
            formatarKg(item.pesoKg),
            nomesDasDestinacoes[item.destinacao] ?? item.destinacao,
            `${item.parceiro}\n${formatarCnpj(item.parceiroCnpj)}`,
        ], false);
    }

    doc.fontSize(10);
}

function desenharTotais(doc: Documento, equipamentos: EquipamentoDoCertificado[]) {
    titulo(doc, "Totais por destinação");
    let kgTotal = 0;

    for (const [destinacao, nome] of Object.entries(nomesDasDestinacoes)) {
        const doTipo = equipamentos.filter((item) => item.destinacao === destinacao);
        const kg = doTipo.reduce((soma, item) => soma + item.pesoKg, 0);
        kgTotal = kgTotal + kg;

        if (doTipo.length > 0) {
            linha(doc, nome, `${doTipo.length} equipamento(s), ${formatarKg(kg)} kg`);
        }
    }

    linha(doc, "Total", `${equipamentos.length} equipamento(s), ${formatarKg(kgTotal)} kg`);
}

function desenharDeclaracao(doc: Documento, dados: DadosCertificado) {
    titulo(doc, "Declaração");
    doc.text(
        `${dados.empresa.razaoSocial} declara que os equipamentos eletrônicos relacionados acima, recebidos de ` +
        `${dados.cliente.razaoSocial}, foram triados e receberam destinação final ambientalmente adequada, ` +
        "pelos parceiros indicados, com baixa definitiva registrada no sistema.",
        MARGEM, doc.y, { width: LARGURA, align: "justify" },
    );

    doc.moveDown(1.5);
    doc.fontSize(8).fillColor("#555555");
    doc.text(`Emitido por ${dados.emitidoPor}, pelo sistema GreenCode. Certificado nº ${dados.numero}. Referência no sistema: ${dados.referencia}.`, MARGEM, doc.y, { width: LARGURA });
    doc.fillColor("black");
}

export function gerarPdfCertificado(dados: DadosCertificado): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ size: "A4", margin: MARGEM, info: { Title: `Certificado ${dados.numero}` } });
        const partes: Buffer[] = [];

        doc.on("data", (parte: Buffer) => partes.push(parte));
        doc.on("end", () => resolve(Buffer.concat(partes)));
        doc.on("error", reject);

        desenharCabecalho(doc, dados);
        desenharLotes(doc, dados.lotes);
        desenharEquipamentos(doc, dados.equipamentos);
        desenharTotais(doc, dados.equipamentos);
        desenharDeclaracao(doc, dados);
        doc.end();
    });
}
