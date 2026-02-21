import { PrismaClient } from "@prisma/client";
import { accountEncryptionExtension } from "./extensions/account-encryption";

function createExtendedClient() {
    const base = new PrismaClient();
    return base.$extends(accountEncryptionExtension());
}

type ExtendedPrismaClient = ReturnType<typeof createExtendedClient>;

declare global {
    // eslint-disable-next-line no-var
    var prisma: ExtendedPrismaClient | undefined;
}

export const prisma = globalThis.prisma || createExtendedClient();

if (process.env.NODE_ENV !== "production") {
    globalThis.prisma = prisma;
}

export * from "@prisma/client";
