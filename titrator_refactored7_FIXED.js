/* ================================================================
   Titrator-Simulation  (refactored6 - FIXES)
   ----------------------------------------------------------------
   UI-Ordnung: Der gesamte Button-Zustand wird zentral ueber einen
   Zustandsautomaten gesteuert (TS, UI_RULES, TRANSITIONS,
   setUIState/renderUI). Die Event-Handler enthalten KEINE
   classList-Aufrufe fuer Buttons mehr.
   Von HTML aufgerufene Funktionsnamen bleiben erhalten:
   togglePower(), toggleDrip(), resetTitrator2()

   FIXES gegen "Kurve rennt durch / Panel funktionslos":
   1. fillInterval/emptyInterval werden zentral verwaltet und
      kreuzen sich nicht mehr (kein Leck beim Power-Off).
   2. buFilled wird sofort konsistent gesetzt, nicht erst nach
      Ablauf der Leer-Animation.
   3. startAnimation() startet vom echten buretteLevel und
      haelt Variable + Clip synchron.
   4. updateBurette() klammt buretteLevel bei 0.
   5. powerOff()-Timeout per Generation-Counter abgesichert.
   6. resetTitrator2() versteckt Ergebnis & setzt Flaschenfarbe.
   ================================================================ */


/* ############################################################
   1. UI-ZUSTANDSautomat - einzige Wahrheitsquelle fuer Buttons
   ############################################################ */

const TS = Object.freeze({
  OFF:     "off",      // Geraet aus, Parameter einstellbar
  FILLING: "filling",  // powerOn laeuft, Burette fuellt sich
  READY:   "ready",    // betriebsbereit, Titration kann starten
  RUNNING: "running",  // Tropfen laufen
  HOLDING: "holding",  // pausiert (Reset erlaubt)
  DONE:    "done"      // Endpunkt erreicht (Reset erlaubt)
});

let titratorState = TS.OFF;

// Regeln je Zustand: en = klickbar, active = Leucht-/Markierzustand
const UI_RULES = {
  [TS.OFF]:     { power: {en:true},  run: {en:false},            hold: {en:false},            reset: {en:false} },
  [TS.FILLING]: { power: {en:true},  run: {en:false},            hold: {en:false},            reset: {en:false} },
  [TS.READY]:   { power: {en:true},  run: {en:true},             hold: {en:false},            reset: {en:false} },
  [TS.RUNNING]: { power: {en:true},  run: {en:true, active:true},hold: {en:true},             reset: {en:false} },
  [TS.HOLDING]: { power: {en:true},  run: {en:true},             hold: {en:true, active:true},reset: {en:true}  },
  [TS.DONE]:    { power: {en:true},  run: {en:false},            hold: {en:false},            reset: {en:true}  }
};

// Erlaubte Uebergaenge - verhindert unlogische Spruenge
const TRANSITIONS = {
  [TS.OFF]:     [TS.FILLING],
  [TS.FILLING]: [TS.READY, TS.OFF],
  [TS.READY]:   [TS.RUNNING, TS.OFF],
  [TS.RUNNING]: [TS.HOLDING, TS.DONE, TS.OFF],
  [TS.HOLDING]: [TS.RUNNING, TS.DONE, TS.READY, TS.OFF],
  [TS.DONE]:    [TS.READY, TS.OFF]
};

// Sind beide Titrationsparameter gueltig gewaehlt?
function paramsReady() {
  const c = document.getElementById("cNaOH").value;
  const v = document.getElementById("vProbe").value;
  return c !== "" && v !== "" && c !== "Auswaehlen" && v !== "Auswaehlen";
}

// Der einzige Ort, der Klassen auf die vier Buttons schreibt
function setButton(btn, rule, activeClass) {
  btn.classList.toggle("disabledBtn", !rule.en);
  btn.classList.toggle("touchBtn", rule.en);
  if (activeClass) btn.classList.toggle(activeClass, !!rule.active);
  // Legacy-Klassen aus dem alten Code entfernen (könnten Klicks blockieren)
  btn.classList.remove("touchBtn1_off", "touchBtn1", "resetEnabled", "dropBlink");
}

