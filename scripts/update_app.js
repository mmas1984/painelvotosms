import fs from 'fs';

const appPath = './src/App.tsx';
let code = fs.readFileSync(appPath, 'utf8');

// 1. Ensure globalBairroSummaryMap and reactive bairroSummaryMap
const oldBairroSummary = `  // Bairro Aggregation Map
  const bairroSummaryMap = useMemo(() => {
    const map: Record<string, { totalVotos: number; leader: string; leaderVotes: number; leaderPerc: string; leaderParty: string; leaderStatus: string }> = {};
    allRecords.forEach(r => {
      if (!map[r.bairro]) {
        map[r.bairro] = { totalVotos: 0, leader: '', leaderVotes: 0, leaderPerc: '0%', leaderParty: '', leaderStatus: '' };
      }
      map[r.bairro].totalVotos += r.votos;
      if (r.votos > map[r.bairro].leaderVotes) {
        map[r.bairro].leaderVotes = r.votos;
        map[r.bairro].leader = r.candidato;
        map[r.bairro].leaderParty = r.partido;
        map[r.bairro].leaderStatus = r.status;
      }
    });
    Object.keys(map).forEach(b => {
      const tot = map[b].totalVotos;
      map[b].leaderPerc = tot > 0 ? ((map[b].leaderVotes / tot) * 100).toFixed(1) + '%' : '0%';
    });
    return map;
  }, [allRecords]);`;

const newBairroSummary = `  // City-wide global Bairro Aggregation Map (baseline 100% of capital)
  const globalBairroSummaryMap = useMemo(() => {
    const map: Record<string, { totalVotos: number; leader: string; leaderVotes: number; leaderPerc: string; leaderParty: string; leaderStatus: string }> = {};
    allRecords.forEach(r => {
      if (!map[r.bairro]) {
        map[r.bairro] = { totalVotos: 0, leader: '', leaderVotes: 0, leaderPerc: '0%', leaderParty: '', leaderStatus: '' };
      }
      map[r.bairro].totalVotos += r.votos;
      if (r.votos > map[r.bairro].leaderVotes) {
        map[r.bairro].leaderVotes = r.votos;
        map[r.bairro].leader = r.candidato;
        map[r.bairro].leaderParty = r.partido;
        map[r.bairro].leaderStatus = r.status;
      }
    });
    Object.keys(map).forEach(b => {
      const tot = map[b].totalVotos;
      map[b].leaderPerc = tot > 0 ? ((map[b].leaderVotes / tot) * 100).toFixed(1) + '%' : '0%';
    });
    return map;
  }, [allRecords]);

  // Bairro Aggregation Map (reactive to current active filters)
  const bairroSummaryMap = useMemo(() => {
    const map: Record<string, { totalVotos: number; leader: string; leaderVotes: number; leaderPerc: string; leaderParty: string; leaderStatus: string }> = {};
    filteredRecords.forEach(r => {
      if (!map[r.bairro]) {
        map[r.bairro] = { totalVotos: 0, leader: '', leaderVotes: 0, leaderPerc: '0%', leaderParty: '', leaderStatus: '' };
      }
      map[r.bairro].totalVotos += r.votos;
      if (r.votos > map[r.bairro].leaderVotes) {
        map[r.bairro].leaderVotes = r.votos;
        map[r.bairro].leader = r.candidato;
        map[r.bairro].leaderParty = r.partido;
        map[r.bairro].leaderStatus = r.status;
      }
    });
    Object.keys(map).forEach(b => {
      const tot = map[b].totalVotos;
      map[b].leaderPerc = tot > 0 ? ((map[b].leaderVotes / tot) * 100).toFixed(1) + '%' : '0%';
    });
    return map;
  }, [filteredRecords]);`;

if (code.includes(oldBairroSummary)) {
  code = code.replace(oldBairroSummary, newBairroSummary);
  console.log('Updated bairroSummaryMap');
} else {
  console.log('Notice: oldBairroSummary not found directly, checking variations...');
}

// 2. Enhance Map Chart useEffect to auto-resize, include all geo features, and bind hover
const oldMapEffectStart = "  // MAP CHART RENDER\n  useEffect(() => {\n    if (activeTab !== 'mapa') return;\n    const chart = getOrCreateChart(mapChartRef.current);\n    if (!chart) return;";
const newMapEffectStart = `  // MAP CHART RENDER
  useEffect(() => {
    if (activeTab !== 'mapa') return;

    let chart: echarts.ECharts | null = null;
    let resizeTimer: any = null;

    const initMap = () => {
      if (!mapChartRef.current) return;
      chart = getOrCreateChart(mapChartRef.current);
      if (!chart) return;

      chart.resize();`;

