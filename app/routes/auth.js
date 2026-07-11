const express = require('express');
const router = express.Router();
const { executeStoredProc, testConnection, closePool, sql } = require('../db');

// GET /login — Form đăng nhập
router.get('/login', (req, res) => {
    if (req.session && req.session.user) {
        return res.redirect('/');
    }
    res.sendFile('login.html', { root: './views' });
});

// POST /api/login — Xử lý đăng nhập
router.post('/api/login', async (req, res) => {
    const { username, password, masv, role } = req.body;
    const isStudentLogin = role === 'student';

    try {
        let resolvedRole = 'Unknown';
        let sessionUsername = username;
        let sessionPassword = password;
        let magv = null;
        let svInfo = null;
        let gvInfo = null;

        if (isStudentLogin) {
            if (!masv || !masv.trim()) {
                return res.status(400).json({ success: false, message: 'Vui lòng nhập Mã sinh viên!' });
            }

            if (!password || !String(password).trim()) {
                return res.status(400).json({ success: false, message: 'Vui lòng nhập mật khẩu!' });
            }

            // Sinh viên dùng login dùng chung 'sv', còn mật khẩu đăng nhập nằm ở bảng SINHVIEN.
            sessionUsername = 'sv';
            sessionPassword = '123';
            await testConnection(sessionUsername, sessionPassword);

            const svResult = await executeStoredProc('SP_LayThongTinSV', {
                MASV: { type: sql.NVarChar(50), value: masv.trim() }
            }, { username: sessionUsername, password: sessionPassword });

            if (!svResult.recordset || svResult.recordset.length === 0) {
                return res.status(401).json({ success: false, message: 'Mã sinh viên không tồn tại!' });
            }

            svInfo = svResult.recordset[0];
            if (svInfo.TRANG_THAI === 'Khóa') {
                return res.status(403).json({ success: false, message: 'Tài khoản sinh viên đã bị khóa!' });
            }

            const svPassword = (svInfo.PASSWORD || '').trim();
            if (!svPassword) {
                return res.status(403).json({ success: false, message: 'Bạn cần đăng kí tài khoản trước!' });
            }

            if (svPassword !== String(password).trim()) {
                return res.status(401).json({ success: false, message: 'Mật khẩu sinh viên không chính xác!' });
            }

            resolvedRole = 'Sinhvien';
        } else {
            if (!username || !password) {
                return res.status(400).json({ success: false, message: 'Vui lòng nhập đầy đủ thông tin!' });
            }

            // Staff đăng nhập theo SQL Login riêng.
            await testConnection(username, password);

            const result = await executeStoredProc('SP_KiemTraQuyen', {}, { username, password });
            resolvedRole = result.recordset[0]?.VaiTro || 'Unknown';

            if (resolvedRole === 'Sinhvien') {
                return res.status(403).json({ success: false, message: 'Vui lòng chọn tab Sinh viên để đăng nhập.' });
            }

            if (resolvedRole === 'Giangvien' || resolvedRole === 'PGV') {
                const gvMap = await executeStoredProc('SP_LayThongTinGVTheoLoginHienTai', {}, { username, password });
                gvInfo = gvMap.recordset?.[0] || null;
                if (gvInfo && gvInfo.TRANG_THAI === 'Khóa') {
                    return res.status(403).json({ success: false, message: 'Tài khoản của bạn đã bị khóa!' });
                }
                magv = gvInfo?.MAGV?.trim() || gvInfo?.DbUser_MAGV?.trim() || null;
            }
        }

        // Lưu vào session
        req.session.user = {
            username: sessionUsername,
            password: sessionPassword,  // Cần giữ để tạo connection pool cho các request sau
            role: resolvedRole,
            masv: resolvedRole === 'Sinhvien' ? masv.trim() : null,
            magv,
            hoTen: svInfo
                ? `${svInfo.HO?.trim() || ''} ${svInfo.TEN?.trim() || ''}`.trim()
                : (gvInfo ? `${gvInfo.HO?.trim() || ''} ${gvInfo.TEN?.trim() || ''}`.trim() : null),
            maLop: svInfo ? svInfo.MALOP?.trim() : null,
            tenLop: svInfo ? svInfo.TENLOP?.trim() : null,
            ngaySinh: svInfo?.NGAYSINH ? new Date(svInfo.NGAYSINH).toLocaleDateString('vi-VN') : null,
            soDT: gvInfo?.SODTLL?.trim() || null,
            diaChi: gvInfo?.DIACHI?.trim() || null,
        };

        res.json({
            success: true,
            message: 'Đăng nhập thành công!',
            role: resolvedRole,
            username: resolvedRole === 'Sinhvien' ? masv.trim() : username
        });
    } catch (err) {
        res.status(401).json({
            success: false,
            message: 'Tài khoản hoặc mật khẩu không chính xác!',
            error: err.message
        });
    }
});

