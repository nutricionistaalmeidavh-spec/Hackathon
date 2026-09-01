import * as XLSX from 'xlsx';
import type { Tx } from '../types';
import { safeDate } from '../core/financeEngine';

const clean = (v: string) => v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const parseMoney = (value: unknown) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  let s = String(value ?? '').trim().replace(/R\$/gi, '').replace(/\s/g, '');
  if (!s) return NaN;
  if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
  else if (s.includes(',')) s = s.replace(',', '.');
  return Number(s);
};

const normalizeDate = (value: unknown) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) return [parsed.y, String(parsed.m).padStart(2, '0'), String(parsed.d).padStart(2, '0')].join('-');
  }
  const s = String(value ?? '').trim();
  const ofx = s.match(/^(\d{4})(\d{2})(\d{2})/); if (ofx) return `${ofx[1]}-${ofx[2]}-${ofx[3]}`;
  const br = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/); if (br) return `${br[3]}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`;
  return safeDate(s) || '';
};

const pick = (row: Record<string, unknown>, names: string[]) => Object.entries(row).find(([key, value]) => names.some(n => clean(key).includes(n)) && String(value ?? '').trim() !== '')?.[1];

function rowsToTx(rows: Record<string, unknown>[], source: string): Tx[] {
  const out: Tx[] = [];
  rows.forEach((row, i) => {
    const date = normalizeDate(pick(row, ['data', 'date', 'dtposted', 'lancamento']));
    const description = String(pick(row, ['descricao', 'description', 'historico', 'memo', 'name', 'estabelecimento', 'favorecido']) ?? '').trim();
    let amount = parseMoney(pick(row, ['valor', 'amount', 'trnamt']));
    if (Number.isNaN(amount)) {
      const credit = parseMoney(pick(row, ['credito', 'credit'])), debit = parseMoney(pick(row, ['debito', 'debit']));
      if (!Number.isNaN(credit) && credit !== 0) amount = Math.abs(credit);
      else if (!Number.isNaN(debit) && debit !== 0) amount = -Math.abs(debit);
    }
    if (!date || !description || Number.isNaN(amount) || amount === 0) return;
    out.push({ id: `${source}_${i}`, date, amount: Math.round(Math.abs(amount) * 100), direction: amount < 0 ? 'debit' : 'credit', description: description.toUpperCase(), counterparty: description, status: 'unresolved' });
  });
  return out;
}

function parseOfx(text: string, source: string): Tx[] {
  const blocks = text.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) ?? [];
  const tag = (block: string, name: string) => block.match(new RegExp(`<${name}>([^<\\r\\n]+)`, 'i'))?.[1]?.trim() || '';
  return blocks.flatMap((block, index) => {
    const raw = parseMoney(tag(block, 'TRNAMT')), date = normalizeDate(tag(block, 'DTPOSTED'));
    const description = (tag(block, 'NAME') || tag(block, 'MEMO') || 'Movimentação').trim();
    if (!date || Number.isNaN(raw) || raw === 0) return [];
    return [{ id: `${source}_${tag(block, 'FITID') || index}`, date, amount: Math.round(Math.abs(raw) * 100), direction: raw < 0 ? 'debit' as const : 'credit' as const, description: description.toUpperCase(), counterparty: description, status: 'unresolved' as const }];
  });
}

export async function parseStatementFile(file: File): Promise<{ txs: Tx[]; note?: string }> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  const source = `${file.name}_${file.size}_${file.lastModified}`.replace(/[^a-zA-Z0-9]/g, '_');
  if (ext === 'ofx') return { txs: parseOfx(await file.text(), source) };
  if (ext === 'csv' || ext === 'txt') {
    const wb = XLSX.read(await file.text(), { type: 'string', cellDates: true });
    const rows = wb.SheetNames.flatMap(name => XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[name], { defval: '' }));
    return { txs: rowsToTx(rows, source) };
  }
  if (ext === 'xls' || ext === 'xlsx') {
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
    const rows = wb.SheetNames.flatMap(name => XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[name], { defval: '' }));
    return { txs: rowsToTx(rows, source) };
  }
  if (ext === 'pdf') return { txs: [], note: 'PDF ainda não é interpretado automaticamente.' };
  return { txs: [], note: 'Formato não suportado.' };
}
