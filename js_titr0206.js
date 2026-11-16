// Titration Simulation - Refactored for Efficiency

let buFilled = false;
let running = false;
let dripInterval = null;
let flaskLevel = 0;
const maxLevel = 180;
const EQUIVALENCE_POINT_ML = 10; // Fixed: was 20, now correct equivalence point in ml
let buretteLevel = 260; // full
const buretteMax = 260;
const flaskFill = document.getElementById("flaskFill");
const maxFlask = 45;
const svgflask = document.getElementById("flaskLiquid");
const flask = document.getElementById("flaskClip");
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
const equivalencePoint = 10.0; // for display purposes (matches EQUIVALENCE_POINT_ML)
let endpointTriggered = false;
let visiblePoints = 0;
let volIndex = 1;
const konzTitrant = 1; // in mol/l
const konzProbe = 0.02; // in mol/l
let volProb = 500; // Volume of probe in ml

let deviceOn = false;
const btnPower = document.getElementById("btnPower");
const btnRun = document.getElementById("btnRun");
const btnHold = document.getElementById("btnHold");
const btnDrop = document.getElementById("btnDrop");
const displayLine1 = document.getElementById("displ1");
const displayLine2 = document.getElementById("displ2");
const lcd = document.getElementById("lcdDisplay");

// Knob variables
let knobAngle = 130;
let dragging = false;
let dripSpeed = 0;
let speedmlpers = 0;

// Cache frequently used DOM elements for performance
const domElements = {
  buretteLiquid: document.getElementById("buretteLiquid"),
  tube: document.getElementById("tube"),
  drop: document.getElementById("drop"),
  mixLayer: document.getElementById("mixLayer"),
  knobSVG: document.getElementById("knobSVG"),
  pointer: document.getElementById("pointer"),
  speedReadout: document.getElementById("speedReadout")
};

// Initialize on DOM load
document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM ready");
  drawScale();
  drawKoord();
  updateKnob();
  updatePanelState();
  lcd.setAttribute("style", "background-color: #8ea88e;");
});

function powerOn() {
  lcd.removeAttribute("style");
  lcd.setAttribute("id", "lcdDisplay");
  displayLine1.style.visibility = "visible";
  displayLine2.style.visibility = "visible";
  displayLine1.textContent = "JoboMeter 2000";
  displayLine2.textContent = "Initializing...";

  setTimeout(() => {
    displayLine1.textContent = "READY";
    displayLine2.textContent = "pH = 1.75";
  }, 1500);

  deviceOn = true;
}

function togglePower() {
  if (!deviceOn) {
    deviceOn = !deviceOn;
    btnPower.classList.toggle("powerActive", deviceOn);
    powerOn();
    updatePanelState();
  } else {
    btnPower.classList.remove("powerActive");
    dripStop();
    btnRun.classList.remove("runActive");
    btnHold.classList.remove("holdActive");
    deviceOn = false;
    displayLine1.style.visibility = "hidden";
    displayLine2.style.visibility = "hidden";
    updatePanelState();
  }
}

function updatePanelState() {
  if (deviceOn) {
    btnRun.classList.remove("disabledBtn");
    btnHold.classList.remove("disabledBtn");
    btnDrop.classList.remove("disabledBtn");
  } else {
    btnRun.classList.add("disabledBtn");
    btnHold.classList.add("disabledBtn");
    btnDrop.classList.add("disabledBtn");
  }
}

function pHcalc(volume) {
  if (volume === 0) return 1.75;

  const nTitr = (volume * konzTitrant) / 1000; // moles of titrant added
  const nProbInitial = (volProb * konzProbe) / 1000; // initial moles of acid
  const nProbRemaining = nProbInitial - nTitr; // remaining acid moles
  const totalVolume = (volProb + volume) / 1000; // total volume in liters

  if (nProbRemaining > 0) {
    // Acid excess: pH = -log[H+]
    const hPlus = nProbRemaining / totalVolume;
    return -Math.log10(hPlus);
  } else if (nProbRemaining === 0) {
    // Equivalence point
    return 7;
  } else {
    // Base excess: pH = 14 + log[OH-]
    const ohMinus = (-nProbRemaining) / totalVolume;
    const pOH = -Math.log10(ohMinus);
    return 14 - pOH;
  }
}

