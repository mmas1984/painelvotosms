const fs = require('fs');

const content = fs.readFileSync('public/assets/aistudio/VOTA__O_BAIRRO_-_P_gina1__1__2546806a.csv', 'utf8');
const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
const header = lines[0];

function parseLine(line) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === ',' && !inQuotes) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += c;
    }
  }
  result.push(cur.trim());
  return result;
}

const records = [];
for (let i = 1; i < lines.length; i++) {
  const parts = parseLine(lines[i]);
  if (parts.length >= 9) {
    records.push({
      ano: parts[0],
      turno: parts[1],
      municipio: parts[2],
      numero: parts[3],
      candidato: parts[4],
      bairro: parts[5],
      votos: parseInt(parts[6].replace(/\D/g, '') || '0', 10),
      perc: parseFloat(parts[7].replace(',', '.')) || 0,
      status: parts[8]
    });
  }
}

const totalVotos = records.reduce((acc, r) => acc + r.votos, 0);
const candidates = [...new Set(records.map(r => r.candidato))];
const bairros = [...new Set(records.map(r => r.bairro))];
const statuses = [...new Set(records.map(r => r.status))];

// Candidates stats
const candStats = {};
for (const r of records) {
  if (!candStats[r.candidato]) {
    candStats[r.candidato] = {
      nome: r.candidato,
      numero: r.numero,
      status: r.status,
      partido: r.numero.substring(0, 2),
      votosTotal: 0,
      bairrosCount: 0,
      topBairro: '',
      topBairroVotos: 0,
      bairrosComVotos: 0,
      votosList: []
    };
  }
  candStats[r.candidato].votosTotal += r.votos;
  candStats[r.candidato].bairrosCount++;
  if (r.votos > 0) candStats[r.candidato].bairrosComVotos++;
  candStats[r.candidato].votosList.push(r.votos);
  if (r.votos > candStats[r.candidato].topBairroVotos) {
    candStats[r.candidato].topBairroVotos = r.votos;
    candStats[r.candidato].topBairro = r.bairro;
  }
}

const sortedCand = Object.values(candStats).sort((a,b) => b.votosTotal - a.votosTotal);

// Bairro stats
const bairroStats = {};
for (const r of records) {
  if (!bairroStats[r.bairro]) {
    bairroStats[r.bairro] = {
      bairro: r.bairro,
      votosTotal: 0,
      candidatoLider: '',
      candidatoLiderVotos: 0,
      candidatoLiderPerc: 0
    };
  }
  bairroStats[r.bairro].votosTotal += r.votos;
  if (r.votos > bairroStats[r.bairro].candidatoLiderVotos) {
    bairroStats[r.bairro].candidatoLiderVotos = r.votos;
    bairroStats[r.bairro].candidatoLider = r.candidato;
  }
}

// Compute percentage for leaders
for (const b of Object.values(bairroStats)) {
  b.candidatoLiderPerc = (b.candidatoLiderVotos / b.votosTotal) * 100;
}

const sortedBairros = Object.values(bairroStats).sort((a,b) => b.votosTotal - a.votosTotal);

// Summary stats on Votos
const allVotos = records.map(r => r.votos).sort((a,b) => a - b);
const minVotos = allVotos[0];
const maxVotos = allVotos[allVotos.length - 1];
const avgVotos = totalVotos / allVotos.length;
const medianVotos = allVotos[Math.floor(allVotos.length / 2)];
const variance = allVotos.reduce((acc, v) => acc + Math.pow(v - avgVotos, 2), 0) / allVotos.length;
const stdDev = Math.sqrt(variance);

// Status aggregation
const statusAgg = {};
for (const c of sortedCand) {
  if (!statusAgg[c.status]) statusAgg[c.status] = { count: 0, votos: 0 };
  statusAgg[c.status].count++;
  statusAgg[c.status].votos += c.votosTotal;
}

// Party prefix map (Brazilian TSE numbers)
const partidoMap = {
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
  '25': 'PRD / PRD25',
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

const partyStats = {};
for (const c of sortedCand) {
  const p = partidoMap[c.partido] || 'Outro (' + c.partido + ')';
  if (!partyStats[p]) partyStats[p] = { partido: p, codigo: c.partido, candCount: 0, eleitos: 0, suplentes: 0, votos: 0 };
  partyStats[p].candCount++;
  if (c.status === 'ELEITO') partyStats[p].eleitos++;
  else partyStats[p].suplentes++;
  partyStats[p].votos += c.votosTotal;
}

const summary = {
  totalRows: records.length,
  totalVotos,
  candidatesCount: candidates.length,
  bairrosCount: bairros.length,
  minVotos,
  maxVotos,
  avgVotos: avgVotos.toFixed(2),
  medianVotos,
  stdDev: stdDev.toFixed(2),
  statusAgg,
  top10Candidates: sortedCand.slice(0, 10).map(c => ({
    nome: c.nome,
    numero: c.numero,
    partido: partidoMap[c.partido] || c.partido,
    status: c.status,
    votosTotal: c.votosTotal,
    topBairro: c.topBairro,
    topBairroVotos: c.topBairroVotos,
    concentracaoTopBairro: ((c.topBairroVotos / c.votosTotal) * 100).toFixed(1) + '%'
  })),
  top10Bairros: sortedBairros.slice(0, 10).map(b => ({
    bairro: b.bairro,
    votosTotal: b.votosTotal,
    candidatoLider: b.candidatoLider,
    candidatoLiderVotos: b.candidatoLiderVotos,
    candidatoLiderPerc: b.candidatoLiderPerc.toFixed(1) + '%'
  })),
  topPartidos: Object.values(partyStats).sort((a,b) => b.votos - a.votos).slice(0, 10)
};

console.log(JSON.stringify(summary, null, 2));

// Save JSON for embedding in the dashboard
fs.writeFileSync('src/data-summary.json', JSON.stringify({
  summary,
  allCandidates: sortedCand.map(c => ({
    nome: c.nome,
    numero: c.numero,
    partido: partidoMap[c.partido] || c.partido,
    codPartido: c.partido,
    status: c.status,
    votosTotal: c.votosTotal,
    topBairro: c.topBairro,
    topBairroVotos: c.topBairroVotos,
    concentracaoTopBairro: ((c.topBairroVotos / c.votosTotal) * 100).toFixed(1)
  })),
  allBairros: sortedBairros,
  partyStats: Object.values(partyStats).sort((a,b) => b.votos - a.votos)
}, null, 2));

// Also let us generate candidate-bairro matrix or compact records for full interactive cross-filtering
// Let us inspect size of records
console.log("Records length:", records.length);
fs.writeFileSync('src/records.json', JSON.stringify(records));
