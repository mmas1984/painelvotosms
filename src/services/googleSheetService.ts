// Service to fetch and synchronize live data from the user's Google Drive Spreadsheet
// Spreadsheet URL: https://docs.google.com/spreadsheets/d/1hJTkzxCQqYIGZe323mK5BWqsdegBfhuSccnRKq8pOd0/edit?usp=sharing

export const SPREADSHEET_ID = '1hJTkzxCQqYIGZe323mK5BWqsdegBfhuSccnRKq8pOd0';
export const SPREADSHEET_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit?usp=sharing`;

// Google visualization CSV endpoint (fast, public, direct CORS)
export const GVIZ_CSV_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv`;
// Standard Google export CSV endpoint (backup)
export const EXPORT_CSV_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv`;

export interface RecordItem {
  ano: string;
  turno: string;
  municipio: string;
  cargo: string;
  numero: string;
  candidato: string;
  bairro: string;
  votos: number;
  perc: number;
  status: string;
  partido: string;
}

export const PARTIDO_MAP: Record<string, string> = {
  '10': 'REPUBLICANOS',
  '11': 'PP',
  '12': 'PDT',
  '13': 'PT',
  '14': 'PTB',
  '15': 'MDB',
  '16': 'PSTU',
  '18': 'REDE',
  '20': 'PODE',
  '21': 'PCB',
  '22': 'PL',
  '23': 'CIDADANIA',
  '25': 'PRD',
  '27': 'DC',
  '28': 'PRTB',
  '29': 'PCO',
  '30': 'NOVO',
  '33': 'MOBILIZA',
  '35': 'PMB',
  '36': 'AGIR',
  '40': 'PSB',
  '43': 'PV',
  '44': 'UNIÃO',
  '45': 'PSDB',
  '50': 'PSOL',
  '55': 'PSD',
  '70': 'AVANTE',
  '77': 'SOLIDARIEDADE'
};

export function getPartidoFromNumero(numero: string): string {
  const prefix = numero.trim().substring(0, 2);
  return PARTIDO_MAP[prefix] || (prefix ? `Legenda ${prefix}` : 'Outros');
}

/**
 * Robust RFC-4180 CSV parser that properly handles quoted strings containing
 * commas, newlines, and escaped quotes.
 */
export function parseCSVToRows(csvText: string): string[][] {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length === 0) return [];

  const rows: string[][] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const row: string[] = [];
    let inQuotes = false;
    let curr = '';

    for (let j = 0; j < line.length; j++) {
      const c = line[j];
      if (c === '"') {
        if (inQuotes && line[j + 1] === '"') {
          curr += '"';
          j++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === ',' && !inQuotes) {
        row.push(curr.trim());
        curr = '';
      } else {
        curr += c;
      }
    }
    row.push(curr.trim());
    rows.push(row);
  }

  return rows;
}

/**
 * Normalizes raw CSV rows into typed RecordItem objects.
 */
export function parseGoogleSheetCSV(csvText: string): RecordItem[] {
  const rows = parseCSVToRows(csvText);
  if (rows.length < 2) return [];

  // Determine column index map from header line
  const headers = rows[0].map(h => h.replace(/^"|"$/g, '').trim().toLowerCase());
  
  const getIdx = (candidates: string[]) => {
    for (const cand of candidates) {
      const idx = headers.findIndex(h => h.includes(cand));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const anoIdx = getIdx(['ano']);
  const turnoIdx = getIdx(['turno']);
  const munIdx = getIdx(['município', 'municipio']);
  const cargoIdx = getIdx(['cargo']);
  const numIdx = getIdx(['número', 'numero']);
  const candIdx = getIdx(['candidato']);
  const bairroIdx = getIdx(['bairro', 'localidade', 'municipio']);
  const votosIdx = getIdx(['voto']);
  const percIdx = getIdx(['%', 'perc', 'obtid']);
  const statusIdx = getIdx(['status', 'situacao', 'situação']);

  const records: RecordItem[] = [];

  for (let i = 1; i < rows.length; i++) {
    const raw = rows[i];
    if (raw.length < 5) continue;

    const clean = raw.map(c => c.replace(/^"|"$/g, '').trim());

    const ano = (anoIdx !== -1 && clean[anoIdx]) ? clean[anoIdx] : (clean[0] || '2024');
    const turno = (turnoIdx !== -1 && clean[turnoIdx]) ? clean[turnoIdx] : (clean[1] || '1');
    const municipio = (munIdx !== -1 && clean[munIdx]) ? clean[munIdx] : (clean[2] || 'FORTALEZA');
    const cargo = (cargoIdx !== -1 && clean[cargoIdx])
      ? clean[cargoIdx]
      : (ano === '2026' ? 'Deputado Estadual' : 'Vereador');
    const numero = (numIdx !== -1 && clean[numIdx]) ? clean[numIdx] : (clean[4] || '');
    const candidato = (candIdx !== -1 && clean[candIdx]) ? clean[candIdx] : (clean[5] || '');
    const bairro = (bairroIdx !== -1 && clean[bairroIdx]) ? clean[bairroIdx] : (clean[6] || '');
    
    // Parse votos integer
    const rawVotos = (votosIdx !== -1 && clean[votosIdx]) ? clean[votosIdx] : (clean[7] || '0');
    const votos = parseInt(rawVotos.replace(/\D/g, ''), 10) || 0;

    // Parse percentage
    const rawPerc = (percIdx !== -1 && clean[percIdx]) ? clean[percIdx] : (clean[8] || '0');
    const perc = parseFloat(rawPerc.replace(',', '.')) || 0;

    // Status
    const rawStatus = (statusIdx !== -1 && clean[statusIdx]) ? clean[statusIdx] : (clean[9] || '');
    const status = rawStatus.toUpperCase();

    // Skip empty lines without candidate or votes
    if (!candidato && votos === 0) continue;

    records.push({
      ano,
      turno,
      municipio,
      cargo,
      numero,
      candidato,
      bairro,
      votos,
      perc,
      status,
      partido: getPartidoFromNumero(numero)
    });
  }

  return records;
}

const CACHE_KEY = 'FZ_ELEICOES_SHEET_RECORDS_V2';
const CACHE_TIME_KEY = 'FZ_ELEICOES_SHEET_LAST_SYNC';

/**
 * Fetches the latest spreadsheet data with cache-busting, fallback mechanisms
 * and localStorage persistence.
 */
export async function fetchGoogleSheetRecords(): Promise<{
  records: RecordItem[];
  lastSyncTime: Date;
  source: 'google_sheets_gviz' | 'google_sheets_export' | 'local_storage';
}> {
  const timestamp = Date.now();
  let csvText = '';
  let source: 'google_sheets_gviz' | 'google_sheets_export' | 'local_storage' = 'google_sheets_gviz';

  // 1. Try gviz CSV endpoint first (direct CORS, no redirect)
  try {
    const res = await fetch(`${GVIZ_CSV_URL}&_t=${timestamp}`, {
      headers: { Accept: 'text/csv, text/plain, */*' },
      cache: 'no-store'
    });
    if (res.ok) {
      csvText = await res.text();
    } else {
      throw new Error(`GViz returned HTTP ${res.status}`);
    }
  } catch (err1) {
    console.warn('GViz fetch failed, trying export?format=csv fallback:', err1);
    // 2. Try export?format=csv endpoint
    try {
      const res = await fetch(`${EXPORT_CSV_URL}&_t=${timestamp}`, {
        headers: { Accept: 'text/csv, text/plain, */*' },
        cache: 'no-store'
      });
      if (res.ok) {
        csvText = await res.text();
        source = 'google_sheets_export';
      } else {
        throw new Error(`Export returned HTTP ${res.status}`);
      }
    } catch (err2) {
      console.warn('Both live endpoints failed:', err2);
      // 3. Fallback to localStorage if available
      const cachedData = localStorage.getItem(CACHE_KEY);
      const cachedTime = localStorage.getItem(CACHE_TIME_KEY);
      if (cachedData) {
        try {
          const parsed = JSON.parse(cachedData);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return {
              records: parsed,
              lastSyncTime: cachedTime ? new Date(cachedTime) : new Date(),
              source: 'local_storage'
            };
          }
        } catch {
          // Ignore cache parse error
        }
      }
      throw err2;
    }
  }

  const parsedRecords = parseGoogleSheetCSV(csvText);
  if (!parsedRecords || parsedRecords.length === 0) {
    throw new Error('Planilha retornou 0 registros válidos.');
  }

  const now = new Date();
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(parsedRecords));
    localStorage.setItem(CACHE_TIME_KEY, now.toISOString());
  } catch {
    // LocalStorage quota may be exceeded, safely ignore
  }

  return {
    records: parsedRecords,
    lastSyncTime: now,
    source
  };
}
