// Backend Sunucu Adresi
const BACKEND_URL = 'http://127.0.0.1:5005';

// DOM elemanları
let btnSettings, settingsPanel, apiKeyInput, btnSaveKey, btnClearKey;
let dropZone, fileInput, jdInput, btnAnalyze;
let loadingScreen, resultsSection;
let scoreValue, listStrengths, listGaps, listSuggestions, listAts;

let selectedFile = null;
let extractedText = "";

// Sayfa tamamen yüklendikten sonra çalışır
window.addEventListener('DOMContentLoaded', async () => {
  // DOM elemanlarını yakala
  btnSettings = document.getElementById('btn-settings');
  settingsPanel = document.getElementById('settings-panel');
  apiKeyInput = document.getElementById('api-key-input');
  btnSaveKey = document.getElementById('btn-save-key');
  btnClearKey = document.getElementById('btn-clear-key');

  dropZone = document.getElementById('drop-zone');
  fileInput = document.getElementById('file-input');
  jdInput = document.getElementById('jd-input');
  btnAnalyze = document.getElementById('btn-analyze');

  loadingScreen = document.getElementById('loading-screen');
  resultsSection = document.getElementById('results-section');

  scoreValue = document.getElementById('score-value');
  listStrengths = document.getElementById('list-strengths');
  listGaps = document.getElementById('list-gaps');
  listSuggestions = document.getElementById('list-suggestions');
  listAts = document.getElementById('list-ats');

  // Eksik DOM elemanı varsa erken uyarı ver
  if (
    !btnSettings ||
    !settingsPanel ||
    !apiKeyInput ||
    !btnSaveKey ||
    !btnClearKey ||
    !dropZone ||
    !fileInput ||
    !jdInput ||
    !btnAnalyze ||
    !loadingScreen ||
    !resultsSection ||
    !scoreValue ||
    !listStrengths ||
    !listGaps ||
    !listSuggestions ||
    !listAts
  ) {
    console.error("renderer.js: Bazı HTML elemanları bulunamadı. ID isimlerini kontrol et.");
    alert("Arayüz yüklenirken hata oluştu. HTML ID isimlerini kontrol et.");
    return;
  }

  // Kayıtlı API anahtarı varsa input alanına doldur
  try {
    const savedKey = await window.electronAPI.getApiKey();

    if (savedKey) {
      apiKeyInput.value = savedKey;
    }
  } catch (err) {
    console.error("API key okunamadı:", err);
  }

  // Event listener'ları bağla
  setupEventListeners();
});

// Bütün event listener'lar burada toplanır
function setupEventListeners() {
  // Ayarlar panelini aç/kapat
  btnSettings.addEventListener('click', (e) => {
    e.preventDefault();
    settingsPanel.classList.toggle('hidden');
  });

// API anahtarını kaydet
btnSaveKey.addEventListener('click', saveApiKey);

// API anahtarını sıfırla
btnClearKey.addEventListener('click', clearApiKey);

  // Dosya seçmek için drop zone'a tıklama
  dropZone.addEventListener('click', () => {
    fileInput.click();
  });

  // Normal dosya seçimi
  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelection(e.target.files[0]);
    }
  });

  // Sürükle-bırak efektleri
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  });

  // Analiz başlat
  btnAnalyze.addEventListener('click', analyzeCv);
}

// API anahtarını kaydetme
async function saveApiKey() {
  const key = apiKeyInput.value.trim();

  if (!key) {
    alert('Lütfen geçerli bir API anahtarı girin.');
    return;
  }

  try {
    await window.electronAPI.saveApiKey(key);
    alert('API anahtarı başarıyla kaydedildi.');
    settingsPanel.classList.add('hidden');
  } catch (err) {
    console.error("API key kaydedilemedi:", err);
    alert('API anahtarı kaydedilirken hata oluştu.');
  }
}

async function clearApiKey() {
  const confirmClear = confirm("Kayıtlı Gemini API anahtarını silmek istediğinizden emin misiniz?");

  if (!confirmClear) {
    return;
  }

  try {
    await window.electronAPI.clearApiKey();

    apiKeyInput.value = "";
    alert("API anahtarı başarıyla sıfırlandı.");

  } catch (err) {
    console.error("API key sıfırlanamadı:", err);
    alert("API anahtarı sıfırlanırken hata oluştu.");
  }
}

