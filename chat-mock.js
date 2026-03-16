// ── Mock conversation data ──────────────────────────────────────────────────

const MOCK_CONVERSATION = {
	caller: "+84 90 123 4567",
	agent: "tanhn",
	another_agent: "nhutnm",
	route: "fs1 conference",
	startTime: new Date(Date.now() - 4 * 60 * 1000), // started 4 min ago
	tags: [
		{type: "intent", label: "Order tracking"},
		{type: "sentiment", label: "Positive"},
	],
	messages: [
		{speaker: "another-agent", text: "Xin chào, tôi có thể giúp gì cho bạn hôm nay?", delay: 0},
		{speaker: "customer", text: "Vâng, tôi muốn hỏi về trạng thái đơn hàng số 48291 của tôi.", delay: 1200},
		{speaker: "another-agent", text: "Để tôi kiểm tra ngay cho bạn, vui lòng chờ một chút.", delay: 2000},
		{speaker: "customer", text: "Dạ, đơn hàng đó tôi đặt từ tuần trước mà chưa thấy cập nhật gì cả.", delay: 2800},
		// {speaker: "divider", text: "AI joined", delay: 3400},
		{
			speaker: "agent",
			text: "Đơn hàng 48291 đang ở kho phân phối tại Bình Dương, dự kiến giao ngày mai trước 12h.",
			delay: 4200
		},
		{speaker: "customer", text: "Ôi vậy thì tốt quá, cảm ơn bạn nhiều!", delay: 5000},
		{speaker: "agent", text: "Không có gì, bạn cần hỗ trợ thêm gì không ạ?", delay: 5600},
		{speaker: "customer", text: "Dạ không, vậy là đủ rồi ạ.", delay: 6400},
		{speaker: "agent", text: "Cảm ơn bạn đã liên hệ. Chúc bạn một ngày tốt lành!", delay: 7200},
	]
};


// ── Helpers ─────────────────────────────────────────────────────────────────

function fmtTime(date) {
	return date.toLocaleTimeString('vi-VN', {hour: '2-digit', minute: '2-digit'});
}

function fmtElapsed(seconds) {
	const m = String(Math.floor(seconds / 60)).padStart(2, '0');
	const s = String(seconds % 60).padStart(2, '0');
	return `${m}:${s}`;
}


// ── DOM builders ─────────────────────────────────────────────────────────────

function buildDivider(label) {
	const el = document.createElement('div');
	el.className = 'chat-divider';
	el.innerHTML = `
        <div class="chat-divider-line"></div>
        <div class="chat-divider-label">${label}</div>
        <div class="chat-divider-line"></div>`;
	return el;
}

function buildMessage(speaker, text, time) {
	const isAgent = speaker === 'agent' | speaker === 'another-agent';
	const row = document.createElement('div');
	row.className = 'msg-row';
	row.title = time

	// ${isAgent ? `<span class="msg-time">${time}</span>` : ''}
	// ${!is  Agent ? `<span class="msg-time">${time}</span>` : ''}

	let nameTag;
	if (speaker === 'agent') {
		nameTag = MOCK_CONVERSATION.agent;
	} else if (speaker === 'another-agent') {
		nameTag = MOCK_CONVERSATION.another_agent
	} else if (speaker === 'customer') {
		nameTag = 'a Khánh'
	}

	row.innerHTML = `
        <div class="bubble-wrap ${isAgent ? 'right' : ''}">
					<div class="msg-speaker ${speaker}">${nameTag}</div>
          <div class="bubble ${speaker}">${text}</div>
        </div>`;
	return row;
}

function buildTag(type, label) {
	const tag = document.createElement('span');
	tag.className = `chat-tag ${type}`;
	tag.textContent = label;
	return tag;
}


// ── Init ─────────────────────────────────────────────────────────────────────

function initChat() {
	const conv = MOCK_CONVERSATION;

	// Header
	document.getElementById('chatCallerName').textContent = conv.caller;
	document.getElementById('chatMetaInfo').textContent =
		`Agent: ${conv.agent} · Via ${conv.route}`;

	// Start divider
	document.getElementById('chatStartLabel').textContent =
		`Call started · ${fmtTime(conv.startTime)}`;

	// Elapsed timer
	startElapsedTimer(conv.startTime);

	// Call bar name
	document.getElementById('callBarName').textContent = conv.caller;

	// Stream messages with delays
	const chatBody = document.getElementById('chatBody');
	let msgIndex = 0;

	function next() {
		if (msgIndex >= conv.messages.length) {
			// All messages done — inject tags
			setTimeout(() => injectTags(conv.tags), 400);
			return;
		}
		const msg = conv.messages[msgIndex++];
		const wait = msgIndex === 1 ? msg.delay : msg.delay - conv.messages[msgIndex - 2].delay;

		setTimeout(() => {
			if (msg.speaker === 'divider') {
				chatBody.appendChild(buildDivider(msg.text));
			} else {
				const time = fmtTime(new Date(conv.startTime.getTime() + msg.delay));
				chatBody.appendChild(buildMessage(msg.speaker, msg.text, time));
			}
			chatBody.scrollTop = chatBody.scrollHeight;
			next();
		}, Math.max(wait, 0));
	}

	next();
}

function injectTags(tags) {
	const container = document.getElementById('chatTags');
	tags.forEach(t => container.appendChild(buildTag(t.type, t.label)));
}

function startElapsedTimer(startTime) {
	const durEl = document.getElementById('chatMetaDur');
	const timerEl = document.getElementById('callBarTimer');

	function tick() {
		const secs = Math.floor((Date.now() - startTime.getTime()) / 1000);
		const str = fmtElapsed(secs);
		if (durEl) durEl.textContent = str + ' elapsed';
		if (timerEl) timerEl.textContent = str;
	}

	tick();
	setInterval(tick, 1000);
}


// ── Public API ────────────────────────────────────────────────────────────────
// Call appendLiveMessage() from your ASR pipeline to push real-time transcripts.

function appendLiveMessage(speaker, text) {
	const chatBody = document.getElementById('chatBody');
	const time = fmtTime(new Date());
	chatBody.appendChild(buildMessage(speaker, text, time));
	chatBody.scrollTop = chatBody.scrollHeight;
}

function appendDivider(label) {
	const chatBody = document.getElementById('chatBody');
	chatBody.appendChild(buildDivider(label));
	chatBody.scrollTop = chatBody.scrollHeight;
}

function addTag(type, label) {
	document.getElementById('chatTags').appendChild(buildTag(type, label));
}


// ── Auto-run on load ──────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', initChat);