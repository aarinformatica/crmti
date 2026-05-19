// Configurações do Barramento Core de Mensageria
const ABLY_KEY = 'zfqwdA.QY0KxQ:_RQcTI6NCeRMNnLLyC8Ebb6Lg50xnDlcwvRv4wQ3H5o';
let ably = null;
let chatChannel = null;
let signalingChannel = null; 
let currentRole = null;
let currentToken = null;

// Instâncias WebRTC
let localStream = null;
let peerConnection = null;
let iceCandidatesQueue = []; 

const rtcConfig = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

document.addEventListener('DOMContentLoaded', () => {
    
    // Gerenciador de Autenticação na Viewport
    document.getElementById('btnLogin').addEventListener('click', () => {
        const user = document.getElementById('username').value.trim().toLowerCase();
        
        const loginScreen = document.getElementById('login-screen');
        const panelAdmin = document.getElementById('panel-admin');
        const panelCliente = document.getElementById('panel-cliente');
        
        if (user === 'admin') {
            currentRole = 'admin';
            loginScreen.style.display = 'none';
            panelAdmin.style.display = 'block';
            initSharedServices();
        } else if (user === 'cliente') {
            currentRole = 'cliente';
            loginScreen.style.display = 'none';
            panelCliente.style.display = 'block';
            initSharedServices();
        } else {
            alert('Acesso negado! Digite "admin" ou "cliente" para mapear os ambientes.');
        }
    });

    document.getElementById('btnGerarToken').addEventListener('click', gerarTokenAtendimento);
    document.getElementById('btnClientTransmit').addEventListener('click', iniciarTransmissaoCliente);

    // Listeners do Chat
    document.getElementById('btnAdminSend').addEventListener('click', sendChat);
    document.getElementById('btnClientSend').addEventListener('click', sendChat);
    
    document.getElementById('adminChatInput').addEventListener('keydown', (e) => { if(e.key === 'Enter') sendChat(); });
    document.getElementById('clientChatInput').addEventListener('keydown', (e) => { if(e.key === 'Enter') sendChat(); });
});

function initSharedServices() {
    ably = new window.Ably.Realtime(ABLY_KEY);
    chatChannel = ably.channels.get('netpulse-global-chat');
    
    chatChannel.subscribe('msg', (msg) => {
        renderChatMessage(msg.data.sender, msg.data.text);
    });
}

// ==========================================
// TOKEN (ADMINISTRADOR)
// ==========================================
function gerarTokenAtendimento() {
    currentToken = Math.floor(100000 + Math.random() * 900000).toString();
    
    const tokenDisplay = document.getElementById('adminTokenDisplay');
    if (tokenDisplay) {
        tokenDisplay.textContent = currentToken;
        tokenDisplay.style.color = '#22c55e';
    }

    conectarCanalSinalizacao(currentToken);
}

