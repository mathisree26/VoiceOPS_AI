import {
  TranscribeStreamingClient,
  StartStreamTranscriptionCommand
} from "@aws-sdk/client-transcribe-streaming";

import {
  fromCognitoIdentityPool
} from "@aws-sdk/credential-provider-cognito-identity";

import {
  CognitoIdentityClient
} from "@aws-sdk/client-cognito-identity";

import Chart from "chart.js/auto";

const cfg = window.VOICEOPS_CONFIG || {};

/* ============================================================
   COGNITO AUTHENTICATION
   ============================================================ */

const AUTH_STORAGE = {
  idToken: "voiceops.idToken",
  accessToken: "voiceops.accessToken",
  refreshToken: "voiceops.refreshToken",
  expiresAt: "voiceops.expiresAt",
  pkceVerifier: "voiceops.pkceVerifier"
};

function base64UrlEncode(bytes) {
  let binary = "";

  const data =
    bytes instanceof Uint8Array
      ? bytes
      : new Uint8Array(bytes);

  for (const byte of data) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function randomPkceVerifier() {
  const bytes = new Uint8Array(64);
  crypto.getRandomValues(bytes);

  return base64UrlEncode(bytes);
}

async function pkceChallenge(verifier) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier)
  );

  return base64UrlEncode(digest);
}

function getStoredIdToken() {
  return sessionStorage.getItem(
    AUTH_STORAGE.idToken
  ) || "";
}

function getStoredAccessToken() {
  return sessionStorage.getItem(
    AUTH_STORAGE.accessToken
  ) || "";
}

function clearAuthSession() {
  Object.values(AUTH_STORAGE).forEach(key => {
    sessionStorage.removeItem(key);
  });
}

function hasValidAuthSession() {
  const idToken = getStoredIdToken();

  const expiresAt = Number(
    sessionStorage.getItem(
      AUTH_STORAGE.expiresAt
    ) || 0
  );

  return Boolean(
    idToken &&
    expiresAt &&
    Date.now() < expiresAt - 30000
  );
}

/* ============================================================
   START LOGIN
   ============================================================ */

async function beginLogin() {
  if (
    !cfg.cognitoDomain ||
    !cfg.userPoolClientId ||
    !cfg.redirectUri
  ) {
    throw new Error(
      "Cognito login configuration is incomplete."
    );
  }

  const verifier = randomPkceVerifier();

  const challenge =
    await pkceChallenge(verifier);

  sessionStorage.setItem(
    AUTH_STORAGE.pkceVerifier,
    verifier
  );

  const url = new URL(
    `${cfg.cognitoDomain.replace(/\/$/, "")}/login`
  );

  url.searchParams.set(
    "client_id",
    cfg.userPoolClientId
  );

  url.searchParams.set(
    "response_type",
    "code"
  );

  url.searchParams.set(
    "scope",
    "openid email profile"
  );

  url.searchParams.set(
    "redirect_uri",
    cfg.redirectUri
  );

  url.searchParams.set(
    "code_challenge_method",
    "S256"
  );

  url.searchParams.set(
    "code_challenge",
    challenge
  );

  window.location.assign(
    url.toString()
  );
}

/* ============================================================
   EXCHANGE AUTHORIZATION CODE FOR TOKENS
   ============================================================ */