// Seçilen PDF dosyasını backend'e gönderip metin çıkarma
async function handleFileSelection(file) {
  if (!file) {
    return;
  }

  if (file.type !== 'application/pdf') {
    alert('Lütfen sadece PDF formatında bir dosya yükleyin.');
    return;
  }

  const maxSizeMB = 5;
  const fileSizeMB = file.size / (1024 * 1024);

  if (fileSizeMB > maxSizeMB) {
    alert(`Dosya boyutu çok büyük. Maksimum ${maxSizeMB}MB PDF yükleyebilirsiniz.`);
    return;
  }

  selectedFile = file;
  extractedText = "";

  const titleElement = dropZone.querySelector('h4');
  const descElement = dropZone.querySelector('p');

  if (titleElement) {
    titleElement.innerText = `Seçilen Dosya: ${file.name}`;
  }

  if (descElement) {
    descElement.innerHTML = "Değiştirmek için tekrar sürükleyebilir veya tıklayabilirsiniz.";
  }

  btnAnalyze.disabled = true;
  btnAnalyze.innerText = "PDF Okunuyor...";

  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await fetch(`${BACKEND_URL}/api/extract-text`, {
      method: 'POST',
      body: formData
    });

    const data = await response.json();

    if (!response.ok) {
      alert(`PDF Okuma Hatası: ${data.detail || 'Bilinmeyen hata'}`);
      btnAnalyze.innerText = "Analizi Başlat";
      btnAnalyze.disabled = true;
      return;
    }

    extractedText = data.text || "";

    if (!extractedText.trim()) {
      alert("PDF içinden metin çıkarılamadı. Bu PDF taranmış görsel olabilir.");
      btnAnalyze.innerText = "Analizi Başlat";
      btnAnalyze.disabled = true;
      return;
    }

    btnAnalyze.disabled = false;
    btnAnalyze.innerText = "Analizi Başlat";

  } catch (error) {
    console.error("PDF okuma bağlantı hatası:", error);
    alert('Python backend sunucusuna bağlanılamadı. Lütfen backend’in çalıştığından emin olun.');
    btnAnalyze.innerText = "Analizi Başlat";
    btnAnalyze.disabled = true;
  }
}

// Gemini analizini başlatma
async function analyzeCv() {
  let apiKey = "";

  try {
    apiKey = await window.electronAPI.getApiKey();
  } catch (err) {
    console.error("API key alınamadı:", err);
  }

  if (!apiKey) {
    alert('Analiz başlatılamadı. Lütfen önce sağ üstteki çark ikonundan Gemini API anahtarınızı girip kaydedin.');
    settingsPanel.classList.remove('hidden');
    return;
  }

  if (!selectedFile || !extractedText.trim()) {
    alert('Lütfen önce geçerli bir PDF CV yükleyin.');
    return;
  }

  loadingScreen.classList.remove('hidden');
  resultsSection.classList.add('hidden');
  btnAnalyze.disabled = true;
  btnAnalyze.innerText = "Analiz Ediliyor...";

  const payload = {
    cv_text: extractedText,
    job_description: jdInput.value.trim()
  };

  try {
    const response = await fetch(`${BACKEND_URL}/api/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!response.ok) {
      alert(`Analiz Hatası: ${result.detail || 'Bilinmeyen hata'}`);
      return;
    }

    renderResults(result);

  } catch (error) {
    console.error("Analiz bağlantı hatası:", error);
    alert('Analiz sırasında bir hata oluştu. Backend veya internet bağlantısını kontrol edin.');
  } finally {
    loadingScreen.classList.add('hidden');
    btnAnalyze.disabled = false;
    btnAnalyze.innerText = "Analizi Başlat";
  }
}

// JSON sonuçlarını ekrana basma
function renderResults(data) {
  scoreValue.innerText = data.overall_score || 0;

  fillList(listStrengths, data.key_strengths);
  fillList(listGaps, data.critical_gaps);
  fillList(listSuggestions, data.actionable_suggestions);
  fillList(listAts, data.ats_optimization_tips);

  resultsSection.classList.remove('hidden');
  resultsSection.scrollIntoView({ behavior: 'smooth' });
}

// Liste doldurma yardımcı fonksiyonu
function fillList(element, itemsArray) {
  element.innerHTML = "";

  if (Array.isArray(itemsArray) && itemsArray.length > 0) {
    itemsArray.forEach((item) => {
      const li = document.createElement('li');
      li.innerText = item;
      element.appendChild(li);
    });
  } else {
    const li = document.createElement('li');
    li.innerText = "Veri bulunamadı.";
    li.style.color = "var(--text-muted)";
    element.appendChild(li);
  }
}