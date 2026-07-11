/**
 * PAGES — Đăng ký thi
 */

Pages.dangkythi = async function() {
    UI.setTitle('Đăng ký Thi');
    UI.showLoading();

    const [lopRes, mhRes, gvRes] = await Promise.all([
        API.getLop(), API.getMonHoc(), API.getGiaoVien()
    ]);

    window._lopList = lopRes?.data || [];
    window._monhocList = mhRes?.data || [];
    window._gvList = gvRes?.data || [];

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const html = `<div class="card">
        <div class="card-header"><h3>Đăng ký thi mới</h3></div>
        <div class="form-grid cols-3">
            <div class="form-group"><label>Giảng viên</label>
                ${window.APP_ROLE === 'Giangvien'
            ? `<input id="dk_magv" value="${window.APP_MAGV || ''}" disabled>`
            : `<select id="dk_magv">${UI.selectOptions(window._gvList, 'MAGV', 'MAGV')}</select>`
        }</div>
            <div class="form-group"><label>Lớp</label>
                <select id="dk_malop">${UI.selectOptions(window._lopList, 'MALOP', 'TENLOP')}</select></div>
            <div class="form-group"><label>Môn học</label>
                <select id="dk_mamh">${UI.selectOptions(window._monhocList, 'MAMH', 'TENMH')}</select></div>
            <div class="form-group"><label>Trình độ</label>
                <select id="dk_td"><option value="A">A</option><option value="B">B</option><option value="C">C</option></select></div>
            <div class="form-group"><label>Lần thi</label>
                <select id="dk_lan"><option value="1">1</option><option value="2">2</option></select></div>
            <div class="form-group"><label>Ngày thi</label><input id="dk_ngaythi" type="date" min="${tomorrowStr}" value="${tomorrowStr}"></div>
            <div class="form-group"><label>Số câu thi (10-100)</label><input id="dk_socau" type="number" min="10" max="100" value="20"></div>
            <div class="form-group"><label>Thời gian (15-60 phút)</label><input id="dk_tg" type="number" min="15" max="60" value="30"></div>
        </div>
        <div class="form-actions">
            <button class="btn btn-primary" onclick="Pages.saveDangKy()">Đăng ký</button>
        </div>
    </div>
    <div class="card" style="margin-top:20px;">
        <div class="card-header"><h3>Danh sách đã đăng ký</h3></div>
        <div id="dkTableArea"><div class="loading"><div class="spinner"></div></div></div>
    </div>`;

    UI.showContent(html);
    this.loadDangKy();
};

Pages.loadDangKy = async function() {
    const res = await API.getDangKyThi();
    const rows = res?.data || [];
    window._dangkyList = rows;
    const canDeleteRole = window.APP_ROLE === 'PGV' || window.APP_ROLE === 'Giangvien';
    const table = UI.buildTable(
        [
            { key: 'TENGV', label: 'Giảng viên' },
            { key: 'TENLOP', label: 'Lớp' },
            { key: 'TENMH', label: 'Môn học' },
            { key: 'TRINHDO', label: 'TĐ' },
            { key: 'LAN', label: 'Lần' },
            { key: 'SOCAUTHI', label: 'Số câu' },
            { key: 'THOIGIAN', label: 'Thời gian' },
            { key: 'NGAYTHI', label: 'Ngày thi', format: v => v ? new Date(v).toLocaleDateString('vi-VN') : '' }
        ],
        rows,
        canDeleteRole ? (row) => {
            const rowMagv = (row.MAGV || '').trim();
            const allowDelete = window.APP_ROLE === 'PGV'
                || (window.APP_ROLE === 'Giangvien' && rowMagv && rowMagv === (window.APP_MAGV || '').trim());

            if (!allowDelete) return '';
            const malop = (row.MALOP || '').trim();
            const mamh = (row.MAMH || '').trim();
            const lan = row.LAN;
            return `
                <button class="btn btn-sm btn-primary" onclick="Pages.editDangKy('${malop}','${mamh}','${lan}')" style="margin-right: 5px;">Sửa</button>
                <button class="btn btn-sm btn-danger" onclick="Pages.deleteDangKy('${malop}','${mamh}','${lan}')">Xóa</button>
            `;
        } : null
    );
    document.getElementById('dkTableArea').innerHTML = table;
};

