// ==========================================
// MOTOR ESPECÍFICO DE RENDERIZAÇÃO E 3D
// ==========================================

const mv = document.querySelector('#cup-viewer');
const container3d = document.querySelector('#container-3d');
const videoLoader = document.querySelector('#video-loader');
const timerText = document.querySelector('#timer-text');
let cropper = null;

let currentBgColor = '#ffffff';
let currentBgImage = null;
let hasCustomBg = false;

const toRGB = (h) => [parseInt(h.slice(1,3),16)/255, parseInt(h.slice(3,5),16)/255, parseInt(h.slice(5,7),16)/255, 1];

// 1. CONTROLES DE MATERIAIS
document.querySelector('#color-handle').oninput = (e) => { const m = mv.model.materials.find(mat => mat.name.toLowerCase().includes("cor_interna")); if(m) m.pbrMetallicRoughness.setBaseColorFactor(toRGB(e.target.value)); };
document.querySelector('#color-body').oninput = (e) => { const m = mv.model.materials.find(mat => mat.name.toLowerCase().includes("cor_caneca")); if(m) m.pbrMetallicRoughness.setBaseColorFactor(toRGB(e.target.value)); };
document.querySelector('#color-stamp').oninput = (e) => { const m = mv.model.materials.find(mat => mat.name.toLowerCase().includes("cor_arte")); if(m) m.pbrMetallicRoughness.setBaseColorFactor(toRGB(e.target.value)); };
document.querySelector('#color-base').oninput = (e) => { const m = mv.model.materials.find(mat => mat.name.toLowerCase().includes("cor_base")); if(m) m.pbrMetallicRoughness.setBaseColorFactor(toRGB(e.target.value)); };

document.querySelector('#metalic-toggle').onchange = (e) => {
    mv.model.materials.forEach(m => {
        if(!m.name.toLowerCase().includes("cor_base")) {
            m.pbrMetallicRoughness.setMetallicFactor(e.target.checked ? 1 : 0.1);
            m.pbrMetallicRoughness.setRoughnessFactor(e.target.checked ? 0.05 : 0.4);
        }
    });
};

// 2. CONTROLES DE CENÁRIO
document.querySelector('#color-bg').oninput = (e) => {
    hasCustomBg = true;
    currentBgColor = e.target.value;
    currentBgImage = null;
    container3d.style.backgroundImage = 'none';
    container3d.style.backgroundColor = currentBgColor;
};

document.querySelector('#upload-fundo').onchange = (e) => {
    const file = e.target.files[0];
    if(file) { 
        hasCustomBg = true;
        const url = URL.createObjectURL(file);
        container3d.style.backgroundImage = `url(${url})`; 
        container3d.style.backgroundSize = 'cover'; 
        container3d.style.backgroundPosition = 'center';
        const img = new Image();
        img.src = url;
        img.onload = () => { currentBgImage = img; };
    }
};

// 3. CROPPER DA ARTE
document.querySelector('#upload-arte').onchange = (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = document.querySelector('#crop-target');
            img.src = event.target.result;
            if (cropper) cropper.destroy();
            cropper = new Cropper(img, { viewMode: 1, autoCropArea: 1, crop() { applyTexture(cropper.getCroppedCanvas().toDataURL()); } });
        };
        reader.readAsDataURL(file);
    }
};

document.querySelector('#btn-zoom-in').onclick = () => { if(cropper) cropper.zoom(0.1); };
document.querySelector('#btn-zoom-out').onclick = () => { if(cropper) cropper.zoom(-0.1); };
document.querySelector('#btn-rotate').onclick = () => { if(cropper) cropper.rotate(90); };
document.querySelector('#btn-reset').onclick = () => { if(cropper) cropper.reset(); };

async function applyTexture(url) {
    const tex = await mv.createTexture(url);
    const m = mv.model.materials.find(mat => mat.name.toLowerCase().includes("cor_arte"));
    if (m && m.pbrMetallicRoughness.baseColorTexture) {
        m.pbrMetallicRoughness.baseColorTexture.setTexture(tex);
    }
}

