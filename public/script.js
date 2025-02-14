document.addEventListener('DOMContentLoaded', () => {

  const appConfig = {
    ripley: { companyId: 131, clickiemotaModel: 318, releModel: 317 },
    santander: { companyId: 516, clickiemotaModel: 318, releModel: 317 },
    easy: { companyId: 523, clickiemotaModel: 318, releModel: 317 }
  };

  const urlParams = new URLSearchParams(window.location.search);
  let appMode = urlParams.get("mode");
  if (!appMode) {
    document.getElementById("modeSelector").style.display = "flex";
    document.getElementById("appContainer").style.display = "none";
  } else {
    appMode = appMode.toLowerCase();
    if (!["ripley", "santander", "easy"].includes(appMode)) {
      appMode = "ripley";
    }
    document.getElementById("modeSelector").style.display = "none";
    document.getElementById("appContainer").style.display = "block";
  }
  document.querySelectorAll("#modeSelector button").forEach(btn => {
    btn.addEventListener("click", () => {
      const mode = btn.getAttribute("data-mode");
      window.location.href = window.location.pathname + "?mode=" + mode;
    });
  });
  if (!appMode) return;
  const config = appConfig[appMode];

  async function obtenerToken() {
    const response = await fetch("https://api.clickie.io/v1/public/auth", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        username: "nicolas.aravena@clickie.io",
        password: "LizNeyObi@3693@"
      })
    });
    const data = await response.json();
    if (!data.data?.Token) throw new Error("No se recibió token.");
    return data.data.Token;
  }

  // Referencias de la interfaz
  const listItems = document.querySelectorAll('.navigation ul li');
  const indicator = document.querySelector('.indicator');

  const modalBuilding = document.getElementById('modal-building');
  const modalDevices  = document.getElementById('modal-devices');
  const modalReles    = document.getElementById('modal-reles');
  const modalRelesTimelines = document.getElementById('modal-timelines');
  const modalSimulator = document.getElementById('modal-simulator');
  const modalJSON = document.getElementById('modal-json');

  const buildingSearch = document.getElementById('building-search');
  const buildingDropdown = document.getElementById('building-dropdown');
  const selectedBuilding = document.getElementById('selected-building');
  const buildingLink = document.getElementById('building-link');
  const sendBuildingBtn = document.getElementById('btn-enviar-building');

  const clickiemotasTbody = document.getElementById('clickiemotas-tbody');
  const confirmClickiemotaBtn = document.getElementById('confirm-clickiemota');

  const relesTbody = document.getElementById('reles-tbody');
  const confirmReleBtn = document.getElementById('confirm-rele');

  const timelinesTbody = document.getElementById('timelines-tbody');
  const confirmTimelines = document.getElementById('confirm-timelines');

  const selectedBuilding2 = document.getElementById('selected-building2');
  const selectedCM4 = document.getElementById('selected-cm4');

  let allBuildings = [];
  let displayedBuildings = [];
  let allDevices = [];

  let selectedBuildingId = null;
  let selectedClickiemotaId = null;
  let selectedClickiemotaName = null;

  let selectedReleID = null;

  document.getElementById('changeCompany').addEventListener('click', (e) => {
    if (e.ctrlKey) {
      window.open('/', '_blank');
    } else {
      window.location.href = '/';
    }
  });

  function setMenuActive(index) {
    listItems.forEach((item, idx) => item.classList.toggle('active', idx === index));
    moveIndicator(index);
  }
  function moveIndicator(index) {
    const liArray = Array.from(listItems);
    if (liArray[index]) {
      const offsetLeft = liArray[index].offsetLeft;
      indicator.style.transform = `translateX(${offsetLeft}px) translateY(-50%)`;
    }
  }
  moveIndicator(0);
  listItems.forEach((item, index) => {
    item.addEventListener('click', async () => {
      if (index === 0) { // Building
        modalBuilding.classList.add('active');
        setMenuActive(0);
        return;
      }
      if (index === 1) { // Devices
        if (!selectedBuildingId) {
          alert("Selecciona un building primero.");
          setMenuActive(0);
          return;
        }
        openDevicesModal();
        setMenuActive(1);
        return;
      }
      if (index === 2) { // History (Relés)
        if (!selectedBuildingId) {
          alert("Selecciona un building primero.");
          setMenuActive(0);
          return;
        }
        openRelesModal();
        setMenuActive(2);
        return;
      }
      if (index === 3) { // Simulation
        if (!selectedBuildingId) {
          alert("Selecciona un building primero.");
          setMenuActive(0);
          return;
        }
        if (!selectedClickiemotaId) {
          alert("Selecciona una Clickiemota primero.");
          setMenuActive(1);
          return;
        }
        modalSimulator.classList.add('active');
        setMenuActive(3);
        const sid = parseInt(buildingDropdown.value, 10);
        selectedBuildingId = sid;
        const bldg = displayedBuildings.find(x => x.id_building === sid);
        if (bldg) {
          selectedBuilding2.textContent = `Actual Building: ${bldg.building_name}`;
          selectedCM4.textContent = `CM4 actual: ${selectedClickiemotaName}`;
        }
        return;
      }
      if (index === 4) { // JSON
        if (!selectedBuildingId) {
          alert("Selecciona un building antes de ver JSON.");
          setMenuActive(0);
          return;
        }
        window.location.href = '/config-json';
        return;
      }
    });
  });

  document.querySelectorAll('.modal-close').forEach(button => {
    button.addEventListener('click', () => {
      const modalId = button.getAttribute('data-modal');
      const modal = document.getElementById(modalId);
      if (modal) modal.classList.remove('active');
    });
  });
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('active');
    });
  });

  (async function loadBuildings() {
    try {
      const token = await obtenerToken();
      const response = await fetch("https://api.clickie.io/v1/companies/" + config.companyId + "/buildings", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        }
      });
      const bResp = await response.json();
      allBuildings = bResp.data;
      fillBuildingsDropdown(allBuildings);
    } catch (err) {
      console.error("Error (Buildings):", err);
    }
  })();

  function fillBuildingsDropdown(buildings) {
    displayedBuildings = buildings;
    buildingDropdown.innerHTML = '';
    buildings.forEach(b => {
      const opt = document.createElement('option');
      opt.value = b.id_building;
      opt.textContent = b.building_name;
      buildingDropdown.appendChild(opt);
    });
  }

  buildingSearch.addEventListener('input', () => {
    const txt = buildingSearch.value.toLowerCase();
    const filtered = allBuildings.filter(b =>
      b.building_name.toLowerCase().includes(txt)
    );
    fillBuildingsDropdown(filtered);
  });

  buildingDropdown.addEventListener('change', () => {
    const sid = parseInt(buildingDropdown.value, 10);
    selectedBuildingId = sid;
    const bldg = displayedBuildings.find(x => x.id_building === sid);
    if (bldg) {
      selectedBuilding.textContent = `Actual Building: ${bldg.building_name}`;
      buildingLink.href = `https://app.clickie.io/clickie/buildings/view/${sid}`;
    }
  });

  sendBuildingBtn.addEventListener('click', () => {
    modalBuilding.classList.remove('active');
    setMenuActive(1);
    openDevicesModal();
  });

  (async function loadDevices() {
    try {
      const token = await obtenerToken();
      const response = await fetch("https://api.clickie.io/v1/companies/" + config.companyId + "/devices", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        }
      });
      const dResp = await response.json();
      allDevices = dResp.data;
      console.log("allDevices loaded:", allDevices.length);
    } catch (err) {
      console.error("Error (Devices):", err);
    }
  })();

  function openDevicesModal() {
    if (!selectedBuildingId) {
      alert("Por favor, selecciona un building primero.");
      return;
    }
    const filtered = allDevices.filter(d =>
      d.id_building === selectedBuildingId && d.id_device_model === config.clickiemotaModel
    );
    fillClickiemotasTable(filtered);
    modalDevices.classList.add('active');
  }

  function fillClickiemotasTable(data) {
    clickiemotasTbody.innerHTML = '';
    confirmClickiemotaBtn.disabled = true;
    data.forEach(ckm => {
      const tr = document.createElement('tr');
      const tdName = document.createElement('td');
      tdName.textContent = ckm.setup_name || ckm.device_identifier;
      tr.appendChild(tdName);
      const tdId = document.createElement('td');
      tdId.textContent = ckm.device_identifier;
      tr.appendChild(tdId);
      const tdRadio = document.createElement('td');
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'selectedClickiemota';
      radio.value = ckm.device_identifier;
      radio.id = ckm.setup_name;
      radio.addEventListener('change', () => {
        confirmClickiemotaBtn.disabled = false;
      });
      tdRadio.appendChild(radio);
      tr.appendChild(tdRadio);
      clickiemotasTbody.appendChild(tr);
    });
  }

  confirmClickiemotaBtn.addEventListener('click', () => {
    const radios = document.getElementsByName('selectedClickiemota');
    let chosenId = null;
    let setupName = null;
    for (let r of radios) {
      if (r.checked) {
        chosenId = r.value;
        setupName = r.id;
        break;
      }
    }
    if (!chosenId) {
      alert("Por favor selecciona una Clickiemota");
      return;
    }
    let splitted = chosenId;
    if (chosenId.includes("CMWS")) {
      splitted = chosenId.split("CMWS")[1] || chosenId;
    }
    selectedClickiemotaId = splitted;
    selectedClickiemotaName = setupName;
    console.log("Clickiemota sel:", selectedClickiemotaId);
    modalDevices.classList.remove('active');
    setMenuActive(2);
    openRelesModal();
  });

  function openRelesModal() {
    if (!selectedBuildingId) {
      alert("No se encontró building");
      return;
    }
    const filtered = allDevices.filter(d =>
      d.id_building === selectedBuildingId && d.id_device_model === config.releModel
    );
    fillRelesTable(filtered);
    modalReles.classList.add('active');
  }

  function fillRelesTable(data) {
    relesTbody.innerHTML = '';
    confirmReleBtn.disabled = true;
    data.forEach(dev => {
      const tr = document.createElement('tr');
      const tdSetup = document.createElement('td');
      tdSetup.textContent = dev.setup_name || "Sin Nombre";
      tr.appendChild(tdSetup);
      const tdId = document.createElement('td');
      tdId.textContent = dev.device_identifier;
      tr.appendChild(tdId);
      const tdRadio = document.createElement('td');
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'selectedRele';
      radio.value = dev.setup_name;
      radio.addEventListener('change', () => {
        confirmReleBtn.disabled = false;
        selectedReleSetupName = dev.setup_name;
        selectedReleIdentifier = dev.device_identifier;
        selectedReleID = dev.id_device;
      });
      tdRadio.appendChild(radio);
      tr.appendChild(tdRadio);
      relesTbody.appendChild(tr);
    });
  }

  confirmReleBtn.addEventListener('click', async () => {
    const radios = document.getElementsByName('selectedRele');
    let chosenReleSetup = null;
    for (let r of radios) {
      if (r.checked) {
        chosenReleSetup = r.value;
        break;
      }
    }
    if (!chosenReleSetup) {
      alert("Por favor selecciona un Relé.");
      return;
    }
    if (chosenReleSetup.endsWith('1')) {
      chosenReleSetup = "inicio";
    } else if (chosenReleSetup.endsWith('2')) {
      chosenReleSetup = "final";
    } else {
      chosenReleSetup = "inicio";
    }
    console.log("Relé final:", chosenReleSetup, "| ID:", selectedReleID);
    modalReles.classList.remove('active');
    try {
      const authResp = await fetch("https://api.clickie.io/v1/public/auth", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          username: "nicolas.aravena@clickie.io",
          password: "LizNeyObi@3693@"
        })
      });
      const authJson = await authResp.json();
      const token = authJson.data?.Token;
      if (!token) throw new Error("No token en timelines fetch");
      const url = `https://api.clickie.io/v1/buildings/${selectedBuildingId}/timelines`;
      const resp = await fetch(url, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });
      const j = await resp.json();
      const allTimelines = j.data || [];
      const filtered = allTimelines.filter(tl => {
        const hasT4 = tl.timeline_name && tl.timeline_name.includes("status") &&
                      !tl.timeline_name.includes("desired") &&
                      !tl.timeline_name.includes("function");
        const sameId = (tl.id_device === selectedReleID);
        return hasT4 && sameId;
      });
      console.log("Timelines filtrados:", filtered);
      fillRelesTimelinesTable(filtered);
      modalRelesTimelines.classList.add('active');
    } catch (err) {
      console.error("Error timelines building:", err);
      alert("No se pudieron obtener timelines");
    }
  });

  function fillRelesTimelinesTable(timelines) {
    timelinesTbody.innerHTML = '';
    timelines.forEach(tl => {
      const tr = document.createElement('tr');
      const tdName = document.createElement('td');
      tdName.textContent = tl.timeline_name;
      tr.appendChild(tdName);
      const tdId = document.createElement('td');
      tdId.textContent = tl.id_timeline;
      tr.appendChild(tdId);
      const tdAction = document.createElement('td');
      const icon = document.createElement('ion-icon');
      icon.name = "open-outline";
      icon.style.fontSize = "1.5rem";
      icon.style.cursor = "pointer";
      icon.addEventListener('click', () => {
        const base = "https://app.clickie.io/clickie/timelines/view/";
        window.open(base + tdId.textContent, '_blank');
      });
      tdAction.appendChild(icon);
      tr.appendChild(tdAction);
      timelinesTbody.appendChild(tr);
    });
    confirmTimelines.addEventListener('click', () => {
      if (!selectedClickiemotaId) {
        alert("Por favor, selecciona primero una Clickiemota.");
        return;
      }
      setMenuActive(3);
      modalRelesTimelines.classList.remove('active');
      modalSimulator.classList.add('active');
      const sid = parseInt(buildingDropdown.value, 10);
      selectedBuildingId = sid;
      const bldg = displayedBuildings.find(x => x.id_building === sid);
      if (bldg) {
        selectedBuilding2.textContent = `Actual Building: ${bldg.building_name}`;
        selectedCM4.textContent = `CM4 actual: ${selectedClickiemotaName}`;
      }
    });
  }

  document.getElementById('homeBtn').addEventListener('click', function(e) {
    if (e.ctrlKey) {
      window.open('/', '_blank');
    } else {
      window.location.href = '/';
    }
  });
  document.getElementById('mottaConfigBtn').addEventListener('click', function(e) {
    const rawId = document.getElementById('json-output') ? document.getElementById('json-output').innerText : "";
    var url = 'https://app.clickie.io/mottaconfig/config/';
    url += selectedClickiemotaId; 
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
  document.getElementById('simularBtn').addEventListener('click', function(e) {
    if (e.ctrlKey) {
      fetch('/descargar-config', {
        method: 'POST',
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ clickieId: selectedClickiemotaId })
      })
      .then(resp => {
        if (!resp.ok) throw new Error("Error en /descargar-config");
        return resp.text();
      })
      .then(text => {
        window.open('/simular', '_blank');
      })
      .catch(err => {
        console.error(err);
        alert("Error al descargar la config.");
      });
    } else {
      fetch('/descargar-config', {
        method: 'POST',
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ clickieId: selectedClickiemotaId })
      })
      .then(resp => {
        if (!resp.ok) throw new Error("Error en /descargar-config");
        return resp.text();
      })
      .then(text => {
        window.location.href = '/simular';
      })
      .catch(err => {
        console.error(err);
        alert("Error al descargar la config.");
      });
    }
  });
});
