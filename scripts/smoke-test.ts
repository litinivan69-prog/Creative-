import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.$connect();
  await prisma.$queryRaw`SELECT 1`;
  console.log("Database connectivity works.");
}

main()
  .catch((error) => {
    console.error("Smoke test failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
