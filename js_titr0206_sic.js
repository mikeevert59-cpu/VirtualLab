
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
const flaskFill = document.getElementById("flaskFill");

//let flaskLevel = 0;
const maxFlask = 45;

//const drip = setInterval(dripper,600);

const svgflask = document.getElementById("flaskLiquid");
const flask = document.getElementById("flaskClip");
//const burLevel = document.getElementById("buretteLiquid");
const burRect = document.getElementById("buretteClip");
const burClip = document.querySelector("#buretteClip rect");
const maxVolume = 25;
const maxHeight = 260;
const buretteVolume = 25;
let volumeUsed = 0;

const canvas = document.getElementById("curve");
const ctx = canvas.getContext("2d");
const lamp = document.getElementById("endpointLamp");
let titrationData = [];
const equivalencePoint = 10.0;//für gegebene Versuchsanordnung, 10 ml Verbrauch
let endpointTriggered = false;
let visiblePoints = 0;
let volIndex = 1;
/* aktueller pH-Wert*/
let konzTitrant = 1; // in mol/l
let konzProbe = 0.02; //in mol/l
//let volTitrant = 0; // zugegebene Menge Titrant
let volProb = 500; //Volumen Probe

let deviceOn = false;
const btnPower = document.getElementById("btnPower");
const btnRun   = document.getElementById("btnRun");
const btnHold  = document.getElementById("btnHold");
const btnDrop  = document.getElementById("btnDrop");
const displayLine1 = document.getElementById("displ1");
const displayLine2 = document.getElementById("displ2");
const lcd = document.getElementById("lcdDisplay");

let panelScale = 0.5;

const digitalPanel =
  document.getElementById("digitalPanel");

function updatePanelScale(){
  digitalPanel.style.transform =
    `scale(${panelScale})`;
}
updatePanelScale();

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

document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM bereit");
  drawScale();
  drawKoord();
  //lcd.classList.remove("lcdDisplay");
  //lcd.classList.add("lcdOff");
  //lcd.backgroundColor = "black";
  //console.log(lcd.className);
  updateKnob();
  updatePanelState();
  lcd.setAttribute("style", "background-color: #8ea88e;");
  //lcd.classList.remove("lcdDisplay");
  //lcd.classList.add("lcdOff");
  //console.log(lcd.className);
});

/*
window.addEventListener("load", function() {
  alert("SHIT");
  lcd.classList.remove("lcdDisplay");
  lcd.classList.add("lcdOff");
  console.log("Die Seite und alle Ressourcen wurden geladen.");
});
*/
//btnPower.addEventListener("click", togglePower);
//circlePower.addEventListener("click", togglePower);
/*
function powerOn(){
  if(!deviceOn) {
    deviceOn = true;
    updatePanelState();
    }
  else {
    deviceOn = false;
  updatePanelState()}
}
*/
function powerOn(){
  lcd.removeAttribute("style");
  //lcd.setAttribute("")
  lcd.setAttribute("id", "lcdDisplay");
  document.getElementById("displ1").style.visibility = "visible";
  document.getElementById("displ2").style.visibility = "visible";
  //document.getElementById("displ3").style.visibility = "hidden";
  displayLine2.innerText="Initializing...";
  displayLine1.textContent =
    "JoboMeter 2000";

  displayLine2.textContent =
    "Initializing...";

  setTimeout(() => {

    displayLine1.textContent =
      "READY";

    displayLine2.textContent =
      "pH = 1.75";

  },1500);
  deviceOn = true;
}

function togglePower(){
  if(!deviceOn) {
  deviceOn = !deviceOn;

 btnPower.classList.toggle(
    "powerActive",
    deviceOn
  );

  if(!running) powerOn();
  updatePanelState();
  }
  else{
    btnPower.classList.remove("powerActive");
    dripStop();

    btnRun.classList.remove("runActive");
    btnHold.classList.remove("holdActive");
    deviceOn = false;
    //document.getElementById("lcdDisplay").innerHTML = '<div id="displ1">0.00<span class="unit">mL</span></div>' +
//              '<div id="displ2">1.75<span class="unit">pH</span></div>';

    if(!running){
    document.getElementById("displ1").style.visibility = "hidden";
    document.getElementById("displ2").style.visibility = "hidden";
    }

    updatePanelState();
  }
}

