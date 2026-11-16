// Cached DOM elements
let elements = {};
let eqPointDrawn = false;
let eqLineDrawn = false;

// State variables
let buFilled = false;
let running = false;
let dripInterval = null; // wichtig: global speichern
let flaskLevel = 0;
let maxLevel = 180;       // maximale Füllhöhe
let equivalence = 20;    // Äquivalenzpunkt (anpassen!)
 //let burettelevel = 5;
/*Test*/
let buretteLevel = 260; // voll
const buretteMax = 260;

let maxFlask = 45;

//const drip = setInterval(dripper,600);

const maxVolume = 25;
const maxHeight = 260;
const buretteVolume = 25;
let volumeUsed = 0;
let pHakt = 1.75;

let titrationData = [];
let equivalencePoint = 0;//für gegebene Versuchsanordnung, 10 ml Verbrauch
let endpointTriggered = false;
let visiblePoints = 0;
let volIndex = 1;
/* aktueller pH-Wert*/
let konzTitrant = 1; // in mol/l
let konzProbe = 0.02; //in mol/l
//let volTitrant = 0; // zugegebene Menge Titrant
let volProb = 500; //Volumen Probe

let deviceOn = false;
let panelScale = 0.5;
const possibleConcentrations = [
  0.02,
  0.05,
  0.08,
  0.10,
  0.12,
  0.15,
  0.20
];
let experimentCreated = false;
let nextPoint = 0;


//Erweiterung
const acidData = {

  HCl: {
    name: "Salzsäure",
    pKa: [-Infinity]
  },

  H2SO4: {
    name: "Schwefelsäure",
    pKa: [-Infinity, 1.99]
  },

  H3PO4: {
    name: "Phosphorsäure",
    pKa: [2.15, 7.20, 12.35]
  },

  citricAcid: {
    name: "Zitronensäure",
    pKa: [3.13, 4.76, 6.40]
  }

};
let acidType = "H2SO4";
const acid = acidData[acidType];

let equivalencePoints = [];
/*
  calculateEquivalencePoints(
    konzProbe,
    volProb,
    konzTitrant,
    acid.pKa.length
  );
*/

console.log(equivalencePoints);
document.getElementById("acidSelect").addEventListener("change", function () {
  acidType = this.value;
  document.getElementById("acidName").textContent = acidData[acidType].name;
  console.log("Säure:", acidType);
  console.log("Daten:", acidData[acidType]);
});

document.getElementById("cNaOH")
  .addEventListener("change", checkExperimentReady);
document.getElementById("vProbe")
  .addEventListener("change", checkExperimentReady);

function checkExperimentReady(){
  const cNaOH =
    document.getElementById("cNaOH").value;
  const vProbe =
    document.getElementById("vProbe").value;
  const ready =
    cNaOH !== "Auswählen" &&
    vProbe !== "Auswählen";
/*
  elements.btnDrop.classList.toggle(
    "disabledBtn",
    !ready
  );

  elements.btnRun.classList.toggle(
    "disabledBtn",
    !ready
  );
*/
  document.getElementById("experimentStatus").textContent =
    ready ?
      "🟢 Bereit" :
      "🟡 Parameter eingeben";
  if(ready) {elements.btnPower.classList.remove("disabledBtn");
  elements.btnPower.classList.add("touchBtn");}
}
function newExperiment() {
  experimentCreated = false;
  createExperiment();
  resetTitrator();
}

function createExperiment(){
  //if (experimentCreated) return;
  if(experimentCreated===false){
  konzProbe =
    possibleConcentrations[
      Math.floor(
        Math.random()*
        possibleConcentrations.length
      )
      ];}

 alert("Konzentration Probe: " + konzProbe);
  konzTitrant =
    Number(
      document
        .getElementById("cNaOH")
        .value
    );
  alert("Konzentration Titrant: " + konzTitrant + "mol/l");
  volProb = Number(document.getElementById("vProbe").value);
  alert("Probe Volumen: " + volProb + "ml");
  equivalencePoint =
    konzProbe *
    volProb /
    konzTitrant;
  alert("Equivalence Point: " + equivalencePoint + "ml");
  equivalencePoints = calculateEquivalencePoints(konzProbe,
    volProb,
    konzTitrant,
    acid.pKa.length);
  alert(acidData[acidType].name);
  alert("Equivalence Points: " + equivalencePoints.join("-"));
  experimentCreated = true;
}

