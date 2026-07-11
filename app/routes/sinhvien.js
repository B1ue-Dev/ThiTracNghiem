const express = require('express');
const router = express.Router();
const { executeStoredProc, sql } = require('../db');
const { requireLogin, requireRole, getCredentials } = require('../middleware/auth');

// GET danh sách SV theo lớp
router.get('/api/sinhvien', requireRole('PGV', 'Giangvien'), async (req, res) => {
    try {
        const { malop } = req.query;
        if (!malop) {
            return res.status(400).json({ success: false, message: 'Thiếu mã lớp!' });
        }
        const result = await executeStoredProc('SP_LayDanhSachSV', {
            MALOP: { type: sql.NVarChar(50), value: malop }
        }, getCredentials(req));
        res.json({ success: true, data: result.recordset });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET tìm sinh viên
router.get('/api/sinhvien/tim', requireRole('PGV'), async (req, res) => {
    try {
        const result = await executeStoredProc('SP_TimSinhVien', {
            Keyword: { type: sql.NVarChar(50), value: req.query.keyword || '' }
        }, getCredentials(req));
        res.json({ success: true, data: result.recordset });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET thông tin 1 SV
router.get('/api/sinhvien/:masv', requireLogin, async (req, res) => {
    try {
        const requestedMasv = req.session.user.role === 'Sinhvien'
            ? req.params.masv
            : req.session.user.masv;
        const result = await executeStoredProc('SP_LayThongTinSV', {
            MASV: { type: sql.NVarChar(50), value: requestedMasv }
        }, getCredentials(req));
        res.json({ success: true, data: result.recordset[0] || null });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST thêm SV
router.post('/api/sinhvien', requireRole('PGV'), async (req, res) => {
    try {
        const { masv, ho, ten, ngaysinh, diachi, malop } = req.body;

        const existing = await executeStoredProc('SP_LayThongTinSV', {
            MASV: { type: sql.NVarChar(50), value: masv }
        }, getCredentials(req));
        const existedSV = existing.recordset?.[0];
        if (existedSV) {
            const oldMalop = (existedSV.MALOP || '').trim();
            const oldTenLop = (existedSV.TENLOP || '').trim();
            return res.status(409).json({
                success: false,
                message: `Mã sinh viên ${masv} đã tồn tại ở lớp ${oldTenLop ? ` ${oldTenLop}` : ''}. Vui lòng vào lớp đó để xóa hoặc hiệu chỉnh.`
            });
        }

        const result = await executeStoredProc('SP_ThemSinhVien', {
            MASV: { type: sql.NVarChar(50), value: masv },
            HO: { type: sql.NVarChar(40), value: ho },
            TEN: { type: sql.NVarChar(10), value: ten },
            NGAYSINH: { type: sql.Date, value: ngaysinh },
            DIACHI: { type: sql.NVarChar(100), value: diachi },
            MALOP: { type: sql.NVarChar(50), value: malop }
        }, getCredentials(req));
        res.json({ success: true, message: result.recordset[0]?.ThongBao });
    } catch (err) {
        if ((err.message || '').includes('Mã sinh viên đã tồn tại')) {
            return res.status(409).json({
                success: false,
                message: 'Mã sinh viên đã tồn tại ở một lớp khác. Vui lòng tìm mã sinh viên để xác định lớp đang chứa sinh viên đó.'
            });
        }
        res.status(500).json({ success: false, message: err.message });
    }
});

// PUT sửa SV
router.put('/api/sinhvien/:masv', requireRole('PGV'), async (req, res) => {
    try {
        const { ho, ten, ngaysinh, diachi, malop, trangThai } = req.body;
        const result = await executeStoredProc('SP_SuaSinhVien', {
            MASV: { type: sql.NVarChar(50), value: req.params.masv },
            HO: { type: sql.NVarChar(40), value: ho },
            TEN: { type: sql.NVarChar(10), value: ten },
            NGAYSINH: { type: sql.Date, value: ngaysinh },
            DIACHI: { type: sql.NVarChar(100), value: diachi },
            MALOP: { type: sql.NVarChar(50), value: malop },
            TRANG_THAI: { type: sql.NVarChar(20), value: trangThai || null }
        }, getCredentials(req));
        res.json({ success: true, message: result.recordset[0]?.ThongBao });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// DELETE xóa SV
router.delete('/api/sinhvien/:masv', requireRole('PGV'), async (req, res) => {
    try {
        const result = await executeStoredProc('SP_XoaSinhVien', {
            MASV: { type: sql.NVarChar(50), value: req.params.masv }
        }, getCredentials(req));
        res.json({ success: true, message: result.recordset[0]?.ThongBao });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
