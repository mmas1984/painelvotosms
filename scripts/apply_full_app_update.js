import fs from 'fs';

const appPath = './src/App.tsx';
let code = fs.readFileSync(appPath, 'utf8');

// 1. Fix the map useEffect cleanly
const mapEffectOldRegex = /\/\/ MAP CHART RENDER[\s\S]*?\/\/ Candidate Drilldown chart/;

const newMapEffect = `// MAP CHART RENDER
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
      let visualColors = ['#f0fdf4', '#86efac', '#22c55e', '#15803d', '#14532d'];

      const geoFeatures: string[] = (fortalezaGeoJson as any).features.map((f: any) => f.properties.name);
      const allBairrosSet = Array.from(new Set([...geoFeatures, ...Object.keys(bairroSummaryMap), ...uniqueBairros]));

      if (mapMode === 'volume') {
        visualColors = ['#eff6ff', '#93c5fd', '#3b82f6', '#1d4ed8', '#172554'];
        maxVal = 21000;
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
        });
      } else if (mapMode === 'candidato') {
        visualColors = ['#fef2f2', '#fca5a5', '#ef4444', '#b91c1c', '#7f1d1d'];
        const candRows = filteredRecords.filter(r => r.candidato === mapCandidate);
        const candMap: Record<string, number> = {};
        candRows.forEach(r => { candMap[r.bairro] = (candMap[r.bairro] || 0) + r.votos; });
        const candVotesArr = Object.values(candMap);
        maxVal = candVotesArr.length > 0 ? Math.max(...candVotesArr, 500) : 500;
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
        });
      } else if (mapMode === 'vencedor') {
        visualColors = ['#f5f3ff', '#c4b5fd', '#8b5cf6', '#6d28d9', '#4c1d95'];
        maxVal = 4500;
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
        });
      }

      chart.setOption({
        backgroundColor: '#f8fafc',
        tooltip: {
          trigger: 'item',
          backgroundColor: 'rgba(255, 255, 255, 0.96)',
          borderColor: '#e2e8f0',
          borderWidth: 1,
          padding: 10,
          textStyle: { color: '#0f172a' },
          formatter: (params: any) => {
            if (!params.data) return \`<strong>\${params.name}</strong><br/>Sem dados registrados\`;
            if (mapMode === 'volume') {
              return \`
                <div style="font-family: inherit;">
                  <div style="font-weight: 700; font-size: 13px; color: #0f172a; margin-bottom: 4px;">\${params.name}</div>
                  <div style="font-size: 11px; color: #475569;">Total no Bairro: <strong style="color: #2563eb; font-family: monospace;">\${(params.data.value || 0).toLocaleString('pt-BR')} votos</strong></div>
                  <div style="font-size: 11px; color: #475569; margin-top: 2px;">Vencedor: <strong>\${params.data.leader || '-'}</strong> (\${(params.data.leaderVotes || 0).toLocaleString('pt-BR')} · \${params.data.leaderPerc || '0%'})</div>
                </div>
              \`;
            } else if (mapMode === 'candidato') {
              return \`
                <div style="font-family: inherit;">
                  <div style="font-weight: 700; font-size: 13px; color: #0f172a; margin-bottom: 4px;">\${params.name}</div>
                  <div style="font-size: 11px; color: #475569;">Votos de <strong>\${params.data.candidateName}</strong>: <strong style="color: #dc2626; font-family: monospace;">\${(params.data.value || 0).toLocaleString('pt-BR')}</strong></div>
                  <div style="font-size: 11px; color: #475569; margin-top: 2px;">Representatividade no Bairro: <strong>\${params.data.candPerc || '0%'}</strong></div>
                </div>
              \`;
            } else {
              return \`
                <div style="font-family: inherit;">
                  <div style="font-weight: 700; font-size: 13px; color: #0f172a; margin-bottom: 4px;">\${params.name}</div>
                  <div style="font-size: 11px; color: #475569;">Líder no Bairro: <strong style="color: #6d28d9;">\${params.data.leader || '-'} (\${params.data.leaderParty || '-'})</strong></div>
                  <div style="font-size: 11px; color: #475569; margin-top: 2px;">Votação: <strong>\${(params.data.value || 0).toLocaleString('pt-BR')} votos</strong> (\${params.data.leaderPerc || '0%'} do bairro)</div>
                </div>
              \`;
            }
          }
        },
        visualMap: {
          min: minVal,
          max: maxVal,
          text: ['Alto', 'Baixo'],
          realtime: false,
          calculable: true,
          left: 20,
          bottom: 25,
          inRange: { color: visualColors },
          textStyle: { fontSize: 10, color: '#475569' }
        },
        series: [
          {
            name: 'Bairros de Fortaleza',
            type: 'map',
            map: 'fortaleza',
            roam: true,
            scaleLimit: { min: 0.8, max: 6 },
            label: {
              show: false,
              fontSize: 9,
              color: '#334155'
            },
            itemStyle: {
              borderColor: '#cbd5e1',
              borderWidth: 1,
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
  }, [activeTab, mapMode, mapCandidate, bairroSummaryMap, globalBairroSummaryMap, filteredRecords]);

  // Candidate Drilldown chart`;

