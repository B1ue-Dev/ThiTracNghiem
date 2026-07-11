/**
 * PAGES — Lớp
 */

Pages.lop = async function() {
    UI.setTitle('Quản lý Lớp');
    UI.showLoading();
    const res = await API.getLop();
    if (!res?.success) return UI.toast(res?.message || 'Lỗi', 'error');

    const canEdit = window.APP_ROLE === 'PGV';
    const table = UI.buildTable(
        [
            { key: 'MALOP', label: 'Mã Lớp' },
            { key: 'TENLOP', label: 'Tên Lớp' }
        ],
        res.data,
        canEdit ? (row) => `
            <button class="btn btn-sm btn-secondary" onclick="Pages.editLopModal('${row.MALOP.trim()}','${row.TENLOP.trim()}')">Sửa</button>
            <button class="btn btn-sm btn-danger" onclick="Pages.deleteLop('${row.MALOP.trim()}')">Xóa</button>
        ` : null
    );

    let html = '<div class="card"><div class="card-header"><h3>Danh sách Lớp</h3>';
    if (canEdit) html += '<button class="btn btn-primary" onclick="Pages.addLopModal()">+ Thêm</button>';
    html += `</div>${table}</div>`;
    UI.showContent(html);
};

Pages.addLopModal = function() {
    UI.showModal(`
        <button class="modal-close" onclick="UI.closeModal()">✕</button>
        <h2>Thêm Lớp</h2>
        <div class="form-group"><label>Mã lớp</label><input id="fl_malop" maxlength="15"></div>
        <div class="form-group"><label>Tên lớp</label><input id="fl_tenlop" maxlength="40"></div>
        <div class="form-actions">
            <button class="btn btn-secondary" onclick="UI.closeModal()">Hủy</button>
            <button class="btn btn-primary" onclick="Pages.saveLop()">Lưu</button>
        </div>
    `);
};

Pages.editLopModal = function(malop, tenlop) {
    UI.showModal(`
        <button class="modal-close" onclick="UI.closeModal()">✕</button>
        <h2>Sửa Lớp</h2>
        <div class="form-group"><label>Mã lớp</label><input id="fl_malop" value="${malop}" disabled></div>
        <div class="form-group"><label>Tên lớp</label><input id="fl_tenlop" value="${tenlop}" maxlength="40"></div>
        <div class="form-actions">
            <button class="btn btn-secondary" onclick="UI.closeModal()">Hủy</button>
            <button class="btn btn-primary" onclick="Pages.updateLop('${malop}')">Cập nhật</button>
        </div>
    `);
};

Pages.saveLop = async function() {
    const malop = document.getElementById('fl_malop').value.trim();
    const tenlop = document.getElementById('fl_tenlop').value.trim();
    if (!malop || !tenlop) return UI.toast('Nhập đầy đủ!', 'error');
    const res = await API.addLop({ malop, tenlop });
    if (res?.success) { UI.toast(res.message, 'success'); UI.closeModal(); this.lop(); }
    else UI.toast(res?.message || 'Lỗi', 'error');
};

Pages.updateLop = async function(malop) {
    const tenlop = document.getElementById('fl_tenlop').value.trim();
    const res = await API.editLop(malop, { tenlop });
    if (res?.success) { UI.toast(res.message, 'success'); UI.closeModal(); this.lop(); }
    else UI.toast(res?.message || 'Lỗi', 'error');
};

Pages.deleteLop = async function(malop) {
    if (!UI.confirm('Xóa lớp này?')) return;
    const res = await API.delLop(malop);
    if (res?.success) { UI.toast(res.message, 'success'); this.lop(); }
    else UI.toast(res?.message || 'Lỗi', 'error');
};
