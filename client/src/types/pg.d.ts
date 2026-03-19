/**
 * Minimal type declarations for 'pg' module
 * Used by development scripts
 */
declare module 'pg' {
  export interface QueryResult<R = Record<string, unknown>> {
    rows: R[];
    rowCount: number | null;
    command: string;
    oid: number;
    fields: Array<{ name: string; dataTypeID: number }>;
  }

  export interface ClientConfig {
    connectionString?: string;
    host?: string;
    port?: number;
    database?: string;
    user?: string;
    password?: string;
  }

  export class Client {
    constructor(config?: ClientConfig | string);
    connect(): Promise<void>;
    query<R = Record<string, unknown>>(text: string, values?: unknown[]): Promise<QueryResult<R>>;
    end(): Promise<void>;
  }

  export class Pool {
    constructor(config?: ClientConfig);
    connect(): Promise<Client>;
    query<R = Record<string, unknown>>(text: string, values?: unknown[]): Promise<QueryResult<R>>;
    end(): Promise<void>;
  }

  const pg: {
    Client: typeof Client;
    Pool: typeof Pool;
  };

  export default pg;
}
