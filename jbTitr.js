// Erweiterung: Titration von Säuren (Titrant NaOH) UND Basen (Titrant HCl)
// Benötigte HTML-IDs: probeSelect, acidName, titrantName, cTitrant, vProbe
const TITR_BUILD = "r8 – Power-Rückfrage vor dem Zustandswechsel";
console.info("Titration geladen:", TITR_BUILD);

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
  updateStatusUI();
  if (ready) {
    createExperiment();
    document.getElementById("container").innerHTML = "Säure-Base-Titrationen: " +
      /* "<small>" + konzProbe.toFixed(2) + " mol/l " + probe.name + " mit " + konzTitrant.toFixed(2) + " mol/l " + titrantFor(probe) + "</small>";*/
      "<small>" + probe.name + " mit " + konzTitrant.toFixed(2) + " mol/l " + titrantFor(probe) + "</small>";

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

  updateStatusUI();
}

// "Ergebnis prüfen" erst nach Erreichen des Äquivalenzpunkts freigeben
let resultChecked = false;   // pro Versuch nur einmal prüfen

function setResultButton(enabled) {
  if (enabled && resultChecked) return;          // nach der Prüfung nicht wieder freigeben
  const btn = document.getElementById("btnNewExperiment");
  if (btn) btn.classList.toggle("resultDisabled", !enabled);
  if (!enabled) {                                // Reset bzw. Ausschalten = neuer Versuch
    resultChecked = false;
    document.getElementById("ergText").disabled = false;
  }
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
    // Neue Aufgabe: Probenkonzentration zufällig wählen.
    // Wiederholung (Reset am Steuergerät): dieselbe Probe UND dieselbe Konzentration behalten.
    if (!wiederholung || !konzProbe) {
      const range = probe.cRange || possibleConcentrations;
      konzProbe = range[Math.floor(Math.random() * range.length)];
    }

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

// Symbole für die Ergebnis-Spalte der Protokolltabelle
const ICON_OK  = '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8.5l3.2 3.2L13 4.8"/></svg>';
const ICON_BAD = '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg>';

// Grünes Häkchen bzw. rotes Kreuz in der Zeile des aktuellen Versuchs (letzte Zeile)
/*
function markResult(ok) {
  const cell = document.querySelector("#tableBody2 tr:last-child td.resultCell");
  if (!cell) return;
  cell.innerHTML = '<span class="resultMark ' + (ok ? "ok" : "bad") + '" role="img" aria-label="' +
    (ok ? "richtig" : "falsch") + '">' + (ok ? ICON_OK : ICON_BAD) + '</span>';
}
 */
//neu
function markResult(ok) {
  const cell = document.querySelector("#tableBody2 tr:last-child td.resultCell");
  if (!cell) return;

  cell.innerHTML =
    '<span class="resultMark ' + (ok ? "ok" : "bad") +
    '" role="img" aria-label="' +
    (ok ? "richtig" : "falsch") + '">' +
    (ok ? "✓" : "✗") +
    '</span>';
}

function gesuchtKonz() {

  // Eingabe zuerst prüfen
  let eingabe = document.getElementById("ergText").value.trim();

  // Nur Zahlen mit optionalem Komma oder Punkt erlauben
  const zahlenFormat = /^\d+([.,]\d+)?$/;

  if (!zahlenFormat.test(eingabe)) {
    alert("Bitte eine gültige Zahl eingeben (Komma oder Punkt als Dezimaltrennzeichen).");
    return;
  }

  // Komma in Punkt umwandeln
  eingabe = eingabe.replace(",", ".");

  // Pro Versuch nur einmal prüfen
  if (resultChecked) return;
  resultChecked = true;

  const gesKonz = (konzTitrant * equivalencePoints[0]) /
    (volProb * probe.eqFactors[0]);

  document.getElementById("cProbe").innerHTML =
    "Konzentration: " + gesKonz.toFixed(2) + " mol/L";

  // Eingabe vergleichen
  const richtig = (Number(eingabe) === Number(gesKonz.toFixed(2)));

  markResult(richtig);

  // Meldung erst nach dem Zeichnen anzeigen
  requestAnimationFrame(() =>
    setTimeout(() => alert(richtig ? "Erfolgreich!" : "Falsch!"), 30)
  );

  document.getElementById("ergText").disabled = true;
  document.getElementById("ergText").value = "";

  const btn = document.getElementById("btnNewExperiment");
  if (btn) btn.classList.add("resultDisabled");
}

/*
function gesuchtKonz() {
  // Pro Versuch nur einmal prüfen (ein zweiter Klick mit leerem Feld würde sonst ein Kreuz setzen)
  if (resultChecked) return;
  resultChecked = true;

  const gesKonz = (konzTitrant * equivalencePoints[0]) / (volProb * probe.eqFactors[0]);
  let eingabe = document.getElementById("ergText").value.trim().replace(",", ".");
 // let eingabe = document.getElementById("ergText").value;

  document.getElementById("cProbe").innerHTML = "Konzentration: " + gesKonz.toFixed(2) + " mol/L";
  //Input auslesen
  const richtig = (eingabe == gesKonz.toFixed(2));
  markResult(richtig);                           // grünes Häkchen / rotes Kreuz am Zeilenende

  // Meldung erst nach dem Zeichnen anzeigen, sonst blockiert alert() die Anzeige des Symbols
  requestAnimationFrame(() => setTimeout(() => alert(richtig ? "Erfolgreich!" : "Falsch!"), 30));

  document.getElementById("ergText").disabled = true;
  document.getElementById("ergText").value = "";
  const btn = document.getElementById("btnNewExperiment");
  if (btn) btn.classList.add("resultDisabled");  // Button bis zum nächsten Versuch sperren
}
*/

// NEU: Äquivalenzpunkte als ApexCharts Annotations
function drawEquivalenceLines() {
  if (!chart || !equivalencePoints.length) return;

  const annotations = equivalencePoints.map(volume => ({
    x: volume,
    strokeDashArray: 6,
    borderColor: '#f59e0b',
    label: {
      text: 'ÄP',
      style: {
        color: '#451a03',
        background: '#f59e0b',
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
  const FONT = '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
  const options = {
    title: {
      text: "Titrationskurve",
      align: "center",
      offsetX: 0,
      offsetY: 0,
      floating: false,
      style: {
        fontSize: "16px",
        fontWeight: 600,
        fontFamily: FONT,
        color: "#111827"
      }
    },

    chart: {
      type: "area",
      height: 350,
      fontFamily: FONT,

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

    dataLabels: { enabled: false },

    xaxis: {
      type: "numeric",

      title: {
        text: "Volumen (mL)",
        style: {
          color: "#374151",
          fontSize: "13px",
          fontWeight: 600
        }
      },

      min: 0,
      max: 25,
      tickAmount: 5,
      forceNiceScale: false,

      labels: {
        style: {
          colors: "#6b7280"
        }
      },

      axisBorder: {
        color: "#d1d5db"
      },

      axisTicks: {
        color: "#d1d5db"
      }
    },

    yaxis: {
      title: {
        text: "pH",
        offsetX: 0,
        offsetY: 0,

        style: {
          color: "#374151",
          fontSize: "13px",
          fontWeight: 600
        }
      },

      min: PH_AXIS.min,
      max: PH_AXIS.max,
      tickAmount: PH_AXIS.tickAmount,

      labels: {
        style: {
          colors: "#6b7280"
        }
      }
    },

    stroke: {
      curve: "smooth",
      width: 2.5,
      colors: ["#6b21a8"]
    },

    // sanfter Verlauf unter der Kurve
    fill: {
      type: "gradient",
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.28,
        opacityTo: 0.02,
        stops: [0, 95, 100]
      }
    },

    markers: {
      size: 3,
      colors: ["#6b21a8"],
      strokeColors: "#ffffff",
      strokeWidth: 1
    },

    grid: {
      borderColor: "#eceef3",
      strokeDashArray: 4
    },

    tooltip: {
      x: { formatter: v => Number(v).toFixed(2) + " mL" },
      y: { formatter: v => Number(v).toFixed(2) }
    },

    annotations: {
      xaxis: []
    },

    colors: ["#6b21a8"],

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
  applyChartTheme();   // Hell-/Dunkelmodus auf das Diagramm anwenden
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
  updateStatusUI();

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
  updateStatusUI();

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
  // (Rückfrage "Alle Daten gehen verloren" steht jetzt in togglePower)
  deviceOn = false;
  elements.lcd.classList.remove("lcdDisplay_on");
  elements.lcd.classList.add("lcdDisplay_off");
  elements.displayLine1.style.visibility = "hidden";
  elements.displayLine2.style.visibility = "hidden";
  elements.displayLine1.classList.remove("startText");
  elements.displayLine2.classList.remove("startText");
  elements.displayLine1.textContent = "";
  elements.displayLine2.textContent = "";
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
  document.getElementById("indik").textContent = "-";
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
  //alert("Alle Daten gehen verloren!");
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
    // Warnung vor Datenverlust: ZUERST fragen, erst danach den Zustand ändern.
    // Bei "Abbrechen" bleibt alles unverändert, die Titration läuft weiter.
    const hatDaten = titratorState === TS.RUNNING || titratorState === TS.HOLDING ||
      titratorState === TS.DONE || versuchNr > 1;
    if (hatDaten && !confirm("Alle Daten gehen verloren! Möchten Sie fortfahren?")) return;
    setUIState(TS.OFF);
    powerOff();
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
      borderColor: '#f59e0b',
      label: {
        text: 'ÄP',
        style: {
          color: '#451a03',
          background: '#f59e0b',
          fontSize: '12px'
        }
      }
    });
  }

  const seriesData = curvePoints.map(pt => ({
    x: parseFloat(pt.volume.toFixed(2)),
    y: parseFloat(pt.pH.toFixed(2))
  }));

  // Äquivalenzpunkte hervorheben (ApexCharts: pro Datenpunkt über "discrete")
  const discreteMarkers = curvePoints
    .map((pt, i) => pt.isEquivalence
      ? { seriesIndex: 0, dataPointIndex: i, fillColor: '#f59e0b', strokeColor: chartMarkerStroke, size: 7 }
      : null)
    .filter(Boolean);

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
        size: 3,
        colors: [chartAccent],
        strokeColors: chartMarkerStroke,
        strokeWidth: 1,
        discrete: discreteMarkers
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
    tr.classList.add("eqRow");   // Farbe je nach Hell-/Dunkelmodus im CSS
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
    <td class="resultCell"></td>
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
  const wrap    = document.querySelector(".labContainer");
  const svg     = document.querySelector(".svgWrap svg.vb");
  const panel   = document.getElementById("digitalPanel");
  const plug    = document.getElementById("cablePlug");
  const path    = document.getElementById("cablePath");
  const overlay = document.getElementById("cableOverlay");
  if (!wrap || !svg || !panel || !plug || !path || !overlay) return;

  const m = svg.getScreenCTM();
  if (!m) return;                       // Bereich gerade ausgeblendet (z. B. anderer Schritt)

  const svgRect   = svg.getBoundingClientRect();
  const panelRect = panel.getBoundingClientRect();

  // Kabel und Stecker nur zeigen, wenn das Steuergerät RECHTS neben dem Aufbau steht
  const beside = panelRect.width > 0 && panelRect.left >= svgRect.right - 1;
  overlay.style.display  = beside ? "" : "none";
  plug.style.visibility  = beside ? "" : "hidden";
  if (!beside) { path.setAttribute("d", ""); return; }

  const base = wrap.getBoundingClientRect();
  // Skalierung der Bühne (fitLab): Bildschirmpixel → lokale Pixel des Overlays
  const sc = wrap.offsetWidth ? base.width / wrap.offsetWidth : 1;

  // Start: Ende des SVG-Kabels, umgerechnet in lokale Pixel
  const pt = svg.createSVGPoint();
  pt.x = 285; pt.y = 110;
  const s = pt.matrixTransform(m);
  const x1 = (s.x - base.left) / sc;
  const y1 = (s.y - base.top) / sc;

  // Ende: linke Mitte des Steckers am Steuergerät
  const r = plug.getBoundingClientRect();
  const x2 = (r.left - base.left) / sc;
  const y2 = (r.top + r.height / 2 - base.top) / sc;

  const k  = m.a / sc;                              // Skalierung viewBox → lokale Pixel
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
// Die Sichtbarkeit wird hier per JS gesetzt, damit sie auch bei altem/gecachtem CSS stimmt.
(function initStepNav() {
  const scene = document.getElementById("scene");
  const nav = document.getElementById("stepNav");
  if (!scene || !nav) return;
  const mq = window.matchMedia("(max-width: 799px)");
  const sections = Array.from(scene.children).filter(el => el.dataset && el.dataset.step);
  let current = Number(scene.dataset.active) || 1;

  function applyLayout() {
    const narrow = mq.matches;
    nav.style.display = narrow ? "flex" : "none";
    sections.forEach(sec => {
      sec.style.display = (narrow && sec.dataset.step !== String(current)) ? "none" : "";
    });
    scene.dataset.active = String(current);
    nav.querySelectorAll("button[data-step]").forEach(b => {
      if (b.dataset.step === String(current)) b.setAttribute("aria-current", "step");
      else b.removeAttribute("aria-current");
    });
    // Hinweis in der Konsole, falls die Stylesheet-Datei veraltet ist
    if (narrow && window.getComputedStyle(nav).position !== "fixed") {
      console.warn("titr_style_claude.css ist veraltet (Schritt-Navigation ohne Stil). Bitte die aktuelle Datei verwenden und mit Strg+F5 neu laden.");
    }
  }

  function showStep(n, scrollTop = true) {
    current = Number(n) || 1;
    applyLayout();
    // Nach dem Einblenden Diagramm und Kabel neu berechnen lassen
    requestAnimationFrame(() => {
      window.dispatchEvent(new Event("resize"));
      drawCable();
    });
    if (scrollTop && mq.matches) window.scrollTo({ top: 0, behavior: "smooth" });
  }

  nav.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-step]");
    if (b) showStep(b.dataset.step);
  });
  // Wechsel zwischen Handy- und Desktop-Layout (Drehen, Fenster ändern)
  if (mq.addEventListener) mq.addEventListener("change", () => { applyLayout(); drawCable(); });
  else if (mq.addListener) mq.addListener(() => { applyLayout(); drawCable(); });

  applyLayout();
  window.showStep = showStep;   // optional: z. B. showStep(3) aus anderem Code
})();


// ===== Labor als "Bühne": Aufbau und Steuergerät bleiben nebeneinander =====
// Die Bühne hat eine feste Entwurfsbreite (DESIGN_W) und wird proportional skaliert.
// Wird sie zu klein (unter MIN_SCALE), gilt wieder das gestapelte Layout.
const DESIGN_W  = 600;   // muss zur Breite in "#labViewport.isStage .labContainer" (CSS) passen
const MIN_SCALE = 0.6;   // darunter: gestapelt (Touch-Tasten wären sonst zu klein)
const MAX_SCALE = 1.3;   // auf großen Bildschirmen höchstens so weit vergrößern

(function initLabStage() {
  const vp  = document.getElementById("labViewport");
  const lab = vp && vp.querySelector(".labContainer");
  if (!vp || !lab) return;
  let lastW = -1, lastH = -1;

  function fitLab() {
    const w = vp.clientWidth;
    if (w === 0) return;                            // gerade ausgeblendet (anderer Schritt)

    const ratio = w / DESIGN_W;
    if (ratio < MIN_SCALE) {                        // gestapeltes Layout wie bisher
      vp.classList.remove("isStage");
      lab.style.removeProperty("--s");
      lab.style.marginLeft = "";
      vp.style.height = "";
    } else {
      const s = Math.min(MAX_SCALE, ratio);
      vp.classList.add("isStage");
      lab.style.setProperty("--s", s);
      lab.style.marginLeft = Math.max(0, (w - DESIGN_W * s) / 2) + "px";   // mittig, wenn Platz übrig
      vp.style.height = Math.ceil(lab.offsetHeight * s) + "px";           // transform ändert das Layout nicht
    }
    drawCable();
  }

  window.addEventListener("resize", fitLab);
  window.addEventListener("load", fitLab);
  if (window.ResizeObserver) {
    // nur auf echte Größenänderungen reagieren (verhindert Schleifen durch vp.style.height)
    new ResizeObserver(() => {
      if (vp.clientWidth !== lastW || lab.offsetHeight !== lastH) {
        lastW = vp.clientWidth; lastH = lab.offsetHeight;
        fitLab();
      }
    }).observe(vp);
    new ResizeObserver(() => {
      if (lab.offsetHeight !== lastH || vp.clientWidth !== lastW) {
        lastW = vp.clientWidth; lastH = lab.offsetHeight;
        fitLab();
      }
    }).observe(lab);
  }
  fitLab();
  window.fitLab = fitLab;   // optional: manuell neu berechnen
})();


// ===== Status-Pill und Fortschritts-Stepper =====
// Beides wird ausschließlich aus dem Gerätezustand (titratorState) abgeleitet.
function updateStatusUI() {
  const ready = paramsReady();
  const map = {};
  map[TS.OFF]     = ready ? ["ready", "Bereit zum Start"] : ["input", "Eingabe"];
  map[TS.FILLING] = ["busy", "Gerät startet"];
  map[TS.READY]   = ["ready", "Betriebsbereit"];
  map[TS.RUNNING] = ["run",  "Titration läuft"];
  map[TS.HOLDING] = ["hold", "Pausiert"];
  map[TS.DONE]    = ["done", "Endpunkt erreicht"];
  const entry = map[titratorState] || map[TS.OFF];

  const pill = document.getElementById("experimentStatus");
  if (pill) {
    pill.className = "statusPill is-" + entry[0];
    pill.textContent = (versuchNr > 1 ? "Versuch " + versuchNr + " · " : "") + entry[1];
  }

  // Stepper: 1 Parameter -> 2 Titration -> 3 Auswertung
  const stage = (titratorState === TS.OFF) ? 1 : (titratorState === TS.DONE ? 3 : 2);
  document.querySelectorAll("#progressSteps li").forEach(li => {
    const n = Number(li.dataset.p);
    li.classList.toggle("is-done", n < stage);
    li.classList.toggle("is-active", n === stage);
    if (n === stage) li.setAttribute("aria-current", "step");
    else li.removeAttribute("aria-current");
  });
}
updateStatusUI();


// ===== Hell-/Dunkelmodus =====
// Die Farben der Seite steuert das CSS über html[data-theme="dark"].
// Nur das ApexCharts-Diagramm muss per JS umgestellt werden.
let chartAccent = "#6b21a8";
let chartMarkerStroke = "#ffffff";
const PH_AXIS = { min: 0, max: 14, tickAmount: 7 };   // pH-Achse: feste Skala (Schrittweite 2)

function applyChartTheme() {
  const dark = document.documentElement.dataset.theme === "dark";
  chartAccent       = dark ? "#a78bfa" : "#6b21a8";
  chartMarkerStroke = dark ? "#171b2e" : "#ffffff";
  if (typeof chart === "undefined" || !chart) return;

  const label     = dark ? "#9ca3af" : "#6b7280";
  const axisTitle = dark ? "#d1d5db" : "#374151";
  const axisLine  = dark ? "#343a5a" : "#d1d5db";
  chart.updateOptions({
    chart:   { background: "transparent", foreColor: label },
    title:   { style: { color: dark ? "#f3f4f6" : "#111827" } },
    colors:  [chartAccent],
    stroke:  { colors: [chartAccent] },
    markers: { colors: [chartAccent], strokeColors: chartMarkerStroke },
    grid:    { borderColor: dark ? "#2a3050" : "#eceef3" },
    tooltip: { theme: dark ? "dark" : "light" },
    xaxis: {
      labels: { style: { colors: label } },
      title: { style: { color: axisTitle } },
      axisBorder: { color: axisLine },
      axisTicks: { color: axisLine }
    },
    // yaxis immer als Array UND mit fester Skala übergeben, sonst wird die Achse dynamisch
    yaxis: [{
      min: PH_AXIS.min,
      max: PH_AXIS.max,
      tickAmount: PH_AXIS.tickAmount,
      labels: { style: { colors: label } },
      title: { text: "pH", offsetX: 0, offsetY: 0, style: { color: axisTitle, fontSize: "13px", fontWeight: 600 } }
    }]
  });
}

(function initTheme() {
  const root = document.documentElement;
  const btn = document.getElementById("themeToggle");
  const KEY = "titrTheme";
  const mq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

  function setTheme(theme, persist) {
    root.dataset.theme = theme;
    if (persist) { try { localStorage.setItem(KEY, theme); } catch (e) { /* z. B. privater Modus */ } }
    if (btn) {
      btn.setAttribute("aria-pressed", String(theme === "dark"));
      btn.title = theme === "dark" ? "Zum hellen Modus wechseln" : "Zum dunklen Modus wechseln";
    }
    applyChartTheme();
  }

  if (btn) {
    btn.addEventListener("click", () => {
      setTheme(root.dataset.theme === "dark" ? "light" : "dark", true);
    });
  }
  // Systemeinstellung nur dann übernehmen, wenn nichts gespeichert wurde
  if (mq && mq.addEventListener) {
    mq.addEventListener("change", (e) => {
      let saved = null;
      try { saved = localStorage.getItem(KEY); } catch (err) { /* ignorieren */ }
      if (!saved) setTheme(e.matches ? "dark" : "light", false);
    });
  }
  setTheme(root.dataset.theme === "dark" ? "dark" : "light", false);   // Button/Chart-Farben angleichen
})();

function showErg(){
  const ready = paramsReady();
  if(ready){ alert(konzProbe.toFixed(2) + " mol/l " + probe.name)}
  else
    alert("Ätsch");
}
