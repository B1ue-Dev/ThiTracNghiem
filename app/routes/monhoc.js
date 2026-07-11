const express = require('express');
const router = express.Router();
const { executeStoredProc, sql } = require('../db');
const { requireLogin, requireRole, getCredentials } = require('../middleware/auth');

// GET danh sách môn học
router.get('/api/monhoc', requireLogin, async (req, res) => {
    try {
        const result = await executeStoredProc('SP_LayDanhSachMonHoc', {}, getCredentials(req));
        res.json({ success: true, data: result.recordsets[1] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST thêm môn học
router.post('/api/monhoc', requireRole('PGV'), async (req, res) => {
    try {
        const { mamh, tenmh } = req.body;
        const result = await executeStoredProc('SP_ThemMonHoc', {
            MAMH: { type: sql.NVarChar(50), value: mamh },
            TENMH: { type: sql.NVarChar(40), value: tenmh }
        }, getCredentials(req));
        res.json({ success: true, message: result.recordset[0]?.ThongBao });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// PUT sửa môn học
router.put('/api/monhoc/:mamh', requireRole('PGV'), async (req, res) => {
    try {
        const result = await executeStoredProc('SP_SuaMonHoc', {
            MAMH: { type: sql.NVarChar(50), value: req.params.mamh },
            TENMH: { type: sql.NVarChar(40), value: req.body.tenmh }
        }, getCredentials(req));
        res.json({ success: true, message: result.recordset[0]?.ThongBao });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// DELETE xóa môn học
router.delete('/api/monhoc/:mamh', requireRole('PGV'), async (req, res) => {
    try {
        const result = await executeStoredProc('SP_XoaMonHoc', {
            MAMH: { type: sql.NVarChar(50), value: req.params.mamh }
        }, getCredentials(req));
        res.json({ success: true, message: result.recordset[0]?.ThongBao });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
