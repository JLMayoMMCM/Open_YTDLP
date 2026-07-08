import { getHealth, probeUrl, getSettings, saveSettings, enqueueJob, getQueue, cancelJob, ApiError } from "./api.js";
import { connectProgressSocket } from "./ws.js";

const RESOLUTION_BUCKETS = [2160, 1440, 1080, 720, 480, 360, 240, 144];

const state = {
  jobs: new Map(),
  currentProbe: null,
  ffmpegAvailable: false,
};

const el = {
  ffmpegBadge: document.getElementById("ffmpeg-badge"),
  settingsToggle: document.getElementById("settings-toggle"),
  settingsPanel: document.getElementById("settings-panel"),
  outputDir: document.getElementById("output-dir"),
  settingsError: document.getElementById("settings-error"),
  settingsSave: document.getElementById("settings-save"),
  urlInput: document.getElementById("url-input"),
  probeBtn: document.getElementById("probe-btn"),
  probeError: document.getElementById("probe-error"),
  infoCard: document.getElementById("info-card"),
  infoThumb: document.getElementById("info-thumb"),
  infoTitle: document.getElementById("info-title"),
  infoMeta: document.getElementById("info-meta"),
  modeSelect: document.getElementById("mode-select"),
  resolutionField: document.getElementById("resolution-field"),
  resolutionSelect: document.getElementById("resolution-select"),
  audioFormatField: document.getElementById("audio-format-field"),
  audioFormatSelect: document.getElementById("audio-format-select"),
  queueBtn: document.getElementById("queue-btn"),
  queueError: document.getElementById("queue-error"),
  queueList: document.getElementById("queue-list"),
  queueEmpty: document.getElementById("queue-empty"),
};

function showError(elem, message) {
  elem.textContent = message;
  elem.classList.remove("hidden");
}

function hideError(elem) {
  elem.classList.add("hidden");
  elem.textContent = "";
}

function requiresFfmpeg(mode, resolution, audioFormat, heights, progressiveHeights) {
  if (mode === "audio_only") return audioFormat !== "best";
  if (mode === "video_audio") {
    const cap = resolution === "best" ? null : Number(resolution);
    const candidates = heights.filter((h) => cap === null || h <= cap);
    if (candidates.length === 0) return false;
    // yt-dlp's bestvideo[...] picks the tallest candidate; if that height
    // isn't available as a progressive (already-muxed) stream, a merge is needed.
    return !progressiveHeights.includes(Math.max(...candidates));
  }
  return false;
}

async function refreshHealth() {
  try {
    const health = await getHealth();
    state.ffmpegAvailable = health.ffmpeg_available;
    el.ffmpegBadge.textContent = health.ffmpeg_available ? "ffmpeg: OK" : "ffmpeg: missing";
    el.ffmpegBadge.classList.toggle("ok", health.ffmpeg_available);
    el.ffmpegBadge.classList.toggle("missing", !health.ffmpeg_available);
  } catch (err) {
    el.ffmpegBadge.textContent = "ffmpeg: unknown";
  }
}

async function loadSettings() {
  const settings = await getSettings();
  el.outputDir.value = settings.output_dir;
}

function toggleSettings() {
  el.settingsPanel.classList.toggle("hidden");
}

async function saveSettingsHandler() {
  hideError(el.settingsError);
  try {
    const updated = await saveSettings(el.outputDir.value.trim());
    el.outputDir.value = updated.output_dir;
  } catch (err) {
    showError(el.settingsError, err instanceof ApiError ? err.message : "Failed to save settings.");
  }
}

function populateResolutionOptions() {
  const info = state.currentProbe;
  if (!info) return;
  const mode = el.modeSelect.value;
  el.resolutionSelect.innerHTML = "";

  const bestNeedsFfmpeg = requiresFfmpeg(mode, "best", el.audioFormatSelect.value, info.heights, info.progressive_heights);
  addResolutionOption("best", "Best available", bestNeedsFfmpeg);

  const maxHeight = info.heights.length ? Math.max(...info.heights) : 0;
  for (const bucket of RESOLUTION_BUCKETS) {
    if (bucket > maxHeight) continue;
    const needsFfmpeg = requiresFfmpeg(mode, String(bucket), el.audioFormatSelect.value, info.heights, info.progressive_heights);
    addResolutionOption(String(bucket), `${bucket}p`, needsFfmpeg);
  }
}

function addResolutionOption(value, label, needsFfmpeg) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = needsFfmpeg ? `${label} (requires ffmpeg)` : label;
  if (needsFfmpeg && !state.ffmpegAvailable) {
    option.disabled = true;
  }
  el.resolutionSelect.appendChild(option);
}

function populateAudioFormatOptions() {
  for (const option of el.audioFormatSelect.options) {
    option.disabled = option.value !== "best" && !state.ffmpegAvailable;
  }
}

function updateModeVisibility() {
  const mode = el.modeSelect.value;
  el.resolutionField.classList.toggle("hidden", mode === "audio_only");
  el.audioFormatField.classList.toggle("hidden", mode !== "audio_only");
  populateResolutionOptions();
  populateAudioFormatOptions();
}

