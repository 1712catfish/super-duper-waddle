let ua = null, currentSession = null, incomingSession = null;
let registered = false, dialString = '';
let timerInterval = null, callSecs = 0;

JsSIP.debug.enable('JsSIP:*');


const PC_CONFIG = {
	iceServers: [{
		urls: 'turn:165.245.189.83:3478?transport=tcp',
		username: 'user',
		credential: 'pass'
	}],
	iceTransportPolicy: 'all'
}

// var ws = new WebSocket('wss://165.245.189.83:7443');
// ws.onopen = () => console.log('connected');
// ws.onerror = (e) => console.log('error', e);

// document.getElementById('sidebarToggle').addEventListener('click', () => {
// 	const sidebar = document.getElementById('sidebarLogin');
// 	const btn = document.getElementById('sidebarToggle');
// 	const collapsed = sidebar.classList.toggle('collapsed');
// 	btn.setAttribute('aria-expanded', String(!collapsed));
// 	btn.setAttribute('aria-label', collapsed ? 'Expand sidebar' : 'Collapse sidebar');
// });


function collapseSidebar() {
	document.getElementById('sidebarFull').style.display = 'none';
	document.getElementById('sidebarCollapsed').style.display = 'flex';
}

function expandSidebar() {
	document.getElementById('sidebarFull').style.display = 'flex';
	document.getElementById('sidebarCollapsed').style.display = 'none';
}


function switchTab(t) {
	['connect', 'dial'].forEach(id => {
		document.getElementById('tab' + id.charAt(0).toUpperCase() + id.slice(1)).classList.toggle('active', id === t);
		document.getElementById('panel' + id.charAt(0).toUpperCase() + id.slice(1)).classList.toggle('active', id === t);
	});
}

function setStatus(text, cls) {
	document.getElementById('statusBadge').className = 'status-badge ' + cls;
	document.getElementById('statusText').textContent = text;
}

function toggleConnect() {
	registered ? doDisconnect() : doConnect();
}

function doConnect() {
	const ws = document.getElementById('cfgWs').value.trim();
	const ext = document.getElementById('cfgExt').value.trim();
	const pass = document.getElementById('cfgPass').value.trim();
	const domain = document.getElementById('cfgDomain').value.trim();
	if (!ws || !ext || !domain) return;

	// JsSIP.debug.disable('JsSIP:*');
	const socket = new JsSIP.WebSocketInterface(ws);
	ua = new JsSIP.UA({
		sockets: [socket],
		uri: `sip:${ext}@${domain}`,
		password: pass,
		register: true,
		register_expires: 60,
		session_timers: false
	});

	setStatus('Connecting…', 'connecting');
	const btn = document.getElementById('btnConnect');
	btn.textContent = 'Connecting…';
	btn.disabled = true;

	ua.on('registered', () => {
		registered = true;
		setStatus('Online', 'connected');
		btn.textContent = 'Disconnect';
		btn.disabled = false;
		document.getElementById('btnCall').disabled = false;
	});
	ua.on('unregistered', () => {
		registered = false;
		setStatus('Offline', '');
		btn.textContent = 'Connect';
		btn.disabled = false;
		document.getElementById('btnCall').disabled = true;
	});
	ua.on('registrationFailed', () => {
		registered = false;
		setStatus('Failed', 'error');
		btn.textContent = 'Connect';
		btn.disabled = false;
	});
	ua.on('newRTCSession', ({session, originator}) => {
		if (originator === 'remote') showIncoming(session);
	});
	ua.start();
}

function doDisconnect() {
	if (ua) {
		ua.stop();
		ua = null;
	}
	registered = false;
	setStatus('Offline', '');
	const btn = document.getElementById('btnConnect');
	btn.textContent = 'Connect';
	btn.disabled = false;
	document.getElementById('btnCall').disabled = true;
	document.getElementById('btnHangup').disabled = true;
	stopTimer();
	document.getElementById('callBar').classList.remove('show');
}

function pressKey(k) {
	dialString += k;
	const el = document.getElementById('dialDisplay');
	el.textContent = dialString;
	el.classList.remove('empty');
	if (currentSession?.isEstablished()) currentSession.sendDTMF(k);
}

function clearDigit() {
	dialString = dialString.slice(0, -1);
	const el = document.getElementById('dialDisplay');
	if (!dialString) {
		el.textContent = 'Enter number…';
		el.classList.add('empty');
	} else el.textContent = dialString;
}