async function exchangeAuthorizationCode(code) {
  const verifier =
    sessionStorage.getItem(
      AUTH_STORAGE.pkceVerifier
    );

  if (!verifier) {
    throw new Error(
      "Missing PKCE verifier. Start login again."
    );
  }

  const body =
    new URLSearchParams({
      grant_type:
        "authorization_code",

      client_id:
        cfg.userPoolClientId,

      code,

      redirect_uri:
        cfg.redirectUri,

      code_verifier:
        verifier
    });

  const response = await fetch(
    `${cfg.cognitoDomain.replace(/\/$/, "")}/oauth2/token`,
    {
      method: "POST",

      headers: {
        "content-type":
          "application/x-www-form-urlencoded"
      },

      body
    }
  );

  const tokens =
    await response.json()
      .catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      tokens.error_description ||
      tokens.error ||
      `Cognito token exchange failed (${response.status})`
    );
  }

  sessionStorage.setItem(
    AUTH_STORAGE.idToken,
    tokens.id_token || ""
  );

  sessionStorage.setItem(
    AUTH_STORAGE.accessToken,
    tokens.access_token || ""
  );

  if (tokens.refresh_token) {
    sessionStorage.setItem(
      AUTH_STORAGE.refreshToken,
      tokens.refresh_token
    );
  }

  sessionStorage.setItem(
    AUTH_STORAGE.expiresAt,

    String(
      Date.now() +
      Number(
        tokens.expires_in || 3600
      ) * 1000
    )
  );

  sessionStorage.removeItem(
    AUTH_STORAGE.pkceVerifier
  );

  // Remove ?code=... from URL
  window.history.replaceState(
    {},
    document.title,
    cfg.redirectUri
  );
}

/* ============================================================
   VERIFY LOGIN
   ============================================================ */

async function ensureAuthenticated() {
  const params =
    new URLSearchParams(
      window.location.search
    );

  const authError =
    params.get("error");

  if (authError) {
    const description =
      params.get(
        "error_description"
      ) || authError;

    clearAuthSession();

    throw new Error(
      `Cognito login failed: ${description}`
    );
  }

  const code =
    params.get("code");

  if (code) {
    await exchangeAuthorizationCode(code);
  }

  if (!hasValidAuthSession()) {
    clearAuthSession();

    await beginLogin();

    return false;
  }

  return true;
}

/* ============================================================
   LOGOUT
   ============================================================ */

function logout() {
  clearAuthSession();

  const url =
    new URL(
      `${cfg.cognitoDomain.replace(/\/$/, "")}/logout`
    );

  url.searchParams.set(
    "client_id",
    cfg.userPoolClientId
  );

  url.searchParams.set(
    "logout_uri",
    cfg.logoutUri
  );

  window.location.assign(
    url.toString()
  );
}

/* ============================================================
   EXISTING UI REFERENCES
   ============================================================ */

const els = {
  serviceGrid:
    document.getElementById("serviceGrid"),

  serviceMeta:
    document.getElementById("serviceMeta"),

  chartTitle:
    document.getElementById("chartTitle"),

  chartSubtitle:
    document.getElementById("chartSubtitle"),

  chartEmpty:
    document.getElementById("chartEmpty"),

  metricSelect:
    document.getElementById("metricSelect"),

  queryInput:
    document.getElementById("queryInput"),

  askBtn:
    document.getElementById("askBtn"),

  micBtn:
    document.getElementById("micBtn"),

  micLabel:
    document.getElementById("micLabel"),

  voiceStatus:
    document.getElementById("voiceStatus"),

  voiceDot:
    document.getElementById("voiceDot"),

  diagnosis:
    document.getElementById("diagnosis"),

  responseBadge:
    document.getElementById("responseBadge"),

  selectedServiceLabel:
    document.getElementById(
      "selectedServiceLabel"
    ),

  backendStatus:
    document.getElementById(
      "backendStatus"
    ),

  logCount:
    document.getElementById("logCount"),

  kbCount:
    document.getElementById("kbCount"),

  metricCount:
    document.getElementById("metricCount"),

  metricEvidence:
    document.getElementById(
      "metricEvidence"
    ),

  clearContextBtn:
    document.getElementById(
      "clearContextBtn"
    ),

  stopAudioBtn:
    document.getElementById(
      "stopAudioBtn"
    ),

  refreshServicesBtn:
    document.getElementById(
      "refreshServicesBtn"
    )
};