/**
 * Initialize cached DOM references
 */
function initElements() {
  elements.flaskFill = document.getElementById("flaskFill");
  elements.svgflask = document.getElementById("flaskLiquid");
  elements.flask = document.getElementById("flaskClip");
  elements.burRect = document.getElementById("buretteClip");
  elements.burClip = document.querySelector("#buretteClip rect");
  elements.canvas = document.getElementById("curve");
  elements.ctx = elements.canvas.getContext("2d");
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
}
function drawEquivalenceLines() {

  const ctx = elements.ctx;
  const canvas = elements.canvas;

  const padding = 50;
  const maxPH = 14;
/*
  const maxVolume =
    Math.max(...equivalencePoints) * 1.25;
*/
  equivalencePoints.forEach(volume => {

    const x =
      padding +
      volume / maxVolume *
      (canvas.width - 2 * padding);

    ctx.setLineDash([6, 4]);

    ctx.beginPath();
    ctx.moveTo(x, padding);
    ctx.lineTo(
      x,
      canvas.height - padding
    );

    ctx.strokeStyle = "#8919ca";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.setLineDash([]);
  });
}

function calculateEquivalencePoints(
  cAcid,
  vAcid,
  cBase,
  protonCount
) {

  const nAcid =
    cAcid * vAcid / 1000;

  const points = [];

  for (let i = 1; i <= protonCount; i++) {

    const nBase =
      i * nAcid;

    const volume =
      nBase / cBase * 1000;

    points.push(volume);
  }

  return points;
}

function acidDistribution(pH, pKa) {

  const H =
    Math.pow(10, -pH);

  const Ka =
    pKa.map(pk =>
      pk === -Infinity
        ? 1e100
        : Math.pow(10, -pk)
    );

  const n = Ka.length;

  const terms = [];

  terms[0] =
    Math.pow(H, n);

  for (let i = 1; i <= n; i++) {

    let term = 1;

    for (let j = 0; j < i; j++) {
      term *= Ka[j];
    }

    term *=
      Math.pow(H, n - i);

    terms[i] = term;
  }

  const denominator =
    terms.reduce(
      (sum, value) => sum + value,
      0
    );

  return terms.map(term =>
    term / denominator
  );
}

function calculatePolyproticPH(
  volume,
  cAcid,
  vAcid,
  cBase,
  pKa
) {

  // Volumina in Liter
  const VAcid = vAcid / 1000;
  const VBase = volume / 1000;

  const Vtotal = VAcid + VBase;

  // Stoffmenge Säure
  const nAcid = cAcid * VAcid;

  // Stoffmenge NaOH
  const nBase = cBase * VBase;

  // Gesamtkonzentration der Säure
  const Cacid = nAcid / Vtotal;

  // Na+ Konzentration
  const CNa = nBase / Vtotal;


  // Ka-Werte
  const Ka = pKa.map(pk =>
    pk === -Infinity
      ? Infinity
      : Math.pow(10, -pk)
  );


  // Ladungsbilanz
  function chargeBalance(pH) {

    const H = Math.pow(10, -pH);
    const OH = Math.pow(10, pH - 14);

    const alpha =
      acidDistribution(pH, pKa);

    // mittlere negative Ladung
    let negativeCharge = 0;

    for (let i = 0; i < alpha.length; i++) {
      negativeCharge += i * alpha[i];
    }

    return (
      H +
      CNa -
      OH -
      Cacid * negativeCharge
    );
  }


  // -------------------------
  // pH numerisch bestimmen
  // -------------------------

  let low = 0;
  let high = 14;

  for (let i = 0; i < 100; i++) {

    const mid = (low + high) / 2;

    const fLow = chargeBalance(low);
    const fMid = chargeBalance(mid);

    if (fLow * fMid <= 0) {
      high = mid;
    } else {
      low = mid;
    }
  }

  return (low + high) / 2;
}

