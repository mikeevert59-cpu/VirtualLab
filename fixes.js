// Section 2 (globale Variablen):
let fillInterval = null;
let emptyInterval = null;
let powerCycle = 0;   // Generation-Counter gegen veraltete Timeouts

// Section 11, startAnimation():
function startAnimation() {
  if (!deviceOn) return;
  clearInterval(emptyInterval);          // (2) Drain sofort stoppen
  if (fillInterval) clearInterval(fillInterval);

  const clipRect = elements.burClip;
  let fillLevel = buretteLevel;          // (3) vom ECHTEN Stand starten
  if (fillLevel >= buretteMax) { buFilled = true; return; }
  buFilled = true;
  // ... tube-Animation wie gehabt ...

  fillInterval = setInterval(() => {
    if (fillLevel >= buretteMax) { clearInterval(fillInterval); fillInterval = null; return; }
    fillLevel += 2;
    clipRect.setAttribute("y", 260 - fillLevel);
    clipRect.setAttribute("height", fillLevel);
  }, 20);
}

// Section 11, emptyBurette():
function emptyBurette() {
  clearInterval(fillInterval);           // (1) Leak schließen
  fillInterval = null;
  buFilled = false;                      // SOFORT konsistent machen
  // ... Intervall in emptyInterval speichern, self-clear wie gehabt ...
}

// Section 11, updateBurette(): klammern statt negativ werden lassen
function updateBurette() {
  buretteLevel = Math.max(0, buretteLevel - 3);
  if (buretteLevel === 0) { dripStop(); return; }
  elements.burClip.setAttribute("y", 260 - buretteLevel);
  elements.burClip.setAttribute("height", buretteLevel);
  updateDisplay();
}

// Section 10, powerOff(): Timeout gegen Power-Flattern absichern
function powerOff(titrationAktiv) {
  const myCycle = ++powerCycle;
  // ...
  setTimeout(() => {
    if (myCycle !== powerCycle) return;  // Gerät wurde zwischendrin wieder eingeschaltet
    elements.displayLine1.style.visibility = "hidden";
    elements.lcd.classList.remove("lcdDisplay_on");
    elements.lcd.classList.add("lcdDisplay_off");
  }, 3000);
  // ...
}
