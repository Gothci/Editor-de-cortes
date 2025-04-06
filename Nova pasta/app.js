// Configuração robusta do FFmpeg
const { createFFmpeg, fetchFile } = FFmpeg;

// 1. Configuração de paths com fallback
const FFMPEG_CORE_PATHS = [
    {
        core: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js',
        wasm: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.11.0/dist/ffmpeg-core.wasm'
    },
    {
        core: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js',
        wasm: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.wasm'
    },
    {
        core: './assets/ffmpeg/ffmpeg-core.js',
        wasm: './assets/ffmpeg/ffmpeg-core.wasm'
    }
];

// 2. Função para verificar disponibilidade de recursos
async function checkResource(url) {
    try {
        const response = await fetch(url, { method: 'HEAD' });
        return response.ok;
    } catch {
        return false;
    }
}

// 3. Função para carregar FFmpeg com tentativas múltiplas
async function loadFFmpegWithRetry() {
    let lastError = null;
    
    for (const path of FFMPEG_CORE_PATHS) {
        try {
            updateStatus(`Tentando carregar FFmpeg de: ${path.core}`, 'warning');
            
            // Verifica se o recurso está disponível
            const isAvailable = await checkResource(path.core);
            if (!isAvailable) {
                console.warn(`Recurso não disponível: ${path.core}`);
                continue;
            }
            
            const ffmpeg = createFFmpeg({
                log: true,
                corePath: path.core,
                wasmPath: path.wasm,
                mt: false // Desativa multithreading para evitar SharedArrayBuffer
            });
            
            await ffmpeg.load();
            updateStatus("FFmpeg carregado com sucesso!", 'success');
            return ffmpeg;
        } catch (error) {
            console.error(`Falha ao carregar de ${path.core}:`, error);
            lastError = error;
        }
    }
    
    throw lastError || new Error("Nenhuma fonte de FFmpeg disponível");
}

// 4. Função para atualizar o status
function updateStatus(message, type = 'info') {
    const statusElement = document.getElementById('status');
    statusElement.textContent = message;
    statusElement.className = type;
    console.log(`[${type}] ${message}`);
}

// 5. Inicialização do FFmpeg
let ffmpegInstance = null;

async function initializeFFmpeg() {
    try {
        // Verifica se estamos em um contexto seguro
        const isLocalhost = window.location.hostname === 'localhost' || 
                          window.location.hostname === '127.0.0.1';
        
        if (!isLocalhost && window.location.protocol !== 'https:') {
            updateStatus("⚠️ Execute via HTTPS ou localhost para melhor compatibilidade", "warning");
        }
        
        // Carrega o FFmpeg
        ffmpegInstance = await loadFFmpegWithRetry();
        document.getElementById('processBtn').disabled = false;
        
    } catch (error) {
        updateStatus(`Falha crítica: ${error.message}`, 'error');
        console.error("Erro na inicialização:", error);
        
        // Adiciona instruções detalhadas
        const statusElement = document.getElementById('status');
        statusElement.innerHTML += `
            <h3>Soluções possíveis:</h3>
            <ol>
                <li>Execute com um servidor local:
                    <pre>npx live-server --cors</pre>
                </li>
                <li>Baixe os arquivos manualmente:
                    <ul>
                        <li><a href="https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js" download>ffmpeg-core.js</a></li>
                        <li><a href="https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.11.0/dist/ffmpeg-core.wasm" download>ffmpeg-core.wasm</a></li>
                    </ul>
                    Coloque na pasta <code>assets/ffmpeg/</code>
                </li>
                <li>Atualize seu navegador para a versão mais recente</li>
            </ol>
        `;
        
        throw error;
    }
}

// 6. Função para processar vídeo (exemplo simplificado)
async function processVideo() {
    if (!ffmpegInstance) {
        alert("FFmpeg não está carregado. Aguarde a inicialização.");
        return;
    }
    
    const videoFile = document.getElementById('videoInput').files[0];
    if (!videoFile) {
        alert("Por favor, selecione um vídeo primeiro!");
        return;
    }
    
    updateStatus("Processando vídeo...", 'warning');
    
    try {
        // Escreve o arquivo no sistema de arquivos virtual
        const data = await fetchFile(videoFile);
        ffmpegInstance.FS('writeFile', 'input.mp4', data);
        
        // Processamento simples (extrai os primeiros 10 segundos)
        await ffmpegInstance.run(
            '-i', 'input.mp4',
            '-t', '10',
            '-c', 'copy',
            'output.mp4'
        );
        
        // Lê o resultado
        const outputData = ffmpegInstance.FS('readFile', 'output.mp4');
        const videoUrl = URL.createObjectURL(
            new Blob([outputData.buffer], { type: 'video/mp4' })
        );
        
        // Exibe o resultado
        const resultsDiv = document.getElementById('results');
        resultsDiv.innerHTML = `
            <h2>Resultado:</h2>
            <video controls width="400" src="${videoUrl}"></video>
            <div>
                <button onclick="downloadVideo('${videoUrl}', 'video_editado.mp4')">Download</button>
            </div>
        `;
        
        updateStatus("Processamento concluído com sucesso!", 'success');
    } catch (error) {
        updateStatus(`Erro no processamento: ${error.message}`, 'error');
        console.error("Erro no processamento:", error);
    }
}

// Função auxiliar para download
window.downloadVideo = function(url, filename) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
};

// Inicializa quando a página carrega
document.addEventListener('DOMContentLoaded', initializeFFmpeg);
document.getElementById('processBtn').addEventListener('click', processVideo);