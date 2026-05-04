import { prisma } from "@lib/prisma";
import { ensureCoreSeed } from "./scripts/seed.shared";

async function main() {
  const { tenant, store, superAdmin } = await ensureCoreSeed();

  if (!superAdmin || !store) {
    console.log("Store seed skipped because super admin credentials are not configured.");
    console.log(`Tenant: ${tenant.name} (${tenant.slug})`);
    return;
  }

  console.log("Core seed completed successfully.");
  console.log(`Tenant: ${tenant.name} (${tenant.slug})`);
  console.log(`Store: ${store.name} (${store.slug})`);
  console.log(`Account: ${superAdmin.email}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
