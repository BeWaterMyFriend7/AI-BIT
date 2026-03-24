let pendingLinks = [];
let selectedFile = null;
let currentMode = null;

document.addEventListener('DOMContentLoaded', () => {
  initUI();
  loadStats();
});

function initUI() {
  document.getElementById('saveBtn').addEventListener('click', showSavePanel);
  document.getElementById('importBtn').addEventListener('click', showImportPanel);
  document.getElementById('confirmSaveBtn').addEventListener('click', handleSave);
  document.getElementById('cancelSaveBtn').addEventListener('click', hideAllPanels);
  document.getElementById('confirmImportBtn').addEventListener('click', handleImport);
  document.getElementById('cancelImportBtn').addEventListener('click', hideAllPanels);
  document.getElementById('selectFileBtn').addEventListener('click', () => {
    document.getElementById('fileInput').click();
  });
  document.getElementById('fileInput').addEventListener('change', handleFileSelect);
  document.getElementById('confirmBtn').addEventListener('click', executeImport);
  document.getElementById('cancelBtn').addEventListener('click', cancelPreview);

  document.querySelectorAll('input[name="saveMode"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      document.getElementById('bookmarkInputGroup').style.display = 
        e.target.value === 'bookmark' ? 'block' : 'none';
      loadStats();
    });
  });

  document.getElementById('bookmarkFolder').addEventListener('input', loadStats);
  document.getElementById('importBookmarkFolder').addEventListener('input', () => {
    const folderName = document.getElementById('importBookmarkFolder').value.trim() || 'tmp';
    document.getElementById('savedLinksLabel').textContent = folderName + '收藏夹链接';
    sendMessage({ action: 'getSavedLinksCount', folderName: folderName }).then(result => {
      document.getElementById('savedLinks').textContent = result.count || 0;
    });
  });

  document.querySelectorAll('input[name="importMode"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      const importBookmarkInput = document.getElementById('importBookmarkInput');
      const fileImportWrapper = document.getElementById('fileImportWrapper');
      
      if (e.target.value === 'bookmark') {
        importBookmarkInput.style.display = 'block';
        fileImportWrapper.style.display = 'none';
        const folderName = document.getElementById('importBookmarkFolder').value.trim() || 'tmp';
        document.getElementById('savedLinksLabel').textContent = folderName + '收藏夹链接';
        sendMessage({ action: 'getSavedLinksCount', folderName: folderName }).then(result => {
          document.getElementById('savedLinks').textContent = result.count || 0;
        });
      } else {
        importBookmarkInput.style.display = 'none';
        fileImportWrapper.style.display = 'flex';
        const saveMode = document.querySelector('input[name="saveMode"]:checked');
        const folderName = saveMode && saveMode.value === 'bookmark' 
          ? (document.getElementById('bookmarkFolder').value.trim() || 'tmp') 
          : 'tmp';
        document.getElementById('savedLinksLabel').textContent = folderName + '收藏夹链接';
        sendMessage({ action: 'getSavedLinksCount', folderName: folderName }).then(result => {
          document.getElementById('savedLinks').textContent = result.count || 0;
        });
      }
    });
  });
}

async function loadStats() {
  try {
    const tabsResult = await sendMessage({ action: 'getAllTabs' });
    document.getElementById('currentTabs').textContent = tabsResult.unique || 0;

    const folderName = document.getElementById('bookmarkFolder').value.trim() || 'tmp';
    const countResult = await sendMessage({ action: 'getSavedLinksCount', folderName: folderName });
    document.getElementById('savedLinks').textContent = countResult.count || 0;
    document.getElementById('savedLinksLabel').textContent = folderName + '收藏夹链接';
  } catch (error) {
    console.error('加载统计信息失败:', error);
  }
}

function showSavePanel() {
  hideAllPanels();
  currentMode = 'save';
  document.getElementById('savePanel').classList.add('show');
}

function showImportPanel() {
  hideAllPanels();
  currentMode = 'import';
  document.getElementById('importPanel').classList.add('show');
}

function hideAllPanels() {
  document.getElementById('savePanel').classList.remove('show');
  document.getElementById('importPanel').classList.remove('show');
  document.getElementById('previewSection').classList.remove('show');
  pendingLinks = [];
  selectedFile = null;
  document.getElementById('fileName').textContent = '未选择文件';
  document.getElementById('fileInput').value = '';
  currentMode = null;
}

async function handleSave() {
  try {
    const confirmBtn = document.getElementById('confirmSaveBtn');
    confirmBtn.disabled = true;
    confirmBtn.textContent = '获取中...';

    const result = await sendMessage({ action: 'getAllTabs' });
    
    if (result.error) {
      showMessage(result.error, 'error');
      confirmBtn.disabled = false;
      confirmBtn.textContent = '确认保存';
      return;
    }

    if (!result.tabs || result.tabs.length === 0) {
      showMessage('没有可保存的链接', 'info');
      confirmBtn.disabled = false;
      confirmBtn.textContent = '确认保存';
      return;
    }

    pendingLinks = result.tabs;
    
    const saveMode = document.querySelector('input[name="saveMode"]:checked').value;
    
    if (saveMode === 'file') {
      await executeFileSave();
    } else {
      await executeBookmarkSave();
    }
    
    confirmBtn.disabled = false;
    confirmBtn.textContent = '确认保存';
  } catch (error) {
    showMessage('保存失败: ' + error.message, 'error');
    const confirmBtn = document.getElementById('confirmSaveBtn');
    confirmBtn.disabled = false;
    confirmBtn.textContent = '确认保存';
  }
}