function drawKoord() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const padding = 50;
  const maxVolume = 25;
  const maxPH = 14;

  // Background
  ctx.fillStyle = "#64b5f6";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Grid
  ctx.strokeStyle = "#ddd";
  ctx.lineWidth = 1;

  for (let i = 0; i <= 25; i += 5) {
    const x = padding + (i / maxVolume) * (canvas.width - 2 * padding);
    ctx.beginPath();
    ctx.moveTo(x, padding);
    ctx.lineTo(x, canvas.height - padding);
    ctx.stroke();
  }

  for (let i = 0; i <= 14; i += 2) {
    const y = canvas.height - padding - (i / maxPH) * (canvas.height - 2 * padding);
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(canvas.width - padding, y);
    ctx.stroke();
  }

  // Axes
  ctx.strokeStyle = "black";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(padding, padding);
  ctx.lineTo(padding, canvas.height - padding);
  ctx.lineTo(canvas.width - padding, canvas.height - padding);
  ctx.stroke();

  // Axis labels
  ctx.fillStyle = "white";
  ctx.font = "12px Arial";

  // X-axis
  for (let i = 0; i <= 25; i += 5) {
    const x = padding + (i / maxVolume) * (canvas.width - 2 * padding);
    ctx.fillText(i, x - 5, canvas.height - padding + 20);
  }

  // Y-axis
  for (let i = 0; i <= 14; i += 2) {
    const y = canvas.height - padding - (i / maxPH) * (canvas.height - 2 * padding);
    ctx.fillText(i, 15, y + 4);
  }

  // Title
  ctx.font = "14px Arial";
  ctx.fillText("Volumen (ml)", canvas.width / 2 - 40, canvas.height - 10);
  ctx.save();
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillText("pH-Wert", 17, 20);
  ctx.restore();
}

const volumes = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25];
const phValues = [1.75,1.80,1.86,1.92,2.00,2.10,2.23,2.40,2.71,7.00,11.29,11.59,11.77,11.89,11.99,12.07,12.13,12.19,12.24,12.28,12.32,12.36,12.40,12.43,12.46];

function drawPoints(idx) {
  const x1 = 50 + (volumes[idx - 1] / 25) * 320;
  const y1 = 210 - (phValues[idx - 1] / 14) * 160;
  const x2 = 50 + (volumes[idx] / 25) * 320;
  const y2 = 210 - (phValues[idx] / 14) * 160;

  ctx.fillStyle = "red";
  ctx.beginPath();
  ctx.arc(x2, y2, 3, 0, Math.PI * 2);
  ctx.fill();

  // Prepare points for Catmull-Rom spline
  const points = [];
  for (let i = 0; i < volumes.length; i++) {
    const x = 50 + (volumes[i] / 25) * 320;
    const y = 210 - (phValues[i] / 14) * 160;
    points.push({x, y});
  }

  drawSpline(points.slice(0, idx));
  addTableRow(idx);
}

function drawSpline(points) {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;

    // Control points
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
  }

  ctx.strokeStyle = "#950c14";
  ctx.lineWidth = 3;
  ctx.stroke();
}

