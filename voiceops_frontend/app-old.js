import {
  TranscribeStreamingClient,
  StartStreamTranscriptionCommand
} from "@aws-sdk/client-transcribe-streaming";

import { fromCognitoIdentityPool } from "@aws-sdk/credential-provider-cognito-identity";
import { CognitoIdentityClient } from "@aws-sdk/client-cognito-identity";
import Chart from "chart.js/auto";

const cfg = window.VOICEOPS_CONFIG || {};

const els = {
  serviceGrid: document.getElementById("serviceGrid"),
  serviceMeta: document.getElementById("serviceMeta"),
  chartTitle: document.getElementById("chartTitle"),
  chartSubtitle: document.getElementById("chartSubtitle"),
  chartEmpty: document.getElementById("chartEmpty"),
  metricSelect: document.getElementById("metricSelect"),
  queryInput: document.getElementById("queryInput"),
  askBtn: document.getElementById("askBtn"),
  micBtn: document.getElementById("micBtn"),
  micLabel: document.getElementById("micLabel"),
  voiceStatus: document.getElementById("voiceStatus"),
  voiceDot: document.getElementById("voiceDot"),
  diagnosis: document.getElementById("diagnosis"),
  responseBadge: document.getElementById("responseBadge"),
  selectedServiceLabel: document.getElementById("selectedServiceLabel"),
  backendStatus: document.getElementById("backendStatus"),
  logCount: document.getElementById("logCount"),
  kbCount: document.getElementById("kbCount"),
  metricCount: document.getElementById("metricCount"),
  metricEvidence: document.getElementById("metricEvidence"),
  clearContextBtn: document.getElementById("clearContextBtn"),
  stopAudioBtn: document.getElementById("stopAudioBtn"),
  refreshServicesBtn: document.getElementById("refreshServicesBtn")
};

let services = [];
let selectedService = null;
let chart = null;
let currentAudio = null;
let transcribeAbortController = null;
let microphoneStream = null;
let audioContext = null;
let refreshTimer = null;

function getApiBaseUrl() {
  if (cfg.apiBaseUrl && !cfg.apiBaseUrl.startsWith("REPLACE_")) {
    return cfg.apiBaseUrl.replace(/\/$/, "");
  }

  if (cfg.apiEndpoint && !cfg.apiEndpoint.startsWith("REPLACE_")) {
    return cfg.apiEndpoint.replace(/\/command\/?$/, "").replace(/\/$/, "");
  }

  return "";
}

function setBackendStatus(text, state = "neutral") {
  els.backendStatus.textContent = text;
  els.backendStatus.dataset.state = state;
}

function statusClass(status) {
  const normalized = String(status || "NO_DATA").toUpperCase();
  if (normalized === "HEALTHY") return "healthy";
  if (normalized === "DEGRADED") return "degraded";
  if (normalized === "CRITICAL") return "critical";
  if (normalized === "STALE") return "stale";
  return "no-data";
}

function formatMetric(name, value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  const number = Number(value);

  if (name === "Latency" || name === "Duration") return `${formatNumber(number)} ms`;
  if (name === "ErrorRate" || name.includes("CPU") || name.includes("Memory")) return `${formatNumber(number)}%`;
  return formatNumber(number);
}

