// Textos que aparecem no Swagger (/docs): o grupo de cada rota, um resumo do que ela faz
// (com os papéis que podem usá-la) e um exemplo de corpo pronto para o "Try it out".

const ID_DE_EXEMPLO = "00000000-0000-0000-0000-000000000000";

export const grupos = [
    { name: "Autenticação", description: "Login, troca da própria senha e perfil" },
    { name: "Usuários", description: "Cadastro de usuários (só ADMINISTRADOR)" },
    { name: "Departamentos", description: "Setores da empresa e seus funcionários (só ADMINISTRADOR)" },
    { name: "Organizações", description: "Clientes que enviam equipamentos" },
    { name: "Contratos", description: "Contratos de coleta das organizações" },
    { name: "Destinos", description: "Parceiros que recebem os equipamentos (reciclagem, peças, descarte)" },
    { name: "Lotes", description: "Chegada de equipamentos de uma organização" },
    { name: "Equipamentos", description: "Triagem, avaliação e movimentação de cada equipamento" },
    { name: "Movimentações", description: "Todas as mudanças de status, com filtros" },
    { name: "Painel e relatórios", description: "Resumo por papel e relatórios" },
    { name: "Certificados", description: "Certificado de destinação final em PDF (lote ou período)" },
    { name: "Auditoria e parâmetros", description: "Histórico de alterações e configurações globais" },
    { name: "Sistema", description: "Situação do servidor" },
];

const grupoPorCaminho: Record<string, string> = {
    auth: "Autenticação",
    usuarios: "Usuários",
    departamentos: "Departamentos",
    organizacoes: "Organizações",
    contratos: "Contratos",
    destinos: "Destinos",
    lotes: "Lotes",
    equipamentos: "Equipamentos",
    movimentacoes: "Movimentações",
    painel: "Painel e relatórios",
    relatorios: "Painel e relatórios",
    auditoria: "Auditoria e parâmetros",
    parametros: "Auditoria e parâmetros",
};

export function grupoDaRota(url: string) {
    if (url.endsWith("/certificado")) {
        return "Certificados";
    }

    if (url.endsWith("/contratos")) {
        return "Contratos";
    }

    const primeiraParte = url.split("/")[1] ?? "";
    return grupoPorCaminho[primeiraParte] ?? "Sistema";
}

