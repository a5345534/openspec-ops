/**
 * Archive slash parsing — single source lives in auto-ensure/parse.
 */
export {
  isOpsxArchiveIntent as isArchiveIntent,
  parseOpsxArchiveChangeName as parseArchiveChangeName,
  CHANGE_NAME_RE,
} from "../auto-ensure/parse.js";
