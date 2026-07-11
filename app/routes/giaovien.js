const express = require('express');
const router = express.Router();
const { executeStoredProc, sql } = require('../db');
const { requireRole, getCredentials } = require('../middleware/auth');

// GET danh sách giáo viên
router.get('/api/giaovien', requireRole('PGV', 'Giangvien'), async (req, res) => {
    try {
        const result = await executeStoredProc('SP_LayDanhSachGV', {}, getCredentials(req));
        res.json({ success: true, data: result.recordsets?.[1] || [] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET tìm giáo viên
router.get('/api/giaovien/tim', requireRole('PGV'), async (req, res) => {
    try {
        const result = await executeStoredProc('SP_TimGiaoVien', {
            Keyword: { type: sql.NVarChar(50), value: req.query.keyword || '' }
        }, getCredentials(req));
        res.json({ success: true, data: result.recordset });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST thêm giáo viên
router.post('/api/giaovien', requireRole('PGV'), async (req, res) => {
    try {
        const { magv, ho, ten, sodtll, diachi } = req.body;
        const result = await executeStoredProc('SP_ThemGiaoVien', {
            MAGV: { type: sql.NVarChar(50), value: magv },
            HO: { type: sql.NVarChar(40), value: ho },
            TEN: { type: sql.NVarChar(10), value: ten },
            SODTLL: { type: sql.NVarChar(50), value: sodtll || '' },
            DIACHI: { type: sql.NVarChar(50), value: diachi || '' }
        }, getCredentials(req));
        res.json({ success: true, message: result.recordset[0]?.ThongBao });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// PUT sửa giáo viên
router.put('/api/giaovien/:magv', requireRole('PGV'), async (req, res) => {
    try {
        const { ho, ten, sodtll, diachi, trangThai } = req.body;
        const result = await executeStoredProc('SP_SuaGiaoVien', {
            MAGV: { type: sql.NVarChar(50), value: req.params.magv },
            HO: { type: sql.NVarChar(40), value: ho },
            TEN: { type: sql.NVarChar(10), value: ten },
            SODTLL: { type: sql.NVarChar(50), value: sodtll || '' },
            DIACHI: { type: sql.NVarChar(50), value: diachi || '' },
            TRANG_THAI: { type: sql.NVarChar(20), value: trangThai || null }
        }, getCredentials(req));
        res.json({ success: true, message: result.recordset[0]?.ThongBao });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// DELETE xóa giáo viên
router.delete('/api/giaovien/:magv', requireRole('PGV'), async (req, res) => {
    try {
        const result = await executeStoredProc('SP_XoaGiaoVien', {
            MAGV: { type: sql.NVarChar(50), value: req.params.magv }
        }, getCredentials(req));
        res.json({ success: true, message: result.recordset[0]?.ThongBao });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