code = code.replace(mapEffectOldRegex, newMapEffect);

// 2. Global Filters Bar + KPI Cards JSX
const filtersAndKpiJsx = `        {/* FILTERS AND CONTROLS STRIP */}
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
              {(statusFilter !== 'ALL' || partyFilter !== 'ALL' || candidateFilter !== 'ALL' || bairroFilter !== 'ALL' || searchQuery.trim() !== '') && (
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

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 text-xs">
            {/* Status */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 focus:bg-white"
              >
                <option value="ALL">Todos os Status</option>
                <option value="ELEITO">ELEITO (43)</option>
                <option value="SUPLENTE">SUPLENTE (11)</option>
              </select>
            </div>

            {/* Partido */}
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

            {/* Candidato */}
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

            {/* Bairro */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Bairro</label>
              <select
                value={bairroFilter}
                onChange={e => { setBairroFilter(e.target.value); setCurrentPage(1); }}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 focus:bg-white"
              >
                <option value="ALL">Todos os Bairros ({uniqueBairros.length})</option>
                {uniqueBairros.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            {/* Busca Livre */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Busca Rápida</label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Candidato, bairro, nº..."
                  value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>
            </div>
          </div>
        </section>

        {/* EXECUTIVE KPI CARDS STRIP (REACTIVE TO ALL FILTERS & TABS) */}
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
            <span className="text-[10px] text-slate-400 mt-0.5 block">Votos médios/bairro</span>
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
            <span className="text-[10px] text-slate-400 mt-0.5 block">Alta assimetria</span>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Pico em 1 Bairro</span>
            <span className="text-xl sm:text-2xl font-bold font-mono text-blue-700 block mt-1 tabular-nums">
              {kpis.maxVotos.toLocaleString('pt-BR')}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block truncate" title={kpis.maxDetail}>
              {kpis.maxDetail}
            </span>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Bairros Ativos</span>
            <span className="text-xl sm:text-2xl font-bold font-mono text-slate-900 block mt-1 tabular-nums">
              {kpis.bairrosAtivos}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">de 111 mapeados</span>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">% Votos Eleitos</span>
            <span className="text-xl sm:text-2xl font-bold font-mono text-emerald-700 block mt-1 tabular-nums">
              {kpis.eleitosPerc.toFixed(1).replace('.', ',')}%
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">{kpis.eleitosVotos.toLocaleString('pt-BR')} votos</span>
          </div>
        </div>`;

// Insert filters and KPI strip right after the Hero banner section
const heroEndString = '        </section>\n\n        {/* TAB: MAPA DE FORTALEZA */}';
const heroEndStringAlt = '        </section>\n        {/* TAB: MAPA DE FORTALEZA */}';

