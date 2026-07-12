export interface CreateOrReusePrInput {
  cwd: string;
  base: string;
  head: string;
  title: string;
  body: string;
  draft: boolean;
}

export interface CreateOrReusePrResult {
  url: string;
  number: number;
  alreadyExisted?: boolean;
}

/** Synchronous PR backend (CLI spawnSync style). */
export interface PrBackend {
  id: string;
  createOrReusePullRequest(input: CreateOrReusePrInput): CreateOrReusePrResult;
}

export type PrBackendFactory = (id: string) => PrBackend;
