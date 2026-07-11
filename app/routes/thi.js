const express = require('express');
const router = express.Router();
const { executeStoredProc, sql } = require('../db');
const { requireLogin, requireRole, getCredentials } = require('../middleware/auth');

// POST đăng ký thi (Giáo viên / PGV)
router.post('/api/dangkythi', requireRole('PGV', 'Giangvien'), async (req, res) => {
    try {
        const { magv, malop, mamh, trinhdo, ngaythi, lan, socauthi, thoigian } = req.body;

        const normalizedMagv = String(magv || '').trim();
        const normalizedMalop = String(malop || '').trim();
        const normalizedMamh = String(mamh || '').trim();
        const normalizedTrinhdo = String(trinhdo || '').trim();
        const normalizedLan = parseInt(lan, 10);
        const normalizedSocau = parseInt(socauthi, 10);
        const normalizedThoigian = parseInt(thoigian, 10);
        const normalizedNgaythi = ngaythi ? new Date(ngaythi) : null;

        if (!normalizedMagv || !normalizedMalop || !normalizedMamh || !normalizedTrinhdo) {
            return res.status(400).json({ success: false, message: 'Thiếu thông tin đăng ký thi (giáo viên/lớp/môn/trình độ).' });
        }
        if (!normalizedNgaythi || Number.isNaN(normalizedNgaythi.getTime())) {
            return res.status(400).json({ success: false, message: 'Ngày thi không hợp lệ.' });
        }
        if (!Number.isInteger(normalizedLan) || !Number.isInteger(normalizedSocau) || !Number.isInteger(normalizedThoigian)) {
            return res.status(400).json({ success: false, message: 'Lần thi, số câu thi, thời gian phải là số hợp lệ.' });
        }

        const result = await executeStoredProc('SP_DangKyThi', {
            MAGV: { type: sql.NVarChar(50), value: normalizedMagv },
            MALOP: { type: sql.NVarChar(50), value: normalizedMalop },
            MAMH: { type: sql.NVarChar(50), value: normalizedMamh },
            TRINHDO: { type: sql.NVarChar(10), value: normalizedTrinhdo },
            NGAYTHI: { type: sql.DateTime, value: normalizedNgaythi },
            LAN: { type: sql.SmallInt, value: normalizedLan },
            SOCAUTHI: { type: sql.SmallInt, value: normalizedSocau },
            THOIGIAN: { type: sql.SmallInt, value: normalizedThoigian }
        }, getCredentials(req));
        res.json({ success: true, message: result.recordset[0]?.ThongBao });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET xem đăng ký thi
router.get('/api/dangkythi', requireLogin, async (req, res) => {
    try {
        const { malop, mamh } = req.query;
        const role = req.session?.user?.role;
        const magv = role === 'Giangvien' ? (req.session.user.magv || '').trim() : null;
        const result = await executeStoredProc('SP_XemDangKyThi', {
            MALOP: { type: sql.NVarChar(50), value: malop || null },
            MAMH: { type: sql.NVarChar(50), value: mamh || null },
            MAGV: { type: sql.NVarChar(50), value: magv || null }
        }, getCredentials(req));
        res.json({ success: true, data: result.recordset });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST xóa đăng ký thi
router.post('/api/dangkythi/xoa', requireRole('PGV', 'Giangvien'), async (req, res) => {
    try {
        const { malop, mamh, lan } = req.body;
        const normalizedMalop = String(malop || '').trim();
        const normalizedMamh = String(mamh || '').trim();
        const normalizedLan = parseInt(lan, 10);

        if (!normalizedMalop || !normalizedMamh || !Number.isInteger(normalizedLan)) {
            return res.status(400).json({ success: false, message: 'Thiếu thông tin xóa đăng ký thi.' });
        }

        const role = req.session?.user?.role;
        const magv = role === 'Giangvien' ? (req.session.user.magv || '').trim() : null;

        const result = await executeStoredProc('SP_XoaDangKyThi', {
            MALOP: { type: sql.NVarChar(50), value: normalizedMalop },
            MAMH: { type: sql.NVarChar(50), value: normalizedMamh },
            LAN: { type: sql.SmallInt, value: normalizedLan },
            MAGV: { type: sql.NVarChar(50), value: magv || null }
        }, getCredentials(req));

        res.json({ success: true, message: result.recordset[0]?.ThongBao || 'Đã xóa!' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST sửa đăng ký thi (Giáo viên / PGV)
router.post('/api/dangkythi/sua', requireRole('PGV', 'Giangvien'), async (req, res) => {
    try {
        const { malop, mamh, oldLan, trinhdo, ngaythi, lan, socauthi, thoigian } = req.body;

        const normalizedMalop = String(malop || '').trim();
        const normalizedMamh = String(mamh || '').trim();
        const normalizedOldLan = parseInt(oldLan, 10);
        const normalizedTrinhdo = String(trinhdo || '').trim();
        const normalizedLan = parseInt(lan, 10);
        const normalizedSocau = parseInt(socauthi, 10);
        const normalizedThoigian = parseInt(thoigian, 10);
        const normalizedNgaythi = ngaythi ? new Date(ngaythi) : null;

        if (!normalizedMalop || !normalizedMamh || !Number.isInteger(normalizedOldLan) || !normalizedTrinhdo) {
            return res.status(400).json({ success: false, message: 'Thiếu thông tin cập nhật đăng ký thi.' });
        }
        if (!normalizedNgaythi || Number.isNaN(normalizedNgaythi.getTime())) {
            return res.status(400).json({ success: false, message: 'Ngày thi không hợp lệ.' });
        }
        if (!Number.isInteger(normalizedLan) || !Number.isInteger(normalizedSocau) || !Number.isInteger(normalizedThoigian)) {
            return res.status(400).json({ success: false, message: 'Lần thi, số câu thi, thời gian phải là số hợp lệ.' });
        }

        const role = req.session?.user?.role;
        const magv = role === 'Giangvien' ? (req.session.user.magv || '').trim() : null;

        const result = await executeStoredProc('SP_SuaDangKy', {
            MALOP: { type: sql.NVarChar(50), value: normalizedMalop },
            MAMH: { type: sql.NVarChar(50), value: normalizedMamh },
            oldLAN: { type: sql.SmallInt, value: normalizedOldLan },
            TRINHDO: { type: sql.NVarChar(10), value: normalizedTrinhdo },
            NGAYTHI: { type: sql.DateTime, value: normalizedNgaythi },
            LAN: { type: sql.SmallInt, value: normalizedLan },
            SOCAUTHI: { type: sql.SmallInt, value: normalizedSocau },
            THOIGIAN: { type: sql.SmallInt, value: normalizedThoigian },
            MAGV: { type: sql.NVarChar(50), value: magv || null }
        }, getCredentials(req));

        res.json({ success: true, message: result.recordset[0]?.ThongBao || 'Cập nhật thành công!' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET lấy đăng ký thi cho SV (theo MASV)
router.get('/api/dangkythi/sv/:masv', requireLogin, async (req, res) => {
    try {
        const result = await executeStoredProc('SP_LayDangKyThiChoSV', {
            MASV: { type: sql.NVarChar(50), value: req.params.masv }
        }, getCredentials(req));
        res.json({ success: true, data: result.recordset });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST lấy đề thi ngẫu nhiên
router.post('/api/thi/lay-de', requireLogin, async (req, res) => {
    try {
        const { mamh, malop, lan, masv } = req.body;
        const result = await executeStoredProc('SP_LayDeCauHoiNgauNhien', {
            MAMH: { type: sql.NVarChar(50), value: mamh },
            MALOP: { type: sql.NVarChar(50), value: malop },
            LAN: { type: sql.SmallInt, value: parseInt(lan) },
            MASV: { type: sql.NVarChar(50), value: masv }
        }, getCredentials(req));

        // recordsets[0] = danh sách câu hỏi, recordsets[1] = thông tin thi (THOIGIAN, SOCAUTHI, TRINHDO)
        res.json({
            success: true,
            questions: result.recordsets[0],
            examInfo: result.recordsets[1] ? result.recordsets[1][0] : null
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST nộp bài thi
router.post('/api/thi/nop-bai', requireLogin, async (req, res) => {
    try {
        const { masv, mamh, lan, answers } = req.body;
        if (!Array.isArray(answers)) {
            return res.status(400).json({ success: false, message: 'Danh sách câu trả lời không hợp lệ.' });
        }

        // Xây dựng XML từ mảng answers: [{CAUHOI: 1, TRALOI: 'A', STT: 1}, ...]
        let xml = '<TraLoi>';
        for (const a of answers) {
            xml += `<Row CAUHOI="${a.CAUHOI}" TRALOI="${a.TRALOI}" STT="${a.STT || 1}"/>`;
        }
        xml += '</TraLoi>';

        const result = await executeStoredProc('SP_NopBai', {
            MASV: { type: sql.NVarChar(50), value: masv },
            MAMH: { type: sql.NVarChar(50), value: mamh },
            LAN: { type: sql.SmallInt, value: parseInt(lan) },
            DanhSachTraLoi: { type: sql.Xml, value: xml }
        }, getCredentials(req));

        // recordsets[0] = chi tiết từng câu, recordsets[1] = tổng điểm
        res.json({
            success: true,
            details: result.recordsets[0],
            summary: result.recordsets[1] ? result.recordsets[1][0] : null
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST lấy đề thi thử (Giảng viên/PGV)
router.post('/api/thi-thu/lay-de', requireRole('PGV', 'Giangvien'), async (req, res) => {
    try {
        const { mamh, malop, lan } = req.body;
        const normalizedMamh = String(mamh || '').trim();
        const normalizedMalop = String(malop || '').trim();
        const normalizedLan = parseInt(lan, 10);

        if (!normalizedMamh || !normalizedMalop || !Number.isInteger(normalizedLan)) {
            return res.status(400).json({ success: false, message: 'Thiếu thông tin lấy đề thi thử.' });
        }

        const result = await executeStoredProc('SP_LayDeCauHoiNgauNhien_ThiThu', {
            MAMH: { type: sql.NVarChar(50), value: normalizedMamh },
            MALOP: { type: sql.NVarChar(50), value: normalizedMalop },
            LAN: { type: sql.SmallInt, value: normalizedLan }
        }, getCredentials(req));

        res.json({
            success: true,
            questions: result.recordsets[0] || [],
            examInfo: result.recordsets[1] ? result.recordsets[1][0] : null
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST cập nhật câu trả lời tạm thời
router.post('/api/thi/cap-nhat-dap-an', requireLogin, async (req, res) => {
    try {
        const { masv, mamh, lan, cauhoi, traloi } = req.body;
        const result = await executeStoredProc('SP_CapNhatDapAnTam', {
            MASV: { type: sql.NVarChar(50), value: masv },
            MAMH: { type: sql.NVarChar(50), value: mamh },
            LAN: { type: sql.SmallInt, value: parseInt(lan) },
            CAUHOI: { type: sql.Int, value: parseInt(cauhoi) },
            TRALOI: { type: sql.NChar(1), value: traloi || null }
        }, getCredentials(req));

        res.json({ success: true, message: result.recordset[0]?.ThongBao || 'Thành công!' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST kiểm tra bài thi dở khi đăng nhập/tải trang
router.post('/api/thi/kiem-tra-dang-do', requireLogin, async (req, res) => {
    try {
        const masv = req.session.user.masv;
        if (!masv) {
            return res.json({ success: true, data: { HasPending: 0 } });
        }

        const result = await executeStoredProc('SP_KiemTraBaiThiDangDo', {
            MASV: { type: sql.NVarChar(50), value: masv }
        }, getCredentials(req));

        res.json({ success: true, data: result.recordset[0] || { HasPending: 0 } });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST cập nhật thời gian còn lại (Heartbeat 30s)
router.post('/api/thi/heartbeat', requireLogin, async (req, res) => {
    try {
        const { masv, mamh, lan, timeLeft } = req.body;
        const normalizedMasv = String(masv || '').trim();
        const normalizedMamh = String(mamh || '').trim();
        const normalizedLan = parseInt(lan, 10);
        const normalizedTimeLeft = parseInt(timeLeft, 10);

        if (!normalizedMasv || !normalizedMamh || Number.isNaN(normalizedLan) || Number.isNaN(normalizedTimeLeft)) {
            return res.status(400).json({ success: false, message: 'Thiếu thông tin heartbeat (MASV/MAMH/LAN/TimeLeft).' });
        }

        const result = await executeStoredProc('SP_CapNhatThoiGianConLai', {
            MASV: { type: sql.NVarChar(8), value: normalizedMasv },
            MAMH: { type: sql.NVarChar(5), value: normalizedMamh },
            LAN: { type: sql.SmallInt, value: normalizedLan },
            THOI_GIAN_CON_LAI: { type: sql.Int, value: normalizedTimeLeft }
        }, getCredentials(req));

        res.json({ success: true, message: result.recordset[0]?.ThongBao || 'Lưu heartbeat thành công!' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
