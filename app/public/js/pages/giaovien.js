/**
 * PAGES — Giáo viên
 */

Pages.giaovien = async function () {
    UI.setTitle(window.APP_ROLE === 'PGV' ? 'Quản lý Giảng viên' : 'Tra cứu Giảng viên');
    UI.showLoading();
    const res = await API.getGiaoVien();
    if (!res?.success) return UI.toast(res?.message || 'Lỗi', 'error');

    const rows = (res.data || []).map(row => ({
        MAGV: (row.MAGV || '').trim(),
        HO: (row.HO || '').trim(),
        TEN: (row.TEN || '').trim(),
        SODTLL: (row.SODTLL || '').trim(),
        DIACHI: (row.DIACHI || '').trim(),
        TRANG_THAI: (row.TRANG_THAI || 'Hoạt động').trim()
    }));

    this._giaovienState = {
        allRows: rows,
        rows: [],
        showLocked: false,
        canEdit: window.APP_ROLE === 'PGV',
        selectedMagv: rows[0]?.MAGV || '',
        mode: 'view',
        snapshot: null,
        form: {
            magv: rows[0]?.MAGV || '',
            ho: rows[0]?.HO || '',
            ten: rows[0]?.TEN || '',
            sodtll: rows[0]?.SODTLL || '',
            diachi: rows[0]?.DIACHI || '',
            trangThai: rows[0]?.TRANG_THAI || 'Hoạt động'
        }
    };

    this.applyGVFilters();
    this.renderGiaoVienForm();
};

Pages.applyGVFilters = function () {
    const st = this._giaovienState;
    if (!st) return;

    const showLocked = !!st.showLocked;
    const targetStatus = showLocked ? 'Khóa' : 'Hoạt động';

    const searchInput = document.getElementById('gvf_search');
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
            return row.MAGV.toLowerCase().includes(kw)
                || row.HO.toLowerCase().includes(kw)
                || row.TEN.toLowerCase().includes(kw)
                || fullName.includes(kw)
                || row.SODTLL.toLowerCase().includes(kw)
                || row.DIACHI.toLowerCase().includes(kw);
        });
    }

    st.rows = filtered;

    const exists = st.rows.some(r => r.MAGV === st.selectedMagv);
    if (!exists) {
        st.selectedMagv = st.rows[0]?.MAGV || '';
        const first = st.rows[0];
        st.form = {
            magv: first?.MAGV || '',
            ho: first?.HO || '',
            ten: first?.TEN || '',
            sodtll: first?.SODTLL || '',
            diachi: first?.DIACHI || '',
            trangThai: first?.TRANG_THAI || 'Hoạt động'
        };
    } else {
        const current = st.rows.find(r => r.MAGV === st.selectedMagv);
        st.form = {
            magv: current?.MAGV || '',
            ho: current?.HO || '',
            ten: current?.TEN || '',
            sodtll: current?.SODTLL || '',
            diachi: current?.DIACHI || '',
            trangThai: current?.TRANG_THAI || 'Hoạt động'
        };
    }
};

Pages.toggleGVStatusFilter = function (checked) {
    const st = this._giaovienState;
    if (!st || st.mode !== 'view') return;
    st.showLocked = checked;
    this.applyGVFilters();
    this.renderGiaoVienForm();
};

