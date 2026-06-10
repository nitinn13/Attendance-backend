import pkg from "@prisma/client";

const { PrismaClient } = pkg;

console.log("Prisma loaded successfully");

export const prisma = new PrismaClient();
