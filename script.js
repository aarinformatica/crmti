document.addEventListener('DOMContentLoaded', () => {
    initIdentification();
    initDigitalClock();
    initPlatformAccess(); 
    initSmartphoneOS(); 
    initSettings(); 
    initMapLoader(); 
});

// Variáveis globais para o mapa
let map;
let userMarker;
let watchID;

function createPulseIcon() {
    const userColor = localStorage.getItem('syl_marker_color') || '#00ff00';
    return L.divIcon({
        className: 'user-pulse-marker',
        html: `<div style="background-color: ${userColor}; width: 100%; height: 100%; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.3);"></div>`,
        iconSize: [10, 10]
    });
}

function initIdentification() {
    const modal = document.getElementById('identification-modal');
    const dashboard = document.getElementById('dashboard-content');
    const input = document.getElementById('user-name-input');
    const btnContinue = document.getElementById('btn-continue');
    const welcomeName = document.getElementById('welcome-username');

    if (!modal || !btnContinue || !input) return;

    input.focus();

    function processLogin() {
        const username = input.value.trim();
        if (username === '') {
            input.style.borderColor = '#ef4444';
            input.style.boxShadow = '0 0 15px rgba(239, 68, 68, 0.3)';
            setTimeout(() => {
                input.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                input.style.boxShadow = 'none';
            }, 1000);
            return;
        }
        if (welcomeName) welcomeName.textContent = username;
        modal.style.opacity = '0';
        modal.style.visibility = 'hidden';
        dashboard.classList.remove('dashboard-hidden');
        dashboard.classList.add('dashboard-visible');
    }

    btnContinue.addEventListener('click', processLogin);
    input.addEventListener('keypress', (e) => { if (e.key === 'Enter') processLogin(); });
}

function initDigitalClock() {
    const clockElement = document.getElementById('digital-clock');
    if (!clockElement) return;
    function updateClock() {
        const now = new Date();
        clockElement.textContent = now.toTimeString().split(' ')[0];
    }
    updateClock();
    setInterval(updateClock, 1000);
}

function initPlatformAccess() {
    const btnAccess = document.getElementById('btn-access-platform');
    const btnLogout = document.getElementById('btn-menu-logout');
    const presView = document.getElementById('presentation-view');
    const portalView = document.getElementById('portal-view');
    const loadingScreen = document.getElementById('loading-screen');
    const menuScreen = document.getElementById('app-menu-screen');
    const progressBar = document.getElementById('main-progress-bar');
    const progressText = document.getElementById('progress-percentage');
    const menuUserDisplay = document.getElementById('menu-username-display');
    const appHeader = document.querySelector('.app-header');
    const appFooter = document.querySelector('.app-footer');
    const dashboardWrapper = document.getElementById('dashboard-content');
    const mainSectionLayout = document.getElementById('main-section-layout');
    
    const logoutModal = document.getElementById('logout-confirm-modal');
    const btnLogoutYes = document.getElementById('btn-logout-yes');
    const btnLogoutNo = document.getElementById('btn-logout-no');

    if (!btnAccess) return;

    btnAccess.addEventListener('click', () => {
        const currentUsername = document.getElementById('welcome-username')?.textContent || 'Pedestre';
        presView.classList.add('display-none');
        portalView.classList.add('display-none');
        loadingScreen.classList.remove('display-none');
        
        let progress = 0;
        const interval = setInterval(() => {
            progress += 2;
            progressBar.style.width = `${progress}%`;
            progressText.textContent = `${progress}%`;
            if (progress >= 100) {
                clearInterval(interval);
                loadingScreen.classList.add('display-none');
                if (menuUserDisplay) menuUserDisplay.textContent = currentUsername.toUpperCase();
                appHeader?.classList.add('hide-elements');
                appFooter?.classList.add('hide-elements');
                mainSectionLayout?.classList.add('display-none');
                dashboardWrapper?.classList.add('immersive-mode');
                menuScreen.classList.remove('display-none');
            }
        }, 30);
    });

    btnLogout?.addEventListener('click', () => { if(logoutModal) logoutModal.classList.remove('display-none'); });
    btnLogoutNo?.addEventListener('click', () => { logoutModal.classList.add('display-none'); });
    
    // CORREÇÃO LOGOUT PARA CODEPEN: Reset de estado manual seguro
    btnLogoutYes?.addEventListener('click', () => { 
        if (logoutModal) logoutModal.classList.add('display-none');

        // 1. Limpa rastreamento de geolocalização e destroi mapa se ativos
        if (watchID) navigator.geolocation.clearWatch(watchID);
        if (map) { map.remove(); map = null; userMarker = null; }

        // 2. Oculta containers internos e telas auxiliares
        document.getElementById('map-container')?.classList.add('display-none');
        document.getElementById('map-exit-modal')?.classList.add('display-none');
        document.getElementById('settings-modal')?.classList.add('display-none');
        menuScreen?.classList.add('display-none');

        // 3. Remove modificações estéticas globais
        dashboardWrapper?.classList.remove('immersive-mode');
        appHeader?.classList.remove('hide-elements');
        appFooter?.classList.remove('hide-elements');

        // 4. Restaura a visualização padrão do painel interno inicial
        presView?.classList.remove('display-none');
        portalView?.classList.remove('display-none');
        mainSectionLayout?.classList.remove('display-none');

        // 5. Zera barras de progresso internas para futuras sessões
        if (progressBar) progressBar.style.width = '0%';
        if (progressText) progressText.textContent = '0%';

        // 6. Traz a tela de identificação de volta limpando o input anterior
        const modalId = document.getElementById('identification-modal');
        const inputName = document.getElementById('user-name-input');
        if (inputName) inputName.value = '';
        if (modalId) {
            modalId.style.opacity = '1';
            modalId.style.visibility = 'visible';
        }
        
        // 7. Retorna o dashboard ao estado oculto inicial
        dashboardWrapper?.classList.remove('dashboard-visible');
        dashboardWrapper?.classList.add('dashboard-hidden');
    });
}

