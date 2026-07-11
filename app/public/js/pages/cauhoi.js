/**
 * PAGES — Câu hỏi (Bộ đề)
 */

Pages.cauhoi = async function () {
    UI.setTitle('Quản lý Câu hỏi');
    UI.showLoading();

    const mhRes = await API.getMonHoc();
    window._monhocList = mhRes?.data || [];

    // Nếu là GV, chỉ lấy câu hỏi của mình
    let gvList = [];
    if (window.APP_ROLE === 'PGV' || window.APP_ROLE === 'Giangvien') {
        const gvRes = await API.getGiaoVien();
        gvList = gvRes?.data || [];
    }
    window._gvList = gvList;

    const html = `<div class="card">
        <div class="card-header"><h3>Bộ đề câu hỏi</h3>
            <button class="btn btn-primary" onclick="Pages.addCauHoiModal()">+ Thêm câu hỏi</button>
        </div>
        <div class="toolbar" style="margin-bottom:16px;">
            <select id="ch_filter_mh" onchange="Pages.loadCauHoi()">
                ${UI.selectOptions(window._monhocList, 'MAMH', 'TENMH')}
            </select>
            <select id="ch_filter_td" onchange="Pages.loadCauHoi()">
                <option value="" selected>Tất cả trình độ</option>
                <option value="A">Trình độ A</option>
                <option value="B">Trình độ B</option>
                <option value="C">Trình độ C</option>
            </select>
        </div>
        <div id="ch_count_area" style="margin-bottom: 12px; font-weight: bold; color: #555; font-size: 14px; display: none;">
            Tổng số câu hỏi: <span id="ch_total_count">0</span>
        </div>
        <div id="chTableArea"><div class="loading"><div class="spinner"></div></div></div>
    </div>`;
    UI.showContent(html);
    this.loadCauHoi();
};

Pages.loadCauHoi = async function () {
    const mamh = document.getElementById('ch_filter_mh').value;
    const td = document.getElementById('ch_filter_td').value;
    if (!mamh) return;

    const res = await API.getCauHoiByMH(mamh, td || null);
    const questions = res?.data || [];

    // Cập nhật số lượng câu hỏi hiện tại
    const countEl = document.getElementById('ch_total_count');
    const countAreaEl = document.getElementById('ch_count_area');
    if (countEl) {
        countEl.textContent = questions.length;
    }
    if (countAreaEl) {
        countAreaEl.style.display = questions.length > 0 ? 'block' : 'none';
    }

    const cols = [
        { key: 'CAUHOI', label: '#' },
        { key: 'TRINHDO', label: 'Trình độ' },
        { key: 'NOIDUNG', label: 'Nội dung' },
        { key: 'A', label: 'A' },
        { key: 'B', label: 'B' },
        { key: 'C', label: 'C' },
        { key: 'D', label: 'D' },
        { key: 'DAP_AN', label: 'Đáp án' }
    ];
    if (window.APP_ROLE === 'PGV') {
        cols.push({ key: 'MAGV', label: 'GV soạn' });
    }

    const table = UI.buildTable(
        cols,
        questions,
        (row) => `
            <button class="btn btn-sm btn-secondary" onclick='Pages.editCauHoiModal(${JSON.stringify(row).replace(/'/g, "&#39;")})'>Sửa</button>
            <button class="btn btn-sm btn-danger" onclick="Pages.deleteCauHoi(${row.CAUHOI})">Xóa</button>
        `
    );
    document.getElementById('chTableArea').innerHTML = table;
};

Pages.addCauHoiModal = function () {
    const isGV = window.APP_ROLE === 'Giangvien';
    const magvField = isGV
        ? `<div class="form-group">
                <label>Mã GV soạn</label>
                <input id="fch_magv" value="${window.APP_MAGV}" disabled>
           </div>`
        : `<div class="form-group">
                <label>Mã GV soạn</label>
                <select id="fch_magv">${UI.selectOptions(window._gvList, 'MAGV', 'MAGV')}</select>
           </div>`;

    // Lấy giá trị bộ lọc hiện tại để chọn sẵn trong modal
    const currentMamh = document.getElementById('ch_filter_mh')?.value || '';
    const currentTd = document.getElementById('ch_filter_td')?.value || '';

    UI.showModal(`
        <button class="modal-close" onclick="UI.closeModal()">✕</button>
        <h2>Thêm Câu hỏi</h2>
        <div class="form-grid">
            <div class="form-group">
                <label>Môn học</label>
                <select id="fch_mamh">${UI.selectOptions(window._monhocList, 'MAMH', 'TENMH', currentMamh)}</select>
            </div>
            <div class="form-group">
                <label>Trình độ</label>
                <select id="fch_td">
                    <option value="A" ${currentTd === 'A' ? 'selected' : ''}>A</option><option value="B" ${currentTd === 'B' ? 'selected' : ''}>B</option><option value="C" ${currentTd === 'C' ? 'selected' : ''}>C</option>
                </select>
            </div>
            <div class="form-group full-width"><label>Nội dung câu hỏi</label><textarea id="fch_nd" rows="3" maxlength="200"></textarea></div>
            <div class="form-group"><label>Đáp án A</label><input id="fch_a" maxlength="50"></div>
            <div class="form-group"><label>Đáp án B</label><input id="fch_b" maxlength="50"></div>
            <div class="form-group"><label>Đáp án C</label><input id="fch_c" maxlength="50"></div>
            <div class="form-group"><label>Đáp án D</label><input id="fch_d" maxlength="50"></div>
            <div class="form-group">
                <label>Đáp án đúng</label>
                <select id="fch_da"><option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option></select>
            </div>
            ${magvField}
        </div>
        <div class="form-actions">
            <button class="btn btn-secondary" onclick="UI.closeModal()">Hủy</button>
            <button class="btn btn-primary" onclick="Pages.saveCauHoi()">Lưu</button>
        </div>
    `);
};

