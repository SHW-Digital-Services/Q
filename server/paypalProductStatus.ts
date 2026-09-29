type PayPalRequest = (path: string, init?: RequestInit) => Promise<any>;

// A catalogue visibility change must never create plans or update prices.
export async function syncPayPalProductStatus(product: any, request: PayPalRequest) {
  for (const id of new Set<string>([product.paypal_plan_id, product.paypal_founder_plan_id].filter(Boolean))) {
    const path = `/v1/billing/plans/${encodeURIComponent(id)}`;
    const plan = await request(path);
    if (!['ACTIVE', 'INACTIVE', 'CREATED'].includes(plan?.status)) throw new Error('PayPal returned an unsupported plan status.');
    if (product.active && plan.status !== 'ACTIVE') await request(`${path}/activate`, { method: 'POST' });
    if (!product.active && plan.status === 'ACTIVE') await request(`${path}/deactivate`, { method: 'POST' });
  }
}
