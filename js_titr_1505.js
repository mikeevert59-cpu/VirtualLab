
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

document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM bereit");
  drawScale();
  drawKoord();

});

function updateCurveLive(){
  if(visiblePoints < volumes.length){
    visiblePoints++;
  }
  drawCurve();
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

  // Linie
  ctx.strokeStyle = "#1565c0";
  ctx.lineWidth = 3;

  ctx.beginPath();
  ctx.moveTo(x1, y1);

  ctx.bezierCurveTo(
    x1 + 1, y1,
    x2 - 1, y2,
    x2, y2
  );


  //ctx.stroke();

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
  /*
  let wertepaar = document.getElementById("werte");
  let ml = volumes[idx];
  let ph =phValues[idx];
  wertepaar.innerHTML="<tr><td>"+ml+"</td><td>"+ph+"</td></tr><br>";
   */
  addTableRow(idx);
  /*
  const x =
    padding +
    (volumes[idx - 1] / maxVolume) * (w - 2 * padding);

  const y =
    h - padding -
    (phValues[idx - 1] / maxPH) * (h - 2 * padding);



  // aktuellen Punkt zeichnen
  ctx.fillStyle = "red";
  ctx.beginPath();
  ctx.ellipse(x, y, 2, 2, 0, 0, Math.PI * 2)
  ctx.fill();

  // Kurve zeichnen
  const xc =
    (volumes[idx - 1] + volumes[idx])/2;
  const yc =
    (phValues[idx - 1] + phValues[idx])/2;
    ctx.strokeStyle = "#1565c0";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x,y);

  ctx.quadraticCurveTo(
    volumes[idx],
    phValues[idx],
    xc,
    yc
  );
     ctx.stroke();
   */
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

function resetTable(){

  document.getElementById("tableBody").innerHTML = "";
}
function drawCurve(){
  const canvas = document.getElementById("curve");
  const ctx = canvas.getContext("2d");

  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0,0,w,h);

  const padding = 50;

  const maxVolume = 25;
  const maxPH = 14;

  // Hintergrund
  ctx.fillStyle = "white";
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

  // Punkte vorbereiten
  let points = [];


  for(let i=0;i<visiblePoints;i++){

    const x =
      padding +
      (volumes[i]/maxVolume)*(w-2*padding);

    const y =
      h-padding -
      (phValues[i]/maxPH)*(h-2*padding);

    points.push({x,y});
  }

  // Glatte Kurve
  if(points.length > 1){

    ctx.strokeStyle = "#1565c0";
    ctx.lineWidth = 3;

    ctx.beginPath();

    ctx.moveTo(points[0].x, points[0].y);

    for(let i=1;i<points.length-1;i++){

      const xc =
        (points[i].x + points[i+1].x)/2;

      const yc =
        (points[i].y + points[i+1].y)/2;

      ctx.quadraticCurveTo(
        points[i].x,
        points[i].y,
        xc,
        yc
      );
    }

    // letzter Abschnitt
    ctx.quadraticCurveTo(
      points[points.length-1].x,
      points[points.length-1].y,
      points[points.length-1].x,
      points[points.length-1].y
    );

    ctx.stroke();
  }

  // Punkte zeichnen
  ctx.fillStyle = "#d81b60";

  points.forEach(p => {

    ctx.beginPath();

    ctx.arc(
      p.x,
      p.y,
      4,
      0,
      Math.PI*2
    );

    ctx.fill();
  });

  // Achsenbeschriftung
  ctx.fillStyle = "black";
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

  ctx.translate(18,h/2);

  ctx.rotate(-Math.PI/2);

  ctx.fillText("pH-Wert",0,0);

  ctx.restore();
}

