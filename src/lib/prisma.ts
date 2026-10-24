import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

const urlBanco = process.env.DATABASE_URL;

if (!urlBanco) {
    throw new Error("A variável DATABASE_URL não foi definida no arquivo .env");
}

const adaptador = new PrismaPg({ connectionString: urlBanco });

export const prisma = new PrismaClient({ adapter: adaptador });