if (code.includes(heroEndString)) {
  code = code.replace(heroEndString, '        </section>\n\n' + filtersAndKpiJsx + '\n\n        {/* TAB: MAPA DE FORTALEZA */}');
  console.log('Inserted global filters and KPI strip after Hero Banner');
} else if (code.includes(heroEndStringAlt)) {
  code = code.replace(heroEndStringAlt, '        </section>\n\n' + filtersAndKpiJsx + '\n\n        {/* TAB: MAPA DE FORTALEZA */}');
  console.log('Inserted global filters and KPI strip after Hero Banner (alt)');
}

// 3. Enhance Bairro Inspector Sidebar on Mapa tab with direct dropdown and quick CTA
const oldInspectorHeader = `<div className="pb-3 border-b border-slate-100">
                        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Raio-X Territorial</div>
                        <h3 className="text-xl font-bold text-slate-900 mt-0.5">{hoveredOrSelectedBairro}</h3>
                        <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 font-mono">
                          <span>{bInfo.totalVotos.toLocaleString('pt-BR')} votos totais</span>
                          <span>·</span>
                          <span>{((bInfo.totalVotos / 586560) * 100).toFixed(2)}% da capital</span>
                        </div>
                      </div>`;

const newInspectorHeader = `<div className="pb-3 border-b border-slate-100 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Raio-X Territorial</span>
                          <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono font-semibold">
                            {((bInfo.totalVotos / (kpis.totalVotos || 586560)) * 100).toFixed(2)}% do total
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
                      </div>`;

code = code.replace(oldInspectorHeader, newInspectorHeader);

// Add action button to inspector sidebar bottom
const oldInspectorBottom = `<div className="pt-3 border-t border-slate-100 text-center">
                        <span className="text-[10px] text-slate-400">Clique em qualquer polígono do mapa para fixar</span>
                      </div>`;

const newInspectorBottom = `<div className="pt-3 border-t border-slate-100 space-y-2">
                        <button
                          onClick={() => {
                            setSelectedBairro(hoveredOrSelectedBairro);
                            setActiveTab('bairro');
                          }}
                          className="w-full py-2 px-3 text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200 flex items-center justify-center gap-1.5"
                        >
                          Comparar Candidatos Neste Bairro &rarr;
                        </button>
                        <span className="text-[10px] text-slate-400 block text-center">Passe o mouse ou clique no mapa para alterar</span>
                      </div>`;

code = code.replace(oldInspectorBottom, newInspectorBottom);

// 4. In Overview tab, remove duplicate KPI Cards Strip so it doesn't repeat
const overviewKpiSnippet = `            {/* KPI Cards Strip */}
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
                <span className="text-[10px] text-slate-400 mt-0.5 block">Votos médios/bairro</span>
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
                <span className="text-[10px] text-slate-400 mt-0.5 block">Alta assimetria</span>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Pico em 1 Bairro</span>
                <span className="text-xl sm:text-2xl font-bold font-mono text-blue-700 block mt-1 tabular-nums">
                  {kpis.maxVotos.toLocaleString('pt-BR')}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5 block truncate" title={kpis.maxDetail}>
                  {kpis.maxDetail}
                </span>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Bairros Ativos</span>
                <span className="text-xl sm:text-2xl font-bold font-mono text-slate-900 block mt-1 tabular-nums">
                  {kpis.bairrosAtivos}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5 block">de 111 mapeados</span>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">% Votos Eleitos</span>
                <span className="text-xl sm:text-2xl font-bold font-mono text-emerald-700 block mt-1 tabular-nums">
                  {kpis.eleitosPerc.toFixed(1).replace('.', ',')}%
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5 block">{kpis.eleitosVotos.toLocaleString('pt-BR')} votos</span>
              </div>
            </div>`;

if (code.includes(overviewKpiSnippet)) {
  code = code.replace(overviewKpiSnippet, '');
  console.log('Removed duplicate KPI snippet from overview tab');
}

fs.writeFileSync(appPath, code, 'utf8');
console.log('Successfully completed full update of App.tsx');