async function executeFileSave() {
  const result = await sendMessage({ 
    action: 'saveToFile', 
    links: pendingLinks 
  });

  if (result.error) {
    showMessage(result.error, 'error');
  } else {
    showMessage(result.message, 'success');
    hideAllPanels();
    loadStats();
  }
}

async function executeBookmarkSave() {
  const folderName = document.getElementById('bookmarkFolder').value.trim() || 'tmp';
  
  const result = await sendMessage({ 
    action: 'saveToBookmark', 
    links: pendingLinks,
    folderName: folderName
  });

  if (result.error) {
    showMessage(result.error, 'error');
  } else {
    showMessage(result.message, 'success');
    hideAllPanels();
    loadStats();
  }
}

function handleFileSelect(e) {
  const file = e.target.files[0];
  if (file) {
    selectedFile = file;
    document.getElementById('fileName').textContent = file.name;
  }
}

async function handleImport() {
  const importMode = document.querySelector('input[name="importMode"]:checked').value;
  
  try {
    const confirmBtn = document.getElementById('confirmImportBtn');
    confirmBtn.disabled = true;
    confirmBtn.textContent = '导入中...';

    if (importMode === 'file') {
      if (!selectedFile) {
        showMessage('请先选择文件', 'error');
        confirmBtn.disabled = false;
        confirmBtn.textContent = '确认导入';
        return;
      }
      
      const links = await parseFile(selectedFile);
      
      if (links.length === 0) {
        showMessage('文件中没有有效链接', 'info');
        confirmBtn.disabled = false;
        confirmBtn.textContent = '确认导入';
        return;
      }

      pendingLinks = links;
      showPreview(links, 'import');
      
    } else {
      const folderName = document.getElementById('importBookmarkFolder').value.trim() || 'tmp';
      const result = await sendMessage({ 
        action: 'importFromBookmark', 
        folderName: folderName
      });

      if (result.error) {
        showMessage(result.error, 'error');
      } else {
        showMessage(result.message, 'success');
        if (result.links && result.links.length > 0) {
          pendingLinks = result.links.map(l => l.url || l);
          showPreview(result.links, 'import');
        } else {
          hideAllPanels();
        }
      }
    }
  } catch (error) {
    showMessage('导入失败: ' + error.message, 'error');
  } finally {
    const confirmBtn = document.getElementById('confirmImportBtn');
    confirmBtn.disabled = false;
    confirmBtn.textContent = '确认导入';
  }
}

async function executeImport() {
  try {
    const confirmBtn = document.getElementById('confirmBtn');
    confirmBtn.disabled = true;
    confirmBtn.textContent = '打开中...';

    for (const link of pendingLinks) {
      const url = typeof link === 'string' ? link : link.url;
      await chrome.tabs.create({ url: url, active: false });
      await sleep(50);
    }
    
    showMessage(`已打开 ${pendingLinks.length} 个链接`, 'success');
    hideAllPanels();
    loadStats();
  } catch (error) {
    showMessage('打开链接失败: ' + error.message, 'error');
  } finally {
    const confirmBtn = document.getElementById('confirmBtn');
    confirmBtn.disabled = false;
    confirmBtn.textContent = '确认';
  }
}

function showPreview(links, mode) {
  const previewSection = document.getElementById('previewSection');
  const previewList = document.getElementById('previewList');
  const previewCount = document.getElementById('previewCount');
  
  previewCount.textContent = links.length;
  previewList.innerHTML = links.map(link => {
    const url = typeof link === 'string' ? link : link.url;
    const title = typeof link === 'string' ? '链接' : (link.title || '链接');
    return `
      <div class="preview-item">
        <div class="preview-title">${escapeHtml(title)}</div>
        <div class="preview-url">${escapeHtml(url)}</div>
      </div>
    `;
  }).join('');
  
  previewSection.classList.add('show');
  document.getElementById('savePanel').classList.remove('show');
  document.getElementById('importPanel').classList.remove('show');
}

function cancelPreview() {
  pendingLinks = [];
  document.getElementById('previewSection').classList.remove('show');
  
  if (currentMode === 'save') {
    document.getElementById('savePanel').classList.add('show');
  } else if (currentMode === 'import') {
    document.getElementById('importPanel').classList.add('show');
  }
}

async function parseFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const lines = text.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0 && (line.startsWith('http://') || line.startsWith('https://')));
      
      const uniqueLinks = [...new Set(lines)];
      resolve(uniqueLinks);
    };
    reader.onerror = () => reject(new Error('读取文件失败'));
    reader.readAsText(file);
  });
}

function sendMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, response => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}

function showMessage(text, type = 'info') {
  const messageEl = document.getElementById('message');
  messageEl.textContent = text;
  messageEl.className = `message show ${type}`;
  
  setTimeout(() => {
    messageEl.classList.remove('show');
  }, 3000);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