let services = [];
let selectedService = null;
let focusedServiceName = null;
let chart = null;
let currentAudio = null;

let transcribeAbortController = null;
let microphoneStream = null;
let audioContext = null;
let refreshTimer = null;

/* ============================================================
   API URL
   ============================================================ */

function getApiBaseUrl() {
  if (
    cfg.apiBaseUrl &&
    !cfg.apiBaseUrl.startsWith(
      "REPLACE_"
    )
  ) {
    return cfg.apiBaseUrl
      .replace(/\/$/, "");
  }

  if (
    cfg.apiEndpoint &&
    !cfg.apiEndpoint.startsWith(
      "REPLACE_"
    )
  ) {
    return cfg.apiEndpoint
      .replace(
        /\/command\/?$/,
        ""
      )
      .replace(/\/$/, "");
  }

  return "";
}

/* ============================================================
   UI HELPERS
   ============================================================ */

function setBackendStatus(
  text,
  state = "neutral"
) {
  els.backendStatus.textContent =
    text;

  els.backendStatus.dataset.state =
    state;
}

function statusClass(status) {
  const normalized =
    String(
      status || "NO_DATA"
    ).toUpperCase();

  if (
    normalized === "HEALTHY"
  ) return "healthy";

  if (
    normalized === "DEGRADED"
  ) return "degraded";

  if (
    normalized === "CRITICAL"
  ) return "critical";

  if (
    normalized === "STALE"
  ) return "stale";

  return "no-data";
}

function formatMetric(
  name,
  value
) {
  if (
    value === null ||
    value === undefined ||
    Number.isNaN(
      Number(value)
    )
  ) {
    return "—";
  }

  const number =
    Number(value);

  if (
    name === "Latency" ||
    name === "Duration"
  ) {
    return `${formatNumber(number)} ms`;
  }

  if (
    name === "ErrorRate" ||
    name.includes("CPU") ||
    name.includes("Memory")
  ) {
    return `${formatNumber(number)}%`;
  }

  return formatNumber(number);
}

function formatNumber(value) {
  return Number.isInteger(value)
    ? value.toLocaleString()
    : value.toLocaleString(
        undefined,
        {
          maximumFractionDigits: 2
        }
      );
}

function formatTimestamp(value) {
  if (!value) {
    return "unknown";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "unknown";
  }

  return date.toLocaleTimeString(
    [],
    {
      hour: "numeric",
      minute: "2-digit"
    }
  );
}

/* ============================================================
   SERVICES
   ============================================================ */

function renderServices() {
  els.serviceGrid.innerHTML = "";

  if (!services.length) {
    els.serviceGrid.innerHTML = `
      <div class="service-empty">
        No CloudWatch-backed services are available yet.
        Run the telemetry replay, then refresh.
      </div>
    `;

    return;
  }

  services.forEach(service => {
    const button =
      document.createElement(
        "button"
      );

    button.className =
      `service-card${
        selectedService?.name ===
        service.name
          ? " selected"
          : ""
      }`;

    button.type = "button";

    button.title =
      service.status_reason || "";

    const metrics =
      Object.entries(
        service.metrics || {}
      )
        .map(
          ([key, value]) => `
            <div class="metric-row">
              <span>
                ${escapeHtml(key)}
              </span>
              <strong>
                ${escapeHtml(
                  formatMetric(
                    key,
                    value
                  )
                )}
              </strong>
            </div>
          `
        )
        .join("");

    button.innerHTML = `
      <div class="service-card-topline">

        <div class="service-name">
          ${escapeHtml(
            service.name
          )}
        </div>

        <span class="live-tag">
          CloudWatch
        </span>

      </div>

      <div class="service-state">

        <span
          class="status-dot
          ${statusClass(
            service.status
          )}">
        </span>

        <span>
          ${escapeHtml(
            service.status ||
            "NO_DATA"
          )}
        </span>

      </div>

      <div class="metric-list">

        ${
          metrics ||
          '<span class="metric-placeholder">No recent datapoints</span>'
        }

      </div>

      <div class="service-reason">

        ${escapeHtml(
          service.status_reason ||
          ""
        )}

      </div>
    `;

    button.addEventListener(
      "click",
      () =>
        selectService(service)
    );

    els.serviceGrid.appendChild(
      button
    );
  });
}