// 4. NÚCLEO DE COMPOSIÇÃO: Mantém proporção perfeita sem distorcer e aplica fundo
function drawComposite(ctx, width, height, sourceCanvas) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.clearRect(0, 0, width, height);

    // Desenha Cenário
    if (hasCustomBg) {
        if (currentBgImage) {
            const scale = Math.max(width / currentBgImage.width, height / currentBgImage.height);
            const drawW = currentBgImage.width * scale;
            const drawH = currentBgImage.height * scale;
            ctx.drawImage(currentBgImage, (width - drawW) / 2, (height - drawH) / 2, drawW, drawH);
        } else {
            ctx.fillStyle = currentBgColor;
            ctx.fillRect(0, 0, width, height);
        }
    } else {
        const gradient = ctx.createRadialGradient(width/2, height/2, 0, width/2, height/2, width/2);
        gradient.addColorStop(0, "#ffffff");
        gradient.addColorStop(1, "#e0e0e0");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
    }

    if (!sourceCanvas) return;

    // Escala e carimba a Caneca 3D
    const srcW = sourceCanvas.width || sourceCanvas.clientWidth;
    const srcH = sourceCanvas.height || sourceCanvas.clientHeight;
    
    // Zoom seguro para preencher bem a tela Full HD sem cortar a alça
    const scale3D = Math.min(width / srcW, height / srcH) * 1.0; 
    const drawW = srcW * scale3D;
    const drawH = srcH * scale3D;
    ctx.drawImage(sourceCanvas, (width - drawW) / 2, (height - drawH) / 2, drawW, drawH);
}

// ==========================================
// MOTOR DE FOTO FULL HD
// ==========================================
document.querySelector('#btn-screenshot').onclick = async () => {
    mv.jumpCameraToGoal();
    await new Promise(r => setTimeout(r, 100)); // Pequena pausa pra GPU renderizar texturas

    const webglCanvas = mv.shadowRoot.querySelector('canvas');
    if (!webglCanvas) return;

    const photoCanvas = document.createElement('canvas');
    photoCanvas.width = 1920; 
    photoCanvas.height = 1080;
    const ctx = photoCanvas.getContext('2d');
    
    drawComposite(ctx, photoCanvas.width, photoCanvas.height, webglCanvas);
    
    const a = document.createElement('a');
    a.href = photoCanvas.toDataURL('image/png', 1.0);
    a.download = 'mockup-foto-FullHD.png';
    a.click();
};

// ==========================================
// MOTOR DE VÍDEO 360° (TRAVA DE TEMPO ABSOLUTA)
// ==========================================
document.querySelector('#btn-video').onclick = async () => {
    const webglCanvas = mv.shadowRoot.querySelector('canvas');
    if (!webglCanvas) return;

    videoLoader.style.display = 'flex';
    
    // Trava o ângulo exato que o cliente escolheu
    const orbit = mv.getCameraOrbit();
    const startTheta = orbit.theta * (180 / Math.PI); 
    const startPhi = orbit.phi;
    const startRadius = orbit.radius;

    const oldDecay = mv.interpolationDecay;
    mv.interpolationDecay = 0; 

    // Cria o estúdio de gravação invisível Full HD
    const captureCanvas = document.createElement('canvas');
    captureCanvas.width = 1920; 
    captureCanvas.height = 1080;
    const ctx = captureCanvas.getContext('2d');

    // Configura o gravador
    const stream = captureCanvas.captureStream(30);
    let options = { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 15000000 };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: 'video/webm', videoBitsPerSecond: 15000000 };
    }
    
    const recorder = new MediaRecorder(stream, options);
    const chunks = [];

    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
    recorder.onstop = () => {
        const blob = new Blob(chunks, { type: options.mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mockup-360-10s.webm`;
        a.click();
        URL.revokeObjectURL(url);
        
        videoLoader.style.display = 'none';
        mv.interpolationDecay = oldDecay;
        mv.cameraOrbit = `${startTheta}deg ${startPhi}rad ${startRadius}m`;
        mv.jumpCameraToGoal();
    };

    recorder.start();

    // Lógica do Motor: Obriga a durar 10 segundos, passo a passo
    const totalFrames = 300; // 10 segundos * 30 FPS
    let currentFrame = 0;

    // setInterval é o relógio absoluto do JavaScript. Ele vai rodar a cada 33 milissegundos.
    const engineInterval = setInterval(() => {
        if (currentFrame > totalFrames) {
            clearInterval(engineInterval);
            setTimeout(() => recorder.stop(), 300); // Dá tempo do último frame ser salvo
            return;
        }

        const progress = currentFrame / totalFrames;

        // Gira a câmera mantendo a posição inicial e o ângulo
        const currentAngle = startTheta + (progress * 360);
        mv.cameraOrbit = `${currentAngle}deg ${startPhi}rad ${startRadius}m`;
        mv.jumpCameraToGoal();

        // Extrai a imagem da GPU e joga no vídeo
        drawComposite(ctx, captureCanvas.width, captureCanvas.height, webglCanvas);

        timerText.innerText = Math.max(0, 10 - Math.floor(progress * 10)) + 's';
        currentFrame++;

    }, 33.33); // Exatamente 30 quadros por segundo
};
