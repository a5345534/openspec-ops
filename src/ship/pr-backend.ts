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

export interface PreflightRepositoryInput {
  cwd: string;
  remote: string;
  remoteUrl: string;
}

export interface PreflightRepositoryResult {
  repository: string;
}

/** Synchronous PR backend (CLI spawnSync style). */
export interface PrBackend {
  id: string;
  preflightRepository(input: PreflightRepositoryInput): PreflightRepositoryResult;
  createOrReusePullRequest(input: CreateOrReusePrInput): CreateOrReusePrResult;
}

export interface MergedPullRequest {
  number: number;
  url: string;
  baseRefName?: string;
}

export interface MergeStatusBackend {
  id: string;
  findMergedPullRequest(input: {
    cwd: string;
    head: string;
  }): MergedPullRequest | null;
}

export type PrBackendFactory = (id: string) => PrBackend;