function updatePanelState(){

  if(deviceOn){

    btnRun.classList.remove("disabledBtn");
    btnHold.classList.remove("disabledBtn");
    btnDrop.classList.remove("disabledBtn");
  } else {

    btnRun.classList.add("disabledBtn");
    btnHold.classList.add("disabledBtn");
    btnDrop.classList.add("disabledBtn");

   //deviceOn = true;

  }
}

//updatePanelState();

/*
//Power-Button
btnPower.addEventListener("click", () => {
  deviceOn = !deviceOn;
  btnPower.classList.toggle(
    "powerActive",
    deviceOn
  );
  updatePanelState();
  if(!deviceOn){
    dripStop();
    btnRun.classList.remove("runActive");
    btnHold.classList.remove("holdActive");
  }
});
*/
/*
//Run-Taste
btnRun.addEventListener("click", () => {

  if(!deviceOn) return;

  running = true;

  btnRun.classList.add("runActive");
  btnHold.classList.remove("holdActive");

  dripper();
});

//Hold-Taste
btnHold.addEventListener("click", () => {

  if(!deviceOn) return;

  dripStop();

  btnRun.classList.remove("runActive");
  btnHold.classList.add("holdActive");
});

//Tropfen-Taste
btnDrop.addEventListener("click", () => {

  if(!deviceOn) return;

  //titrationStep();
});
*/


//pH-Wert-Bestimmung
function pHcalc(vol) {
  let nTitr = volumeUsed * konzTitrant/1000;
  let nProb = (volumeUsed + volProb) *konzProbe/1000;

  if(volumeUsed === 0) return 1.75;
  else{
    //pH < 7
    if(nProb > nTitr)
    {
      return  -Math.log10(nProb - nTitr);
    }
    if(nProb === nTitr) return 7;
    //pH > 7
    if(nProb < nTitr){
      return 14 - (-Math.log10(nTitr - 0.01)); // 0.01 = Stoffmenge Titrant am Äquivalenzpunkt
    }
  }
}


//bei Start leeres Koordinatensystem darstellen
function drawKoord(){
  const canvas = document.getElementById("curve");
  const ctx = canvas.getContext("2d");

  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0,0,w,h);

  const padding = 50;

  const maxVolume = 25;
  const maxPH = 14;

  // Hintergrund
  ctx.fillStyle = "#64b5f6";
  ctx.fillRect(0,0,w,h);

  // Gitternetz
  ctx.strokeStyle = "#ddd";
  ctx.lineWidth = 1;

  for(let i=0;i<=25;i+=5){

    const x =
      padding +
      (i/maxVolume)*(w-2*padding);

    ctx.beginPath();
    ctx.moveTo(x,padding);
    ctx.lineTo(x,h-padding);
    ctx.stroke();
  }

  for(let i=0;i<=14;i+=2){

    const y =
      h-padding -
      (i/maxPH)*(h-2*padding);

    ctx.beginPath();
    ctx.moveTo(padding,y);
    ctx.lineTo(w-padding,y);
    ctx.stroke();
  }

  // Achsen
  ctx.strokeStyle = "black";
  ctx.lineWidth = 2;

  ctx.beginPath();

  ctx.moveTo(padding,padding);
  ctx.lineTo(padding,h-padding);
  ctx.lineTo(w-padding,h-padding);

  ctx.stroke();

  // Achsenbeschriftung
  ctx.fillStyle = "white";
  ctx.font = "12px Arial";

  // x
  for(let i=0;i<=25;i+=5){

    const x =
      padding +
      (i/maxVolume)*(w-2*padding);

    ctx.fillText(
      i,
      x-5,
      h-padding+20
    );
  }

  // y
  for(let i=0;i<=14;i+=2){

    const y =
      h-padding -
      (i/maxPH)*(h-2*padding);

    ctx.fillText(i,15,y+4);
  }

  // Titel
  ctx.font = "14px Arial";

  ctx.fillText(
    "Volumen (ml)",
    w/2 - 40,
    h-10
  );

  ctx.save();

  //ctx.translate(13,h/2);
  //ctx.rotate(-Math.PI/2);

  //ctx.fillText("pH-Wert",0,0);
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillText("pH-Wert", 17, 20);

  ctx.restore();
}

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

