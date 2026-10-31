import { createAuth } from "./auth";
import { Logger } from "./logger";

/** Creates and alters every table: Better Auth's own and the app's plugin schemas. */
await createAuth().migrate();
new Logger("migrate").info("Database schema is up to date");