// Aktuellen Zustand auf die komplette UI anwenden (ohne Uebergang)
function renderUI() {
  const r = UI_RULES[titratorState];
  const ready = paramsReady();   // Run/Hold/Power brauchen gueltige Parameter

  setButton(elements.btnPower, { ...r.power, en: r.power.en && ready }, "powerActive");
  setButton(elements.btnRun,   { ...r.run,   en: r.run.en   && ready }, "runActive");
  setButton(elements.btnHold,  { ...r.hold,  en: r.hold.en  && ready }, "holdActive");
  setButton(elements.btnReset, r.reset, "resetActive");

  // Parameter-Panel ausserhalb von FILLING/RUNNING/HOLDING/DONE bedienbar
  // (OFF und READY: Parameter waehlen bzw. nach Reset neu waehlen)
  const panelEditable = (titratorState === TS.OFF || titratorState === TS.READY);
  elements.paraPanel.classList.toggle("paraPanel_on",  panelEditable);
  elements.paraPanel.classList.toggle("paraPanel_off", !panelEditable);
}

// Zustandsuebergang pruefen, uebernehmen und UI neu zeichnen
function setUIState(next) {
  if (next === titratorState) return true;
  if (!TRANSITIONS[titratorState] || !TRANSITIONS[titratorState].includes(next)) {
    console.warn(`UI-Uebergang ${titratorState} -> ${next} nicht erlaubt`);
    return false;
  }
  titratorState = next;
  renderUI();
  return true;
}


/* ############################################################
   2. Cached DOM-Elemente und Versuchszustand
   ############################################################ */

let elements = {};
let scheduledPoints = [];   // Alle geplanten Messpunkte (sortiert)
let nextPointIndex = 0;

let buFilled = false;
let running = false;
let dripInterval = null;

// FIX 1: Fuell-/Leer-Intervalle zentral verwaltet (keine Lecks)
let fillInterval = null;
let emptyInterval = null;
// FIX 5: Generation-Counter gegen veraltete Power-Off-Timeouts
let powerCycle = 0;

let buretteLevel = 260;
const buretteMax = 260;
const buretteVolume = 25;
const maxHeight = 260;
let maxVolume = 25;          // Chart-Maximum X-Achse

let volumeUsed = 0;
let pHakt = 1.75;

let equivalencePoints = [];
let curvePoints = [];
let currentAnnotations = [];
let annotatedVolumes = new Set();

let konzTitrant = 0;
let konzProbe = 0;
let volProb = 0;
let deviceOn = false;
let panelScale = 0.5;

const possibleConcentrations = [0.02, 0.05, 0.08, 0.10, 0.12, 0.15, 0.20];
let experimentCreated = false;
let versuchNr = 1;
let aufgabeNr = 1;

let chart = null;

// Saeure-Auswahl
const acidData = {
  HCl:       { name: "Salzsaeure",      pKa: [-Infinity] },
  H2SO4:     { name: "Schwefelsaeure",  pKa: [-Infinity, 1.99] },
  H3PO4:     { name: "Phosphorsaeure",  pKa: [2.15, 7.20, 12.35] },
  citricAcid:{ name: "Zitronensaeure",  pKa: [3.13, 4.76, 6.40] }
};
let acidType = "HCl";
let acid = acidData[acidType];


/* ############################################################
   3. Event Listener (keinerlei Button-Klassen hier!)
   ############################################################ */

document.getElementById("acidSelect").addEventListener("change", function () {
  acidType = this.value;
  acid = acidData[acidType];
  document.getElementById("acidName").textContent = acid.name;
  updateChartTitle();
});

document.getElementById("cNaOH").addEventListener("change", function () {
  const val = Number(this.value);
  if (!isNaN(val) && val > 0) konzTitrant = val;
  updateChartTitle();
  checkExperimentReady();
});

document.getElementById("vProbe").addEventListener("change", function () {
  const volume = Number(this.value);
  if (volume) {
    volProb = volume;
    fillFlask(volProb);
  }
  checkExperimentReady();
});

function checkExperimentReady() {
  const ready = paramsReady();
  const status = document.getElementById("experimentStatus");
  if (status) {
    status.textContent = ready ? "🟢 Bereit" : "🟡 Parameter eingeben";
  }
  if (ready) {

    createExperiment();}
  renderUI();
}


/* ############################################################
   4. Versuch anlegen
   ############################################################ */