function drawPoints(idx) {
  const canvas = document.getElementById("curve");
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  const padding = 50;
  const maxVolume = 25;
  const maxPH = 14;

  // vorheriger Punkt
  const x1 =
    padding +
    (volumes[idx - 1] / maxVolume) * (w - 2 * padding);

  const y1 =
    h - padding -
    (phValues[idx - 1] / maxPH) * (h - 2 * padding);

  // aktueller Punkt
  const x2 =
    padding +
    (volumes[idx] / maxVolume) * (w - 2 * padding);

  const y2 =
    h - padding -
    (phValues[idx] / maxPH) * (h - 2 * padding);

  // Mittelpunkt
  const xc = (x1 + x2) / 2;
  const yc = (y1 + y2) / 2;

  // Punkt zeichnen
  ctx.fillStyle = "red";

  ctx.beginPath();
  ctx.arc(x2, y2, 3, 0, Math.PI * 2);
  ctx.fill();

//Punkte für Catmull-Rom vorbereiten
  const points = [];

  for(let i=0; i<volumes.length; i++){

    const x =
      padding +
      (volumes[i] / maxVolume) * (w - 2 * padding);

    const y =
      h - padding -
      (phValues[i] / maxPH) * (h - 2 * padding);
    points.push({x,y});
  }
  drawSpline(points.slice(0,idx));
  addTableRow(idx);
}

function drawSpline(points){

  ctx.beginPath();

  ctx.moveTo(points[0].x, points[0].y);

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

    ctx.bezierCurveTo(
      cp1x,
      cp1y,
      cp2x,
      cp2y,
      p2.x,
      p2.y
    );
  }

  ctx.strokeStyle = "#950c14";
  ctx.lineWidth = 3;
  ctx.stroke();
}

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

function resetTable(){
  document.getElementById("tableBody").innerHTML = "";
}

function updateDisplay() {
  volumeUsed = buretteVolume - ((buretteLevel / maxHeight) * maxVolume);
  let pHakt = pHcalc(volumeUsed);
  /*
    document.getElementById("volumeDisplay").innerText =
      "Verbrauch Maßlösung: "+volumeUsed.toFixed(2) + " ml";

  document.getElementById("digitalValue")
    .textContent = volumeUsed.toFixed(2);


  document.getElementById("lcdValue")
    .textContent = volumeUsed.toFixed(2);
*/

  // updateDigitalDisplay(volumeUsed);
  updateDigitalDisplay(
    volumeUsed, pHakt, volumeUsed
  );

//neu: bei jedem ml Punkt zeichnen
  if(volumeUsed >= volIndex && volumeUsed <= volIndex+1){
    drawPoints(volIndex);
    volIndex++;
  }

  const ph = calculatePH(volumeUsed);
  titrationData.push({
    volume: volumeUsed,
    ph: ph
  });
  //drawCurve(); (akt.)
  checkEndpoint(volumeUsed);
}

