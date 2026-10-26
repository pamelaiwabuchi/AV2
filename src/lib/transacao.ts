import type { Prisma } from "../generated/prisma/client.js";
import { prisma } from "./prisma.js";

export type Transacao = Prisma.TransactionClient;

export async function executarTransacao<T>(idUsuario: string, operacao: (tx: Transacao) => Promise<T>) {
    return prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.usuario_id', ${idUsuario}, true)`;
        return operacao(tx);
    });
}