// POST /api/sinhvien/dang-ky-tai-khoan — Sinh viên đăng ký mật khẩu đăng nhập
router.post('/api/sinhvien/dang-ky-tai-khoan', async (req, res) => {
    const masv = String(req.body.masv || '').trim();
    const inputPassword = String(req.body.password || '').trim();

    if (!masv) {
        return res.status(400).json({ success: false, message: 'Vui lòng nhập Mã sinh viên!' });
    }

    try {
        const sharedCreds = { username: 'sv', password: '123' };
        await testConnection(sharedCreds.username, sharedCreds.password);

        const result = await executeStoredProc('SP_DangKyTaiKhoanSinhVien', {
            MASV: { type: sql.NVarChar(50), value: masv },
            PASSWORD: { type: sql.NVarChar(50), value: inputPassword || null }
        }, sharedCreds);

        const message = inputPassword
            ? (result.recordset[0]?.ThongBao || 'Đăng ký thành công!')
            : 'Đăng ký thành công! Mật khẩu mặc định là 123.';

        res.json({ success: true, message });
    } catch (err) {
        if ((err.message || '').includes('đăng kí tài khoản rồi')) {
            return res.status(409).json({ success: false, message: err.message });
        }
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST /api/logout — Đăng xuất
router.post('/api/logout', async (req, res) => {
    if (req.session && req.session.user) {
        await closePool(req.session.user.username);
        req.session.destroy();
    }
    res.json({ success: true, message: 'Đã đăng xuất!' });
});

// GET /api/me — Lấy thông tin user hiện tại
router.get('/api/me', (req, res) => {
    if (!req.session || !req.session.user) {
        return res.status(401).json({ success: false, message: 'Chưa đăng nhập!' });
    }
    const { username, role, masv, magv, hoTen, maLop, tenLop, ngaySinh, soDT, diaChi } = req.session.user;
    res.json({ success: true, username, role, masv, magv, hoTen, maLop, tenLop, ngaySinh, soDT, diaChi });
});

// POST /api/tao-tai-khoan — Tạo tài khoản (chỉ PGV)
router.post('/api/tao-tai-khoan', async (req, res) => {
    if (!req.session?.user || req.session.user.role !== 'PGV') {
        return res.status(403).json({ success: false, message: 'Không có quyền!' });
    }

    const { loginName, password, nhomQuyen, magv } = req.body;
    if (!loginName || !password || !nhomQuyen) {
        return res.status(400).json({ success: false, message: 'Thiếu thông tin tạo tài khoản!' });
    }
    if (!magv || !String(magv).trim()) {
        return res.status(400).json({ success: false, message: 'Vui lòng chọn mã giáo viên!' });
    }

    try {
        const creds = { username: req.session.user.username, password: req.session.user.password };
        const result = await executeStoredProc('SP_TaoTaiKhoan', {
            LoginName: { type: sql.NVarChar(50), value: loginName },
            Password: { type: sql.NVarChar(50), value: password },
            NhomQuyen: { type: sql.NVarChar(20), value: nhomQuyen },
            MAGV: { type: sql.NVarChar(8), value: String(magv).trim() }
        }, creds);

        res.json({ success: true, message: result.recordset[0]?.ThongBao || 'Thành công!' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET /api/tai-khoan-gv/:magv — Kiểm tra giáo viên đã có tài khoản chưa (chỉ PGV)
router.get('/api/tai-khoan-gv/:magv', async (req, res) => {
    if (!req.session?.user || req.session.user.role !== 'PGV') {
        return res.status(403).json({ success: false, message: 'Không có quyền!' });
    }

    const magv = String(req.params.magv || '').trim();
    if (!magv) {
        return res.status(400).json({ success: false, message: 'Thiếu mã giáo viên!' });
    }

    try {
        const creds = { username: req.session.user.username, password: req.session.user.password };
        const result = await executeStoredProc('SP_KiemTraTaiKhoanGiaoVien', {
            MAGV: { type: sql.NVarChar(8), value: magv }
        }, creds);

        const row = result.recordset?.[0] || {};
        res.json({
            success: true,
            magv,
            hasAccount: !!row.HasAccount,
            loginName: row.LoginName ? String(row.LoginName).trim() : null,
            vaiTro: row.VaiTro ? String(row.VaiTro).trim() : null
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST /api/xoa-tai-khoan — Xóa tài khoản (chỉ PGV)
router.post('/api/xoa-tai-khoan', async (req, res) => {
    if (!req.session?.user || req.session.user.role !== 'PGV') {
        return res.status(403).json({ success: false, message: 'Không có quyền!' });
    }

    const { loginName } = req.body;
    try {
        const creds = { username: req.session.user.username, password: req.session.user.password };
        const result = await executeStoredProc('SP_XoaTaiKhoan', {
            LoginName: { type: sql.NVarChar(50), value: loginName }
        }, creds);

        res.json({ success: true, message: result.recordset[0]?.ThongBao || 'Đã xóa!' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
