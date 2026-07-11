/**
 * PAGES — Bảng điểm (Report Viewer)
 */

Pages._bdState = null;

Pages.bangdiem = async function() {
    UI.setTitle('Bảng điểm Môn học');
    UI.showLoading();

    const lopRes = await API.getLop();

    this._bdState = { loaded: false, malop: '', mamh: '', lan: '' };

    const html = `<div class="rv-container">
        <!-- Filter Bar -->
        <div class="rv-filter-bar">
            <div class="rv-filter-group">
                <label>Lớp</label>
                <select id="bd_malop">
                    <option value="">-- Chọn lớp --</option>
                    ${UI.selectOptions(lopRes?.data || [], 'MALOP', 'TENLOP')}
                </select>
            </div>
            <div class="rv-filter-group">
                <label>Môn học</label>
                <select id="bd_mamh" disabled>
                    <option value="">-- Chọn Môn --</option>
                </select>
            </div>
            <div class="rv-filter-group">
                <label>Lần thi</label>
                <select id="bd_lan" disabled style="width:110px">
                    <option value="">-- Chọn Lần --</option>
                </select>
            </div>
            <button class="rv-btn rv-btn-primary" onclick="Pages.loadBangDiem()">
                <span style="font-size:16px; margin-right:4px;">&#9654;</span> Xem Preview
            </button>
        </div>

        <!-- Toolbar -->
        <div class="rv-toolbar">
            <div class="rv-toolbar-group">
                <button class="rv-icon-btn" onclick="Pages._bdPrint()" title="Print" id="rvBtnPrint" disabled>Print</button>
            </div>

            <div class="rv-toolbar-divider"></div>

            <div class="rv-toolbar-group">
                <button class="rv-icon-btn" title="First Page" disabled>&lt;&lt;</button>
                <button class="rv-icon-btn" title="Previous Page" disabled>&lt;</button>
                <div class="rv-page-info">Page <input type="text" value="1" readonly> of 1</div>
                <button class="rv-icon-btn" title="Next Page" disabled>&gt;</button>
                <button class="rv-icon-btn" title="Last Page" disabled>&gt;&gt;</button>
            </div>

            <div class="rv-toolbar-divider"></div>

            <div class="rv-toolbar-group">
                <button class="rv-icon-btn" title="Zoom Out" onclick="Pages._bdZoom(-0.25)">-</button>
                <select class="rv-zoom-select" id="rvZoomSelect" onchange="Pages._bdZoomTo(this.value)">
                    <option value="0.5">50%</option>
                    <option value="0.75">75%</option>
                    <option value="1" selected>100%</option>
                    <option value="1.25">125%</option>
                    <option value="1.5">150%</option>
                    <option value="2">200%</option>
                    <option value="fit">Fit to Page</option>
                </select>
                <button class="rv-icon-btn" title="Zoom In" onclick="Pages._bdZoom(0.25)">+</button>
            </div>

            <div class="rv-toolbar-divider"></div>

            <div class="rv-toolbar-group" style="position: relative;">
                <button class="rv-icon-btn rv-export-btn" id="rvBtnExport" onclick="document.getElementById('rvExportMenu').classList.toggle('show')" disabled>
                    Export &#9662;
                </button>
                <div class="rv-export-menu" id="rvExportMenu">
                    <a href="javascript:Pages._bdExport('pdf')">PDF File</a>
                    <a href="javascript:Pages._bdExport('html')">HTML File</a>
                    <a href="javascript:Pages._bdExport('mht')">MHT File</a>
                    <a href="javascript:Pages._bdExport('rtf')">RTF File</a>
                    <a href="javascript:Pages._bdExport('doc')">DOC File</a>
                    <a href="javascript:Pages._bdExport('xls')">XLS File</a>
                    <a href="javascript:Pages._bdExport('xlsx')">XLSX File</a>
                    <a href="javascript:Pages._bdExport('csv')">CSV File</a>
                    <a href="javascript:Pages._bdExport('txt')">Text File</a>
                    <a href="javascript:Pages._bdExportImage()">Image File</a>
                </div>
            </div>
        </div>

        <!-- Preview Area -->
        <div class="rv-preview-area" id="rvPreviewArea">
            <div class="rv-empty-state" id="rvEmptyState">
                Vui lòng chọn lớp và môn học, sau đó nhấn "Xem Preview" để tạo báo cáo.
            </div>
            <div class="rv-page-wrapper" id="rvPageWrapper" style="display:none;">
                <div class="rv-page" id="rvPage">
                     <!-- jsreport iframe will be rendered here -->
                </div>
            </div>
        </div>

        <!-- Status Bar -->
        <div class="rv-statusbar">
            <div id="rvStatusText">Ready</div>
            <div id="rvZoomStatus">100%</div>
        </div>
    </div>`;

    UI.showContent(html);

    // Dynamic Select Filtering Elements and Handlers
    const selLop = document.getElementById('bd_malop');
    const selMH = document.getElementById('bd_mamh');
    const selLan = document.getElementById('bd_lan');

    selLop?.addEventListener('change', async () => {
        const malop = selLop.value;
        this._bdState.malop = malop;
        this._bdState.mamh = '';
        this._bdState.lan = '';

        selMH.innerHTML = '<option value="">-- Chọn Môn --</option>';
        selMH.disabled = true;
        selLan.innerHTML = '<option value="">-- Chọn Lần --</option>';
        selLan.disabled = true;

        if (!malop) return;

        try {
            const res = await API.getMonHocDaThiCuaLop(malop);
            if (res && res.success && res.data.length > 0) {
                selMH.innerHTML += UI.selectOptions(res.data, 'MAMH', 'TENMH');
                selMH.disabled = false;
            } else {
                UI.toast('Lớp này chưa có sinh viên nào thi môn học nào!', 'info');
            }
        } catch (err) {
            console.error(err);
            UI.toast('Lỗi khi tải danh sách môn học!', 'error');
        }
    });

    selMH?.addEventListener('change', async () => {
        const malop = selLop.value;
        const mamh = selMH.value;
        this._bdState.mamh = mamh;
        this._bdState.lan = '';

        selLan.innerHTML = '<option value="">-- Chọn Lần --</option>';
        selLan.disabled = true;

        if (!malop || !mamh) return;

        try {
            const res = await API.getLanThiDaThiCuaLopMon(malop, mamh);
            if (res && res.success && res.data.length > 0) {
                selLan.innerHTML += res.data.map(item => `<option value="${item.LAN}">Lần ${item.LAN}</option>`).join('');
                selLan.disabled = false;
            } else {
                UI.toast('Không tìm thấy lần thi nào cho môn học này ở lớp được chọn!', 'info');
            }
        } catch (err) {
            console.error(err);
            UI.toast('Lỗi khi tải danh sách lần thi!', 'error');
        }
    });

    selLan?.addEventListener('change', () => {
        this._bdState.lan = selLan.value;
    });

    // Click outside to close export menu
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.rv-export-btn') && !e.target.closest('.rv-export-menu')) {
            document.getElementById('rvExportMenu')?.classList.remove('show');
        }
    });
};

