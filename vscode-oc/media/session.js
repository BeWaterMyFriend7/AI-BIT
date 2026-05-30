(function () {
    var vscode = acquireVsCodeApi();
    var anchorList = document.getElementById('anchorList');
    var preview = document.getElementById('preview');
    var refreshBtn = document.getElementById('refreshBtn');

    var anchors = [];

    function renderAnchors() {
        anchorList.innerHTML = '';
        anchors.forEach(function (a, i) {
            var item = document.createElement('div');
            item.className = 'anchor-item';
            item.dataset.index = i;

            var time = document.createElement('div');
            time.className = 'anchor-time';
            time.textContent = a.time;

            var summary = document.createElement('div');
            summary.className = 'anchor-summary';
            summary.textContent = a.summary;

            item.appendChild(time);
            item.appendChild(summary);

            item.addEventListener('click', function () {
                document.querySelectorAll('.anchor-item').forEach(function (el) { el.classList.remove('active'); });
                item.classList.add('active');
                vscode.postMessage({ type: 'jumpTo', index: i });
            });

            item.addEventListener('mouseenter', function (e) {
                preview.innerHTML =
                    '<div class="section-label">输入</div>' + escapeHtml(a.input) +
                    '<hr class="divider">' +
                    '<div class="section-label">输出</div>' + escapeHtml(a.output);
                preview.classList.remove('hidden');
                positionPreview(e);
            });

            item.addEventListener('mouseleave', function () {
                preview.classList.add('hidden');
            });

            anchorList.appendChild(item);
        });
    }

    function positionPreview(e) {
        var rect = e.currentTarget.getBoundingClientRect();
        preview.style.left = Math.min(rect.right + 8, window.innerWidth - 410) + 'px';
        preview.style.top = Math.min(rect.top, window.innerHeight - 310) + 'px';
    }

    function escapeHtml(text) {
        var div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    refreshBtn.addEventListener('click', function () {
        vscode.postMessage({ type: 'refresh' });
    });

    window.addEventListener('message', function (event) {
        var msg = event.data;
        if (msg.type === 'updateAnchors') {
            anchors = msg.anchors;
            renderAnchors();
        }
        if (msg.type === 'highlightAnchor') {
            var el = document.querySelector('.anchor-item[data-index="' + msg.index + '"]');
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                el.classList.add('flash');
                setTimeout(function () { el.classList.remove('flash'); }, 600);
            }
        }
    });
})();
