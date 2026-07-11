/**
 * PAGES — Sinh viên
 */

Pages.sinhvien = async function () {
    UI.setTitle(window.APP_ROLE === 'PGV' ? 'Quản lý Lớp - Nhập Sinh viên' : 'Tra cứu Lớp & Sinh viên');
    UI.showLoading();

    const lopRes = await API.getLop();
    if (!lopRes?.success) return UI.toast('Lỗi lấy danh sách lớp', 'error');
    const lopList = (lopRes.data || []).map(row => ({
        MALOP: (row.MALOP || '').trim(),
        TENLOP: (row.TENLOP || '').trim()
    }));

    this._sinhvienState = {
        canEdit: window.APP_ROLE === 'PGV',

        // Trạng thái Lớp (Master)
        lopList,
        lopRows: [...lopList],
        lopSearchKeyword: '',
        selectedMalop: lopList[0]?.MALOP || '',
        lopMode: 'view',
        lopSnapshot: null,
        lopForm: {
            malop: lopList[0]?.MALOP || '',
            tenlop: lopList[0]?.TENLOP || ''
        },

        // Trạng thái Sinh viên (Detail)
        allRows: [],
        rows: [],
        showLocked: false,
        selectedMasv: '',
        mode: 'view',
        snapshot: null,
        form: {
            masv: '',
            ho: '',
            ten: '',
            ngaysinh: '',
            diachi: '',
            malop: lopList[0]?.MALOP || '',
            trangThai: 'Hoạt động'
        }
    };

    await this.loadSVByCurrentLop();
    this.renderSinhVienForm();
};

Pages.refreshLopList = async function (preferredMalop = '') {
    const st = this._sinhvienState;
    if (!st) return false;

    const lopRes = await API.getLop();
    if (!lopRes?.success) {
        UI.toast('Lỗi lấy danh sách lớp', 'error');
        return false;
    }

    st.lopList = (lopRes.data || []).map(row => ({
        MALOP: (row.MALOP || '').trim(),
        TENLOP: (row.TENLOP || '').trim()
    }));

    this.applyLopFilters();

    let nextMalop = preferredMalop || st.selectedMalop || st.lopRows[0]?.MALOP || '';
    if (!st.lopRows.some(row => row.MALOP === nextMalop)) {
        nextMalop = st.lopRows[0]?.MALOP || '';
    }

    st.selectedMalop = nextMalop;
    st.form.malop = nextMalop;

    const selectedLop = st.lopList.find(l => l.MALOP === nextMalop);
    st.lopForm = {
        malop: selectedLop?.MALOP || '',
        tenlop: selectedLop?.TENLOP || ''
    };
    return true;
};

Pages.normalizeSVRow = function (row) {
    return {
        MASV: (row.MASV || '').trim(),
        HO: (row.HO || '').trim(),
        TEN: (row.TEN || '').trim(),
        NGAYSINH: row.NGAYSINH || null,
        DIACHI: (row.DIACHI || '').trim(),
        MALOP: (row.MALOP || '').trim(),
        TRANG_THAI: (row.TRANG_THAI || 'Hoạt động').trim()
    };
};

Pages.formatDateForInput = function (value) {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
};

Pages.loadSVByCurrentLop = async function () {
    const st = this._sinhvienState;
    if (!st || !st.selectedMalop) {
        if (st) {
            st.allRows = [];
            st.rows = [];
            st.selectedMasv = '';
            st.form = {
                masv: '',
                ho: '',
                ten: '',
                ngaysinh: '',
                diachi: '',
                malop: '',
                trangThai: 'Hoạt động'
            };
        }
        return;
    }

    const res = await API.getSinhVien(st.selectedMalop);
    if (!res?.success) {
        UI.toast(res?.message || 'Lỗi lấy danh sách sinh viên', 'error');
        st.allRows = [];
        st.rows = [];
        st.selectedMasv = '';
        return;
    }

    st.allRows = (res.data || []).map(r => this.normalizeSVRow(r));
    this.applySVFilters();
};

Pages.applyLopFilters = function () {
    const st = this._sinhvienState;
    if (!st) return;

    const searchInput = document.getElementById('lf_search');
    if (searchInput) {
        st.lopSearchKeyword = searchInput.value.trim();
    }
    const kw = (st.lopSearchKeyword || '').toLowerCase();

    if (!kw) {
        st.lopRows = [...st.lopList];
    } else {
        st.lopRows = st.lopList.filter(row =>
            row.MALOP.toLowerCase().includes(kw) ||
            row.TENLOP.toLowerCase().includes(kw)
        );
    }

    // Nếu lớp đang chọn không còn nằm trong danh sách lọc -> chọn lớp đầu tiên trong danh sách lọc mới
    const exists = st.lopRows.some(r => r.MALOP === st.selectedMalop);
    if (!exists) {
        st.selectedMalop = st.lopRows[0]?.MALOP || '';
        const first = st.lopRows[0];
        st.lopForm = {
            malop: first?.MALOP || '',
            tenlop: first?.TENLOP || ''
        };
        st.form.malop = st.selectedMalop;
    }
};

Pages.applySVFilters = function () {
    const st = this._sinhvienState;
    if (!st) return;

    const showLocked = !!st.showLocked;
    const targetStatus = showLocked ? 'Khóa' : 'Hoạt động';

    const searchInput = document.getElementById('svf_search');
    if (searchInput) {
        st.searchKeyword = searchInput.value.trim();
    }
    const kw = (st.searchKeyword || '').toLowerCase();

    let filtered = st.allRows.filter(row => {
        const status = (row.TRANG_THAI || 'Hoạt động').trim();
        return status === targetStatus;
    });

    if (kw) {
        filtered = filtered.filter(row => {
            const fullName = `${row.HO} ${row.TEN}`.trim().toLowerCase();
            return row.MASV.toLowerCase().includes(kw)
                || row.HO.toLowerCase().includes(kw)
                || row.TEN.toLowerCase().includes(kw)
                || fullName.includes(kw);
        });
    }

    st.rows = filtered;

    const exists = st.rows.some(r => r.MASV === st.selectedMasv);
    if (!exists) {
        st.selectedMasv = st.rows[0]?.MASV || '';
        const first = st.rows[0];
        st.form = {
            masv: first?.MASV || '',
            ho: first?.HO || '',
            ten: first?.TEN || '',
            ngaysinh: this.formatDateForInput(first?.NGAYSINH),
            diachi: first?.DIACHI || '',
            malop: st.selectedMalop,
            trangThai: first?.TRANG_THAI || 'Hoạt động'
        };
    } else {
        const current = st.rows.find(r => r.MASV === st.selectedMasv);
        st.form = {
            masv: current?.MASV || '',
            ho: current?.HO || '',
            ten: current?.TEN || '',
            ngaysinh: this.formatDateForInput(current?.NGAYSINH),
            diachi: current?.DIACHI || '',
            malop: st.selectedMalop,
            trangThai: current?.TRANG_THAI || 'Hoạt động'
        };
    }
};

