export function isTransientMigrationConnectivityFailure(output: string): boolean {
  return /P1001|Can't reach database server|ECONNRESET|ETIMEDOUT/i.test(output)
}
