// === NAVIGAZIONE SCHERMATE ===
function showDoc(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    window.scrollTo(0, 0);
    if (id === 'listino') loadGallery();
}

function goHome() {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('home-screen').classList.add('active');
}

// === LOGICA CALCOLO TOTALE ALLEGATO ===
function updateTotal() {
    let total = 0;
    document.querySelectorAll('.price-check:checked').forEach(c => {
        total += parseInt(c.getAttribute('data-price'), 10) || 0;
    });
    document.getElementById('total-val').value = "€ " + total;
}
document.querySelectorAll('.price-check').forEach(check => {
    check.addEventListener('change', updateTotal);
});

// === SALVATAGGIO AUTOMATICO IN localStorage ===
const STORAGE_KEY = 'photoangelini_form_data_v1';

function getFormElements() {
    return Array.from(document.querySelectorAll(
        '#contratto input, #contratto textarea, ' +
        '#allegato input, #allegato textarea, ' +
        '#draft input, #draft textarea'
    )).filter(el => el.id !== 'total-val');
}

// === SERIALIZZAZIONE STATO ===
function buildStateObject() {
    const data = { v: 1, fields: [], signatures: {}, screen: null };
    getFormElements().forEach((el, idx) => {
        if (el.type === 'checkbox') {
            data.fields[idx] = el.checked;
        } else {
            data.fields[idx] = el.value;
        }
    });
    data.signatures.committenti = document.getElementById('preview-committenti').innerHTML;
    data.signatures.ditta = document.getElementById('preview-ditta').innerHTML;
    // Schermata attiva al momento della condivisione (per routing intelligente)
    const active = document.querySelector('.screen.active');
    data.screen = active ? active.id : 'contratto';
    return data;
}

function applyStateObject(data) {
    if (!data || !Array.isArray(data.fields)) return false;
    getFormElements().forEach((el, idx) => {
        const val = data.fields[idx];
        if (val === undefined) return;
        if (el.type === 'checkbox') {
            el.checked = !!val;
        } else {
            el.value = val;
        }
    });
    if (data.signatures) {
        const c = document.getElementById('preview-committenti');
        const d = document.getElementById('preview-ditta');
        if (data.signatures.committenti && data.signatures.committenti.includes('<img')) {
            c.innerHTML = data.signatures.committenti;
        }
        if (data.signatures.ditta && data.signatures.ditta.includes('<img')) {
            d.innerHTML = data.signatures.ditta;
        }
    }
    updateTotal();
    return true;
}

function saveState() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(buildStateObject()));
    } catch (e) {
        console.warn('Impossibile salvare i dati:', e);
    }
}

function loadState() {
    let raw;
    try {
        raw = localStorage.getItem(STORAGE_KEY);
    } catch (e) {
        return;
    }
    if (!raw) return;
    try {
        applyStateObject(JSON.parse(raw));
    } catch (e) { /* ignora */ }
}

function clearSavedData() {
    if (!confirm('Sei sicuro di voler cancellare tutti i dati inseriti? Questa azione non può essere annullata.')) return;
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch (e) { /* noop */ }
    // Reset campi
    getFormElements().forEach(el => {
        if (el.type === 'checkbox') el.checked = false;
        else el.value = '';
    });
    document.getElementById('preview-committenti').innerHTML = 'Clicca per firmare 1 e 2';
    document.getElementById('preview-ditta').innerHTML = 'Clicca per firmare';
    updateTotal();
}

// Debounce per non salvare ad ogni tasto
let saveTimer = null;
function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(saveState, 400);
}

// Collegamento eventi di modifica a tutti i campi + firme
document.addEventListener('DOMContentLoaded', () => {
    getFormElements().forEach(el => {
        el.addEventListener('input', scheduleSave);
        el.addEventListener('change', scheduleSave);
    });
    // Priorità: dati nel link > dati in localStorage
    const loadedFromUrl = loadFromUrl();
    if (!loadedFromUrl) loadState();
});