function createExperiment() {
  if (!paramsReady()) return;   // erst bei gueltigen Werten rechnen

  if (!experimentCreated) {
    versuchNr = 1;
    konzProbe = possibleConcentrations[
      Math.floor(Math.random() * possibleConcentrations.length)
    ];
    experimentCreated = true;
    addTableRow2(aufgabeNr,versuchNr);
    aufgabeNr++;

    // zu Testzwecken:
    document.getElementById("cProbe").innerHTML =
      "Konzentration: " + konzProbe.toFixed(2) + " mol/L";
  }

  konzTitrant = Number(document.getElementById("cNaOH").value);
  volProb = Number(document.getElementById("vProbe").value);

  equivalencePoints = calculateEquivalencePoints(
    konzProbe, volProb, konzTitrant, acid.pKa.length
  );

  // Geplante Messpunkte vorbereiten
  scheduledPoints = [];
  const eqSet = new Set();
  equivalencePoints.forEach(eq => { if (eq > 0.05) eqSet.add(eq); });

  for (let v = 0; v <= maxVolume; v += 1.0) {
    let isNearEq = false;
    for (let eq of eqSet) {
      if (Math.abs(eq - v) < 0.05) { isNearEq = true; break; }
    }
    if (!isNearEq) scheduledPoints.push({ volume: v, isEq: false });
  }

  equivalencePoints.forEach(eq => {
    if (eq > 0.05) scheduledPoints.push({ volume: eq, isEq: true });
  });

  scheduledPoints.sort((a, b) => a.volume - b.volume);
  nextPointIndex = 0;
}

function initElements() {
  elements.chartContainer = document.getElementById("curve");

  elements.svgflask      = document.getElementById("flaskLiquid");
  elements.flaskClipRect = document.querySelector("#flaskClip rect");
  elements.flask         = document.getElementById("flaskClip");
  elements.burRect       = document.getElementById("buretteClip");
  elements.burClip       = document.querySelector("#buretteClip rect");
  elements.lamp          = document.getElementById("endpointLamp");
  elements.btnPower      = document.getElementById("btnPower");
  elements.btnRun        = document.getElementById("btnRun");
  elements.btnHold       = document.getElementById("btnHold");
  elements.btnReset      = document.getElementById("btnReset");
  elements.displayLine1  = document.getElementById("displ1");
  elements.displayLine2  = document.getElementById("displ2");
  elements.lcd           = document.getElementById("lcdDisplay");
  elements.digitalPanel  = document.getElementById("digitalPanel");
  elements.knobSVG       = document.getElementById("knobSVG");
  elements.pointer       = document.getElementById("pointer");
  elements.speedReadout  = document.getElementById("speedReadout");
  elements.buretteLiquid = document.getElementById("buretteLiquid");
  elements.tube          = document.getElementById("tube");
  elements.drop          = document.getElementById("drop");
  elements.mixLayer      = document.getElementById("mixLayer");
  elements.buretteScale  = document.getElementById("buretteScale");
  elements.progressBar   = document.getElementById("progressBar");
  elements.ergebnis      = document.getElementById("ergebnis");
  elements.vProbe        = document.getElementById("vProbe");
  elements.paraPanel     = document.getElementById("experimentPanel");
}


/* ############################################################
   5. Kolben fuellen / leeren
   ############################################################ */

function fillFlask(volume) {
  const maskLevel = document.getElementById("flaskMaskLevel");
  const minVolume = 50;
  const maxFillVolume = 500;
  const bottom = 71;
  const minHeight = 8;
  const maxFillHeight = 55;

  const targetHeight = minHeight + ((volume - minVolume) / (maxFillVolume - minVolume)) * (maxFillHeight - minHeight);
  let currentHeight = 0;

  const interval = setInterval(() => {
    currentHeight += 0.5;
    if (currentHeight >= targetHeight) {
      currentHeight = targetHeight;
      clearInterval(interval);
    }
    maskLevel.setAttribute("y", bottom - currentHeight);
    maskLevel.setAttribute("height", currentHeight);
  }, 20);
}

function emptyFlask() {
  const maskLevel = document.getElementById("flaskMaskLevel");
  maskLevel.setAttribute("y", "71");
  maskLevel.setAttribute("height", "0");
}


/* ############################################################
   6. pH-Berechnung (mehrprotonige Saeuren)
   ############################################################ */

function calculateEquivalencePoints(cAcid, vAcid, cBase, protonCount) {
  const nAcid = cAcid * vAcid / 1000;
  const points = [];
  for (let i = 1; i <= protonCount; i++) {
    const nBase = i * nAcid;
    const volume = nBase / cBase * 1000;
    points.push(volume);
  }
  return points;
}

function acidDistribution(pH, pKa) {
  const H = Math.pow(10, -pH);
  const Ka = pKa.map(pk => pk === -Infinity ? 1e100 : Math.pow(10, -pk));
  const n = Ka.length;
  const terms = [];
  terms[0] = Math.pow(H, n);

  for (let i = 1; i <= n; i++) {
    let term = 1;
    for (let j = 0; j < i; j++) term *= Ka[j];
    term *= Math.pow(H, n - i);
    terms[i] = term;
  }

  const denominator = terms.reduce((sum, value) => sum + value, 0);
  return terms.map(term => term / denominator);
}

