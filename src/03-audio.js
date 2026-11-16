/* ===== sound: everything is synthesised, nothing is downloaded ===== */
const Snd = (() => {
  let ac = null, master, music, sfx, echo, noiseBuf, on = true, timer = null, nextT = 0, idx = 0, loops = 0, mood = 0, wantMood = 0;
  try { on = localStorage.getItem('lct.sound') !== 'off'; } catch (e) {}
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; return; }
    master = ac.createGain(); master.gain.value = on ? 1 : 0;
    const comp = ac.createDynamicsCompressor(); master.connect(comp); comp.connect(ac.destination);
    music = ac.createGain(); music.gain.value = 0.42; music.connect(master);
    sfx = ac.createGain(); sfx.gain.value = 0.7; sfx.connect(master);
    echo = ac.createDelay(1); echo.delayTime.value = 0.34;
    const fb = ac.createGain(); fb.gain.value = 0.32; const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200;
    echo.connect(lp); lp.connect(fb); fb.connect(echo); lp.connect(music);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  function tone(o) {
    if (!ac) return;
    const t = (o.at || ac.currentTime) + (o.t || 0), osc = ac.createOscillator(), g = ac.createGain();
    osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(o.f, t);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t + o.dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(o.g ?? 0.2, t + (o.a ?? 0.006));
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
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(o.g ?? 0.2, t + (o.a ?? 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    src.connect(f); f.connect(g); g.connect(o.dest || sfx);
    src.start(t, Math.random() * 0.5); src.stop(t + o.dur + 0.05);
  }
  const fx = {
    tap() { tone({ f: 660, dur: 0.05, type: 'triangle', g: 0.12 }); },
    pick() { tone({ f: 520, dur: 0.06, type: 'triangle', g: 0.14 }); tone({ f: 780, t: 0.05, dur: 0.08, type: 'triangle', g: 0.12 }); },
    nope() { tone({ f: 180, dur: 0.12, type: 'square', g: 0.07, lp: 700 }); },
    step() { noise({ f: 300, dur: 0.05, g: 0.1, type: 'lowpass' }); },
    whoosh() { noise({ f: 500, f2: 2600, dur: 0.22, g: 0.14, q: 1.4 }); },
    hit(big) { tone({ f: big ? 170 : 220, f2: 55, dur: big ? 0.26 : 0.16, g: big ? 0.5 : 0.32 }); noise({ f: 1400, dur: 0.07, g: big ? 0.3 : 0.18 }); },
    glass() { noise({ f: 5200, dur: 0.16, g: 0.2, type: 'highpass' }); tone({ f: 2100, dur: 0.12, g: 0.07, type: 'triangle' }); tone({ f: 3150, t: 0.03, dur: 0.14, g: 0.05, type: 'triangle' }); },
    splash() { noise({ f: 1800, f2: 500, dur: 0.24, g: 0.22, q: 0.6 }); },
    fire() { noise({ f: 300, f2: 1600, dur: 0.5, g: 0.34, type: 'lowpass', a: 0.03 }); tone({ f: 90, f2: 45, dur: 0.4, g: 0.3 }); },
    boom() { noise({ f: 900, f2: 80, dur: 0.6, g: 0.5, type: 'lowpass' }); tone({ f: 120, f2: 30, dur: 0.55, g: 0.6 }); },
    heal() { [72, 76, 79, 84].forEach((m, i) => tone({ f: mtof(m), t: i * 0.07, dur: 0.3, g: 0.12, type: 'triangle', echo: true })); },
    pop() { tone({ f: 300, f2: 900, dur: 0.07, g: 0.3 }); tone({ f: 520, t: 0.09, dur: 0.14, g: 0.16, type: 'triangle' }); },
    cork() { tone({ f: 900, f2: 200, dur: 0.09, g: 0.3 }); noise({ f: 2400, dur: 0.05, g: 0.14 }); tone({ f: mtof(88), t: 0.16, dur: 0.3, g: 0.1, type: 'triangle', echo: true }); },
    stun() { [0, 1, 2].forEach(i => tone({ f: 980 - i * 160, t: i * 0.08, dur: 0.14, g: 0.12, type: 'triangle' })); },
    thud() { tone({ f: 110, f2: 40, dur: 0.22, g: 0.5 }); },
    encore() { [79, 84, 88].forEach((m, i) => tone({ f: mtof(m), t: i * 0.06, dur: 0.22, g: 0.14, type: 'square', lp: 2600 })); },
    charge() { tone({ f: 200, f2: 820, dur: 0.6, g: 0.12, type: 'sawtooth', lp: 1500 }); noise({ f: 800, f2: 3000, dur: 0.6, g: 0.08 }); },
    boss() { [38, 44, 49].forEach(m => tone({ f: mtof(m), dur: 1.6, g: 0.22, type: 'sawtooth', lp: 600, a: 0.08 })); noise({ f: 5000, dur: 0.5, g: 0.3, type: 'highpass' }); },
    down() { tone({ f: 300, f2: 70, dur: 0.5, g: 0.3, type: 'triangle' }); },
    win() { [72, 76, 79, 84, 88, 91].forEach((m, i) => tone({ f: mtof(m), t: i * 0.12, dur: 0.5, g: 0.16, type: 'triangle', echo: true })); },
    lose() { [62, 58, 55, 50].forEach((m, i) => tone({ f: mtof(m), t: i * 0.22, dur: 0.7, g: 0.16, type: 'triangle', lp: 1200 })); },
  };
  /* --- the house band: swung eighths, walking bass, a few vibraphone notes --- */
  const SONGS = [
    { bpm: 92, bars: [
      { ch: [53, 57, 60, 64], bass: [38, 41, 45, 44], mel: [[2, 69], [4, 72], [5, 76]] },
      { ch: [53, 59, 64, 69], bass: [43, 47, 50, 49], mel: [[0, 74], [5, 71], [6, 69]] },
      { ch: [52, 55, 59, 62], bass: [48, 52, 55, 46], mel: [[1, 67], [3, 71], [4, 74], [6, 76]] },
      { ch: [55, 58, 61, 64], bass: [45, 49, 52, 51], mel: [[2, 73], [4, 70], [6, 69]] },
      { ch: [53, 57, 60, 64], bass: [50, 48, 45, 38], mel: [[0, 77], [4, 76], [5, 74], [6, 72]] },
      { ch: [53, 59, 63, 68], bass: [37, 41, 44, 47], mel: [[1, 75], [3, 71], [4, 68]] },
      { ch: [52, 55, 59, 62], bass: [48, 43, 45, 41], mel: [[0, 67], [2, 71], [3, 74], [4, 76]] },
      { ch: [55, 59, 62], ch2: [55, 58, 61, 64], bass: [40, 43, 45, 39], mel: [[2, 74], [5, 73], [6, 76]] },
    ] },
    { bpm: 112, bars: [
      { ch: [53, 57, 60, 64], bass: [38, 41, 43, 45], mel: [[0, 69], [3, 74], [4, 77]] },
      { ch: [53, 57, 62], bass: [46, 50, 53, 41], mel: [[1, 77], [4, 74], [6, 69]] },
      { ch: [55, 58, 62], bass: [40, 43, 46, 44], mel: [[0, 70], [3, 74], [4, 79]] },
      { ch: [55, 58, 61, 64], bass: [45, 49, 52, 39], mel: [[0, 76], [2, 73], [4, 70], [6, 69]] },
    ] },
  ];
  function keys(notes, t, dur, g) { for (const m of notes) { tone({ at: t, f: mtof(m), dur, g, dest: music, lp: 1700, a: 0.012 }); tone({ at: t, f: mtof(m) * 2.005, dur: dur * 0.35, g: g * 0.3, dest: music }); } }
  function schedule() {
    if (!ac) return;
    while (nextT < ac.currentTime + 0.25) {
      const song = SONGS[mood], beat = 60 / song.bpm, bar = song.bars[Math.floor(idx / 8) % song.bars.length], e = idx % 8;
      const t = nextT + (e % 2 ? beat * 0.16 : 0);
      if (e % 2 === 0) tone({ at: t, f: mtof(bar.bass[e / 2]), dur: beat * 0.9, g: 0.34, type: 'triangle', lp: 420, dest: music, a: 0.01 });
      if (e === 0) keys(bar.ch, t, beat * 2.2, 0.085);
      if (e === 3) keys(bar.ch, t, beat * 0.5, 0.06);
      if (e === 4 && bar.ch2) keys(bar.ch2, t, beat * 1.8, 0.08);
      if (loops % 2 === 1 || mood === 1) for (const [at, m] of bar.mel) if (at === e) { tone({ at: t, f: mtof(m), dur: beat * 1.3, g: 0.1, dest: music, echo: true }); tone({ at: t, f: mtof(m) * 4, dur: 0.12, g: 0.02, dest: music }); }
      noise({ at: t, f: 7000, dur: 0.04, g: e % 2 ? 0.035 : 0.05, type: 'highpass', dest: music });
      if (e === 2 || e === 6) noise({ at: t, f: 3200, dur: 0.16, g: 0.06, q: 0.5, dest: music, a: 0.02 });
      if (e === 0 || (mood === 1 && e === 4)) tone({ at: t, f: 70, f2: 42, dur: 0.16, g: 0.3, dest: music });
      idx++; nextT += beat / 2;
      if (idx % (song.bars.length * 8) === 0) { loops++; }
      if (idx % 8 === 0 && wantMood !== mood) { mood = wantMood; idx = 0; loops = 1; }
    }
  }
  return {
    get on() { return on; },
    start() { init(); if (!ac || timer) return; nextT = ac.currentTime + 0.1; idx = 0; timer = setInterval(schedule, 60); },
    toggle() { on = !on; try { localStorage.setItem('lct.sound', on ? 'on' : 'off'); } catch (e) {} init(); if (ac) master.gain.setTargetAtTime(on ? 1 : 0, ac.currentTime, 0.05); return on; },
    mood(m) { wantMood = m; },
    play(name, arg) { if (ac && on && fx[name]) { try { fx[name](arg); } catch (e) {} } },
  };
})();