console.log(
  "pH-Test:",
  pHcalc(0)
);

console.log(
  "pH 5 ml:",
  pHcalc(5)
);

console.log(
  "pH 10 ml:",
  pHcalc(10)
);

/**
 * Update digital display (volume and pH)
 * @param {number} volume - current volume in mL
 * @param {number} ph - current pH value
 */
function updateDigitalDisplay(volume, ph) {
  elements.displayLine1.innerHTML = volume.toFixed(2) + '<span class="unit">mL</span>';
  elements.displayLine2.innerHTML = ph.toFixed(2) + '<span class="unit">pH</span>';

  // Progress bar
  const percent = Math.min((volume / maxVolume) * 100, 100);
  elements.progressBar.style.width = percent + "%";
}

/**
 * Update panel scale based on panelScale variable
 */
function updatePanelScale() {
  elements.digitalPanel.style.transform = `scale(${panelScale})`;
}

digitalPanel.addEventListener("wheel", (e) => {

  e.preventDefault();

  if(e.deltaY < 0){
    panelScale += 0.05;      // größer
  }else{
    panelScale -= 0.05;      // kleiner
  }

  panelScale =
    Math.min(
      2.0,
      Math.max(0.3, panelScale)
    );

  updatePanelScale();

});


// Initial setup
document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM bereit");
  initElements();
  initKnob();
  updatePanelScale();
  updateKnob();
  updatePanelState();
  elements.lcd.classList.add("lcdDisplay_off");
  elements.btnPower.classList.add("disabledBtn");// new

});

function resetTitrator() {
  // Status
  running = false;
  dripStop();
  // LEDs
  elements.btnRun.classList.remove("runActive");
  elements.btnHold.classList.remove("holdActive");
  volumeUsed = 0;
  pHakt = 1.75;
  buretteLevel = 260;
  volIndex = 1;
  // Kurvendaten löschen
  titrationData.length = 0;
  updateDisplay();
}

function powerOn() {
  deviceOn = true;
  elements.btnPower.classList.add("powerActive");
  elements.lcd.classList.remove("lcdDisplay_off");
  elements.lcd.classList.add("lcdDisplay_on");
  elements.displayLine1.style.visibility = "visible";
  elements.displayLine2.style.visibility = "visible";
  elements.displayLine1.textContent = "JoboMeter 2000";
  elements.displayLine2.textContent = "Initializing...";
  updatePanelState();

  setTimeout(() => {
    resetTitrator();   // setzt Volumen und pH zurück
    updateDisplay();   // zeigt 0.00 mL / 1.75 pH
    drawScale();
    drawKoord();
  }, 2000);
  createExperiment();

}

function powerOff() {
  dripStop();
  running = false;
  deviceOn = false;
  elements.btnPower.classList.remove("powerActive");
  elements.btnRun.classList.remove("runActive");
  elements.btnHold.classList.remove("holdActive");
  elements.btnDrop.classList.remove("dropBlink");
  //elements.displayLine1.style.visibility = "hidden";
  elements.displayLine1.textContent = "Shutting down...";
  setTimeout(function() {
    elements.displayLine1.style.visibility = "hidden";
    elements.lcd.classList.remove("lcdDisplay_on");
    elements.lcd.classList.add("lcdDisplay_off");
    //elements.displayLine1.style.display = "none";
  }, 3000);
  elements.displayLine2.style.visibility = "hidden";

  elements.progressBar.style.width = "0%";
  emptyBurette();
  elements.ctx.clearRect(0, 0, elements.canvas.width, elements.canvas.height);
  //drawKoord();
  resetTable();
  updatePanelState();
  nextPoint = 0;
  curvePoints.length = 0;
  eqPointDrawn = false;
  eqLineDrawn = false;
}

function togglePower() {
  if (deviceOn) {
    powerOff();
  } else {
    powerOn();
  }
}

function updatePanelState() {
  if (deviceOn) {
    //elements.btnRun.classList.remove("disabledBtn");
    //elements.btnHold.classList.remove("disabledBtn");
    elements.btnDrop.classList.remove("disabledBtn");
    elements.btnDrop.classList.add("dropBlink");
  } else {
    elements.btnRun.classList.add("disabledBtn");
    elements.btnHold.classList.add("disabledBtn");
    elements.btnDrop.classList.add("disabledBtn");
    //deviceOn = true;
  }
}

