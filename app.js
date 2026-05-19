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

const rtcConfig = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

document.addEventListener('DOMContentLoaded', () => {
    
    // Gerenciador de Autenticação
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
            alert('Acesso negado! Digite "admin" ou "cliente".');
        }
    });

    document.getElementById('btnGerarToken').addEventListener('click', gerarTokenAtendimento);
    document.getElementById('btnClientTransmit').addEventListener('click', iniciarTransmissaoCliente);

    // Chat Listeners
    document.getElementById('btnAdminSend').addEventListener('click', sendChat);
    document.getElementById('btnClientSend').addEventListener('click', sendChat);
    
    document.getElementById('adminChatInput').addEventListener('keydown', (e) => { if(e.key === 'Enter') sendChat(); });
    document.getElementById('clientChatInput').addEventListener('keydown', (e) => { if(e.key === 'Enter') sendChat(); });
});

function initSharedServices() {
    ably = new window.Ably.Realtime(ABLY_KEY);
    chatChannel = ably.channels.get('netpulse-global-chat');
    
    // Escuta global do chat e de alertas de conexão
    chatChannel.subscribe('msg', (msg) => {
        renderChatMessage(msg.data.sender, msg.data.text);
    });

    // O canal global ouve o pedido do cliente para garantir que o Admin receba mesmo se canais dinâmicos falharem
    chatChannel.subscribe('alerta-conexao', (msg) => {
        if (currentRole === 'admin' && currentToken && msg.data.token === currentToken) {
            console.log("Alerta global recebido. Token confere! Abrindo modal.");
            exibirModalAceite();
        }
    });
}

// ==========================================
// TOKENS (ADMIN)
// ==========================================
function gerarTokenAtendimento() {
    currentToken = Math.floor(100000 + Math.random() * 900000).toString();
    const tokenDisplay = document.getElementById('adminTokenDisplay');
    if (tokenDisplay) {
        tokenDisplay.textContent = currentToken;
        tokenDisplay.style.color = '#22c55e';
    }
    // Cria o canal de sinalização para quando o WebRTC começar
    signalingChannel = ably.channels.get(`signaling-${currentToken}`);
    configurarEscutasWebRTC();
}

// ==========================================
// SOLICITAÇÃO DE MÍDIA (CLIENTE)
// ==========================================
async function iniciarTransmissaoCliente() {
    const tokenInput = document.getElementById('clientTokenInput').value.trim();
    
    if (!tokenInput || tokenInput.length < 6) {
        alert('Insira o token de 6 dígitos gerado pelo admin.');
        return;
    }

    try {
        // Captura a tela primeiro
        localStream = await navigator.mediaDevices.getDisplayMedia({
            video: { cursor: "always" },
            audio: false
        });
        
        signalingChannel = ably.channels.get(`signaling-${tokenInput}`);
        configurarEscutasWebRTC();
        
        // Envia o alerta usando o canal global (garante a entrega e ativa o modal do Admin)
        chatChannel.publish('alerta-conexao', { token: tokenInput });
        console.log("Solicitação enviada via canal core. Aguardando aceite do técnico...");

    } catch (err) {
        console.error("Erro na captura de tela:", err);
        alert("Para transmitir, selecione uma tela na janela flutuante.");
    }
}