Pages.deleteDangKy = async function(malop, mamh, lan) {
    if (!UI.confirm('Xóa đăng ký thi này?')) return;
    const res = await API.xoaDangKyThi({ malop, mamh, lan });
    if (res?.success) {
        UI.toast(res.message || 'Đã xóa!', 'success');
        this.loadDangKy();
    } else {
        UI.toast(res?.message || 'Lỗi', 'error');
    }
};

Pages.saveDangKy = async function() {
    const rawMagv = (document.getElementById('dk_magv')?.value || window.APP_MAGV || '').trim();
    const rawMalop = (document.getElementById('dk_malop')?.value || '').trim();
    const rawMamh = (document.getElementById('dk_mamh')?.value || '').trim();

    const lopItem = (window._lopList || []).find(r => (r.MALOP || '').trim() === rawMalop);
    const monItem = (window._monhocList || []).find(r => (r.MAMH || '').trim() === rawMamh);
    const gvItem = (window._gvList || []).find(r => (r.MAGV || '').trim() === rawMagv);

    const data = {
        magv: (window.APP_ROLE === 'Giangvien' ? (window.APP_MAGV || rawMagv) : (gvItem?.MAGV || rawMagv)).trim(),
        malop: (lopItem?.MALOP || rawMalop).trim(),
        mamh: (monItem?.MAMH || rawMamh).trim(),
        trinhdo: (document.getElementById('dk_td')?.value || '').trim(),
        lan: (document.getElementById('dk_lan')?.value || '').trim(),
        ngaythi: (document.getElementById('dk_ngaythi')?.value || '').trim(),
        socauthi: (document.getElementById('dk_socau')?.value || '').trim(),
        thoigian: (document.getElementById('dk_tg')?.value || '').trim()
    };

    if (!data.magv) return UI.toast('Thiếu mã giảng viên!', 'error');
    if (!data.malop) return UI.toast('Vui lòng chọn lớp hợp lệ!', 'error');
    if (!data.mamh) return UI.toast('Vui lòng chọn môn học hợp lệ!', 'error');
    if (!data.ngaythi) return UI.toast('Chọn ngày thi!', 'error');

    // Kiểm tra tính hợp lệ của ngày thi
    const ngaythiInput = document.getElementById('dk_ngaythi');
    if (ngaythiInput && !ngaythiInput.validity.valid) {
        return UI.toast('Ngày thi không hợp lệ hoặc không đúng định dạng!', 'error');
    }

    const selectedDate = new Date(data.ngaythi);
    const today = new Date();
    today.setHours(0,0,0,0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (isNaN(selectedDate.getTime())) {
        return UI.toast('Ngày thi không hợp lệ!', 'error');
    }
    if (selectedDate < tomorrow) {
        return UI.toast('Ngày thi phải là ngày mai hoặc sau ngày hiện tại!', 'error');
    }

    const res = await API.dangKyThi(data);
    if (res?.success) { UI.toast(res.message, 'success'); this.loadDangKy(); }
    else UI.toast(res?.message || 'Lỗi', 'error');
};

Pages.editDangKy = function(malop, mamh, lan) {
    const row = (window._dangkyList || []).find(r => 
        (r.MALOP || '').trim() === malop.trim() && 
        (r.MAMH || '').trim() === mamh.trim() && 
        Number(r.LAN) === Number(lan)
    );
    if (!row) return UI.toast('Không tìm thấy thông tin đăng ký thi!', 'error');

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    const currentDateVal = row.NGAYTHI ? new Date(row.NGAYTHI).toISOString().split('T')[0] : tomorrowStr;

    UI.showModal(`
        <button class="modal-close" onclick="UI.closeModal()">✕</button>
        <h2>Hiệu chỉnh Đăng ký thi</h2>
        <div class="form-grid cols-1" style="max-height: 400px; overflow-y: auto; padding: 10px; text-align: left;">
            <div class="form-group"><label>Giảng viên</label>
                <input value="${this.escapeHtml(row.TENGV || row.MAGV)}" disabled style="background: #e9e9e9;"></div>
            <div class="form-group"><label>Lớp</label>
                <input value="${this.escapeHtml(row.TENLOP || row.MALOP)}" disabled style="background: #e9e9e9;"></div>
            <div class="form-group"><label>Môn học</label>
                <input value="${this.escapeHtml(row.TENMH || row.MAMH)}" disabled style="background: #e9e9e9;"></div>
            
            <div class="form-group"><label>Trình độ</label>
                <select id="edit_dk_td">
                    <option value="A" ${row.TRINHDO === 'A' ? 'selected' : ''}>A</option>
                    <option value="B" ${row.TRINHDO === 'B' ? 'selected' : ''}>B</option>
                    <option value="C" ${row.TRINHDO === 'C' ? 'selected' : ''}>C</option>
                </select>
            </div>
            <div class="form-group"><label>Lần thi</label>
                <select id="edit_dk_lan">
                    <option value="1" ${Number(row.LAN) === 1 ? 'selected' : ''}>1</option>
                    <option value="2" ${Number(row.LAN) === 2 ? 'selected' : ''}>2</option>
                </select>
            </div>
            <div class="form-group"><label>Ngày thi</label>
                <input id="edit_dk_ngaythi" type="date" min="${tomorrowStr}" value="${currentDateVal}"></div>
            <div class="form-group"><label>Số câu thi (10-100)</label>
                <input id="edit_dk_socau" type="number" min="10" max="100" value="${row.SOCAUTHI || 20}"></div>
            <div class="form-group"><label>Thời gian (15-60 phút)</label>
                <input id="edit_dk_tg" type="number" min="15" max="60" value="${row.THOIGIAN || 30}"></div>
        </div>
        <div class="form-actions" style="margin-top: 15px;">
            <button class="btn btn-secondary" onclick="UI.closeModal()">Hủy</button>
            <button class="btn btn-primary" onclick="Pages.updateDangKy('${malop}', '${mamh}', ${lan})">Cập nhật</button>
        </div>
    `);
};

Pages.updateDangKy = async function(malop, mamh, oldLan) {
    const trinhdo = (document.getElementById('edit_dk_td')?.value || '').trim();
    const lan = Number(document.getElementById('edit_dk_lan')?.value);
    const ngaythi = (document.getElementById('edit_dk_ngaythi')?.value || '').trim();
    const socauthi = Number(document.getElementById('edit_dk_socau')?.value);
    const thoigian = Number(document.getElementById('edit_dk_tg')?.value);

    if (!ngaythi) return UI.toast('Chọn ngày thi!', 'error');
    if (isNaN(socauthi) || socauthi < 10 || socauthi > 100) return UI.toast('Số câu thi phải nằm trong khoảng 10-100!', 'error');
    if (isNaN(thoigian) || thoigian < 15 || thoigian > 60) return UI.toast('Thời gian thi phải nằm trong khoảng 15-60 phút!', 'error');

    // Kiểm tra ràng buộc Lần 2 với Lần 1
    if (lan === 2) {
        const matchingLan1 = (window._dangkyList || []).find(r =>
            (r.MALOP || '').trim() === malop.trim() &&
            (r.MAMH || '').trim() === mamh.trim() &&
            Number(r.LAN) === 1 &&
            Number(r.LAN) !== Number(oldLan)
        );
        if (!matchingLan1) {
            return UI.toast('Đăng ký lần 2 phải có đăng ký lần 1 với cùng ngày thi và cùng trình độ!', 'error');
        }
        const lan1DateStr = matchingLan1.NGAYTHI ? new Date(matchingLan1.NGAYTHI).toISOString().split('T')[0] : '';
        if (lan1DateStr !== ngaythi || matchingLan1.TRINHDO !== trinhdo) {
            return UI.toast('Đăng ký lần 2 phải có đăng ký lần 1 với cùng ngày thi và cùng trình độ!', 'error');
        }
    }

    // Kiểm tra tính hợp lệ của ngày thi
    const editNgaythiInput = document.getElementById('edit_dk_ngaythi');
    if (editNgaythiInput && !editNgaythiInput.validity.valid) {
        return UI.toast('Ngày thi không hợp lệ hoặc không đúng định dạng!', 'error');
    }

    const selectedDate = new Date(ngaythi);
    const today = new Date();
    today.setHours(0,0,0,0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (isNaN(selectedDate.getTime())) {
        return UI.toast('Ngày thi không hợp lệ!', 'error');
    }
    if (selectedDate < tomorrow) {
        return UI.toast('Ngày thi phải là ngày mai hoặc sau ngày hiện tại!', 'error');
    }

    const res = await API.editDangKyThi({
        malop,
        mamh,
        oldLan,
        trinhdo,
        ngaythi,
        lan,
        socauthi,
        thoigian
    });

    if (res?.success) {
        UI.toast(res.message || 'Cập nhật thành công!', 'success');
        UI.closeModal();
        this.loadDangKy();
    } else {
        UI.toast(res?.message || 'Lỗi', 'error');
    }
};