function selectService(service) {
  selectedService = service;
  focusedServiceName = service.name;

  els.selectedServiceLabel
    .textContent =
    `Focused service: ${service.name}`;

  renderServices();

  populateMetricSelect();
}

function clearServiceContext() {
  selectedService = null;
  focusedServiceName = null;

  els.selectedServiceLabel
    .textContent =
    "No service selected";

  renderServices();

  populateMetricSelect();
}

function currentChartService() {
  return (
    selectedService ||
    services[0] ||
    null
  );
}

/* ============================================================
   METRIC CHART
   ============================================================ */

function populateMetricSelect() {
  const service =
    currentChartService();

  els.metricSelect.innerHTML =
    "";

  if (!service) {
    els.metricSelect.disabled =
      true;

    drawChart();

    return;
  }

  const metricNames =
    Object.keys(
      service.series || {}
    );

  metricNames.forEach(
    metric => {
      const option =
        document.createElement(
          "option"
        );

      option.value =
        metric;

      option.textContent =
        metric;

      els.metricSelect.appendChild(
        option
      );
    }
  );

  els.metricSelect.disabled =
    metricNames.length === 0;

  drawChart();
}

function drawChart() {
  const service =
    currentChartService();

  const canvas =
    document.getElementById(
      "metricChart"
    );

  if (chart) {
    chart.destroy();

    chart = null;
  }

  if (!service) {
    els.chartTitle.textContent =
      "Metric overview";

    els.chartSubtitle.textContent =
      "Waiting for CloudWatch service data.";

    els.chartEmpty.hidden =
      false;

    canvas.hidden =
      true;

    return;
  }

  const metricNames =
    Object.keys(
      service.series || {}
    );

  const metric =
    els.metricSelect.value ||
    metricNames[0];

  const points =
    (
      service.series?.[metric] ||
      []
    ).filter(
      point =>
        point &&
        point.timestamp
    );

  els.chartTitle.textContent =
    `${service.name} · ${
      metric || "metrics"
    }`;

  els.chartSubtitle.textContent =
    "Live CloudWatch custom metrics; each point is the maximum for the configured period.";

  if (
    !metric ||
    !points.length
  ) {
    els.chartEmpty.textContent =
      "No datapoints are available for this metric in the current lookback window.";

    els.chartEmpty.hidden =
      false;

    canvas.hidden =
      true;

    return;
  }

  els.chartEmpty.hidden =
    true;

  canvas.hidden =
    false;

  chart =
    new Chart(
      canvas,
      {
        type: "line",

        data: {
          labels:
            points.map(
              point =>
                formatTimestamp(
                  point.timestamp
                )
            ),

          datasets: [
            {
              label: metric,

              data:
                points.map(
                  point =>
                    point.value
                ),

              borderWidth: 2,

              pointRadius: 2.5,

              pointHoverRadius: 5,

              tension: 0.25
            }
          ]
        },

        options: {
          responsive: true,

          maintainAspectRatio:
            false,

          interaction: {
            mode: "index",
            intersect: false
          },

          plugins: {
            legend: {
              display: true
            },

            tooltip: {
              callbacks: {
                label:
                  context =>
                    `${metric}: ${formatMetric(
                      metric,
                      context.parsed.y
                    )}`
              }
            }
          },

          scales: {
            x: {
              grid: {
                display: false
              }
            },

            y: {
              beginAtZero:
                metric ===
                  "ErrorRate" ||
                metric ===
                  "Throttles"
            }
          }
        }
      }
    );
}