Pages.editCauHoiModal = function (row) {
    const r = typeof row === 'string' ? JSON.parse(row) : row;
    UI.showModal(`
        <button class="modal-close" onclick="UI.closeModal()">✕</button>
        <h2>Sửa Câu hỏi #${r.CAUHOI}</h2>
        <div class="form-grid">
            <div class="form-group">
                <label>Môn học</label>
                <select id="fch_mamh">${UI.selectOptions(window._monhocList, 'MAMH', 'TENMH', r.MAMH)}</select>
            </div>
            <div class="form-group">
                <label>Trình độ</label>
                <select id="fch_td">
                    <option value="A" ${r.TRINHDO?.trim() === 'A' ? 'selected' : ''}>A</option>
                    <option value="B" ${r.TRINHDO?.trim() === 'B' ? 'selected' : ''}>B</option>
                    <option value="C" ${r.TRINHDO?.trim() === 'C' ? 'selected' : ''}>C</option>
                </select>
            </div>
            <div class="form-group full-width"><label>Nội dung</label><textarea id="fch_nd" rows="3">${r.NOIDUNG?.trim() || ''}</textarea></div>
            <div class="form-group"><label>A</label><input id="fch_a" value="${r.A?.trim() || ''}"></div>
            <div class="form-group"><label>B</label><input id="fch_b" value="${r.B?.trim() || ''}"></div>
            <div class="form-group"><label>C</label><input id="fch_c" value="${r.C?.trim() || ''}"></div>
            <div class="form-group"><label>D</label><input id="fch_d" value="${r.D?.trim() || ''}"></div>
            <div class="form-group">
                <label>Đáp án đúng</label>
                <select id="fch_da">
                    <option value="A" ${r.DAP_AN?.trim() === 'A' ? 'selected' : ''}>A</option>
                    <option value="B" ${r.DAP_AN?.trim() === 'B' ? 'selected' : ''}>B</option>
                    <option value="C" ${r.DAP_AN?.trim() === 'C' ? 'selected' : ''}>C</option>
                    <option value="D" ${r.DAP_AN?.trim() === 'D' ? 'selected' : ''}>D</option>
                </select>
            </div>
        </div>
        <div class="form-actions">
            <button class="btn btn-secondary" onclick="UI.closeModal()">Hủy</button>
            <button class="btn btn-primary" onclick="Pages.updateCauHoi(${r.CAUHOI})">Cập nhật</button>
        </div>
    `);
};

Pages.saveCauHoi = async function () {
    const magvEl = document.getElementById('fch_magv');
    const data = {
        mamh: document.getElementById('fch_mamh').value,
        trinhdo: document.getElementById('fch_td').value,
        noidung: document.getElementById('fch_nd').value.trim(),
        a: document.getElementById('fch_a').value.trim(),
        b: document.getElementById('fch_b').value.trim(),
        c: document.getElementById('fch_c').value.trim(),
        d: document.getElementById('fch_d').value.trim(),
        dap_an: document.getElementById('fch_da').value,
        magv: (magvEl ? magvEl.value : '') || window.APP_MAGV
    };

    if (!data.noidung) return UI.toast('Nội dung câu hỏi không được để trống!', 'error');
    if (!data.a) return UI.toast('Đáp án A không được để trống!', 'error');
    if (!data.b) return UI.toast('Đáp án B không được để trống!', 'error');
    if (!data.c) return UI.toast('Đáp án C không được để trống!', 'error');
    if (!data.d) return UI.toast('Đáp án D không được để trống!', 'error');
    if (!data.magv) return UI.toast('Vui lòng chọn hoặc nhập Mã GV soạn!', 'error');

    const res = await API.addCauHoi(data);
    if (res?.success) { UI.toast(res.message, 'success'); UI.closeModal(); this.loadCauHoi(); }
    else UI.toast(res?.message || 'Lỗi', 'error');
};

Pages.updateCauHoi = async function (id) {
    const data = {
        mamh: document.getElementById('fch_mamh').value,
        trinhdo: document.getElementById('fch_td').value,
        noidung: document.getElementById('fch_nd').value.trim(),
        a: document.getElementById('fch_a').value.trim(),
        b: document.getElementById('fch_b').value.trim(),
        c: document.getElementById('fch_c').value.trim(),
        d: document.getElementById('fch_d').value.trim(),
        dap_an: document.getElementById('fch_da').value
    };

    if (!data.noidung) return UI.toast('Nội dung câu hỏi không được để trống!', 'error');
    if (!data.a) return UI.toast('Đáp án A không được để trống!', 'error');
    if (!data.b) return UI.toast('Đáp án B không được để trống!', 'error');
    if (!data.c) return UI.toast('Đáp án C không được để trống!', 'error');
    if (!data.d) return UI.toast('Đáp án D không được để trống!', 'error');

    const res = await API.editCauHoi(id, data);
    if (res?.success) { UI.toast(res.message, 'success'); UI.closeModal(); this.loadCauHoi(); }
    else UI.toast(res?.message || 'Lỗi', 'error');
};

Pages.deleteCauHoi = async function (id) {
    if (!UI.confirm('Xóa câu hỏi này?')) return;
    const res = await API.delCauHoi(id);
    if (res?.success) { UI.toast(res.message, 'success'); this.loadCauHoi(); }
    else UI.toast(res?.message || 'Lỗi', 'error');
};