function initMapLoader() {
    const btnMap = document.querySelector('.item-green');
    const mapLoadingScreen = document.getElementById('map-loading-screen');
    const mapContainer = document.getElementById('map-container');
    const progressBar = document.getElementById('map-progress-bar');
    const progressText = document.getElementById('map-progress-percentage');
    const loadingText = document.getElementById('map-loading-text');
    const appHeader = document.querySelector('.app-header');
    const appFooter = document.querySelector('.app-footer');
    const menuScreen = document.getElementById('app-menu-screen');

    const exitModal = document.getElementById('map-exit-modal');
    const btnOpenExit = document.getElementById('btn-open-exit-modal');
    const btnExitYes = document.getElementById('btn-map-exit-yes');
    const btnExitNo = document.getElementById('btn-map-exit-no');

    if (!btnMap || !mapLoadingScreen) return;
    
    if (btnOpenExit) btnOpenExit.style.display = 'none';

    btnMap.addEventListener('click', () => {
        mapLoadingScreen.classList.remove('display-none');
        menuScreen.classList.add('display-none');
        let progress = 0;
        const phases = [
            { p: 20, t: "Sincronizando satélites..." },
            { p: 50, t: "Carregando zonas de risco..." },
            { p: 80, t: "Aplicando filtros de segurança..." },
            { p: 100, t: "Mapa pronto!" }
        ];

        const interval = setInterval(() => {
            progress += 1;
            if (progressBar) progressBar.style.width = `${progress}%`;
            if (progressText) progressText.textContent = `${progress}%`;
            phases.forEach(ph => { if (progress === ph.p && loadingText) loadingText.textContent = ph.t; });

            if (progress >= 100) {
                clearInterval(interval);
                mapLoadingScreen.classList.add('display-none');
                mapContainer?.classList.remove('display-none');
                
                appHeader?.classList.remove('hide-elements');
                appFooter?.classList.remove('hide-elements');
                if (btnOpenExit) btnOpenExit.style.display = 'block';
                
                if (!map) {
                    map = L.map('map-container').setView([-23.5333, -46.3500], 15);
                    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
                    if (navigator.geolocation) {
                        watchID = navigator.geolocation.watchPosition((pos) => {
                            const latLng = [pos.coords.latitude, pos.coords.longitude];
                            if (!userMarker) {
                                userMarker = L.marker(latLng, { icon: createPulseIcon() }).addTo(map);
                                map.setView(latLng, 17);
                            } else {
                                userMarker.setLatLng(latLng);
                            }
                        }, null, { enableHighAccuracy: true });
                    }
                }
            }
        }, 30);
    });

    btnOpenExit?.addEventListener('click', () => exitModal?.classList.remove('display-none'));
    btnExitNo?.addEventListener('click', () => exitModal?.classList.add('display-none'));
    btnExitYes?.addEventListener('click', () => {
        if (watchID) navigator.geolocation.clearWatch(watchID);
        if (map) { map.remove(); map = null; userMarker = null; }
        
        mapContainer?.classList.add('display-none');
        exitModal?.classList.add('display-none');
        menuScreen?.classList.remove('display-none');
        
        appHeader?.classList.add('hide-elements');
        appFooter?.classList.add('hide-elements');
        if (btnOpenExit) btnOpenExit.style.display = 'none';
    });
}

function initSmartphoneOS() {
    const timeDisplay = document.getElementById('phone-time');
    const updateTime = () => {
        if (!timeDisplay) return;
        timeDisplay.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };
    setInterval(updateTime, 1000);
    updateTime();
}

function initSettings() {
    const btnSettings = document.querySelector('.item-amber');
    const settingsModal = document.getElementById('settings-modal');
    const btnSave = document.getElementById('btn-save-settings');
    const colorPicker = document.getElementById('marker-color-picker');
    const modeSelect = document.getElementById('alert-mode-select');

    if (btnSave && !document.getElementById('btn-text')) btnSave.innerHTML = '<span id="btn-text">Salvar Alterações</span>';
    const btnText = document.getElementById('btn-text');

    btnSettings?.addEventListener('click', () => {
        colorPicker.value = localStorage.getItem('syl_marker_color') || '#00ff00';
        modeSelect.value = localStorage.getItem('syl_alert_mode') || 'both';
        settingsModal?.classList.remove('display-none');
    });

    btnSave?.addEventListener('click', () => {
        btnSave.disabled = true;
        btnText.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sincronizando...';
        setTimeout(() => {
            localStorage.setItem('syl_marker_color', colorPicker.value);
            localStorage.setItem('syl_alert_mode', modeSelect.value);
            btnText.textContent = "✓ Aplicado";
            btnSave.style.backgroundColor = "#10b981";
            setTimeout(() => {
                settingsModal.classList.add('display-none');
                btnSave.disabled = false;
                btnText.textContent = "Salvar Alterações";
                btnSave.style.backgroundColor = "";
            }, 1000);
        }, 1500);
    });
}
