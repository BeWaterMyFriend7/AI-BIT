chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getAllTabs') {
    getAllTabsInfo()
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }

  if (request.action === 'saveToFile') {
    saveLinksToFile(request.links)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }

  if (request.action === 'saveToBookmark') {
    saveLinksToBookmark(request.links, request.folderName)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }

  if (request.action === 'importFromBookmark') {
    importFromBookmark(request.folderName)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }

  if (request.action === 'getSavedLinksCount') {
    getSavedLinksCount(request.folderName)
      .then(count => sendResponse({ count }))
      .catch(() => sendResponse({ count: 0 }));
    return true;
  }
});

async function getAllTabsInfo() {
  try {
    const tabs = await chrome.tabs.query({});
    
    const links = tabs
      .filter(tab => tab.url && (tab.url.startsWith('http') || tab.url.startsWith('https')))
      .map(tab => ({
        url: tab.url,
        title: tab.title
      }));

    const uniqueLinks = [];
    const seenUrls = new Set();
    
    for (const link of links) {
      if (!seenUrls.has(link.url)) {
        seenUrls.add(link.url);
        uniqueLinks.push(link);
      }
    }

    return {
      tabs: uniqueLinks,
      total: tabs.length,
      unique: uniqueLinks.length
    };
  } catch (error) {
    throw new Error('获取标签页失败: ' + error.message);
  }
}

async function saveLinksToFile(links) {
  try {
    const content = links.map(link => link.url).join('\n');
    const timestamp = new Date().toLocaleString('zh-CN', { hour12: false }).replace(/[/: ]/g, '-');
    const filename = `links-${timestamp}.txt`;

    const bytes = new Uint8Array(content.length);
    for (let i = 0; i < content.length; i++) {
      bytes[i] = content.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: 'text/plain' });
    
    const reader = new FileReader();
    
    return new Promise((resolve, reject) => {
      reader.onload = async (e) => {
        try {
          const dataUrl = e.target.result;
          await chrome.downloads.download({
            url: dataUrl,
            filename: filename,
            saveAs: true
          });
          
          resolve({
            success: true,
            message: `已保存 ${links.length} 个链接`,
            count: links.length,
            filename: filename
          });
        } catch (err) {
          reject(new Error('下载失败: ' + err.message));
        }
      };
      reader.onerror = () => reject(new Error('读取文件失败'));
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    throw new Error('保存文件失败: ' + error.message);
  }
}

async function saveLinksToBookmark(links, folderName) {
  try {
    const searchResults = await chrome.bookmarks.search({ title: folderName });
    let folder = searchResults.find(b => b.url === undefined && b.title === folderName);
    let folderId;

    if (!folder) {
      const createResult = await chrome.bookmarks.create({
        title: folderName,
        parentId: '1'
      });
      folderId = createResult.id;
    } else {
      folder = searchResults.find(b => b.url === undefined);
      folderId = folder.id;
    }

    const existingChildren = await chrome.bookmarks.getChildren(folderId);
    const existingUrls = new Set(
      existingChildren
        .filter(child => child.url)
        .map(child => child.url)
    );

    let addedCount = 0;
    for (const link of links) {
      if (!existingUrls.has(link.url)) {
        await chrome.bookmarks.create({
          title: link.title || link.url,
          url: link.url,
          parentId: folderId
        });
        addedCount++;
      }
    }

    return {
      success: true,
      message: `已添加 ${addedCount} 个新链接到 "${folderName}"（共 ${existingChildren.length + addedCount} 个）`,
      count: addedCount,
      totalCount: existingChildren.length + addedCount,
      folderName: folderName
    };
  } catch (error) {
    throw new Error('保存书签失败: ' + error.message);
  }
}

async function importFromBookmark(folderName) {
  try {
    const searchResults = await chrome.bookmarks.search({ title: folderName });
    const folder = searchResults.find(b => b.url === undefined && b.title === folderName);

    if (!folder) {
      throw new Error(`未找到书签文件夹 "${folderName}"`);
    }

    const children = await chrome.bookmarks.getChildren(folder.id);
    const links = children
      .filter(child => child.url && (child.url.startsWith('http') || child.url.startsWith('https')))
      .map(child => ({
        url: child.url,
        title: child.title
      }));

    if (links.length === 0) {
      return {
        success: true,
        message: '文件夹中没有找到链接',
        links: [],
        count: 0
      };
    }

    for (const link of links) {
      await chrome.tabs.create({ url: link.url, active: false });
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    return {
      success: true,
      message: `已打开 ${links.length} 个链接`,
      links: links,
      count: links.length
    };
  } catch (error) {
    throw new Error('导入失败: ' + error.message);
  }
}

async function getSavedLinksCount(folderName) {
  try {
    const targetFolder = folderName || 'tmp';
    const searchResults = await chrome.bookmarks.search({ title: targetFolder });
    const folder = searchResults.find(b => b.url === undefined && b.title === targetFolder);
    
    if (!folder) {
      return 0;
    }

    const children = await chrome.bookmarks.getChildren(folder.id);
    const count = children.filter(child => 
      child.url && (child.url.startsWith('http') || child.url.startsWith('https'))
    ).length;
    
    return count;
  } catch (error) {
    console.error('获取书签数量失败:', error);
    return 0;
  }
}