code = code.replace(oldMapEffectStart, newMapEffectStart);

// Map data features mapping
const oldVolumeMapData = `      mapData = Object.entries(bairroSummaryMap).map(([bairro, info]) => ({
        name: bairro,
        value: info.totalVotos,
        leader: info.leader,
        leaderVotes: info.leaderVotes,
        leaderPerc: info.leaderPerc,
        leaderParty: info.leaderParty
      }));`;

const newVolumeMapData = `      const geoFeatures: string[] = (fortalezaGeoJson as any).features.map((f: any) => f.properties.name);
      const allBairrosSet = Array.from(new Set([...geoFeatures, ...Object.keys(bairroSummaryMap), ...uniqueBairros]));
      mapData = allBairrosSet.map(bairro => {
        const info = bairroSummaryMap[bairro] || {
          totalVotos: 0,
          leader: 'Sem votos apurados',
          leaderVotes: 0,
          leaderPerc: '0%',
          leaderParty: '-'
        };
        return {
          name: bairro,
          value: info.totalVotos,
          leader: info.leader,
          leaderVotes: info.leaderVotes,
          leaderPerc: info.leaderPerc,
          leaderParty: info.leaderParty
        };
      });`;

code = code.replace(oldVolumeMapData, newVolumeMapData);

// Candidate map data
const oldCandMapData = `      mapData = Object.keys(bairroSummaryMap).map(bairro => {
        const v = candMap[bairro] || 0;
        const tot = bairroSummaryMap[bairro]?.totalVotos || 0;
        const p = tot > 0 ? ((v / tot) * 100).toFixed(1) + '%' : '0%';
        return {
          name: bairro,
          value: v,
          candVotos: v,
          candPerc: p,
          totalBairro: tot,
          candidateName: mapCandidate
        };
      });`;

const newCandMapData = `      const geoFeatures: string[] = (fortalezaGeoJson as any).features.map((f: any) => f.properties.name);
      const allBairrosSet = Array.from(new Set([...geoFeatures, ...Object.keys(bairroSummaryMap), ...uniqueBairros]));
      mapData = allBairrosSet.map(bairro => {
        const v = candMap[bairro] || 0;
        const tot = bairroSummaryMap[bairro]?.totalVotos || globalBairroSummaryMap[bairro]?.totalVotos || 0;
        const p = tot > 0 ? ((v / tot) * 100).toFixed(1) + '%' : '0%';
        return {
          name: bairro,
          value: v,
          candVotos: v,
          candPerc: p,
          totalBairro: tot,
          candidateName: mapCandidate
        };
      });`;

code = code.replace(oldCandMapData, newCandMapData);

// Winner map data
const oldWinnerMapData = `      mapData = Object.entries(bairroSummaryMap).map(([bairro, info]) => ({
        name: bairro,
        value: info.leaderVotes,
        leader: info.leader,
        leaderParty: info.leaderParty,
        leaderPerc: info.leaderPerc,
        totalBairro: info.totalVotos
      }));`;

const newWinnerMapData = `      const geoFeatures: string[] = (fortalezaGeoJson as any).features.map((f: any) => f.properties.name);
      const allBairrosSet = Array.from(new Set([...geoFeatures, ...Object.keys(bairroSummaryMap), ...uniqueBairros]));
      mapData = allBairrosSet.map(bairro => {
        const info = bairroSummaryMap[bairro] || globalBairroSummaryMap[bairro] || {
          totalVotos: 0,
          leader: 'Sem votos',
          leaderVotes: 0,
          leaderPerc: '0%',
          leaderParty: '-'
        };
        return {
          name: bairro,
          value: info.leaderVotes,
          leader: info.leader,
          leaderParty: info.leaderParty,
          leaderPerc: info.leaderPerc,
          totalBairro: info.totalVotos
        };
      });`;

code = code.replace(oldWinnerMapData, newWinnerMapData);

// Event listeners on map chart
const oldMapListeners = `    const handleClick = (params: any) => {
      if (params.name) {
        setHoveredOrSelectedBairro(params.name);
      }
    };
    chart.on('click', handleClick);

    const handleResize = () => chart?.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.off('click', handleClick);
    };
  }, [activeTab, mapMode, mapCandidate, bairroSummaryMap, allRecords]);`;

const newMapListeners = `      const handleClick = (params: any) => {
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
  }, [activeTab, mapMode, mapCandidate, bairroSummaryMap, globalBairroSummaryMap, filteredRecords]);`;

code = code.replace(oldMapListeners, newMapListeners);

fs.writeFileSync(appPath, code, 'utf8');
console.log('Successfully updated App.tsx map logic and aggregation!');
