const express = require('express');
const router = express.Router();
const { executeStoredProc, sql } = require('../db');
const { requireLogin, requireRole, getCredentials } = require('../middleware/auth');

// GET câu hỏi theo Giáo viên
router.get('/api/cauhoi/gv/:magv', requireRole('PGV', 'Giangvien'), async (req, res) => {
    try {
        // Giangvien chỉ được xem câu hỏi của mình
        let magv = req.params.magv;
        if (req.session.user.role === 'Giangvien') {
            magv = req.session.user.magv;
        }
        const result = await executeStoredProc('SP_LayCauHoiTheoGV', {
            MAGV: { type: sql.NVarChar(50), value: magv }
        }, getCredentials(req));
        res.json({ success: true, data: result.recordset });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET câu hỏi theo Môn học
router.get('/api/cauhoi/mh/:mamh', requireRole('PGV', 'Giangvien'), async (req, res) => {
    try {
        const role = req.session.user.role;

        if (role === 'Giangvien') {
            // Giangvien: chỉ được xem câu hỏi do chính mình tạo
            const magv = (req.session.user.magv || '').trim().toUpperCase();
            if (!magv) {
                return res.json({ success: true, data: [] });
            }

            const result = await executeStoredProc('SP_LayCauHoiTheoMH', {
                MAMH: { type: sql.NVarChar(50), value: req.params.mamh },
                TRINHDO: { type: sql.NVarChar(10), value: req.query.trinhdo || null }
            }, getCredentials(req));

            // Lọc chỉ giữ câu hỏi của GV này
            const filtered = (result.recordset || []).filter(row =>
                row.MAGV && row.MAGV.trim().toUpperCase() === magv
            );
            res.json({ success: true, data: filtered });
        } else {
            // PGV: xem tất cả
            const result = await executeStoredProc('SP_LayCauHoiTheoMH', {
                MAMH: { type: sql.NVarChar(50), value: req.params.mamh },
                TRINHDO: { type: sql.NVarChar(10), value: req.query.trinhdo || null }
            }, getCredentials(req));
            res.json({ success: true, data: result.recordset });
        }
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST thêm câu hỏi
router.post('/api/cauhoi', requireRole('PGV', 'Giangvien'), async (req, res) => {
    try {
        const { mamh, trinhdo, noidung, a, b, c, d, dap_an, magv } = req.body;

        // Giangvien: bắt buộc MAGV là chính mình
        let actualMagv = magv;
        if (req.session.user.role === 'Giangvien') {
            actualMagv = req.session.user.magv;
        }

        // Kiểm tra A đến D không được trùng nhau
        const options = [a, b, c, d];
        const uniqueOptions = new Set(options);
        if (uniqueOptions.size < 4) {
            return res.status(400).json({ success: false, message: 'Các phương án A, B, C, D phải khác nhau!' });
        }

        const result = await executeStoredProc('SP_ThemCauHoi', {
            MAMH: { type: sql.NVarChar(50), value: mamh },
            TRINHDO: { type: sql.NVarChar(10), value: trinhdo },
            NOIDUNG: { type: sql.NVarChar(200), value: noidung },
            A: { type: sql.NVarChar(50), value: a },
            B: { type: sql.NVarChar(50), value: b },
            C: { type: sql.NVarChar(50), value: c },
            D: { type: sql.NVarChar(50), value: d },
            DAP_AN: { type: sql.NVarChar(10), value: dap_an },
            MAGV: { type: sql.NVarChar(50), value: actualMagv }
        }, getCredentials(req));
        res.json({ success: true, message: result.recordset[0]?.ThongBao, cauhoi: result.recordset[0]?.CAUHOI });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// PUT sửa câu hỏi
router.put('/api/cauhoi/:cauhoi', requireRole('PGV', 'Giangvien'), async (req, res) => {
    try {
        // Giangvien: kiểm tra câu hỏi có phải của mình không
        if (req.session.user.role === 'Giangvien') {
            const check = await executeStoredProc('SP_LayCauHoiTheoGV', {
                MAGV: { type: sql.NVarChar(50), value: req.session.user.magv }
            }, getCredentials(req));
            const owns = (check.recordset || []).some(r => r.CAUHOI === parseInt(req.params.cauhoi));
            if (!owns) {
                return res.status(403).json({ success: false, message: 'Bạn không có quyền sửa câu hỏi này! Chỉ được sửa câu hỏi do mình soạn.' });
            }
        }

        const { mamh, trinhdo, noidung, a, b, c, d, dap_an } = req.body;
        const result = await executeStoredProc('SP_SuaCauHoi', {
            CAUHOI: { type: sql.Int, value: parseInt(req.params.cauhoi) },
            MAMH: { type: sql.NVarChar(50), value: mamh },
            TRINHDO: { type: sql.NVarChar(10), value: trinhdo },
            NOIDUNG: { type: sql.NVarChar(200), value: noidung },
            A: { type: sql.NVarChar(50), value: a },
            B: { type: sql.NVarChar(50), value: b },
            C: { type: sql.NVarChar(50), value: c },
            D: { type: sql.NVarChar(50), value: d },
            DAP_AN: { type: sql.NVarChar(10), value: dap_an }
        }, getCredentials(req));
        res.json({ success: true, message: result.recordset[0]?.ThongBao });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// DELETE xóa câu hỏi
router.delete('/api/cauhoi/:cauhoi', requireRole('PGV', 'Giangvien'), async (req, res) => {
    try {
        // Giangvien: kiểm tra câu hỏi có phải của mình không
        if (req.session.user.role === 'Giangvien') {
            const check = await executeStoredProc('SP_LayCauHoiTheoGV', {
                MAGV: { type: sql.NVarChar(50), value: req.session.user.magv }
            }, getCredentials(req));
            const owns = (check.recordset || []).some(r => r.CAUHOI === parseInt(req.params.cauhoi));
            if (!owns) {
                return res.status(403).json({ success: false, message: 'Bạn không có quyền xóa câu hỏi này! Chỉ được xóa câu hỏi do mình soạn.' });
            }
        }

        const result = await executeStoredProc('SP_XoaCauHoi', {
            CAUHOI: { type: sql.Int, value: parseInt(req.params.cauhoi) }
        }, getCredentials(req));
        res.json({ success: true, message: result.recordset[0]?.ThongBao });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