/* ============================================================
   LOAD SERVICES
   ============================================================ */

async function refreshServices({
  silent = false
} = {}) {
  const baseUrl =
    getApiBaseUrl();

  if (!baseUrl) {
    setBackendStatus(
      "Backend: configure API URL",
      "error"
    );

    els.serviceMeta.textContent =
      "Set apiBaseUrl in config.js.";

    renderServices();

    return;
  }

  const previousName =
    selectedService?.name ||
    null;

  if (!silent) {
    els.refreshServicesBtn.disabled =
      true;

    els.refreshServicesBtn.textContent =
      "Refreshing…";
  }

  setBackendStatus(
    "Backend: checking",
    "neutral"
  );

  try {
    const res = await fetch(
      `${baseUrl}/services`,
      {
        method: "GET",
        cache: "no-store"
      }
    );

    const payload =
      await res.json()
        .catch(() => ({}));

    if (!res.ok) {
      throw new Error(
        payload.error ||
        `HTTP ${res.status}`
      );
    }

    services =
      Array.isArray(
        payload.services
      )
        ? payload.services
        : [];

    selectedService =
      previousName
        ? services.find(
            service =>
              service.name ===
              previousName
          ) || null
        : null;

    const generated =
      payload.generated_at
        ? new Date(
            payload.generated_at
          ).toLocaleTimeString(
            [],
            {
              hour: "numeric",
              minute: "2-digit",
              second: "2-digit"
            }
          )
        : "now";

    els.serviceMeta.textContent =
      `${payload.source || "CloudWatch"} · ${payload.namespace || ""} · updated ${generated}`;

    setBackendStatus(
      "Backend: connected",
      "ok"
    );

    renderServices();

    populateMetricSelect();
  } catch (err) {
    console.error(err);

    setBackendStatus(
      "Backend: error",
      "error"
    );

    els.serviceMeta.textContent =
      `Unable to load CloudWatch service health: ${err.message}`;

    if (!services.length) {
      renderServices();
    }
  } finally {
    if (!silent) {
      els.refreshServicesBtn.disabled =
        false;

      els.refreshServicesBtn.textContent =
        "Refresh";
    }
  }
}

/* ============================================================
   QUESTION
   ============================================================ */

function buildQuestion() {
  return els.queryInput.value.trim();
}

/* ============================================================
   ASK VOICEOPS
   ============================================================ */

async function askVoiceOps() {
  const question =
    buildQuestion();

  if (!question) {
    els.queryInput.focus();

    return;
  }

  const baseUrl =
    getApiBaseUrl();

  if (!baseUrl) {
    els.diagnosis.innerHTML =
      '<div class="answer-text">Set apiBaseUrl in config.js first.</div>';

    return;
  }

  els.askBtn.disabled =
    true;

  els.responseBadge.textContent =
    "Running";

  setBackendStatus(
    "Backend: querying",
    "neutral"
  );

  els.diagnosis.innerHTML =
    '<div class="empty-state">Analyzing CloudWatch, logs, runbooks, and model evidence…</div>';

  try {
    const body = {
      query: question
    };

    if (focusedServiceName) {
      body.focused_service =
        focusedServiceName;
    }

    const res = await fetch(
      `${baseUrl}/command`,
      {
        method: "POST",

        headers: {
          "content-type":
            "application/json",

          "Authorization":
            `Bearer ${getStoredAccessToken()}`
        },

        body:
          JSON.stringify(body)
      }
    );

    const raw =
      await res.text();

    let payload;

    try {
      payload =
        JSON.parse(raw);
    } catch {
      payload = {
        raw
      };
    }

    if (!res.ok) {
      throw new Error(
        payload.error ||
        payload.raw ||
        `HTTP ${res.status}`
      );
    }

    if (payload.focused_service) {
      focusedServiceName =
        payload.focused_service;

      els.selectedServiceLabel.textContent =
        `Focused service: ${focusedServiceName}`;
    }

    renderDiagnosis(
      payload
    );

    setBackendStatus(
      "Backend: connected",
      "ok"
    );

    els.responseBadge.textContent =
      "Complete";

    if (
      payload.audio_mp3_base64
    ) {
      playBase64Mp3(
        payload.audio_mp3_base64
      );
    }
  } catch (err) {
    console.error(err);

    setBackendStatus(
      "Backend: error",
      "error"
    );

    els.responseBadge.textContent =
      "Error";

    els.diagnosis.innerHTML =
      `<div class="answer-text">Request failed: ${escapeHtml(
        err.message
      )}</div>`;
  } finally {
    els.askBtn.disabled =
      false;
  }
}

