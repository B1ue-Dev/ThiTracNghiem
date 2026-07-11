const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { executeStoredProc, sql } = require('../db');
const { requireRole, getCredentials } = require('../middleware/auth');
const { getReporter } = require('../jsreport-service');

router.get('/bangdiem/:format', requireRole('PGV', 'Giangvien'), async (req, res) => {
    try {
        const { malop, mamh, lan } = req.query;
        const format = req.params.format.toLowerCase();

        if (!malop || !mamh || !lan) {
            return res.status(400).send('Thiếu tham số bắt buộc: malop, mamh, lan');
        }

        // Fetch Data
        const dbReq = await executeStoredProc('SP_XemBangDiem', {
            MALOP: { type: sql.NChar(15), value: malop },
            MAMH: { type: sql.NChar(5), value: mamh },
            LAN: { type: sql.SmallInt, value: parseInt(lan) }
        }, getCredentials(req));

        const students = dbReq.recordset;

        // Format Data
        const soThanhChu = (num) => {
            if (num == null) return '';
            const digits = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
            const str = String(num);
            const parts = str.split('.');
            let result = '';

            const intPart = parts[0];
            if (intPart.length === 2) {
                const chuc = parseInt(intPart[0], 10);
                const donvi = parseInt(intPart[1], 10);
                if (chuc === 1) {
                    result = 'mười';
                } else {
                    result = digits[chuc] + ' mươi';
                }
                if (donvi > 0) {
                    if (donvi === 1) result += ' mốt';
                    else if (donvi === 5) result += ' lăm';
                    else result += ' ' + digits[donvi];
                }
            } else {
                result = digits[parseInt(intPart, 10)] || '';
            }

            if (parts[1]) {
                result += ' chấm';
                for (const c of parts[1]) {
                    result += ' ' + digits[parseInt(c, 10)];
                }
            }

            return result;
        };

        const formattedStudents = students.map((s, index) => ({
            STT: index + 1,
            MASV: s.MASV ? s.MASV.trim() : '',
            HO: s.HO ? s.HO.trim() : '',
            TEN: s.TEN ? s.TEN.trim() : '',
            DIEM: s.DIEM != null ? s.DIEM : 'Chưa thi',
            DIEM_CHU: s.DIEM != null ? soThanhChu(s.DIEM) : ''
        }));

        // Fetch Metadata (class name, subject name) for the header
        const lopRes = await executeStoredProc('SP_LayDanhSachLop', {}, getCredentials(req));
        const mhRes = await executeStoredProc('SP_LayDanhSachMonHoc', {}, getCredentials(req));

        const lop = lopRes.recordset.find(l => (l.MALOP || '').trim() === malop.trim());
        const mh = mhRes.recordset.find(m => (m.MAMH || '').trim() === mamh.trim());

        const tenLop = lop ? (lop.TENLOP || '').trim() : malop;
        const tenMH = mh ? (mh.TENMH || '').trim() : mamh;

        const reportData = {
            tenLop: tenLop,
            tenMH: tenMH,
            lanThi: lan,
            ngayIn: new Date().toLocaleDateString('vi-VN'),
            students: formattedStudents
        };

        const templateHtml = fs.readFileSync(path.join(__dirname, '../views/bangdiem.html'), 'utf8');
        const reporter = getReporter();

        const getRecipeForFormat = (fmt) => {
            if (fmt === 'pdf') return 'chrome-pdf';
            if (fmt === 'xlsx' || fmt === 'xls') return 'html-to-xlsx';
            if (fmt === 'csv' || fmt === 'txt') return 'text';
            return 'html';
        };

        const filename = `BangDiem_${malop}_${mamh}_Lan${lan}.${format}`;

        if (format === 'preview') {
            const report = await reporter.render({
                template: {
                    content: templateHtml,
                    engine: 'handlebars',
                    recipe: 'html'
                },
                data: reportData
            });
            res.setHeader('Content-Type', 'text/html');
            res.send(report.content.toString('utf8'));
            return;
        }

        if (format === 'html' || format === 'mht') {
            const report = await reporter.render({
                template: {
                    content: templateHtml,
                    engine: 'handlebars',
                    recipe: 'html'
                },
                data: reportData
            });
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.send(report.content.toString('utf8'));
            return;
        }

        if (format === 'pdf' || format === 'xlsx' || format === 'xls') {
            const report = await reporter.render({
                template: {
                    content: templateHtml,
                    engine: 'handlebars',
                    recipe: getRecipeForFormat(format),
                    chrome: {
                        marginTop: '20mm',
                        marginBottom: '20mm',
                        marginLeft: '15mm',
                        marginRight: '15mm'
                    }
                },
                data: reportData
            });
            res.setHeader('Content-Type', report.meta.contentType);
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.send(report.content);
            return;
        }

        if (format === 'csv' || format === 'txt') {
            // Simple CSV generation without template for better data formatting
            let csv = 'STT,Mã SV,Họ,Tên,Điểm,Điểm chữ\n';
            formattedStudents.forEach(s => {
                csv += `${s.STT},${s.MASV},"${s.HO}",${s.TEN},${s.DIEM},${s.DIEM_CHU}\n`;
            });

            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.send(Buffer.from('\ufeff' + csv, 'utf8')); // UTF-8 BOM
            return;
        }

        if (format === 'rtf' || format === 'doc') {
            // Basic fallback as JSReport doc recipe requires a doc template
            res.setHeader('Content-Type', 'application/msword');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

            // Export HTML as Word document (Word can parse basic HTML)
            const report = await reporter.render({
                template: { content: templateHtml, engine: 'handlebars', recipe: 'html' },
                data: reportData
            });

            res.send(`
                <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
                <head><meta charset="utf-8"><title>Bảng Điểm</title></head>
                <body>${report.content.toString('utf8')}</body></html>
            `);
            return;
        }

        res.status(400).send('Định dạng không được hỗ trợ!');

    } catch (error) {
        console.error("Export Error:", error);
        res.status(500).send("Lỗi xuất file: " + error.message);
    }
});

