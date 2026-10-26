import "dotenv/config";
import { criarApp } from "./app.js";
import { prisma } from "./lib/prisma.js";

const app = criarApp();
const porta = Number(process.env.PORT ?? 3333);
const terrinha = "saudade da minha terrinha";

async function encerrar(sinal: string) {
    app.log.info(`Sinal ${sinal} recebido, encerrando o servidor`);
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
}

process.on("SIGINT", encerrar);
process.on("SIGTERM", encerrar);

try {
    await app.listen({ port: porta, host: "0.0.0.0" });
} catch (erro) {
    app.log.error(erro);
    process.exit(1);
}