function addTableRow(idx) {
  if (idx < volumes.length) {
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

function resetTable() {
  document.getElementById("tableBody").innerHTML = "";
}

function updateDisplay() {
  volumeUsed = buretteVolume - ((buretteLevel / maxHeight) * maxVolume);
  const pHakt = pHcalc(volumeUsed);

  // Update LCD display
  lcd.innerHTML =
    volumeUsed.toFixed(2) + '<span class="unit">mL</span><br>' +
    pHakt.toFixed(2) + '<span class="unit">pH</span>';

  // Update progress bar
  const percent = Math.min((volumeUsed / maxVolume) * 100, 100);
  document.getElementById("progressBar").style.width = percent + "%";

  // Draw new point if we've passed a whole ml mark
  if (volumeUsed >= volIndex && volumeUsed <= volIndex + 1) {
    drawPoints(volIndex);
    volIndex++;
  }

  // Store data for potential export
  titrationData.push({
    volume: volumeUsed,
    ph: pHakt
  });

  checkEndpoint(volumeUsed);
}

function checkEndpoint(volume) {
  if (volume >= equivalencePoint && !endpointTriggered) {
    endpointTriggered = true;
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

function updateBurette() {
  if (buretteLevel <= 0) {
    dripStop();
    return;
  }

  buretteLevel -= 3;
  burClip.setAttribute("y", 260 - buretteLevel);
  if (buretteLevel >= 0) {
    burClip.setAttribute("height", buretteLevel);
  }
  updateDisplay();
}

function toggleDrip() {
  if (dripInterval === null) {
    if (!deviceOn) return;
    running = true;
    dripper();
  } else {
    if (!deviceOn) return;
    running = false;
    dripStop();
  }
  updatePanel();
}

function dripper() {
  // Prevent multiple intervals
  if (dripInterval !== null) return;

  // Update speed readout
  domElements.speedReadout.textContent = speedmlpers;

  dripInterval = setInterval(() => {
    // Drop animation
    domElements.drop.style.animation = "none";
    domElements.drop.style.opacity = 0;
    domElements.drop.getBoundingClientRect(); // Force reflow
    domElements.drop.style.opacity = 1;
    domElements.drop.style.animation = "dropFall 0.6s linear";

    // Update flask level
    updateFlask();
    updateBurette();
    createSwirl();
  }, dripSpeed);
}

function dripStop() {
  clearInterval(dripInterval);
  dripInterval = null;
  domElements.drop.style.animation = "none";
  domElements.drop.style.opacity = 0;
}

function startAnimation() {
  if (!deviceOn) return;
  if (buFilled) return;

  buFilled = true;
  resetTable();

  // Prepare burette
  const burette = domElements.buretteLiquid;
  const tube = domElements.tube;
  const drop = domElements.drop;
  const clipRect = burClip;

  // Tube animation
  const length = tube.getTotalLength();
  tube.style.visibility = "visible";
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
      clipRect.setAttribute("y", 260 - level);
      clipRect.setAttribute("height", level);
    }, 20);
  }

  let level = 0;
  let flaskLevel = 0;

  function startFlow() {
    tube.style.animation = "flow 1.5s linear forwards";
  }

  fillBurette();
}

function createSwirl(isPink = false) {
  const swirl = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");

  swirl.setAttribute("cx", 70 + Math.random() * 20 - 10);
  swirl.setAttribute("cy", 35 + Math.random() * 10);

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

  domElements.mixLayer.appendChild(swirl);

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

function updateKnob() {
  domElements.pointer.style.transform = `rotate(${knobAngle}deg)`;
  dripSpeed = Math.round(1500 - ((-knobAngle + 130) / 260) * 1400);
  speedmlpers = (0.29 / dripSpeed * 1000).toFixed(2) + "ml/s";
  domElements.speedReadout.textContent = speedmlpers;

  if (running) {
    if (dripInterval) clearInterval(dripInterval);
    dripper();
  }
}

domElements.knobSVG.addEventListener("mousedown", (e) => {
  dragging = true;
  e.preventDefault();
});

document.addEventListener("mouseup", () => {
  dragging = false;
});

document.addEventListener("mousemove", (e) => {
  if (!dragging) return;

  const rect = domElements.knobSVG.getBoundingClientRect();
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

function updatePanel() {
  if (running) {
    btnRun.classList.add("runActive");
    btnHold.classList.remove("holdActive");
  } else {
    btnRun.classList.remove("runActive");
    btnHold.classList.add("holdActive");
  }
}

function updateFlask() {
  flaskLevel = Math.min(flaskLevel + 0.5, maxFlask);
  const percent = (flaskLevel / maxFlask) * 100;
  document.getElementById("flaskFill").style.height = percent + "%";
}