function formatNumber(value) {
  return Number.isInteger(value) ? value.toLocaleString() : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatTimestamp(value) {
  if (!value) return "unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "unknown";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function renderServices() {
  els.serviceGrid.innerHTML = "";

  if (!services.length) {
    els.serviceGrid.innerHTML = `
      <div class="service-empty">
        No CloudWatch-backed services are available yet. Run the telemetry replay, then refresh.
      </div>`;
    return;
  }

  services.forEach(service => {
    const button = document.createElement("button");
    button.className = `service-card${selectedService?.name === service.name ? " selected" : ""}`;
    button.type = "button";
    button.title = service.status_reason || "";

    const metrics = Object.entries(service.metrics || {})
      .map(([key, value]) => `
        <div class="metric-row">
          <span>${escapeHtml(key)}</span>
          <strong>${escapeHtml(formatMetric(key, value))}</strong>
        </div>`)
      .join("");

    button.innerHTML = `
      <div class="service-card-topline">
        <div class="service-name">${escapeHtml(service.name)}</div>
        <span class="live-tag">CloudWatch</span>
      </div>
      <div class="service-state">
        <span class="status-dot ${statusClass(service.status)}"></span>
        <span>${escapeHtml(service.status || "NO_DATA")}</span>
      </div>
      <div class="metric-list">${metrics || '<span class="metric-placeholder">No recent datapoints</span>'}</div>
      <div class="service-reason">${escapeHtml(service.status_reason || "")}</div>
    `;

    button.addEventListener("click", () => selectService(service));
    els.serviceGrid.appendChild(button);
  });
}

function selectService(service) {
  selectedService = service;
  els.selectedServiceLabel.textContent = `Focused service: ${service.name}`;
  renderServices();
  populateMetricSelect();
}

function clearServiceContext() {
  selectedService = null;
  els.selectedServiceLabel.textContent = "No service selected";
  renderServices();
  populateMetricSelect();
}

function currentChartService() {
  return selectedService || services[0] || null;
}

function populateMetricSelect() {
  const service = currentChartService();
  els.metricSelect.innerHTML = "";

  if (!service) {
    els.metricSelect.disabled = true;
    drawChart();
    return;
  }

  const metricNames = Object.keys(service.series || {});
  metricNames.forEach(metric => {
    const option = document.createElement("option");
    option.value = metric;
    option.textContent = metric;
    els.metricSelect.appendChild(option);
  });

  els.metricSelect.disabled = metricNames.length === 0;
  drawChart();
}

function drawChart() {
  const service = currentChartService();
  const canvas = document.getElementById("metricChart");

  if (chart) {
    chart.destroy();
    chart = null;
  }

  if (!service) {
    els.chartTitle.textContent = "Metric overview";
    els.chartSubtitle.textContent = "Waiting for CloudWatch service data.";
    els.chartEmpty.hidden = false;
    canvas.hidden = true;
    return;
  }

  const metricNames = Object.keys(service.series || {});
  const metric = els.metricSelect.value || metricNames[0];
  const points = (service.series?.[metric] || []).filter(point => point && point.timestamp);

  els.chartTitle.textContent = `${service.name} · ${metric || "metrics"}`;
  els.chartSubtitle.textContent = "Live CloudWatch custom metrics; each point is the maximum for the configured period.";

  if (!metric || !points.length) {
    els.chartEmpty.textContent = "No datapoints are available for this metric in the current lookback window.";
    els.chartEmpty.hidden = false;
    canvas.hidden = true;
    return;
  }

  els.chartEmpty.hidden = true;
  canvas.hidden = false;

  chart = new Chart(canvas, {
    type: "line",
    data: {
      labels: points.map(point => formatTimestamp(point.timestamp)),
      datasets: [{
        label: metric,
        data: points.map(point => point.value),
        borderWidth: 2,
        pointRadius: 2.5,
        pointHoverRadius: 5,
        tension: 0.25
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: true },
        tooltip: {
          callbacks: {
            label: context => `${metric}: ${formatMetric(metric, context.parsed.y)}`
          }
        }
      },
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: metric === "ErrorRate" || metric === "Throttles" }
      }
    }
  });
}

async function refreshServices({ silent = false } = {}) {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) {
    setBackendStatus("Backend: configure API URL", "error");
    els.serviceMeta.textContent = "Set apiBaseUrl in config.js.";
    renderServices();
    return;
  }

  const previousName = selectedService?.name || null;
  if (!silent) {
    els.refreshServicesBtn.disabled = true;
    els.refreshServicesBtn.textContent = "Refreshing…";
  }
  setBackendStatus("Backend: checking", "neutral");

  try {
    const res = await fetch(`${baseUrl}/services`, { method: "GET", cache: "no-store" });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(payload.error || `HTTP ${res.status}`);

    services = Array.isArray(payload.services) ? payload.services : [];
    selectedService = previousName ? services.find(service => service.name === previousName) || null : null;

    const generated = payload.generated_at ? new Date(payload.generated_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" }) : "now";
    els.serviceMeta.textContent = `${payload.source || "CloudWatch"} · ${payload.namespace || ""} · updated ${generated}`;
    setBackendStatus("Backend: connected", "ok");
    renderServices();
    populateMetricSelect();
  } catch (err) {
    console.error(err);
    setBackendStatus("Backend: error", "error");
    els.serviceMeta.textContent = `Unable to load CloudWatch service health: ${err.message}`;
    if (!services.length) renderServices();
  } finally {
    if (!silent) {
      els.refreshServicesBtn.disabled = false;
      els.refreshServicesBtn.textContent = "Refresh";
    }
  }
}

