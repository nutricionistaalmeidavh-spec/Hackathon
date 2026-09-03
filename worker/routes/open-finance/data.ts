import { jsonResponse, listAccounts, listAllTransactions } from '../../../server/pluggy';
import type { RouteHandler } from '../../types';

export const handleData: RouteHandler = async (request, env) => {
  let body: { itemId?: unknown };
  try {
    body = await request.json() as { itemId?: unknown };
  } catch {
    return jsonResponse({ error: 'Invalid JSON body.' }, 400);
  }

  const itemId = String(body.itemId || '').trim();
  if (!itemId) return jsonResponse({ error: 'itemId is required.' }, 400);

  try {
    const accounts = await listAccounts(env, itemId);
    const transactions: Array<Record<string, unknown>> = [];

    for (const account of accounts) {
      const rows = await listAllTransactions(env, String(account.id));
      for (const tx of rows) {
        transactions.push({
          id: tx.id,
          date: tx.date,
          description: tx.description || tx.descriptionRaw || 'Movimentação',
          amount: tx.amount,
          type: tx.type,
          category: tx.category || null,
          accountName: account.name || account.marketingName || 'Conta',
        });
      }
    }

    return jsonResponse({
      itemId,
      accounts: accounts.map(account => ({
        id: account.id,
        name: account.name || account.marketingName || 'Conta',
        type: account.type,
        balance: account.balance,
        currencyCode: account.currencyCode || 'BRL',
      })),
      transactions,
    });
  } catch (error) {
    console.error('pluggy_data_failed', error instanceof Error ? error.message : 'unknown_error');
    return jsonResponse({ error: 'Could not fetch Pluggy banking data.' }, 502);
  }
};