// GET các môn học mà lớp đã thi
router.get('/lop-monhoc', requireRole('PGV', 'Giangvien'), async (req, res) => {
    try {
        const { malop } = req.query;
        if (!malop) {
            return res.status(400).json({ success: false, message: 'Thiếu tham số malop' });
        }
        const result = await executeStoredProc('SP_LayMonHocDaThiCuaLop', {
            MALOP: { type: sql.NChar(15), value: malop }
        }, getCredentials(req));
        res.json({ success: true, data: result.recordset });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET các lần thi mà lớp và môn đã thi
router.get('/lop-monhoc-lan', requireRole('PGV', 'Giangvien'), async (req, res) => {
    try {
        const { malop, mamh } = req.query;
        if (!malop || !mamh) {
            return res.status(400).json({ success: false, message: 'Thiếu tham số malop hoặc mamh' });
        }
        const result = await executeStoredProc('SP_LayLanThiDaThiCuaLopMon', {
            MALOP: { type: sql.NChar(15), value: malop },
            MAMH: { type: sql.NChar(5), value: mamh }
        }, getCredentials(req));
        res.json({ success: true, data: result.recordset });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET lịch sử thi (môn + lần thi) của sinh viên
router.get('/sv-lichsuthi', requireRole('PGV', 'Giangvien', 'Sinhvien'), async (req, res) => {
    try {
        const { masv } = req.query;
        if (!masv) {
            return res.status(400).json({ success: false, message: 'Thiếu tham số masv' });
        }
        const result = await executeStoredProc('SP_LayMonHocVaLanThiDaThiCuaSV', {
            MASV: { type: sql.NChar(8), value: masv }
        }, getCredentials(req));
        res.json({ success: true, data: result.recordset });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