function buildQuestion() {
  return els.queryInput.value.trim();
}

async function askVoiceOps() {
  const question = buildQuestion();
  if (!question) {
    els.queryInput.focus();
    return;
  }

  const baseUrl = getApiBaseUrl();
  if (!baseUrl) {
    els.diagnosis.innerHTML = '<div class="answer-text">Set apiBaseUrl in config.js first.</div>';
    return;
  }

  els.askBtn.disabled = true;
  els.responseBadge.textContent = "Running";
  setBackendStatus("Backend: querying", "neutral");
  els.diagnosis.innerHTML = '<div class="empty-state">Analyzing CloudWatch, logs, runbooks, and model evidence…</div>';

  try {
    const body = { query: question };
    if (selectedService?.name) body.focused_service = selectedService.name;

    const res = await fetch(`${baseUrl}/command`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });

    const raw = await res.text();
    let payload;
    try { payload = JSON.parse(raw); }
    catch { payload = { raw }; }

    if (!res.ok) {
      throw new Error(payload.error || payload.raw || `HTTP ${res.status}`);
    }

    renderDiagnosis(payload);
    setBackendStatus("Backend: connected", "ok");
    els.responseBadge.textContent = "Complete";

    if (payload.audio_mp3_base64) {
      playBase64Mp3(payload.audio_mp3_base64);
    }
  } catch (err) {
    console.error(err);
    setBackendStatus("Backend: error", "error");
    els.responseBadge.textContent = "Error";
    els.diagnosis.innerHTML = `<div class="answer-text">Request failed: ${escapeHtml(err.message)}</div>`;
  } finally {
    els.askBtn.disabled = false;
  }
}

function renderDiagnosis(payload) {
  const analysis = payload.analysis || payload.answer || "No analysis returned.";
  const query = payload.query || buildQuestion();
  const evidence = payload.evidence || {};
  const metrics = evidence.metrics || {};

  els.diagnosis.innerHTML = `
    <div class="answer-query">${escapeHtml(query)}</div>
    <div class="answer-text">${escapeHtml(analysis)}</div>
  `;

  els.logCount.textContent = evidence.log_events_considered ?? "—";
  els.kbCount.textContent = evidence.kb_results_considered ?? "—";
  els.metricCount.textContent = countMetrics(metrics);
  els.metricEvidence.textContent = JSON.stringify(metrics, null, 2);
}

function countMetrics(metrics) {
  if (!metrics || typeof metrics !== "object") return 0;
  return Object.values(metrics).reduce((count, serviceMetrics) => {
    if (!serviceMetrics || typeof serviceMetrics !== "object") return count;
    return count + Object.keys(serviceMetrics).length;
  }, 0);
}

function playBase64Mp3(base64) {
  stopAudio();
  const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: "audio/mpeg" });
  const url = URL.createObjectURL(blob);

  currentAudio = new Audio(url);
  currentAudio.addEventListener("ended", () => URL.revokeObjectURL(url), { once: true });
  currentAudio.play().catch(console.warn);
}

function stopAudio() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function setVoiceState(listening, text) {
  els.micBtn.classList.toggle("listening", listening);
  els.micBtn.setAttribute("aria-pressed", String(listening));
  els.micLabel.textContent = listening ? "Stop voice" : "Start voice";
  els.voiceDot.classList.toggle("live", listening);
  els.voiceStatus.textContent = text;
}