/* ============================================================
   DIAGNOSIS
   ============================================================ */

function renderDiagnosis(payload) {
  const analysis =
    payload.analysis ||
    payload.answer ||
    "No analysis returned.";

  const query =
    payload.query ||
    buildQuestion();

  const evidence =
    payload.evidence || {};

  const metrics =
    evidence.metrics || {};

  els.diagnosis.innerHTML = `
    <div class="answer-query">
      ${escapeHtml(query)}
    </div>

    <div class="answer-text">
      ${escapeHtml(analysis)}
    </div>
  `;

  els.logCount.textContent =
    evidence.log_events_considered ??
    "—";

  els.kbCount.textContent =
    evidence.kb_results_considered ??
    "—";

  els.metricCount.textContent =
    countMetrics(metrics);

  els.metricEvidence.textContent =
    JSON.stringify(
      metrics,
      null,
      2
    );
}

function countMetrics(metrics) {
  if (
    !metrics ||
    typeof metrics !== "object"
  ) {
    return 0;
  }

  return Object.values(
    metrics
  ).reduce(
    (
      count,
      serviceMetrics
    ) => {
      if (
        !serviceMetrics ||
        typeof serviceMetrics !==
          "object"
      ) {
        return count;
      }

      return (
        count +
        Object.keys(
          serviceMetrics
        ).length
      );
    },
    0
  );
}

/* ============================================================
   AUDIO
   ============================================================ */

function playBase64Mp3(base64) {
  stopAudio();

  const bytes =
    Uint8Array.from(
      atob(base64),
      c =>
        c.charCodeAt(0)
    );

  const blob =
    new Blob(
      [bytes],
      {
        type: "audio/mpeg"
      }
    );

  const url =
    URL.createObjectURL(
      blob
    );

  currentAudio =
    new Audio(url);

  currentAudio.addEventListener(
    "ended",
    () =>
      URL.revokeObjectURL(
        url
      ),
    {
      once: true
    }
  );

  currentAudio.play()
    .catch(
      console.warn
    );
}

function stopAudio() {
  if (currentAudio) {
    currentAudio.pause();

    currentAudio.currentTime =
      0;

    currentAudio =
      null;
  }
}

/* ============================================================
   HTML ESCAPING
   ============================================================ */

function escapeHtml(value) {
  return String(
    value ?? ""
  )
    .replaceAll(
      "&",
      "&amp;"
    )
    .replaceAll(
      "<",
      "&lt;"
    )
    .replaceAll(
      ">",
      "&gt;"
    );
}

/* ============================================================
   VOICE STATUS
   ============================================================ */

function setVoiceState(
  listening,
  text
) {
  els.micBtn.classList.toggle(
    "listening",
    listening
  );

  els.micBtn.setAttribute(
    "aria-pressed",
    String(listening)
  );

  els.micLabel.textContent =
    listening
      ? "Stop voice"
      : "Start voice";

  els.voiceDot.classList.toggle(
    "live",
    listening
  );

  els.voiceStatus.textContent =
    text;
}

/* ============================================================
   AUTHENTICATED TRANSCRIBE CLIENT
   ============================================================ */

