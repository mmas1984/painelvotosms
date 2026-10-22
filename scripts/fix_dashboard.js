import fs from 'fs';

function fixDashboardHtml(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // 1. Fix div id from mapChart to chartMap
  content = content.replace('<div id="mapChart"', '<div id="chartMap"');
  
  // 2. Fix document.getElementById('chartMap') fallback
  content = content.replace(
    "chartMap = echarts.init(document.getElementById('chartMap'));",
    "const mapDom = document.getElementById('chartMap') || document.getElementById('mapChart');\n      if (mapDom) { chartMap = echarts.init(mapDom); }"
  );
  
  // 3. Fix boot
  const oldBootPattern = /window\.addEventListener\('DOMContentLoaded',\s*\(\)\s*=>\s*\{[\s\S]*?\}\);/;
  const newBootCode = `function boot() {
      try {
        initDropdowns();
        initCharts();
        updateKPIs();
        updateCharts();
        updateMapChart();
        renderTable();
      } catch (err) {
        console.error('Boot error in dashboard:', err);
      }
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', boot);
    } else {
      boot();
    }`;
  content = content.replace(oldBootPattern, newBootCode);
  
  // 4. Update embedded FORTALEZA_GEO with updated GeoJSON
  const updatedGeo = fs.readFileSync('./src/fortaleza_map.json', 'utf8');
  const geoStart = content.indexOf('const FORTALEZA_GEO = {');
  if (geoStart !== -1) {
    const geoEnd = content.indexOf("echarts.registerMap('fortaleza', FORTALEZA_GEO);", geoStart);
    if (geoEnd !== -1) {
      content = content.slice(0, geoStart) + 'const FORTALEZA_GEO = ' + updatedGeo + ';\n    ' + content.slice(geoEnd);
    }
  }

  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Fixed', filePath);
}

fixDashboardHtml('./dashboard.html');
fixDashboardHtml('./public/dashboard.html');
