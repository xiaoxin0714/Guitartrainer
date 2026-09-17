// --- 1. Global Configurations & Constants ---

// Dataset for Single Note Training Mode
const NOTE_MASTER = {
    "G3": { label: "5.", vex: "g/3", string: 4, fret: 5 }, 
    "A3": { label: "6.", vex: "a/3", string: 3, fret: 2 },
    "B3": { label: "7.", vex: "b/3", string: 3, fret: 4 },
    "C4": { label: "1",  vex: "c/4", string: 2, fret: 1 }, 
    "D4": { label: "2",  vex: "d/4", string: 2, fret: 3 },
    "E4": { label: "3",  vex: "e/4", string: 1, fret: 0 }, 
    "F4": { label: "4",  vex: "f/4", string: 1, fret: 1 },
    "G4": { label: "5",  vex: "g/4", string: 1, fret: 3 }, 
    "A4": { label: "6",  vex: "a/4", string: 1, fret: 5 }
};

const EN_NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const NOTE_FREQS = {
    "G3": 196.0, "A3": 220.0, "B3": 246.9, 
    "C4": 261.6, "D4": 293.7, "E4": 329.6, "F4": 349.2, 
    "G4": 392.0, "A4": 440.0, "B4": 493.9
};

// --- State Variables ---
let currentMode = 'training'; // 'training' or 'songs'
let SONGS = {}; // Global container for loaded song data
let currentSongData = [];
let currentIndex = 0;

// Audio State
let audioCtx = null;
let analyser = null;
let dataArray = null;

// Game/Playback State
let isPlaying = false;
let isDemoRunning = false;
let demoAbortController = false;
let wrongPitchCount = 0;

// Rendering State
let notePositions = [];
let performanceData = [];
let startTime = 0;


// --- 2. Data Loading & Dashboard Navigation ---

async function loadSongs() {
    try {
        const response = await fetch('./music.json');
        if (!response.ok) throw new Error('Failed to load music.json');
        SONGS = await response.json();
        populateSongLibrary();
    } catch (err) {
        console.error('Error loading songs:', err);
    }
}

function switchDashboardTab(tabMode) {
    // Toggle Buttons
    document.getElementById('tab-train-btn').classList.toggle('active', tabMode === 'training');
    document.getElementById('tab-songs-btn').classList.toggle('active', tabMode === 'songs');
    
    // Toggle Views
    document.getElementById('view-training').classList.toggle('active-view', tabMode === 'training');
    document.getElementById('view-songs').classList.toggle('active-view', tabMode === 'songs');
}

function populateSongLibrary() {
    const container = document.getElementById('song-list');
    container.innerHTML = '';
    
    for (const [key, song] of Object.entries(SONGS)) {
        const card = document.createElement('div');
        card.className = 'song-card';
        card.onclick = () => initGameSession('songs', key);
        card.innerHTML = `
            <h3>${song.title}</h3>
            <span>${song.difficulty || 'Kids Pro Rhythm'}</span>
        `;
        container.appendChild(card);
    }
}

// --- 3. Game Session Lifecycle Management ---

function initGameSession(mode, songKey) {
    currentMode = mode;
    demoAbortController = true; // Abort any running demo
    isPlaying = false;
    wrongPitchCount = 0;
    performanceData = [];
    currentIndex = 0;

    // UI Prep
    document.getElementById('list-screen').classList.remove('active-screen');
    document.getElementById('game-screen').classList.add('active-screen');
    document.getElementById('hint-tab-card').style.display = 'none';
    document.getElementById('replay-btn').style.display = 'none';
    document.getElementById('listen-btn').disabled = false;
    document.getElementById('start-btn').disabled = false;

    if (currentMode === 'training') {
        document.getElementById('game-title').innerText = "Random Note Practice";
        document.getElementById('hint-msg').innerText = "Press Start to Begin!";
        document.getElementById('start-btn').innerText = "▶ Start Practice";
        
        // Hide elements not used in single note mode
        document.getElementById('listen-btn').style.display = 'none';
        document.getElementById('target-line').style.display = 'none';
        
        generateRandomNoteAndRender();
    } else {
        document.getElementById('game-title').innerText = SONGS[songKey].title;
        document.getElementById('hint-msg').innerText = 'Click "Listen" to hear the melody 🎧';
        document.getElementById('start-btn').innerText = "▶ Play Now";
        
        // Show song mode elements
        document.getElementById('listen-btn').style.display = 'inline-block';
        document.getElementById('target-line').style.display = 'block';
        
        currentSongData = SONGS[songKey].data;
        renderVexFlowSong(currentSongData);
    }
}