function createTranscribeClient() {
  if (
    !cfg.identityPoolId ||
    cfg.identityPoolId.startsWith(
      "REPLACE_"
    )
  ) {
    throw new Error(
      "Set identityPoolId in config.js first."
    );
  }

  if (
    !cfg.userPoolProviderName
  ) {
    throw new Error(
      "Set userPoolProviderName in config.js first."
    );
  }

  const idToken =
    getStoredIdToken();

  if (!idToken) {
    throw new Error(
      "No authenticated Cognito session is available."
    );
  }

  const cognitoClient =
    new CognitoIdentityClient({
      region: cfg.region
    });

  const credentials =
    fromCognitoIdentityPool({
      client:
        cognitoClient,

      identityPoolId:
        cfg.identityPoolId,

      logins: {
        [cfg.userPoolProviderName]:
          idToken
      }
    });

  return new TranscribeStreamingClient({
    region:
      cfg.region,

    credentials
  });
}

/* ============================================================
   START VOICE
   ============================================================ */

async function startVoice() {
  if (
    transcribeAbortController
  ) {
    stopVoice();

    return;
  }

  const client =
    createTranscribeClient();

  transcribeAbortController =
    new AbortController();

  setVoiceState(
    true,
    "Listening…"
  );

  microphoneStream =
    await navigator.mediaDevices
      .getUserMedia({
        audio: true
      });

  audioContext =
    new AudioContext({
      sampleRate: 16000
    });

  const source =
    audioContext
      .createMediaStreamSource(
        microphoneStream
      );

  const processor =
    audioContext
      .createScriptProcessor(
        4096,
        1,
        1
      );

  source.connect(
    processor
  );

  processor.connect(
    audioContext.destination
  );

  const queue = [];

  let resolver =
    null;

  processor.onaudioprocess =
    event => {
      const input =
        event.inputBuffer
          .getChannelData(0);

      const pcm =
        new Int16Array(
          input.length
        );

      for (
        let i = 0;
        i < input.length;
        i++
      ) {
        const s =
          Math.max(
            -1,
            Math.min(
              1,
              input[i]
            )
          );

        pcm[i] =
          s < 0
            ? s * 0x8000
            : s * 0x7fff;
      }

      queue.push(
        new Uint8Array(
          pcm.buffer
        )
      );

      if (resolver) {
        resolver();

        resolver =
          null;
      }
    };

  async function* audioStream() {
    while (
      transcribeAbortController
    ) {
      if (
        queue.length === 0
      ) {
        await new Promise(
          resolve => {
            resolver =
              resolve;
          }
        );
      }

      while (
        queue.length
      ) {
        yield {
          AudioEvent: {
            AudioChunk:
              queue.shift()
          }
        };
      }
    }
  }

  const command =
    new StartStreamTranscriptionCommand({
      LanguageCode:
        "en-US",

      MediaEncoding:
        "pcm",

      MediaSampleRateHertz:
        16000,

      AudioStream:
        audioStream()
    });

  try {
    const response =
      await client.send(
        command,
        {
          abortSignal:
            transcribeAbortController.signal
        }
      );

    for await (
      const event
      of response.TranscriptResultStream
    ) {
      const results =
        event.TranscriptEvent
          ?.Transcript
          ?.Results || [];

      for (
        const result
        of results
      ) {
        if (
          result.IsPartial
        ) {
          continue;
        }

        const transcript =
          result.Alternatives
            ?.[0]
            ?.Transcript
            ?.trim();

        if (transcript) {
          els.queryInput.value =
            transcript;

          setVoiceState(
            true,
            `Heard: ${transcript}`
          );
        }
      }
    }
  } catch (err) {
    if (
      err.name !==
      "AbortError"
    ) {
      console.error(err);

      setVoiceState(
        false,
        `Voice error: ${err.message}`
      );
    }
  } finally {
    stopVoice();
  }
}