Pages.loadBangDiem = async function() {
    const st = this._bdState;
    if (!st) return;

    const malop = document.getElementById('bd_malop')?.value;
    const mamh = document.getElementById('bd_mamh')?.value;
    const lan = document.getElementById('bd_lan')?.value;
    if (!malop || !mamh || !lan) return UI.toast('Vui lòng chọn đầy đủ Lớp, Môn học và Lần thi!', 'error');

    st.malop = malop; st.mamh = mamh; st.lan = lan;

    document.getElementById('rvStatusText').textContent = 'Generating report...';
    document.getElementById('rvEmptyState').innerHTML = '<div class="spinner" style="margin: 20px auto;"></div><p>Đang tạo báo cáo...</p>';
    document.getElementById('rvPageWrapper').style.display = 'none';
    document.getElementById('rvEmptyState').style.display = 'block';

    this._bdRenderPreview();
};

Pages._bdRenderPreview = function() {
    const st = this._bdState;
    const previewUrl = `/api/report/bangdiem/preview?malop=${st.malop}&mamh=${st.mamh}&lan=${st.lan}`;

    const rvPage = document.getElementById('rvPage');
    rvPage.innerHTML = `<iframe src="${previewUrl}" class="rv-iframe" frameborder="0"></iframe>`;

    document.getElementById('rvEmptyState').style.display = 'none';
    document.getElementById('rvPageWrapper').style.display = 'flex';

    st.loaded = true;
    document.getElementById('rvBtnPrint').disabled = false;
    document.getElementById('rvBtnExport').disabled = false;
    document.getElementById('rvStatusText').textContent = 'Report generated successfully';
};

Pages._bdPrint = function() {
    const st = this._bdState;
    if (!st || !st.loaded) return;
    const printUrl = `/api/report/bangdiem/preview?malop=${st.malop}&mamh=${st.mamh}&lan=${st.lan}`;
    const printWin = window.open(printUrl, '_blank', 'width=1000,height=800');
    if (printWin) {
        printWin.onload = function () {
            setTimeout(() => { printWin.print(); }, 500);
        };
    }
};

Pages._bdZoomValue = 1;

Pages._bdZoom = function(delta) {
    if (!this._bdState?.loaded) return;
    let z = this._bdZoomValue + delta;
    z = Math.max(0.25, Math.min(3, z));
    this._bdZoomTo(z);
    document.getElementById('rvZoomSelect').value = z;
};

Pages._bdZoomTo = function(val) {
    if (!this._bdState?.loaded) return;
    const wrapper = document.getElementById('rvPageWrapper');
    if (val === 'fit') {
        const areaWidth = document.getElementById('rvPreviewArea').clientWidth;
        // A4 pixel width is approx 794px
        const scale = (areaWidth - 40) / 794;
        val = Math.min(1.5, scale); // max 150%
    } else {
        val = parseFloat(val);
    }
    this._bdZoomValue = val;

    document.getElementById('rvPage').style.transform = `scale(${val})`;
    document.getElementById('rvZoomStatus').textContent = Math.round(val * 100) + '%';
};

Pages._bdExport = function(format) {
    const st = this._bdState;
    if (!st || !st.loaded) return UI.toast('Chưa có dữ liệu!', 'error');

    document.getElementById('rvExportMenu')?.classList.remove('show');
    document.getElementById('rvStatusText').textContent = 'Exporting to ' + format.toUpperCase() + '...';

    const url = `/api/report/bangdiem/${format}?malop=${st.malop}&mamh=${st.mamh}&lan=${st.lan}`;

    // Trigger download via hidden iframe
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = url;
    document.body.appendChild(iframe);

    setTimeout(() => {
        document.body.removeChild(iframe);
        document.getElementById('rvStatusText').textContent = 'Ready';
    }, 3000);
};

Pages._bdExportImage = function() {
    const st = this._bdState;
    if (!st || !st.loaded) return UI.toast('Chưa có dữ liệu!', 'error');
    document.getElementById('rvExportMenu')?.classList.remove('show');
    // Mở preview trong cửa sổ mới, người dùng có thể Save As Image hoặc in ra PDF
    const url = `/api/report/bangdiem/preview?malop=${st.malop}&mamh=${st.mamh}&lan=${st.lan}`;
    window.open(url, '_blank');
};