function pHcalc(vol) {

  const acid =
    acidData[acidType];
    //acidData[acidType];

  return calculatePolyproticPH(
    vol,
    konzProbe,
    volProb,
    konzTitrant,
    acid.pKa
  );
}

/*
function pHcalc(vol) {

  // Stoffmenge HCl
  const nProb =
    konzProbe * volProb / 1000;

  // Stoffmenge NaOH
  const nTitr =
    konzTitrant * vol / 1000;

  // Gesamtvolumen in Liter
  const vGes =
    (volProb + vol) / 1000;

  // Äquivalenzpunkt
  if (Math.abs(nProb - nTitr) < 1e-12) {
    return 7;
  }

  // Vor Äquivalenzpunkt:
  // H+ ist im Überschuss
  if (nProb > nTitr) {

    const nH =
      nProb - nTitr;

    const cH =
      nH / vGes;

    return -Math.log10(cH);
  }

  // Nach Äquivalenzpunkt:
  // OH- ist im Überschuss
  else {
    const nOH =
      nTitr - nProb;

    const cOH =
      nOH / vGes;

    const pOH =
      -Math.log10(cOH);

    return 14 - pOH;
  }}
*/

//pH-Wert-Bestimmung
/*
function pHcalc(vol) {



  //neu
  const nProbe = konzProbe * volProb / 1000;
  const nNaOH  = konzTitrant * vol / 1000;

  const cH =
    (nProbe - nNaOH) /
    ((volProb + vol)/1000);
  const pH =
    -Math.log10(cH);

  const cOH =
    (nNaOH - nProbe) /
    ((volProb + vol)/1000);

  const pOH =
    -Math.log10(cOH);
  //return 14-pOH;
  if(volumeUsed === 0) return 1.00;
  else{
    //pH < 7
    if(equivalencePoint > volumeUsed){
      return  pH;
    }
    if(equivalencePoint === volumeUsed) return 7;
    //pH > 7
    if(equivalencePoint < volumeUsed){
      return 14-pOH;
    }
//alt
  let nTitr = volumeUsed * konzTitrant/1000;
  let nProb = (volumeUsed + volProb) *konzProbe/1000;
  let nEq = konzTitrant/1000 *equivalencePoint;
  if(volumeUsed === 0) return 1.75;
  else{
    //pH < 7
    if(nProb > nTitr){
      return  -Math.log10(nProb - nTitr);
    }
    if(nProb === nTitr) return 7;
    //pH > 7
    if(nProb < nTitr){
      return 14 - (-Math.log10(nTitr - nEq)); // 0.01 = Stoffmenge Titrant am Äquivalenzpunkt
    }
}*/

//bei Start leeres Koordinatensystem darstellen
function drawKoord(){
  const w = elements.canvas.width;
  const h = elements.canvas.height;

  elements.ctx.clearRect(0,0,w,h);

  const padding = 50;
  const maxVolume = 25;
  const maxPH = 14;

  // Hintergrund
  elements.ctx.fillStyle = "#64b5f6";
  elements.ctx.fillRect(0,0,w,h);

  // Gitternetz
  elements.ctx.strokeStyle = "#ddd";
  elements.ctx.lineWidth = 1;

  for(let i=0;i<=25;i+=5){
    const x = padding + (i/maxVolume)*(w-2*padding);
    elements.ctx.beginPath();
    elements.ctx.moveTo(x,padding);
    elements.ctx.lineTo(x,h-padding);
    elements.ctx.stroke();
  }

  for(let i=0;i<=14;i+=2){
    const y = h-padding - (i/maxPH)*(h-2*padding);
    elements.ctx.beginPath();
    elements.ctx.moveTo(padding,y);
    elements.ctx.lineTo(w-padding,y);
    elements.ctx.stroke();
  }

  // Achsen
  elements.ctx.strokeStyle = "black";
  elements.ctx.lineWidth = 2;

  elements.ctx.beginPath();
  elements.ctx.moveTo(padding,padding);
  elements.ctx.lineTo(padding,h-padding);
  elements.ctx.lineTo(w-padding,h-padding);
  elements.ctx.stroke();

  // Achsenbeschriftung
  elements.ctx.fillStyle = "white";
  elements.ctx.font = "12px Arial";

  // x
  for(let i=0;i<=25;i+=5){
    const x = padding + (i/maxVolume)*(w-2*padding);
    elements.ctx.fillText(i, x-5, h-padding+20);
  }

  // y
  for(let i=0;i<=14;i+=2){
    const y = h-padding - (i/maxPH)*(h-2*padding);
    elements.ctx.fillText(i,15,y+4);
  }

  // Titel
  elements.ctx.font = "14px Arial";
  elements.ctx.fillText("Volumen (ml)", w/2 - 40, h-10);

  elements.ctx.save();
  elements.ctx.textBaseline = 'top';
  elements.ctx.textAlign = 'left';
  elements.ctx.fillText("pH-Wert", 17, 20);
  elements.ctx.restore();
}

