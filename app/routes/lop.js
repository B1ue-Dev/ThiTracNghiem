const express = require('express');
const router = express.Router();
const { executeStoredProc, sql } = require('../db');
const { requireLogin, requireRole, getCredentials } = require('../middleware/auth');

// GET danh sách lớp
router.get('/api/lop', requireLogin, async (req, res) => {
    try {
        const result = await executeStoredProc('SP_LayDanhSachLop', {}, getCredentials(req));
        res.json({ success: true, data: result.recordset });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST thêm lớp
router.post('/api/lop', requireRole('PGV'), async (req, res) => {
    try {
        const { malop, tenlop } = req.body;
        const result = await executeStoredProc('SP_ThemLop', {
            MALOP: { type: sql.NVarChar(50), value: malop },
            TENLOP: { type: sql.NVarChar(40), value: tenlop }
        }, getCredentials(req));
        res.json({ success: true, message: result.recordset?.[1]?.ThongBao });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// PUT sửa lớp
router.put('/api/lop/:malop', requireRole('PGV'), async (req, res) => {
    try {
        const result = await executeStoredProc('SP_SuaLop', {
            MALOP: { type: sql.NVarChar(50), value: req.params.malop },
            TENLOP: { type: sql.NVarChar(40), value: req.body.tenlop }
        }, getCredentials(req));
        res.json({ success: true, message: result.recordset[0]?.ThongBao });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// DELETE xóa lớp
router.delete('/api/lop/:malop', requireRole('PGV'), async (req, res) => {
    try {
        const result = await executeStoredProc('SP_XoaLop', {
            MALOP: { type: sql.NVarChar(50), value: req.params.malop }
        }, getCredentials(req));
        res.json({ success: true, message: result.recordset[0]?.ThongBao });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
