import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import * as echarts from 'echarts';
import {
  Download,
  Filter,
  RotateCcw,
  Search,
  ChevronLeft,
  ChevronRight,
  MapPin,
  ExternalLink,
  ArrowUpDown,
  BookOpen,
  Map as MapIcon,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Database,
  TrendingUp,
  Briefcase,
  ShieldCheck,
  User,
  LogOut,
  KeyRound,
  Shield,
  Layers
} from 'lucide-react';

import rawRecords from './records.json';
import fortalezaGeoJson from './fortaleza_map.json';
import cearaGeoJson from './ceara_map.json';
import {
  fetchGoogleSheetRecords,
  SPREADSHEET_URL,
  SPREADSHEET_ID,
  RecordItem,
  PARTIDO_MAP,
  getPartidoFromNumero
} from './services/googleSheetService';
import {
  UserAccount,
  getSessionUser,
  getCurrentUser,
  setCurrentUser as persistCurrentUser,
  logoutUser,
  getStoredUsers
} from './services/authService';
import AccessManager from './components/AccessManager';
import LoginModal from './components/LoginModal';
import LoginPage from './components/LoginPage';

// Register maps globally once
echarts.registerMap('fortaleza', fortalezaGeoJson as any);
echarts.registerMap('ceara', cearaGeoJson as any);