/*
const volumes = [
  1,2,3,4,5,6,7,8,9,10,
  11,12,13,14,15,16,17,18,19,20,
  21,22,23,24,25
];

const phValues = [
  1.75,1.80,1.86,1.92,2.00,
  2.10,2.23,2.40,2.71,7.00,
  11.29,11.59,11.77,11.89,11.99,
  12.07,12.13,12.19,12.24,12.28,
  12.32,12.36,12.40,12.43,12.46
];
*/
const ph =
  pHcalc(volumeUsed);

let curvePoints = [];

function drawPoints(volume) {

  const pH = pHcalc(volume);

  curvePoints.push({
    volume: volume,
    pH: pH
  });

  const w = elements.canvas.width;
  const h = elements.canvas.height;

  const padding = 50;
  const maxPH = 14;

  const x =
    padding +
    volume / maxVolume *
    (w - 2 * padding);

  const y =
    h - padding -
    pH / maxPH *
    (h - 2 * padding);

  // Messpunkt
  elements.ctx.beginPath();
  elements.ctx.arc(x, y, 2, 0, Math.PI * 2);
  elements.ctx.fillStyle = "red";
  elements.ctx.fill();

  drawSpline();

  // gestrichelte Linie
  if (!eqLineDrawn && volume >= equivalencePoint) {

    const x =
      padding +
      equivalencePoint / maxVolume *
      (w - 2 * padding);

    elements.ctx.setLineDash([6, 4]);

    elements.ctx.beginPath();
    elements.ctx.moveTo(x, padding);
    elements.ctx.lineTo(x, h - padding);

    elements.ctx.strokeStyle = "#950c14";
    elements.ctx.lineWidth = 2;
    elements.ctx.stroke();

    elements.ctx.setLineDash([]);

    eqLineDrawn = true;
  }

  addTableRow(volume, pH);
}
/*
function drawPoints(volume){
  const pH = pHcalc(volume);
  curvePoints.push({
    volume: volume,
    pH: pH
  });

  const w = elements.canvas.width;
  const h = elements.canvas.height;

  const padding = 50;
  const maxPH = 14;

  // später dynamisch berechnen
  //const maxVolume = endPoint * 1.2;

  const x =
    padding +
    volume / maxVolume *
    (w - 2 * padding);

  const y =
    h - padding -
    pH / maxPH *
    (h - 2 * padding);

  // Punkt zeichnen
  elements.ctx.beginPath();
  elements.ctx.arc(x, y, 2, 0, Math.PI * 2);
  elements.ctx.fillStyle = "red";
  elements.ctx.fill();
  drawSpline();

  //gestrichelte Linie
  if(volumeUsed === equivalencePoint)
  {
    elements.ctx.setLineDash([6, 4]);
    elements.ctx.beginPath();
    elements.ctx.moveTo(x, padding);
    elements.ctx.lineTo(x, h - padding);
    elements.ctx.stroke();
    elements.ctx.setLineDash([]);
  }
  addTableRow(volume, pH);
}
 */