function calculatePolyproticPH(volume, cAcid, vAcid, cBase, pKa) {
  const VAcid = vAcid / 1000;
  const VBase = volume / 1000;
  const Vtotal = VAcid + VBase;
  const nAcid = cAcid * VAcid;
  const nBase = cBase * VBase;
  const Cacid = nAcid / Vtotal;
  const CNa = nBase / Vtotal;

  function chargeBalance(pH) {
    const H = Math.pow(10, -pH);
    const OH = Math.pow(10, pH - 14);
    const alpha = acidDistribution(pH, pKa);
    let negativeCharge = 0;
    for (let i = 0; i < alpha.length; i++) {
      negativeCharge += i * alpha[i];
    }
    return H + CNa - OH - Cacid * negativeCharge;
  }

  let low = 0;
  let high = 14;
  for (let i = 0; i < 100; i++) {
    const mid = (low + high) / 2;
    if (chargeBalance(low) * chargeBalance(mid) <= 0) {
      high = mid;
    } else {
      low = mid;
    }
  }
  return (low + high) / 2;
}

function pHcalc(vol) {
  return calculatePolyproticPH(vol, konzProbe, volProb, konzTitrant, acid.pKa);
}


/* ############################################################
   7. Anzeigen
   ############################################################ */

function updateDigitalDisplay(volume, ph) {
  elements.displayLine1.innerHTML = volume.toFixed(2) + '<span class="unit">mL</span>';
  elements.displayLine2.innerHTML = ph.toFixed(2) + '<span class="unit">pH</span>';
  const percent = Math.min((volume / maxVolume) * 100, 100);
  elements.progressBar.style.width = percent + "%";
}

function updateDisplay() {
  volumeUsed = buretteVolume - ((buretteLevel / maxHeight) * maxVolume);
  pHakt = pHcalc(volumeUsed);

  updateDigitalDisplay(volumeUsed, pHakt);

  while (nextPointIndex < scheduledPoints.length &&
         volumeUsed >= scheduledPoints[nextPointIndex].volume) {
    const pt = scheduledPoints[nextPointIndex];
    if (nextPointIndex !== 0) drawPoints(pt.volume, pt.isEq);
    nextPointIndex++;
  }

  checkEndpoint(volumeUsed);
}

function checkEndpoint(volume) {
  if (!equivalencePoints.length) return;
  // Endpunkt = LETZTER Aequivalenzpunkt (mehrprotonige Saeuren!)
  const endPoint = equivalencePoints[equivalencePoints.length - 1];
  if (volume >= endPoint) {
    elements.svgflask.style.fill = "#ff4da6";
    elements.svgflask.style.opacity = "0.5";
    elements.ergebnis.style.visibility = "visible";
    createBurst();
    // Titration sauber beenden: Tropfen stoppen, dann Zustand wechseln
    running = false;
    dripStop();
    setUIState(TS.DONE);
  }
}

function createBurst() {
  for (let i = 0; i < 12; i++) {
    setTimeout(() => { createSwirl(true); }, i * 120);
  }
}

function updatePanelScale() {
  elements.digitalPanel.style.transform = `scale(${panelScale})`;
}

digitalPanel.addEventListener("wheel", (e) => {
  e.preventDefault();
  if (e.deltaY < 0) {
    panelScale += 0.05;
  } else {
    panelScale -= 0.05;
  }
  panelScale = Math.min(2.0, Math.max(0.3, panelScale));
  updatePanelScale();
});


/* ############################################################
   8. Chart (ApexCharts)
   ############################################################ */

// Chart-Titel aus Saeure + (falls gewaehlt) Titrantenkonzentration aufbauen
function updateChartTitle() {
  if (!chart) return;
  let text = "Titration von " + acid.name;
  if (konzTitrant > 0) {
    text += " mit " + konzTitrant + " mol/l NaOH";
  }
  chart.updateOptions({ title: { text: text } });
}

