import { interceptMain } from "./run-intercept.js";

const code = interceptMain(process.argv);
process.exit(code);