export default function App() {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'overview' | 'mapa' | 'redutos' | 'candidato' | 'bairro' | 'tabela' | 'auditoria' | 'acesso'>('overview');

  // User Authentication & RBAC Session State - starts on initial LoginPage if not authenticated
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(getSessionUser);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => getSessionUser() !== null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);

  // Google Sheets Live Data State
  const [records, setRecords] = useState<RecordItem[]>(() => {
    return (rawRecords as any[]).map(r => ({
      ano: String(r.ano || '2024'),
      turno: String(r.turno || '1'),
      municipio: String(r.municipio || (r.ano === '2026' ? 'CEARÁ' : 'FORTALEZA')),
      cargo: String(r.cargo || (r.ano === '2026' ? 'Deputado Estadual' : 'Vereador')),
      numero: String(r.numero || ''),
      candidato: String(r.candidato || ''),
      bairro: String(r.bairro || ''),
      votos: Number(r.votos || 0),
      perc: Number(r.perc || 0),
      status: String(r.status || ''),
      partido: r.partido || getPartidoFromNumero(String(r.numero || ''))
    }));
  });

  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(new Date());
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [syncErrorMessage, setSyncErrorMessage] = useState<string | null>(null);
  const [syncNotification, setSyncNotification] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<string>('Google Drive (Ao Vivo)');

  // Global Dynamic Filters (with "Ano" and "Cargo")
  const [anoFilter, setAnoFilter] = useState<string>('ALL');
  const [cargoFilter, setCargoFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [partyFilter, setPartyFilter] = useState<string>('ALL');
  const [candidateFilter, setCandidateFilter] = useState<string>('ALL');
  const [bairroFilter, setBairroFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Map Mode and Type
  const [mapMode, setMapMode] = useState<'volume' | 'candidato' | 'vencedor'>('volume');
  const [mapCandidate, setMapCandidate] = useState<string>('PRISCILA COSTA');
  const [hoveredOrSelectedBairro, setHoveredOrSelectedBairro] = useState<string>('MESSEJANA');
  // Manual override map toggle for "ALL" years
  const [manualMapChoice, setManualMapChoice] = useState<'ceara' | 'fortaleza'>('fortaleza');

  // Selected for drilldown tabs
  const [selectedCandidate, setSelectedCandidate] = useState<string>('PRISCILA COSTA');
  const [selectedBairro, setSelectedBairro] = useState<string>('MESSEJANA');

  // Bairro Candidate Comparator State
  const [compareCand1, setCompareCand1] = useState<string>('MARCEL COLARES');
  const [compareCand2, setCompareCand2] = useState<string>('PRISCILA COSTA');
  const [compareCand3, setCompareCand3] = useState<string>('LUIZ PAUPINA');
  const [compareChartType, setCompareChartType] = useState<'bar' | 'radar'>('bar');
  const bairroCompareChartRef = useRef<HTMLDivElement>(null);

  // Table pagination & sort
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);
  const [sortField, setSortField] = useState<keyof RecordItem>('votos');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  // Synchronize with Google Sheets
  const handleSyncWithGoogleSheets = useCallback(async (notify = true) => {
    setIsSyncing(true);
    setSyncStatus('syncing');
    setSyncErrorMessage(null);
    try {
      const result = await fetchGoogleSheetRecords();
      setRecords(result.records);
      setLastSyncTime(result.lastSyncTime);
      setSyncStatus('success');
      setDataSource(result.source.includes('google') ? 'Google Drive (Ao Vivo)' : 'Cache Local');
      if (notify) {
        setSyncNotification(`Sincronizado! ${result.records.length.toLocaleString('pt-BR')} registros carregados da planilha.`);
        setTimeout(() => setSyncNotification(null), 5000);
      }
    } catch (err: any) {
      console.error('Falha ao sincronizar com Google Sheets:', err);
      setSyncStatus('error');
      setSyncErrorMessage(err?.message || 'Erro ao conectar à planilha do Google Drive');
      if (notify) {
        setSyncNotification(`Aviso: utilizando dados em cache (${err?.message || 'sem conexão'}).`);
        setTimeout(() => setSyncNotification(null), 6000);
      }
    } finally {
      setIsSyncing(false);
    }
  }, []);

  // Sync on startup and periodic polling every 60 seconds
  useEffect(() => {
    handleSyncWithGoogleSheets(false);

    const interval = setInterval(() => {
      handleSyncWithGoogleSheets(false);
    }, 60000);

    const handleWindowFocus = () => {
      handleSyncWithGoogleSheets(false);
    };
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [handleSyncWithGoogleSheets]);

  const allRecords: RecordItem[] = records;

  // Unique years across the entire live database
  const uniqueYears = useMemo(() => {
    return [...new Set(allRecords.map(r => r.ano).filter(Boolean))].sort((a, b) => b.localeCompare(a));
  }, [allRecords]);

  // Records available in the currently selected Year
  const availableForYear = useMemo(() => {
    if (anoFilter === 'ALL') return allRecords;
    return allRecords.filter(r => r.ano === anoFilter);
  }, [allRecords, anoFilter]);

  // Unique Cargos (dynamically extracted)
  const uniqueCargos = useMemo(() => {
    return [...new Set(availableForYear.map(r => r.cargo).filter(Boolean))].sort();
  }, [availableForYear]);

  // Filtered records reactive to Year, Cargo, Status, Party, Candidate, Bairro, Search
  const filteredRecords = useMemo(() => {
    return allRecords.filter(r => {
      if (anoFilter !== 'ALL' && r.ano !== anoFilter) return false;
      if (cargoFilter !== 'ALL' && r.cargo !== cargoFilter) return false;
      if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
      if (partyFilter !== 'ALL' && r.partido !== partyFilter) return false;
      if (candidateFilter !== 'ALL' && r.candidato !== candidateFilter) return false;
      if (bairroFilter !== 'ALL' && r.bairro !== bairroFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const mCand = r.candidato.toLowerCase().includes(q);
        const mBairro = r.bairro.toLowerCase().includes(q);
        const mNum = r.numero.includes(q);
        const mParty = r.partido.toLowerCase().includes(q);
        const mCargo = (r.cargo || '').toLowerCase().includes(q);
        const mAno = r.ano.includes(q);
        const mMun = r.municipio.toLowerCase().includes(q);
        if (!mCand && !mBairro && !mNum && !mParty && !mCargo && !mAno && !mMun) return false;
      }
      return true;
    });
  }, [allRecords, anoFilter, cargoFilter, statusFilter, partyFilter, candidateFilter, bairroFilter, searchQuery]);

  // Unique lists for selectors based on current year & cargo context
  const uniqueParties = useMemo(() => [...new Set(availableForYear.map(r => r.partido).filter(Boolean))].sort(), [availableForYear]);
  const uniqueCandidates = useMemo(() => {
    const subset = cargoFilter === 'ALL' ? availableForYear : availableForYear.filter(r => r.cargo === cargoFilter);
    return [...new Set(subset.map(r => r.candidato).filter(Boolean))].sort();
  }, [availableForYear, cargoFilter]);
  const uniqueBairros = useMemo(() => [...new Set(availableForYear.map(r => r.bairro).filter(Boolean))].sort(), [availableForYear]);
  const uniqueStatuses = useMemo(() => [...new Set(availableForYear.map(r => r.status).filter(Boolean))].sort(), [availableForYear]);

  // Active Map identification:
  // "QUANDO FOR SELECIONADO O 'ANO 2026' A VISUALIZAÇÃO CARTOGRÁFICA DEVE SER DO ESTADO DO CEARÁ COM SEUS RESPECTIVOS MUNICÍPIOS.
  // E QUANDO FOR 'ANO 2024' A VISUALIZAÇÃO CARTOGRÁFICA DEVE SER DOS BAIRROS DE FORTALEZA."
  const activeMapName: 'ceara' | 'fortaleza' = useMemo(() => {
    if (anoFilter === '2026') return 'ceara';
    if (anoFilter === '2024') return 'fortaleza';
    return manualMapChoice;
  }, [anoFilter, manualMapChoice]);

  // Harmonize selections when year or cargo changes
  useEffect(() => {
    if (cargoFilter !== 'ALL' && !uniqueCargos.includes(cargoFilter)) {
      setCargoFilter('ALL');
    }
    if (candidateFilter !== 'ALL' && !uniqueCandidates.includes(candidateFilter)) {
      setCandidateFilter('ALL');
    }
    if (partyFilter !== 'ALL' && !uniqueParties.includes(partyFilter)) {
      setPartyFilter('ALL');
    }
    if (bairroFilter !== 'ALL' && !uniqueBairros.includes(bairroFilter)) {
      setBairroFilter('ALL');
    }
    if (uniqueCandidates.length > 0 && !uniqueCandidates.includes(selectedCandidate)) {
      setSelectedCandidate(uniqueCandidates[0]);
    }
    if (uniqueCandidates.length > 0 && !uniqueCandidates.includes(mapCandidate)) {
      setMapCandidate(uniqueCandidates[0]);
    }
    if (uniqueBairros.length > 0 && !uniqueBairros.includes(selectedBairro)) {
      setSelectedBairro(uniqueBairros[0]);
    }
    if (uniqueBairros.length > 0 && !uniqueBairros.includes(hoveredOrSelectedBairro)) {
      setHoveredOrSelectedBairro(uniqueBairros[0]);
    }
  }, [anoFilter, cargoFilter, uniqueCandidates, uniqueBairros, uniqueParties, uniqueCargos]);

  // Global candidate statistics map dynamically calculated from live data
  const candidateStatsMap = useMemo(() => {
    const map: Record<string, {
      nome: string;
      votosTotal: number;
      partido: string;
      numero: string;
      status: string;
      cargo: string;
      ano: string;
      topBairro: string;
      topBairroVotos: number;
      concentracaoTopBairro: string;
      bairrosCount: number;
    }> = {};

    availableForYear.forEach(r => {
      if (!map[r.candidato]) {
        map[r.candidato] = {
          nome: r.candidato,
          votosTotal: 0,
          partido: r.partido,
          numero: r.numero,
          status: r.status || '-',
          cargo: r.cargo || '',
          ano: r.ano,
          topBairro: '',
          topBairroVotos: 0,
          concentracaoTopBairro: '0%',
          bairrosCount: 0
        };
      }
      map[r.candidato].votosTotal += r.votos;
    });

    const candBairros: Record<string, Record<string, number>> = {};
    availableForYear.forEach(r => {
      if (!candBairros[r.candidato]) candBairros[r.candidato] = {};
      candBairros[r.candidato][r.bairro] = (candBairros[r.candidato][r.bairro] || 0) + r.votos;
    });

    Object.keys(map).forEach(cand => {
      const bMap = candBairros[cand] || {};
      let topB = '';
      let topV = 0;
      Object.entries(bMap).forEach(([b, v]) => {
        if (v > topV) {
          topV = v;
          topB = b;
        }
      });
      map[cand].topBairro = topB || '-';
      map[cand].topBairroVotos = topV;
      map[cand].bairrosCount = Object.keys(bMap).length;
      map[cand].concentracaoTopBairro = map[cand].votosTotal > 0
        ? ((topV / map[cand].votosTotal) * 100).toFixed(1) + '%'
        : '0%';
    });

    return map;
  }, [availableForYear]);

  // City / State local summary map
  const bairroSummaryMap = useMemo(() => {
    const map: Record<string, { totalVotos: number; leader: string; leaderVotes: number; leaderPerc: string; leaderParty: string; leaderStatus: string }> = {};
    filteredRecords.forEach(r => {
      const key = r.bairro.toUpperCase().trim();
      if (!map[key]) {
        map[key] = { totalVotos: 0, leader: '', leaderVotes: 0, leaderPerc: '0%', leaderParty: '', leaderStatus: '' };
      }
      map[key].totalVotos += r.votos;
      if (r.votos > map[key].leaderVotes) {
        map[key].leaderVotes = r.votos;
        map[key].leader = r.candidato;
        map[key].leaderParty = r.partido;
        map[key].leaderStatus = r.status;
      }
    });
    Object.keys(map).forEach(b => {
      const tot = map[b].totalVotos;
      map[b].leaderPerc = tot > 0 ? ((map[b].leaderVotes / tot) * 100).toFixed(1) + '%' : '0%';
    });
    return map;
  }, [filteredRecords]);

  // Reactive KPIs
  const kpis = useMemo(() => {
    const totalVotos = filteredRecords.reduce((acc, r) => acc + r.votos, 0);
    const count = filteredRecords.length;
    if (count === 0) {
      return {
        totalVotos: 0,
        avgVotos: 0,
        medianVotos: 0,
        stdDev: 0,
        maxVotos: 0,
        maxDetail: '-',
        eleitosPerc: 0,
        eleitosVotos: 0,
        bairrosAtivos: 0,
        candidatosAtivos: 0
      };
    }
    const avg = totalVotos / count;
    const sorted = [...filteredRecords].map(r => r.votos).sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const variance = sorted.reduce((acc, v) => acc + Math.pow(v - avg, 2), 0) / count;
    const stdDev = Math.sqrt(variance);

    let maxItem = filteredRecords[0];
    filteredRecords.forEach(r => {
      if (r.votos > maxItem.votos) maxItem = r;
    });

    const eleitosVotos = filteredRecords.filter(r => r.status === 'ELEITO').reduce((acc, r) => acc + r.votos, 0);
    const eleitosPerc = totalVotos > 0 ? (eleitosVotos / totalVotos) * 100 : 0;

    const bairrosAtivos = new Set(filteredRecords.map(r => r.bairro)).size;
    const candidatosAtivos = new Set(filteredRecords.map(r => r.candidato)).size;

    return {
      totalVotos,
      avgVotos: avg,
      medianVotos: median,
      stdDev,
      maxVotos: maxItem.votos,
      maxDetail: `${maxItem.candidato} (${maxItem.bairro})`,
      eleitosPerc,
      eleitosVotos,
      bairrosAtivos,
      candidatosAtivos
    };
  }, [filteredRecords]);

  // Sorted and Paginated Table data
  const sortedTableData = useMemo(() => {
    const data = [...filteredRecords];
    data.sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];
      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortAsc ? (Number(valA) || 0) - (Number(valB) || 0) : (Number(valB) || 0) - (Number(valA) || 0);
    });
    return data;
  }, [filteredRecords, sortField, sortAsc]);

  const totalPages = Math.ceil(sortedTableData.length / pageSize) || 1;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedTableData.slice(start, start + pageSize);
  }, [sortedTableData, currentPage, pageSize]);

  // Chart References
  const overviewCandChartRef = useRef<HTMLDivElement>(null);
  const overviewBairroChartRef = useRef<HTMLDivElement>(null);
  const overviewPartyChartRef = useRef<HTMLDivElement>(null);
  const overviewRedutoChartRef = useRef<HTMLDivElement>(null);
  const drillCandidateChartRef = useRef<HTMLDivElement>(null);
  const drillBairroChartRef = useRef<HTMLDivElement>(null);
  const mapChartRef = useRef<HTMLDivElement>(null);

  const getOrCreateChart = (dom: HTMLDivElement | null) => {
    if (!dom) return null;
    return echarts.getInstanceByDom(dom) || echarts.init(dom);
  };

  // Overview Charts render
  useEffect(() => {
    if (activeTab !== 'overview') return;

    const chartCand = getOrCreateChart(overviewCandChartRef.current);
    const chartBairro = getOrCreateChart(overviewBairroChartRef.current);
    const chartParty = getOrCreateChart(overviewPartyChartRef.current);
    const chartReduto = getOrCreateChart(overviewRedutoChartRef.current);

    if (chartCand) {
      const candMap: Record<string, { votos: number; status: string; partido: string; cargo: string }> = {};
      filteredRecords.forEach(r => {
        if (!candMap[r.candidato]) candMap[r.candidato] = { votos: 0, status: r.status, partido: r.partido, cargo: r.cargo };
        candMap[r.candidato].votos += r.votos;
      });
      const topCands = Object.entries(candMap).sort((a, b) => b[1].votos - a[1].votos).slice(0, 12).reverse();

      chartCand.setOption({
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'shadow' },
          formatter: (params: any) => {
            const p = params[0];
            const item = candMap[p.name];
            return `<strong>${p.name}</strong> (${item?.partido || ''})<br/>Cargo: ${item?.cargo || '-'}<br/>Total: ${p.value.toLocaleString('pt-BR')} votos`;
          }
        },
        grid: { left: '3%', right: '10%', bottom: '3%', top: '3%', containLabel: true },
        xAxis: { type: 'value', axisLabel: { formatter: (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v) } },
        yAxis: { type: 'category', data: topCands.map(c => c[0]), axisLabel: { fontSize: 11 } },
        series: [{
          type: 'bar',
          data: topCands.map(c => ({
            value: c[1].votos,
            itemStyle: { color: c[1].status === 'ELEITO' ? '#2563eb' : (c[1].status === 'SUPLENTE' ? '#94a3b8' : '#3b82f6') }
          })),
          label: { show: true, position: 'right', formatter: (p: any) => p.value.toLocaleString('pt-BR'), fontSize: 10 }
        }]
      });
    }

    if (chartBairro) {
      const bMap: Record<string, number> = {};
      filteredRecords.forEach(r => {
        bMap[r.bairro] = (bMap[r.bairro] || 0) + r.votos;
      });
      const topBairros = Object.entries(bMap).sort((a, b) => b[1] - a[1]).slice(0, 12);

      chartBairro.setOption({
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'shadow' },
          formatter: (params: any) => {
            const p = params[0];
            return `<strong>${p.name}</strong><br/>Votos apurados: ${p.value.toLocaleString('pt-BR')}`;
          }
        },
        grid: { left: '3%', right: '4%', bottom: '18%', top: '5%', containLabel: true },
        xAxis: {
          type: 'category',
          data: topBairros.map(b => b[0]),
          axisLabel: { interval: 0, rotate: 30, fontSize: 10 }
        },
        yAxis: { type: 'value', axisLabel: { formatter: (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v) } },
        series: [{
          type: 'bar',
          data: topBairros.map(b => b[1]),
          itemStyle: { color: '#0284c7' }
        }]
      });
    }

    if (chartParty) {
      const pMap: Record<string, number> = {};
      filteredRecords.forEach(r => {
        pMap[r.partido] = (pMap[r.partido] || 0) + r.votos;
      });
      const partyData = Object.entries(pMap).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, value]) => ({ name, value }));

      chartParty.setOption({
        tooltip: { trigger: 'item', formatter: '{b}: {c} votos ({d}%)' },
        legend: { orient: 'horizontal', bottom: 0, textStyle: { fontSize: 11 } },
        series: [{
          type: 'pie',
          radius: ['45%', '70%'],
          avoidLabelOverlap: false,
          itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
          data: partyData
        }]
      });
    }

    if (chartReduto) {
      const candMap: Record<string, { total: number; bairros: Record<string, number> }> = {};
      filteredRecords.forEach(r => {
        if (!candMap[r.candidato]) candMap[r.candidato] = { total: 0, bairros: {} };
        candMap[r.candidato].total += r.votos;
        candMap[r.candidato].bairros[r.bairro] = (candMap[r.candidato].bairros[r.bairro] || 0) + r.votos;
      });

      const list = Object.entries(candMap)
        .map(([nome, d]) => {
          let topB = '';
          let topV = 0;
          Object.entries(d.bairros).forEach(([b, v]) => {
            if (v > topV) { topV = v; topB = b; }
          });
          const perc = d.total > 0 ? (topV / d.total) * 100 : 0;
          return { nome, total: d.total, topB, topV, perc };
        })
        .filter(c => c.total >= 500)
        .sort((a, b) => b.perc - a.perc)
        .slice(0, 10);

      chartReduto.setOption({
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'shadow' },
          formatter: (params: any) => {
            const p = params[0];
            const item = list[p.dataIndex];
            return `<strong>${item.nome}</strong><br/>Reduto: ${item.topB}<br/>Concentração: ${item.perc.toFixed(1)}% (${item.topV.toLocaleString('pt-BR')} de ${item.total.toLocaleString('pt-BR')} votos)`;
          }
        },
        grid: { left: '3%', right: '12%', bottom: '5%', top: '5%', containLabel: true },
        xAxis: { type: 'value', max: 70, axisLabel: { formatter: '{value}%' } },
        yAxis: { type: 'category', data: list.map(c => c.nome).reverse(), axisLabel: { fontSize: 10 } },
        series: [{
          type: 'bar',
          data: list.map(c => c.perc.toFixed(1)).reverse(),
          itemStyle: {
            color: (p: any) => p.value > 30 ? '#dc2626' : (p.value > 15 ? '#ea580c' : '#2563eb')
          },
          label: { show: true, position: 'right', formatter: '{c}%', fontSize: 10 }
        }]
      });
    }

    const handleResize = () => {
      chartCand?.resize();
      chartBairro?.resize();
      chartParty?.resize();
      chartReduto?.resize();
    };
    window.addEventListener('resize', handleResize);

    return () => window.removeEventListener('resize', handleResize);
  }, [activeTab, filteredRecords]);

  // MAP CHART RENDER (CEARÁ MUNICÍPIOS for 2026 OR FORTALEZA BAIRROS for 2024)
  useEffect(() => {
    if (activeTab !== 'mapa') return;

    let chart: echarts.ECharts | null = null;
    let resizeTimer: any = null;

    const initMap = () => {
      const dom = mapChartRef.current;
      if (!dom) return;
      chart = getOrCreateChart(dom);
      if (!chart) return;

      chart.resize();

      let mapData: any[] = [];
      let minVal = 0;
      let maxVal = 21000;
      let visualColors = ['#eff6ff', '#93c5fd', '#3b82f6', '#1d4ed8', '#172554'];

      const isCeara = activeMapName === 'ceara';
      const activeGeoJson = isCeara ? cearaGeoJson : fortalezaGeoJson;
      const geoFeatures: string[] = (activeGeoJson as any).features.map((f: any) => f.properties.name.toUpperCase().trim());
      const allLocationsSet = Array.from(new Set([...geoFeatures, ...Object.keys(bairroSummaryMap)]));

      if (mapMode === 'volume') {
        visualColors = ['#eff6ff', '#93c5fd', '#3b82f6', '#1d4ed8', '#172554'];
        const values = Object.values(bairroSummaryMap).map(b => b.totalVotos).filter(v => v > 0);
        maxVal = values.length > 0 ? Math.max(...values) : (isCeara ? 65000 : 21000);

        mapData = allLocationsSet.map(loc => {
          const info = bairroSummaryMap[loc] || {
            totalVotos: 0,
            leader: '-',
            leaderVotes: 0,
            leaderPerc: '0%',
            leaderParty: '-',
            leaderStatus: '-'
          };
          return {
            name: loc,
            value: info.totalVotos,
            leader: info.leader,
            leaderVotes: info.leaderVotes,
            leaderPerc: info.leaderPerc,
            leaderParty: info.leaderParty,
            leaderStatus: info.leaderStatus
          };
        });
      } else if (mapMode === 'candidato') {
        visualColors = ['#fef2f2', '#fca5a5', '#ef4444', '#b91c1c', '#7f1d1d'];
        const candRows = filteredRecords.filter(r => r.candidato === mapCandidate);
        const candTotal = candRows.reduce((acc, r) => acc + r.votos, 0);
        const maxCandBairro = candRows.length > 0 ? Math.max(...candRows.map(r => r.votos)) : 2000;
        maxVal = maxCandBairro > 0 ? maxCandBairro : 2000;

        mapData = allLocationsSet.map(loc => {
          const match = candRows.find(r => r.bairro.toUpperCase().trim() === loc);
          const votos = match ? match.votos : 0;
          const totalNoBairro = bairroSummaryMap[loc]?.totalVotos || 0;
          const shareNoBairro = totalNoBairro > 0 ? ((votos / totalNoBairro) * 100).toFixed(1) + '%' : '0%';
          const pesoNoCand = candTotal > 0 ? ((votos / candTotal) * 100).toFixed(1) + '%' : '0%';

          return {
            name: loc,
            value: votos,
            candidato: mapCandidate,
            shareNoBairro,
            pesoNoCand,
            totalNoBairro
          };
        });
      } else if (mapMode === 'vencedor') {
        visualColors = ['#ede9fe', '#c4b5fd', '#8b5cf6', '#6d28d9', '#4c1d95'];
        const values = Object.values(bairroSummaryMap).map(b => b.leaderVotes).filter(v => v > 0);
        maxVal = values.length > 0 ? Math.max(...values) : 5000;

        mapData = allLocationsSet.map(loc => {
          const info = bairroSummaryMap[loc] || {
            totalVotos: 0,
            leader: 'Sem apuração',
            leaderVotes: 0,
            leaderPerc: '0%',
            leaderParty: '-',
            leaderStatus: '-'
          };
          return {
            name: loc,
            value: info.leaderVotes,
            leader: info.leader,
            leaderVotes: info.leaderVotes,
            leaderPerc: info.leaderPerc,
            leaderParty: info.leaderParty,
            leaderStatus: info.leaderStatus,
            totalBairro: info.totalVotos
          };
        });
      }

      chart.setOption({
        tooltip: {
          trigger: 'item',
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          borderColor: '#334155',
          borderWidth: 1,
          padding: [8, 12],
          textStyle: { color: '#fff', fontSize: 12 },
          formatter: (params: any) => {
            const d = params.data;
            if (!d) return `<strong>${params.name}</strong><br/>Sem apuração neste filtro`;

            const labelTipo = isCeara ? 'Município' : 'Bairro';

            if (mapMode === 'volume') {
              return `
                <div class="space-y-1">
                  <div class="font-bold text-sm text-blue-300">${params.name} (${labelTipo})</div>
                  <div>Total de Votos: <strong>${(d.value || 0).toLocaleString('pt-BR')}</strong></div>
                  <div class="text-[11px] text-slate-300 pt-1 border-t border-slate-700">
                    Líder: <strong>${d.leader || '-'}</strong> (${d.leaderParty || '-'}), ${d.leaderVotes?.toLocaleString('pt-BR')} votos (${d.leaderPerc || '0%'})
                  </div>
                </div>
              `;
            } else if (mapMode === 'candidato') {
              return `
                <div class="space-y-1">
                  <div class="font-bold text-sm text-red-300">${params.name} (${labelTipo})</div>
                  <div>Votos de ${d.candidato}: <strong>${(d.value || 0).toLocaleString('pt-BR')}</strong></div>
                  <div class="text-[11px] text-slate-300 pt-1 border-t border-slate-700">
                    Quota Local: <strong>${d.shareNoBairro}</strong><br/>
                    Peso na Votação do Candidato: <strong>${d.pesoNoCand}</strong>
                  </div>
                </div>
              `;
            } else {
              return `
                <div class="space-y-1">
                  <div class="font-bold text-sm text-purple-300">${params.name} (${labelTipo})</div>
                  <div>Candidato Mais Votado: <strong>${d.leader}</strong></div>
                  <div>Partido: <strong>${d.leaderParty}</strong> ${d.leaderStatus ? `(${d.leaderStatus})` : ''}</div>
                  <div class="text-[11px] text-slate-300 pt-1 border-t border-slate-700">
                    Votos do Líder: <strong>${(d.value || 0).toLocaleString('pt-BR')}</strong> (${d.leaderPerc} do local)
                  </div>
                </div>
              `;
            }
          }
        },
        visualMap: {
          min: minVal,
          max: maxVal > 0 ? maxVal : 1000,
          calculable: true,
          left: 20,
          bottom: 25,
          inRange: { color: visualColors },
          textStyle: { fontSize: 10, color: '#475569' }
        },
        series: [
          {
            name: isCeara ? 'Municípios do Ceará' : 'Bairros de Fortaleza',
            type: 'map',
            map: activeMapName,
            roam: true,
            scaleLimit: { min: 0.8, max: 8 },
            label: {
              show: false,
              fontSize: 8,
              color: '#334155'
            },
            itemStyle: {
              borderColor: '#cbd5e1',
              borderWidth: isCeara ? 0.7 : 1,
              areaColor: '#f1f5f9'
            },
            emphasis: {
              label: {
                show: true,
                fontSize: 11,
                fontWeight: 'bold',
                color: '#0f172a'
              },
              itemStyle: {
                areaColor: '#fde047',
                borderColor: '#0f172a',
                borderWidth: 1.5
              }
            },
            select: {
              itemStyle: {
                areaColor: '#f59e0b',
                borderColor: '#0f172a',
                borderWidth: 2
              }
            },
            selectedMode: 'single',
            data: mapData
          }
        ]
      }, true);

      const handleClick = (params: any) => {
        if (params.name) {
          setHoveredOrSelectedBairro(params.name);
        }
      };

      const handleMouseOver = (params: any) => {
        if (params.name && params.data && params.data.value !== undefined) {
          setHoveredOrSelectedBairro(params.name);
        }
      };

      chart.on('click', handleClick);
      chart.on('mouseover', handleMouseOver);

      resizeTimer = setTimeout(() => {
        chart?.resize();
      }, 50);
    };

    initMap();

    const handleResize = () => chart?.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      window.removeEventListener('resize', handleResize);
      if (chart) {
        chart.off('click');
        chart.off('mouseover');
      }
    };
  }, [activeTab, activeMapName, mapMode, mapCandidate, bairroSummaryMap, filteredRecords, uniqueBairros]);

  // Candidate Drilldown chart
  useEffect(() => {
    if (activeTab !== 'candidato') return;
    const chart = getOrCreateChart(drillCandidateChartRef.current);
    if (chart) {
      const candRows = availableForYear.filter(r => r.candidato === selectedCandidate);
      const topRows = candRows.sort((a, b) => b.votos - a.votos).slice(0, 12).reverse();

      chart.setOption({
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        grid: { left: '3%', right: '8%', bottom: '3%', top: '3%', containLabel: true },
        xAxis: { type: 'value' },
        yAxis: { type: 'category', data: topRows.map(r => r.bairro) },
        series: [{
          type: 'bar',
          data: topRows.map(r => r.votos),
          itemStyle: { color: '#2563eb' },
          label: { show: true, position: 'right', formatter: (p: any) => p.value.toLocaleString('pt-BR') }
        }]
      });
    }
    const handleResize = () => chart?.resize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [activeTab, selectedCandidate, availableForYear]);

  // Bairro Drilldown chart
  useEffect(() => {
    if (activeTab !== 'bairro') return;
    const chart = getOrCreateChart(drillBairroChartRef.current);
    if (chart) {
      const bRows = availableForYear.filter(r => r.bairro === selectedBairro);
      const topRows = bRows.sort((a, b) => b.votos - a.votos).slice(0, 12).reverse();

      chart.setOption({
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        grid: { left: '3%', right: '8%', bottom: '3%', top: '3%', containLabel: true },
        xAxis: { type: 'value' },
        yAxis: { type: 'category', data: topRows.map(r => r.candidato) },
        series: [{
          type: 'bar',
          data: topRows.map(r => r.votos),
          itemStyle: { color: '#0d9488' },
          label: { show: true, position: 'right', formatter: (p: any) => p.value.toLocaleString('pt-BR') }
        }]
      });
    }
    const handleResize = () => chart?.resize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [activeTab, selectedBairro, availableForYear]);

  // Auto-populate Top 3 candidates of the chosen bairro
  useEffect(() => {
    const bRows = availableForYear.filter(r => r.bairro === selectedBairro).sort((a, b) => b.votos - a.votos);
    if (bRows.length >= 3) {
      setCompareCand1(bRows[0].candidato);
      setCompareCand2(bRows[1].candidato);
      setCompareCand3(bRows[2].candidato);
    } else if (bRows.length === 2) {
      setCompareCand1(bRows[0].candidato);
      setCompareCand2(bRows[1].candidato);
      setCompareCand3('');
    } else if (bRows.length === 1) {
      setCompareCand1(bRows[0].candidato);
      setCompareCand2('');
      setCompareCand3('');
    }
  }, [selectedBairro, availableForYear]);

  // Bairro Candidate Comparator Chart render
  useEffect(() => {
    if (activeTab !== 'bairro') return;
    const chart = getOrCreateChart(bairroCompareChartRef.current);
    if (!chart) return;

    const candidatesToCompare = [compareCand1, compareCand2, compareCand3].filter(Boolean);
    if (candidatesToCompare.length === 0) {
      chart.clear();
      return;
    }

    const bRows = availableForYear.filter(r => r.bairro === selectedBairro);
    const totalBairroVotos = bRows.reduce((acc, r) => acc + r.votos, 0);
    const colors = ['#2563eb', '#f59e0b', '#10b981'];

    const compData = candidatesToCompare.map((cName, idx) => {
      const rowInBairro = bRows.find(r => r.candidato === cName);
      const votosNoBairro = rowInBairro ? rowInBairro.votos : 0;
      const percNoBairro = totalBairroVotos > 0 ? (votosNoBairro / totalBairroVotos) * 100 : 0;

      const summaryInfo = candidateStatsMap[cName];
      const totalCidade = summaryInfo ? summaryInfo.votosTotal : 0;
      const topBairro = summaryInfo ? summaryInfo.topBairro : '';
      const topBairroVotos = summaryInfo ? summaryInfo.topBairroVotos : 0;
      const pesoNoCand = totalCidade > 0 ? (votosNoBairro / totalCidade) * 100 : 0;

      return {
        name: cName,
        votosNoBairro,
        percNoBairro,
        totalCidade,
        topBairro,
        topBairroVotos,
        pesoNoCand,
        color: colors[idx % colors.length],
        status: summaryInfo?.status || '-',
        partido: summaryInfo?.partido || '-'
      };
    });

    if (compareChartType === 'bar') {
      chart.setOption({
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'shadow' },
          formatter: (params: any) => {
            const p = params[0];
            const item = compData[p.dataIndex];
            if (!item) return '';
            return `
              <strong>${item.name}</strong> (${item.partido})<br/>
              Votos em ${selectedBairro}: <strong>${item.votosNoBairro.toLocaleString('pt-BR')}</strong> (${item.percNoBairro.toFixed(1)}% do total local)<br/>
              Total geral apurado: <strong>${item.totalCidade.toLocaleString('pt-BR')}</strong> votos<br/>
              Peso deste local: <strong>${item.pesoNoCand.toFixed(1)}%</strong>
            `;
          }
        },
        grid: { left: '3%', right: '8%', bottom: '5%', top: '8%', containLabel: true },
        xAxis: { type: 'category', data: compData.map(c => c.name), axisLabel: { fontSize: 11, fontWeight: 'bold' } },
        yAxis: { type: 'value', axisLabel: { formatter: (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v) } },
        series: [{
          type: 'bar',
          data: compData.map(c => ({
            value: c.votosNoBairro,
            itemStyle: { color: c.color }
          })),
          label: {
            show: true,
            position: 'top',
            formatter: (p: any) => `${p.value.toLocaleString('pt-BR')} votos`,
            fontSize: 11,
            fontWeight: 'bold'
          }
        }]
      }, true);
    } else {
      const maxV = Math.max(...compData.map(c => c.votosNoBairro), 100);
      const maxTotal = Math.max(...compData.map(c => c.totalCidade), 1000);

      chart.setOption({
        tooltip: { trigger: 'item' },
        legend: { bottom: 0, textStyle: { fontSize: 11 } },
        radar: {
          indicator: [
            { name: `Votos em ${selectedBairro}`, max: maxV * 1.2 },
            { name: '% do Local', max: 50 },
            { name: 'Votação Total', max: maxTotal * 1.1 },
            { name: 'Peso no Candidato', max: 50 }
          ],
          radius: '65%'
        },
        series: [{
          type: 'radar',
          data: compData.map(c => ({
            name: c.name,
            value: [c.votosNoBairro, c.percNoBairro, c.totalCidade, c.pesoNoCand],
            itemStyle: { color: c.color },
            areaStyle: { opacity: 0.25 }
          }))
        }]
      }, true);
    }

    const handleResize = () => chart?.resize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [activeTab, compareCand1, compareCand2, compareCand3, compareChartType, selectedBairro, availableForYear, candidateStatsMap]);

  // Zoom map handlers
  const handleMapZoom = (action: 'in' | 'out' | 'reset') => {
    const chart = getOrCreateChart(mapChartRef.current);
    if (!chart) return;
    const opt: any = chart.getOption();
    const currentZoom = opt?.series?.[0]?.zoom || 1;

    if (action === 'in') {
      chart.setOption({ series: [{ zoom: Math.min(currentZoom * 1.3, 5) }] });
    } else if (action === 'out') {
      chart.setOption({ series: [{ zoom: Math.max(currentZoom / 1.3, 0.8) }] });
    } else {
      chart.setOption({ series: [{ zoom: 1, center: undefined }] });
    }
  };

  // Export filtered CSV
  const handleExportCSV = () => {
    const headers = ['Ano', 'Turno', 'Município', 'Cargo', 'Número', 'Candidato', 'Partido', 'Bairro', 'Votos', '% Votos', 'Status'];
    const rows = filteredRecords.map(r => [
      r.ano,
      r.turno,
      `"${r.municipio}"`,
      `"${r.cargo || ''}"`,
      r.numero,
      `"${r.candidato}"`,
      `"${r.partido}"`,
      `"${r.bairro}"`,
      r.votos,
      r.perc.toString().replace('.', ','),
      `"${r.status}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `analise_eleitoral_${anoFilter !== 'ALL' ? anoFilter : 'geral'}_filtrado.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Reset Filters
  const handleResetFilters = () => {
    setAnoFilter('ALL');
    setCargoFilter('ALL');
    setStatusFilter('ALL');
    setPartyFilter('ALL');
    setCandidateFilter('ALL');
    setBairroFilter('ALL');
    setSearchQuery('');
    setCurrentPage(1);
  };

  // Sort Table
  const handleSort = (field: keyof RecordItem) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(field === 'candidato' || field === 'bairro' || field === 'partido' || field === 'cargo' || field === 'ano');
    }
  };

  // Initial Landing Page: If not authenticated, Controle de Acesso is presented BEFORE opening the panel
  if (!isAuthenticated || !currentUser) {
    return (
      <LoginPage
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          persistCurrentUser(user);
          setIsAuthenticated(true);
        }}
      />
    );
  }

  const isMaster = currentUser.role === 'master';

  const handleLogout = () => {
    logoutUser(currentUser);
    setCurrentUser(null);
    setIsAuthenticated(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      {/* LOGIN MODAL */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          persistCurrentUser(user);
        }}
        currentUser={currentUser}
      />

      {/* SYNC NOTIFICATION TOAST */}
      {syncNotification && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white text-xs px-4 py-3 rounded-xl shadow-xl flex items-center gap-2.5 border border-slate-700 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{syncNotification}</span>
        </div>
      )}

      {/* HEADER */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 min-h-16 py-2 flex items-center justify-between gap-4">
          {/* Zone 1: Wordmark & Sync indicator */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-sm shrink-0">
              CE
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold tracking-tight text-slate-900 block leading-tight">
                  Painel Eleitoral Ceará {uniqueYears.join(' · ')}
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Google Drive Ao Vivo
                </span>
              </div>
              <span className="text-xs text-slate-500 block leading-tight mt-0.5">
                Cartografia Ceará 2026 & Fortaleza 2024 · Controle de Acesso Ativo
              </span>
            </div>
          </div>

          {/* Zone 2: Navigation Links */}
          <nav className="hidden xl:flex items-center gap-5 text-sm font-medium text-slate-600">
            <button
              onClick={() => setActiveTab('overview')}
              className={`hover:text-blue-600 transition-colors whitespace-nowrap pb-1 ${activeTab === 'overview' ? 'text-blue-600 font-semibold border-b-2 border-blue-600' : ''}`}
            >
              Visão Executiva
            </button>
            <button
              onClick={() => setActiveTab('mapa')}
              className={`hover:text-blue-600 transition-colors whitespace-nowrap pb-1 flex items-center gap-1.5 ${activeTab === 'mapa' ? 'text-blue-600 font-semibold border-b-2 border-blue-600' : ''}`}
            >
              <MapIcon className="w-4 h-4 text-emerald-600" />
              {activeMapName === 'ceara' ? 'Mapa Ceará (184 Mun.)' : 'Mapa Fortaleza (111 Bairros)'}
            </button>
            <button
              onClick={() => setActiveTab('redutos')}
              className={`hover:text-blue-600 transition-colors whitespace-nowrap pb-1 ${activeTab === 'redutos' ? 'text-blue-600 font-semibold border-b-2 border-blue-600' : ''}`}
            >
              Redutos Eleitorais
            </button>
            <button
              onClick={() => setActiveTab('candidato')}
              className={`hover:text-blue-600 transition-colors whitespace-nowrap pb-1 ${activeTab === 'candidato' ? 'text-blue-600 font-semibold border-b-2 border-blue-600' : ''}`}
            >
              Raio-X Candidato
            </button>
            <button
              onClick={() => setActiveTab('bairro')}
              className={`hover:text-blue-600 transition-colors whitespace-nowrap pb-1 ${activeTab === 'bairro' ? 'text-blue-600 font-semibold border-b-2 border-blue-600' : ''}`}
            >
              Análise Bairros
            </button>
            <button
              onClick={() => setActiveTab('tabela')}
              className={`hover:text-blue-600 transition-colors whitespace-nowrap pb-1 ${activeTab === 'tabela' ? 'text-blue-600 font-semibold border-b-2 border-blue-600' : ''}`}
            >
              Base Completa ({allRecords.length.toLocaleString('pt-BR')})
            </button>
            <button
              onClick={() => setActiveTab('auditoria')}
              className={`hover:text-blue-600 transition-colors whitespace-nowrap pb-1 ${activeTab === 'auditoria' ? 'text-blue-600 font-semibold border-b-2 border-blue-600' : ''}`}
            >
              Auditoria & Planilha
            </button>

            {/* MASTER ONLY TAB: GESTÃO DE ACESSOS */}
            {isMaster && (
              <button
                onClick={() => setActiveTab('acesso')}
                className={`transition-colors whitespace-nowrap pb-1 flex items-center gap-1.5 px-2 py-0.5 rounded-lg font-bold text-xs ${
                  activeTab === 'acesso'
                    ? 'bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs'
                    : 'text-amber-800 hover:text-amber-900 bg-amber-50 hover:bg-amber-100/70 border border-amber-200'
                }`}
                title="Painel exclusivo do Usuário Master para gerenciar acessos e senhas"
              >
                <span>👑 Gestão de Acessos</span>
              </button>
            )}
          </nav>

          {/* Zone 3: User Session & Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {/* User Account / Role Badge */}
            <div
              onClick={() => setIsLoginModalOpen(true)}
              className="flex items-center gap-2 p-1.5 pl-2 pr-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl cursor-pointer transition-all"
              title="Clique para alternar de usuário ou gerenciar sua sessão"
            >
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                currentUser.role === 'master' ? 'bg-amber-500 text-white shadow-2xs' :
                currentUser.role === 'analista' ? 'bg-blue-600 text-white' : 'bg-slate-600 text-white'
              }`}>
                {currentUser.role === 'master' ? '👑' : currentUser.name.charAt(0)}
              </div>
              <div className="text-left hidden sm:block">
                <div className="text-[11px] font-bold text-slate-900 leading-tight flex items-center gap-1">
                  <span>{currentUser.name.split(' ')[0]}</span>
                  <span className={`text-[9px] px-1 py-0.2 rounded font-bold uppercase ${
                    currentUser.role === 'master' ? 'bg-amber-100 text-amber-900' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {currentUser.role}
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 font-mono leading-tight">login: {currentUser.username}</div>
              </div>
            </div>

            {/* Live Sync Button */}
            <button
              onClick={() => handleSyncWithGoogleSheets(true)}
              disabled={isSyncing}
              className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-blue-700 bg-slate-100 hover:bg-blue-50 border border-slate-200 rounded-lg transition-all flex items-center gap-1.5 shadow-xs disabled:opacity-50"
              title={`Sincronizar da planilha do Google Drive`}
            >
              <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${isSyncing ? 'animate-spin' : ''}`} />
              <span className="hidden md:inline">{isSyncing ? 'Atualizando...' : 'Atualizar'}</span>
            </button>

            {/* Direct Google Sheets Link */}
            <a
              href={SPREADSHEET_URL}
              target="_blank"
              rel="noreferrer"
              className="p-1.5 text-slate-600 hover:text-emerald-700 bg-white hover:bg-emerald-50 border border-slate-200 rounded-lg transition-colors"
              title="Abrir planilha de votos no Google Drive"
            >
              <Database className="w-4 h-4 text-emerald-600" />
            </a>

            {/* Logout / Switch User Button */}
            <button
              onClick={handleLogout}
              className="px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:text-white bg-rose-50 hover:bg-rose-600 border border-rose-200 rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs"
              title="Encerrar sessão e retornar ao Portal de Controle de Acesso"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
      </header>

      {/* MOBILE NAV */}
      <div className="xl:hidden bg-white border-b border-slate-200 px-4 py-2 flex items-center gap-2 overflow-x-auto text-xs">
        {(['overview', 'mapa', 'redutos', 'candidato', 'bairro', 'tabela', 'auditoria', ...(isMaster ? ['acesso' as const] : [])] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 rounded-md whitespace-nowrap font-medium ${
              activeTab === tab
                ? (tab === 'acesso' ? 'bg-amber-500 text-white font-bold' : 'bg-blue-600 text-white')
                : (tab === 'acesso' ? 'bg-amber-50 text-amber-900 border border-amber-200' : 'text-slate-600 bg-slate-100')
            }`}
          >
            {tab === 'overview' && 'Visão'}
            {tab === 'mapa' && (activeMapName === 'ceara' ? 'Mapa Ceará' : 'Mapa Fortaleza')}
            {tab === 'redutos' && 'Redutos'}
            {tab === 'candidato' && 'Candidato'}
            {tab === 'bairro' && 'Bairro'}
            {tab === 'tabela' && `Base (${allRecords.length})`}
            {tab === 'auditoria' && 'Auditoria'}
            {tab === 'acesso' && '👑 Acessos'}
          </button>
        ))}
      </div>

      {/* MAIN VIEWPORT */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 space-y-6 w-full">

        {/* HERO BANNER */}
        <section className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 rounded-xl p-6 text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 border border-slate-700/50">
          <div className="space-y-2 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-300">
              <span className="bg-blue-500/20 text-blue-300 border border-blue-400/30 px-2 py-0.5 rounded-full font-mono">
                {anoFilter !== 'ALL' ? `Eleições ${anoFilter}` : `Eleições ${uniqueYears.join(' · ')}`}
              </span>
              <span>·</span>
              <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 px-2 py-0.5 rounded-full font-mono">
                {cargoFilter !== 'ALL' ? cargoFilter : 'Todos os Cargos'}
              </span>
              <span>·</span>
              <span className="inline-flex items-center gap-1 text-emerald-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                Google Drive Conectado
              </span>
              <span>·</span>
              <span className="text-slate-400">
                Usuário: <strong className="text-white">{currentUser.name}</strong> ({currentUser.role.toUpperCase()})
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Painel de Inteligência Territorial Eleitoral
            </h1>

            <p className="text-sm text-slate-300 leading-relaxed">
              Consolidação analítica de <strong>{kpis.totalVotos.toLocaleString('pt-BR')} votos</strong> em{' '}
              <strong>{kpis.bairrosAtivos} localidades</strong>. Cartografia automática:{' '}
              <span className="text-emerald-300 font-semibold">Ceará (184 Municípios) em 2026</span> e{' '}
              <span className="text-blue-300 font-semibold">Fortaleza (111 Bairros) em 2024</span>.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 shrink-0 bg-white/5 p-3.5 rounded-lg border border-white/10">
            <div>
              <div className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Linhas da Base</div>
              <div className="text-xl font-bold font-mono text-white mt-0.5 tabular-nums">
                {filteredRecords.length.toLocaleString('pt-BR')}
                {filteredRecords.length !== allRecords.length && (
                  <span className="text-xs text-slate-400 font-normal"> / {allRecords.length}</span>
                )}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Localidades Ativas</div>
              <div className="text-xl font-bold font-mono text-emerald-400 mt-0.5 tabular-nums">
                {kpis.bairrosAtivos}
              </div>
            </div>
          </div>
        </section>

        {/* FILTERS AND CONTROLS STRIP (WITH "ANO" AND "CARGO" FILTERS) */}
        <section className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-blue-600" />
              <h2 className="text-sm font-bold text-slate-900">Filtros Dinâmicos Globais</h2>
              <span className="text-[11px] font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-semibold border border-blue-200">
                {filteredRecords.length.toLocaleString('pt-BR')} registros ativos
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleSyncWithGoogleSheets(true)}
                disabled={isSyncing}
                className="px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors flex items-center gap-1.5"
                title="Recarregar os dados mais recentes da planilha Google Drive"
              >
                <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                Atualizar Planilha
              </button>

              {(anoFilter !== 'ALL' || cargoFilter !== 'ALL' || statusFilter !== 'ALL' || partyFilter !== 'ALL' || candidateFilter !== 'ALL' || bairroFilter !== 'ALL' || searchQuery.trim() !== '') && (
                <button
                  onClick={handleResetFilters}
                  className="px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors flex items-center gap-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Limpar Filtros
                </button>
              )}

              <button
                onClick={handleExportCSV}
                className="px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1.5"
                title="Exportar base filtrada em CSV"
              >
                <Download className="w-3.5 h-3.5" />
                Exportar CSV
              </button>
            </div>
          </div>

          {/* 7-Column Responsive Dynamic Filter Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 text-xs">
            {/* 1. ANO */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-blue-600" />
                  Ano
                </span>
                {anoFilter !== 'ALL' && (
                  <span className="text-[10px] text-blue-600 font-bold bg-blue-50 px-1 rounded">Ativo</span>
                )}
              </label>
              <select
                value={anoFilter}
                onChange={e => { setAnoFilter(e.target.value); setCurrentPage(1); }}
                className={`w-full border rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors ${
                  anoFilter !== 'ALL' ? 'bg-blue-50/80 border-blue-400 text-blue-900' : 'bg-slate-50 border-slate-300 text-slate-800'
                }`}
              >
                <option value="ALL">Todos os Anos</option>
                {uniqueYears.map(ano => {
                  const count = allRecords.filter(r => r.ano === ano).length;
                  return (
                    <option key={ano} value={ano}>
                      Ano {ano} ({count.toLocaleString('pt-BR')})
                    </option>
                  );
                })}
              </select>
            </div>

            {/* 2. CARGO (NEW DYNAMIC GLOBAL FILTER) */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Briefcase className="w-3 h-3 text-indigo-600" />
                  Cargo
                </span>
                {cargoFilter !== 'ALL' && (
                  <span className="text-[10px] text-indigo-600 font-bold bg-indigo-50 px-1 rounded">Ativo</span>
                )}
              </label>
              <select
                value={cargoFilter}
                onChange={e => { setCargoFilter(e.target.value); setCurrentPage(1); }}
                className={`w-full border rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors ${
                  cargoFilter !== 'ALL' ? 'bg-indigo-50/80 border-indigo-400 text-indigo-900' : 'bg-slate-50 border-slate-300 text-slate-800'
                }`}
              >
                <option value="ALL">Todos os Cargos</option>
                {uniqueCargos.map(cargo => {
                  const count = availableForYear.filter(r => r.cargo === cargo).length;
                  return (
                    <option key={cargo} value={cargo}>
                      {cargo} ({count})
                    </option>
                  );
                })}
              </select>
            </div>

            {/* 3. Status */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 focus:bg-white"
              >
                <option value="ALL">Todos os Status</option>
                {uniqueStatuses.map(st => {
                  const c = availableForYear.filter(r => r.status === st).length;
                  return (
                    <option key={st} value={st}>
                      {st} ({c})
                    </option>
                  );
                })}
              </select>
            </div>

            {/* 4. Partido */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Partido</label>
              <select
                value={partyFilter}
                onChange={e => { setPartyFilter(e.target.value); setCurrentPage(1); }}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 focus:bg-white"
              >
                <option value="ALL">Todos os Partidos ({uniqueParties.length})</option>
                {uniqueParties.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            {/* 5. Candidato */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Candidato</label>
              <select
                value={candidateFilter}
                onChange={e => { setCandidateFilter(e.target.value); setCurrentPage(1); }}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 focus:bg-white"
              >
                <option value="ALL">Todos os Candidatos ({uniqueCandidates.length})</option>
                {uniqueCandidates.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* 6. Bairro / Município */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                {activeMapName === 'ceara' ? 'Município' : 'Bairro / Local'}
              </label>
              <select
                value={bairroFilter}
                onChange={e => { setBairroFilter(e.target.value); setCurrentPage(1); }}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 focus:bg-white"
              >
                <option value="ALL">Todas as Localidades ({uniqueBairros.length})</option>
                {uniqueBairros.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            {/* 7. Busca Livre */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Busca Rápida</label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Candidato, local, nº..."
                  value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>
            </div>
          </div>
        </section>

        {/* TAB 8: GESTÃO DE ACESSOS (EXCLUSIVO MASTER) */}
        {activeTab === 'acesso' && isMaster && (
          <AccessManager
            currentUser={currentUser}
            onUserChanged={(updated) => {
              setCurrentUser(updated);
              persistCurrentUser(updated);
            }}
          />
        )}

        {/* EXECUTIVE KPI CARDS STRIP */}
        {activeTab !== 'acesso' && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Total de Votos</span>
              <span className="text-xl sm:text-2xl font-bold font-mono text-slate-900 block mt-1 tabular-nums">
                {kpis.totalVotos.toLocaleString('pt-BR')}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5 block">{filteredRecords.length.toLocaleString('pt-BR')} registros</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Média p/ Registro</span>
              <span className="text-xl sm:text-2xl font-bold font-mono text-slate-900 block mt-1 tabular-nums">
                {kpis.avgVotos.toFixed(1).replace('.', ',')}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5 block">Votos médios/local</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Mediana</span>
              <span className="text-xl sm:text-2xl font-bold font-mono text-slate-900 block mt-1 tabular-nums">
                {kpis.medianVotos.toLocaleString('pt-BR')}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5 block">Ponto central 50%</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Desvio Padrão</span>
              <span className="text-xl sm:text-2xl font-bold font-mono text-amber-700 block mt-1 tabular-nums">
                {kpis.stdDev.toFixed(1).replace('.', ',')}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5 block">Variabilidade</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Pico em 1 Local</span>
              <span className="text-xl sm:text-2xl font-bold font-mono text-blue-700 block mt-1 tabular-nums">
                {kpis.maxVotos.toLocaleString('pt-BR')}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5 block truncate" title={kpis.maxDetail}>
                {kpis.maxDetail}
              </span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Locais Ativos</span>
              <span className="text-xl sm:text-2xl font-bold font-mono text-slate-900 block mt-1 tabular-nums">
                {kpis.bairrosAtivos}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5 block">Bairros / Municípios</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Candidatos</span>
              <span className="text-xl sm:text-2xl font-bold font-mono text-emerald-700 block mt-1 tabular-nums">
                {kpis.candidatosAtivos}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5 block">com apuração</span>
            </div>
          </div>
        )}

        {/* TAB: MAPA (DINÂMICO: CEARÁ PARA 2026 / FORTALEZA PARA 2024) */}
        {activeTab === 'mapa' && (
          <div className="space-y-6">
            {/* Cartographic Mode Selector Bar */}
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-red-600" />
                    {activeMapName === 'ceara'
                      ? 'Visualização Cartográfica do Estado do Ceará (184 Municípios)'
                      : 'Visualização Cartográfica dos Bairros de Fortaleza (111 Bairros)'}
                  </h2>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    activeMapName === 'ceara' ? 'bg-indigo-100 text-indigo-800' : 'bg-blue-100 text-blue-800'
                  }`}>
                    {activeMapName === 'ceara' ? 'Eleições 2026 Estadual' : 'Eleições 2024 Fortaleza'}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  {activeMapName === 'ceara'
                    ? 'Mapa vetorial dos 184 municípios cearenses ativado automaticamente pelo Ano 2026'
                    : 'Mapa vetorial dos 111 bairros de Fortaleza ativado pelo Ano 2024'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* When "ALL" years is selected, allow explicit map layer choice */}
                {anoFilter === 'ALL' && (
                  <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg text-xs font-semibold">
                    <button
                      onClick={() => setManualMapChoice('ceara')}
                      className={`px-2.5 py-1 rounded-md transition-colors ${manualMapChoice === 'ceara' ? 'bg-white text-indigo-900 shadow-xs' : 'text-slate-600'}`}
                    >
                      Ceará (184 Mun.)
                    </button>
                    <button
                      onClick={() => setManualMapChoice('fortaleza')}
                      className={`px-2.5 py-1 rounded-md transition-colors ${manualMapChoice === 'fortaleza' ? 'bg-white text-blue-900 shadow-xs' : 'text-slate-600'}`}
                    >
                      Fortaleza (111 Bairros)
                    </button>
                  </div>
                )}

                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg text-xs font-medium">
                  <button
                    onClick={() => setMapMode('volume')}
                    className={`px-3 py-1.5 rounded-md transition-colors ${mapMode === 'volume' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    Volume de Votos
                  </button>
                  <button
                    onClick={() => setMapMode('candidato')}
                    className={`px-3 py-1.5 rounded-md transition-colors ${mapMode === 'candidato' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    Por Candidato
                  </button>
                  <button
                    onClick={() => setMapMode('vencedor')}
                    className={`px-3 py-1.5 rounded-md transition-colors ${mapMode === 'vencedor' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    Líder do Local
                  </button>
                </div>

                {mapMode === 'candidato' && (
                  <div className="w-56">
                    <select
                      value={mapCandidate}
                      onChange={e => setMapCandidate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500"
                    >
                      {uniqueCandidates.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Map Grid: Map Canvas + Local Inspector Sidebar */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Map Canvas (2 cols) */}
              <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-xs p-4 relative flex flex-col min-h-[580px]">
                {/* Floating Zoom & Action Controls */}
                <div className="absolute top-6 left-6 z-10 flex flex-col gap-1.5 bg-white/95 backdrop-blur-xs p-1.5 rounded-lg border border-slate-200 shadow-xs">
                  <button
                    onClick={() => handleMapZoom('in')}
                    className="p-1.5 hover:bg-slate-100 rounded text-slate-700 transition-colors"
                    title="Aproximar Zoom"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleMapZoom('out')}
                    className="p-1.5 hover:bg-slate-100 rounded text-slate-700 transition-colors"
                    title="Afastar Zoom"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleMapZoom('reset')}
                    className="p-1.5 hover:bg-slate-100 rounded text-slate-700 transition-colors border-t border-slate-100 mt-0.5"
                    title="Redefinir Enquadramento"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Map Title Indicator */}
                <div className="absolute top-6 right-6 z-10 bg-white/95 backdrop-blur-xs px-3 py-1.5 rounded-lg border border-slate-200 shadow-xs text-xs">
                  {mapMode === 'volume' && (
                    <span className="font-semibold text-blue-700">
                      Densidade de Votos: {activeMapName === 'ceara' ? 'Municípios do Ceará' : 'Bairros de Fortaleza'}
                    </span>
                  )}
                  {mapMode === 'candidato' && <span className="font-semibold text-red-700">Mancha de Votos: {mapCandidate}</span>}
                  {mapMode === 'vencedor' && <span className="font-semibold text-purple-700">Líderes Locais Mais Votados</span>}
                </div>

                <div ref={mapChartRef} className="w-full flex-1 h-[540px]" />
                <div className="text-[11px] text-slate-400 mt-2 text-center">
                  Dica: Use a roda do mouse para aproximar ou arraste pelo mapa. Clique em qualquer {activeMapName === 'ceara' ? 'município' : 'bairro'} para travar a inspeção ao lado.
                </div>
              </div>

              {/* Local Inspector Sidebar (1 col) */}
              {(() => {
                const bInfo = bairroSummaryMap[hoveredOrSelectedBairro.toUpperCase().trim()] || {
                  totalVotos: 0,
                  leader: '-',
                  leaderVotes: 0,
                  leaderPerc: '0%',
                  leaderParty: '-',
                  leaderStatus: '-'
                };
                const bRows = availableForYear.filter(r => r.bairro.toUpperCase().trim() === hoveredOrSelectedBairro.toUpperCase().trim()).sort((a, b) => b.votos - a.votos);

                return (
                  <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 flex flex-col justify-between space-y-4">
                    <div className="space-y-4">
                      <div className="pb-3 border-b border-slate-100 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                            {activeMapName === 'ceara' ? 'Inspeção Municipal' : 'Raio-X Territorial'}
                          </span>
                          <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono font-semibold">
                            {((bInfo.totalVotos / (kpis.totalVotos || 1)) * 100).toFixed(2)}% do filtro
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <select
                            value={hoveredOrSelectedBairro}
                            onChange={e => setHoveredOrSelectedBairro(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500"
                          >
                            {uniqueBairros.map(b => (
                              <option key={b} value={b}>{b}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
                          <span className="font-bold text-blue-700">{bInfo.totalVotos.toLocaleString('pt-BR')} votos apurados</span>
                          <span>{bRows.length} candidatos</span>
                        </div>
                      </div>

                      {/* Leader Card */}
                      <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200/80 space-y-1.5">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                          Mais Votado no {activeMapName === 'ceara' ? 'Município' : 'Bairro'}
                        </span>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-slate-900 truncate">{bInfo.leader}</span>
                          {bInfo.leaderStatus && bInfo.leaderStatus !== '-' && (
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${bInfo.leaderStatus === 'ELEITO' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'}`}>
                              {bInfo.leaderStatus}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-600 flex justify-between pt-1">
                          <span>{bInfo.leaderParty}</span>
                          <span className="font-mono font-semibold text-blue-700">
                            {bInfo.leaderVotes.toLocaleString('pt-BR')} votos ({bInfo.leaderPerc})
                          </span>
                        </div>
                      </div>

                      {/* Top 5 */}
                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-xs font-semibold text-slate-700">
                          <span>Top Candidatos no Local</span>
                          <span className="text-[11px] font-normal text-slate-400">Votos nominais</span>
                        </div>
                        <div className="space-y-2 text-xs">
                          {bRows.slice(0, 5).map((r, idx) => {
                            const p = bInfo.totalVotos > 0 ? (r.votos / bInfo.totalVotos) * 100 : 0;
                            return (
                              <div key={`${r.candidato}-${idx}`} className="space-y-1">
                                <div className="flex justify-between items-center">
                                  <span className="font-medium text-slate-800 truncate">
                                    <span className="text-slate-400 font-mono mr-1.5">{idx + 1}.</span>
                                    {r.candidato}
                                  </span>
                                  <span className="font-mono text-slate-900 font-semibold">{r.votos.toLocaleString('pt-BR')}</span>
                                </div>
                                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-blue-600 rounded-full"
                                    style={{ width: `${Math.min(p * 2.5, 100)}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
                      <button
                        onClick={() => {
                          setSelectedBairro(hoveredOrSelectedBairro);
                          setActiveTab('bairro');
                        }}
                        className="w-full py-2 px-3 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors text-center shadow-xs"
                      >
                        Ver Detalhes do Local
                      </button>
                      <button
                        onClick={() => {
                          setBairroFilter(hoveredOrSelectedBairro);
                          setActiveTab('tabela');
                        }}
                        className="w-full py-2 px-3 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors text-center"
                      >
                        Filtrar Registros na Tabela
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* TAB 1: VISÃO GERAL */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Live Sheets Status Bar */}
            <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-blue-950 flex items-center gap-2">
                    Base Oficial Vinculada ao Google Drive
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-semibold">
                      Sincronização Ativa
                    </span>
                  </h3>
                  <p className="text-xs text-blue-700">
                    Os dados são alimentados em tempo real pela planilha do Google Drive. Qualquer alteração feita na planilha é refletida imediatamente no painel.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleSyncWithGoogleSheets(true)}
                  disabled={isSyncing}
                  className="px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  {isSyncing ? 'Sincronizando...' : 'Atualizar Dados da Planilha'}
                </button>
                <a
                  href={SPREADSHEET_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  Abrir no Drive
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                </a>
              </div>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-100">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Top Candidatos por Votação</h3>
                    <p className="text-xs text-slate-500">Ranking consolidado no filtro ativo</p>
                  </div>
                  <span className="text-xs text-slate-400 font-mono">Barras</span>
                </div>
                <div ref={overviewCandChartRef} className="w-full h-80" />
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-100">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Top Localidades em Volume de Votos</h3>
                    <p className="text-xs text-slate-500">Maiores colégios eleitorais apurados</p>
                  </div>
                  <span className="text-xs text-slate-400 font-mono">Volume</span>
                </div>
                <div ref={overviewBairroChartRef} className="w-full h-80" />
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-100">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Distribuição de Votos por Partido</h3>
                    <p className="text-xs text-slate-500">Participação percentual das maiores legendas</p>
                  </div>
                  <span className="text-xs text-slate-400 font-mono">Rosca</span>
                </div>
                <div ref={overviewPartyChartRef} className="w-full h-80" />
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-100">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Concentração Eleitoral no Local Líder</h3>
                    <p className="text-xs text-slate-500">% do total obtida em um único município/bairro</p>
                  </div>
                  <span className="text-xs text-slate-400 font-mono">Top Redutos</span>
                </div>
                <div ref={overviewRedutoChartRef} className="w-full h-80" />
              </div>
            </div>
          </div>
        )}

        {/* TAB: REDUTOS ELEITORAIS */}
        {activeTab === 'redutos' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs space-y-3">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-red-600" />
                Matriz de Redutos Eleitorais: Dependência Territorial
              </h2>
              <p className="text-xs text-slate-600 leading-relaxed max-w-4xl">
                Esta análise cruza o <strong>volume total de votos</strong> de cada candidato com o{' '}
                <strong>peso percentual do seu local mais representativo</strong>. Candidatos com mais de 30% de seus votos num só local dependem fortemente de uma única base geográfica (hiper-reduto), ao passo que candidatos com menos de 10% dependem de capilaridade em todo o território.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.values(candidateStatsMap)
                .sort((a, b) => b.votosTotal - a.votosTotal)
                .slice(0, 15)
                .map(c => {
                  const percNum = parseFloat(c.concentracaoTopBairro);
                  const isHigh = percNum >= 30;
                  const isMed = percNum >= 15 && percNum < 30;
                  return (
                    <div key={c.nome} className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3 flex flex-col justify-between">
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="font-bold text-slate-900 text-sm block leading-tight">{c.nome}</span>
                            <span className="text-xs text-slate-500 font-mono">{c.numero} · {c.partido} {c.cargo ? `· ${c.cargo}` : ''}</span>
                          </div>
                          {c.status && c.status !== '-' && (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${c.status === 'ELEITO' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                              {c.status}
                            </span>
                          )}
                        </div>

                        <div className="mt-4 space-y-1.5 text-xs">
                          <div className="flex justify-between text-slate-600">
                            <span>Votos Totais na Base:</span>
                            <span className="font-mono font-bold text-slate-900">{c.votosTotal.toLocaleString('pt-BR')}</span>
                          </div>
                          <div className="flex justify-between text-slate-600">
                            <span>Local Principal:</span>
                            <span className="font-bold text-blue-700">{c.topBairro}</span>
                          </div>
                          <div className="flex justify-between text-slate-600">
                            <span>Votos no Local Principal:</span>
                            <span className="font-mono text-slate-800">{c.topBairroVotos.toLocaleString('pt-BR')}</span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-100">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-slate-500 font-medium">Índice de Concentração</span>
                          <span className={`font-mono font-bold ${isHigh ? 'text-red-600' : isMed ? 'text-amber-600' : 'text-blue-600'}`}>
                            {c.concentracaoTopBairro}
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${isHigh ? 'bg-red-500' : isMed ? 'bg-amber-500' : 'bg-blue-600'}`}
                            style={{ width: `${Math.min(percNum * 1.5, 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* TAB: RAIO-X POR CANDIDATO */}
        {activeTab === 'candidato' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Selecione o Candidato para Auditoria Territorial</h2>
                <p className="text-xs text-slate-500">Exibição detalhada de desempenho em todas as seções e localidades</p>
              </div>
              <div className="w-full md:w-80">
                <select
                  value={selectedCandidate}
                  onChange={e => setSelectedCandidate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  {uniqueCandidates.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            {(() => {
              const candData = candidateStatsMap[selectedCandidate] || {
                nome: selectedCandidate,
                numero: '-',
                partido: '-',
                status: '-',
                cargo: '-',
                ano: '-',
                votosTotal: 0,
                topBairro: '-',
                topBairroVotos: 0,
                concentracaoTopBairro: '0%'
              };
              const candRows = availableForYear.filter(r => r.candidato === selectedCandidate).sort((a, b) => b.votos - a.votos);

              return (
                <div className="space-y-6">
                  {/* Cand Summary Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                      <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Candidato & Partido</span>
                      <span className="text-base sm:text-lg font-bold text-slate-900 block mt-1 truncate">{candData.nome}</span>
                      <span className="text-xs text-slate-500 font-mono mt-0.5 block">{candData.numero} · {candData.partido}</span>
                    </div>

                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                      <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Cargo / Eleição</span>
                      <span className="text-base sm:text-lg font-bold block mt-1 text-slate-900">
                        {candData.cargo || 'Legislativo'}
                      </span>
                      <span className="text-xs text-slate-400 mt-0.5 block">{candData.ano ? `Ano ${candData.ano}` : '-'}</span>
                    </div>

                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                      <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Total de Votos</span>
                      <span className="text-xl sm:text-2xl font-bold font-mono text-blue-700 block mt-1 tabular-nums">
                        {candData.votosTotal.toLocaleString('pt-BR')}
                      </span>
                      <span className="text-xs text-slate-400 mt-0.5 block">em {candRows.length} localidades</span>
                    </div>

                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                      <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Local Líder (Reduto)</span>
                      <span className="text-base sm:text-lg font-bold text-slate-900 block mt-1 truncate">{candData.topBairro}</span>
                      <span className="text-xs font-mono text-slate-500 mt-0.5 block">
                        {candData.topBairroVotos.toLocaleString('pt-BR')} votos ({candData.concentracaoTopBairro})
                      </span>
                    </div>
                  </div>

                  {/* Cand Chart & Table */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col">
                      <h3 className="text-sm font-bold text-slate-900 pb-2 mb-3 border-b border-slate-100">
                        Top 12 Locais com Maior Votação de {selectedCandidate}
                      </h3>
                      <div ref={drillCandidateChartRef} className="w-full h-80" />
                    </div>

                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col">
                      <h3 className="text-sm font-bold text-slate-900 pb-2 mb-3 border-b border-slate-100 flex items-center justify-between">
                        <span>Votação Detalhada por Local</span>
                        <span className="text-xs text-slate-400 font-mono">{candRows.length} locais</span>
                      </h3>
                      <div className="overflow-y-auto max-h-80 divide-y divide-slate-100 text-xs">
                        {candRows.map((r, i) => (
                          <div key={`${r.bairro}-${i}`} className="py-2 flex items-center justify-between hover:bg-slate-50 px-2 rounded">
                            <span className="text-slate-800 font-medium">
                              <span className="text-slate-400 font-mono mr-2">{i + 1}.</span>
                              {r.bairro}
                            </span>
                            <div className="flex items-center gap-3 font-mono">
                              <span className="font-bold text-slate-900">{r.votos.toLocaleString('pt-BR')} votos</span>
                              <span className="text-slate-500 text-[11px]">
                                {candData.votosTotal > 0 ? ((r.votos / candData.votosTotal) * 100).toFixed(1) : 0}%
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* TAB: ANÁLISE POR BAIRRO */}
        {activeTab === 'bairro' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Selecione o Bairro / Município</h2>
                <p className="text-xs text-slate-500">Avalie os candidatos líderes e a distribuição política no local</p>
              </div>
              <div className="w-full md:w-80">
                <select
                  value={selectedBairro}
                  onChange={e => setSelectedBairro(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  {uniqueBairros.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
            </div>

            {(() => {
              const bRows = availableForYear.filter(r => r.bairro === selectedBairro).sort((a, b) => b.votos - a.votos);
              const totalBairroVotos = bRows.reduce((acc, r) => acc + r.votos, 0);
              const leader = bRows[0] || { candidato: '-', votos: 0, partido: '-', status: '-' };
              const leaderPerc = totalBairroVotos > 0 ? (leader.votos / totalBairroVotos) * 100 : 0;

              return (
                <div className="space-y-6">
                  {/* Bairro Summary Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                      <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Localidade</span>
                      <span className="text-lg font-bold text-slate-900 block mt-1 truncate">{selectedBairro}</span>
                      <span className="text-xs text-slate-400 mt-0.5 block">Ceará</span>
                    </div>

                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                      <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Votos Totais</span>
                      <span className="text-xl sm:text-2xl font-bold font-mono text-blue-700 block mt-1 tabular-nums">
                        {totalBairroVotos.toLocaleString('pt-BR')}
                      </span>
                      <span className="text-xs text-slate-400 mt-0.5 block">{bRows.length} candidatos pontuaram</span>
                    </div>

                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                      <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Candidato Vencedor</span>
                      <span className="text-base sm:text-lg font-bold text-slate-900 block mt-1 truncate">{leader.candidato}</span>
                      <span className="text-xs text-slate-500 font-mono mt-0.5 block">{leader.partido} {leader.status ? `(${leader.status})` : ''}</span>
                    </div>

                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                      <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Votos do Vencedor</span>
                      <span className="text-xl sm:text-2xl font-bold font-mono text-emerald-600 block mt-1 tabular-nums">
                        {leader.votos.toLocaleString('pt-BR')}
                      </span>
                      <span className="text-xs text-slate-500 font-mono mt-0.5 block">{leaderPerc.toFixed(1)}% dos votos do local</span>
                    </div>
                  </div>

                  {/* Bairro Chart & Table */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col">
                      <h3 className="text-sm font-bold text-slate-900 pb-2 mb-3 border-b border-slate-100">
                        Top 12 Mais Votados em {selectedBairro}
                      </h3>
                      <div ref={drillBairroChartRef} className="w-full h-80" />
                    </div>

                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col">
                      <h3 className="text-sm font-bold text-slate-900 pb-2 mb-3 border-b border-slate-100 flex items-center justify-between">
                        <span>Ranking Completo no Local</span>
                        <span className="text-xs text-slate-400 font-mono">{bRows.length} candidatos</span>
                      </h3>
                      <div className="overflow-y-auto max-h-80 divide-y divide-slate-100 text-xs">
                        {bRows.map((r, i) => (
                          <div key={`${r.candidato}-${i}`} className="py-2 flex items-center justify-between hover:bg-slate-50 px-2 rounded">
                            <div>
                              <span className="text-slate-400 font-mono mr-2">{i + 1}.</span>
                              <span className="text-slate-900 font-semibold">{r.candidato}</span>
                              <span className="text-slate-500 text-[11px] ml-1.5 font-mono">({r.partido})</span>
                            </div>
                            <div className="flex items-center gap-3 font-mono">
                              <span className="font-bold text-slate-900">{r.votos.toLocaleString('pt-BR')}</span>
                              <span className="text-slate-500 text-[11px]">
                                {totalBairroVotos > 0 ? ((r.votos / totalBairroVotos) * 100).toFixed(1) : 0}%
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Bairro Candidate Comparator Module */}
                  <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-blue-600" />
                          Comparador de Candidatos em {selectedBairro}
                        </h3>
                        <p className="text-xs text-slate-500">Selecione até 3 candidatos para confrontar o desempenho local e na base geral</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">Gráfico:</span>
                        <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs">
                          <button
                            onClick={() => setCompareChartType('bar')}
                            className={`px-2.5 py-1 rounded-md transition-colors ${compareChartType === 'bar' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'}`}
                          >
                            Barras
                          </button>
                          <button
                            onClick={() => setCompareChartType('radar')}
                            className={`px-2.5 py-1 rounded-md transition-colors ${compareChartType === 'radar' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'}`}
                          >
                            Radar
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                      {/* Cand 1 */}
                      <div className="p-2.5 rounded-lg border border-blue-200 bg-blue-50/30">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                          <label className="font-bold text-blue-900">Candidato A (Azul)</label>
                        </div>
                        <select
                          value={compareCand1}
                          onChange={e => setCompareCand1(e.target.value)}
                          className="w-full bg-white border border-blue-200 rounded-md px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Nenhum</option>
                          {uniqueCandidates.map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>

                      {/* Cand 2 */}
                      <div className="p-2.5 rounded-lg border border-amber-200 bg-amber-50/30">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                          <label className="font-bold text-amber-900">Candidato B (Laranja)</label>
                        </div>
                        <select
                          value={compareCand2}
                          onChange={e => setCompareCand2(e.target.value)}
                          className="w-full bg-white border border-amber-200 rounded-md px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-amber-500"
                        >
                          <option value="">Nenhum</option>
                          {uniqueCandidates.map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>

                      {/* Cand 3 */}
                      <div className="p-2.5 rounded-lg border border-emerald-200 bg-emerald-50/30">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                          <label className="font-bold text-emerald-900">Candidato C (Verde)</label>
                        </div>
                        <select
                          value={compareCand3}
                          onChange={e => setCompareCand3(e.target.value)}
                          className="w-full bg-white border border-emerald-200 rounded-md px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500"
                        >
                          <option value="">Nenhum</option>
                          {uniqueCandidates.map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Chart & Metrics Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
                      <div className="lg:col-span-2 bg-slate-50/60 rounded-xl border border-slate-200 p-3 min-h-[360px] flex flex-col justify-center">
                        <div ref={bairroCompareChartRef} className="w-full h-80" />
                      </div>

                      {/* Detailed comparison cards */}
                      <div className="space-y-3">
                        {[
                          { name: compareCand1, color: '#2563eb', border: 'border-blue-200', bg: 'bg-blue-50/40' },
                          { name: compareCand2, color: '#f59e0b', border: 'border-amber-200', bg: 'bg-amber-50/40' },
                          { name: compareCand3, color: '#10b981', border: 'border-emerald-200', bg: 'bg-emerald-50/40' }
                        ].filter(item => Boolean(item.name)).map(item => {
                          const candRow = bRows.find(r => r.candidato === item.name);
                          const votosNoB = candRow ? candRow.votos : 0;
                          const percNoB = totalBairroVotos > 0 ? (votosNoB / totalBairroVotos) * 100 : 0;
                          const posNoB = bRows.findIndex(r => r.candidato === item.name) + 1;
                          const info = candidateStatsMap[item.name];
                          const totalCid = info ? info.votosTotal : 0;
                          const pesoNoC = totalCid > 0 ? (votosNoB / totalCid) * 100 : 0;

                          return (
                            <div key={item.name} className={`p-3.5 rounded-xl border ${item.border} ${item.bg} space-y-2 text-xs`}>
                              <div className="flex justify-between items-start">
                                <div>
                                  <span className="font-bold text-slate-900 block text-sm">{item.name}</span>
                                  <span className="text-[11px] text-slate-500 font-mono">{info?.partido || '-'} · {info?.numero || '-'}</span>
                                </div>
                                {info?.status && info.status !== '-' && (
                                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${info?.status === 'ELEITO' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'}`}>
                                    {info?.status || '-'}
                                  </span>
                                )}
                              </div>

                              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60 text-[11px]">
                                <div>
                                  <span className="text-slate-500 block">Votos em {selectedBairro}:</span>
                                  <span className="font-mono font-bold text-slate-900 text-xs">{votosNoB.toLocaleString('pt-BR')} ({percNoB.toFixed(1)}%)</span>
                                </div>
                                <div>
                                  <span className="text-slate-500 block">Posição no Local:</span>
                                  <span className="font-mono font-bold text-slate-800 text-xs">#{posNoB > 0 ? posNoB : '-'} lugar</span>
                                </div>
                                <div>
                                  <span className="text-slate-500 block">Total Geral:</span>
                                  <span className="font-mono font-semibold text-slate-700">{totalCid.toLocaleString('pt-BR')} votos</span>
                                </div>
                                <div>
                                  <span className="text-slate-500 block">Peso deste Local:</span>
                                  <span className="font-mono font-semibold text-slate-700">{pesoNoC.toFixed(1)}% do total</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* TAB: TABELA ANALÍTICA */}
        {activeTab === 'tabela' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden space-y-0">
            <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Base Tabulada Auditada</h2>
                <p className="text-xs text-slate-500">
                  Dados sincronizados com o Google Drive · Ordenação multicritério e filtros em tempo real
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                    placeholder="Pesquisar candidato, local, ano..."
                    className="bg-slate-50 border border-slate-300 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 w-64 transition-all"
                  />
                  <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2" />
                </div>
                <button
                  onClick={handleExportCSV}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  Exportar CSV
                </button>
              </div>
            </div>

            <div className="overflow-x-auto max-h-[550px]">
              <table className="w-full text-left text-xs text-slate-600 border-collapse">
                <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200 text-slate-700 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-3 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('ano')}>
                      <div className="flex items-center gap-1">Ano <ArrowUpDown className="w-3 h-3 text-slate-400" /></div>
                    </th>
                    <th className="py-3 px-3 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('cargo')}>
                      <div className="flex items-center gap-1">Cargo <ArrowUpDown className="w-3 h-3 text-slate-400" /></div>
                    </th>
                    <th className="py-3 px-4 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('candidato')}>
                      <div className="flex items-center gap-1">Candidato <ArrowUpDown className="w-3 h-3 text-slate-400" /></div>
                    </th>
                    <th className="py-3 px-3 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('numero')}>
                      <div className="flex items-center gap-1">Número <ArrowUpDown className="w-3 h-3 text-slate-400" /></div>
                    </th>
                    <th className="py-3 px-3 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('partido')}>
                      <div className="flex items-center gap-1">Partido <ArrowUpDown className="w-3 h-3 text-slate-400" /></div>
                    </th>
                    <th className="py-3 px-4 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('bairro')}>
                      <div className="flex items-center gap-1">Bairro / Município <ArrowUpDown className="w-3 h-3 text-slate-400" /></div>
                    </th>
                    <th className="py-3 px-4 text-right cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('votos')}>
                      <div className="flex items-center justify-end gap-1">Votos <ArrowUpDown className="w-3 h-3 text-slate-400" /></div>
                    </th>
                    <th className="py-3 px-3 text-right cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('perc')}>
                      <div className="flex items-center justify-end gap-1">% Votos <ArrowUpDown className="w-3 h-3 text-slate-400" /></div>
                    </th>
                    <th className="py-3 px-3 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('status')}>
                      <div className="flex items-center gap-1">Status <ArrowUpDown className="w-3 h-3 text-slate-400" /></div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-normal">
                  {paginatedData.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400">
                        Nenhum registro encontrado com os filtros aplicados.
                      </td>
                    </tr>
                  ) : (
                    paginatedData.map((r, i) => (
                      <tr key={`${r.ano}-${r.numero}-${r.bairro}-${i}`} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-semibold text-slate-700 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${r.ano === '2026' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-slate-100 text-slate-700'}`}>
                            {r.ano}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap text-[11px] font-medium">{r.cargo || '-'}</td>
                        <td className="py-2.5 px-4 font-semibold text-slate-900 whitespace-nowrap">{r.candidato}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">{r.numero}</td>
                        <td className="py-2.5 px-3 font-medium text-slate-700">{r.partido}</td>
                        <td className="py-2.5 px-4 text-slate-800 font-medium">{r.bairro}</td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">{r.votos.toLocaleString('pt-BR')}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-600">{r.perc.toFixed(2).replace('.', ',')}%</td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {r.status ? (
                            <span className={`text-[11px] font-semibold ${r.status === 'ELEITO' ? 'text-emerald-700' : 'text-slate-500'}`}>
                              {r.status}
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400">-</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
              <div>
                Mostrando {sortedTableData.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} a {Math.min(currentPage * pageSize, sortedTableData.length)} de {sortedTableData.length.toLocaleString('pt-BR')} linhas
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <span>Itens por página:</span>
                  <select
                    value={pageSize}
                    onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                    className="bg-white border border-slate-300 rounded px-2 py-1 text-xs"
                  >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                    disabled={currentPage <= 1}
                    className="p-1.5 rounded bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="font-mono px-2 font-semibold">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                    disabled={currentPage >= totalPages}
                    className="p-1.5 rounded bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB: AUDITORIA & METODOLOGIA */}
        {activeTab === 'auditoria' && (
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-xs space-y-6 text-xs text-slate-700">
            <div className="pb-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-blue-600" />
                  Auditoria de Dados, Conexão Google Drive e Metodologia
                </h2>
                <p className="text-slate-500 mt-1">
                  Documentação técnica da base de dados e integração em tempo real com o Google Sheets.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleSyncWithGoogleSheets(true)}
                  disabled={isSyncing}
                  className="px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  {isSyncing ? 'Sincronizando...' : 'Sincronizar Agora'}
                </button>
              </div>
            </div>

            {/* Google Drive Integration Panel */}
            <div className="bg-gradient-to-br from-blue-50/50 to-indigo-50/40 p-5 rounded-xl border border-blue-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-blue-950 text-sm flex items-center gap-2">
                  <Database className="w-4 h-4 text-blue-600" />
                  Conexão com a Planilha Google Drive (Ao Vivo)
                </h3>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  Conectado e Ativo
                </span>
              </div>

              <p className="text-slate-600 leading-relaxed text-xs">
                O painel consome diretamente os dados da planilha compartilhada no Google Drive. Quando qualquer linha, voto ou candidato for editado na planilha, basta clicar no botão <strong>"Atualizar Dados"</strong> (ou aguardar o ciclo automático de 60 segundos) que todos os gráficos, somatórios, mapas e tabelas são recalculados instantaneamente.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
                <div className="bg-white p-3 rounded-lg border border-blue-100">
                  <span className="text-[11px] text-slate-400 block font-medium">Link do Google Drive</span>
                  <a
                    href={SPREADSHEET_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1 mt-0.5 truncate"
                  >
                    Abrir Planilha
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                </div>

                <div className="bg-white p-3 rounded-lg border border-blue-100">
                  <span className="text-[11px] text-slate-400 block font-medium">Última Sincronização</span>
                  <span className="text-xs font-mono font-bold text-slate-800 block mt-0.5">
                    {lastSyncTime ? lastSyncTime.toLocaleTimeString('pt-BR') : '-'}
                  </span>
                </div>

                <div className="bg-white p-3 rounded-lg border border-blue-100">
                  <span className="text-[11px] text-slate-400 block font-medium">Total de Registros</span>
                  <span className="text-xs font-mono font-bold text-emerald-700 block mt-0.5">
                    {allRecords.length.toLocaleString('pt-BR')} linhas
                  </span>
                </div>

                <div className="bg-white p-3 rounded-lg border border-blue-100">
                  <span className="text-[11px] text-slate-400 block font-medium">Anos Carregados</span>
                  <span className="text-xs font-mono font-bold text-indigo-700 block mt-0.5">
                    {uniqueYears.join(', ')}
                  </span>
                </div>
              </div>
            </div>

            {/* Breakdown by Year & Cargo */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-2">
                <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  Distribuição por Ano na Base
                </h4>
                <div className="space-y-1.5 text-xs font-mono">
                  {uniqueYears.map(ano => {
                    const c = allRecords.filter(r => r.ano === ano).length;
                    const totVotos = allRecords.filter(r => r.ano === ano).reduce((acc, r) => acc + r.votos, 0);
                    return (
                      <div key={ano} className="flex justify-between py-1 border-b border-slate-200/60">
                        <span className="font-bold text-slate-800">Ano {ano}:</span>
                        <span>
                          {c.toLocaleString('pt-BR')} linhas · {totVotos.toLocaleString('pt-BR')} votos
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-2">
                <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                  Distribuição por Cargo
                </h4>
                <div className="space-y-1.5 text-xs font-mono">
                  {uniqueCargos.map(cargo => {
                    const c = allRecords.filter(r => r.cargo === cargo).length;
                    const totVotos = allRecords.filter(r => r.cargo === cargo).reduce((acc, r) => acc + r.votos, 0);
                    return (
                      <div key={cargo} className="flex justify-between py-1 border-b border-slate-200/60">
                        <span className="font-bold text-slate-800">{cargo}:</span>
                        <span>
                          {c.toLocaleString('pt-BR')} linhas · {totVotos.toLocaleString('pt-BR')} votos
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* FOOTER */}
      <footer className="bg-white border-t border-slate-200 mt-12 py-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-slate-800">
              Painel Eleitoral Ceará {uniqueYears.join(' · ')} · Inteligência Territorial de Votação • Elaborado Por Marcos Silveira
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Conectado ao vivo com Google Drive Spreadsheet ID: {SPREADSHEET_ID}. Sessão: {currentUser.name} ({currentUser.role.toUpperCase()}).
            </p>
          </div>
          <div className="flex items-center gap-4 text-slate-600">
            {isMaster && (
              <button
                onClick={() => setActiveTab('acesso')}
                className="hover:text-amber-800 flex items-center gap-1 font-bold text-amber-700"
              >
                <span>👑 Gestão de Acessos</span>
              </button>
            )}
            <button
              onClick={() => handleSyncWithGoogleSheets(true)}
              className="hover:text-blue-600 flex items-center gap-1 font-medium"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              Sincronizar
            </button>
            <span>·</span>
            <a
              href={SPREADSHEET_URL}
              target="_blank"
              rel="noreferrer"
              className="hover:text-blue-600 flex items-center gap-1 font-medium"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Google Drive
            </a>
            <span>·</span>
            <a href="./dashboard.html" download="dashboard_votacao_ceara.html" className="hover:text-blue-600 flex items-center gap-1 font-medium">
              <Download className="w-3.5 h-3.5" />
              Download HTML
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
