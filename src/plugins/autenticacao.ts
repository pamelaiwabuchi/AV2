import fastifyJwt from "@fastify/jwt";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { PapelUsuario } from "../generated/prisma/enums.js";
import { ErroNaoAutenticado, ErroSemPermissao } from "../errors/erros.js";

export interface DadosToken {
    id: string;
    papel: PapelUsuario;
    precisaTrocarSenha: boolean;
}

declare module "@fastify/jwt" {
    interface FastifyJWT {
        payload: DadosToken;
        user: DadosToken;
    }
}

export function registrarJwt(app: FastifyInstance) {
    const segredo = process.env.JWT_SECRET;

    if (!segredo) {
        throw new Error("A variável JWT_SECRET não foi definida no arquivo .env");
    }

    app.register(fastifyJwt, {
        secret: segredo,
        sign: { expiresIn: "30m" },
    });
}

export async function verificarToken(request: FastifyRequest) {
    try {
        await request.jwtVerify();
    } catch {
        throw new ErroNaoAutenticado("Token ausente, inválido ou expirado");
    }
}

export async function exigirLogin(request: FastifyRequest) {
    await verificarToken(request);

    if (request.user.precisaTrocarSenha) {
        throw new ErroSemPermissao("Troque sua senha antes de continuar");
    }
}

export function exigirPapel(...papeis: PapelUsuario[]) {
    return async (request: FastifyRequest) => {
        await exigirLogin(request);

        if (request.user.papel === "ADMINISTRADOR") {
            return;
        }

        if (!papeis.includes(request.user.papel)) {
            throw new ErroSemPermissao();
        }
    };
}
