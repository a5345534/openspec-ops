export { parseOpenspecArgv, type NewChangeIntercept } from "./parse-argv.js";
export {
  parseInterceptNewChangePolicy,
  type InterceptNewChangePolicy,
} from "./policy.js";
export { resolveRealOpenspec } from "./resolve-real-openspec.js";
export {
  runOpenspecIntercept,
  interceptMain,
  type InterceptDeps,
  type InterceptResult,
} from "./run-intercept.js";