export const resumos: Record<string, string> = {
    "POST /auth/login": "Faz login e devolve o token (todos)",
    "PATCH /auth/senha": "Troca a própria senha; obrigatório no primeiro acesso (todos)",
    "GET /auth/perfil": "Mostra os dados do usuário logado (todos)",

    "GET /usuarios": "Lista os usuários; busca por nome ou login e filtros de papel, departamento (id ou nome), ativo e bloqueado (ADMINISTRADOR)",
    "GET /usuarios/:id": "Mostra um usuário (ADMINISTRADOR)",
    "GET /usuarios/login/:login": "Mostra um usuário pelo login, ex.: ana.operadora (ADMINISTRADOR)",
    "POST /usuarios": "Cria um usuário com senha provisória; o departamentoId vem de GET /departamentos (ADMINISTRADOR)",
    "PATCH /usuarios/:id": "Altera nome, papel, departamento e/ou ativo; ativo false desativa (ADMINISTRADOR)",

    "GET /departamentos": "Lista os departamentos com a quantidade de usuários; busca por nome e filtro ativo (ADMINISTRADOR)",
    "GET /departamentos/:id": "Mostra um departamento (ADMINISTRADOR)",
    "GET /departamentos/:id/usuarios": "Lista os usuários ativos do departamento; busca por nome ou login (ADMINISTRADOR)",
    "POST /departamentos": "Cria um departamento; o nome não pode repetir (ADMINISTRADOR)",
    "PATCH /departamentos/:id": "Altera o nome e/ou ativo; desativado não recebe usuário novo (ADMINISTRADOR)",
    "PATCH /usuarios/:id/senha": "Redefine a senha de alguém; ela volta a ser provisória (ADMINISTRADOR)",

    "GET /organizacoes": "Lista as organizações; busca por razão social ou CNPJ (OPERADOR_CADASTRO, AUDITOR)",
    "GET /organizacoes/resumo": "Lista resumida das ativas com contrato vigente (GESTOR, OPERADOR_CADASTRO, AUDITOR)",
    "GET /organizacoes/:id": "Mostra uma organização (OPERADOR_CADASTRO, AUDITOR)",
    "POST /organizacoes": "Cadastra uma organização (OPERADOR_CADASTRO)",
    "PATCH /organizacoes/:id": "Altera dados da organização; ativo false desativa (OPERADOR_CADASTRO)",

    "GET /contratos": "Lista os contratos; filtros de situação, vencendoEmDias (ex.: 30), ano, organização por id, nome ou CNPJ (OPERADOR_CADASTRO, AUDITOR)",
    "GET /organizacoes/:id/contratos": "Lista os contratos de uma organização (OPERADOR_CADASTRO, AUDITOR)",
    "GET /contratos/:id": "Mostra um contrato com a situação FUTURO, VIGENTE ou ENCERRADO (OPERADOR_CADASTRO, AUDITOR)",
    "POST /contratos": "Cria um contrato (OPERADOR_CADASTRO)",
    "PATCH /contratos/:id": "Altera um contrato que ainda não começou (OPERADOR_CADASTRO)",
    "PATCH /contratos/:id/renovar": "Estende o vencimento de um contrato vigente (OPERADOR_CADASTRO)",
    "PATCH /contratos/:id/encerrar": "Encerra um contrato vigente hoje (OPERADOR_CADASTRO)",
    "DELETE /contratos/:id": "Apaga um contrato que ainda não começou (OPERADOR_CADASTRO)",

    "GET /destinos": "Lista os parceiros de destino; o gestor vê só os ativos (OPERADOR_CADASTRO, GESTOR, AUDITOR)",
    "GET /destinos/:id": "Mostra um destino (OPERADOR_CADASTRO, GESTOR, AUDITOR)",
    "POST /destinos": "Cadastra um destino (OPERADOR_CADASTRO)",
    "PATCH /destinos/:id": "Altera um destino; ativo false desativa (OPERADOR_CADASTRO)",

    "GET /lotes": "Lista os lotes; filtros de status, ano de entrada, nota fiscal, transportadora e organização por id, nome ou CNPJ (GESTOR, OPERADOR_CADASTRO, AUDITOR)",
    "GET /lotes/parados": "Lotes sem andar há mais dias que o configurado (GESTOR, OPERADOR_CADASTRO, AUDITOR)",
    "GET /lotes/:id": "Mostra um lote com seus equipamentos e peso total (GESTOR, OPERADOR_CADASTRO, AUDITOR)",
    "POST /lotes": "Registra a chegada de um lote com seus equipamentos; o código de barras é gerado pelo sistema (GESTOR)",
    "PATCH /lotes/:id": "Altera nota fiscal, transportadora e/ou observações de um lote RECEBIDO (GESTOR)",
    "PATCH /lotes/:id/cancelar": "Cancela um lote RECEBIDO e todos os seus equipamentos (GESTOR)",
    "POST /lotes/:id/equipamentos": "Adiciona um equipamento a um lote; o código de barras é gerado pelo sistema (GESTOR)",

    "GET /equipamentos": "Lista os equipamentos; filtros de status, tipo, código, marca, modelo, ano de fabricação, ano de entrada, estado físico, lote, organização e parceiro de destino por id, nome ou CNPJ (GESTOR, OPERADOR_CADASTRO, AUDITOR)",
    "GET /equipamentos/codigo/:codigo": "Busca pelo código de barras, ex.: GC-2026-000001 (GESTOR, OPERADOR_CADASTRO, AUDITOR)",
    "GET /equipamentos/:id": "Mostra um equipamento com a depreciação (GESTOR, OPERADOR_CADASTRO, AUDITOR)",
    "GET /equipamentos/:id/historico": "Histórico de movimentações do equipamento (GESTOR, AUDITOR)",
    "PATCH /equipamentos/:id": "Altera tipo, marca, modelo, ano e/ou peso enquanto AGUARDANDO_TRIAGEM (GESTOR)",
    "PATCH /equipamentos/:id/avaliacao": "Avalia o estado físico; queda de 2 níveis ou mais exige justificativa (GESTOR)",
    "POST /equipamentos/:id/movimentar": "Muda o status de um equipamento pelo id (GESTOR)",
    "POST /equipamentos/:id/corrigir": "Desfaz uma movimentação errada e as seguintes; o equipamento volta ao status de antes dela (GESTOR)",
    "POST /equipamentos/codigo/:codigo/movimentar": "Muda o status de um equipamento pelo código de barras (GESTOR)",
    "POST /equipamentos/movimentar-varios": "Muda o status de vários equipamentos pelos códigos de barras; tudo ou nada (GESTOR)",

    "GET /movimentacoes": "Lista as movimentações; filtros de período ou ano, status de destino, código do equipamento e responsável (id ou login) (GESTOR, AUDITOR)",

    "GET /painel": "Resumo com os números que interessam ao seu papel (todos)",
    "GET /relatorios/destinacao": "Kg por tipo de destinação e parceiro, de uma organização ou de todas (GESTOR, OPERADOR_CADASTRO, AUDITOR)",
    "GET /lotes/:id/certificado": "Baixa o certificado de destinação em PDF de um lote FINALIZADO (GESTOR, OPERADOR_CADASTRO, AUDITOR)",
    "GET /organizacoes/:id/certificado": "Baixa o certificado em PDF com os lotes da organização finalizados no período (GESTOR, OPERADOR_CADASTRO, AUDITOR)",
    "GET /relatorios/financeiro": "Receita, impostos e receita líquida por organização (AUDITOR)",

    "GET /auditoria": "Histórico de todas as alterações; filtros de período ou ano, tabela, registro e usuário (id ou login) (AUDITOR)",
    "GET /parametros": "Mostra alíquota, depreciação e dias de lote parado (AUDITOR)",
    "PATCH /parametros": "Altera os parâmetros globais (ADMINISTRADOR)",

    "GET /health": "Confere se o servidor está no ar (sem login)",
    "GET /": "Abre a documentação (Swagger)",

};