function createTranscribeClient() {
  if (!cfg.identityPoolId || cfg.identityPoolId.startsWith("REPLACE_")) {
    throw new Error("Set identityPoolId in config.js first.");
  }

  const cognitoClient = new CognitoIdentityClient({ region: cfg.region });
  const credentials = fromCognitoIdentityPool({
    client: cognitoClient,
    identityPoolId: cfg.identityPoolId
  });

  return new TranscribeStreamingClient({ region: cfg.region, credentials });
}

async function startVoice() {
  if (transcribeAbortController) {
    stopVoice();
    return;
  }

  const client = createTranscribeClient();
  transcribeAbortController = new AbortController();
  setVoiceState(true, "Listening…");

  microphoneStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  audioContext = new AudioContext({ sampleRate: 16000 });
  const source = audioContext.createMediaStreamSource(microphoneStream);
  const processor = audioContext.createScriptProcessor(4096, 1, 1);

  source.connect(processor);
  processor.connect(audioContext.destination);

  const queue = [];
  let resolver = null;

  processor.onaudioprocess = event => {
    const input = event.inputBuffer.getChannelData(0);
    const pcm = new Int16Array(input.length);

    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }

    queue.push(new Uint8Array(pcm.buffer));
    if (resolver) {
      resolver();
      resolver = null;
    }
  };

  async function* audioStream() {
    while (transcribeAbortController) {
      if (queue.length === 0) {
        await new Promise(resolve => { resolver = resolve; });
      }
      while (queue.length) {
        yield { AudioEvent: { AudioChunk: queue.shift() } };
      }
    }
  }

  const command = new StartStreamTranscriptionCommand({
    LanguageCode: "en-US",
    MediaEncoding: "pcm",
    MediaSampleRateHertz: 16000,
    AudioStream: audioStream()
  });

  try {
    const response = await client.send(command, { abortSignal: transcribeAbortController.signal });

    for await (const event of response.TranscriptResultStream) {
      const results = event.TranscriptEvent?.Transcript?.Results || [];
      for (const result of results) {
        if (result.IsPartial) continue;
        const transcript = result.Alternatives?.[0]?.Transcript?.trim();
        if (transcript) {
          els.queryInput.value = transcript;
          setVoiceState(true, `Heard: ${transcript}`);
        }
      }
    }
  } catch (err) {
    if (err.name !== "AbortError") {
      console.error(err);
      setVoiceState(false, `Voice error: ${err.message}`);
    }
  } finally {
    stopVoice();
  }
}

function stopVoice() {
  if (transcribeAbortController) {
    transcribeAbortController.abort();
    transcribeAbortController = null;
  }

  if (microphoneStream) {
    microphoneStream.getTracks().forEach(track => track.stop());
    microphoneStream = null;
  }

  if (audioContext) {
    audioContext.close().catch(() => {});
    audioContext = null;
  }

  setVoiceState(false, "Idle");
}

function wireEvents() {
  els.askBtn.addEventListener("click", askVoiceOps);
  els.metricSelect.addEventListener("change", drawChart);
  els.clearContextBtn.addEventListener("click", clearServiceContext);
  els.stopAudioBtn.addEventListener("click", stopAudio);
  els.refreshServicesBtn.addEventListener("click", () => refreshServices());

  els.micBtn.addEventListener("click", () => {
    startVoice().catch(err => {
      console.error(err);
      setVoiceState(false, `Voice error: ${err.message}`);
    });
  });

  document.querySelectorAll(".chip").forEach(btn => {
    btn.addEventListener("click", () => {
      els.queryInput.value = btn.dataset.prompt || "";
      els.queryInput.focus();
    });
  });

  els.queryInput.addEventListener("keydown", event => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      askVoiceOps();
    }
  });
}

function startAutoRefresh() {
  const seconds = Math.max(0, Number(cfg.refreshIntervalSeconds || 30));
  if (!seconds) return;
  refreshTimer = window.setInterval(() => refreshServices({ silent: true }), seconds * 1000);
  window.addEventListener("beforeunload", () => window.clearInterval(refreshTimer), { once: true });
}

wireEvents();
renderServices();
populateMetricSelect();
refreshServices();
startAutoRefresh();