function initChart() {
  if (chart) chart.destroy();

  const options = {
    title: {
      text: "Titrationskurve",
      align: "center",
      style: {
        fontSize: "18px",
        fontWeight: "bold",
        fontFamily: "Helvetica, Arial, sans-serif",
        color: "black"
      }
    },
    chart: {
      type: "line",
      height: 350,
      animations: { enabled: false },
      toolbar: { show: false },
      background: "#ffffff"
    },
    series: [{ name: "pH-Wert", data: [] }],
    xaxis: {
      type: "numeric",
      title: { text: "Volumen (mL)", style: { color: "#000000", fontSize: "14px" } },
      min: 0,
      max: 25,
      tickAmount: 5,
      forceNiceScale: false,
      labels: { style: { colors: "#000000" } },
      axisBorder: { color: "#000000" },
      axisTicks: { color: "#000000" }
    },
    yaxis: {
      title: {
        text: "pH-Wert",
        offsetX: -25,
        offsetY: 20,
        style: { color: "#000000", fontSize: "14px" }
      },
      min: 0,
      max: 14,
      tickAmount: 7,
      labels: { style: { colors: "#000000" } }
    },
    stroke: { curve: "smooth", width: 2, colors: ["#950c14"] },
    markers: {
      size: 4,
      colors: ["#ff0000"],
      strokeColors: "#ffffff",
      strokeWidth: 1
    },
    grid: { borderColor: "#d0d0d0", strokeDashArray: 4 },
    annotations: { xaxis: [] },
    colors: ["#950c14"],
    theme: { mode: "light" }
  };

  chart = new ApexCharts(elements.chartContainer, options);
  chart.render();
}

function drawPoints(volume, isEquivalence = false) {
  const pH = pHcalc(volume);

  curvePoints.push({ volume: volume, pH: pH, isEquivalence: isEquivalence });
  curvePoints.sort((a, b) => a.volume - b.volume);

  // Annotation fuer diesen Aequivalenzpunkt vorbereiten
  if (isEquivalence && !annotatedVolumes.has(volume)) {
    annotatedVolumes.add(volume);
    currentAnnotations.push({
      x: volume,
      strokeDashArray: 6,
      borderColor: '#8919ca',
      label: {
        text: 'ÄP',
        style: { color: '#fff', background: '#8919ca', fontSize: '12px' }
      }
    });
  }

  const seriesData = curvePoints.map(pt => ({
    x: parseFloat(pt.volume.toFixed(2)),
    y: parseFloat(pt.pH.toFixed(2))
  }));

  const markerSizes  = curvePoints.map(pt => pt.isEquivalence ? 6 : 4);
  const markerColors = curvePoints.map(pt => pt.isEquivalence ? '#8919ca' : '#ff0000');

  if (chart) {
    chart.updateOptions({
      series: [{ name: 'pH-Wert', data: seriesData }],
      xaxis: { min: 0, max: 25, tickAmount: 5, forceNiceScale: false },
      markers: {
        size: markerSizes,
        colors: markerColors,
        strokeColors: '#fff',
        strokeWidth: 1
      },
      annotations: { xaxis: currentAnnotations }
    });
  }

  addTableRow(volume, pH, isEquivalence);
}


/* ############################################################
   9. Tabelle
   ############################################################ */

function addTableRow(volume, pH, isEquivalence = false) {
  const tbody = document.getElementById("tableBody");
  const tr = document.createElement("tr");

  if (isEquivalence) {
    tr.style.backgroundColor = "#f0e6ff";
    tr.style.fontWeight = "bold";
  }

  tr.innerHTML = `
    <td>${volume.toFixed(2)} ml${isEquivalence ? ' (ÄP)' : ''}</td>
    <td>${pH.toFixed(2)}</td>
  `;
  tbody.appendChild(tr);
}

//Versuchsprotokoll
function addTableRow2(aufgabe,versuch) {
  const tbody = document.getElementById("tableBody2");
  const tr = document.createElement("tr");

  tr.innerHTML = `
    <td>${aufgabe}</td>
    <td>${versuch}</td>
  `;
  tbody.appendChild(tr);
}

function resetTable() {
  document.getElementById("tableBody").innerHTML = "";
}


/* ############################################################
   10. Geraete-Steuerung: Power / Run / Hold / Reset
   ############################################################ */

function togglePower() {
  if (titratorState === TS.OFF) {
    if (!paramsReady()) return;
    if (!setUIState(TS.FILLING)) return;
    powerOn();
    setTimeout(() => {
      if (titratorState === TS.FILLING) {
        updateDigitalDisplay(0, 1.75);
        setUIState(TS.READY);
      }
    }, 2000);
  } else {
    // Power ist waehrend Titration/Hold/Ende erlaubt -> Warnung vor Datenverlust
    const titrationAktiv = (titratorState === TS.RUNNING || titratorState === TS.HOLDING);
    setUIState(TS.OFF);
    powerOff(titrationAktiv);
  }
}