function exitGameSession() {
    isPlaying = false;
    demoAbortController = true;
    document.getElementById('game-screen').classList.remove('active-screen');
    document.getElementById('list-screen').classList.add('active-screen');
}

function generateRandomNoteAndRender() {
    const keys = Object.keys(NOTE_MASTER);
    const randomKey = keys[Math.floor(Math.random() * keys.length)];
    
    currentSongData = [{ 
        note: randomKey, 
        vex: NOTE_MASTER[randomKey].vex, 
        label: NOTE_MASTER[randomKey].label,
        string: NOTE_MASTER[randomKey].string,
        fret: NOTE_MASTER[randomKey].fret
    }];

    renderSingleNoteSVG(currentSongData[0]);
}


// --- 4. Rendering Engines ---

function renderSingleNoteSVG(item) {
    const div = document.getElementById('staff-canvas');
    div.innerHTML = '';
    div.style.transform = "none"; // Reset scroll transform

    // Map exact Y positions on the staff based on standard treble clef layout
    const notePitchMap = {
        "A4": 25, "G4": 30, "F4": 40, "E4": 50, "D4": 55, 
        "C4": 60, "B3": 70, "A3": 75, "G3": 80
    };

    const noteY = notePitchMap[item.note] !== undefined ? notePitchMap[item.note] : 50;
    const stemUp = noteY > 50;
    const stemY2 = stemUp ? noteY - 28 : noteY + 28;
    const hasTopLedger = item.note === "G4" || item.note === "A4";
    const hasBottomLedger = item.note === "G3" || item.note === "C4";

    div.innerHTML = `
        <div style="position: relative; width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center;">
            <svg width="200" height="120" viewBox="0 0 200 120" style="overflow: visible;">
                <!-- 5 Staff Lines -->
                <line x1="10" y1="30" x2="190" y2="30" stroke="#4a5568" stroke-width="1.5" />
                <line x1="10" y1="40" x2="190" y2="40" stroke="#4a5568" stroke-width="1.5" />
                <line x1="10" y1="50" x2="190" y2="50" stroke="#4a5568" stroke-width="1.5" />
                <line x1="10" y1="60" x2="190" y2="60" stroke="#4a5568" stroke-width="1.5" />
                <line x1="10" y1="70" x2="190" y2="70" stroke="#4a5568" stroke-width="1.5" />

                <!-- Centered Note Assembly -->
                <g id="note-0" transform="translate(100, 0)">
                    ${hasTopLedger ? `<line x1="-14" y1="30" x2="14" y2="30" stroke="#4a5568" stroke-width="1.5" />` : ''}
                    ${hasBottomLedger ? `<line x1="-14" y1="${noteY}" x2="14" y2="${noteY}" stroke="#4a5568" stroke-width="1.5" />` : ''}
                    <line x1="${stemUp ? 5.5 : -5.5}" y1="${noteY}" x2="${stemUp ? 5.5 : -5.5}" y2="${stemY2}" stroke="#2c3e50" stroke-width="2" stroke-linecap="round" />
                    <ellipse cx="0" cy="${noteY}" rx="7" ry="5" transform="rotate(-20 0 ${noteY})" fill="#2c3e50" />
                </g>
            </svg>

            <div style="margin-top: 10px; text-align: center;">
                <div style="font-size: 32px; font-weight: bold; color: #2c3e50; line-height: 1.1;">${item.label}</div>
                <div style="font-size: 18px; font-style: italic; color: #7f8c8d; margin-top: 4px;">(${item.note})</div>
            </div>
        </div>
    `;
}