function makeCall() {
	if (!ua || !registered || !dialString) return;
	const domain = document.getElementById('cfgDomain').value.trim();
	const session = ua.call(`sip:${dialString}@${domain}`, {
		mediaConstraints: {audio: true, video: false},
		pcConfig: PC_CONFIG,
		sessionTimersExpires: 120,
		no_answer_timeout: 60
	});


	bindSession(session, dialString);
}

function showIncoming(session) {
	incomingSession = session;
	const caller = session.remote_identity.uri.user || 'Unknown';
	document.getElementById('popupCaller').textContent = caller;
	document.getElementById('popupOverlay').classList.add('show');
	session.on('ended', hidePopup);
	session.on('failed', hidePopup);
}

function answerCall() {
	if (!incomingSession) return;
	const caller = incomingSession.remote_identity.uri.user || 'Unknown';
	hidePopup();
	bindSession(incomingSession, caller);

	incomingSession.answer({
		mediaConstraints: {audio: true, video: false},
		pcConfig: PC_CONFIG,
	});
	incomingSession = null;
}

function declineCall() {
	if (incomingSession) {
		incomingSession.terminate();
		incomingSession = null;
	}
	hidePopup();
}

function hidePopup() {
	document.getElementById('popupOverlay').classList.remove('show');
}

function bindSession(session, label) {
	currentSession = session;
	document.getElementById('btnHangup').disabled = false;
	document.getElementById('btnCall').disabled = true;

	session.on('peerconnection', (e) => {
		const pc = e.peerconnection;

		pc.addEventListener('iceconnectionstatechange', () => {
			console.log('[ICE]', pc.iceConnectionState);
		});
		pc.addEventListener('icegatheringstatechange', () => {
			console.log('[GATHER]', pc.iceGatheringState);
		});
		pc.addEventListener('icecandidate', (ev) => {
			console.log('[CANDIDATE]', ev.candidate ? ev.candidate.candidate : 'null (gathering done)');
		});
		pc.addEventListener('signalingstatechange', () => {
			console.log('[SIGNAL]', pc.signalingState);
		});
		pc.addEventListener('connectionstatechange', () => {
			console.log('[CONN]', pc.connectionState);
		});
		pc.addEventListener('track', (ev) => {
			console.log('[TRACK] kind:', ev.track.kind, 'streams:', ev.streams.length, 'track state:', ev.track.readyState);
			ev.track.onunmute = () => console.log('[TRACK] unmuted');
			ev.track.onmute = () => console.log('[TRACK] muted');
			ev.track.onended = () => console.log('[TRACK] ended');

			const audio = document.getElementById('remoteAudio');
			audio.srcObject = ev.streams[0];
			audio.play().then(() => console.log('[AUDIO] playing'))
				.catch(e => console.warn('[AUDIO] play failed:', e));
		});

		// Check if tracks already exist (shouldn't happen but just in case)
		pc.getReceivers().forEach(r => {
			console.log('[EXISTING RECEIVER]', r.track?.kind, r.track?.readyState);
		});
	});

	session.on('confirmed', () => {
		startTimer();
		document.getElementById('callBarName').textContent = label;
		document.getElementById('callBar').classList.add('show');

		// Post-confirm diagnostics
		const pc = session.connection;
		if (pc) {
			console.log('[CONFIRMED] ICE:', pc.iceConnectionState, 'CONN:', pc.connectionState);
			pc.getReceivers().forEach(r => {
				console.log('[CONFIRMED RECEIVER]', r.track?.kind, r.track?.readyState, r.track?.muted);
			});
			pc.getStats().then(stats => {
				stats.forEach(s => {
					if (s.type === 'inbound-rtp') console.log('[STATS inbound]', s);
					if (s.type === 'candidate-pair' && s.state === 'succeeded') console.log('[STATS pair]', s);
				});
			});
		}
	});

	session.on('ended', endSession);
	session.on('failed', endSession);
}

function hangUp() {
	if (currentSession) {
		currentSession.terminate();
		currentSession = null;
	}
}

function endSession() {
	currentSession = null;
	stopTimer();
	document.getElementById('callBar').classList.remove('show');
	document.getElementById('btnHangup').disabled = true;
	document.getElementById('btnCall').disabled = !registered;
}

function startTimer() {
	callSecs = 0;
	clearInterval(timerInterval);
	timerInterval = setInterval(() => {
		callSecs++;
		const m = String(Math.floor(callSecs / 60)).padStart(2, '0');
		const s = String(callSecs % 60).padStart(2, '0');
		document.getElementById('callBarTimer').textContent = `${m}:${s}`;
	}, 1000);
}

function stopTimer() {
	clearInterval(timerInterval);
	timerInterval = null;
	document.getElementById('callBarTimer').textContent = '00:00';
}