function powerOn() {
  deviceOn = true;
  powerCycle++;   // FIX 5: laufende powerOff-Timeouts invalidieren
  elements.lcd.classList.remove("lcdDisplay_off");
  elements.lcd.classList.add("lcdDisplay_on");
  elements.displayLine1.style.visibility = "visible";
  elements.displayLine2.style.visibility = "visible";
  elements.displayLine1.textContent = "JoboMeter 2000";
  elements.displayLine2.textContent = "Initializing...";
  startAnimation();
  createExperiment();
}

function powerOff(titrationAktiv) {
  dripStop();
  running = false;
  deviceOn = false;
  const myCycle = powerCycle;   // FIX 5: Generation dieses Power-Offs merken

  elements.displayLine1.style.visibility = "visible";
  elements.displayLine1.textContent = "Shutting down...";

  setTimeout(() => {
    if (myCycle !== powerCycle) return;   // FIX 5: zwischenzeitlich wieder eingeschaltet
    elements.displayLine1.style.visibility = "hidden";
    elements.lcd.classList.remove("lcdDisplay_on");
    elements.lcd.classList.add("lcdDisplay_off");
  }, 3000);

  elements.displayLine2.style.visibility = "hidden";
  elements.progressBar.style.width = "0%";

  emptyBurette();
  emptyFlask();

  if (chart) {
    chart.updateSeries([{ data: [] }]);
    chart.updateOptions({ title: { text: "Titrationskurve" } });
    chart.clearAnnotations();
  }

  curvePoints = [];
  nextPointIndex = 0;
  scheduledPoints = [];

  resetTable();

  if (titrationAktiv) {
    alert("Alle Daten gehen verloren!");
  }

  experimentCreated = false;
  resetExperimentPanel();   // setzt u.a. die Auswahlfelder zurueck, endet mit renderUI()
}

function toggleDrip() {
  // Start nur aus READY/HOLDING; Pausieren (Hold) auch aus RUNNING
  if (titratorState !== TS.READY &&
      titratorState !== TS.HOLDING &&
      titratorState !== TS.RUNNING) return;

  if (dripInterval === null) {
    setUIState(TS.RUNNING);
    running = true;
    dripper();
  } else {
    running = false;
    dripStop();
    setUIState(TS.HOLDING);   // <- erst jetzt wird Reset freigegeben
  }
}

// Wird vom Reset-Button (btnReset) aufgerufen
function resetTitrator2() {
  if (titratorState !== TS.HOLDING && titratorState !== TS.DONE) return;

  running = false;
  dripStop();

  // FIX 1/2: kreuzende Fuell-/Leer-Intervalle stoppen, Stand konsistent setzen
  clearInterval(fillInterval);  fillInterval = null;
  clearInterval(emptyInterval); emptyInterval = null;

  //Protokoll
  versuchNr++;
  addTableRow2(aufgabeNr-1,versuchNr);


  volumeUsed = 0;
  pHakt = 1.75;
  buretteLevel = buretteMax;

  // ---- Saeure & Probenkonzentration bleiben erhalten! ----
  const acidSelect = document.getElementById("acidSelect");
  if (acidSelect) acidSelect.disabled = true;
  const acidName = document.getElementById("acidName");
  if (acidName && acid) acidName.textContent = acid.name;

  // ---- NaOH & Probenvolumen neu waehlen ----
  const cNaOH = document.getElementById("cNaOH");
  if (cNaOH) { cNaOH.selectedIndex = 0; cNaOH.disabled = false; }
  konzTitrant = 0;

  const vProbe = document.getElementById("vProbe");
  if (vProbe) { vProbe.selectedIndex = 0; vProbe.disabled = false; }
  volProb = 0;

  // Konzentrationsanzeige verdecken (intern bleibt konzProbe erhalten)
  const cProbe = document.getElementById("cProbe");
  if (cProbe) cProbe.textContent = "?";

  //versuchNr++;
  const status = document.getElementById("experimentStatus");
  if (status) status.textContent = "🟡 Versuch " + versuchNr;

  // ---- Burette wieder voll ----
  const clipRect = document.querySelector("#buretteClip rect");
  if (clipRect) {
    clipRect.setAttribute("y", "0");
    clipRect.setAttribute("height", buretteMax);
  }
  if (elements.buretteLiquid) elements.buretteLiquid.style.visibility = "visible";

  // FIX 6: Ergebnis-Anzeige und Flaschenfarbe zuruecksetzen
  if (elements.ergebnis) elements.ergebnis.style.visibility = "hidden";
  elements.svgflask.style.fill = "#b3d4fc";
  elements.svgflask.style.opacity = "1";

  if (elements.tube) {
    elements.tube.style.visibility = "hidden";
    elements.tube.style.animation = "none";
  }
  if (elements.drop) {
    elements.drop.style.visibility = "hidden";
    elements.drop.style.animation = "none";
    elements.drop.style.opacity = 0;
  }

  updateDigitalDisplay(0, 1.75);

  // ---- Chart & Tabelle leeren ----
  equivalencePoints = [];
  curvePoints = [];
  currentAnnotations = [];
  annotatedVolumes.clear();

  if (chart) {
    chart.updateOptions({
      title: { text: "Titrationskurve" },
      annotations: { xaxis: [], yaxis: [], points: [] }
    });
    chart.updateSeries([{ name: "pH-Wert", data: [] }]);
  }

  buFilled = true;   // Burette wurde oben manuell voll gesetzt
  resetTable();

  createExperiment();   // no-op, bis NaOH/Volumen erneut gewaehlt wurden
  setUIState(TS.READY);
}