// === ESPORTA DATI SU FILE JSON ===
function exportData() {
    const data = buildStateObject();
    const stamp = new Date().toISOString().slice(0, 10);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contratto-photoangelini-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// === IMPORTA DATI DA FILE JSON ===
function importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const data = JSON.parse(ev.target.result);
                if (!applyStateObject(data)) throw new Error('Formato non valido');
                saveState();
                alert('✓ Dati importati correttamente!');
            } catch (err) {
                alert('Errore nel caricamento del file: ' + err.message);
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

// === CONDIVIDI VIA LINK (URL con dati compressi nell'hash) ===
// URL pubblico dell'app — usato come fallback se l'app è aperta da file://
const PUBLIC_APP_URL = 'https://rikang83.github.io/app-angelini/';

function shareLink() {
    if (typeof LZString === 'undefined') {
        alert('Libreria di compressione non caricata. Riprova fra qualche secondo.');
        return;
    }
    const data = buildStateObject();
    const json = JSON.stringify(data);
    const compressed = LZString.compressToEncodedURIComponent(json);

    // Se l'app è aperta da file locale (file://), il link non sarebbe cliccabile.
    // In quel caso uso l'URL pubblico GitHub Pages come base.
    let baseUrl;
    let isLocal = window.location.protocol === 'file:';
    if (isLocal) {
        baseUrl = PUBLIC_APP_URL;
    } else {
        baseUrl = window.location.origin + window.location.pathname;
    }
    const fullUrl = `${baseUrl}#d=${compressed}`;
    const sizeKB = (fullUrl.length / 1024).toFixed(1);

    if (isLocal) {
        alert('⚠️ Stai usando l\'app in locale (sul tuo PC).\nIl link che invierai punterà al sito online:\n' + PUBLIC_APP_URL + '\n\nPer comodità, apri sempre l\'app da quel link.');
    }

    const msg = `Ciao! Apri questo link per visualizzare e firmare il contratto Photo Angelini:\n\n${fullUrl}`;

    const copyAndShare = () => {
        navigator.clipboard.writeText(fullUrl).then(() => {
            const wantWa = confirm(`✓ Link copiato negli appunti (${sizeKB} KB).\n\nVuoi aprire WhatsApp per inviarlo subito?`);
            if (wantWa) {
                window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
            }
        }).catch(() => {
            // Fallback se clipboard non disponibile
            prompt('Copia questo link e invialo al cliente:', fullUrl);
        });
    };

    if (fullUrl.length > 60000) {
        const ok = confirm(`Attenzione: il link è davvero lungo (${sizeKB} KB) e WhatsApp potrebbe troncarlo.\nConsigliato usare "ESPORTA" e inviare il file .json invece.\n\nProcedere comunque con il link?`);
        if (!ok) return;
    }
    copyAndShare();
}

// === CARICA DATI DA URL HASH ===
function loadFromUrl() {
    const hash = window.location.hash;
    if (!hash || !hash.startsWith('#d=')) return false;
    if (typeof LZString === 'undefined') return false;
    const compressed = hash.substring(3);
    try {
        const json = LZString.decompressFromEncodedURIComponent(compressed);
        if (!json) return false;
        const data = JSON.parse(json);

        // Se c'è già qualcosa in localStorage, chiedi conferma
        let hasLocal = false;
        try { hasLocal = !!localStorage.getItem(STORAGE_KEY); } catch (e) { /* noop */ }
        if (hasLocal) {
            const ok = confirm('Hai ricevuto un contratto via link.\nQuesti dati sostituiranno quelli attualmente salvati sul dispositivo.\nContinuare?');
            if (!ok) return false;
        }
        if (!applyStateObject(data)) return false;
        saveState();
        // Pulisci l'hash dall'URL per non ricaricare al refresh
        history.replaceState(null, '', window.location.pathname + window.location.search);
        // Vai automaticamente alla schermata indicata dal link (o contratto di default)
        const screenId = (data.screen && document.getElementById(data.screen)) ? data.screen : 'contratto';
        setTimeout(() => {
            showDoc(screenId);
            const msg = screenId === 'draft'
                ? '✓ Draft caricato dal link.'
                : '✓ Contratto + Allegato caricato dal link. Scorri fino in fondo per firmare, poi premi "CONDIVIDI" per rimandarlo.';
            alert(msg);
        }, 200);
        return true;
    } catch (e) {
        console.warn('Link non valido:', e);
        return false;
    }
}

// === STAMPA / PDF ===
function isPrintableScreen() {
    const activeScreen = document.querySelector('.screen.active');
    if (!activeScreen) return false;
    if (activeScreen.id === 'home-screen' || activeScreen.id === 'listino') {
        alert("Seleziona Contratto, Allegato o Draft per generare il PDF");
        return false;
    }
    return true;
}

// === FORZA VALORI INPUT IN STAMPA/PDF ===
// Bug noto: browser (specialmente Safari mobile) non includono i valori dei <input>
// in window.print() o html2canvas. Iniettiamo i valori come attributi prima.
function snapshotInputValuesIntoDom(root) {
    (root || document).querySelectorAll('input, textarea').forEach(input => {
        if (input.type === 'checkbox' || input.type === 'radio') {
            if (input.checked) {
                input.setAttribute('checked', 'checked');
            } else {
                input.removeAttribute('checked');
            }
        } else if (input.tagName === 'TEXTAREA') {
            input.textContent = input.value || '';
        } else {
            input.setAttribute('value', input.value || '');
        }
    });
}

window.addEventListener('beforeprint', () => snapshotInputValuesIntoDom(document));

function printActive() {
    if (!isPrintableScreen()) return;
    snapshotInputValuesIntoDom(document);
    window.print();
}

function generatePDF() {
    if (!isPrintableScreen()) return;
    const activeScreen = document.querySelector('.screen.active');
    snapshotInputValuesIntoDom(document);
    const ready = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
    ready.then(async () => {
        document.body.classList.add('pdf-mode');
        try {
            const pages = activeScreen.querySelectorAll('.page');
            const pagesToRender = pages.length > 0 ? Array.from(pages) : [activeScreen];
            const jsPDFConstr = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
            if (!jsPDFConstr) throw new Error('jsPDF non disponibile');
            if (typeof html2canvas === 'undefined') throw new Error('html2canvas non disponibile');
            const pdf = new jsPDFConstr({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
            for (let i = 0; i < pagesToRender.length; i++) {
                const canvas = await html2canvas(pagesToRender[i], {
                    scale: 2,
                    useCORS: true,
                    backgroundColor: '#ffffff',
                    onclone: (clonedDoc) => {
                        snapshotInputValuesIntoDom(clonedDoc);
                        clonedDoc.body.classList.add('pdf-mode');
                    }
                });
                const imgData = canvas.toDataURL('image/jpeg', 0.95);
                if (i > 0) pdf.addPage();
                pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);
            }
            const fname = (activeScreen.id === 'contratto'
                ? 'CONTRATTO_ALLEGATO'
                : activeScreen.id.toUpperCase()) + '_Photo_Angelini.pdf';
            pdf.save(fname);
        } catch (e) {
            console.error(e);
            alert('Errore nella generazione del PDF: ' + (e && e.message ? e.message : e));
        } finally {
            document.body.classList.remove('pdf-mode');
        }
    });
}

// === GALLERIA LISTINO ===
function loadGallery() {
    const container = document.getElementById('gallery-container');
    if (container.innerHTML !== "") return;
    const images = ["Copertina.jpg"];
    for (let i = 1; i <= 17; i++) {
        if (i !== 4) images.push(`Pagina (${i}).jpg`);
    }
    images.forEach(name => {
        const img = document.createElement('img');
        img.src = encodeURI(name);
        img.alt = name;
        img.loading = "lazy";
        img.onerror = () => { img.style.display = 'none'; };
        container.appendChild(img);
    });
}

// === FIRMA SU CANVAS ===
let currentTarget = "";
let currentStep = 1;
const canvas = document.getElementById('modal-canvas');
const ctx = canvas.getContext('2d');
let drawing = false;
let lastPoint = null;

// Configurazione tratto firma
function configureStroke() {
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#000';
}

function openSignature(target) {
    currentTarget = target;
    currentStep = 1;
    window.firstSig = null; // reset firma 1 ad ogni apertura
    document.getElementById('signature-modal').style.display = 'flex';
    updateModalTitle();
    clearModal();
}

function updateModalTitle() {
    const title = document.getElementById('modal-title');
    title.innerText = currentTarget === 'committenti' ? `FIRMA COMMITTENTE ${currentStep}` : "FIRMA DITTA";
}

function clearModal() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    configureStroke();
}

function closeModal() {
    document.getElementById('signature-modal').style.display = 'none';
    drawing = false;
    lastPoint = null;
}

// Comprime la firma: ritaglia solo l'area disegnata e converte in JPEG
// con sfondo bianco. Riduce di ~10x la dimensione (~30KB PNG → ~3KB JPEG)
function compressSignature(srcCanvas) {
    const ctx = srcCanvas.getContext('2d');
    const w = srcCanvas.width, h = srcCanvas.height;
    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;

    // Trova bounding box dei pixel non trasparenti
    let minX = w, minY = h, maxX = -1, maxY = -1;
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const alpha = data[(y * w + x) * 4 + 3];
            if (alpha > 0) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        }
    }

    // Se vuoto, ritorna canvas vuoto piccolo
    if (maxX < 0) {
        const empty = document.createElement('canvas');
        empty.width = 10; empty.height = 10;
        const ectx = empty.getContext('2d');
        ectx.fillStyle = 'white';
        ectx.fillRect(0, 0, 10, 10);
        return empty.toDataURL('image/jpeg', 0.7);
    }

    // Padding piccolo attorno alla firma
    const pad = 6;
    minX = Math.max(0, minX - pad);
    minY = Math.max(0, minY - pad);
    maxX = Math.min(w - 1, maxX + pad);
    maxY = Math.min(h - 1, maxY + pad);
    const cw = maxX - minX + 1;
    const ch = maxY - minY + 1;

    // Crea canvas ritagliato con sfondo bianco. Se troppo grande, ridimensiona.
    const maxW = 360;
    const scale = cw > maxW ? maxW / cw : 1;
    const finalW = Math.round(cw * scale);
    const finalH = Math.round(ch * scale);

    const cropped = document.createElement('canvas');
    cropped.width = finalW;
    cropped.height = finalH;
    const cctx = cropped.getContext('2d');
    cctx.fillStyle = 'white';
    cctx.fillRect(0, 0, finalW, finalH);
    cctx.imageSmoothingEnabled = true;
    cctx.imageSmoothingQuality = 'high';
    cctx.drawImage(srcCanvas, minX, minY, cw, ch, 0, 0, finalW, finalH);

    return cropped.toDataURL('image/jpeg', 0.55);
}

