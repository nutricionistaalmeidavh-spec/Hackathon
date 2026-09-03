import type { PluggyEnv } from '../server/pluggy';

export type AssetFetcher = {
  fetch(request: Request): Promise<Response>;
};

export type Env = PluggyEnv & {
  ASSETS: AssetFetcher;
};

export type RouteHandler = (request: Request, env: Env) => Promise<Response>;