// Alias fuer den alten Funktionsnamen (falls HTML onclick="resetTitrator()" nutzt)
function resetTitrator() {
  resetTitrator2();
}

// Panel + Auswahlfelder in den Ausgangszustand (nach powerOff)
function resetExperimentPanel() {
  const acidSelect = document.getElementById("acidSelect");
  const cNaOH = document.getElementById("cNaOH");
  const vProbe = document.getElementById("vProbe");

  if (acidSelect) { acidSelect.selectedIndex = 0; acidSelect.disabled = false; }
  if (cNaOH)      { cNaOH.selectedIndex = 0;      cNaOH.disabled = false; }
  if (vProbe)     { vProbe.selectedIndex = 0;     vProbe.disabled = false; }

  const acidName = document.getElementById("acidName");
  const cProbe = document.getElementById("cProbe");
  const status = document.getElementById("experimentStatus");

  if (acidName) acidName.textContent = "";
  if (cProbe)   cProbe.textContent = "?";
  if (status)   status.textContent = "🟡 Eingabe";

  const btnNewExperiment = document.getElementById("btnNewExperiment");
  if (btnNewExperiment) btnNewExperiment.disabled = false;

  // Versuchsparameter zuruecksetzen
  konzTitrant = 0;
  konzProbe = 0;
  volProb = 0;

  // Titrationsdaten loeschen
  equivalencePoints = [];
  curvePoints = [];
  currentAnnotations = [];
  annotatedVolumes.clear();

  if (chart) {
    chart.updateOptions({
      annotations: { xaxis: [], yaxis: [], points: [] }
    });
    chart.updateSeries([{ name: "pH-Wert", data: [] }]);
  }

  renderUI();
}


/* ############################################################
   11. Tropfen-Mechanik
   ############################################################ */

// FIX 4: buretteLevel wird bei 0 geklammert - kein Durchlaufen mehr
function updateBurette() {
  buretteLevel = Math.max(0, buretteLevel - 3);
  if (buretteLevel === 0) { dripStop(); return; }
  elements.burClip.setAttribute("y", 260 - buretteLevel);
  elements.burClip.setAttribute("height", buretteLevel);
  updateDisplay();
}

function dripper() {
  elements.drop.style.visibility = "visible";
  elements.tube.style.visibility = "visible";
  elements.speedReadout.textContent = speedmlpers;
  dripInterval = setInterval(() => {
    elements.drop.style.animation = "none";
    elements.drop.style.opacity = 0;
    elements.drop.getBoundingClientRect();   // Reflow erzwingen
    elements.drop.style.opacity = 1;
    elements.drop.style.animation = "dropFall 0.6s linear";
    updateBurette();
    createSwirl();
  }, dripSpeed);
}

function dripStop() {
  clearInterval(dripInterval);
  dripInterval = null;
  elements.drop.style.animation = "none";
  elements.drop.style.opacity = 0;
}

