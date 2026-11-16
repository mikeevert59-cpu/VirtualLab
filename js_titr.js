
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

  document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM bereit");
  drawScale();
});

  /*
  function updateDisplay() {

  volumeUsed = buretteVolume - ((buretteLevel / maxHeight) * maxVolume);

  document.getElementById("volumeDisplay").innerText =
  "Verbrauch Maßlösung: "+volumeUsed.toFixed(2) + " ml";

  if(volumeUsed >= 10) {
    //alert("Äquivalenzpunkt erreicht");
    svgflask.style.fill = "#ff4da6";
    svgflask.style.opacity = "0.5";
    //return;
  }
}
*/
  function updateCurveLive(){

    if(visiblePoints < volumes.length){
      visiblePoints++;
    }

    drawCurve();
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

    document.getElementById("volumeDisplay").innerText =
      "Verbrauch Maßlösung: "+volumeUsed.toFixed(2) + " ml";

    const ph = calculatePH(volumeUsed);

    titrationData.push({
      volume: volumeUsed,
      ph: ph
    });

    drawCurve();

    checkEndpoint(volumeUsed);
  }

  function checkEndpoint(volume) {

    if (volume >= equivalencePoint && !endpointTriggered) {

      endpointTriggered = true;

      lamp.style.opacity = 1;
      lamp.classList.add("blink");

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


  <!--neu-->
  function updateFlask() {

  if (flaskLevel >= maxFlask) return;

  flaskLevel += 1.2;

//flaskFill.setAttribute("y", 60 - flaskLevel);
//flaskFill.setAttribute("height", flaskLevel);


// Farbumschlag
//  if (flaskLevel > 50)
//  {
//  svgflask.style.fill = "#ff4da6";
//  svgflask.style.opacity = "0.5";//flaskFill.setAttribute("fill", "#ff4da6");
//}

}

  /*
  function updateFlask() {

  if (flaskLevel >= maxLevel) return;

  flaskLevel += 2; // Füllgeschwindigkeit

//flask.setAttribute("y", 1100 - flaskLevel);
//flask.setAttribute("height", flaskLevel);

// kleine Wellenbewegung triggern
  flask.style.animation = "liquidWave 0.3s ease";

  setTimeout(() => {
  flask.style.animation = "none";
}, 300);

// 🌈 Farbumschlag
  let ratio = flaskLevel / equivalence;

  if (ratio < 1) {
//alert (77 + ratio*150);
  flask.style.fill = `rgb(${77 + ratio*150}, ${166 - ratio*80}, ${255 - ratio*100}`;
//alert(`rgb(${77 + ratio*150}, 166 - ratio*80, 255 - ratio*100)`)
} else {
  flask.style.fill = "#ff4da6";
}
}
*/

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
    updateCurveLive();
}, 600);
}

  function dripStop(){
  clearInterval(dripInterval);
  dripInterval = null;

  drop.style.animation = "none";
  drop.style.opacity = 0;
}
  /*
  function stopdripLoop() {
  if(dripping) {

  clearInterval(dripping);
  dripping = false;
}

}

  /* -------------------------
  Tropfen Loop (realistisch)
  ------------------------- */
  /*
  function dripLoop() {
  dripping = true;
  setInterval(() => {

// Tropfen zurücksetzen
  drop.style.animation = "none";
  drop.style.opacity = 0;

// Reflow erzwingen (wichtig!)
  drop.getBoundingClientRect();

// Animation starten
  drop.style.opacity = 1;
  drop.style.animation = "dropFall 0.6s linear";

}, 600); // exakt gleiche Dauer wie Animation
}
  */
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

  /* -------------------------
  Rohr vorbereiten
  -------------------------*/
  const length = tube.getTotalLength();

  tube.style.visibility = "visible";   // 👈 WICHTIG
  tube.style.strokeDasharray = length;
  tube.style.strokeDashoffset = length;

// kleiner Trick für sauberen Start
//   tube.getBoundingClientRect();

  tube.style.animation = "flow 1.5s linear forwards";

  /* -------------------------
  Bürette füllen (smooth)
  ------------------------- */

  /*function fillBurette() {
  //burette.style.visibility = "visible";
  if (level >= 260) {
  startFlow();
  return;
  }

  level += 1.5;
  burette.setAttribute("y", 300 - level);
  burette.setAttribute("height", level);

  requestAnimationFrame(fillBurette);
  }*/
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
  /*
  function createSwirl() {

//const mixLayer = document.getElementById("mixLayer");

  const swirl = document.createElementNS(
  "http://www.w3.org/2000/svg",
  "ellipse"
  );

  swirl.setAttribute("cx", 70);
  swirl.setAttribute("cy", 40);
  swirl.setAttribute("rx", 8);
  swirl.setAttribute("ry", 4);

//swirl.setAttribute("fill", "red");
//swirl.setAttribute("opacity", "0.5");
  swirl.setAttribute("class", "mix");
  mixLayer.appendChild(swirl);
// nach Animation entfernen
  setTimeout(() => {
  swirl.remove();
}, 2000);
}
*/
  /*
  function createSwirl() {
  console.log(document.getElementById("mixLayer"));
//console.log(swirl);
  const swirl = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");

// Startposition unter Tropfen
  swirl.setAttribute("cx", 219 + Math.random()*10);
  swirl.setAttribute("cy", 420);
  swirl.setAttribute("rx", 8 + Math.random()*5);
  swirl.setAttribute("ry", 4 + Math.random()*3);
  swirl.classList.add("mix");
  swirl.setAttribute("class", "mix");

//mixLayer.appendChild(swirl);

// nach Animation entfernen
  setTimeout(() => {
  swirl.remove();
}, 2000);
}*/

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