/* ============================================================
   STOP VOICE
   ============================================================ */

function stopVoice() {
  if (
    transcribeAbortController
  ) {
    transcribeAbortController.abort();

    transcribeAbortController =
      null;
  }

  if (
    microphoneStream
  ) {
    microphoneStream
      .getTracks()
      .forEach(
        track =>
          track.stop()
      );

    microphoneStream =
      null;
  }

  if (
    audioContext
  ) {
    audioContext.close()
      .catch(() => {});

    audioContext =
      null;
  }

  setVoiceState(
    false,
    "Idle"
  );
}

/* ============================================================
   EVENTS
   ============================================================ */

function wireEvents() {
  els.askBtn.addEventListener(
    "click",
    askVoiceOps
  );

  els.metricSelect.addEventListener(
    "change",
    drawChart
  );

  els.clearContextBtn.addEventListener(
    "click",
    clearServiceContext
  );

  els.stopAudioBtn.addEventListener(
    "click",
    stopAudio
  );

  els.refreshServicesBtn.addEventListener(
    "click",
    () =>
      refreshServices()
  );

  els.micBtn.addEventListener(
    "click",
    () => {
      startVoice()
        .catch(
          err => {
            console.error(err);

            setVoiceState(
              false,
              `Voice error: ${err.message}`
            );
          }
        );
    }
  );

  document
    .querySelectorAll(
      ".chip"
    )
    .forEach(
      btn => {
        btn.addEventListener(
          "click",
          () => {
            els.queryInput.value =
              btn.dataset.prompt ||
              "";

            els.queryInput.focus();
          }
        );
      }
    );

  els.queryInput.addEventListener(
    "keydown",
    event => {
      if (
        (
          event.ctrlKey ||
          event.metaKey
        ) &&
        event.key ===
          "Enter"
      ) {
        askVoiceOps();
      }
    }
  );
}

/* ============================================================
   AUTO REFRESH
   ============================================================ */

function startAutoRefresh() {
  const seconds =
    Math.max(
      0,
      Number(
        cfg.refreshIntervalSeconds ||
        30
      )
    );

  if (!seconds) {
    return;
  }

  refreshTimer =
    window.setInterval(
      () =>
        refreshServices({
          silent: true
        }),

      seconds * 1000
    );

  window.addEventListener(
    "beforeunload",
    () =>
      window.clearInterval(
        refreshTimer
      ),
    {
      once: true
    }
  );
}

/* ============================================================
   APPLICATION STARTUP
   ============================================================ */

async function startApplication() {
  try {
    const authenticated =
      await ensureAuthenticated();

    if (!authenticated) {
      return;
    }

    document.body.classList.remove(
      "auth-loading"
    );

    // Keep the demo unscripted even if index.html
    // contains a default question value.
    els.queryInput.value = "";

    els.queryInput.placeholder =
      "Ask a VoiceOps question...";

    wireEvents();

    renderServices();

    populateMetricSelect();

    refreshServices();

    startAutoRefresh();

    // Temporary logout helper.
    // Open browser console and run:
    //
    // window.voiceOpsLogout()
    //
    window.voiceOpsLogout =
      logout;

  } catch (err) {
    console.error(err);

    document.body.innerHTML = `
      <main style="
        max-width:760px;
        margin:4rem auto;
        padding:2rem;
        font-family:system-ui
      ">

        <h1>
          VoiceOps sign-in failed
        </h1>

        <p>
          ${escapeHtml(
            err.message
          )}
        </p>

        <button
          id="retryLoginBtn"
          type="button"
        >
          Try sign in again
        </button>

      </main>
    `;

    document
      .getElementById(
        "retryLoginBtn"
      )
      ?.addEventListener(
        "click",
        () => {
          clearAuthSession();

          beginLogin()
            .catch(
              console.error
            );
        }
      );
  }
}

startApplication();