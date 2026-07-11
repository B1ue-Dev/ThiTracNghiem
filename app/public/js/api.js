/**
 * API Helper — Tất cả fetch calls đều qua đây
 */
const API = {
    async request(url, options = {}) {
        const defaultOpts = {
            headers: { 'Content-Type': 'application/json' },
            ...options
        };
        try {
            const res = await fetch(url, defaultOpts);
            const data = await res.text();
            const parsed = JSON.parse(data || '{}');
            if (res.status === 401 || res.status === 403) {
                window.location.href = '/login';
                return null;
            }
            return parsed?.data || parsed;
        } catch (err) {
            console.error('API Error:', err);
            return { success: false, message: 'Lỗi kết nối server!' };
        }
    },

    get(url) { return this.request(url); },

    post(url, body) {
        return this.request(url, { method: 'POST', body: JSON.stringify(body) });
    },

    put(url, body) {
        return this.request(url, { method: 'PUT', body: JSON.stringify(body) });
    },

    del(url) {
        return this.request(url, { method: 'DELETE' });
    },

    // ===== AUTH =====
    getMe() { return this.get('/api/me'); },
    logout() { return this.post('/api/logout'); },
    taoTaiKhoan(data) { return this.post('/api/tao-tai-khoan', data); },
    kiemTraTaiKhoanGV(magv) { return this.get(`/api/tai-khoan-gv/${encodeURIComponent(magv)}`); },
    xoaTaiKhoan(loginName) { return this.post('/api/xoa-tai-khoan', { loginName }); },

    // ===== MÔN HỌC =====
    getMonHoc() { return this.get('/api/monhoc'); },
    addMonHoc(data) { return this.post('/api/monhoc', data); },
    editMonHoc(mamh, data) { return this.put(`/api/monhoc/${mamh}`, data); },
    delMonHoc(mamh) { return this.del(`/api/monhoc/${mamh}`); },

    // ===== LỚP =====
    getLop() { return this.get('/api/lop'); },
    addLop(data) { return this.post('/api/lop', data); },
    editLop(malop, data) { return this.put(`/api/lop/${malop}`, data); },
    delLop(malop) { return this.del(`/api/lop/${malop}`); },

    // ===== SINH VIÊN =====
    getSinhVien(malop) { return this.get(`/api/sinhvien?malop=${encodeURIComponent(malop)}`); },
    getSVInfo(masv) { return this.get(`/api/sinhvien/${encodeURIComponent(masv)}`); },
    timSinhVien(kw) { return this.get(`/api/sinhvien/tim?keyword=${encodeURIComponent(kw)}`); },
    addSinhVien(data) { return this.post('/api/sinhvien', data); },
    editSinhVien(masv, data) { return this.put(`/api/sinhvien/${encodeURIComponent(masv)}`, data); },
    delSinhVien(masv) { return this.del(`/api/sinhvien/${encodeURIComponent(masv)}`); },

    // ===== GIÁO VIÊN =====
    getGiaoVien() { return this.get('/api/giaovien'); },
    timGiaoVien(kw) { return this.get(`/api/giaovien/tim?keyword=${encodeURIComponent(kw)}`); },
    addGiaoVien(data) { return this.post('/api/giaovien', data); },
    editGiaoVien(magv, data) { return this.put(`/api/giaovien/${encodeURIComponent(magv)}`, data); },
    delGiaoVien(magv) { return this.del(`/api/giaovien/${encodeURIComponent(magv)}`); },

    // ===== CÂU HỎI =====
    getCauHoiByGV(magv) { return this.get(`/api/cauhoi/gv/${encodeURIComponent(magv)}`); },
    getCauHoiByMH(mamh, trinhdo) {
        let url = `/api/cauhoi/mh/${encodeURIComponent(mamh)}`;
        if (trinhdo) url += `?trinhdo=${trinhdo}`;
        return url ? this.get(url) : this.get(url);
    },
    addCauHoi(data) { return this.post('/api/cauhoi', data); },
    editCauHoi(id, data) { return this.put(`/api/cauhoi/${id}`, data); },
    delCauHoi(id) { return this.del(`/api/cauhoi/${id}`); },

    // ===== THI =====
    getDangKyThi(malop, mamh) {
        let url = '/api/dangkythi?';
        if (malop) url += `malop=${encodeURIComponent(malop)}&`;
        if (mamh) url += `mamh=${encodeURIComponent(mamh)}`;
        return this.get(url);
    },
    getDangKyThiSV(masv) { return this.get(`/api/dangkythi/sv/${encodeURIComponent(masv)}?t=${Date.now()}`); },
    dangKyThi(data) { return this.post('/api/dangkythi', data); },
    editDangKyThi(data) { return this.post('/api/dangkythi/sua', data); },
    xoaDangKyThi(data) { return this.post('/api/dangkythi/xoa', data); },
    layDe(data) { return this.post('/api/thi/lay-de', data); },
    nopBai(data) { return this.post('/api/thi/nop-bai', data); },
    layDeThiThu(data) { return this.post('/api/thi-thu/lay-de', data); },
    capNhatDapAnTam(data) { return this.post('/api/thi/cap-nhat-dap-an', data); },
    kiemTraBaiThiDangDo() { return this.post('/api/thi/kiem-tra-dang-do', {}); },
    heartbeat(data) { return this.post('/api/thi/heartbeat', data); },

    // ===== KẾT QUẢ =====
    xemBaiThi(masv, mamh, lan) {
        return this.get(`/api/ketqua/baithi?masv=${encodeURIComponent(masv)}&mamh=${encodeURIComponent(mamh)}&lan=${lan}`);
    },
    xemBangDiem(malop, mamh, lan) {
        return this.get(`/api/ketqua/bangdiem?malop=${encodeURIComponent(malop)}&mamh=${encodeURIComponent(mamh)}&lan=${lan}`);
    },
    getMonHocDaThiCuaLop(malop) {
        return this.get(`/api/report/lop-monhoc?malop=${encodeURIComponent(malop)}`);
    },
    getLanThiDaThiCuaLopMon(malop, mamh) {
        return this.get(`/api/report/lop-monhoc-lan?malop=${encodeURIComponent(malop)}&mamh=${encodeURIComponent(mamh)}`);
    },
    getLichSuThiSV(masv) {
        return this.get(`/api/report/sv-lichsuthi?masv=${encodeURIComponent(masv)}`);
    }
};