function renderVexFlowSong(notesData) {
    const div = document.getElementById('staff-canvas');
    div.innerHTML = '';
    div.style.transform = "none";
    div.style.position = "absolute";
    div.style.left = "0";

    const { Renderer, Stave, StaveNote, Formatter, Annotation } = Vex.Flow;
    
    const totalWidth = notesData.length * 120 + 400; 
    const renderer = new Renderer(div, Renderer.Backends.SVG);
    renderer.resize(totalWidth, 220);
    const context = renderer.getContext();
    
    const stave = new Stave(10, 40, totalWidth - 20);
    stave.addClef("treble").setContext(context).draw();

    const vexNotes = notesData.map((item, i) => {
        const sn = new StaveNote({ keys: [item.vex], duration: item.type });
        sn.setAttribute('id', 'note-' + i);
        sn.addModifier(new Annotation(item.label).setVerticalJustification(Annotation.VerticalJustify.BOTTOM));
        sn.setStyle({ fillStyle: "#bdc3c7", strokeStyle: "#bdc3c7" });
        return sn;
    });

    Formatter.FormatAndDraw(context, stave, vexNotes);
    
    // Cache positions for scrolling
    notePositions = vexNotes.map(n => n.getAbsoluteX());
    scrollToNoteIndex(0);
}

function scrollToNoteIndex(index) {
    if (currentMode === 'training' || index >= notePositions.length) return;
    const targetLinePos = 150; 
    const noteX = notePositions[index];
    const offset = targetLinePos - noteX;
    document.getElementById('staff-canvas').style.transform = `translateX(${offset}px)`;
}