/*
function drawPoints(idx) {
  const w = elements.canvas.width;
  const h = elements.canvas.height;
  const padding = 50;
  const maxVolume = 25;
  const maxPH = 14;

  // vorheriger Punkt
  const x1 = padding + (volumes[idx - 1] / maxVolume) * (w - 2 * padding);
  const y1 = h - padding - (phValues[idx - 1] / maxPH) * (h - 2 * padding);

  // aktueller Punkt
  const x2 = padding + (volumes[idx] / maxVolume) * (w - 2 * padding);
  const y2 = h - padding - (phValues[idx] / maxPH) * (h - 2 * padding);

  // Mittelpunkt
  const xc = (x1 + x2) / 2;
  const yc = (y1 + y2) / 2;

  // Punkt zeichnen
  elements.ctx.fillStyle = "red";
  elements.ctx.beginPath();
  elements.ctx.arc(x2, y2, 3, 0, Math.PI * 2);
  elements.ctx.fill();

  //Punkte für Catmull-Rom vorbereiten
  const points = [];

  for(let i=0; i<volumes.length; i++){
    const x = padding + (volumes[i] / maxVolume) * (w - 2 * padding);
    const y = h - padding - (phValues[i] / maxPH) * (h - 2 * padding);
    points.push({x,y});
  }
  drawSpline(points.slice(0,idx));
  addTableRow(idx);
}
*/
/*
function drawSpline(points){
  elements.ctx.beginPath();
  elements.ctx.moveTo(points[0].x, points[0].y);

  for(let i = 0; i < points.length - 1; i++){
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;

    // Kontrollpunkte
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    elements.ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
  }

  elements.ctx.strokeStyle = "#950c14";
  elements.ctx.lineWidth = 3;
  elements.ctx.stroke();
}
*/
function drawSpline(){

  if(curvePoints.length < 2)
    return;

  const w = elements.canvas.width;
  const h = elements.canvas.height;

  const padding = 50;
  const maxPH = 14;
  //const maxVolume = endPoint * 1.2;

  const points = [];

  for(const pt of curvePoints){

    points.push({

      x:
        padding +
        pt.volume /
        maxVolume *
        (w-2*padding),

      y:
        h-padding-
        pt.pH/maxPH*
        (h-2*padding)

    });

  }

  elements.ctx.beginPath();
  elements.ctx.moveTo(points[0].x, points[0].y);

  for(let i=0;i<points.length-1;i++){

    const p0=points[i-1]||points[i];
    const p1=points[i];
    const p2=points[i+1];
    const p3=points[i+2]||p2;

    const cp1x =
      p1.x +
      (p2.x-p0.x)/6;

    const cp1y =
      p1.y +
      (p2.y-p0.y)/6;

    const cp2x =
      p2.x -
      (p3.x-p1.x)/6;

    const cp2y =
      p2.y -
      (p3.y-p1.y)/6;

    elements.ctx.bezierCurveTo(
      cp1x,
      cp1y,
      cp2x,
      cp2y,
      p2.x,
      p2.y
    );
  }

  elements.ctx.strokeStyle="#950c14";
  elements.ctx.lineWidth=2;
  elements.ctx.stroke();
}

function addTableRow(volume,pH){

  const tbody =
    document.getElementById("tableBody");

  const tr =
    document.createElement("tr");

  tr.innerHTML = `
        <td>${volume.toFixed(2)}</td>
        <td>${pH.toFixed(2)}</td>
    `;

  tbody.appendChild(tr);
}
/*
function addTableRow(idx){
  let i = volumes.length;
  if (idx < i) {
    const tbody = document.getElementById("tableBody");
    const tr = document.createElement("tr");
    const tdVolume = document.createElement("td");
    tdVolume.textContent = volumes[idx].toFixed(2);
    const tdPH = document.createElement("td");
    tdPH.textContent = phValues[idx].toFixed(2);
    tr.appendChild(tdVolume);
    tr.appendChild(tdPH);
    tbody.appendChild(tr);
  }
}
*/
function resetTable(){
  document.getElementById("tableBody").innerHTML = "";
}