function updateDisplay() {

  volumeUsed = buretteVolume - ((buretteLevel / maxHeight) * maxVolume);
/*
  document.getElementById("volumeDisplay").innerText =
    "Verbrauch Maßlösung: "+volumeUsed.toFixed(2) + " ml";
*/
  document.getElementById("digitalValue")
    .textContent = volumeUsed.toFixed(2);

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

/*function drawCurve() {

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Achsen
  ctx.beginPath();
  ctx.moveTo(40, 20);
  ctx.lineTo(40, 220);
  ctx.lineTo(390, 220);
  ctx.stroke();

  // Beschriftung
  ctx.font = "12px Arial";
  ctx.fillText("pH", 10, 20);
  ctx.fillText("V [ml]", 360, 245);

  // y‑Skala
  for (let i = 0; i <= 14; i += 2) {

    const y = 220 - i * 14;

    ctx.fillText(i, 15, y + 4);

    ctx.beginPath();
    ctx.moveTo(35, y);
    ctx.lineTo(40, y);
    ctx.stroke();
  }
  // x‑Skala
  for (let i = 0; i <= 25; i += 5) {

    const x = 40 + i * 14;

    ctx.fillText(i, x - 5, 240);

    ctx.beginPath();
    ctx.moveTo(x, 220);
    ctx.lineTo(x, 225);
    ctx.stroke();
  }

  // Kurve
  if (titrationData.length < 2) return;

  ctx.beginPath();

  titrationData.forEach((point, index) => {

    const x = 40 + point.volume * 14;
    const y = 220 - point.ph * 14;

    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });

  ctx.lineWidth = 2;
  ctx.strokeStyle = "#4da6ff";
  ctx.stroke();

  ctx.strokeStyle = "black";
  ctx.lineWidth = 1;
}*/

function calculatePH(volume) {

  // einfache sigmoidartige Kurve
  return 3 + 8 / (1 + Math.exp(-(volume - equivalencePoint) * 2.2));
}

function updateBurette() {

  if (buretteLevel <= 0) return;

  buretteLevel -= 2;

  burClip.setAttribute("y", 260 - buretteLevel);
  burClip.setAttribute("height", buretteLevel);

  updateDisplay();
}






/*function drawCurve() {

  const canvas = document.getElementById("curve");
  const ctx = canvas.getContext("2d");

  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0,0,w,h);

  // Rand
  const padding = 40;

  // Achsen
  ctx.beginPath();

  ctx.moveTo(padding, padding);
  ctx.lineTo(padding, h-padding);

  ctx.lineTo(w-padding, h-padding);

  ctx.stroke();

  // Skalierung
  const maxVolume = 25;
  const maxPH = 14;

  // Punkte + Linie
  ctx.beginPath();

  for(let i=0; i<volumes.length; i++){

    const x =
      padding +
      (volumes[i] / maxVolume) *
      (w - 2*padding);

    const y =
      h - padding -
      (phValues[i] / maxPH) *
      (h - 2*padding);

    // Linie
    if(i === 0){
      ctx.moveTo(x,y);
    } else {
      ctx.lineTo(x,y);
    }
  }

  ctx.stroke();

  // Einzelpunkte
  for(let i=0; i<volumes.length; i++){

    const x =
      padding +
      (volumes[i] / maxVolume) *
      (w - 2*padding);

    const y =
      h - padding -
      (phValues[i] / maxPH) *
      (h - 2*padding);

    ctx.beginPath();

    ctx.arc(x, y, 4, 0, Math.PI*2);

    ctx.fill();
  }

  // x-Achse Beschriftung
  ctx.font = "12px Arial";

  for(let i=0; i<=25; i+=5){

    const x =
      padding +
      (i/maxVolume) *
      (w - 2*padding);

    ctx.fillText(
      i,
      x-5,
      h-padding+20
    );
  }

  // y-Achse Beschriftung
  for(let i=0; i<=14; i+=2){

    const y =
      h-padding -
      (i/maxPH) *
      (h - 2*padding);

    ctx.fillText(i, 8, y+4);
  }

  // Achsentitel
  ctx.font = "14px Arial";

  ctx.fillText(
    "Volumen (ml)",
    w/2 - 40,
    h-5
  );

  ctx.save();

  ctx.translate(15, h/2);

  ctx.rotate(-Math.PI/2);

  ctx.fillText("pH", 0,0);

  ctx.restore();
}*/


function toggleDrip() {
  if (dripInterval === null) {
    document.getElementById("toggle").innerText = "Stopp";
    dripper();
  } else {
    document.getElementById("toggle").innerText = "Titration fortsetzen";
    dripStop();
  }
}
function dripper() {

// falls schon läuft → nichts tun
  if (dripInterval !== null) return;

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
  }, 600);
}

function dripStop(){
  clearInterval(dripInterval);
  dripInterval = null;

  drop.style.animation = "none";
  drop.style.opacity = 0;
}

function startAnimation() {
  if (running) return;
  running = true;
//dripping = false;

  const burette = document.getElementById("buretteLiquid");
  const tube = document.getElementById("tube");
  const drop = document.getElementById("drop");
  const flask = document.getElementById("flaskLiquid");
  const clipRect = document.querySelector("#buretteClip rect");
  let level = 0;
  let flaskLevel = 0;

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

  swirl.setAttribute("rx", 6 + Math.random() * 10);
  swirl.setAttribute("ry", 3 + Math.random() * 6);

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