// ==========================================
// TRANSMISSÃO (CLIENTE)
// ==========================================
async function iniciarTransmissaoCliente() {
    const tokenInput = document.getElementById('clientTokenInput').value.trim();
    
    if (!tokenInput || tokenInput.length < 6) {
        alert('Por favor, insira o token de 6 dígitos gerado pelo painel do admin.');
        return;
    }

    try {
        localStream = await navigator.mediaDevices.getDisplayMedia({
            video: { 
                cursor: "always",
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: false
        });
        
        conectarCanalSinalizacao(tokenInput);
        criarPeerConnection();

        localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        signalingChannel.publish('webrtc-offer', { sdp: offer });

    } catch (err) {
        console.error("Erro na captura de tela:", err);
        alert("Falha ao iniciar transmissão. Verifique as permissões de tela do navegador.");
    }
}

// ==========================================
// SINALIZAÇÃO WEBRTC E MODAL DE ACEITE
// ==========================================
function conectarCanalSinalizacao(token) {
    if (!ably) return;

    signalingChannel = ably.channels.get(`signaling-${token}`);

    if (currentRole === 'admin') {
        
        // Ouvindo a oferta do cliente
        signalingChannel.subscribe('webrtc-offer', (msg) => {
            console.log("Oferta recebida. Disparando pop-up de aceite técnico.");
            exibirModalAceite(msg.data.sdp);
        });

        // Ouvindo candidatos ICE
        signalingChannel.subscribe('ice-candidate', async (msg) => {
            if (msg.data.candidate) {
                if (peerConnection && peerConnection.remoteDescription) {
                    await peerConnection.addIceCandidate(new RTCIceCandidate(msg.data.candidate));
                } else {
                    iceCandidatesQueue.push(msg.data.candidate);
                }
            }
        });

    } else if (currentRole === 'cliente') {
        
        signalingChannel.subscribe('webrtc-answer', async (msg) => {
            console.log("Conexão autorizada pelo técnico.");
            await peerConnection.setRemoteDescription(new RTCSessionDescription(msg.data.sdp));
        });

        signalingChannel.subscribe('ice-candidate', async (msg) => {
            if (peerConnection && msg.data.candidate && peerConnection.remoteDescription) {
                await peerConnection.addIceCandidate(new RTCIceCandidate(msg.data.candidate));
            }
        });
    }
}

// Criação dinâmica do modal na janela do Administrador
function exibirModalAceite(clientSdp) {
    // Cria o fundo escurecido
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.75)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = '9999';

    // Cria a caixa do alerta
    const modal = document.createElement('div');
    modal.style.background = '#161a22';
    modal.style.border = '2px solid #38bdf8';
    modal.style.padding = '30px';
    modal.style.borderRadius = '12px';
    modal.style.textAlign = 'center';
    modal.style.maxWidth = '400px';
    modal.style.boxShadow = '0 10px 25px rgba(0,0,0,0.5)';
    modal.style.color = '#f0f4f8';

    modal.innerHTML = `
        <i class="fa-solid fa-desktop" style="font-size: 40px; color: #22c55e; margin-bottom: 15px;"></i>
        <h3 style="margin-bottom: 10px; font-size: 20px;">Cliente Conectado</h3>
        <p style="font-size: 14px; color: #8892b0; margin-bottom: 20px; line-height: 1.4;">
            O usuário iniciou a transmissão e está aguardando sua autorização visual.
        </p>
        <button id="btnAceitarConexao" style="background: #22c55e; color: #000; border: none; padding: 12px 30px; font-size: 15px; font-weight: bold; border-radius: 6px; cursor: pointer; transition: 0.2s; width: 100%;">
            OK, Aceitar Transmissão
        </button>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Evento ao aceitar a transmissão
    document.getElementById('btnAceitarConexao').addEventListener('click', async () => {
        document.getElementById('adminPlaceholder').style.display = 'none';
        
        // Remove o modal da tela
        document.body.removeChild(overlay);

        // Inicializa e resolve o circuito WebRTC a partir da ação física
        criarPeerConnection();
        await peerConnection.setRemoteDescription(new RTCSessionDescription(clientSdp));
        
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        
        signalingChannel.publish('webrtc-answer', { sdp: answer });

        // Envia as rotas armazenadas em fila
        while (iceCandidatesQueue.length > 0) {
            const candidate = iceCandidatesQueue.shift();
            await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        }
    });
}

function criarPeerConnection() {
    peerConnection = new RTCPeerConnection(rtcConfig);

    peerConnection.onicecandidate = (event) => {
        if (event.candidate && signalingChannel) {
            signalingChannel.publish('ice-candidate', { candidate: event.candidate });
        }
    };

    peerConnection.ontrack = (event) => {
        const videoElement = document.getElementById('adminVideoStream');
        if (videoElement && event.streams[0]) {
            videoElement.srcObject = event.streams[0];
            videoElement.play().catch(e => console.log("Bloqueio de autoplay evitado pelo clique do modal.", e));
        }
    };
}

// ==========================================
// CHAT
// ==========================================
function sendChat() {
    if (currentRole === 'admin') {
        const input = document.getElementById('adminChatInput');
        const text = input.value.trim();
        if(!text) return;
        chatChannel.publish('msg', { sender: 'admin', text: text });
        input.value = '';
    } else {
        const input = document.getElementById('clientChatInput');
        const text = input.value.trim();
        if(!text) return;
        chatChannel.publish('msg', { sender: 'cliente', text: text });
        input.value = '';
    }
}

function renderChatMessage(sender, text) {
    const msgHtml = document.createElement('div');
    msgHtml.classList.add('msg');
    msgHtml.classList.add(sender === currentRole ? 'me' : 'other');
    msgHtml.textContent = text;
    
    if (currentRole === 'admin') {
        const box = document.getElementById('adminChatMessages');
        box.appendChild(msgHtml);
        box.scrollTop = box.scrollHeight;
    } else {
        const box = document.getElementById('clientChatMessages');
        box.appendChild(msgHtml);
        box.scrollTop = box.scrollHeight;
    }
}
