import { db, migrate } from "./database.js";
try {
  await migrate();
  console.log("Database migrations applied.");
} finally {
  await db.close();
}
