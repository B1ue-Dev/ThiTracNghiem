/**
 * PAGES — Tạo tài khoản
 */

Pages.taoTaiKhoan = function() {
    UI.setTitle('Tạo tài khoản đăng nhập chương trình');
    // Need to load GV list first
    Pages._loadTaoTaiKhoan();
};

Pages._loadTaoTaiKhoan = async function() {
    UI.showLoading();
    const gvRes = await API.getGiaoVien();
    window._gvList = gvRes?.data || [];

    const gvOptions = (window._gvList || []).map(gv => {
        const name = (gv.HO?.trim() || '') + ' ' + (gv.TEN?.trim() || '');
        return '<option value="' + gv.MAGV.trim() + '">' + name + '</option>';
    }).join('');

    const html = '<div class="card tkv-wrap">' +
        '<h3 class="tkv-title">TẠO TÀI KHOẢN ĐĂNG NHẬP CHƯƠNG TRÌNH</h3>' +

        '<div id="tk_gv_section" class="tkv-row">' +
        '<label class="tkv-label">Họ tên nhân viên</label>' +
        '<div class="tkv-gv-grid">' +
        '<select id="tk_gv_select" onchange="Pages.onTkGvChange()">' +
        '<option value="">-- Chọn giảng viên --</option>' + gvOptions +
        '</select>' +
        '<label class="tkv-inline-label">MãNV</label>' +
        '<input id="tk_magv" disabled>' +
        '</div>' +
        '</div>' +

        '<div id="tk_login_group" class="tkv-row">' +
        '<label class="tkv-label">Tài khoản</label>' +
        '<input id="tk_login" placeholder="VD: gv_nguyenvana">' +
        '</div>' +

        '<div id="tk_pass_group" class="tkv-row">' +
        '<label class="tkv-label">Mật mã</label>' +
        '<input id="tk_pass" type="password">' +
        '</div>' +

        '<div class="tkv-row">' +
        '<label class="tkv-label">Nhóm quyền</label>' +
        '<select id="tk_role" onchange="Pages.onTkRoleChange()">' +
        '<option value="Giangvien">Giảng viên</option>' +
        '<option value="PGV">PGV (Phòng giáo vụ)</option>' +
        '</select>' +
        '</div>' +

        '<div id="tk_status" class="tkv-status"></div>' +

        '<div class="tkv-actions">' +
        '<button id="tk_btn_create" class="btn tkv-btn" onclick="Pages.saveTaiKhoan()">Tạo tài khoản</button>' +
        '<button id="tk_btn_delete" class="btn tkv-btn" onclick="Pages.deleteTaiKhoan()">Xóa tài khoản</button>' +
        '<button class="btn tkv-btn" onclick="Pages.cancelTaiKhoan()">Thoát</button>' +
        '</div>' +
        '</div>';
    UI.showContent(html);

    // Ràng buộc nhập liệu:
    // - Tài khoản: Chỉ cho phép ký tự thường (a-z), số (0-9) và dấu gạch dưới (_)
    // - Mật mã: Không cho phép khoảng trắng (giữ nguyên độ bảo mật của mật khẩu)
    const loginIn = document.getElementById('tk_login');
    const passIn = document.getElementById('tk_pass');
    if (loginIn) {
        loginIn.addEventListener('input', function() {
            this.value = this.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
        });
    }
    if (passIn) {
        passIn.addEventListener('input', function() {
            this.value = this.value.replace(/\s/g, '');
        });
    }

    this.onTkRoleChange();
};

Pages.onTkRoleChange = async function() {
    const gvSection = document.getElementById('tk_gv_section');
    const loginInput = document.getElementById('tk_login');
    const statusEl = document.getElementById('tk_status');
    const loginGroup = document.getElementById('tk_login_group');
    const passGroup = document.getElementById('tk_pass_group');
    const createBtn = document.getElementById('tk_btn_create');
    const deleteBtn = document.getElementById('tk_btn_delete');

    if (statusEl) statusEl.textContent = '';
    if (passGroup) passGroup.style.display = 'block';
    if (createBtn) createBtn.style.display = 'inline-block';
    if (deleteBtn) deleteBtn.style.display = 'inline-block';

    gvSection.style.display = 'block';
    loginInput.disabled = false;
    loginInput.placeholder = '';
    if (loginGroup) loginGroup.style.display = 'block';
    await this._refreshTaiKhoanGvState();
};

Pages.cancelTaiKhoan = function() {
    UI.showContent(UI.showEmpty('', 'Chọn chức năng từ menu bên trái'));
};

Pages.onTkGvChange = async function() {
    const magv = document.getElementById('tk_gv_select').value;
    document.getElementById('tk_magv').value = magv;

    const loginInput = document.getElementById('tk_login');
    const passInput = document.getElementById('tk_pass');
    if (loginInput) {
        loginInput.value = '';
        loginInput.disabled = false;
    }
    if (passInput) passInput.value = '';

    await this._refreshTaiKhoanGvState();
};