const hoje = new Date().toISOString().slice(0, 10);
const anoAtual = new Date().getFullYear();

export const exemplos: Record<string, object> = {
    "POST /auth/login": { login: "admin", senha: "troque-esta-senha" },
    "PATCH /auth/senha": { senhaAtual: "troque-esta-senha", novaSenha: "Admin2026" },

    "POST /usuarios": { nome: "Ana Souza", login: "ana.souza", senha: "Greencode1", papel: "OPERADOR_CADASTRO", departamentoId: ID_DE_EXEMPLO },
    "PATCH /usuarios/:id": { nome: "Ana Souza Lima", versao: 1 },
    "PATCH /usuarios/:id/senha": { novaSenha: "Greencode1" },

    "POST /departamentos": { nome: "Logística" },
    "PATCH /departamentos/:id": { nome: "Logística e Transporte", versao: 1 },

    "POST /organizacoes": {
        razaoSocial: "Mercado Bom Preço Ltda",
        cnpj: "11.222.333/0001-81",
        inscricaoEstadual: "123123123",
        enderecoCompleto: "Rua das Flores, 50 - São José dos Campos/SP",
        telefone: "(12) 3900-1000",
        email: "ti@bompreco.com.br",
    },
    "PATCH /organizacoes/:id": { telefone: "(12) 3900-2000", versao: 1 },

    "POST /contratos": {
        organizacaoId: ID_DE_EXEMPLO,
        dataAssinatura: "2027-01-01",
        dataVencimento: "2027-12-31",
        clausulas: ["Coleta mensal de equipamentos", "Emissão de certificado de destinação"],
        valorMensal: 1500,
        renovacaoAutomatica: false,
    },
    "PATCH /contratos/:id": { valorMensal: 1800, versao: 1 },
    "PATCH /contratos/:id/renovar": { novoVencimento: "2028-12-31", versao: 1 },
    "PATCH /contratos/:id/encerrar": { versao: 1 },

    "POST /destinos": {
        razaoSocial: "Verde Ciclo Reciclagem Ltda",
        cnpj: "45.723.174/0001-10",
        enderecoCompleto: "Av. Industrial, 900 - Jacareí/SP",
        telefone: "(12) 3950-3000",
        email: "contato@verdeciclo.com.br",
    },
    "PATCH /destinos/:id": { telefone: "(12) 3950-4000", versao: 1 },

    "POST /lotes": {
        organizacaoId: ID_DE_EXEMPLO,
        dataEntrada: hoje,
        notaFiscal: "NF-3001",
        transportadora: "TransLog",
        observacoes: "Duas caixas",
        equipamentos: [
            {
                tipo: "NOTEBOOK",
                marca: "Dell",
                modelo: "Latitude 5400",
                anoFabricacao: 2020,
                estadoFisico: "USADO_LEVE",
                pesoQuilogramas: 1.8,
            },
        ],
    },
    "PATCH /lotes/:id": { observacoes: "Uma caixa chegou molhada", versao: 1 },
    "PATCH /lotes/:id/cancelar": { versao: 1 },
    "POST /lotes/:id/equipamentos": {
        tipo: "MONITOR",
        marca: "LG",
        modelo: "24MK430",
        anoFabricacao: 2019,
        estadoFisico: "BOM_ESTADO",
        pesoQuilogramas: 3.2,
    },

    "PATCH /equipamentos/:id": { marca: "Dell Technologies", versao: 1 },
    "PATCH /equipamentos/:id/avaliacao": { estadoFisico: "DANIFICADO_GRAVE", justificativa: "Tela trincada", versao: 1 },
    "POST /equipamentos/:id/movimentar": { novoStatus: "EM_TRIAGEM", versao: 1 },
    "POST /equipamentos/:id/corrigir": { movimentacaoId: ID_DE_EXEMPLO, justificativa: "Era para reciclagem, não descarte", versao: 3 },
    "POST /equipamentos/codigo/:codigo/movimentar": { novoStatus: "EM_TRIAGEM", versao: 1 },
    "POST /equipamentos/movimentar-varios": { codigos: [`GC-${anoAtual}-000007`, `GC-${anoAtual}-000008`], novoStatus: "EM_TRIAGEM" },

    "PATCH /parametros": { diasLoteParado: 45, versao: 1 },
};
