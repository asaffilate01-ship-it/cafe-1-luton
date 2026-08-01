export const ORDER_TRANSITIONS = {
  pending_payment: ["cancelled"],
  paid: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["completed", "out_for_delivery"],
  out_for_delivery: ["delivered"],
  delivered: ["completed"],
  completed: [],
  cancelled: [],
} as const;

export type ManagedOrderStatus = keyof typeof ORDER_TRANSITIONS;

export function canTransitionOrder(current: ManagedOrderStatus, next: ManagedOrderStatus): boolean {
  return (ORDER_TRANSITIONS[current] as readonly ManagedOrderStatus[]).includes(next);
}
