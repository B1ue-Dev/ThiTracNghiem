/**
 * PAGES — Môn học
 */

Pages.monhoc = async function () {
    UI.setTitle(window.APP_ROLE === 'PGV' ? 'Quản lý Môn học' : 'Tra cứu Môn học');
    UI.showLoading();
    const res = await API.getMonHoc();
    if (!res?.success) return UI.toast(res?.message || 'Lỗi', 'error');

    const rows = (res.data || []).map(row => ({
        MAMH: (row.MAMH || '').trim(),
        TENMH: (row.TENMH || '').trim()
    }));

    this._monhocState = {
        allRows: rows,
        rows,
        canEdit: window.APP_ROLE === 'PGV',
        selectedMamh: rows[0]?.MAMH || '',
        mode: 'view',
        snapshot: null,
        form: {
            mamh: rows[0]?.MAMH || '',
            tenmh: rows[0]?.TENMH || ''
        }
    };

    this.renderMonHocForm();
};

Pages.renderMonHocForm = function () {
    const st = this._monhocState;
    if (!st) return;

    // Lưu vị trí cuộn của bảng và container chính
    const mhfTableWrapper = document.getElementById('mhf_table_wrapper');
    const mhfScrollTop = (Pages._savedMhfScrollTop !== undefined && Pages._savedMhfScrollTop !== null)
        ? Pages._savedMhfScrollTop
        : (mhfTableWrapper ? mhfTableWrapper.scrollTop : 0);
    delete Pages._savedMhfScrollTop;

    const contentArea = document.getElementById('contentArea');
    const contentScrollTop = (Pages._savedMhfContentScrollTop !== undefined && Pages._savedMhfContentScrollTop !== null)
        ? Pages._savedMhfContentScrollTop
        : (contentArea ? contentArea.scrollTop : 0);
    delete Pages._savedMhfContentScrollTop;

    // Lưu trạng thái focus và vị trí con trỏ của ô tìm kiếm trước khi render lại DOM
    const searchInput = document.getElementById('mhf_search');
    const hadFocus = searchInput && document.activeElement === searchInput;
    const selectionStart = searchInput ? searchInput.selectionStart : 0;
    const selectionEnd = searchInput ? searchInput.selectionEnd : 0;

    const isAddMode = st.mode === 'add';
    const isEditMode = st.mode === 'edit';
    const disableForm = !st.canEdit || (!isAddMode && !isEditMode);
    const rowsHtml = st.rows.map((row, idx) => {
        const selected = row.MAMH === st.selectedMamh ? 'selected' : '';
        const pointerEvents = st.mode !== 'view' ? 'style="pointer-events: none; opacity: 0.6;"' : '';
        return `
            <tr class="${selected}" ${pointerEvents} onclick="Pages.selectMonHocRow(${idx})">
                <td>${this.escapeHtml(row.MAMH)}</td>
                <td>${this.escapeHtml(row.TENMH)}</td>
            </tr>
        `;
    }).join('');

    const actionHint = isAddMode ? 'Đang thêm mới' : (isEditMode ? 'Đang hiệu chỉnh' : 'Chế độ xem');
    const showActions = st.canEdit;

    const isAdd = st.mode === 'add';
    const isEdit = st.mode === 'edit';
    const isView = st.mode === 'view';

    const addAttr = isAdd ? 'class="btn mhf-btn active" disabled style="pointer-events: none;"' : (isEdit ? 'class="btn mhf-btn" disabled style="pointer-events: none; opacity: 0.5;"' : 'class="btn mhf-btn"');
    const delAttr = (isAdd || isEdit) ? 'disabled style="pointer-events: none; opacity: 0.5;"' : '';
    const editAttr = isEdit ? 'class="btn mhf-btn active" disabled style="pointer-events: none;"' : (isAdd ? 'class="btn mhf-btn" disabled style="pointer-events: none; opacity: 0.5;"' : 'class="btn mhf-btn"');
    const restoreAttr = (isAdd || isEdit) ? 'class="btn mhf-btn"' : (UndoManager.canUndo('monhoc') ? 'class="btn mhf-btn"' : 'class="btn mhf-btn" disabled style="pointer-events: none; opacity: 0.5;"');
    const saveAttr = isView ? 'class="btn mhf-btn" disabled style="pointer-events: none; opacity: 0.5;"' : 'class="btn mhf-btn"';

    const buttonsHtml = `
        <button ${addAttr} onclick="Pages.startAddMonHoc()">Thêm</button>
        <button class="btn mhf-btn" ${delAttr} onclick="Pages.deleteMonHoc()">Xóa</button>
        <button ${editAttr} onclick="Pages.startEditMonHoc()">Hiệu chỉnh</button>
        <button ${restoreAttr} onclick="Pages.restoreMonHoc()">${(isAdd || isEdit) ? 'Hủy' : 'Phục hồi'}</button>
        <button ${saveAttr} onclick="Pages.saveMonHoc()">Ghi</button>
    `;

    const html = `
        <div class="mhf-wrap">
            <h2 class="mhf-title">QUẢN LÝ MÔN HỌC</h2>

            <div class="mhf-row">
                <label class="mhf-label">Mã môn học</label>
                <input id="mhf_mamh" maxlength="5" value="${this.escapeHtml(st.form.mamh)}" ${disableForm || isEditMode ? 'disabled' : ''}>
            </div>

            <div class="mhf-row">
                <label class="mhf-label">Tên môn học</label>
                <input id="mhf_tenmh" maxlength="50" value="${this.escapeHtml(st.form.tenmh)}" ${disableForm ? 'disabled' : ''}>
            </div>

            <div class="mhf-row mhf-search-row">
                <label class="mhf-label">Tìm kiếm</label>
                <div class="mhf-search-inline">
                    <input id="mhf_search" placeholder="Nhập mã hoặc tên môn học"
                           value="${this.escapeHtml(st.searchKeyword || '')}"
                           onkeyup="if(event.key==='Enter') Pages.searchMonHoc()"
                           oninput="Pages.debounceSearchMonHoc()"
                           ${st.mode !== 'view' ? 'disabled' : ''}>
                    <button id="mhf_search_btn" class="btn mhf-btn" onclick="Pages.searchMonHoc()"
                            ${st.mode !== 'view' || !(st.searchKeyword || '').trim() ? 'disabled style="pointer-events: none; opacity: 0.5;"' : ''}>Tìm</button>
                </div>
            </div>

            ${showActions ? `<div class="mhf-actions">
                ${buttonsHtml}
            </div>` : ''}

            ${showActions ? `<div class="mhf-status">${actionHint}</div>` : ''}

            <div id="mhf_table_wrapper" class="table-wrapper mhf-table-wrap" style="max-height: 230px; overflow-y: auto; border: 1px solid #ccc;">
                <table>
                    <thead>
                        <tr>
                            <th>Mã môn học</th>
                            <th>Tên môn học</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml || '<tr><td colspan="2">Không có dữ liệu</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    UI.showContent(html);

    // Khôi phục vị trí cuộn
    const newMhfTableWrapper = document.getElementById('mhf_table_wrapper');
    if (newMhfTableWrapper) {
        newMhfTableWrapper.scrollTop = mhfScrollTop;
        setTimeout(() => {
            const el = document.getElementById('mhf_table_wrapper');
            if (el) el.scrollTop = mhfScrollTop;
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
        const newSearchInput = document.getElementById('mhf_search');
        if (newSearchInput) {
            newSearchInput.focus();
            newSearchInput.setSelectionRange(selectionStart, selectionEnd);
        }
    }
    // Thiết lập xác thực nhập liệu cho Mã môn học (mhf_mamh)
    const mamhInput = document.getElementById('mhf_mamh');
    if (mamhInput) {
        mamhInput.addEventListener('input', function (e) {
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

    // Thiết lập xác thực nhập liệu cho Tên môn học (mhf_tenmh)
    const tenmhInput = document.getElementById('mhf_tenmh');
    if (tenmhInput) {
        tenmhInput.addEventListener('input', function (e) {
            const start = this.selectionStart;
            const end = this.selectionEnd;
            const originalVal = this.value;
            // Chỉ giữ lại chữ cái (bao gồm tiếng Việt có dấu), chữ số, khoảng trắng, gạch ngang, ngoặc đơn, phẩy, chấm, cộng, và thăng
            let cleanVal = originalVal.replace(/[^\p{L}\p{N}\s\-(),.+#]/gu, '');
            // Ngăn chặn dấu cách ở đầu tiên
            cleanVal = cleanVal.replace(/^\s+/g, '');
            // Ngăn chặn nhiều dấu cách liên tiếp
            cleanVal = cleanVal.replace(/\s{2,}/g, ' ');

            if (cleanVal !== originalVal) {
                this.value = cleanVal;
                const diff = originalVal.length - cleanVal.length;
                this.setSelectionRange(Math.max(0, start - diff), Math.max(0, end - diff));
            }
        });
    }
};

Pages.syncMonHocFormFromInputs = function () {
    const st = this._monhocState;
    if (!st) return;
    const mamhInput = document.getElementById('mhf_mamh');
    const tenmhInput = document.getElementById('mhf_tenmh');
    st.form = {
        mamh: mamhInput ? mamhInput.value.trim().toUpperCase() : '',
        tenmh: tenmhInput ? tenmhInput.value.trim() : ''
    };
};

Pages.selectMonHocRow = function (index) {
    const st = this._monhocState;
    if (!st || st.mode !== 'view') return;
    if (index < 0 || index >= st.rows.length) return;

    const row = st.rows[index];
    st.selectedMamh = row.MAMH;
    st.form = { mamh: row.MAMH, tenmh: row.TENMH };
    this.renderMonHocForm();
};

Pages.startAddMonHoc = function () {
    const st = this._monhocState;
    if (!st || !st.canEdit) return;
    st.snapshot = { ...st.form };
    st.mode = 'add';
    st.form = { mamh: '', tenmh: '' };
    this.renderMonHocForm();
};

Pages.startEditMonHoc = function () {
    const st = this._monhocState;
    if (!st || !st.canEdit) return;

    // Bấm hiệu chỉnh lần nữa khi đang sửa để hủy/quay lại chế độ xem
    if (st.mode === 'edit') {
        if (st.snapshot) {
            st.form = { ...st.snapshot };
            st.selectedMamh = st.snapshot.mamh || st.selectedMamh;
        }
        st.mode = 'view';
        st.snapshot = null;
        this.renderMonHocForm();
        return;
    }

    const selected = st.rows.find(r => r.MAMH === st.selectedMamh);
    if (!selected) return UI.toast('Vui lòng chọn môn học để hiệu chỉnh!', 'error');

    st.snapshot = { mamh: selected.MAMH, tenmh: selected.TENMH };
    st.mode = 'edit';
    st.form = { ...st.snapshot };
    this.renderMonHocForm();
};

Pages.restoreMonHoc = async function () {
    const st = this._monhocState;
    if (!st || !st.canEdit) return;

    // Nếu đang thêm/sửa form → hủy form
    if (st.mode === 'add' || st.mode === 'edit') {
        if (st.snapshot) {
            st.form = { ...st.snapshot };
            st.selectedMamh = st.snapshot.mamh || st.selectedMamh;
        }
        st.mode = 'view';
        st.snapshot = null;
        this.renderMonHocForm();
        return;
    }

    // Nếu đang view → undo thao tác DB gần nhất
    if (await UndoManager.undo('monhoc')) {
        const mhfTableWrapper = document.getElementById('mhf_table_wrapper');
        Pages._savedMhfScrollTop = mhfTableWrapper ? mhfTableWrapper.scrollTop : 0;
        const contentArea = document.getElementById('contentArea');
        Pages._savedMhfContentScrollTop = contentArea ? contentArea.scrollTop : 0;
        await this.monhoc();
    }
};

Pages.debounceSearchMonHoc = function () {
    const st = this._monhocState;
    if (!st || st.mode !== 'view') return;

    const inputVal = document.getElementById('mhf_search')?.value || '';
    const btn = document.getElementById('mhf_search_btn');
    if (btn) {
        btn.disabled = !inputVal.trim();
        btn.style.opacity = inputVal.trim() ? '1' : '0.5';
        btn.style.pointerEvents = inputVal.trim() ? 'auto' : 'none';
    }

    if (this._monhocSearchTimeout) {
        clearTimeout(this._monhocSearchTimeout);
    }

    if (!inputVal.trim()) {
        Pages.searchMonHoc();
    } else {
        this._monhocSearchTimeout = setTimeout(() => {
            Pages.searchMonHoc();
        }, 500);
    }
};

Pages.searchMonHoc = function () {
    const st = this._monhocState;
    if (!st || st.mode !== 'view') return;

    if (Pages._monhocSearchTimeout) {
        clearTimeout(Pages._monhocSearchTimeout);
        Pages._monhocSearchTimeout = null;
    }

    const kwRaw = document.getElementById('mhf_search')?.value || '';
    st.searchKeyword = kwRaw.trim();
    const kw = st.searchKeyword.toLowerCase();
    if (!kw) {
        st.rows = [...st.allRows];
    } else {
        st.rows = st.allRows.filter(row =>
            row.MAMH.toLowerCase().includes(kw) ||
            row.TENMH.toLowerCase().includes(kw)
        );
    }

    const exists = st.rows.some(r => r.MAMH === st.selectedMamh);
    if (!exists) {
        st.selectedMamh = st.rows[0]?.MAMH || '';
        st.form = {
            mamh: st.rows[0]?.MAMH || '',
            tenmh: st.rows[0]?.TENMH || ''
        };
    }

    this.renderMonHocForm();
};

Pages.saveMonHoc = async function () {
    const st = this._monhocState;
    if (!st || !st.canEdit) return;

    this.syncMonHocFormFromInputs();
    const mamh = st.form.mamh;
    const tenmh = st.form.tenmh;

    if (!mamh) {
        return UI.toast('Mã môn học không được để trống!', 'error');
    }
    if (!tenmh) {
        return UI.toast('Tên môn học không được để trống!', 'error');
    }
    if (mamh.length > 5) {
        return UI.toast('Mã môn học không được vượt quá 5 ký tự!', 'error');
    }
    if (tenmh.length > 50) {
        return UI.toast('Tên môn học không được vượt quá 50 ký tự!', 'error');
    }

    // Kiểm tra trùng lặp tên môn học (case-insensitive)
    const duplicate = st.allRows.find(row =>
        row.TENMH.toLowerCase() === tenmh.toLowerCase() &&
        (st.mode === 'add' || row.MAMH !== (st.snapshot?.mamh || st.selectedMamh))
    );
    if (duplicate) {
        return UI.toast(`Tên môn học "${tenmh}" đã tồn tại!`, 'error');
    }

    let res;
    if (st.mode === 'add') {
        res = await API.addMonHoc({ mamh, tenmh });
        if (!res?.success) return UI.toast(res?.message || 'Lỗi', 'error');
        UndoManager.push({
            tab: 'monhoc',
            description: `Thêm môn học ${mamh}`,
            undoFn: async () => { const r = await API.delMonHoc(mamh); if (!r?.success) throw new Error(r?.message || 'Lỗi'); }
        });
    } else if (st.mode === 'edit') {
        const targetMamh = st.snapshot?.mamh || st.selectedMamh;
        const oldTenmh = st.snapshot?.tenmh || '';
        res = await API.editMonHoc(targetMamh, { tenmh });
        if (!res?.success) return UI.toast(res?.message || 'Lỗi', 'error');
        UndoManager.push({
            tab: 'monhoc',
            description: `Sửa môn học ${targetMamh}`,
            undoFn: async () => { const r = await API.editMonHoc(targetMamh, { tenmh: oldTenmh }); if (!r?.success) throw new Error(r?.message || 'Lỗi'); }
        });
    } else {
        return UI.toast('Hãy chọn Thêm hoặc Hiệu chỉnh trước khi Ghi!', 'info');
    }

    UI.toast(res.message || 'Ghi thành công!', 'success');
    const mhfTableWrapper = document.getElementById('mhf_table_wrapper');
    Pages._savedMhfScrollTop = mhfTableWrapper ? mhfTableWrapper.scrollTop : 0;
    const contentArea = document.getElementById('contentArea');
    Pages._savedMhfContentScrollTop = contentArea ? contentArea.scrollTop : 0;
    await this.monhoc();
};

Pages.deleteMonHoc = async function () {
    const st = this._monhocState;
    if (!st || !st.canEdit) return;

    const targetMamh = st.selectedMamh || st.form.mamh;
    if (!targetMamh) return UI.toast('Vui lòng chọn môn học để xóa!', 'error');
    // Lưu dữ liệu trước khi xóa để phục hồi
    const row = st.allRows.find(r => r.MAMH === targetMamh);
    if (!row) return UI.toast('Không tìm thấy môn học!', 'error');
    if (!UI.confirm('Bạn chắc chắn muốn xóa môn học này?')) return;

    const res = await API.delMonHoc(targetMamh);
    if (res?.success) {
        UndoManager.push({
            tab: 'monhoc',
            description: `Xóa môn học ${row.MAMH} - ${row.TENMH}`,
            undoFn: async () => { const r = await API.addMonHoc({ mamh: row.MAMH, tenmh: row.TENMH }); if (!r?.success) throw new Error(r?.message || 'Lỗi'); }
        });
        UI.toast(res.message, 'success');
        const mhfTableWrapper = document.getElementById('mhf_table_wrapper');
        Pages._savedMhfScrollTop = mhfTableWrapper ? mhfTableWrapper.scrollTop : 0;
        const contentArea = document.getElementById('contentArea');
        Pages._savedMhfContentScrollTop = contentArea ? contentArea.scrollTop : 0;
        await this.monhoc();
    } else {
        UI.toast(res?.message || 'Lỗi', 'error');
    }
};
