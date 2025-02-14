const express = require('express');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const moment = require('moment');

const app = express();
const port = 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const jsonPath = path.join(__dirname, 'configuracion.json');

app.post('/descargar-config', async (req, res) => {
  const { clickieId } = req.body;
  if (!clickieId) {
    return res.status(400).send("Falta el 'clickieId'.");
  }
  const headers = {
    "accept": "application/json, text/javascript, */*; q=0.01",
    "accept-language": "en-US,en;q=0.9",
    "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
    "priority": "u=1, i",
    "sec-ch-ua": "\"Chromium\";v=\"128\", \"Not;A=Brand\";v=\"24\", \"Opera GX\";v=\"114\"",
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": "\"Windows\"",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "x-requested-with": "XMLHttpRequest",
    "Referer": "https://app.clickie.io/mottaconfig/config/",
    "Referrer-Policy": "strict-origin-when-cross-origin"
  };
  const url = "https://app.clickie.io/ajax/ajax_mottaconfig/get_payload/";
  const formData = new URLSearchParams();
  formData.append("identifier", clickieId);
  try {
    const response = await axios.post(url, formData, { headers });
    if (response.status === 200) {
      const jsonResp = response.data;
      if (jsonResp.ext && jsonResp.ext.config) {
        const configData = JSON.parse(jsonResp.ext.config);
        fs.writeFileSync(jsonPath, JSON.stringify(configData, null, 4), 'utf-8');
        console.log("Archivo configuracion.json guardado.");
        return res.send("Configuración descargada y guardada con éxito.");
      } else {
        return res.status(404).send("No se encontró 'ext.config' en la respuesta.");
      }
    } else {
      return res.status(500).send("Error en mottaconfig. Status:" + response.status);
    }
  } catch (err) {
    console.error("Error en /descargar-config:", err);
    return res.status(500).send("Hubo un error al descargar config.");
  }
});

