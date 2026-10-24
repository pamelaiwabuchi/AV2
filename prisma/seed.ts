import bcrypt from "bcrypt";
import { prisma } from "../src/lib/prisma.js";

const CUSTO_BCRYPT = 10;

async function criarAdministrador() {
    const login = process.env.ADMIN_LOGIN;
    const senha = process.env.ADMIN_SENHA;

    if (!login || !senha) {
        throw new Error("Defina ADMIN_LOGIN e ADMIN_SENHA no arquivo .env");
    }

    const existente = await prisma.usuario.findUnique({ where: { login } });

    if (existente) {
        console.log(`Administrador "${login}" já existe, nada foi alterado.`);
        return;
    }

    const hashSenha = await bcrypt.hash(senha, CUSTO_BCRYPT);

    await prisma.usuario.create({
        data: {
            nome: "Administrador",
            login,
            hashSenha,
            papel: "ADMINISTRADOR",
        },
    });

    console.log(`Administrador "${login}" criado.`);
}

async function criarParametros() {
    const quantidade = await prisma.parametros.count();

    if (quantidade > 0) {
        console.log("Parâmetros já existem, nada foi alterado.");
        return;
    }

    await prisma.parametros.create({
        data: {
            aliquotaImposto: 0,
            depreciacaoComputadorMesa: 20,
            depreciacaoNotebook: 20,
            depreciacaoMonitor: 20,
            depreciacaoImpressora: 10,
            depreciacaoServidor: 20,
            depreciacaoRoteador: 20,
            depreciacaoCaboEstruturado: 10,
            depreciacaoFonteAlimentacao: 10,
        },
    });

    console.log("Parâmetros criados.");
}

async function main() {
    await criarAdministrador();
    await criarParametros();
}

try {
    await main();
} finally {
    await prisma.$disconnect();
}
