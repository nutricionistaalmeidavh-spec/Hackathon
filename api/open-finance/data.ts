import type { VercelRequest, VercelResponse } from '@vercel/node';
import { pluggyClient } from '../../server/pluggy';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const client = pluggyClient();
  if (!client) return res.status(503).json({ error: 'Pluggy credentials are not configured.' });
  const itemId = String(req.body?.itemId || '').trim();
  if (!itemId) return res.status(400).json({ error: 'itemId is required.' });
  try {
    const accounts = await client.fetchAccounts(itemId);
    const rows: Array<Record<string, unknown>> = [];
    for (const account of accounts.results) {
      const txs = await client.fetchAllTransactions(account.id);
      for (const tx of txs) rows.push({ id: tx.id, date: tx.date, description: tx.description || tx.descriptionRaw || 'Movimentação', amount: tx.amount, type: tx.type, category: tx.category || null, accountName: account.name || account.marketingName || 'Conta' });
    }
    return res.status(200).json({ itemId, accounts: accounts.results.map(a => ({ id: a.id, name: a.name || a.marketingName || 'Conta', type: a.type, balance: a.balance, currencyCode: a.currencyCode || 'BRL' })), transactions: rows });
  } catch { return res.status(502).json({ error: 'Could not fetch Pluggy banking data.' }); }
}