Pages.renderGiaoVienForm = function () {
    const st = this._giaovienState;
    if (!st) return;

    // Lưu vị trí cuộn của bảng và container chính
    const gvfTableWrapper = document.getElementById('gvf_table_wrapper');
    const gvfScrollTop = (Pages._savedGvfScrollTop !== undefined && Pages._savedGvfScrollTop !== null)
        ? Pages._savedGvfScrollTop
        : (gvfTableWrapper ? gvfTableWrapper.scrollTop : 0);
    delete Pages._savedGvfScrollTop;

    const contentArea = document.getElementById('contentArea');
    const contentScrollTop = (Pages._savedGvfContentScrollTop !== undefined && Pages._savedGvfContentScrollTop !== null)
        ? Pages._savedGvfContentScrollTop
        : (contentArea ? contentArea.scrollTop : 0);
    delete Pages._savedGvfContentScrollTop;

    // Lưu trạng thái focus và vị trí con trỏ của ô tìm kiếm trước khi render lại DOM
    const searchInput = document.getElementById('gvf_search');
    const hadFocus = searchInput && document.activeElement === searchInput;
    const selectionStart = searchInput ? searchInput.selectionStart : 0;
    const selectionEnd = searchInput ? searchInput.selectionEnd : 0;

    const isAddMode = st.mode === 'add';
    const isEditMode = st.mode === 'edit';
    const disableForm = !st.canEdit || (!isAddMode && !isEditMode);
    const rowsHtml = st.rows.map((row, idx) => {
        const selected = row.MAGV === st.selectedMagv ? 'selected' : '';
        const pointerEvents = st.mode !== 'view' ? 'style="pointer-events: none; opacity: 0.6;"' : '';
        return `
            <tr class="${selected}" ${pointerEvents} onclick="Pages.selectGiaoVienRow(${idx})">
                <td>${this.escapeHtml(row.MAGV)}</td>
                <td>${this.escapeHtml(row.HO)}</td>
                <td>${this.escapeHtml(row.TEN)}</td>
                <td>${this.escapeHtml(row.SODTLL)}</td>
                <td>${this.escapeHtml(row.DIACHI)}</td>
                <td>${this.escapeHtml(row.TRANG_THAI)}</td>
            </tr>
        `;
    }).join('');

    const actionHint = isAddMode ? 'Đang thêm mới' : (isEditMode ? 'Đang hiệu chỉnh' : 'Chế độ xem');
    const showActions = st.canEdit;

    const isAdd = st.mode === 'add';
    const isEdit = st.mode === 'edit';
    const isView = st.mode === 'view';

    const addAttr = isAdd ? 'class="btn gvf-btn active" disabled style="pointer-events: none;"' : (isEdit ? 'class="btn gvf-btn" disabled style="pointer-events: none; opacity: 0.5;"' : 'class="btn gvf-btn"');
    const delAttr = (isAdd || isEdit) ? 'disabled style="pointer-events: none; opacity: 0.5;"' : '';
    const editAttr = isEdit ? 'class="btn gvf-btn active" disabled style="pointer-events: none;"' : (isAdd ? 'class="btn gvf-btn" disabled style="pointer-events: none; opacity: 0.5;"' : 'class="btn gvf-btn"');
    const restoreAttr = (isAdd || isEdit) ? 'class="btn gvf-btn"' : (UndoManager.canUndo('giaovien') ? 'class="btn gvf-btn"' : 'class="btn gvf-btn" disabled style="pointer-events: none; opacity: 0.5;"');
    const saveAttr = isView ? 'class="btn gvf-btn" disabled style="pointer-events: none; opacity: 0.5;"' : 'class="btn gvf-btn"';

    const buttonsHtml = `
        <button ${addAttr} onclick="Pages.startAddGV()">Thêm</button>
        <button class="btn gvf-btn" ${delAttr} onclick="Pages.deleteGV()">Xóa</button>
        <button ${editAttr} onclick="Pages.startEditGV()">Hiệu chỉnh</button>
        <button ${restoreAttr} onclick="Pages.restoreGV()">${(isAdd || isEdit) ? 'Hủy' : 'Phục hồi'}</button>
        <button ${saveAttr} onclick="Pages.saveGV()">Ghi</button>
    `;

    const html = `
        <div class="gvf-wrap">
            <h2 class="gvf-title">QUẢN LÝ GIẢNG VIÊN</h2>

            <div class="gvf-grid-2">
                <div class="gvf-row small-gap">
                    <label class="gvf-label">Mã giảng viên</label>
                    <input id="gvf_magv" maxlength="8" value="${this.escapeHtml(st.form.magv)}" ${disableForm || isEditMode ? 'disabled' : ''}>
                </div>
                <div class="gvf-row small-gap">
                    <label class="gvf-label">Số điện thoại</label>
                    <input id="gvf_sdt" maxlength="15" value="${this.escapeHtml(st.form.sodtll)}" ${disableForm ? 'disabled' : ''}>
                </div>
            </div>

            <div class="gvf-grid-2">
                <div class="gvf-row small-gap">
                    <label class="gvf-label">Họ</label>
                    <input id="gvf_ho" maxlength="50" value="${this.escapeHtml(st.form.ho)}" ${disableForm ? 'disabled' : ''}>
                </div>
                <div class="gvf-row small-gap">
                    <label class="gvf-label">Tên</label>
                    <input id="gvf_ten" maxlength="10" value="${this.escapeHtml(st.form.ten)}" ${disableForm ? 'disabled' : ''}>
                </div>
            </div>

            <div class="gvf-row">
                <label class="gvf-label">Địa chỉ</label>
                <input id="gvf_dc" maxlength="50" value="${this.escapeHtml(st.form.diachi)}" ${disableForm ? 'disabled' : ''}>
            </div>

            <div class="gvf-row">
                <label class="gvf-label">Trạng thái</label>
                <select id="gvf_trangthai" ${disableForm ? 'disabled' : ''}>
                    <option value="Hoạt động" ${st.form.trangThai === 'Hoạt động' ? 'selected' : ''}>Hoạt động</option>
                    <option value="Khóa" ${st.form.trangThai === 'Khóa' ? 'selected' : ''}>Khóa</option>
                </select>
            </div>

            <div class="gvf-row gvf-search-row">
                <label class="gvf-label">Tìm kiếm</label>
                <div class="gvf-search-inline">
                    <input id="gvf_search" placeholder="Nhập mã hoặc tên giảng viên"
                           value="${this.escapeHtml(st.searchKeyword || '')}"
                           onkeyup="if(event.key==='Enter') Pages.searchGV()"
                           oninput="Pages.debounceSearchGV()"
                           ${st.mode !== 'view' ? 'disabled' : ''}>
                    <button id="gvf_search_btn" class="btn gvf-btn" onclick="Pages.searchGV()"
                            ${st.mode !== 'view' || !(st.searchKeyword || '').trim() ? 'disabled style="pointer-events: none; opacity: 0.5;"' : ''}>Tìm</button>
                </div>
            </div>

            ${showActions ? `<div class="gvf-actions">
                ${buttonsHtml}
            </div>` : ''}

            <div style="display: flex; justify-content: space-between; align-items: center; margin: 10px 0 5px 0;">
                <div class="gvf-status" style="margin: 0; font-size: 14px; font-weight: 500; color: #666;">${actionHint}</div>
                <label class="gvf-checkbox-label" style="display: flex; align-items: center; gap: 6px; cursor: pointer; color: var(--text-color); font-size: 14px; user-select: none;">
                    <input type="checkbox" id="gvf_filter_status" onchange="Pages.toggleGVStatusFilter(this.checked)" ${st.showLocked ? 'checked' : ''} ${st.mode !== 'view' ? 'disabled' : ''} style="width: auto; height: auto; margin: 0; cursor: pointer;">
                    <span>Hiển thị tài khoản Khóa</span>
                </label>
            </div>

            <div id="gvf_table_wrapper" class="table-wrapper gvf-table-wrap" style="max-height: 230px; overflow-y: auto; border: 1px solid #ccc;">
                <table>
                    <thead>
                        <tr>
                            <th>Mã GV</th>
                            <th>Họ</th>
                            <th>Tên</th>
                            <th>Số ĐT</th>
                            <th>Địa chỉ</th>
                            <th>Trạng thái</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml || '<tr><td colspan="6">Không có dữ liệu</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    UI.showContent(html);

    // Khôi phục vị trí cuộn
    const newGvfTableWrapper = document.getElementById('gvf_table_wrapper');
    if (newGvfTableWrapper) {
        newGvfTableWrapper.scrollTop = gvfScrollTop;
        setTimeout(() => {
            const el = document.getElementById('gvf_table_wrapper');
            if (el) el.scrollTop = gvfScrollTop;
        }, 0);
    }

    if (contentArea) {
        contentArea.scrollTop = contentScrollTop;
        setTimeout(() => {
            const el = document.getElementById('contentArea');
            if (el) el.scrollTop = contentScrollTop;
        }, 0);
    }

    // Khôi phục trạng thái focus và vị trí con trỏ của ô tìm kiếm sau khi render lại DOM
    if (hadFocus) {
        const newSearchInput = document.getElementById('gvf_search');
        if (newSearchInput) {
            newSearchInput.focus();
            newSearchInput.setSelectionRange(selectionStart, selectionEnd);
        }
    }
    // Thiết lập xác thực nhập liệu cho Mã giảng viên (gvf_magv)
    const magvInput = document.getElementById('gvf_magv');
    if (magvInput) {
        magvInput.addEventListener('input', function(e) {
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

    // Thiết lập xác thực nhập liệu cho Số điện thoại (gvf_sdt)
    const sdtInput = document.getElementById('gvf_sdt');
    if (sdtInput) {
        sdtInput.addEventListener('input', function(e) {
            const start = this.selectionStart;
            const end = this.selectionEnd;
            const originalVal = this.value;
            // Chỉ cho phép số, không có chữ cái, dấu cách hay ký tự lạ
            const cleanVal = originalVal.replace(/[^0-9]/g, '');
            
            if (cleanVal !== originalVal) {
                this.value = cleanVal;
                const diff = originalVal.length - cleanVal.length;
                this.setSelectionRange(Math.max(0, start - diff), Math.max(0, end - diff));
            }
        });
    }

    // Thiết lập xác thực nhập liệu cho Họ (gvf_ho)
    const hoInput = document.getElementById('gvf_ho');
    if (hoInput) {
        hoInput.addEventListener('input', function(e) {
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

    // Thiết lập xác thực nhập liệu cho Tên (gvf_ten)
    const tenInput = document.getElementById('gvf_ten');
    if (tenInput) {
        tenInput.addEventListener('input', function(e) {
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

    // Thiết lập xác thực nhập liệu cho Địa chỉ (gvf_dc)
    const dcInput = document.getElementById('gvf_dc');
    if (dcInput) {
        dcInput.addEventListener('input', function(e) {
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

Pages.syncGVFormFromInputs = function () {
    const st = this._giaovienState;
    if (!st) return;

    st.form = {
        magv: (document.getElementById('gvf_magv')?.value || '').trim(),
        ho: (document.getElementById('gvf_ho')?.value || '').trim(),
        ten: (document.getElementById('gvf_ten')?.value || '').trim(),
        sodtll: (document.getElementById('gvf_sdt')?.value || '').trim(),
        diachi: (document.getElementById('gvf_dc')?.value || '').trim(),
        trangThai: (document.getElementById('gvf_trangthai')?.value || 'Hoạt động').trim()
    };
};

Pages.selectGiaoVienRow = function (index) {
    const st = this._giaovienState;
    if (!st || st.mode !== 'view') return;
    if (index < 0 || index >= st.rows.length) return;

    const row = st.rows[index];
    st.selectedMagv = row.MAGV;
    st.form = {
        magv: row.MAGV,
        ho: row.HO,
        ten: row.TEN,
        sodtll: row.SODTLL,
        diachi: row.DIACHI,
        trangThai: row.TRANG_THAI || 'Hoạt động'
    };
    this.renderGiaoVienForm();
};

Pages.startAddGV = function () {
    const st = this._giaovienState;
    if (!st || !st.canEdit) return;
    st.snapshot = { ...st.form };
    st.mode = 'add';
    st.form = { magv: '', ho: '', ten: '', sodtll: '', diachi: '', trangThai: 'Hoạt động' };
    this.renderGiaoVienForm();
};

Pages.startEditGV = function () {
    const st = this._giaovienState;
    if (!st || !st.canEdit) return;

    // Bấm hiệu chỉnh lần nữa khi đang sửa để hủy/quay lại chế độ xem
    if (st.mode === 'edit') {
        if (st.snapshot) {
            st.form = { ...st.snapshot };
            st.selectedMagv = st.snapshot.magv || st.selectedMagv;
        }
        st.mode = 'view';
        st.snapshot = null;
        this.renderGiaoVienForm();
        return;
    }

    const selected = st.rows.find(r => r.MAGV === st.selectedMagv);
    if (!selected) return UI.toast('Vui lòng chọn giảng viên để hiệu chỉnh!', 'error');

    st.snapshot = {
        magv: selected.MAGV,
        ho: selected.HO,
        ten: selected.TEN,
        sodtll: selected.SODTLL,
        diachi: selected.DIACHI,
        trangThai: selected.TRANG_THAI || 'Hoạt động'
    };
    st.mode = 'edit';
    st.form = { ...st.snapshot };
    this.renderGiaoVienForm();
};

Pages.restoreGV = async function () {
    const st = this._giaovienState;
    if (!st || !st.canEdit) return;

    if (st.mode === 'add' || st.mode === 'edit') {
        if (st.snapshot) {
            st.form = { ...st.snapshot };
            st.selectedMagv = st.snapshot.magv || st.selectedMagv;
        }
        st.mode = 'view';
        st.snapshot = null;
        this.renderGiaoVienForm();
        return;
    }

    if (await UndoManager.undo('giaovien')) {
        const gvfTableWrapper = document.getElementById('gvf_table_wrapper');
        Pages._savedGvfScrollTop = gvfTableWrapper ? gvfTableWrapper.scrollTop : 0;
        const contentArea = document.getElementById('contentArea');
        Pages._savedGvfContentScrollTop = contentArea ? contentArea.scrollTop : 0;
        await this.giaovien();
    }
};

Pages.debounceSearchGV = function () {
    const st = this._giaovienState;
    if (!st || st.mode !== 'view') return;

    const inputVal = document.getElementById('gvf_search')?.value || '';
    const btn = document.getElementById('gvf_search_btn');
    if (btn) {
        btn.disabled = !inputVal.trim();
        btn.style.opacity = inputVal.trim() ? '1' : '0.5';
        btn.style.pointerEvents = inputVal.trim() ? 'auto' : 'none';
    }

    if (this._giaovienSearchTimeout) {
        clearTimeout(this._giaovienSearchTimeout);
    }

    if (!inputVal.trim()) {
        Pages.searchGV();
    } else {
        this._giaovienSearchTimeout = setTimeout(() => {
            Pages.searchGV();
        }, 500);
    }
};

Pages.searchGV = function () {
    const st = this._giaovienState;
    if (!st || st.mode !== 'view') return;

    if (Pages._giaovienSearchTimeout) {
        clearTimeout(Pages._giaovienSearchTimeout);
        Pages._giaovienSearchTimeout = null;
    }

    this.applyGVFilters();
    this.renderGiaoVienForm();
};

Pages.saveGV = async function () {
    const st = this._giaovienState;
    if (!st || !st.canEdit) return;

    this.syncGVFormFromInputs();
    const data = {
        magv: st.form.magv,
        ho: st.form.ho,
        ten: st.form.ten,
        sodtll: st.form.sodtll,
        diachi: st.form.diachi,
        trangThai: st.form.trangThai
    };

    if (!data.magv) {
        return UI.toast('Mã giảng viên không được để trống!', 'error');
    }
    if (!data.ho) {
        return UI.toast('Họ không được để trống!', 'error');
    }
    if (!data.ten) {
        return UI.toast('Tên không được để trống!', 'error');
    }

    // Kiểm tra độ dài tối đa
    if (data.magv.length > 8) {
        return UI.toast('Mã giảng viên không được vượt quá 8 ký tự!', 'error');
    }
    if (data.ho.length > 50) {
        return UI.toast('Họ không được vượt quá 50 ký tự!', 'error');
    }
    if (data.ten.length > 10) {
        return UI.toast('Tên không được vượt quá 10 ký tự!', 'error');
    }
    if (data.sodtll && data.sodtll.length > 15) {
        return UI.toast('Số điện thoại liên lạc không được vượt quá 15 ký tự!', 'error');
    }
    if (data.diachi && data.diachi.length > 50) {
        return UI.toast('Địa chỉ không được vượt quá 50 ký tự!', 'error');
    }

    if (st.mode === 'add') {
        const duplicate = st.allRows.find(row => row.MAGV.toLowerCase() === data.magv.toLowerCase());
        if (duplicate) {
            return UI.toast(`Mã giảng viên "${data.magv}" đã tồn tại!`, 'error');
        }
    }

    let res;
    if (st.mode === 'add') {
        res = await API.addGiaoVien(data);
        if (!res?.success) return UI.toast(res?.message || 'Lỗi', 'error');
        UndoManager.push({
            tab: 'giaovien',
            description: `Thêm giảng viên ${data.magv}`,
            undoFn: async () => { const r = await API.delGiaoVien(data.magv); if (!r?.success) throw new Error(r?.message || 'Lỗi'); }
        });
    } else if (st.mode === 'edit') {
        const targetMagv = st.snapshot?.magv || st.selectedMagv;
        const oldData = { ...st.snapshot };
        res = await API.editGiaoVien(targetMagv, { ho: data.ho, ten: data.ten, sodtll: data.sodtll, diachi: data.diachi, trangThai: data.trangThai });
        if (!res?.success) return UI.toast(res?.message || 'Lỗi', 'error');
        UndoManager.push({
            tab: 'giaovien',
            description: `Sửa giảng viên ${targetMagv}`,
            undoFn: async () => {
                const r = await API.editGiaoVien(targetMagv, { ho: oldData.ho, ten: oldData.ten, sodtll: oldData.sodtll, diachi: oldData.diachi, trangThai: oldData.trangThai });
                if (!r?.success) throw new Error(r?.message || 'Lỗi');
            }
        });
    } else {
        return UI.toast('Hãy chọn Thêm hoặc Hiệu chỉnh trước khi Ghi!', 'info');
    }

    UI.toast(res.message || 'Ghi thành công!', 'success');
    const gvfTableWrapper = document.getElementById('gvf_table_wrapper');
    Pages._savedGvfScrollTop = gvfTableWrapper ? gvfTableWrapper.scrollTop : 0;
    const contentArea = document.getElementById('contentArea');
    Pages._savedGvfContentScrollTop = contentArea ? contentArea.scrollTop : 0;
    await this.giaovien();
};

Pages.deleteGV = async function () {
    const st = this._giaovienState;
    if (!st || !st.canEdit) return;

    const targetMagv = st.selectedMagv || st.form.magv;
    if (!targetMagv) return UI.toast('Vui lòng chọn giảng viên để xóa!', 'error');
    const row = st.allRows.find(r => r.MAGV === targetMagv);
    if (!row) return UI.toast('Không tìm thấy giảng viên!', 'error');
    if (!UI.confirm('Xóa giảng viên này?')) return;

    const res = await API.delGiaoVien(targetMagv);
    if (res?.success) {
        const isSoftDelete = (res.message || '').includes('trạng thái') || (res.message || '').includes('Khóa');
        if (isSoftDelete) {
            UndoManager.push({
                tab: 'giaovien',
                description: `Khóa giảng viên ${row.MAGV} - ${row.HO} ${row.TEN}`,
                undoFn: async () => {
                    const r = await API.editGiaoVien(row.MAGV, {
                        ho: row.HO,
                        ten: row.TEN,
                        sodtll: row.SODTLL,
                        diachi: row.DIACHI,
                        trangThai: 'Hoạt động'
                    });
                    if (!r?.success) throw new Error(r?.message || 'Lỗi');
                }
            });
        } else {
            await API.xoaTaiKhoan(targetMagv);
            UndoManager.push({
                tab: 'giaovien',
                description: `Xóa giảng viên ${row.MAGV} - ${row.HO} ${row.TEN}`,
                undoFn: async () => {
                    const r = await API.addGiaoVien({ magv: row.MAGV, ho: row.HO, ten: row.TEN, sodtll: row.SODTLL, diachi: row.DIACHI });
                    if (!r?.success) throw new Error(r?.message || 'Lỗi');
                }
            });
        }
        UI.toast(res.message || 'Xóa giảng viên thành công!', 'success');
        const gvfTableWrapper = document.getElementById('gvf_table_wrapper');
        Pages._savedGvfScrollTop = gvfTableWrapper ? gvfTableWrapper.scrollTop : 0;
        const contentArea = document.getElementById('contentArea');
        Pages._savedGvfContentScrollTop = contentArea ? contentArea.scrollTop : 0;
        await this.giaovien();
    } else {
        UI.toast(res?.message || 'Lỗi', 'error');
    }
};
