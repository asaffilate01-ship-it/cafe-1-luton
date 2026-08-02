type RpcError = { message: string } | null;

type RpcClient = {
  rpc: (
    name: string,
    args?: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: RpcError }>;
};

/**
 * Operations v2 is introduced by an additive migration. Keeping the RPC edge
 * small lets the checked-in generated database types be refreshed after the
 * migration is applied without weakening application validation in the
 * meantime.
 */
export async function callOperationsRpc<T>(
  client: unknown,
  name: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  const { data, error } = await (client as RpcClient).rpc(name, args);
  if (error) throw new Error(error.message);
  return data as T;
}