Pages._refreshTaiKhoanGvState = async function() {
    const magv = document.getElementById('tk_magv')?.value?.trim() || '';
    const statusEl = document.getElementById('tk_status');
    const loginGroup = document.getElementById('tk_login_group');
    const passGroup = document.getElementById('tk_pass_group');
    const createBtn = document.getElementById('tk_btn_create');
    const deleteBtn = document.getElementById('tk_btn_delete');
    const loginInput = document.getElementById('tk_login');
    const passInput = document.getElementById('tk_pass');
    const roleSelect = document.getElementById('tk_role');

    if (!magv) {
        if (statusEl) statusEl.textContent = '';
        if (loginGroup) loginGroup.style.display = 'block';
        if (passGroup) passGroup.style.display = 'block';
        if (createBtn) createBtn.style.display = 'inline-block';
        if (deleteBtn) deleteBtn.style.display = 'inline-block';
        if (loginInput) { loginInput.value = ''; loginInput.disabled = false; }
        if (passInput) passInput.value = '';
        if (roleSelect) { roleSelect.disabled = false; }
        return;
    }

    const res = await API.kiemTraTaiKhoanGV(magv);
    if (!res?.success) {
        if (statusEl) statusEl.textContent = '';
        if (roleSelect) { roleSelect.disabled = false; }
        return;
    }

    if (res.hasAccount) {
        if (statusEl) {
            const vaiTro = res.vaiTro || 'Unknown';
            statusEl.textContent = 'Giảng viên này đã có tài khoản đăng nhập (' + vaiTro + ').';
        }
        if (loginInput) { loginInput.value = res.loginName || ''; loginInput.disabled = true; }
        if (passInput) passInput.value = '';
        if (roleSelect) {
            if (res.vaiTro) {
                roleSelect.value = res.vaiTro;
            }
            roleSelect.disabled = true;
        }
        if (loginGroup) loginGroup.style.display = 'none';
        if (passGroup) passGroup.style.display = 'none';
        if (createBtn) createBtn.style.display = 'none';
        if (deleteBtn) deleteBtn.style.display = 'inline-block';
    } else {
        if (statusEl) statusEl.textContent = '';
        if (loginInput) { loginInput.disabled = false; }
        if (roleSelect) { roleSelect.disabled = false; }
        if (loginGroup) loginGroup.style.display = 'block';
        if (passGroup) passGroup.style.display = 'block';
        if (createBtn) createBtn.style.display = 'inline-block';
        if (deleteBtn) deleteBtn.style.display = 'inline-block';
    }
};

Pages.saveTaiKhoan = async function() {
    const role = document.getElementById('tk_role').value;
    const loginName = document.getElementById('tk_login').value;
    const password = document.getElementById('tk_pass').value;
    const magv = document.getElementById('tk_magv')?.value?.trim() || null;

    if (!loginName || !loginName.trim()) return UI.toast('Chọn giảng viên hoặc nhập tên đăng nhập!', 'error');
    if (!/^[a-z0-9_]+$/.test(loginName)) {
        return UI.toast('Tên đăng nhập chỉ được chứa ký tự thường (a-z), số (0-9) và dấu gạch dưới (_)!', 'error');
    }
    if (!password) return UI.toast('Nhập mật mã!', 'error');
    if (/\s/.test(password)) return UI.toast('Mật mã không được chứa khoảng trắng!', 'error');
    if (!magv) return UI.toast('Vui lòng chọn giảng viên!', 'error');

    const payload = { loginName: loginName.trim(), password, nhomQuyen: role, magv };

    const res = await API.taoTaiKhoan(payload);
    if (res?.success) {
        UI.toast(res.message, 'success');
        document.getElementById('tk_pass').value = '';
        await this._refreshTaiKhoanGvState();
    } else {
        UI.toast(res?.message || 'Lỗi', 'error');
    }
};

Pages.deleteTaiKhoan = async function() {
    const loginName = document.getElementById('tk_login').value.trim();
    if (!loginName) {
        const magv = document.getElementById('tk_magv')?.value?.trim();
        if (magv) {
            return UI.toast('Giảng viên này chưa có tài khoản để xóa!', 'error');
        }
        return UI.toast('Chọn tài khoản cần xóa!', 'error');
    }
    if (!UI.confirm('Xóa tài khoản "' + loginName + '"?')) return;
    const res = await API.xoaTaiKhoan(loginName);
    if (res?.success) {
        UI.toast(res.message, 'success');
        await this._refreshTaiKhoanGvState();
        document.getElementById('tk_pass').value = '';
    } else {
        UI.toast(res?.message || 'Lỗi', 'error');
    }
};