function saveModal() {
    const dataUrl = compressSignature(canvas);
    const preview = document.getElementById(`preview-${currentTarget}`);
    if (currentTarget === 'committenti') {
        if (currentStep === 1) {
            window.firstSig = dataUrl;
            currentStep = 2;
            updateModalTitle();
            clearModal();
        } else {
            preview.innerHTML = `<img src="${window.firstSig}" style="width:45%"><img src="${dataUrl}" style="width:45%">`;
            closeModal();
            scheduleSave();
        }
    } else {
        preview.innerHTML = `<img src="${dataUrl}" style="width:90%">`;
        closeModal();
        scheduleSave();
    }
}

// Calcolo coordinate corrette per mouse e touch
function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    if (e.touches && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    } else if (e.changedTouches && e.changedTouches.length > 0) {
        clientX = e.changedTouches[0].clientX;
        clientY = e.changedTouches[0].clientY;
    } else {
        clientX = e.clientX;
        clientY = e.clientY;
    }
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
    };
}

function startDraw(e) {
    drawing = true;
    configureStroke();
    const p = getPos(e);
    lastPoint = p;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
}

function moveDraw(e) {
    if (!drawing) return;
    const p = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastPoint.x, lastPoint.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastPoint = p;
}

function endDraw() {
    drawing = false;
    lastPoint = null;
}

// Eventi mouse
canvas.addEventListener('mousedown', startDraw);
canvas.addEventListener('mousemove', moveDraw);
canvas.addEventListener('mouseup', endDraw);
canvas.addEventListener('mouseleave', endDraw);

// Eventi touch
canvas.addEventListener('touchstart', (e) => { e.preventDefault(); startDraw(e); }, { passive: false });
canvas.addEventListener('touchmove', (e) => { e.preventDefault(); moveDraw(e); }, { passive: false });
canvas.addEventListener('touchend', endDraw);
canvas.addEventListener('touchcancel', endDraw);
