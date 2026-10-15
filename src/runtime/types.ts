export interface RequestIdentity {
  tenant: string;
  user: string;
}
declare global {
  namespace Express {
    interface Request {
      benchIdentity?: Readonly<RequestIdentity>;
    }
  }
}
export interface ServerOptions {
  capacity?: number;
  totalTenants?: number;
  port?: number;
  notify?: boolean;
  operationsCacheMaxLength?: number;
}