async function probeHandler() {
  const url = el.urlInput.value.trim();
  hideError(el.probeError);
  if (!url) {
    showError(el.probeError, "Please enter a URL.");
    return;
  }
  el.probeBtn.disabled = true;
  el.probeBtn.textContent = "Fetching…";
  try {
    const info = await probeUrl(url);
    state.currentProbe = info;
    el.infoThumb.src = info.thumbnail || "";
    el.infoTitle.textContent = info.title;
    const duration = info.duration ? `${Math.floor(info.duration / 60)}:${String(info.duration % 60).padStart(2, "0")}` : "unknown length";
    el.infoMeta.textContent = `${info.uploader || "Unknown uploader"} · ${duration}`;
    el.infoCard.classList.remove("hidden");
    updateModeVisibility();
    hideError(el.queueError);
  } catch (err) {
    el.infoCard.classList.add("hidden");
    showError(el.probeError, err instanceof ApiError ? err.message : "Could not fetch that video.");
  } finally {
    el.probeBtn.disabled = false;
    el.probeBtn.textContent = "Fetch Info";
  }
}

async function queueHandler() {
  if (!state.currentProbe) return;
  hideError(el.queueError);
  const payload = {
    url: state.currentProbe.webpage_url,
    mode: el.modeSelect.value,
    resolution: el.modeSelect.value === "audio_only" ? "best" : el.resolutionSelect.value,
    audio_format: el.modeSelect.value === "audio_only" ? el.audioFormatSelect.value : "best",
  };
  el.queueBtn.disabled = true;
  try {
    const job = await enqueueJob(payload);
    upsertJob(job);
    renderQueue();
  } catch (err) {
    showError(el.queueError, err instanceof ApiError ? err.message : "Could not queue this download.");
  } finally {
    el.queueBtn.disabled = false;
  }
}

function upsertJob(job) {
  state.jobs.set(job.job_id, job);
}

function formatSpeed(bytesPerSec) {
  if (!bytesPerSec) return "";
  const mb = bytesPerSec / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB/s` : `${(bytesPerSec / 1024).toFixed(0)} KB/s`;
}

const STATUS_LABELS = {
  queued: "Queued",
  downloading: "Downloading",
  merging: "Merging",
  converting: "Converting",
  completed: "Completed",
  error: "Error",
  cancelled: "Cancelled",
};

function renderQueue() {
  const jobs = Array.from(state.jobs.values()).sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
  el.queueList.innerHTML = "";
  if (jobs.length === 0) {
    el.queueList.appendChild(el.queueEmpty);
    return;
  }

  for (const job of jobs) {
    const row = document.createElement("div");
    row.className = "job-row";

    const header = document.createElement("div");
    header.className = "flex items-center justify-between";

    const title = document.createElement("span");
    title.className = "font-medium";
    title.textContent = job.title || job.filename || job.url;

    const badge = document.createElement("span");
    badge.className = "uk-label";
    badge.textContent = STATUS_LABELS[job.status] || job.status;

    header.appendChild(title);
    header.appendChild(badge);
    row.appendChild(header);

    if (job.status === "downloading" || job.status === "completed") {
      const progress = document.createElement("progress");
      progress.className = "uk-progress";
      progress.max = 100;
      progress.value = job.percent || 0;
      row.appendChild(progress);
    } else if (job.status === "merging" || job.status === "converting") {
      const progress = document.createElement("progress");
      progress.className = "uk-progress";
      row.appendChild(progress);
    }

    const meta = document.createElement("div");
    meta.className = "text-sm text-muted-foreground flex gap-3";
    const parts = [];
    if (job.percent != null && job.status === "downloading") parts.push(`${job.percent.toFixed(1)}%`);
    if (job.speed) parts.push(formatSpeed(job.speed));
    if (job.eta != null) parts.push(`ETA ${job.eta}s`);
    meta.textContent = parts.join(" · ");
    row.appendChild(meta);

    if (job.status === "error" && job.error) {
      const errBox = document.createElement("div");
      errBox.className = "uk-alert uk-alert-danger mt-2";
      errBox.textContent = job.error;
      row.appendChild(errBox);
    }

    if (job.status === "queued") {
      const cancelLink = document.createElement("button");
      cancelLink.className = "uk-btn uk-btn-default uk-btn-sm mt-2";
      cancelLink.textContent = "Cancel";
      cancelLink.addEventListener("click", async () => {
        try {
          await cancelJob(job.job_id);
        } catch (err) {
          // job may have already started; the next WS update will reflect reality
        }
      });
      row.appendChild(cancelLink);
    }

    el.queueList.appendChild(row);
  }
}

function handleWsMessage(data) {
  if (data.type === "snapshot") {
    for (const job of data.jobs) upsertJob(job);
    renderQueue();
  } else if (data.type === "progress") {
    upsertJob(data);
    renderQueue();
  }
}

async function init() {
  el.settingsToggle.addEventListener("click", toggleSettings);
  el.settingsSave.addEventListener("click", saveSettingsHandler);
  el.probeBtn.addEventListener("click", probeHandler);
  el.urlInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") probeHandler();
  });
  el.modeSelect.addEventListener("change", updateModeVisibility);
  el.audioFormatSelect.addEventListener("change", populateResolutionOptions);
  el.queueBtn.addEventListener("click", queueHandler);

  await Promise.all([refreshHealth(), loadSettings()]);

  try {
    const jobs = await getQueue();
    for (const job of jobs) upsertJob(job);
    renderQueue();
  } catch (err) {
    // queue list will hydrate from the WS snapshot instead
  }

  connectProgressSocket(handleWsMessage);
}

init();