// FIX 1/2/3: startAnimation startet vom echten buretteLevel,
// stoppt kreuzende Intervalle und haelt Variable + Clip synchron.
function startAnimation() {
  if (!deviceOn) return;

  // kreuzende Animationen stoppen
  clearInterval(emptyInterval); emptyInterval = null;
  if (fillInterval) { clearInterval(fillInterval); fillInterval = null; }

  const burette  = elements.buretteLiquid;
  const tube     = elements.tube;
  const clipRect = elements.burClip;
  let fillLevel  = buretteLevel;      // vom ECHTEN Stand starten
  if (fillLevel >= buretteMax) { buFilled = true; return; }
  buFilled = true;
  resetTable();

  const length = tube.getTotalLength();
  tube.style.visibility = "visible";
  tube.style.strokeDasharray = length;
  tube.style.strokeDashoffset = length;
  tube.style.animation = "none";
  tube.getBoundingClientRect();        // Reflow, Animation neu starten
  tube.style.animation = "flow 1.5s linear forwards";

  fillInterval = setInterval(() => {
    if (fillLevel >= buretteMax) {
      clearInterval(fillInterval);
      fillInterval = null;
      return;
    }
    fillLevel += 2;
    buretteLevel = fillLevel;          // Variable und Clip synchron halten
    clipRect.setAttribute("y", 260 - fillLevel);
    clipRect.setAttribute("height", fillLevel);
    burette.style.visibility = "visible";
  }, 20);
}

// FIX 1/2: emptyBurette stoppt das Fuell-Intervall und setzt
// buFilled sofort (nicht erst nach Ablauf der Animation).
function emptyBurette() {
  clearInterval(fillInterval);         // Leck schliessen
  fillInterval = null;
  buFilled = false;                    // SOFORT konsistent

  const burette  = elements.buretteLiquid;
  const tube     = elements.tube;
  const clipRect = elements.burClip;

  emptyInterval = setInterval(() => {
    if (buretteLevel <= 2) {
      clearInterval(emptyInterval);
      emptyInterval = null;
      buretteLevel = 0;
      burette.style.visibility = "hidden";
      tube.style.visibility = "hidden";
      elements.svgflask.style.fill = "#b3d4fc";
      return;
    }
    buretteLevel -= 2;
    clipRect.setAttribute("y", 260 - buretteLevel);
    clipRect.setAttribute("height", buretteLevel);
  }, 20);
}

function createSwirl(isPink = false) {
  const mixLayer = elements.mixLayer;
  const swirl = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");

  swirl.setAttribute("cx", 70 + Math.random() * 20 - 10);
  swirl.setAttribute("cy", 50 + Math.random() * 10);
  if (equivalencePoints.length && volumeUsed >= 0.5 * equivalencePoints[0]) {
    swirl.setAttribute("rx", 17 + Math.random() * 10);
    swirl.setAttribute("ry", 14 + Math.random() * 6);
    swirl.style.fill = "rgba(255,20,147,0.8)";
  } else {
    swirl.setAttribute("rx", 6 + Math.random() * 10);
    swirl.setAttribute("ry", 3 + Math.random() * 6);
  }
  swirl.setAttribute("fill", isPink ? "#ff4da6" : "#4da6ff");
  swirl.setAttribute("opacity", "0.45");
  swirl.setAttribute("filter", "url(#blur)");
  swirl.classList.add("mix");

  mixLayer.appendChild(swirl);

  setTimeout(() => { swirl.remove(); }, 1800);
}


/* ############################################################
   12. Regler (Knob)
   ############################################################ */

let knobAngle = 130;
let dragging = false;
let dripSpeed = 0;
let speedmlpers = 0;

function updateKnob() {
  elements.pointer.style.transform = `rotate(${knobAngle}deg)`;
  dripSpeed = Math.round(1500 - ((-knobAngle + 130) / 260) * 1400);
  speedmlpers = (0.29 / dripSpeed * 1000).toFixed(2) + "ml/s";
  elements.speedReadout.textContent = speedmlpers;
  if (running) {
    if (dripInterval) clearInterval(dripInterval);
    dripper();
  }
}

function initKnob() {
  elements.knobSVG.addEventListener("mousedown", (e) => {
    dragging = true;
    e.preventDefault();
  });

  document.addEventListener("mouseup", () => {
    dragging = false;
  });

  document.addEventListener("mousemove", (e) => {
    if (!dragging) return;

    const rect = elements.knobSVG.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    let angle = Math.atan2(dy, dx) * 180 / Math.PI + 90;

    if (angle > 180) angle -= 360;
    angle = Math.max(-130, Math.min(130, angle));
    knobAngle = angle;
    updateKnob();
  });
}


/* ############################################################
   13. Initialisierung
   ############################################################ */

document.addEventListener("DOMContentLoaded", () => {
  initElements();
  initKnob();
  updatePanelScale();
  updateKnob();
  initChart();
  elements.lcd.classList.add("lcdDisplay_off");
  renderUI();   // Startzustand: OFF, Power gesperrt bis Parameter gewaehlt
});