app.get('/simular', async (req, res) => {
  try {
    if (!fs.existsSync(jsonPath)) {
      return res.send("No se encontró configuracion.json. Descarga config primero.");
    }
    const rawData = fs.readFileSync(jsonPath, 'utf-8');
    const data = JSON.parse(rawData);

    const clickiemota = data.name;
    const mottaId = data.id;
    const IdMotta = mottaId.slice(4); // Le quita el CMWS


    const diasEspeciales = data.lambda_functions.GG_relay_control.special_days || {};
    const horarioCanales = data.lambda_functions.GG_relay_control.channel_schedules || {};
    const dispositivos = data.lambda_functions.GG_relay_control.devices || {};

    const currentDate = moment();
    const startDate = currentDate.clone().subtract(7, 'days');
    const endDate = currentDate.clone().add(7, 'days');
    const dates = [];
    let d = startDate.clone();
    while (d.isBefore(endDate)) {
      dates.push(d.clone());
      d.add(15, 'minutes');
    }

    let moduleSections = [];
    for (const [moduleName, moduleData] of Object.entries(dispositivos)) {
      let channelConfigs = moduleData.config_x_relay || {};
      let channelKeys = Object.keys(channelConfigs);
      if (channelKeys.length === 0) continue;
      let chartDivsScripts = [];
      channelKeys.forEach((key, i) => {
        const configObj = channelConfigs[key];
        let xValues = dates.map(dt => dt.format('YYYY-MM-DD HH:mm:ss'));
        let yValues = dates.map(dt => getDeviceStatus(dt, moduleData, diasEspeciales, horarioCanales, configObj));
        const trace = {
          x: xValues,
          y: yValues,
          mode: 'lines+markers',
          name: key,
          line: { width: 2 },
          marker: { size: 4 }
        };
        const layout = {
          title: `Estado del Módulo: ${moduleName} - ${key}`,
          xaxis: { title: 'Fecha y Hora', rangeslider: { visible: true }, type: 'date' },
          yaxis: { title: 'Estado (0=Off, 1=On)' },
          annotations: []
        };
        const chartId = `chart-${moduleName}-${key}`;
        let chartHTML = `<div id="${chartId}" class="chart-container" style="display: ${i===0 ? 'block' : 'none'};"></div>
        <script>
          Plotly.newPlot("${chartId}", [${JSON.stringify(trace)}], ${JSON.stringify(layout)}).then(function(chart){
            chart.on('plotly_click', function(data) {
              var currentAnnotations = chart.layout.annotations || [];
              if (currentAnnotations.length === 0) {
                currentAnnotations.push({
                  x: data.points[0].x,
                  y: data.points[0].y,
                  xref: 'x',
                  yref: 'y',
                  text: "inicio<br>" + data.points[0].x,
                  showarrow: true,
                  arrowhead: 7,
                  ax: 0,
                  ay: -40
                });
              } else if (currentAnnotations.length === 1) {
                currentAnnotations.push({
                  x: data.points[0].x,
                  y: data.points[0].y,
                  xref: 'x',
                  yref: 'y',
                  text: "final<br>" + data.points[0].x,
                  showarrow: true,
                  arrowhead: 7,
                  ax: 0,
                  ay: -40
                });
              } else {
                currentAnnotations[0] = {
                  x: data.points[0].x,
                  y: data.points[0].y,
                  xref: 'x',
                  yref: 'y',
                  text: "inicio<br>" + data.points[0].x,
                  showarrow: true,
                  arrowhead: 7,
                  ax: 0,
                  ay: -40
                };
                currentAnnotations = currentAnnotations.pop()
              }
              Plotly.relayout(chart, { annotations: currentAnnotations });
            });
          });
        <\/script>`;
        chartDivsScripts.push(chartHTML);
      });
      let tabsHTML = `<div class="tabs" id="tabs-${moduleName}">`;
      channelKeys.forEach((key, idx) => {
        tabsHTML += `<button class="tab-button ${idx===0 ? 'active' : ''}" onclick="switchTab('${moduleName}', '${key}')">${key}</button>`;
      });
      tabsHTML += `</div>`;
      const moduleSection = `<section class="module-section">
        <h2>Módulo: ${moduleName}</h2>
        ${tabsHTML}
        ${chartDivsScripts.join('')}
      </section>`;
      moduleSections.push(moduleSection);
    }

    const extraScript = `
      <script>
        function switchTab(moduleName, key) {
          var tabs = document.querySelectorAll("#tabs-" + moduleName + " .tab-button");
          tabs.forEach(function(btn) {
            btn.classList.remove("active");
            if(btn.innerText === key) { btn.classList.add("active"); }
          });
          var charts = document.querySelectorAll("[id^='chart-" + moduleName + "-']");
          charts.forEach(function(chart) { chart.style.display = "none"; });
          var selectedChart = document.getElementById("chart-" + moduleName + "-" + key);
          if(selectedChart) { selectedChart.style.display = "block"; Plotly.Plots.resize(selectedChart); }
        }
      <\/script>
    `;


    const navButtons = `
      <div class="fancy-button-container" id="simNavButtons">
        <button class="my-button" id="homeBtn">IR A HOME</button>
        <button class="my-button" id="mottaConfigBtn">MOTTACONFIG</button>
        <button class="my-button" id="verJsonBtn">VER JSON</button>
      </div>
      <script>
        document.getElementById('homeBtn').addEventListener('click', function(e) {
          if (e.ctrlKey) {
            window.open('/', '_blank');
          } else {
            window.location.href = '/';
          }
        });
        document.getElementById('mottaConfigBtn').addEventListener('click', function(e) {
          // Se asume que el clickiemota se obtiene del JSON descargado.
          // Si no se tiene ese dato, se usa la variable clickiemota del servidor.
          var url = 'https://app.clickie.io/mottaconfig/config/';
          url += "${IdMotta}"; // Ahora se envuelve en comillas
          if (e.ctrlKey) {
            window.open(url, '_blank');
          } else {
            window.location.href = url;
          }
        });
        document.getElementById('verJsonBtn').addEventListener('click', function(e) {
          if (e.ctrlKey) {
            window.open('/config-json', '_blank');
          } else {
            window.location.href = '/config-json';
          }
        });
      <\/script>
    `;


    const html = `
      <html>
        <head>
          <title>Simulación de Relés - ${clickiemota}</title>
          <script src="https://cdn.plot.ly/plotly-latest.min.js"></script>
          <script src="https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.29.1/moment.min.js"></script>
          <style>
            body { font-family: sans-serif; margin: 20px; }
            .my-button { display: inline-block; background: #444; color: #fff; text-transform: uppercase;
                         border: none; letter-spacing: 0.1rem; font-size: 1rem; padding: 1rem 3rem;
                         transition: 0.2s; cursor: pointer; margin: 5px; }
            .my-button:hover { letter-spacing: 0.2rem; padding: 1.1rem 3.1rem; background: #222327; }
            .tabs { margin-bottom: 10px; }
            .tab-button { padding: 10px; margin-right: 5px; cursor: pointer; border: none; background: #ddd; border-radius: 3px; transition: background 0.3s; }
            .tab-button:hover { background: #ccc; }
            .tab-button.active { background: #222327; color: #fff; }
            .module-section { margin-bottom: 40px; }
            .chart-container { width: 100%; height: 600px; }
          </style>
        </head>
        <body>
          ${navButtons}
          <h1>Resultados de la Simulación de ${clickiemota}</h1>
          ${moduleSections.join('')}
          ${extraScript}
        </body>
      </html>
    `;
    res.send(html);
  } catch (error) {
    console.error("Error en /simular:", error);
    res.status(500).send("Error al procesar /simular.");
  }
});

