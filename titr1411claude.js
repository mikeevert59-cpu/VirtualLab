// Erweiterung: Titration von Säuren (Titrant NaOH) UND Basen (Titrant HCl)
// Benötigte HTML-IDs: probeSelect, acidName, titrantName, cTitrant, vProbe

//State machine
/* ############################################################
   1. UI-ZUSTANDSautomat – einzige Wahrheitsquelle für Buttons
   ############################################################ */

const TS = Object.freeze({
  OFF:     "off",      // Gerät aus, Parameter einstellbar
  FILLING: "filling",  // powerOn läuft, Burette füllt sich
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

// Erlaubte Übergänge – verhindert unlogische Sprünge
const TRANSITIONS = {
  [TS.OFF]:     [TS.FILLING],
  [TS.FILLING]: [TS.READY, TS.OFF],
  [TS.READY]:   [TS.RUNNING, TS.OFF],
  [TS.RUNNING]: [TS.HOLDING, TS.DONE, TS.OFF],
  [TS.HOLDING]: [TS.RUNNING, TS.DONE, TS.READY, TS.OFF],
  [TS.DONE]:    [TS.READY, TS.OFF]
};
// Sind beide Titrationsparameter gültig gewählt?
function paramsReady() {
  const p = document.getElementById("probeSelect").value;
  const c = document.getElementById("cTitrant").value;
  const v = document.getElementById("vProbe").value;
  return p !== "" && c !== "" && v !== "" &&
    p !== "Auswählen" && c !== "Auswählen" && v !== "Auswählen";
}

function checkExperimentReady() {
  const ready = paramsReady();
  const status = document.getElementById("experimentStatus");
  if (status) {
    status.textContent = ready ? "🟢 Bereit" : "🟡 Eingabe";
  }
  if (ready) {
    createExperiment();
    document.getElementById("container").innerHTML = "Säure-Base-Titrationen: " +
      "<small>" + konzProbe.toFixed(2) + " mol/l " + probe.name + " mit " + konzTitrant.toFixed(2) + " mol/l " + titrantFor(probe) + "</small>"; // TODO: zeigt die gesuchte Konzentration an
    renderUI();}
}

// Aktuellen Zustand auf die komplette UI anwenden (ohne Übergang)
function renderUI() {
  const r = UI_RULES[titratorState];
  const ready = paramsReady();   // Run/Hold/Power brauchen gültige Parameter

  //?????????????????
  setButton(elements.btnPower, { ...r.power, en: r.power.en && ready }, "powerActive");
  setButton(elements.btnRun,   { ...r.run,   en: r.run.en   && ready }, "runActive");
  setButton(elements.btnHold,  { ...r.hold,  en: r.hold.en  && ready }, "holdActive");
  setButton(elements.btnReset, r.reset, "resetActive");

  // Parameter-Panel außerhalb von FILLING/RUNNING/HOLDING/DONE bedienbar
  // (OFF und READY: Parameter wählen bzw. nach Reset neu wählen)
  const panelEditable = (titratorState === TS.OFF || titratorState === TS.READY);
  elements.paraPanel.classList.toggle("paraPanel_on",  panelEditable);
  elements.paraPanel.classList.toggle("paraPanel_off", !panelEditable);

  // Dropdowns auch per Tastatur sperren; Ergebnisfeld und Ergebnis-Button bleiben bedienbar
  ["cTitrant", "vProbe"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = !panelEditable;
  });
  // Probe ist nur bei ausgeschaltetem Gerät wählbar (nach "Reset" bleibt sie erhalten)
  const probeEl = document.getElementById("probeSelect");
  if (probeEl) probeEl.disabled = (titratorState !== TS.OFF);
}

// "Ergebnis prüfen" erst nach Erreichen des Äquivalenzpunkts freigeben
function setResultButton(enabled) {
  const btn = document.getElementById("btnNewExperiment");
  if (btn) btn.classList.toggle("resultDisabled", !enabled);
}

// Zustandsübergang prüfen, übernehmen und UI neu zeichnen
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

// Der einzige Ort, der Klassen auf die vier Buttons schreibt
function setButton(btn, rule, activeClass) {
  btn.classList.toggle("disabledBtn", !rule.en);
  btn.classList.toggle("touchBtn", rule.en);
  if (activeClass) btn.classList.toggle(activeClass, !!rule.active);
  // Legacy-Klassen aus dem alten Code entfernen (könnten Klicks blockieren)
  btn.classList.remove("touchBtn1_off", "touchBtn1", "resetEnabled", "dropBlink");
}

// Cached DOM elements
let elements = {};
let scheduledPoints = [];   // Alle geplanten Messpunkte (sortiert)
let nextPointIndex = 0;

// State variables
let buFilled = false;
let running = false;
let dripInterval = null;
let flaskLevel = 0;
let maxLevel = 180;
let equivalence = 20;
let buretteLevel = 260;
const buretteMax = 260;
let maxFlask = 45;
let maxVolume = 25;
const maxHeight = 260;
const buretteVolume = 25;
let volumeUsed = 0;
let pHakt = 1.75;
let pHstart = 7;      // Anfangs-pH der aktuellen Probe (Säure: niedrig, Base: hoch)
let titrationData = [];
let equivalencePoint = 0;
let endpointTriggered = false;
let visiblePoints = 0;
let volIndex = 1;
let konzTitrant = 0;
let konzProbe = 0.02;
let volProb = 500;
let deviceOn = false;
let panelScale = 0.75;
const possibleConcentrations = [
  0.02, 0.05, 0.08, 0.10, 0.12, 0.15, 0.20
];
let experimentCreated = false;
let titrationStarted = false;
let versuchNr = 0;
let aufgabeNr = 1;
let wiederholung = false;

// Erweiterung: Säuren UND Basen
// typ:        "saeure" (Titrant NaOH) oder "base" (Titrant HCl)
// pKa:        pKa-Werte der Protonierungskette (bei Basen: der konjugierten Säure)
// z0:         Ladung der voll protonierten Form (z. B. NH4+ = +1)
// spect:      Ladung der Gegenionen pro Formeleinheit (Na+, K+, Ca2+ ...)
// eqFactors:  Äquivalenzpunkte bei Vielfachen der Stoffmenge der Probe
// indicator:  BTB / MR / MO (Farbverlauf) oder PP (Phenolphthalein: rosa ab ÄP)
// cRange:     optional, erlaubte Probenkonzentrationen (sonst possibleConcentrations)
const probeData = {
  // Säuren (Titrant: NaOH)
  HCl:        { typ: "saeure", name: "Salzsäure",     pKa: [-Infinity],         z0: 0, spect: 0, eqFactors: [1],       indicator: "BTB", indiName: "Bromthymolblau" },
  H2SO4:      { typ: "saeure", name: "Schwefelsäure", pKa: [-Infinity, 1.99],   z0: 0, spect: 0, eqFactors: [1, 2],    indicator: "BTB", indiName: "Bromthymolblau" },
  H3PO4:      { typ: "saeure", name: "Phosphorsäure", pKa: [2.15, 7.20, 12.35], z0: 0, spect: 0, eqFactors: [1, 2, 3], indicator: "PP", indiName: "Phenolphthalein" },
  citricAcid: { typ: "saeure", name: "Zitronensäure", pKa: [3.13, 4.76, 6.40],  z0: 0, spect: 0, eqFactors: [1, 2, 3], indicator: "PP", indiName: "Phenolphthalein" },

  // Basen (Titrant: HCl)
  NaOH:   { typ: "base", name: "Natronlauge",     pKa: [],            z0: 0, spect: 1, eqFactors: [1],    indicator: "BTB", indiName: "Bromthymolblau" },
  KOH:    { typ: "base", name: "Kalilauge",       pKa: [],            z0: 0, spect: 1, eqFactors: [1],    indicator: "BTB", indiName: "Bromthymolblau" },
  CaOH2:  { typ: "base", name: "Calciumhydroxid", pKa: [],            z0: 0, spect: 2, eqFactors: [2],    indicator: "BTB",
    cRange: [0.01, 0.02], indiName: "Bromthymolblau" },                                   // Löslichkeit ca. 0,02 mol/l
  NH3:    { typ: "base", name: "Ammoniak",        pKa: [9.25],        z0: 1, spect: 0, eqFactors: [1],    indicator: "MR", indiName: "Methylrot" },  // pKa von NH4+
  Na2CO3: { typ: "base", name: "Natriumcarbonat", pKa: [6.35, 10.33], z0: 0, spect: 2, eqFactors: [1, 2], indicator: "MO", indiName: "Methylorange" }   // pKa von H2CO3
};
let probeType = "HCl";
let probe = probeData[probeType];

function titrantFor(p) {
  return p.typ === "saeure" ? "NaOH" : "HCl";
}

function updateChartTitle() {
  if (!chart) return;
  const text = konzTitrant > 0
    ? "Titration von " + probe.name + " mit " + konzTitrant + " mol/l " + titrantFor(probe)
    : "Titration von " + probe.name;
  chart.updateOptions({ title: { text: text } });
}
let equivalencePoints = [];
let curvePoints = [];
let currentAnnotations = [];
let annotatedVolumes = new Set();
let neueAufgabe = false;

// NEU: ApexCharts Instanz
let chart = null;

// Event Listener
document.getElementById("probeSelect").addEventListener("change", function () {
  const selected = probeData[this.value];
  if (!selected) return;
  probeType = this.value;
  probe = selected;
  document.getElementById("acidName").textContent = probe.name;
  document.getElementById("titrantName").textContent = titrantFor(probe);
  document.getElementById("indik").textContent = probe.indiName;

  // Probe wurde gewechselt, nachdem der Versuch schon angelegt war:
  // Probenkonzentration passend zur neuen Probe neu wählen, Protokollzeile anpassen
  if (experimentCreated) {
    const range = probe.cRange || possibleConcentrations;
    konzProbe = range[Math.floor(Math.random() * range.length)];
    const cell = document.querySelector("#tableBody2 tr:last-child td:nth-child(3)");
    if (cell) cell.textContent = probe.name;
  }
  updateChartTitle();
  checkExperimentReady();
});

document.getElementById("cTitrant").addEventListener("change", function () {
  konzTitrant = Number(this.value);
  updateChartTitle();
});

document.getElementById("cTitrant").addEventListener("change", checkExperimentReady);
document.getElementById("vProbe").addEventListener("change", checkExperimentReady);
document.getElementById("vProbe").addEventListener("change", () => {
  const volume = Number(elements.vProbe.value);
  if (!volume) return;
  volProb = volume;
  fillFlask(volProb);
});

//neu:13.09
function resetExperimentPanel() {

  // -------------------------
  // Auswahlfelder zurücksetzen
  // -------------------------

  const probeSelect = document.getElementById("probeSelect");
  const cTitrant = document.getElementById("cTitrant");
  const vProbe = document.getElementById("vProbe");

  if (probeSelect) {
    probeSelect.selectedIndex = 0;
    probeSelect.disabled = false;
  }

  if (cTitrant) {
    cTitrant.selectedIndex = 0;
    cTitrant.disabled = false;
  }

  if (vProbe) {
    vProbe.selectedIndex = 0;
    vProbe.disabled = false;
  }


  // -------------------------
  // Anzeigen zurücksetzen
  // -------------------------

  const acidName = document.getElementById("acidName");
  const cProbe = document.getElementById("cProbe");
  const status = document.getElementById("experimentStatus");

  if (acidName) {
    acidName.textContent = "";
  }

  const titrantName = document.getElementById("titrantName");
  if (titrantName) {
    titrantName.textContent = "-";
  }

  if (cProbe) {
    cProbe.textContent = "?";
  }

  if (status) {
    status.textContent = "🟡 Eingabe";
  }


  // -------------------------
  // Neuer Versuch
  // -------------------------

  const btnNewExperiment =
    document.getElementById("btnNewExperiment");

  if (btnNewExperiment) {
    btnNewExperiment.disabled = false;
  }
  setResultButton(false);


  // -------------------------
  // interne Versuchsparameter
  // -------------------------

  konzTitrant = 0;
  konzProbe = 0;
  volProb = 0;

  endpointTriggered = false;


  // -------------------------
  // Titrationsdaten löschen
  // -------------------------

  equivalencePoints = [];
  curvePoints = [];
  currentAnnotations = [];
  annotatedVolumes.clear();


  // -------------------------
  // ApexCharts zurücksetzen
  // -------------------------

  if (chart) {
    chart.updateOptions({
      annotations: {
        xaxis: [],
        yaxis: [],
        points: []
      }
    });

    chart.updateSeries([{
      name: "pH",
      data: []
    }]);
  }
}
/*
function checkExperimentReady() {
  const cTitrant = document.getElementById("cTitrant").value;
  const vProbe = document.getElementById("vProbe").value;
  const ready = cTitrant !== "Auswählen" && vProbe !== "Auswählen";

  document.getElementById("experimentStatus").textContent =
    ready ? "🟢 Bereit" : "🟡 Eingabe";

  if (ready) {
    createExperiment();          // ← hier, mit gültigen Werten
    elements.btnPower.classList.remove("disabledBtn");
    elements.btnPower.classList.add("touchBtn");
  }
}
*/

/*
function checkExperimentReady() {
  const cTitrant = document.getElementById("cTitrant").value;
  const vProbe = document.getElementById("vProbe").value;
  const ready = cTitrant !== "Auswählen" && vProbe !== "Auswählen";

  document.getElementById("experimentStatus").textContent =
    ready ? "🟢 Bereit" : "🟡 Parameter eingeben";

  if (ready) {
    elements.btnPower.classList.remove("disabledBtn");
    elements.btnPower.classList.add("touchBtn");
  }
}
*/

function createExperiment() {
  if (!paramsReady()) return;

  konzTitrant = Number(document.getElementById("cTitrant").value);
  volProb = Number(document.getElementById("vProbe").value);

  if (!experimentCreated) {
    const range = probe.cRange || possibleConcentrations;
    konzProbe = range[Math.floor(Math.random() * range.length)];

    if (wiederholung) {
      // Gleiche Aufgabe, neuer Versuch → Aufgaben-Zelle leer
      addTableRow2("", versuchNr);
    } else {
      // Neue Aufgabe
      versuchNr = 1;
      addTableRow2(aufgabeNr, versuchNr);
      aufgabeNr++;
    }
    wiederholung = false;
    experimentCreated = true;
  }
  equivalencePoints = calculateEquivalencePoints(
    konzProbe, volProb, konzTitrant, probe.eqFactors
  );
  pHstart = pHcalc(0);   // Anfangs-pH (hängt nur von Probe und konzProbe ab)

  experimentCreated = true;

  // === GEPLANTE MESSPUNKTE VORBEREITEN ===
  scheduledPoints = [];
  const eqSet = new Set();
  equivalencePoints.forEach(eq => {
    if (eq > 0.05) eqSet.add(eq);
  });

  for (let v = 0; v <= maxVolume; v += 1.0) {
    let isNearEq = false;
    for (let eq of eqSet) {
      if (Math.abs(eq - v) < 0.05) {
        isNearEq = true;
        break;
      }
    }
    if (!isNearEq) {
      scheduledPoints.push({ volume: v, isEq: false });
    }
  }

  equivalencePoints.forEach(eq => {
    if (eq > 0.05) {
      scheduledPoints.push({ volume: eq, isEq: true });
    }
  });

  scheduledPoints.sort((a, b) => a.volume - b.volume);
  //console.log("scheduledPoints:", scheduledPoints);
  nextPointIndex = 0;
}

function initElements() {
  // GEÄNDERT: canvas → div container für ApexCharts
  elements.chartContainer = document.getElementById("curve");

  elements.svgflask = document.getElementById("flaskLiquid");
  elements.flaskClipRect = document.querySelector("#flaskClip rect");
  elements.flask = document.getElementById("flaskClip");
  elements.burRect = document.getElementById("buretteClip");
  elements.burClip = document.querySelector("#buretteClip rect");
  elements.lamp = document.getElementById("endpointLamp");
  elements.btnPower = document.getElementById("btnPower");
  elements.btnRun = document.getElementById("btnRun");
  elements.btnHold = document.getElementById("btnHold");
  elements.btnDrop = document.getElementById("btnDrop");
  elements.displayLine1 = document.getElementById("displ1");
  elements.displayLine2 = document.getElementById("displ2");
  elements.lcd = document.getElementById("lcdDisplay");
  elements.digitalPanel = document.getElementById("digitalPanel");
  elements.knobSVG = document.getElementById("knobSVG");
  elements.pointer = document.getElementById("pointer");
  elements.speedReadout = document.getElementById("speedReadout");
  elements.buretteLiquid = document.getElementById("buretteLiquid");
  elements.tube = document.getElementById("tube");
  elements.drop = document.getElementById("drop");
  elements.mixLayer = document.getElementById("mixLayer");
  elements.buretteScale = document.getElementById("buretteScale");
  elements.progressBar = document.getElementById("progressBar");
  elements.ergebnis = document.getElementById("ergebnis");
  elements.vProbe = document.getElementById("vProbe");
  elements.btnReset = document.getElementById("btnReset");
  elements.paraPanel = document.getElementById("experimentPanel");
}

function fillFlask(volume) {
  const maskLevel = document.getElementById("flaskMaskLevel");
  const minVolume = 50;
  const maxVolume = 500;
  const bottom = 71;
  const minHeight = 8;
  const maxHeight = 55;

  const targetHeight = minHeight + ((volume - minVolume) / (maxVolume - minVolume)) * (maxHeight - minHeight);
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

function gesuchtKonz() {
  const gesKonz = (konzTitrant * equivalencePoints[0]) / (volProb * probe.eqFactors[0]);
  document.getElementById("cProbe").innerHTML = "Konzentration: " + gesKonz.toFixed(2) + " mol/L";
}

// NEU: Äquivalenzpunkte als ApexCharts Annotations
function drawEquivalenceLines() {
  if (!chart || !equivalencePoints.length) return;

  const annotations = equivalencePoints.map(volume => ({
    x: volume,
    strokeDashArray: 6,
    borderColor: '#8919ca',
    label: {
      text: 'ÄP',
      style: {
        color: '#fff',
        background: '#8919ca',
        fontSize: '12px'
      }
    }
  }));

  chart.updateOptions({
    annotations: {
      xaxis: annotations
    }
  });
}

// Äquivalenzpunkte (in mL): factors = Vielfache der Stoffmenge der Probe
function calculateEquivalencePoints(cProbe, vProbe, cTitrant, factors) {
  const nProbe = cProbe * vProbe / 1000;
  return factors.map(f => f * nProbe / cTitrant * 1000);
}

function acidDistribution(pH, pKa) {
  const H = Math.pow(10, -pH);
  const Ka = pKa.map(pk => pk === -Infinity ? 1e100 : Math.pow(10, -pk));
  const n = Ka.length;
  const terms = [];
  terms[0] = Math.pow(H, n);

  for (let i = 1; i <= n; i++) {
    let term = 1;
    for (let j = 0; j < i; j++) {
      term *= Ka[j];
    }
    term *= Math.pow(H, n - i);
    terms[i] = term;
  }

  const denominator = terms.reduce((sum, value) => sum + value, 0);
  return terms.map(term => term / denominator);
}

// Allgemeine Ladungsbilanz für Säuren (Titrant NaOH) und Basen (Titrant HCl):
//   [H+] + [Kationen] - [OH-] - [Anionen] = 0
// Probe: Protonierungskette mit Anteilen alpha_i (i = abgegebene Protonen),
//        Ladung der Spezies i = z0 - i, plus Gegenionen (spect).
function calculateTitrationPH(vTit, cSample, vSample, cTit, p) {
  const Vs = vSample / 1000;
  const Vt = vTit / 1000;
  const Vtot = Vs + Vt;
  const C = cSample * Vs / Vtot;                  // Probe (verdünnt)
  const T = cTit * Vt / Vtot;                     // Titrant (verdünnt)
  const cationT = p.typ === "saeure" ? T : 0;     // Na+ aus NaOH
  const anionT  = p.typ === "base"   ? T : 0;     // Cl- aus HCl
  const spect   = p.spect * C;                    // Gegenionen der Probe

  // Ladungsbilanz ist monoton fallend in pH -> Bisektion
  function chargeBalance(pH) {
    const H = Math.pow(10, -pH);
    const OH = Math.pow(10, pH - 14);
    const alpha = acidDistribution(pH, p.pKa);
    let q = 0;
    for (let i = 0; i < alpha.length; i++) {
      q += alpha[i] * (p.z0 - i);
    }
    return H + cationT + spect + C * q - OH - anionT;
  }

  let low = 0;
  let high = 14;
  for (let i = 0; i < 100; i++) {
    const mid = (low + high) / 2;
    if (chargeBalance(mid) > 0) {
      low = mid;
    } else {
      high = mid;
    }
  }
  return (low + high) / 2;
}

//console.log("pH-Test:", pHcalc(0));
//console.log("pH 5 ml:", pHcalc(5));
//console.log("pH 10 ml:", pHcalc(10));


// Indikatoren: Stützstellen [pH, [r, g, b]], dazwischen lineare Interpolation
const INDICATORS = {
  BTB: [[6.0, [255, 255, 0]], [7.0, [0, 166, 80]], [7.6, [0, 100, 255]]],   // Bromthymolblau: gelb -> grün -> blau
  MR:  [[4.4, [220, 40, 40]], [6.2, [255, 210, 0]]],                         // Methylrot: rot -> gelb
  MO:  [[3.1, [220, 40, 40]], [4.4, [255, 200, 0]]]                          // Methylorange: rot -> gelb
  // PP (Phenolphthalein) hat keinen Verlauf: Kolben wird ab dem ÄP rosa (siehe checkEndpoint)
};

function indicatorColor(pH, key) {
  const s = INDICATORS[key];
  const rgb = c => `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
  if (pH <= s[0][0]) return rgb(s[0][1]);
  if (pH >= s[s.length - 1][0]) return rgb(s[s.length - 1][1]);
  for (let i = 1; i < s.length; i++) {
    if (pH < s[i][0]) {
      const t = (pH - s[i - 1][0]) / (s[i][0] - s[i - 1][0]);
      return rgb(s[i - 1][1].map((v, k) => Math.round(v + (s[i][1][k] - v) * t)));
    }
  }
}

function updateIndicatorColor(pH) {
  if (!INDICATORS[probe.indicator]) return;   // PP: Farbe kommt erst in checkEndpoint
  elements.svgflask.style.fill = indicatorColor(pH, probe.indicator);
  elements.svgflask.style.opacity = "0.8";
}



function updateDigitalDisplay(volume, ph) {
  elements.displayLine1.classList.remove("startText");
  elements.displayLine2.classList.remove("startText");
  elements.displayLine1.classList.remove("endText");
  elements.displayLine1.innerHTML = volume.toFixed(2) + '<span class="unit">mL</span>';
  elements.displayLine2.innerHTML = ph.toFixed(2) + '<span class="unit">pH</span>';
  const percent = Math.min((volume / maxVolume) * 100, 100);
  elements.progressBar.style.width = percent + "%";
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
  drawCable();
});

// NEU: ApexCharts initialisieren
function initChart() {
  if (chart) {
    chart.destroy();
  }
  //NEU
  const options = {
    title: {
      text: "Titrationskurve",
      align: "center",
      offsetX: 0,
      offsetY: 0,
      floating: false,
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

      animations: {
        enabled: false
      },

      toolbar: {
        show: false
      },

      background: "#ffffff"
    },

    responsive: [{
      breakpoint: 600,
      options: {
        chart: { height: 260 },
        title: { style: { fontSize: "15px" } }
      }
    }],

    series: [{
      name: "pH-Wert",
      data: []
    }],

    xaxis: {
      type: "numeric",

      title: {
        text: "Volumen (mL)",
        style: {
          color: "#000000",
          fontSize: "14px"
        }
      },

      min: 0,
      max: 25,
      tickAmount: 5,
      forceNiceScale: false,

      labels: {
        style: {
          colors: "#000000"
        }
      },

      axisBorder: {
        color: "#000000"
      },

      axisTicks: {
        color: "#000000"
      }
    },

    yaxis: {
      title: {
        text: "pH-Wert",
        offsetX: -25,
        offsetY: 20,

        style: {
          color: "#000000",
          fontSize: "14px"
        }
      },

      min: 0,
      max: 14,
      tickAmount: 7,

      labels: {
        style: {
          colors: "#000000"
        }
      }
    },

    stroke: {
      curve: "smooth",
      width: 2,
      colors: ["#950c14"]
    },

    markers: {
      size: 4,
      colors: ["#ff0000"],
      strokeColors: "#ffffff",
      strokeWidth: 1
    },

    grid: {
      borderColor: "#d0d0d0",
      strokeDashArray: 4
    },

    annotations: {
      xaxis: []
    },

    colors: ["#950c14"],

    // ❗ entfernen bzw. auf light setzen
    theme: {
      mode: "light"
    }
  };
  /*
    const options = {
      title: {
        text: "Titration von ...",
        align: "center",
        margin: 10,
        offsetX: 0,
        offsetY: 0,
        floating: false,
        style: {
          fontSize: "14px",
          fontWeight: "bold",
          fontFamily: undefined,
          color: "#263238"
        }
      },
      chart: {
        type: 'line',
        height: 350,
        animations: {
          enabled: false // Wichtig für flüssiges Live-Update
        },
        toolbar: { show: false },
        background: 'lightgray'
      },
      series: [{
        name: 'pH-Wert',
        data: []
      }],
      xaxis: {
        type: 'numeric',
        title: {
          text: 'Volumen (ml)',
          style: { color: 'blue', fontSize: '14px' }

        },
        min: 0,
        max: 25,
        tickAmount: 5,
        forceNiceScale: false,
        labels: { style: { colors: '#fff' } },
        axisBorder: { color: '#fff' },
        axisTicks: { color: '#fff' }
      },
      yaxis: {
        title: {
          text: 'pH-Wert',
          offsetX: -25,
          offsetY: 20,
          style: { color: 'blue', fontSize: '14px'}
        },
        min: 0,
        max: 14,
        tickAmount: 7,
        labels: { style: { colors: '#fff' }}
      },
      stroke: {
        curve: 'smooth',
        width: 2,
        colors: ['#950c14']
      },
      markers: {
        size: 4,
        colors: ['#ff0000'],
        strokeColors: '#fff',
        strokeWidth: 1
      },
      grid: {
        borderColor: 'rgba(255,255,255,0.3)',
        strokeDashArray: 4
      },
      annotations: {
        xaxis: []
      },
      colors: ['#950c14'],
      theme: { mode: 'dark' }
    };
  */
  chart = new ApexCharts(elements.chartContainer, options);
  chart.render();
  /*
  chart.updateOptions({
    title: {
      text: "Titrationskurve",
      style: {
        fontSize: "28px",
        fontWeight: "bold",
        fontFamily: "Helvetica, Arial, sans-serif",
        color: "red"}
    }
  });*/
}

// Initial setup
document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM bereit");
  initElements();
  initKnob();
  updatePanelScale();
  updateKnob();
  //updatePanelState();
  initChart(); //entweder hier oder bei powerOn aufrufen
  elements.lcd.classList.add("lcdDisplay_off");
  renderUI();
});


function resetTitrator() {
  running = false;
  dripStop();
  elements.btnRun.classList.remove("runActive");
  elements.btnHold.classList.remove("holdActive");
  volumeUsed = 0;
  pHakt = pHstart;
  buretteLevel = 260;
  volIndex = 1;
  titrationData.length = 0;
  curvePoints.length = 0;
  nextPointIndex = 0;
  updateDisplay();
}


//todo: einiges...

function resetTitrator2() {
  if (titratorState !== TS.HOLDING && titratorState !== TS.DONE) return;

  running = false;
  wiederholung = true;
  dripStop();
  //Protokoll
  versuchNr++;


  volumeUsed = 0;
  pHakt = pHstart;
  buretteLevel = buretteMax;

  setResultButton(false);

  // ---- Säure & Probenkonzentration bleiben erhalten! ----
  const probeSelect = document.getElementById("probeSelect");
  if (probeSelect) probeSelect.disabled = true;
  const acidName = document.getElementById("acidName");
  if (acidName && probe) acidName.textContent = probe.name;

  // ---- NaOH & Probenvolumen neu wählen ----
  const cTitrant = document.getElementById("cTitrant");
  if (cTitrant) { cTitrant.selectedIndex = 0; cTitrant.disabled = false; }
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

  if (elements.tube) {
    elements.tube.style.visibility = "hidden";
    elements.tube.style.animation = "none";
  }
  if (elements.drop) {
    elements.drop.style.visibility = "hidden";
    elements.drop.style.animation = "none";
    elements.drop.style.opacity = 0;
  }

  updateDigitalDisplay(0, pHstart);

  // ---- Chart & Tabelle leeren ----
  equivalencePoints = [];
  curvePoints = [];
  currentAnnotations = [];
  annotatedVolumes.clear();
  scheduledPoints = [];
  nextPointIndex = 0;
  if (chart) {
    chart.updateOptions({
      title: { text: "Titrationskurve" },
      annotations: { xaxis: [], yaxis: [], points: [] }
    });
    chart.updateSeries([{ name: "pH-Wert", data: [] }]);
  }

  buFilled = false;
  resetTable();
  experimentCreated = false;
  //createExperiment();   // no-op, bis NaOH/Volumen erneut gewählt wurden
  //addTableRow2(aufgabeNr-1,versuchNr,false);
  setUIState(TS.READY);
}

/*
function resetTitrator2() {

  // =========================
  // Titration stoppen
  // =========================

  running = false;
  dripStop();

  elements.btnRun.classList.remove("runActive");
  elements.btnHold.classList.remove("holdActive");

  //Panel Versuchsparameter enablen
  elements.paraPanel.classList.remove("paraPanel_off");
  elements.paraPanel.classList.add("paraPanel_on");


  // =========================
  // Titrationswerte zurücksetzen
  // =========================

  volumeUsed = 0;
  pHakt = pHstart;

  buretteLevel = buretteMax;

  endpointTriggered = false;
  visiblePoints = 0;
  volIndex = 1;

  flaskLevel = 0;


  // =========================
  // WICHTIG:
  // Probenkonzentration bleibt!
  // =========================

  // konzProbe NICHT verändern!


  // =========================
  // NaOH zurücksetzen
  // =========================

  const cTitrant = document.getElementById("cTitrant");

  if (cTitrant) {
    cTitrant.selectedIndex = 0;
    cTitrant.disabled = false;
  }

  konzTitrant = 0;


  // =========================
  // Probenvolumen zurücksetzen
  // =========================

  const vProbe = document.getElementById("vProbe");

  if (vProbe) {
    vProbe.selectedIndex = 0;
    vProbe.disabled = false;
  }

  volProb = 0;


  // =========================
  // Säure bleibt erhalten
  // =========================

  const probeSelect = document.getElementById("probeSelect");

  if (probeSelect) {
    probeSelect.disabled = true;
  }

  const acidName = document.getElementById("acidName");

  if (acidName && probe) {
    acidName.textContent = probe.name;
  }


  // =========================
  // cProbe bleibt intern erhalten
  // =========================

  const cProbe = document.getElementById("cProbe");

  if (cProbe) {
    cProbe.textContent = "?";
  }

  versuchNr++;

  const status = document.getElementById("experimentStatus");

  if (status) {
    status.textContent = "🟡 Versuch " + versuchNr;
  }

  // =========================
  // Burette zurück auf voll
  // =========================

  const clipRect = document.querySelector("#buretteClip rect");

  if (clipRect) {
    clipRect.setAttribute("y", "0");
    clipRect.setAttribute("height", buretteMax);
  }

  if (elements.buretteLiquid) {
    elements.buretteLiquid.style.visibility = "visible";
  }


  // =========================
  // Schlauch / Tropfen zurücksetzen
  // =========================

  if (elements.tube) {
    elements.tube.style.visibility = "hidden";
    elements.tube.style.animation = "none";
  }

  if (elements.drop) {
    elements.drop.style.visibility = "hidden";
  }


  // =========================
  // Digitalanzeige
  // =========================

  updateDigitalDisplay(0, pHstart);


  // =========================
  // CHART auf Anfang setzen
  // =========================

  curvePoints = [];
  equivalencePoints = [];
  currentAnnotations = [];
  //scheduledPoints = [];
  annotatedVolumes.clear();

  if (chart) {

    chart.updateOptions({
      title: {
        text: "Titrationskurve"
      },
      annotations: {
        xaxis: [],
        yaxis: [],
        points: [],
      }

    });

    chart.updateSeries([{
      name: "pH",
      data: []
    }]);
  }

  // =========================
  // Tabelle zurücksetzen
  // =========================
  buFilled = false;
  resetTable();
  createExperiment();
}
*/

/* ##############################*/
function powerOn() {
  deviceOn = true;
  //elements.btnPower.classList.add("powerActive");
  elements.lcd.classList.remove("lcdDisplay_off");
  elements.lcd.classList.add("lcdDisplay_on");
  elements.displayLine1.style.visibility = "visible";
  elements.displayLine2.style.visibility = "visible";
  elements.displayLine1.classList.add("startText");
  elements.displayLine2.classList.add("startText");
  elements.displayLine1.textContent = "JoboMeter 2000";
  elements.displayLine2.textContent = "Initializing...";
  //updatePanelState();
  setTimeout(() => {
    resetTitrator();
    updateDisplay();
    //drawScale();
    //initChart();        // NEU: ApexChart statt Canvas-Koordinatensystem
    //drawEquivalenceLines(); // NEU: Äquivalenzlinien als Annotations
  }, 2000);
  startAnimation();
  createExperiment();

  //Panel Versuchsparameter disablen
  elements.paraPanel.classList.remove("paraPanel_on");
  elements.paraPanel.classList.add("paraPanel_off");
  //document.getElementById("probeSelect").options.selectedIndex = 0;
}


function powerOff() {
  dripStop();
  running = false;
  deviceOn = false;
  wiederholung = false;
  versuchNr = 0;
  elements.btnPower.classList.remove("powerActive");
  elements.btnRun.classList.remove("runActive");
  elements.btnHold.classList.remove("holdActive");
  //elements.btnDrop.classList.remove("dropBlink");
  elements.displayLine1.classList.add("endText");
  elements.displayLine1.textContent = "Shutting down...";

  setTimeout(function () {
    elements.displayLine1.style.visibility = "hidden";
    elements.lcd.classList.remove("lcdDisplay_on");
    elements.lcd.classList.add("lcdDisplay_off");
  }, 3000);

  elements.displayLine2.style.visibility = "hidden";
  elements.progressBar.style.width = "0%";
  document.getElementById("container").innerHTML = "Säure-Base-Titrationen: ";
  emptyBurette();
  emptyFlask();

  // NEU: Chart zerstören und zurücksetzen
  /*
  if (chart) {
    chart.destroy();
    chart = null;
  }
  */

  //oder:
  chart.updateSeries([{
    data: []
  }]);

  chart.updateOptions({
    title: {
      text: "Titrationskurve"
    }
  });

  chart.clearAnnotations();

  resetTable();
  //updatePanelState();
  curvePoints.length = 0;
  nextPointIndex = 0;
  scheduledPoints = [];
  //12.09.
  alert("Alle Daten gehen verloren!");
  experimentCreated = false;
  //Panel Versuchsparameter enablen
  elements.paraPanel.classList.remove("paraPanel_off");
  elements.paraPanel.classList.add("paraPanel_on");
  resetExperimentPanel();
}

function togglePower() {
  if (titratorState === TS.OFF) {
    if (!paramsReady()) return;
    if (!setUIState(TS.FILLING)) return;
    powerOn();
    setTimeout(() => {
      if (titratorState === TS.FILLING) {
        updateDigitalDisplay(0, pHstart);
        setUIState(TS.READY);
      }
    }, 2000);
  } else {
    // Power ist während Titration/Hold/Ende erlaubt -> Warnung vor Datenverlust
    const titrationAktiv = (titratorState === TS.RUNNING || titratorState === TS.HOLDING);
    setUIState(TS.OFF);
    powerOff(titrationAktiv);
  }
}
/*
function togglePower() {
  if (deviceOn) {
    powerOff();
  } else {
    powerOn();
  }
}
*/

function updatePanelState() {
  if (deviceOn) {
    elements.btnHold.classList.add("disabledBtn");
    //elements.btnReset.classList.remove("touchBtn1");
    //elements.btnReset.classList.add("touchBtn1_off");
    //elements.btnReset.classList.add("btnReset_on");
    //erstmal gar nix machen
    //elements.btnReset.classList.remove("disabledBtn");
    //elements.btnDrop.classList.add("dropBlink");
  } else {
    setUIState(TS.OFF);
    /*
    elements.btnRun.classList.add("disabledBtn");
    elements.btnHold.classList.add("disabledBtn");
    elements.btnReset.classList.add("disabledBtn");
    */
  }
}

function pHcalc(vol) {
  return calculateTitrationPH(vol, konzProbe, volProb, konzTitrant, probe);
}

function drawPoints(volume, isEquivalence = false) {
  const pH = pHcalc(volume);

  curvePoints.push({
    volume: volume,
    pH: pH,
    isEquivalence: isEquivalence
  });

  curvePoints.sort((a, b) => a.volume - b.volume);

  // ── NEU: Annotation für diesen Äquivalenzpunkt vorbereiten ──
  if (isEquivalence && !annotatedVolumes.has(volume)) {
    annotatedVolumes.add(volume);
    currentAnnotations.push({
      x: volume,
      strokeDashArray: 6,
      borderColor: '#8919ca',
      label: {
        text: 'ÄP',
        style: {
          color: '#fff',
          background: '#8919ca',
          fontSize: '12px'
        }
      }
    });
  }

  const seriesData = curvePoints.map(pt => ({
    x: parseFloat(pt.volume.toFixed(2)),
    y: parseFloat(pt.pH.toFixed(2))
  }));

  const markerSizes = curvePoints.map(pt => pt.isEquivalence ? 6 : 4);
  const markerColors = curvePoints.map(pt => pt.isEquivalence ? '#8919ca' : '#ff0000');

  if (chart) {
    chart.updateOptions({
      series: [{
        name: 'pH-Wert',
        data: seriesData
      }],
      xaxis: {
        min: 0,
        max: 25,
        tickAmount: 5,
        forceNiceScale: false
      },
      markers: {
        size: markerSizes,
        colors: markerColors,
        strokeColors: '#fff',
        strokeWidth: 1
      },
      // ── NEU: Annotationen hier mitübergeben ──
      annotations: {
        xaxis: currentAnnotations
      }
    });
  }

  addTableRow(volume, pH, isEquivalence);
}



function addTableRow(volume, pH, isEquivalence = false) {
  const tbody = document.getElementById("tableBody");
  const tr = document.createElement("tr");

  if (isEquivalence) {
    tr.style.backgroundColor = "#f0e6ff";
    tr.style.fontWeight = "bold";
  }

  tr.innerHTML = `
    <td>${volume.toFixed(2)} ${isEquivalence ? ' (ÄP)' : ''}</td>
    <td>${pH.toFixed(2)}</td>
  `;
  tbody.appendChild(tr);
  const scrollBox = tbody.closest(".tableScrollY");
  if (scrollBox) scrollBox.scrollTop = scrollBox.scrollHeight;
}

//Versuchsprotokoll
function addTableRow2(aufgabe, versuch) {
  const tbody = document.getElementById("tableBody2");
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td>${aufgabe}</td>
    <td>${versuch}</td>
    <td>${probe.name}</td>
    <td>${konzTitrant.toFixed(2)}</td>
    <td>${volProb}</td>
  `;
  tbody.appendChild(tr);
}

function resetTable() {
  document.getElementById("tableBody").innerHTML = "";
}

function updateDisplay() {
  volumeUsed = buretteVolume - ((buretteLevel / maxHeight) * maxVolume);
  pHakt = pHcalc(volumeUsed);

  updateDigitalDisplay(volumeUsed, pHakt);
  // NEU: Bromthymolblau bei starken Säuren
  updateIndicatorColor(pHakt);

  while (nextPointIndex < scheduledPoints.length &&
  volumeUsed >= scheduledPoints[nextPointIndex].volume) {
    const pt = scheduledPoints[nextPointIndex];
    if(nextPointIndex!=0)
      drawPoints(pt.volume, pt.isEq);
    nextPointIndex++;
  }

  checkEndpoint(volumeUsed);
}

/*
function checkEndpoint(volume) {
  if (volume >= equivalencePoints[0]) {
    elements.svgflask.style.fill = "#ff4da6";
    elements.svgflask.style.opacity = "0.5";
    elements.ergebnis.style.visibility = "visible";
    createBurst();
  }
}
*/

function checkEndpoint(volume) {
  if (volume < equivalencePoints[0]) return;

  if (!INDICATORS[probe.indicator]) {
    elements.svgflask.style.fill = "#ff4da6";
    elements.svgflask.style.opacity = "0.5";
  }

  elements.ergebnis.style.visibility = "visible";
  setResultButton(true);

  if (!endpointTriggered) {
    endpointTriggered = true;
    createBurst();
  }
}


function createBurst() {
  for (let i = 0; i < 12; i++) {
    setTimeout(() => {
      createSwirl(false);
    }, i * 120);
  }
}

function calculatePH(volume) {
  return 3 + 8 / (1 + Math.exp(-(volume - equivalencePoint) * 2.2));
}

function updateBurette() {
  if (buretteLevel <= 0) {dripStop();
    setUIState(TS.DONE);}
  buretteLevel -= 3;
  elements.burClip.setAttribute("y", 260 - buretteLevel);
  if (buretteLevel >= 0)
    elements.burClip.setAttribute("height", buretteLevel);
  updateDisplay();
}

/*
function toggleDrip() {
  if (!deviceOn) return;
  if (dripInterval === null) {
    running = true;
    dripper();
  } else {
    running = false;
    dripStop();
  }
  updatePanel();
}
*/
function toggleDrip() {
  // Start nur aus READY/HOLDING; Pausieren auch aus RUNNING
  if (titratorState !== TS.READY &&
    titratorState !== TS.HOLDING &&
    titratorState !== TS.RUNNING) return;

  if (dripInterval === null) {
    if (!setUIState(TS.RUNNING)) return;   // ← wechselt Zustand UND ruft renderUI()
    running = true;
    dripper();
  } else {
    running = false;
    dripStop();
    setUIState(TS.HOLDING);                // ← holdActive wird über UI_RULES gesetzt
  }
}

function dripper() {
  elements.drop.style.visibility = "visible";   // NEU
  elements.tube.style.visibility = "visible";   // NEU (optional)
  elements.speedReadout.textContent = speedmlpers;
  dripInterval = setInterval(() => {
    elements.drop.style.animation = "none";
    elements.drop.style.opacity = 0;
    elements.drop.getBoundingClientRect();
    elements.drop.style.opacity = 1;
    elements.drop.style.animation = "dropFall 0.6s linear";
    updateBurette();
    createSwirl();
  }, dripSpeed);
}

function dripStop() {
  clearInterval(dripInterval);
  //elements.btnHold.classList.remove("holdActive");
  //document.getElementById("btnReset").classList.add("resetEnabled");
  dripInterval = null;
  elements.drop.style.animation = "none";
  elements.drop.style.opacity = 0;
}

function startAnimation() {
  if (!deviceOn) return;
  if (buFilled) return;
  //elements.btnRun.classList.remove("disabledBtn");
  //elements.btnHold.classList.remove("disabledBtn");
  //elements.btnDrop.classList.remove("dropBlink");
  //elements.btnDrop.classList.add("disabledBtn");

  const burette = elements.buretteLiquid;
  const tube = elements.tube;
  const clipRect = elements.burClip;
  let buretteLevel = 0;
  buFilled = true;
  resetTable();

  const length = tube.getTotalLength();
  tube.style.visibility = "visible";
  tube.style.strokeDasharray = length;
  tube.style.strokeDashoffset = length;
  tube.style.animation = "flow 1.5s linear forwards";

  function fillBurette() {
    buretteLevel += 2;
    clipRect.setAttribute("y", 260 - buretteLevel);
    clipRect.setAttribute("height", buretteLevel);

    burette.style.visibility = "visible";
    const fillInterval = setInterval(() => {
      if (buretteLevel >= 260) {
        clearInterval(fillInterval);
        return;
      }
      buretteLevel += 2;
      clipRect.setAttribute("y", 260 - buretteLevel);
      clipRect.setAttribute("height", buretteLevel);
    }, 20);
  }

  fillBurette();
}

function emptyBurette() {
  const burette = elements.buretteLiquid;
  const tube = elements.tube;
  const clipRect = elements.burClip;

  const emptyInterval = setInterval(() => {
    if (buretteLevel <= 2) {
      clearInterval(emptyInterval);
      burette.style.visibility = "hidden";
      tube.style.visibility = "hidden";
      buFilled = false;
      elements.svgflask.style.fill = "#b3d4fc";
      return;
    }
    buretteLevel -= 2;
    clipRect.setAttribute("y", 260 - buretteLevel);
    clipRect.setAttribute("height", buretteLevel);
  }, 20);
}


function createSwirl(isPink = false) {
  const swirl = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "ellipse"
  );

  swirl.setAttribute("cx", 70 + Math.random() * 20 - 10);
  swirl.setAttribute("cy", 50 + Math.random() * 10);

  if (volumeUsed >= 0.5 * equivalencePoint) {
    swirl.setAttribute("rx", 17 + Math.random() * 10);
    swirl.setAttribute("ry", 14 + Math.random() * 6);
  } else {
    swirl.setAttribute("rx", 6 + Math.random() * 10);
    swirl.setAttribute("ry", 3 + Math.random() * 6);
  }

  // Wirbelfarbe: Indikatorfarbe beim aktuellen pH, sonst rosa (Phenolphthalein)
  const swirlColor = INDICATORS[probe.indicator]
    ? indicatorColor(pHakt, probe.indicator)
    : "#ff4da6";

  /*
  const swirlColor = isStrongAcidTitration()
    ? "#00a650"
    : (isPink ? "#ff4da6" : "#4da6ff");
*/

  swirl.setAttribute("fill", swirlColor);
  swirl.setAttribute("opacity", "0.45");
  swirl.setAttribute("filter", "url(#blur)");
  swirl.classList.add("mix");

  //swirl.style.setProperty("fill", "#00ff00", "important");
  elements.mixLayer.appendChild(swirl);

  setTimeout(() => swirl.remove(), 1800);
}

/*
function createSwirl(isPink = false) {
  const mixLayer = elements.mixLayer;
  const swirl = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");

  swirl.setAttribute("cx", 70 + Math.random() * 20 - 10);
  swirl.setAttribute("cy", 50 + Math.random() * 10);
  if (volumeUsed >= 0.5 * equivalencePoint) {
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

  setTimeout(() => {
    swirl.remove();
  }, 1800);
}
*/

function drawScale() {
  const scale = elements.buretteScale;
  const steps = 25;
  const height = 235;
  const stepSize = height / steps;

  for (let i = 0; i <= steps; i++) {
    const y = i * stepSize + 10;
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", 25);
    line.setAttribute("x2", i % 5 === 0 ? 10 : 15);
    line.setAttribute("y1", y);
    line.setAttribute("y2", y);
    line.setAttribute("stroke", "black");
    line.setAttribute("stroke-width", "1");
    scale.appendChild(line);

    if (i % 5 === 0) {
      const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      text.setAttribute("x", 8);
      text.setAttribute("y", y + 3);
      text.setAttribute("font-size", "3");
      text.setAttribute("text-anchor", "end");
      text.textContent = i;
      scale.appendChild(text);
    }
  }
}

// Variablen
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
  elements.knobSVG.addEventListener("pointerdown", (e) => {
    dragging = true;
    if (elements.knobSVG.setPointerCapture) elements.knobSVG.setPointerCapture(e.pointerId);
    e.preventDefault();
  });

  document.addEventListener("pointerup", () => {
    dragging = false;
  });
  document.addEventListener("pointercancel", () => {
    dragging = false;
  });

  document.addEventListener("pointermove", (e) => {
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

/*
function updatePanel() {
  if (running) {
    elements.btnRun.classList.add("runActive");
    //elements.btnHold.classList.remove("holdActive");
    elements.btnReset.classList.remove("touchBtn1_off");
    elements.btnReset.classList.add("touchBtn1");
  } else {
    elements.btnRun.classList.remove("runActive");
    elements.btnHold.classList.add("holdActive");
  }
}
*/
function drawCable() {
  const wrap = document.querySelector(".labContainer");
  const svg  = document.querySelector(".svgWrap svg.vb");
  const plug = document.getElementById("cablePlug");
  const path = document.getElementById("cablePath");
  if (!wrap || !svg || !plug || !path) return;

  const m = svg.getScreenCTM();
  if (!m) return;
  const base = wrap.getBoundingClientRect();

  // Start: Ende des SVG-Kabels, umgerechnet in Bildschirmpixel
  const pt = svg.createSVGPoint();
  pt.x = 285; pt.y = 110;
  const s = pt.matrixTransform(m);
  const x1 = s.x - base.left;
  const y1 = s.y - base.top;

  // Ende: linke Mitte des Steckers am Steuergerät
  const r = plug.getBoundingClientRect();
  const x2 = r.left - base.left;
  if (r.left < svg.getBoundingClientRect().right) { path.setAttribute("d", ""); return; }
  const y2 = r.top + r.height / 2 - base.top;

  const k  = m.a;                                   // Skalierung viewBox → Pixel
  const c1x = x1 + 15 * k * 0.5, c1y = y1 - 30 * k * 0.5;   // Tangente wie das SVG-Kabel
  const c2x = x2 - Math.max((x2 - x1) * 0.5, 20), c2y = y2; // waagerecht in den Stecker

  path.setAttribute("d", `M${x1} ${y1} C${c1x} ${c1y} ${c2x} ${c2y} ${x2} ${y2}`);
  path.setAttribute("stroke-width", 3 * k);         // wie im SVG (stroke-width 3)
}

window.addEventListener("load", drawCable);
window.addEventListener("resize", drawCable);
if (window.ResizeObserver) {
  const ro = new ResizeObserver(drawCable);
  ro.observe(document.querySelector(".labContainer"));
  ro.observe(document.getElementById("digitalPanel"));
}
drawCable();


// ===== Schritt-Navigation (nur auf schmalen Bildschirmen sichtbar) =====
(function initStepNav() {
  const scene = document.getElementById("scene");
  const nav = document.getElementById("stepNav");
  if (!scene || !nav) return;
  const mq = window.matchMedia("(max-width: 799px)");

  function showStep(n, scrollTop = true) {
    scene.dataset.active = String(n);
    nav.querySelectorAll("button[data-step]").forEach(b => {
      if (b.dataset.step === String(n)) b.setAttribute("aria-current", "step");
      else b.removeAttribute("aria-current");
    });
    // Nach dem Einblenden Diagramm und Kabel neu berechnen lassen
    requestAnimationFrame(() => {
      window.dispatchEvent(new Event("resize"));
      drawCable();
    });
    if (scrollTop && mq.matches) window.scrollTo({ top: 0, behavior: "smooth" });
  }

  nav.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-step]");
    if (b) showStep(Number(b.dataset.step));
  });
  // Beim Wechsel zwischen Handy- und Desktop-Layout Zustand erhalten
  if (mq.addEventListener) mq.addEventListener("change", () => showStep(Number(scene.dataset.active) || 1, false));

  showStep(Number(scene.dataset.active) || 1, false);
  window.showStep = showStep;   // optional: z. B. showStep(3) aus anderem Code
})();