// ==========================================
// CORE SINALIZAÇÃO WEBRTC
// ==========================================
function configurarEscutasWebRTC() {
    if (!signalingChannel) return;

    if (currentRole === 'admin') {
        
        // Recebe a oferta de vídeo do cliente
        signalingChannel.subscribe('sdp-offer', async (msg) => {
            console.log("Oferta recebida. Abrindo conexão WebRTC...");
            
            criarPeerConnection();
            await peerConnection.setRemoteDescription(new RTCSessionDescription(msg.data.sdp));
            
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            
            signalingChannel.publish('sdp-answer', { sdp: answer });
        });

        // Recebe caminhos de rede
        signalingChannel.subscribe('candidate', async (msg) => {
            if (peerConnection && msg.data.candidate) {
                try {
                    await peerConnection.addIceCandidate(new RTCIceCandidate(msg.data.candidate));
                } catch(e) { console.warn("Sincronizando rede..."); }
            }
        });

    } else if (currentRole === 'cliente') {
        
        // Recebe o sinal de que o Admin clicou em OK no modal
        signalingChannel.subscribe('admin-autorizou', async () => {
            console.log("Admin aceitou no modal! Transmitindo dados de mídia...");
            
            criarPeerConnection();
            localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);

            signalingChannel.publish('sdp-offer', { sdp: offer });
        });

        // Recebe a resposta final do Admin
        signalingChannel.subscribe('sdp-answer', async (msg) => {
            console.log("Circuito WebRTC finalizado!");
            await peerConnection.setRemoteDescription(new RTCSessionDescription(msg.data.sdp));
        });

        signalingChannel.subscribe('candidate', async (msg) => {
            if (peerConnection && msg.data.candidate) {
                try {
                    await peerConnection.addIceCandidate(new RTCIceCandidate(msg.data.candidate));
                } catch(e) { console.warn("Sincronizando rede..."); }
            }
        });
    }
}

function criarPeerConnection() {
    peerConnection = new RTCPeerConnection(rtcConfig);

    peerConnection.onicecandidate = (event) => {
        if (event.candidate && signalingChannel) {
            signalingChannel.publish('candidate', { candidate: event.candidate });
        }
    };

    if (currentRole === 'admin') {
        peerConnection.ontrack = (event) => {
            console.log("Stream de vídeo acoplado ao painel do Admin!");
            const videoElement = document.getElementById('adminVideoStream');
            if (videoElement && event.streams[0]) {
                videoElement.srcObject = event.streams[0];
                
                setTimeout(() => {
                    videoElement.play().catch(err => console.error("Erro ao forçar play:", err));
                }, 150);
            }
        };
    }
}

// ==========================================
// UI - MODAL DINÂMICO
// ==========================================
function exibirModalAceite() {
    if (document.getElementById('modal-webrtc-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'modal-webrtc-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0'; overlay.style.left = '0';
    overlay.style.width = '100vw'; overlay.style.height = '100vh';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.85)';
    overlay.style.display = 'flex'; overlay.style.alignItems = 'center'; overlay.style.justifyContent = 'center';
    overlay.style.zIndex = '9999';

    const modal = document.createElement('div');
    modal.style.background = '#161a22';
    modal.style.border = '2px solid #22c55e';
    modal.style.padding = '30px';
    modal.style.borderRadius = '12px';
    modal.style.textAlign = 'center';
    modal.style.maxWidth = '400px';
    modal.style.color = '#f0f4f8';

    modal.innerHTML = `
        <div style="font-size: 45px; margin-bottom: 15px;">🖥️</div>
        <h3 style="margin-bottom: 10px; font-size: 22px; font-family: sans-serif; color: #22c55e;">Suporte Solicitado</h3>
        <p style="font-size: 14px; color: #8892b0; margin-bottom: 25px; line-height: 1.5; font-family: sans-serif;">
            O cliente inseriu o token com sucesso e está aguardando você autorizar o recebimento da tela dele.
        </p>
        <button id="btnAceitarConexao" style="background: #22c55e; color: #000; border: none; padding: 12px 30px; font-size: 15px; font-weight: bold; border-radius: 6px; cursor: pointer; width: 100%;">
            Visualizar Tela do Cliente
        </button>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    document.getElementById('btnAceitarConexao').addEventListener('click', () => {
        const placeholder = document.getElementById('adminPlaceholder');
        if (placeholder) placeholder.style.display = 'none';
        
        document.body.removeChild(overlay);

        // Envia a confirmação para o cliente começar o streaming
        if (signalingChannel) {
            signalingChannel.publish('admin-autorizou', { autorizado: true });
        }
    });
}

// ==========================================
// CHAT GLOBAL
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
        const text = text = input.value.trim();
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