function updateDisplay() {
  volumeUsed = buretteVolume - ((buretteLevel / maxHeight) * maxVolume);
  pHakt = pHcalc(volumeUsed);

  // updateDigitalDisplay(volumeUsed);
  updateDigitalDisplay(volumeUsed, pHakt);
  if(volumeUsed >= nextPoint) {
    if (!eqPointDrawn &&
      volumeUsed >= equivalencePoint) {

      drawPoints(equivalencePoint);

      eqPointDrawn = true;
    }
    else drawPoints(volumeUsed);
    nextPoint += 1.0;
  }
  //neu: bei jedem ml Punkt zeichnen
  /*
  if(volumeUsed >= volIndex && volumeUsed <= volIndex+1){
    drawPoints(volIndex);
    volIndex++;
  }
*/

  const ph = calculatePH(volumeUsed);
  titrationData.push({
    volume: volumeUsed,
    ph: ph
  });
  //drawCurve(); (akt.)
  checkEndpoint(volumeUsed);
}

function checkEndpoint(volume) {
  //if (volume >= equivalencePoint && !endpointTriggered) {
    if (volume >= equivalencePoint) {
    //endpointTriggered = true;
    //elements.lamp.style.opacity = 1;
    //elements.lamp.classList.add("blink");
    //elements.flaskFill.setAttribute("fill", "#ff4da6");
    //neu: 11.05.
    elements.svgflask.style.fill = "#ff4da6";
    elements.svgflask.style.opacity = "0.5";
    //elements.ergebnis.style.visibility = "visible";
    createBurst();
  }
}

function createBurst() {
  for (let i = 0; i < 12; i++) {
    setTimeout(() => {
      createSwirl(true);
    }, i * 120);
  }
}

function calculatePH(volume) {
  // einfache sigmoidartige Kurve
  return 3 + 8 / (1 + Math.exp(-(volume - equivalencePoint) * 2.2));
}

function updateBurette() {
  if (buretteLevel <= 0) dripStop();

  buretteLevel -= 3;

  elements.burClip.setAttribute("y", 260 - buretteLevel);
  if(buretteLevel >= 0)
    elements.burClip.setAttribute("height", buretteLevel);
  updateDisplay();
}

function toggleDrip(){
  if(!deviceOn) return;

  if(dripInterval === null){
    running = true;
    dripper();
  }else{
    running = false;
    dripStop();
  }

  updatePanel();
}

function dripper() {
  // falls schon läuft → nichts tun
  //if (dripInterval !== null) return;
  //document.getElementById("speedReadout").textContent = dripSpeed;
  elements.speedReadout.textContent = speedmlpers;

  dripInterval = setInterval(() => {
    // Tropfen
    elements.drop.style.animation = "none";
    elements.drop.style.opacity = 0;
    elements.drop.getBoundingClientRect();
    elements.drop.style.opacity = 1;
    elements.drop.style.animation = "dropFall 0.6s linear";

    // 👉 Kolben aktualisieren
    //updateFlask();
    updateBurette();
    createSwirl(); // 👈 neu
    //updateCurveLive(); (akt.)
  }, dripSpeed);
}

function dripStop(){
  clearInterval(dripInterval);
  elements.btnHold.classList.remove("holdActive");
  dripInterval = null;
  elements.drop.style.animation = "none";
  elements.drop.style.opacity = 0;
  //running = false;
}

function startAnimation() {
  if(!deviceOn) return;
  //if (running) return;
  //running = false;
  //dripping = false;
  if(buFilled) return;
  elements.btnRun.classList.remove("disabledBtn");
  elements.btnHold.classList.remove("disabledBtn");
  elements.btnDrop.classList.remove("dropBlink");
  elements.btnDrop.classList.add("disabledBtn");

  const burette = elements.buretteLiquid;
  const tube = elements.tube;
  const drop = elements.drop;
  const flask = elements.svgflask;
  const clipRect = elements.burClip;
  //let level = 0;
  let buretteLevel = 0;
  //let buFilled = false;
  let flaskLevel = 0;
  buFilled = true;
  /*Wertetabelle löschen*/
  resetTable();

  /* -------------------------
  Rohr vorbereiten
  -------------------------*/
  const length = tube.getTotalLength();

  tube.style.visibility = "visible";   // 👈 WICHTIG
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

      // 👉 Clip nach oben wachsen lassen
      clipRect.setAttribute("y", 260 - buretteLevel);
      clipRect.setAttribute("height", buretteLevel);
    }, 20);
  }

  /* -------------------------
  Fluss starten
  ------------------------- */
  function startFlow() {
    tube.style.animation = "flow 1.5s linear forwards";
    //dripLoop();
    //fillFlask();
  }
  fillBurette();
  drawEquivalenceLines(); //testweise
}

