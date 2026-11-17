/* ===== sound: everything is synthesised, nothing is downloaded ===== */
const Snd = (() => {
  let ac = null, master, music, sfx, echo, noiseBuf, on = true, timer = null, nextT = 0, idx = 0, loops = 0;
  try { on = localStorage.getItem('bwt.sound') !== 'off'; } catch (e) {}
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; return; }
    master = ac.createGain(); master.gain.value = on ? 1 : 0;
    const comp = ac.createDynamicsCompressor(); master.connect(comp); comp.connect(ac.destination);
    music = ac.createGain(); music.gain.value = 0.36; music.connect(master);
    sfx = ac.createGain(); sfx.gain.value = 0.75; sfx.connect(master);
    echo = ac.createDelay(1); echo.delayTime.value = 0.31;
    const fb = ac.createGain(); fb.gain.value = 0.3; const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
    echo.connect(lp); lp.connect(fb); fb.connect(echo); lp.connect(music);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  function tone(o) {
    if (!ac) return;
    const t = (o.at || ac.currentTime) + (o.t || 0), osc = ac.createOscillator(), g = ac.createGain();
    osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(o.f, t);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t + o.dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(o.g ?? 0.2, t + (o.a ?? 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    osc.connect(g); let out = g;
    if (o.lp) { const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; g.connect(f); out = f; }
    out.connect(o.dest || sfx); if (o.echo) out.connect(echo);
    osc.start(t); osc.stop(t + o.dur + 0.05);
  }
  function noise(o) {
    if (!ac) return;
    const t = (o.at || ac.currentTime) + (o.t || 0), src = ac.createBufferSource(), g = ac.createGain(), f = ac.createBiquadFilter();
    src.buffer = noiseBuf; src.loop = true; f.type = o.type || 'bandpass'; f.frequency.setValueAtTime(o.f || 1000, t); f.Q.value = o.q ?? 0.8;
    if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t + o.dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(o.g ?? 0.2, t + (o.a ?? 0.003));
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    src.connect(f); f.connect(g); g.connect(o.dest || sfx);
    src.start(t, Math.random() * 0.5); src.stop(t + o.dur + 0.05);
  }
  // a wooden piece set down on a wooden block
  const clack = (t = 0, g = 0.5, f = 620) => { tone({ t, f, f2: f * 0.55, dur: 0.07, g, type: 'triangle' }); tone({ t, f: f * 2.4, dur: 0.03, g: g * 0.35 }); noise({ t, f: 2600, dur: 0.035, g: g * 0.4, q: 1.2 }); };
  const fx = {
    tap() { tone({ f: 880, dur: 0.05, type: 'square', g: 0.07, lp: 2400 }); },
    pick() { tone({ f: 660, dur: 0.05, type: 'square', g: 0.07, lp: 2400 }); tone({ f: 990, t: 0.05, dur: 0.07, type: 'square', g: 0.07, lp: 2400 }); },
    nope() { tone({ f: 170, dur: 0.12, type: 'square', g: 0.06, lp: 600 }); },
    step() { noise({ f: 420, dur: 0.05, g: 0.16, type: 'lowpass' }); tone({ f: 160, f2: 90, dur: 0.05, g: 0.12 }); },
    whoosh() { noise({ f: 500, f2: 2600, dur: 0.2, g: 0.13, q: 1.4 }); },
    arrow() { noise({ f: 1800, f2: 4200, dur: 0.16, g: 0.12, q: 2 }); },
    thock() { clack(0, 0.4, 420); tone({ f: 150, f2: 70, dur: 0.12, g: 0.3 }); },
    hit(big) { noise({ f: big ? 900 : 1300, f2: 300, dur: big ? 0.16 : 0.1, g: big ? 0.4 : 0.3, q: 0.7 }); tone({ f: big ? 150 : 190, f2: 55, dur: big ? 0.24 : 0.15, g: big ? 0.45 : 0.3 }); },
    fire() { noise({ f: 300, f2: 1800, dur: 0.5, g: 0.36, type: 'lowpass', a: 0.02 }); tone({ f: 100, f2: 42, dur: 0.45, g: 0.4 }); },
    spark() { noise({ f: 2400, f2: 600, dur: 0.18, g: 0.2 }); tone({ f: 900, f2: 300, dur: 0.14, g: 0.12, type: 'triangle' }); },
    heal() { [76, 79, 84, 88].forEach((m, i) => tone({ f: mtof(m), t: i * 0.07, dur: 0.4, g: 0.11, echo: true })); },
    topple() { tone({ f: 420, f2: 60, dur: 0.4, g: 0.26, type: 'square', lp: 1400 }); noise({ t: 0.22, f: 300, dur: 0.12, g: 0.2, type: 'lowpass' }); },
    turn() { noise({ f: 700, f2: 1500, dur: 0.16, g: 0.1, q: 1.2 }); },
    page() { noise({ f: 2600, f2: 900, dur: 0.22, g: 0.12, q: 0.6 }); },
    bell() { [0, 7, 12].forEach((d, i) => tone({ f: mtof(69 + d), dur: 1.1, g: 0.12 - i * 0.03, echo: true })); tone({ f: mtof(69) * 2.76, dur: 0.5, g: 0.04 }); },
    first() { [84, 88, 91, 96].forEach((m, i) => tone({ f: mtof(m), t: i * 0.05, dur: 0.22, g: 0.1, type: 'square', lp: 3000 })); },
    horn() { [57, 64].forEach((m, i) => tone({ f: mtof(m), t: i * 0.22, dur: 0.6, g: 0.16, type: 'sawtooth', lp: 900, a: 0.05 })); },
    win() { [72, 76, 79, 84, 88, 91].forEach((m, i) => tone({ f: mtof(m), t: i * 0.12, dur: 0.6, g: 0.15, echo: true })); },
    lose() { [69, 65, 62, 57].forEach((m, i) => tone({ f: mtof(m), t: i * 0.24, dur: 0.8, g: 0.15, type: 'triangle', lp: 1200 })); },
  };
  /* --- a small music box: four chords, an arpeggio, a tune every other pass --- */
  const BPM = 92, BARS = [
    { pad: [57, 60, 64], bass: 45, arp: [69, 72, 76, 72, 69, 72, 76, 81], mel: [[0, 81], [3, 79], [4, 76]] },
    { pad: [53, 57, 60], bass: 41, arp: [65, 69, 72, 69, 65, 69, 72, 77], mel: [[0, 77], [4, 81], [6, 79]] },
    { pad: [55, 60, 64], bass: 48, arp: [67, 72, 76, 72, 67, 72, 76, 79], mel: [[0, 79], [2, 76], [4, 72]] },
    { pad: [55, 59, 62], bass: 43, arp: [67, 71, 74, 71, 67, 71, 74, 79], mel: [[0, 74], [3, 79], [6, 83]] },
  ];
  const box = (t, m, g) => { tone({ at: t, f: mtof(m), dur: 0.5, g, dest: music, echo: true, type: 'triangle' }); tone({ at: t, f: mtof(m), dur: 0.16, g: g * 0.3, dest: music, type: 'square', lp: 1800 }); };
  function schedule() {
    if (!ac) return;
    while (nextT < ac.currentTime + 0.25) {
      const beat = 60 / BPM, bar = BARS[Math.floor(idx / 8) % BARS.length], e = idx % 8, t = nextT;
      if (e === 0) { for (const m of bar.pad) tone({ at: t, f: mtof(m), dur: beat * 3.6, g: 0.05, dest: music, lp: 900, a: 0.25, type: 'triangle' }); tone({ at: t, f: mtof(bar.bass), dur: beat * 1.8, g: 0.2, dest: music, lp: 380, type: 'triangle', a: 0.02 }); }
      if (e === 4) tone({ at: t, f: mtof(bar.bass + 7), dur: beat * 1.2, g: 0.11, dest: music, lp: 380, type: 'triangle', a: 0.02 });
      box(t, bar.arp[e], e % 2 ? 0.045 : 0.07);
      if (loops % 2 === 1) for (const [at, m] of bar.mel) if (at === e) box(t, m + 12, 0.075);
      idx++; nextT += beat / 2;
      if (idx % (BARS.length * 8) === 0) loops++;
    }
  }
  return {
    get on() { return on; },
    start() { init(); if (!ac || timer) return; nextT = ac.currentTime + 0.1; idx = 0; timer = setInterval(schedule, 60); },
    toggle() { on = !on; try { localStorage.setItem('bwt.sound', on ? 'on' : 'off'); } catch (e) {} init(); if (ac) master.gain.setTargetAtTime(on ? 1 : 0, ac.currentTime, 0.05); return on; },
    play(name, arg) { if (ac && on && fx[name]) { try { fx[name](arg); } catch (e) {} } },
  };
})();
