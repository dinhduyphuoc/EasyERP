import { prisma } from "@lib/prisma";

async function main() {
  const categories = await prisma.category.findMany({
    take: 5,
    orderBy: { category_name: "asc" },
  });

  console.log("Connected to database successfully.");
  console.log("Sample categories:", JSON.stringify(categories, null, 2));
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