app.get('/config-json', (req, res) => {
  try {
    if (!fs.existsSync(jsonPath)) {
      return res.send("No se encontró configuracion.json. Descarga config primero.");
    }
    const rawData = fs.readFileSync(jsonPath, 'utf-8');
    const data = JSON.parse(rawData);
    const pretty = JSON.stringify(data, null, 2);
    const html = `
      <html>
        <head>
          <title>Config JSON</title>
          <style>
            body { font-family: monospace; margin: 20px; background: #f5f5f5; }
            pre { border: 1px solid #ddd; background: #fff; padding: 10px; }
            .my-button { display: inline-block; background: #444; color: #fff; text-transform: uppercase;
                         border: none; letter-spacing: 0.1rem; font-size: 1rem; padding: 1rem 3rem;
                         transition: 0.2s; cursor: pointer; margin: 20px 0; }
            .my-button:hover { letter-spacing: 0.2rem; padding: 1.1rem 3.1rem; background: #222327; }
          </style>
        </head>
        <body>
          <button class="my-button" onclick="window.location.href='/'">Volver al Home</button>
          <h2>Archivo configuracion.json</h2>
          <pre>${pretty}</pre>
        </body>
      </html>
    `;
    res.send(html);
  } catch (error) {
    console.error("Error en /config-json:", error);
    res.status(500).send("Error al procesar /config-json.");
  }
});

function getDeviceStatus(date, deviceData, diasEspeciales, horarioCanales, channelConfig) {
  let finalConfig = channelConfig;
  if (!finalConfig) {
    const normalRelay = deviceData.config_x_relay || {};
    const relayKeys = Object.keys(normalRelay);
    if (relayKeys.length > 0) {
      finalConfig = normalRelay[relayKeys[0]];
    }
  }
  if (!finalConfig) return 0;
  const modo = finalConfig.config;
  if (modo === 'manual_encendido') return 1;
  if (modo === 'manual_apagado') return 0;
  const scheduleName = finalConfig.schedule;
  if (!scheduleName || !horarioCanales[scheduleName]) return 0;
  const scheduleObj = horarioCanales[scheduleName];
  const dayOfWeek = date.isoWeekday();
  let onPeriods = [];
  if (scheduleObj.on && Array.isArray(scheduleObj.on[0])) {
    onPeriods = scheduleObj.on;
  } else {
    for (const key in scheduleObj) {
      const sub = scheduleObj[key];
      if (sub.days && sub.days.includes(dayOfWeek) && sub.on) {
        onPeriods = sub.on;
        break;
      }
    }
  }
  const currentTime = date.format('HH:mm:ss');
  for (const [start, end] of onPeriods) {
    if (currentTime >= start && currentTime <= end) {
      return 1;
    }
  }
  return 0;
}

app.listen(port, () => {
  console.log(`Servidor iniciado en http://localhost:${port}`);
});