function emptyBurette(){
  const burette = elements.buretteLiquid;
  const tube = elements.tube;
  const clipRect = elements.burClip;

  const emptyInterval = setInterval(() => {
    if(buretteLevel <= 2){
      clearInterval(emptyInterval);
      burette.style.visibility = "hidden";
      tube.style.visibility = "hidden";
      buFilled = false;
      elements.svgflask.style.fill = "#b3d4fc";
      return;
    }
    buretteLevel -= 2;
    //console.log("B-Level: "+buretteLevel);
    clipRect.setAttribute("y",260-buretteLevel);
    clipRect.setAttribute("height",buretteLevel);
  },20);
}

function createSwirl(isPink = false) {
  const mixLayer = elements.mixLayer;

  const swirl = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");

  swirl.setAttribute("cx", 70 + Math.random() * 20 - 10);
  swirl.setAttribute("cy", 35 + Math.random() * 10);
  if(volumeUsed >= 0.5*equivalencePoint) {
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

function drawScale() {
  const scale = elements.buretteScale;

  const steps = 25;
  const height = 235;
  const stepSize = height / steps;

  for (let i = 0; i <= steps; i++) {
    const y = i * stepSize+10;

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

      text.setAttribute("x", 0);
      text.setAttribute("y", y + 3);
      text.setAttribute("font-size", "3");
      text.setAttribute("x", 8);
      text.setAttribute("text-anchor", "end");

      text.textContent = i;

      scale.appendChild(text);
    }
  }
}

// Variablen
let knobAngle = 130; // Startwinkel
let dragging = false;
let dripSpeed = 0;
let speedmlpers = 0;

// Funktion zum Aktualisieren des Knopfes
function updateKnob() {
  elements.pointer.style.transform = `rotate(${knobAngle}deg)`;
  dripSpeed = Math.round(1500 - ((-knobAngle + 130) / 260) * 1400); //Anm.: knobangle * -1, um Anzeige umzudrehen
  speedmlpers = (0.29/dripSpeed*1000).toFixed(2) + "ml/s";
  //speedReadout.textContent = dripSpeed + " ms/drop";
  elements.speedReadout.textContent = speedmlpers;
  if (running) {
    if (dripInterval) clearInterval(dripInterval);
    //dripInterval = setInterval(dripper, dripSpeed);
    dripper();
  }
}

function initKnob() {
// Maus gedrückt - Start Dragging
  elements.knobSVG.addEventListener("mousedown", (e) => {
    dragging = true;
    e.preventDefault(); // Verhindert unerwünschte Textauswahl
  });

// Maus loslassen - Stop Dragging
  document.addEventListener("mouseup", () => {
    dragging = false;
  });

// Maus bewegen - Aktualisiere Winkel nur beim Ziehen
  document.addEventListener("mousemove", (e) => {
    if (!dragging) return;

    const rect = elements.knobSVG.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    const dx = e.clientX - cx;
    const dy = e.clientY - cy;

    // Winkel berechnen, 0° oben, positiv im Uhrzeigersinn
    let angle = Math.atan2(dy, dx) * 180 / Math.PI + 90;

    // Winkel anpassen in -130° bis 130°
    if (angle > 180) angle -= 360; // Werte in Bereich -180..180 bringen

    angle = Math.max(-130, Math.min(130, angle));

    knobAngle = angle;
    //console.log("knobangle" + knobAngle);
    updateKnob();
  });
}

function updatePanel() {
  if(running){
    elements.btnRun.classList.add("runActive");
    elements.btnHold.classList.remove("holdActive");
  } else {
    elements.btnRun.classList.remove("runActive");
    elements.btnHold.classList.add("holdActive");
  }
}
