const express = require('express');
const router = express.Router();
const { executeStoredProc, sql } = require('../db');
const { requireLogin, requireRole, getCredentials } = require('../middleware/auth');

// GET xem bài thi
router.get('/api/ketqua/baithi', requireLogin, async (req, res) => {
    try {
        const { masv, mamh, lan } = req.query;
        const result = await executeStoredProc('SP_XemBaiThi', {
            MASV: { type: sql.NVarChar(50), value: masv },
            MAMH: { type: sql.NVarChar(50), value: mamh },
            LAN: { type: sql.SmallInt, value: parseInt(lan) }
        }, getCredentials(req));
        res.json({
            success: true,
            data: result.recordsets[1] || [],
            details: result.recordsets[0] || []
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET xem bảng điểm lớp
router.get('/api/ketqua/bangdiem', requireRole('PGV', 'Giangvien'), async (req, res) => {
    try {
        const { malop, mamh, lan } = req.query;
        const result = await executeStoredProc('SP_XemBangDiem', {
            MALOP: { type: sql.NVarChar(50), value: malop },
            MAMH: { type: sql.NVarChar(50), value: mamh },
            LAN: { type: sql.SmallInt, value: parseInt(lan) }
        }, getCredentials(req));
        res.json({ success: true, data: result.recordsets[1] || [] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