function drawFretboardHint(targetString, targetFret) {
    const canvas = document.getElementById('fretboard-canvas');
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    const padX = 40;
    const padY = 15;
    const boardWidth = w - padX * 2;
    const boardHeight = h - padY * 2;
    const frets = 5; 
    const fretWidth = boardWidth / frets;
    const stringGap = boardHeight / 5;

    // Nut
    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(padX - 6, padY - 2, 6, boardHeight + 4);

    // Frets
    ctx.strokeStyle = '#b2bec3';
    ctx.lineWidth = 2;
    for (let i = 0; i <= frets; i++) {
        const x = padX + i * fretWidth;
        ctx.beginPath(); ctx.moveTo(x, padY); ctx.lineTo(x, padY + boardHeight); ctx.stroke();
        if (i > 0) {
            ctx.fillStyle = '#7f8c8d'; ctx.font = '11px Arial'; ctx.textAlign = 'center';
            ctx.fillText('Fret ' + i, x - fretWidth / 2, padY + boardHeight + 14);
        }
    }

    // Strings
    for (let s = 1; s <= 6; s++) {
        const y = padY + (s - 1) * stringGap;
        ctx.strokeStyle = '#636e72';
        ctx.lineWidth = 1 + (s * 0.4); 
        ctx.beginPath(); ctx.moveTo(padX - 6, y); ctx.lineTo(padX + boardWidth, y); ctx.stroke();
        ctx.fillStyle = '#2c3e50'; ctx.font = 'bold 10px Arial'; ctx.textAlign = 'right';
        ctx.fillText(s + 'S', padX - 10, y + 3);
    }

    // Target Dot
    const noteY = padY + (targetString - 1) * stringGap;
    let noteX = padX - 12; // Open string position
    if (targetFret > 0) noteX = padX + (targetFret - 0.5) * fretWidth;

    ctx.fillStyle = '#ff7675';
    ctx.beginPath(); ctx.arc(noteX, noteY, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 10px Arial'; ctx.textAlign = 'center';
    ctx.fillText(targetFret === 0 ? '0' : targetFret, noteX, noteY + 3.5);
}


// --- 5. Game Logic & Audio Processing ---

async function initAudioEngine() {
    if (!audioCtx) {
        try {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const source = audioCtx.createMediaStreamSource(stream);
            analyser = audioCtx.createAnalyser();
            analyser.fftSize = 2048;
            source.connect(analyser);
            dataArray = new Float32Array(analyser.fftSize);
        } catch (err) {
            alert("Microphone access denied or unavailable.");
            throw err;
        }
    }
    if (audioCtx.state === 'suspended') await audioCtx.resume();
}

async function startPracticeLoop() {
    try {
        await initAudioEngine();
    } catch (e) { return; }
    
    demoAbortController = true; 
    isPlaying = true;
    currentIndex = 0;
    wrongPitchCount = 0;
    performanceData = [];
    
    document.getElementById('hint-tab-card').style.display = 'none';
    document.getElementById('start-btn').disabled = true;
    
    if (currentMode === 'songs') {
        renderVexFlowSong(currentSongData); // Reset colors
        document.getElementById('listen-btn').disabled = true;
        document.getElementById('start-btn').innerText = "Restart";
    }
    
    document.getElementById('hint-msg').innerText = "Play Note: " + currentSongData[currentIndex].note;
    
    // Let UI update before starting heavy loop
    setTimeout(gameLoop, 100);
}

function gameLoop() {
    if (!isPlaying) return;
    
    const freq = getPitchYIN();
    if (freq) {
        const detectedNote = freqToNoteName(freq);
        const targetNote = currentSongData[currentIndex].note;
        
        if (detectedNote === targetNote) {
            handleCorrectNote();
        } else if (detectedNote !== null && currentMode === 'training') {
            handleWrongNote();
        }
    }
    requestAnimationFrame(gameLoop);
}

function handleCorrectNote() {
    const el = document.getElementById('note-' + currentIndex);
    if (el) el.querySelectorAll('path').forEach(p => p.setAttribute('fill', '#2ecc71')); // Turn green

    if (currentMode === 'training') {
        document.getElementById('hint-msg').innerText = "Correct! ✨";
        isPlaying = false;
        
        // Generate next random note automatically
        setTimeout(() => {
            document.getElementById('hint-tab-card').style.display = 'none';
            generateRandomNoteAndRender();
            document.getElementById('start-btn').disabled = false;
            document.getElementById('hint-msg').innerText = "Press Start for next note!";
            startPracticeLoop(); 
        }, 800); 

    } else {
        // Recording timing data
        const now = Date.now();
        if (performanceData.length === 0) startTime = now;
        performanceData.push({ note: currentSongData[currentIndex].note, time: now - startTime });

        currentIndex++;
        wrongPitchCount = 0;

        if (currentIndex < currentSongData.length) {
            scrollToNoteIndex(currentIndex);
            document.getElementById('hint-msg').innerText = "Next: " + currentSongData[currentIndex].note;
        } else {
            isPlaying = false;
            document.getElementById('hint-msg').innerText = "Awesome job! Song Completed! 🎉";
            document.getElementById('start-btn').disabled = false;
            document.getElementById('listen-btn').disabled = false;
            document.getElementById('replay-btn').style.display = 'inline-block';
        }
    }
}

function handleWrongNote() {
    wrongPitchCount++;
    // Display fretboard hint for Single Note mode after wrong pitch detected
    if (wrongPitchCount > 30) { // Approx 0.5s of holding wrong pitch at 60fps
        const noteData = currentSongData[currentIndex];
        document.getElementById('hint-tab-card').style.display = 'block';
        drawFretboardHint(noteData.string, noteData.fret);
        wrongPitchCount = 0; // reset to avoid spamming
    }
}

// YIN Algorithm Implementation for highly accurate pitch detection
function getPitchYIN() {
    analyser.getFloatTimeDomainData(dataArray);
    let sum = 0; 
    for(let i=0; i<dataArray.length; i++) sum += dataArray[i]*dataArray[i];
    
    // Volume Threshold
    if (Math.sqrt(sum/dataArray.length) < 0.04) return null;
    
    const half = dataArray.length / 2;
    let yin = new Float32Array(half);
    
    for(let t=0; t<half; t++) {
        for(let i=0; i<half; i++) { 
            let d = dataArray[i]-dataArray[i+t]; 
            yin[t] += d*d; 
        }
    }
    
    let runningSum = 0; 
    yin[0] = 1;
    for (let t = 1; t < half; t++) { 
        runningSum += yin[t]; 
        yin[t] *= t / runningSum; 
    }
    
    let tau = -1;
    for(let t = 1; t < half; t++) {
        if(yin[t] < 0.15) { 
            while (t+1 < half && yin[t+1] < yin[t]) t++; 
            tau = t; 
            break; 
        }
    }
    return tau === -1 ? null : audioCtx.sampleRate / tau;
}

function freqToNoteName(f) {
    if (f < 80 || f > 1000) return null;
    const floatNote = 12 * Math.log2(f / 440) + 69;
    const roundedNote = Math.round(floatNote);
    
    // Strict tolerance so overtones don't trigger false positives
    if (Math.abs(floatNote - roundedNote) > 0.4) return null; 
    
    return EN_NOTES[roundedNote % 12] + (Math.floor(roundedNote / 12) - 1);
}


// --- 6. Demo & Playback Tools (Songs Mode Only) ---

async function runDemoMode() {
    if (isDemoRunning) return;
    isDemoRunning = true;
    demoAbortController = false;
    
    document.getElementById('listen-btn').disabled = true;
    document.getElementById('start-btn').disabled = true;
    document.getElementById('hint-msg').innerText = "Listen closely...";
    
    const beatDurationMs = 600; // Tempo: 100 BPM
    
    for (let i = 0; i < currentSongData.length; i++) {
        if (demoAbortController) break;
        
        const noteObj = currentSongData[i];
        const holdTime = (noteObj.beats * beatDurationMs) / 1000;
        
        playSynth(noteObj.note, holdTime);
        scrollToNoteIndex(i);
        
        const el = document.getElementById('note-' + i);
        if(el) el.querySelectorAll('path').forEach(p => p.setAttribute('fill', '#9b59b6')); // Purple Demo
        
        await new Promise(r => setTimeout(r, noteObj.beats * beatDurationMs));
    }
    
    isDemoRunning = false;
    document.getElementById('listen-btn').disabled = false;
    document.getElementById('start-btn').disabled = false;
    
    if (!demoAbortController) {
        renderVexFlowSong(currentSongData); // Reset colors
        document.getElementById('hint-msg').innerText = "Now it's your turn!";
    }
}

function playBackRecording() {
    document.getElementById('hint-msg').innerText = "Playing back your rhythm...";
    
    performanceData.forEach(item => {
        const noteObj = currentSongData.find(n => n.note === item.note) || { beats: 1 };
        setTimeout(() => {
            playSynth(item.note, (noteObj.beats * 600) / 1000);
        }, item.time);
    });
}

function playSynth(note, durationSec = 0.5) {
    if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if(!NOTE_FREQS[note]) return;
    
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.value = NOTE_FREQS[note];
    
    gain.gain.setValueAtTime(0, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + 0.05);
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime + Math.max(0.1, durationSec - 0.1));
    gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + durationSec);
    
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(); 
    osc.stop(audioCtx.currentTime + durationSec + 0.1);
}


// --- 7. OnLoad Initializer ---
window.onload = async () => {
    await loadSongs(); // Load music.json dynamically before rendering
    switchDashboardTab('training'); // Default to Random Note Training
};