Pages.toggleSVStatusFilter = function (checked) {
    const st = this._sinhvienState;
    if (!st || st.mode !== 'view') return;
    st.showLocked = checked;
    this.applySVFilters();
    this.renderSinhVienForm();
};

Pages.renderSinhVienForm = function () {
    const st = this._sinhvienState;
    if (!st) return;

    // Lưu vị trí cuộn của các bảng và container chính
    const lopTableWrapper = document.getElementById('lf_table_wrapper');
    const lopScrollTop = (st._savedLopScrollTop !== undefined && st._savedLopScrollTop !== null)
        ? st._savedLopScrollTop
        : (lopTableWrapper ? lopTableWrapper.scrollTop : 0);
    delete st._savedLopScrollTop;

    const svTableWrapper = document.getElementById('svf_table_wrapper');
    const svScrollTop = (st._savedSvScrollTop !== undefined && st._savedSvScrollTop !== null)
        ? st._savedSvScrollTop
        : (svTableWrapper ? svTableWrapper.scrollTop : 0);
    delete st._savedSvScrollTop;

    const contentArea = document.getElementById('contentArea');
    const contentScrollTop = (st._savedContentScrollTop !== undefined && st._savedContentScrollTop !== null)
        ? st._savedContentScrollTop
        : (contentArea ? contentArea.scrollTop : 0);
    delete st._savedContentScrollTop;

    // Lưu trạng thái focus và vị trí con trỏ của ô tìm kiếm lớp trước khi render lại DOM
    const lopSearchInput = document.getElementById('lf_search');
    const lopHadFocus = lopSearchInput && document.activeElement === lopSearchInput;
    const lopSelectionStart = lopSearchInput ? lopSearchInput.selectionStart : 0;
    const lopSelectionEnd = lopSearchInput ? lopSearchInput.selectionEnd : 0;

    // Lưu trạng thái focus và vị trí con trỏ của ô tìm kiếm sinh viên trước khi render lại DOM
    const searchInput = document.getElementById('svf_search');
    const hadFocus = searchInput && document.activeElement === searchInput;
    const selectionStart = searchInput ? searchInput.selectionStart : 0;
    const selectionEnd = searchInput ? searchInput.selectionEnd : 0;

    // --- PHẦN LỚP HỌC (MASTER) ---
    const isLopAdd = st.lopMode === 'add';
    const isLopEdit = st.lopMode === 'edit';
    const isLopView = st.lopMode === 'view';
    const disableLopForm = !st.canEdit || (!isLopAdd && !isLopEdit);
    const showLopActions = st.canEdit;

    const lopAddAttr = isLopAdd ? 'class="btn svf-btn active" disabled style="pointer-events: none;"' : (isLopEdit ? 'class="btn svf-btn" disabled style="pointer-events: none; opacity: 0.5;"' : 'class="btn svf-btn"');
    const lopDelAttr = (isLopAdd || isLopEdit || !st.selectedMalop) ? 'disabled style="pointer-events: none; opacity: 0.5;"' : '';
    const lopEditAttr = isLopEdit ? 'class="btn svf-btn active" disabled style="pointer-events: none;"' : (isLopAdd || !st.selectedMalop) ? 'class="btn svf-btn" disabled style="pointer-events: none; opacity: 0.5;"' : 'class="btn svf-btn"';
    const lopRestoreAttr = (isLopAdd || isLopEdit) ? 'class="btn svf-btn"' : (UndoManager.canUndo('sinhvien') ? 'class="btn svf-btn"' : 'class="btn svf-btn" disabled style="pointer-events: none; opacity: 0.5;"');
    const lopSaveAttr = isLopView ? 'class="btn svf-btn" disabled style="pointer-events: none; opacity: 0.5;"' : 'class="btn svf-btn"';

    const classButtonsHtml = `
        <button ${lopAddAttr} onclick="Pages.startAddLop()">Thêm</button>
        <button class="btn svf-btn" ${lopDelAttr} onclick="Pages.deleteLopInline()">Xóa</button>
        <button ${lopEditAttr} onclick="Pages.startEditLop()">Hiệu chỉnh</button>
        <button ${lopRestoreAttr} onclick="Pages.restoreLop()">${(isLopAdd || isLopEdit) ? 'Hủy' : 'Phục hồi'}</button>
        <button ${lopSaveAttr} onclick="Pages.saveLopInline()">Ghi</button>
    `;

    const lopRowsHtml = st.lopRows.map((row, idx) => {
        const selected = row.MALOP === st.selectedMalop ? 'selected' : '';
        const pointerEvents = (st.lopMode !== 'view' || st.mode !== 'view') ? 'style="pointer-events: none; opacity: 0.6;"' : '';
        return `
            <tr class="${selected}" ${pointerEvents} onclick="Pages.selectLopRow(${idx})">
                <td>${this.escapeHtml(row.MALOP)}</td>
                <td>${this.escapeHtml(row.TENLOP)}</td>
            </tr>
        `;
    }).join('');

    const classHint = isLopAdd ? 'Đang thêm lớp mới' : (isLopEdit ? 'Đang hiệu chỉnh lớp' : 'Chế độ xem lớp');


    // --- PHẦN SINH VIÊN (DETAIL) ---
    const selectedLop = st.lopList.find(row => row.MALOP === st.selectedMalop);
    const tenLop = selectedLop?.TENLOP || '';

    const isAddMode = st.mode === 'add';
    const isEditMode = st.mode === 'edit';
    const disableForm = !st.canEdit || (!isAddMode && !isEditMode) || !st.selectedMalop;
    const showActions = st.canEdit;
    const status = isAddMode ? 'Đang thêm mới' : (isEditMode ? 'Đang hiệu chỉnh' : 'Chế độ xem');

    const tableRowsHtml = st.rows.map((row, idx) => {
        const selected = row.MASV === st.selectedMasv ? 'selected' : '';
        const pointerEvents = (st.lopMode !== 'view' || st.mode !== 'view') ? 'style="pointer-events: none; opacity: 0.6;"' : '';
        const ngaySinh = row.NGAYSINH ? new Date(row.NGAYSINH).toLocaleDateString('vi-VN') : '';
        return `
            <tr class="${selected}" ${pointerEvents} onclick="Pages.selectSVRow(${idx})">
                <td>${this.escapeHtml(row.MASV)}</td>
                <td>${this.escapeHtml(row.HO)}</td>
                <td>${this.escapeHtml(row.TEN)}</td>
                <td>${this.escapeHtml(ngaySinh)}</td>
                <td>${this.escapeHtml(row.DIACHI)}</td>
                <td>${this.escapeHtml(row.TRANG_THAI)}</td>
            </tr>
        `;
    }).join('');

    const isAdd = st.mode === 'add';
    const isEdit = st.mode === 'edit';
    const isView = st.mode === 'view';

    const addAttr = (isAdd || !st.selectedMalop) ? 'class="btn svf-btn active" disabled style="pointer-events: none;"' : (isEdit ? 'class="btn svf-btn" disabled style="pointer-events: none; opacity: 0.5;"' : 'class="btn svf-btn"');
    const delAttr = (isAdd || isEdit || !st.selectedMasv) ? 'disabled style="pointer-events: none; opacity: 0.5;"' : '';
    const editAttr = isEdit ? 'class="btn svf-btn active" disabled style="pointer-events: none;"' : (isAdd || !st.selectedMasv) ? 'class="btn svf-btn" disabled style="pointer-events: none; opacity: 0.5;"' : 'class="btn svf-btn"';
    const restoreAttr = (isAdd || isEdit) ? 'class="btn svf-btn"' : (UndoManager.canUndo('sinhvien') ? 'class="btn svf-btn"' : 'class="btn svf-btn" disabled style="pointer-events: none; opacity: 0.5;"');
    const saveAttr = isView ? 'class="btn svf-btn" disabled style="pointer-events: none; opacity: 0.5;"' : 'class="btn svf-btn"';

    const buttonsHtml = `
        <button ${addAttr} onclick="Pages.startAddSV()">Thêm</button>
        <button class="btn svf-btn" ${delAttr} onclick="Pages.deleteSV()">Xóa</button>
        <button ${editAttr} onclick="Pages.startEditSV()">Hiệu chỉnh</button>
        <button ${restoreAttr} onclick="Pages.restoreSV()">${(isAdd || isEdit) ? 'Hủy' : 'Phục hồi'}</button>
        <button ${saveAttr} onclick="Pages.saveSV()">Ghi</button>
    `;

    const html = `
        <div class="svf-wrap">
            <!-- ================= SUBFORM 1: QUẢN LÝ LỚP ================= -->
            <h2 class="svf-title">QUẢN LÝ LỚP HỌC</h2>

            <div class="svf-row">
                <label class="svf-label">Mã lớp</label>
                <input id="lf_malop" maxlength="15" value="${this.escapeHtml(st.lopForm.malop)}" ${disableLopForm || isLopEdit ? 'disabled' : ''}>
            </div>

            <div class="svf-row">
                <label class="svf-label">Tên lớp</label>
                <input id="lf_tenlop" maxlength="50" value="${this.escapeHtml(st.lopForm.tenlop)}" ${disableLopForm ? 'disabled' : ''}>
            </div>

            <div class="svf-row svf-search-row">
                <label class="svf-label">Tìm kiếm lớp</label>
                <div class="svf-search-inline">
                    <input id="lf_search" placeholder="Nhập mã hoặc tên lớp"
                           value="${this.escapeHtml(st.lopSearchKeyword || '')}"
                           onkeyup="if(event.key==='Enter') Pages.searchLop()"
                           oninput="Pages.debounceSearchLop()"
                           ${st.lopMode !== 'view' ? 'disabled' : ''}>
                    <button id="lf_search_btn" class="btn svf-btn" onclick="Pages.searchLop()"
                            ${st.lopMode !== 'view' || !(st.lopSearchKeyword || '').trim() ? 'disabled style="pointer-events: none; opacity: 0.5;"' : ''}>Tìm</button>
                </div>
            </div>

            ${showLopActions ? `<div class="svf-actions">
                ${classButtonsHtml}
            </div>` : ''}

            <div class="svf-status" style="margin-top: 8px; margin-bottom: 8px; color: #666; font-size: 13px;">${classHint}</div>

            <div id="lf_table_wrapper" class="table-wrapper svf-table-wrap" style="max-height: 230px; overflow-y: auto; border: 1px solid #ccc; margin-bottom: 8px;">
                <table>
                    <thead>
                        <tr>
                            <th>Mã lớp</th>
                            <th>Tên lớp</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${lopRowsHtml || '<tr><td colspan="2">Không có dữ liệu</td></tr>'}
                    </tbody>
                </table>
            </div>

            <!-- Khoảng cách chia đôi subform Master-Detail -->
            <div style="height: 1px; background: #cdd9dc; margin: 32px 0;"></div>

            <!-- ================= SUBFORM 2: NHẬP SINH VIÊN ================= -->
            <h2 class="svf-title">QUẢN LÝ SINH VIÊN</h2>

            <div class="svf-row">
                <label class="svf-label">Lớp đang chọn</label>
                <input value="${this.escapeHtml(st.selectedMalop ? `${st.selectedMalop} - ${tenLop}` : 'Chưa chọn lớp')}" disabled style="background: #e9e9e9; font-weight: bold; color: #751414;">
            </div>

            <div class="svf-row">
                <label class="svf-label">Mã sinh viên</label>
                <input id="svf_masv" maxlength="8" value="${this.escapeHtml(st.form.masv)}" ${disableForm || isEditMode ? 'disabled' : ''}>
            </div>

            <div class="svf-grid-2">
                <div class="svf-row small-gap">
                    <label class="svf-label">Họ</label>
                    <input id="svf_ho" maxlength="50" value="${this.escapeHtml(st.form.ho)}" ${disableForm ? 'disabled' : ''}>
                </div>
                <div class="svf-row small-gap">
                    <label class="svf-label">Tên</label>
                    <input id="svf_ten" maxlength="10" value="${this.escapeHtml(st.form.ten)}" ${disableForm ? 'disabled' : ''}>
                </div>
            </div>

            <div class="svf-grid-2">
                <div class="svf-row small-gap">
                    <label class="svf-label">Ngày sinh</label>
                    <input id="svf_ns" type="date" min="1970-01-01" max="2015-12-31" value="${this.escapeHtml(st.form.ngaysinh)}" ${disableForm ? 'disabled' : ''}>
                </div>
                <div class="svf-row small-gap">
                    <label class="svf-label">Địa chỉ</label>
                    <input id="svf_dc" maxlength="100" value="${this.escapeHtml(st.form.diachi)}" ${disableForm ? 'disabled' : ''}>
                </div>
            </div>

            <div class="svf-row">
                <label class="svf-label">Trạng thái</label>
                <select id="svf_trangthai" ${disableForm ? 'disabled' : ''}>
                    <option value="Hoạt động" ${st.form.trangThai === 'Hoạt động' ? 'selected' : ''}>Hoạt động</option>
                    <option value="Khóa" ${st.form.trangThai === 'Khóa' ? 'selected' : ''}>Khóa</option>
                </select>
            </div>

            <div class="svf-row svf-search-row">
                <label class="svf-label">Tìm kiếm sinh viên</label>
                <div class="svf-search-inline">
                    <input id="svf_search" placeholder="Nhập mã/tên sinh viên"
                           value="${this.escapeHtml(st.searchKeyword || '')}"
                           onkeyup="if(event.key==='Enter') Pages.searchSV()"
                           oninput="Pages.debounceSearchSV()"
                           ${st.mode !== 'view' || !st.selectedMalop ? 'disabled' : ''}>
                    <button id="svf_search_btn" class="btn svf-btn" onclick="Pages.searchSV()"
                            ${st.mode !== 'view' || !st.selectedMalop || !(st.searchKeyword || '').trim() ? 'disabled style="pointer-events: none; opacity: 0.5;"' : ''}>Tìm</button>
                </div>
            </div>

            ${showActions ? `<div class="svf-actions">
                ${buttonsHtml}
            </div>` : ''}

            <div style="display: flex; justify-content: space-between; align-items: center; margin: 10px 0 5px 0;">
                <div class="svf-status" style="margin: 0; font-size: 14px; font-weight: 500; color: #666;">${status}</div>
                <label class="svf-checkbox-label" style="display: flex; align-items: center; gap: 6px; cursor: pointer; color: var(--text-color); font-size: 14px; user-select: none;">
                    <input type="checkbox" id="svf_filter_status" onchange="Pages.toggleSVStatusFilter(this.checked)" ${st.showLocked ? 'checked' : ''} ${st.mode !== 'view' || !st.selectedMalop ? 'disabled' : ''} style="width: auto; height: auto; margin: 0; cursor: pointer;">
                    <span>Hiển thị tài khoản Khóa</span>
                </label>
            </div>

            <div id="svf_table_wrapper" class="table-wrapper svf-table-wrap" style="max-height: 230px; overflow-y: auto; border: 1px solid #ccc;">
                <table>
                    <thead>
                        <tr>
                            <th>Mã SV</th>
                            <th>Họ</th>
                            <th>Tên</th>
                            <th>Ngày sinh</th>
                            <th>Địa chỉ</th>
                            <th>Trạng thái</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRowsHtml || '<tr><td colspan="6">Không có dữ liệu</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    UI.showContent(html);

    // Khôi phục vị trí cuộn
    const newLopTableWrapper = document.getElementById('lf_table_wrapper');
    if (newLopTableWrapper) {
        newLopTableWrapper.scrollTop = lopScrollTop;
        setTimeout(() => {
            const el = document.getElementById('lf_table_wrapper');
            if (el) el.scrollTop = lopScrollTop;
        }, 0);
    }

    const newSvTableWrapper = document.getElementById('svf_table_wrapper');
    if (newSvTableWrapper) {
        newSvTableWrapper.scrollTop = svScrollTop;
        setTimeout(() => {
            const el = document.getElementById('svf_table_wrapper');
            if (el) el.scrollTop = svScrollTop;
        }, 0);
    }

    if (contentArea) {
        contentArea.scrollTop = contentScrollTop;
        setTimeout(() => {
            const el = document.getElementById('contentArea');
            if (el) el.scrollTop = contentScrollTop;
        }, 0);
    }

    // Khôi phục trạng thái focus và vị trí con trỏ của ô tìm kiếm lớp
    if (lopHadFocus) {
        const newLopSearchInput = document.getElementById('lf_search');
        if (newLopSearchInput) {
            newLopSearchInput.focus();
            newLopSearchInput.setSelectionRange(lopSelectionStart, lopSelectionEnd);
        }
    }

    // Khôi phục trạng thái focus và vị trí con trỏ của ô tìm kiếm sinh viên
    if (hadFocus) {
        const newSearchInput = document.getElementById('svf_search');
        if (newSearchInput) {
            newSearchInput.focus();
            newSearchInput.setSelectionRange(selectionStart, selectionEnd);
        }
    }
    // Thiết lập xác thực nhập liệu cho Mã lớp (lf_malop)
    const malopInput = document.getElementById('lf_malop');
    if (malopInput) {
        malopInput.addEventListener('input', function (e) {
            const start = this.selectionStart;
            const end = this.selectionEnd;
            const originalVal = this.value;
            const upperVal = originalVal.toUpperCase();
            // Chỉ giữ lại chữ cái và số, không khoảng trắng, không ký tự đặc biệt
            const cleanVal = upperVal.replace(/[^A-Z0-9]/g, '');

            if (cleanVal !== originalVal) {
                this.value = cleanVal;
                const diff = originalVal.length - cleanVal.length;
                this.setSelectionRange(Math.max(0, start - diff), Math.max(0, end - diff));
            }
        });
    }

    // Thiết lập xác thực nhập liệu cho Tên lớp (lf_tenlop)
    const tenlopInput = document.getElementById('lf_tenlop');
    if (tenlopInput) {
        tenlopInput.addEventListener('input', function (e) {
            const start = this.selectionStart;
            const end = this.selectionEnd;
            const originalVal = this.value;
            // Chỉ giữ lại chữ cái (bao gồm tiếng Việt có dấu), chữ số và khoảng trắng
            let cleanVal = originalVal.replace(/[^\p{L}\p{N}\s\-(),.+#]/gu, '');
            // Ngăn chặn dấu cách ở đầu tiên
            cleanVal = cleanVal.replace(/^\s+/g, '');
            // Ngăn chặn nhiều dấu cách liên tiếp (hai dấu cách liên tục trở lên)
            cleanVal = cleanVal.replace(/\s{2,}/g, ' ');

            if (cleanVal !== originalVal) {
                this.value = cleanVal;
                const diff = originalVal.length - cleanVal.length;
                this.setSelectionRange(Math.max(0, start - diff), Math.max(0, end - diff));
            }
        });
    }
    // Thiết lập xác thực nhập liệu cho Mã sinh viên (svf_masv)
    const masvInput = document.getElementById('svf_masv');
    if (masvInput) {
        masvInput.addEventListener('input', function (e) {
            const start = this.selectionStart;
            const end = this.selectionEnd;
            const originalVal = this.value;
            // Chỉ cho phép chữ cái (không dấu) và số, không khoảng trắng
            const cleanVal = originalVal.replace(/[^a-zA-Z0-9]/g, '');

            if (cleanVal !== originalVal) {
                this.value = cleanVal;
                const diff = originalVal.length - cleanVal.length;
                this.setSelectionRange(Math.max(0, start - diff), Math.max(0, end - diff));
            }
        });
    }

    // Thiết lập xác thực nhập liệu cho Họ (svf_ho)
    const hoInput = document.getElementById('svf_ho');
    if (hoInput) {
        hoInput.addEventListener('input', function (e) {
            const start = this.selectionStart;
            const end = this.selectionEnd;
            const originalVal = this.value;
            // Chỉ cho phép chữ cái (tiếng Việt có dấu) và khoảng trắng, không cho phép số/ký tự lạ
            let cleanVal = originalVal.replace(/[^\p{L}\s]/gu, '');
            cleanVal = cleanVal.replace(/^\s+/g, '');
            cleanVal = cleanVal.replace(/\s{2,}/g, ' ');

            if (cleanVal !== originalVal) {
                this.value = cleanVal;
                const diff = originalVal.length - cleanVal.length;
                this.setSelectionRange(Math.max(0, start - diff), Math.max(0, end - diff));
            }
        });
    }

    // Thiết lập xác thực nhập liệu cho Tên (svf_ten)
    const tenInput = document.getElementById('svf_ten');
    if (tenInput) {
        tenInput.addEventListener('input', function (e) {
            const start = this.selectionStart;
            const end = this.selectionEnd;
            const originalVal = this.value;
            // Chỉ cho phép chữ cái (tiếng Việt có dấu) và khoảng trắng, không cho phép số/ký tự lạ
            let cleanVal = originalVal.replace(/[^\p{L}\s]/gu, '');
            cleanVal = cleanVal.replace(/^\s+/g, '');
            cleanVal = cleanVal.replace(/\s{2,}/g, ' ');

            if (cleanVal !== originalVal) {
                this.value = cleanVal;
                const diff = originalVal.length - cleanVal.length;
                this.setSelectionRange(Math.max(0, start - diff), Math.max(0, end - diff));
            }
        });
    }

    // Thiết lập xác thực nhập liệu cho Địa chỉ (svf_dc)
    const dcInput = document.getElementById('svf_dc');
    if (dcInput) {
        dcInput.addEventListener('input', function (e) {
            const start = this.selectionStart;
            const end = this.selectionEnd;
            const originalVal = this.value;

            let result = '';
            let lastWasSpecial = false;
            for (let i = 0; i < originalVal.length; i++) {
                const char = originalVal[i];
                // Ký tự đặc biệt là ký tự không phải chữ, số, và khoảng trắng
                const isSpecial = /[^\p{L}\p{N}\s]/u.test(char);
                if (isSpecial) {
                    if (!lastWasSpecial) {
                        result += char;
                        lastWasSpecial = true;
                    }
                } else {
                    result += char;
                    lastWasSpecial = false;
                }
            }
            // Không cho phép khoảng trắng ở đầu và nhiều khoảng trắng liên tiếp
            result = result.replace(/^\s+/g, '');
            result = result.replace(/\s{2,}/g, ' ');

            if (result !== originalVal) {
                this.value = result;
                const diff = originalVal.length - result.length;
                this.setSelectionRange(Math.max(0, start - diff), Math.max(0, end - diff));
            }
        });
    }
};

Pages.selectLopRow = async function (index) {
    const st = this._sinhvienState;
    if (!st) return;
    if (st.lopMode !== 'view' || st.mode !== 'view') {
        return UI.toast('Vui lòng hoàn thành hoặc hủy thao tác hiện tại trước khi chọn lớp khác!', 'warning');
    }
    if (index < 0 || index >= st.lopRows.length) return;

    // Lưu vị trí cuộn trước khi chạy bất đồng bộ
    const lopTableWrapper = document.getElementById('lf_table_wrapper');
    st._savedLopScrollTop = lopTableWrapper ? lopTableWrapper.scrollTop : 0;

    const svTableWrapper = document.getElementById('svf_table_wrapper');
    st._savedSvScrollTop = svTableWrapper ? svTableWrapper.scrollTop : 0;

    const contentArea = document.getElementById('contentArea');
    st._savedContentScrollTop = contentArea ? contentArea.scrollTop : 0;

    const row = st.lopRows[index];
    st.selectedMalop = row.MALOP;
    st.lopForm = {
        malop: row.MALOP,
        tenlop: row.TENLOP
    };
    st.form.malop = row.MALOP;

    // Reset student selection/form
    st.selectedMasv = '';
    st.form = {
        masv: '',
        ho: '',
        ten: '',
        ngaysinh: '',
        diachi: '',
        malop: row.MALOP,
        trangThai: 'Hoạt động'
    };

    await this.loadSVByCurrentLop();
    this.renderSinhVienForm();
};

Pages.startAddLop = function () {
    const st = this._sinhvienState;
    if (!st || !st.canEdit) return;
    st.lopSnapshot = { ...st.lopForm };
    st.lopMode = 'add';
    st.lopForm = { malop: '', tenlop: '' };
    this.renderSinhVienForm();
};

Pages.startEditLop = function () {
    const st = this._sinhvienState;
    if (!st || !st.canEdit) return;

    if (st.lopMode === 'edit') {
        if (st.lopSnapshot) {
            st.lopForm = { ...st.lopSnapshot };
            st.selectedMalop = st.lopSnapshot.malop || st.selectedMalop;
        }
        st.lopMode = 'view';
        st.lopSnapshot = null;
        this.renderSinhVienForm();
        return;
    }

    const selected = st.lopList.find(r => r.MALOP === st.selectedMalop);
    if (!selected) return UI.toast('Vui lòng chọn lớp để hiệu chỉnh!', 'error');

    st.lopSnapshot = { malop: selected.MALOP, tenlop: selected.TENLOP };
    st.lopMode = 'edit';
    st.lopForm = { ...st.lopSnapshot };
    this.renderSinhVienForm();
};

Pages.restoreLop = async function () {
    const st = this._sinhvienState;
    if (!st || !st.canEdit) return;

    if (st.lopMode === 'add' || st.lopMode === 'edit') {
        if (st.lopSnapshot) {
            st.lopForm = { ...st.lopSnapshot };
            st.selectedMalop = st.lopSnapshot.malop || st.selectedMalop;
        }
        st.lopMode = 'view';
        st.lopSnapshot = null;
        this.renderSinhVienForm();
        return;
    }

    if (await UndoManager.undo('sinhvien')) {
        const ok = await this.refreshLopList();
        if (ok) {
            await this.loadSVByCurrentLop();
            this.renderSinhVienForm();
        }
    }
};

Pages.syncLopFormFromInputs = function () {
    const st = this._sinhvienState;
    if (!st) return;
    st.lopForm = {
        malop: (document.getElementById('lf_malop')?.value || '').trim().toUpperCase(),
        tenlop: (document.getElementById('lf_tenlop')?.value || '').trim()
    };
};

Pages.saveLopInline = async function () {
    const st = this._sinhvienState;
    if (!st || !st.canEdit) return;

    this.syncLopFormFromInputs();
    const malop = st.lopForm.malop;
    const tenlop = st.lopForm.tenlop;

    if (!malop) {
        return UI.toast('Mã lớp không được để trống!', 'error');
    }
    if (!tenlop) {
        return UI.toast('Tên lớp không được để trống!', 'error');
    }
    if (malop.length > 15) {
        return UI.toast('Mã lớp không được vượt quá 15 ký tự!', 'error');
    }
    if (tenlop.length > 50) {
        return UI.toast('Tên lớp không được vượt quá 50 ký tự!', 'error');
    }

    // Kiểm tra trùng lặp tên lớp (case-insensitive)
    const duplicate = st.lopList.find(row =>
        row.TENLOP.toLowerCase() === tenlop.toLowerCase() &&
        (st.lopMode === 'add' || row.MALOP !== (st.lopSnapshot?.malop || st.selectedMalop))
    );
    if (duplicate) {
        return UI.toast(`Tên lớp "${tenlop}" đã tồn tại!`, 'error');
    }

    let res;
    if (st.lopMode === 'add') {
        res = await API.addLop({ malop, tenlop });
        if (!res?.success) return UI.toast(res?.message || 'Lỗi', 'error');
        UndoManager.push({
            tab: 'sinhvien',
            description: `Thêm lớp ${malop}`,
            undoFn: async () => { const r = await API.delLop(malop); if (!r?.success) throw new Error(r?.message || 'Lỗi'); }
        });
    } else if (st.lopMode === 'edit') {
        const targetMalop = st.lopSnapshot?.malop || st.selectedMalop;
        const oldTenlop = st.lopSnapshot?.tenlop || '';
        res = await API.editLop(targetMalop, { tenlop });
        if (!res?.success) return UI.toast(res?.message || 'Lỗi', 'error');
        UndoManager.push({
            tab: 'sinhvien',
            description: `Sửa lớp ${targetMalop}`,
            undoFn: async () => { const r = await API.editLop(targetMalop, { tenlop: oldTenlop }); if (!r?.success) throw new Error(r?.message || 'Lỗi'); }
        });
    } else {
        return UI.toast('Hãy chọn Thêm hoặc Hiệu chỉnh trước khi Ghi!', 'info');
    }

    UI.toast(res.message || 'Ghi thành công!', 'success');
    st.lopMode = 'view';
    st.lopSnapshot = null;
    const ok = await this.refreshLopList(malop);
    if (ok) {
        await this.loadSVByCurrentLop();
        this.renderSinhVienForm();
    }
};

Pages.deleteLopInline = async function () {
    const st = this._sinhvienState;
    if (!st || !st.canEdit) return;

    const targetMalop = st.selectedMalop || st.lopForm.malop;
    if (!targetMalop) return UI.toast('Vui lòng chọn lớp để xóa!', 'error');

    const row = st.lopList.find(r => r.MALOP === targetMalop);
    if (!row) return UI.toast('Không tìm thấy lớp!', 'error');
    if (!UI.confirm('Bạn chắc chắn muốn xóa lớp này?')) return;

    const res = await API.delLop(targetMalop);
    if (res?.success) {
        UndoManager.push({
            tab: 'sinhvien',
            description: `Xóa lớp ${row.MALOP} - ${row.TENLOP}`,
            undoFn: async () => { const r = await API.addLop({ malop: row.MALOP, tenlop: row.TENLOP }); if (!r?.success) throw new Error(r?.message || 'Lỗi'); }
        });
        UI.toast(res.message, 'success');
        const ok = await this.refreshLopList();
        if (ok) {
            await this.loadSVByCurrentLop();
            this.renderSinhVienForm();
        }
    } else {
        UI.toast(res?.message || 'Lỗi', 'error');
    }
};

Pages.debounceSearchLop = function () {
    const st = this._sinhvienState;
    if (!st || st.lopMode !== 'view') return;

    const inputVal = document.getElementById('lf_search')?.value || '';
    const btn = document.getElementById('lf_search_btn');
    if (btn) {
        btn.disabled = !inputVal.trim();
        btn.style.opacity = inputVal.trim() ? '1' : '0.5';
        btn.style.pointerEvents = inputVal.trim() ? 'auto' : 'none';
    }

    if (this._lopSearchTimeout) {
        clearTimeout(this._lopSearchTimeout);
    }

    if (!inputVal.trim()) {
        Pages.searchLop();
    } else {
        this._lopSearchTimeout = setTimeout(() => {
            Pages.searchLop();
        }, 500);
    }
};

Pages.searchLop = function () {
    const st = this._sinhvienState;
    if (!st || st.lopMode !== 'view') return;

    if (Pages._lopSearchTimeout) {
        clearTimeout(Pages._lopSearchTimeout);
        Pages._lopSearchTimeout = null;
    }

    this.applyLopFilters();
    this.loadSVByCurrentLop().then(() => {
        this.renderSinhVienForm();
    });
};

Pages.syncSVFormFromInputs = function () {
    const st = this._sinhvienState;
    if (!st) return;
    st.form = {
        masv: (document.getElementById('svf_masv')?.value || '').trim(),
        ho: (document.getElementById('svf_ho')?.value || '').trim(),
        ten: (document.getElementById('svf_ten')?.value || '').trim(),
        ngaysinh: (document.getElementById('svf_ns')?.value || '').trim(),
        diachi: (document.getElementById('svf_dc')?.value || '').trim(),
        malop: st.selectedMalop,
        trangThai: (document.getElementById('svf_trangthai')?.value || 'Hoạt động').trim()
    };
};

Pages.selectSVRow = function (index) {
    const st = this._sinhvienState;
    if (!st || st.mode !== 'view') return;
    if (index < 0 || index >= st.rows.length) return;
    const row = st.rows[index];
    st.selectedMasv = row.MASV;
    st.form = {
        masv: row.MASV,
        ho: row.HO,
        ten: row.TEN,
        ngaysinh: this.formatDateForInput(row.NGAYSINH),
        diachi: row.DIACHI,
        malop: st.selectedMalop,
        trangThai: row.TRANG_THAI || 'Hoạt động'
    };
    this.renderSinhVienForm();
};

Pages.startAddSV = function () {
    const st = this._sinhvienState;
    if (!st || !st.canEdit) return;
    st.snapshot = { ...st.form };
    st.mode = 'add';
    st.form = {
        masv: '',
        ho: '',
        ten: '',
        ngaysinh: '',
        diachi: '',
        malop: st.selectedMalop,
        trangThai: 'Hoạt động'
    };
    this.renderSinhVienForm();
};

Pages.startEditSV = function () {
    const st = this._sinhvienState;
    if (!st || !st.canEdit) return;

    if (st.mode === 'edit') {
        if (st.snapshot) {
            st.form = { ...st.snapshot };
            st.selectedMasv = st.snapshot.masv || st.selectedMasv;
            st.selectedMalop = st.snapshot.malop || st.selectedMalop;
        }
        st.mode = 'view';
        st.snapshot = null;
        this.renderSinhVienForm();
        return;
    }

    const selected = st.rows.find(r => r.MASV === st.selectedMasv);
    if (!selected) return UI.toast('Vui lòng chọn sinh viên để hiệu chỉnh!', 'error');

    st.snapshot = {
        masv: selected.MASV,
        ho: selected.HO,
        ten: selected.TEN,
        ngaysinh: this.formatDateForInput(selected.NGAYSINH),
        diachi: selected.DIACHI,
        malop: st.selectedMalop,
        trangThai: selected.TRANG_THAI || 'Hoạt động'
    };
    st.mode = 'edit';
    st.form = { ...st.snapshot };
    this.renderSinhVienForm();
};

Pages.restoreSV = async function () {
    const st = this._sinhvienState;
    if (!st || !st.canEdit) return;

    if (st.mode === 'add' || st.mode === 'edit') {
        if (st.snapshot) {
            st.form = { ...st.snapshot };
            st.selectedMasv = st.snapshot.masv || st.selectedMasv;
            st.selectedMalop = st.snapshot.malop || st.selectedMalop;
        }
        st.mode = 'view';
        st.snapshot = null;
        this.renderSinhVienForm();
        return;
    }

    if (await UndoManager.undo('sinhvien')) {
        await this.loadSVByCurrentLop();
        this.renderSinhVienForm();
    }
};

Pages.debounceSearchSV = function () {
    const st = this._sinhvienState;
    if (!st || st.mode !== 'view') return;

    const inputVal = document.getElementById('svf_search')?.value || '';
    const btn = document.getElementById('svf_search_btn');
    if (btn) {
        btn.disabled = !inputVal.trim();
        btn.style.opacity = inputVal.trim() ? '1' : '0.5';
        btn.style.pointerEvents = inputVal.trim() ? 'auto' : 'none';
    }

    if (this._sinhvienSearchTimeout) {
        clearTimeout(this._sinhvienSearchTimeout);
    }

    if (!inputVal.trim()) {
        Pages.searchSV();
    } else {
        this._sinhvienSearchTimeout = setTimeout(() => {
            Pages.searchSV();
        }, 500);
    }
};

Pages.searchSV = function () {
    const st = this._sinhvienState;
    if (!st || st.mode !== 'view') return;

    if (Pages._sinhvienSearchTimeout) {
        clearTimeout(Pages._sinhvienSearchTimeout);
        Pages._sinhvienSearchTimeout = null;
    }

    this.applySVFilters();
    this.renderSinhVienForm();
};

Pages.saveSV = async function () {
    const st = this._sinhvienState;
    if (!st || !st.canEdit) return;

    this.syncSVFormFromInputs();
    const data = {
        masv: st.form.masv,
        ho: st.form.ho,
        ten: st.form.ten,
        ngaysinh: st.form.ngaysinh,
        diachi: st.form.diachi,
        malop: st.form.malop || st.selectedMalop,
        trangThai: st.form.trangThai
    };

    // Kiểm tra tính hợp lệ của trường ngày trước khi kiểm tra rỗng
    // (Bởi vì nếu ngày sinh nhập không hợp lệ như 31/06, trình duyệt sẽ trả về giá trị rỗng và làm mất tính rõ ràng của thông báo lỗi)
    const nsInput = document.getElementById('svf_ns');
    if (nsInput && !nsInput.validity.valid) {
        return UI.toast('Ngày sinh không hợp lệ hoặc không tồn tại (ví dụ: ngày 31 tháng 6)!', 'error');
    }

    if (!data.masv || !data.ho || !data.ten || !data.ngaysinh || !data.malop) {
        return UI.toast('Vui lòng nhập đầy đủ thông tin bắt buộc!', 'error');
    }

    // Kiểm tra độ dài tối đa
    if (data.masv.length > 8) {
        return UI.toast('Mã sinh viên không được vượt quá 8 ký tự!', 'error');
    }
    if (data.ho.length > 50) {
        return UI.toast('Họ không được vượt quá 50 ký tự!', 'error');
    }
    if (data.ten.length > 10) {
        return UI.toast('Tên không được vượt quá 10 ký tự!', 'error');
    }
    if (data.diachi && data.diachi.length > 100) {
        return UI.toast('Địa chỉ không được vượt quá 100 ký tự!', 'error');
    }

    // Kiểm tra tính hợp lệ của ngày sinh (năm sinh trong khoảng 1970 - 2015)
    const nsDate = new Date(data.ngaysinh);
    if (!isNaN(nsDate.getTime())) {
        const year = nsDate.getFullYear();
        if (year < 1970 || year > 2015) {
            return UI.toast('Ngày sinh không hợp lệ! Năm sinh phải nằm trong khoảng từ 1970 đến 2015.', 'error');
        }
    } else {
        return UI.toast('Ngày sinh không đúng định dạng!', 'error');
    }

    let res;
    if (st.mode === 'add') {
        // Kiểm tra trùng lặp mã sinh viên trong toàn bộ cơ sở dữ liệu
        const checkSV = await API.getSVInfo(data.masv);
        if (checkSV && checkSV.success && checkSV.data) {
            const existedSV = checkSV.data;
            const oldTenLop = (existedSV.TENLOP || '').trim();
            return UI.toast(`Mã sinh viên ${data.masv} đã tồn tại ở lớp ${oldTenLop ? ` ${oldTenLop}` : existedSV.MALOP || ''}!`, 'error');
        }
        res = await API.addSinhVien(data);
        if (!res?.success) return UI.toast(res?.message || 'Lỗi', 'error');
        UndoManager.push({
            tab: 'sinhvien',
            description: `Thêm sinh viên ${data.masv}`,
            undoFn: async () => { const r = await API.delSinhVien(data.masv); if (!r?.success) throw new Error(r?.message || 'Lỗi'); }
        });
    } else if (st.mode === 'edit') {
        const targetMasv = st.snapshot?.masv || st.selectedMasv;
        const oldData = { ...st.snapshot };
        res = await API.editSinhVien(targetMasv, {
            ho: data.ho, ten: data.ten, ngaysinh: data.ngaysinh, diachi: data.diachi, malop: data.malop, trangThai: data.trangThai
        });
        if (!res?.success) return UI.toast(res?.message || 'Lỗi', 'error');
        UndoManager.push({
            tab: 'sinhvien',
            description: `Sửa sinh viên ${targetMasv}`,
            undoFn: async () => {
                const r = await API.editSinhVien(targetMasv, { ho: oldData.ho, ten: oldData.ten, ngaysinh: oldData.ngaysinh, diachi: oldData.diachi, malop: oldData.malop, trangThai: oldData.trangThai });
                if (!r?.success) throw new Error(r?.message || 'Lỗi');
            }
        });
    } else {
        return UI.toast('Hãy chọn Thêm hoặc Hiệu chỉnh trước khi Ghi!', 'info');
    }

    UI.toast(res.message || 'Ghi thành công!', 'success');
    st.mode = 'view';
    st.snapshot = null;
    st.selectedMalop = data.malop;
    await this.loadSVByCurrentLop();
    this.renderSinhVienForm();
};

Pages.deleteSV = async function () {
    const st = this._sinhvienState;
    if (!st || !st.canEdit) return;
    const targetMasv = st.selectedMasv || st.form.masv;
    if (!targetMasv) return UI.toast('Vui lòng chọn sinh viên để xóa!', 'error');
    const row = st.allRows.find(r => r.MASV === targetMasv);
    if (!row) return UI.toast('Không tìm thấy sinh viên!', 'error');
    if (!UI.confirm('Xóa sinh viên này?')) return;

    const res = await API.delSinhVien(targetMasv);
    if (!res?.success) return UI.toast(res?.message || 'Lỗi', 'error');

    const isSoftDelete = (res.message || '').includes('trạng thái') || (res.message || '').includes('Khóa');
    if (isSoftDelete) {
        UndoManager.push({
            tab: 'sinhvien',
            description: `Khóa sinh viên ${row.MASV} - ${row.HO} ${row.TEN}`,
            undoFn: async () => {
                const r = await API.editSinhVien(row.MASV, {
                    ho: row.HO,
                    ten: row.TEN,
                    ngaysinh: Pages.formatDateForInput(row.NGAYSINH),
                    diachi: row.DIACHI,
                    malop: row.MALOP || st.selectedMalop,
                    trangThai: 'Hoạt động'
                });
                if (!r?.success) throw new Error(r?.message || 'Lỗi');
            }
        });
    } else {
        UndoManager.push({
            tab: 'sinhvien',
            description: `Xóa sinh viên ${row.MASV} - ${row.HO} ${row.TEN}`,
            undoFn: async () => {
                const r = await API.addSinhVien({ masv: row.MASV, ho: row.HO, ten: row.TEN, ngaysinh: Pages.formatDateForInput(row.NGAYSINH), diachi: row.DIACHI, malop: row.MALOP || st.selectedMalop });
                if (!r?.success) throw new Error(r?.message || 'Lỗi');
            }
        });
    }

    UI.toast(res.message || 'Xóa thành công!', 'success');
    await this.loadSVByCurrentLop();
    this.renderSinhVienForm();
};