function checkEndpoint(volume) {

  if (volume >= equivalencePoint && !endpointTriggered) {

    endpointTriggered = true;

    //lamp.style.opacity = 1;
    //lamp.classList.add("blink");

    //flaskFill.setAttribute("fill", "#ff4da6");
    //neu: 11.05.
   svgflask.style.fill = "#ff4da6";

    svgflask.style.opacity = "0.5";
    document.getElementById("ergebnis").style.visibility = "visible";
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

  burClip.setAttribute("y", 260 - buretteLevel);
  if(buretteLevel >= 0)
    burClip.setAttribute("height", buretteLevel);
  updateDisplay();
}

function toggleDrip() {
  if (dripInterval === null) {
    //document.getElementById("toggle").innerText = "Stopp";
    //document.getElementById("footButton").innerText = "■";
    //btnRun.classList.add("runActive");
    running = true;
    if(!deviceOn) return;
      dripper();

  } else {
    //document.getElementById("toggle").innerText = "Titration fortsetzen";
    //document.getElementById("footButton").innerText = "▶";
    running = false;
    if(!deviceOn) return;
    dripStop();
  }
  updatePanel();
}
function dripper() {
// falls schon läuft → nichts tun
  //if (dripInterval !== null) return;
  //document.getElementById("speedReadout").textContent = dripSpeed;
  document.getElementById("speedReadout").textContent = speedmlpers;

  dripInterval = setInterval(() => {
// Tropfen
    drop.style.animation = "none";
    drop.style.opacity = 0;
    drop.getBoundingClientRect();
    drop.style.opacity = 1;
    drop.style.animation = "dropFall 0.6s linear";

// 👉 Kolben aktualisieren
    //updateFlask();
    updateBurette();
    createSwirl(); // 👈 neu
    //updateCurveLive(); (akt.)
  }, dripSpeed);
}

function dripStop(){
  clearInterval(dripInterval);
  btnHold.classList.remove("holdActive");
  dripInterval = null;
  drop.style.animation = "none";
  drop.style.opacity = 0;
  //running = false;
}

function startAnimation() {
  if(!deviceOn) return;
  //if (running) return;
  //running = false;
//dripping = false;
  if(buFilled) return;
  const burette = document.getElementById("buretteLiquid");
  const tube = document.getElementById("tube");
  const drop = document.getElementById("drop");
  const flask = document.getElementById("flaskLiquid");
  const clipRect = document.querySelector("#buretteClip rect");
  let level = 0;
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
    burette.style.visibility = "visible";
    const fillInterval = setInterval(() => {

      if (level >= 260) {
        clearInterval(fillInterval);
        return;
      }

      level += 2;

// 👉 Clip nach oben wachsen lassen
      clipRect.setAttribute("y", 260 - level);
      clipRect.setAttribute("height", level);

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
}

const mixLayer = document.getElementById("mixLayer");

function createSwirl(isPink = false) {

  const mixLayer = document.getElementById("mixLayer");

  const swirl = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "ellipse"
  );

  swirl.setAttribute("cx", 70 + Math.random() * 20 - 10);
  swirl.setAttribute("cy", 35 + Math.random() * 10);
  if(volumeUsed >= 0.5*equivalencePoint) {
    swirl.setAttribute("rx", 17 + Math.random() * 10);
    swirl.setAttribute("ry", 14 + Math.random() * 6);
    swirl.style.fill =
      "rgba(255,20,147,0.8)";
  }
  else{
    swirl.setAttribute("rx", 6 + Math.random() * 10);
    swirl.setAttribute("ry", 3 + Math.random() * 6);
  }
  swirl.setAttribute(
    "fill",
    isPink ? "#ff4da6" : "#4da6ff"
  );

  swirl.setAttribute("opacity", "0.45");

  swirl.setAttribute("filter", "url(#blur)");

  swirl.classList.add("mix");

  mixLayer.appendChild(swirl);

  setTimeout(() => {
    swirl.remove();
  }, 1800);
}

function drawScale() {

  const scale = document.getElementById("buretteScale");

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
/*
function updateDigitalDisplay(volume){

  // LCD-Wert
  document.getElementById("lcdDisplay").innerHTML =
    volume.toFixed(2) +
    '<span class="unit">mL</span>';

  // Fortschrittsbalken
  const maxVolume = 25;

  const percent =
    Math.min((volume / maxVolume) * 100, 100);

  document.getElementById("progressBar")
    .style.width = percent + "%";
}
*/

function updateDigitalDisplay(volume, ph){
  /*
  document.getElementById("lcdPH")
    .textContent =
    "pH = " + ph.toFixed(2);
  */
  document.getElementById("lcdDisplay").innerHTML =
    volume.toFixed(2) + '<span class="unit">mL</span>'+'<br>' + ph.toFixed(2) + '<span class="unit">pH</span>';;

  // Fortschrittsbalken
  const maxVolume = 25;

  const percent =
    Math.min((volume / maxVolume) * 100, 100);

  document.getElementById("progressBar")
    .style.width = percent + "%";
}

// Variablen
let knobAngle = 130; // Startwinkel
let dragging = false;
let dripSpeed = 0;
let speedmlpers = 0;
//let running = true; // Beispiel: Prozess läuft
//let dripInterval = null;


// Elemente holen
const knobSVG = document.getElementById("knobSVG");
const pointer = document.getElementById("pointer");
const speedReadout = document.getElementById("speedReadout");

// Funktion zum Aktualisieren des Knopfes
function updateKnob() {
  pointer.style.transform = `rotate(${knobAngle}deg)`;
  dripSpeed = Math.round(1500 - ((-knobAngle + 130) / 260) * 1400); //Anm.: knobangle * -1, um Anzeige umzudrehen
  speedmlpers = (0.29/dripSpeed*1000).toFixed(2) + "ml/s";
  //speedReadout.textContent = dripSpeed + " ms/drop";
  speedReadout.textContent = speedmlpers;

  if (running) {
    if (dripInterval) clearInterval(dripInterval);
    //dripInterval = setInterval(dripper, dripSpeed);
    dripper();
  }
}

// Maus gedrückt - Start Dragging
knobSVG.addEventListener("mousedown", (e) => {
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

  const rect = knobSVG.getBoundingClientRect();
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
function updatePanel() {

  if(running){
    btnRun.classList.add("runActive");
    btnHold.classList.remove("holdActive");
  } else {
    btnRun.classList.remove("runActive");
    btnHold.classList.add("holdActive");
  }
}
