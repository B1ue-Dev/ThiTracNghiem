/**
 * EXAM MODULE — Xử lý chức năng thi trắc nghiệm
 */
const Exam = {
    timer: null,
    heartbeatInterval: null,
    timeLeft: 0,
    questions: [],
    answers: {},
    currentQuestionId: null,
    examInfo: null,
    masv: null,
    mamh: null,
    lan: null,
    tenmh: null,
    examMode: 'real',

    setExamOnlyMode(enabled) {
        document.body.classList.toggle('exam-only-mode', !!enabled);
    },

    // ================================
    // TRANG CHỌN MÔN THI (SV)
    // ================================
    async showExamSetup() {
        this.examMode = 'real';
        this.setExamOnlyMode(false);
        UI.setTitle('Thi Trắc Nghiệm');
        UI.showLoading();

        const masv = window.APP_MASV;
        if (!masv) {
            UI.showContent(`<div class="card"><p style="color:var(--danger)">Không tìm thấy mã sinh viên. Vui lòng đăng nhập lại.</p></div>`);
            return;
        }

        // Lấy thông tin SV
        const svRes = await API.getSVInfo(masv);
        const sv = svRes?.data;

        if (!sv) {
            UI.showContent(`<div class="card"><p style="color:var(--danger)">Không tìm thấy sinh viên với mã: ${masv}</p></div>`);
            return;
        }

        // Lấy danh sách đăng ký thi cho SV
        const dkRes = await API.getDangKyThiSV(masv);
        const dkList = dkRes?.data || [];

        let dkOptions = '';
        if (dkList.length === 0) {
            dkOptions = '<div class="empty-state"><p>Chưa có môn thi nào được đăng ký cho lớp của bạn.</p></div>';
        } else {
            dkOptions = '<div class="table-wrapper"><table><thead><tr><th></th><th>Môn học</th><th>Trình độ</th><th>Lần thi</th><th>Số câu</th><th>Thời gian</th><th>Ngày thi</th></tr></thead><tbody>';
            dkList.forEach((dk, i) => {
                dkOptions += `<tr>
                    <td><input type="radio" name="examSelect" value="${i}" id="exam_${i}" ${i === 0 ? 'checked' : ''}></td>
                    <td><label for="exam_${i}">${dk.TENMH?.trim()}</label></td>
                    <td>${dk.TRINHDO?.trim()}</td>
                    <td>${dk.LAN}</td>
                    <td>${dk.SOCAUTHI} câu</td>
                    <td>${dk.THOIGIAN} phút</td>
                    <td>${dk.NGAYTHI ? new Date(dk.NGAYTHI).toLocaleDateString('vi-VN') : ''}</td>
                </tr>`;
            });
            dkOptions += '</tbody></table></div>';
        }

        const html = `
        <div class="card">
            <div class="card-header"><h3>Thông tin Sinh viên</h3></div>
            <div class="form-grid">
                <div class="form-group"><label>Mã SV</label><input value="${sv.MASV?.trim()}" disabled></div>
                <div class="form-group"><label>Họ tên</label><input value="${sv.HO?.trim()} ${sv.TEN?.trim()}" disabled></div>
                <div class="form-group"><label>Lớp</label><input value="${sv.TENLOP?.trim()}" disabled></div>
                <div class="form-group"><label>Mã lớp</label><input value="${sv.MALOP?.trim()}" disabled></div>
            </div>
        </div>
        <div class="card">
            <div class="card-header"><h3>Chọn Môn thi</h3></div>
            ${dkOptions}
            ${dkList.length > 0 ? `
            <div class="form-actions">
                <button class="btn btn-primary" onclick="Exam.startExam()" style="font-size:16px;padding:12px 32px;">
                    Bắt đầu thi
                </button>
            </div>` : ''}
        </div>`;

        UI.showContent(html);

        // Lưu lại danh sách đăng ký để dùng khi bấm "Bắt đầu thi"
        window._dkList = dkList;
        window._svInfo = sv;
        this.masv = masv;
    },

    // ================================
    // TRANG CHỌN MÔN THI THỬ (GV/PGV)
    // ================================
    async showTrialSetup() {
        this.examMode = 'trial';
        this.setExamOnlyMode(false);
        UI.setTitle('Thi Thử');
        UI.showLoading();

        const role = window.APP_ROLE;
        if (role !== 'Giangvien' && role !== 'PGV') {
            UI.showContent('<div class="card"><p style="color:var(--danger)">Chỉ giảng viên/PGV mới được thi thử.</p></div>');
            return;
        }

        const dkRes = await API.getDangKyThi();
        const dkList = dkRes?.data || [];

        let dkOptions = '';
        if (dkList.length === 0) {
            dkOptions = '<div class="empty-state"><p>Chưa có đăng ký thi nào phù hợp để thi thử.</p></div>';
        } else {
            dkOptions = '<div class="table-wrapper"><table><thead><tr><th></th><th>Môn học</th><th>Lớp</th><th>Trình độ</th><th>Lần thi</th><th>Số câu</th><th>Thời gian</th><th>Ngày thi</th></tr></thead><tbody>';
            dkList.forEach((dk, i) => {
                dkOptions += `<tr>
                    <td><input type="radio" name="trialExamSelect" value="${i}" id="trial_exam_${i}" ${i === 0 ? 'checked' : ''}></td>
                    <td><label for="trial_exam_${i}">${dk.TENMH?.trim()}</label></td>
                    <td>${dk.MALOP?.trim()} - ${dk.TENLOP?.trim() || ''}</td>
                    <td>${dk.TRINHDO?.trim()}</td>
                    <td>${dk.LAN}</td>
                    <td>${dk.SOCAUTHI} câu</td>
                    <td>${dk.THOIGIAN} phút</td>
                    <td>${dk.NGAYTHI ? new Date(dk.NGAYTHI).toLocaleDateString('vi-VN') : ''}</td>
                </tr>`;
            });
            dkOptions += '</tbody></table></div>';
        }

        const hoTen = window.APP_HOTEN || window.APP_USERNAME || '';
        const html = `
        <div class="card">
            <div class="card-header"><h3>Thông tin người thi</h3></div>
            <div class="form-grid">
                <div class="form-group"><label>Họ tên</label><input value="${hoTen}" disabled></div>
                <div class="form-group"><label>Mã GV</label><input value="${window.APP_MAGV || ''}" disabled></div>
                <div class="form-group"><label>Vai trò</label><input value="${window.APP_ROLE}" disabled></div>
            </div>
        </div>
        <div class="card">
            <div class="card-header"><h3>Chọn đợt thi để thi thử</h3></div>
            ${dkOptions}
            ${dkList.length > 0 ? `
            <div class="form-actions">
                <button class="btn btn-primary" onclick="Exam.startTrialExam()" style="font-size:16px;padding:12px 32px;">
                    Bắt đầu thi thử
                </button>
            </div>` : ''}
        </div>`;

        UI.showContent(html);
        window._dkList = dkList;
    },

    // ================================
    // BẮT ĐẦU THI
    // ================================
    async startExam() {
        this.examMode = 'real';
        const selected = document.querySelector('input[name="examSelect"]:checked');
        if (!selected) return UI.toast('Chọn môn thi!', 'error');

        const dk = window._dkList[parseInt(selected.value)];
        this.mamh = dk.MAMH?.trim();
        this.tenmh = dk.TENMH?.trim() || this.mamh;
        this.lan = dk.LAN;

        UI.showLoading();

        // Gọi SP lấy đề ngẫu nhiên
        const res = await API.layDe({
            mamh: this.mamh,
            malop: dk.MALOP?.trim(),
            lan: this.lan,
            masv: this.masv
        });

        if (!res?.success) {
            UI.toast(res?.message || 'Lỗi lấy đề thi!', 'error');
            this.showExamSetup();
            return;
        }

        this.questions = res.questions || [];
        this.examInfo = res.examInfo;
        this.answers = {};
        this.questions.forEach(q => {
            if (q.TRALOI_SV) {
                this.answers[q.CAUHOI] = q.TRALOI_SV.trim();
            }
        });
        this.currentQuestionId = this.questions.length > 0 ? this.questions[0].CAUHOI : null;

        if (this.examInfo?.THOIGIAN_GIAY !== undefined) {
            this.timeLeft = this.examInfo.THOIGIAN_GIAY;
        } else {
            this.timeLeft = (this.examInfo?.THOIGIAN || 30) * 60;
        }

        if (this.examInfo?.IS_RESUMED) {
            UI.toast('Đã khôi phục bài thi đang làm dở!', 'info');
        }

        this.renderExam();
        this.startTimer();
    },

    async startTrialExam() {
        this.examMode = 'trial';
        const selected = document.querySelector('input[name="trialExamSelect"]:checked');
        if (!selected) return UI.toast('Chọn đợt thi để thi thử!', 'error');

        const dk = window._dkList[parseInt(selected.value, 10)];
        if (!dk) return UI.toast('Không tìm thấy thông tin đăng ký thi.', 'error');

        this.mamh = dk.MAMH?.trim();
        this.tenmh = dk.TENMH?.trim() || this.mamh;
        this.lan = dk.LAN;
        this.masv = window.APP_MAGV || window.APP_USERNAME;

        UI.showLoading();

        const res = await API.layDeThiThu({
            mamh: this.mamh,
            malop: dk.MALOP?.trim(),
            lan: this.lan
        });

        if (!res?.success) {
            UI.toast(res?.message || 'Lỗi lấy đề thi thử!', 'error');
            this.showTrialSetup();
            return;
        }

        this.questions = res.questions || [];
        this.examInfo = res.examInfo;
        this.answers = {};
        this.currentQuestionId = this.questions.length > 0 ? this.questions[0].CAUHOI : null;
        this.timeLeft = (this.examInfo?.THOIGIAN || 30) * 60;

        this.renderExam();
        this.startTimer();
    },

    // ================================
    // RENDER ĐỀ THI
    // ================================
    renderExam() {
        this.setExamOnlyMode(true);
        UI.setTitle(this.examMode === 'trial' ? 'Đang thi thử...' : 'Đang thi...');

        const isTrial = this.examMode === 'trial';
        const svInfo = window._svInfo || {};
        const hoTen = isTrial
            ? (window.APP_HOTEN || window.APP_USERNAME || '')
            : `${svInfo.HO?.trim() || ''} ${svInfo.TEN?.trim() || ''}`.trim();
        const maLop = isTrial ? '' : (svInfo.MALOP?.trim() || '');
        const tenLop = isTrial ? '' : (svInfo.TENLOP?.trim() || '');
        const idLabel = isTrial ? 'Mã GV' : 'Mã SV';
        const idValue = isTrial ? (window.APP_MAGV || window.APP_USERNAME || '') : (this.masv || '');

        let questionsHtml = '';
        this.questions.forEach((q, i) => {
            const num = i + 1;
            const selected = this.answers[q.CAUHOI] || '';
            questionsHtml += `
            <div class="question-card ${selected ? 'answered' : ''} ${this.currentQuestionId === q.CAUHOI ? 'active' : ''}" id="q_${q.CAUHOI}">
                <div>
                    <span class="question-number">${num}</span>
                    <span class="question-text">${q.NOIDUNG?.trim()}</span>
                </div>
                <div class="answer-options">
                    ${['A', 'B', 'C', 'D'].map(opt => `
                        <div class="answer-option ${selected === opt ? 'selected' : ''}"
                             onclick="Exam.selectAnswer(${q.CAUHOI}, '${opt}')">
                            <span class="answer-label">${opt}</span>
                            <span class="answer-text">${q[opt]?.trim() || ''}</span>
                        </div>
                    `).join('')}
                </div>
            </div>`;
        });

        const html = `
        <div class="exam-page">
        <div class="exam-floating-nav">
            <div class="exam-floating-header">
                <span>Thời gian: <strong id="examTimerFloating">${this.formatTime(this.timeLeft)}</strong></span>
            </div>
            <div class="exam-floating-student">
                <div><strong>${idLabel}:</strong> ${idValue}</div>
                <div><strong>Họ tên:</strong> ${hoTen}</div>
                ${isTrial ? '' : `<div><strong>Lớp:</strong> ${maLop}${tenLop ? ` - ${tenLop}` : ''}</div>`}
                <div><strong>Môn:</strong> ${this.tenmh || this.mamh || ''}</div>
            </div>
            <div class="question-palette" id="questionPalette">
                ${this.renderQuestionPalette()}
            </div>
            <div class="exam-palette-legend">
                <span class="legend-item"><span class="legend-box"></span> Chưa làm</span>
                <span class="legend-item"><span class="legend-box answered"></span> Đã làm</span>
            </div>
            <button class="btn exam-submit-btn" onclick="Exam.submitExam()">Nộp bài</button>
        </div>
        <div class="exam-main-column">
            <div class="exam-header">
                <div>
                    <strong>Số câu: ${this.questions.length}</strong> &nbsp;|&nbsp;
                    <span>Trình độ: ${this.examInfo?.TRINHDO || '?'}</span> &nbsp;|&nbsp;
                    <span>Đã trả lời: <span id="answeredCount">${Object.keys(this.answers).length}</span>/${this.questions.length}</span>
                </div>
            </div>
            ${questionsHtml}
        </div>
        </div>`;

        UI.showContent(html);
    },

    renderQuestionPalette() {
        return this.questions.map((q, i) => {
            const isAnswered = !!this.answers[q.CAUHOI];
            const isActive = this.currentQuestionId === q.CAUHOI;
            return `<button class="question-palette-item ${isAnswered ? 'answered' : ''} ${isActive ? 'active' : ''}" onclick="Exam.goToQuestion(${q.CAUHOI})">${i + 1}</button>`;
        }).join('');
    },

    updateQuestionPalette() {
        const palette = document.getElementById('questionPalette');
        if (palette) {
            palette.innerHTML = this.renderQuestionPalette();
        }
    },

    goToQuestion(cauhoi) {
        this.currentQuestionId = cauhoi;
        this.updateQuestionPalette();

        document.querySelectorAll('.question-card').forEach(el => el.classList.remove('active'));
        const card = document.getElementById(`q_${cauhoi}`);
        if (card) {
            card.classList.add('active');
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    },

    selectAnswer(cauhoi, option) {
        this.answers[cauhoi] = option;
        this.currentQuestionId = cauhoi;

        // Cập nhật UI
        const card = document.getElementById(`q_${cauhoi}`);
        if (card) {
            card.classList.add('answered');
            document.querySelectorAll('.question-card').forEach(el => el.classList.remove('active'));
            card.classList.add('active');
            card.querySelectorAll('.answer-option').forEach(el => el.classList.remove('selected'));
            card.querySelectorAll('.answer-option').forEach(el => {
                if (el.querySelector('.answer-label').textContent === option) {
                    el.classList.add('selected');
                }
            });
        }

        // Cập nhật counter
        const count = Object.keys(this.answers).length;
        const counter = document.getElementById('answeredCount');
        if (counter) counter.textContent = count;

        this.updateQuestionPalette();

        // Lưu câu trả lời tạm thời vào database nếu là thi thật
        if (this.examMode === 'real') {
            API.capNhatDapAnTam({
                masv: this.masv,
                mamh: this.mamh,
                lan: this.lan,
                cauhoi: cauhoi,
                traloi: option
            }).catch(err => {
                console.error('Lỗi lưu câu trả lời tạm thời:', err);
            });
        }
    },

    // ================================
    // TIMER
    // ================================
    startTimer() {
        this.startHeartbeat();
        this.timer = setInterval(() => {
            this.timeLeft -= 2;

            const timerFloatingEl = document.getElementById('examTimerFloating');
            if (timerFloatingEl) {
                timerFloatingEl.textContent = this.formatTime(this.timeLeft);

                const timerHeader = timerFloatingEl.closest('.exam-floating-header');
                if (timerHeader) {
                    timerHeader.classList.remove('warning', 'danger');
                    if (this.timeLeft <= 60) timerHeader.classList.add('danger');
                    else if (this.timeLeft <= 300) timerHeader.classList.add('warning');
                }
            }

            if (this.timeLeft <= 0) {
                clearInterval(this.timer);
                this.stopHeartbeat();
                UI.toast('Hết giờ! Tự động nộp bài...', 'info');
                this.submitExam();
            }
        }, 1000);
    },

    formatTime(seconds) {
        const m = Math.floor(Math.max(0, seconds) / 60);
        const s = Math.max(0, seconds) % 60;
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    },

    startHeartbeat() {
        this.stopHeartbeat();
        if (this.examMode === 'real' && this.timeLeft > 0) {
            this.heartbeatInterval = setInterval(() => {
                if (this.timeLeft > 0) {
                    API.heartbeat({
                        masv: this.masv,
                        mamh: this.mamh,
                        lan: this.lan,
                        timeLeft: this.timeLeft
                    }).catch(err => {
                        console.error('Lỗi heartbeat:', err);
                    });
                }
            }, 30000); // 30 seconds
        }
    },

    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    },

    // ================================
    // NỘP BÀI
    // ================================
    async submitExam() {
        if (this.examMode === 'trial') {
            return this.submitTrialExam();
        }
        if (this.timer) clearInterval(this.timer);
        this.stopHeartbeat();

        const answeredCount = Object.keys(this.answers).length;
        if (answeredCount < this.questions.length) {
            if (!UI.confirm(`Bạn mới trả lời ${answeredCount}/${this.questions.length} câu. Nộp bài?`)) {
                this.startTimer();
                return;
            }
        }

        UI.showLoading();

        // Tạo mảng câu trả lời (bao gồm STT thứ tự khi thi)
        const answerList = this.questions.map((q, i) => ({
            CAUHOI: q.CAUHOI,
            TRALOI: this.answers[q.CAUHOI] || '',
            STT: i + 1
        }));

        // Gọi SP nộp bài
        const res = await API.nopBai({
            masv: this.masv,
            mamh: this.mamh,
            lan: this.lan,
            answers: answerList
        });

        if (!res?.success) {
            UI.toast(res?.message || 'Lỗi nộp bài!', 'error');
            return;
        }

        this.showResult(res);
    },

    async forceSubmitExam() {
        if (this.examMode === 'trial') {
            return this.forceSubmitTrialExam();
        }
        if (this.timer) clearInterval(this.timer);
        this.stopHeartbeat();

        const answeredCount = Object.keys(this.answers).length;

        UI.showLoading();

        // Tạo mảng câu trả lời (bao gồm STT thứ tự khi thi)
        const answerList = this.questions.map((q, i) => ({
            CAUHOI: q.CAUHOI,
            TRALOI: this.answers[q.CAUHOI] || '',
            STT: i + 1
        }));

        // Gọi SP nộp bài
        const res = await API.nopBai({
            masv: this.masv,
            mamh: this.mamh,
            lan: this.lan,
            answers: answerList
        });

        if (!res?.success) {
            UI.toast(res?.message || 'Lỗi nộp bài!', 'error');
            return;
        }

        this.showResult(res);
    },

    // ================================
    // KẾT QUẢ
    // ================================
    async submitTrialExam() {
        if (this.timer) clearInterval(this.timer);

        const answeredCount = Object.keys(this.answers).length;
        if (answeredCount < this.questions.length) {
            if (!UI.confirm(`Bạn mới trả lời ${answeredCount}/${this.questions.length} câu. Nộp bài?`)) {
                this.startTimer();
                return;
            }
        }

        this.showTrialResult();
    },

    async forceSubmitTrialExam() {
        if (this.timer) clearInterval(this.timer);
        this.showTrialResult();
    },

    showTrialResult() {
        const details = this.questions.map((q, i) => {
            const svAns = this.answers[q.CAUHOI] || '';
            const correctAns = (q.DAP_AN || '').trim();
            return {
                STT: i + 1,
                CAUHOI: q.CAUHOI,
                NOIDUNG: q.NOIDUNG,
                A: q.A,
                B: q.B,
                C: q.C,
                D: q.D,
                TraLoiSV: svAns,
                DapAnDung: correctAns,
                Dung: svAns && svAns === correctAns
            };
        });

        const tongCau = details.length;
        const soCauDung = details.filter(d => d.Dung).length;
        const diemRaw = tongCau > 0 ? (soCauDung / tongCau) * 10 : 0;
        const diem = Math.round(diemRaw * 100) / 100;

        this.showResult({
            details,
            summary: { Diem: diem, SoCauDung: soCauDung, TongCau: tongCau }
        });
    },

    showResult(res) {
        this.setExamOnlyMode(false);
        UI.setTitle(this.examMode === 'trial' ? 'Kết quả thi thử' : 'Kết quả thi');

        const summary = res.summary;
        const details = res.details || [];

        const isTrial = this.examMode === 'trial';
        const hoTen = isTrial
            ? (window.APP_HOTEN || window.APP_USERNAME || '')
            : (window._svInfo?.HO?.trim() + ' ' + window._svInfo?.TEN?.trim());
        const tenLop = isTrial ? '' : (window._svInfo?.TENLOP?.trim() || '');
        const maDinhDanh = isTrial ? (window.APP_MAGV || window.APP_USERNAME || '') : (this.masv || '');
        const labelDinhDanh = isTrial ? 'Mã số GV' : 'Mã số SV';

        // Build table rows
        let rows = '';
        details.forEach((d, i) => {
            const svAns = d.TraLoiSV?.trim() || '';
            const correctAns = d.DapAnDung?.trim() || '';
            const isCorrect = svAns === correctAns;
            rows += '<tr>' +
                '<td style="text-align:center">' + (i + 1) + '</td>' +
                '<td>' + (d.NOIDUNG?.trim() || '') + '</td>' +
                '<td>' + (d.A?.trim() || '') + '</td>' +
                '<td>' + (d.B?.trim() || '') + '</td>' +
                '<td>' + (d.C?.trim() || '') + '</td>' +
                '<td>' + (d.D?.trim() || '') + '</td>' +
                '<td style="text-align:center;font-weight:bold;color:' + (svAns ? (isCorrect ? '#2a7d2a' : '#c00') : '#888') + '">' + (svAns || '-') + '</td>' +
                '<td style="text-align:center;font-weight:bold;color:#2a7d2a">' + correctAns + '</td>' +
                '</tr>';
        });

        const diem = summary?.Diem ?? '?';
        const diemChu = typeof soThanhChu === 'function' ? soThanhChu(diem) : '';
        const ngayThi = new Date().toLocaleDateString('vi-VN');

        const html =
            '<div class="card">' +
            '<div style="padding:16px">' +
            (isTrial ? '' : '<p><strong>Lớp</strong> : ' + tenLop + '</p>') +
            '<p><strong>Họ tên</strong> : ' + (hoTen || '') + '&nbsp;&nbsp;&nbsp;&nbsp;<strong>' + labelDinhDanh + ':</strong> ' + maDinhDanh + '</p>' +
            '<br>' +
            '<p><strong>Môn thi</strong> : ' + (this.tenmh || this.mamh || '') + '</p>' +
            '<p><strong>Ngày thi</strong> : ' + ngayThi + '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<strong>Lần thi:</strong> ' + (this.lan || '') + '</p>' +
            '</div>' +
            '<div class="table-wrapper">' +
            '<table>' +
            '<thead><tr>' +
            '<th>Câu số</th>' +
            '<th>Nội dung câu hỏi</th>' +
            '<th>A</th><th>B</th><th>C</th><th>D</th>' +
            '<th>Trả lời của SV</th>' +
            '<th>Đáp án</th>' +
            '</tr></thead>' +
            '<tbody>' + rows + '</tbody>' +
            '</table>' +
            '</div>' +
            '<div style="padding:16px;border-top:1px solid #ddd">' +
            '<p><strong>Số câu đúng:</strong> ' + (summary?.SoCauDung ?? 0) + ' / ' + (summary?.TongCau ?? 0) + '</p>' +
            '<p style="font-size:18px"><strong>Điểm: ' + diem + '</strong>' +
            (diemChu ? ' &nbsp;(' + diemChu + ')' : '') +
            '</p>' +
            '</div>' +
            '</div>' +
            '<div style="text-align:center;padding:20px;">' +
            '<button class="btn btn-secondary" onclick="' + (window.APP_ROLE === 'Sinhvien' ? 'Exam.showExamSetup()' : 'Exam.showTrialSetup()') + '">← Quay lại</button>' +
            '</div>';

        UI.showContent(html);
    },

    // ================================
    // XEM LẠI BÀI THI
    // ================================
    async xemBaiThi() {
        this.setExamOnlyMode(false);
        UI.setTitle('Xem lại bài thi');
        UI.showLoading();

        const masv = window.APP_MASV || '';

        let html = `<div class="card">
            <div class="card-header"><h3>Tra cứu bài thi</h3></div>
            <div class="toolbar" style="margin-bottom:16px;">
                <div class="form-group" style="margin:0;">
                    <input id="xbt_masv" value="${masv}" placeholder="Mã SV" ${window.APP_ROLE === 'Sinhvien' ? 'disabled' : ''}>
                </div>
                <select id="xbt_mamh" disabled>
                    <option value="">-- Môn --</option>
                </select>
                <select id="xbt_lan" disabled style="width:110px">
                    <option value="">-- Lần --</option>
                </select>
                <button class="btn btn-primary" onclick="Exam.loadBaiThi()">Xem</button>
            </div>
            <div id="xbtArea">${UI.showEmpty('', 'Chọn thông tin và nhấn Xem')}</div>
        </div>`;

        UI.showContent(html);

        const inpMasv = document.getElementById('xbt_masv');
        const selMh = document.getElementById('xbt_mamh');
        const selLan = document.getElementById('xbt_lan');

        let svHistory = [];

        const updateSVHistory = async (masvVal) => {
            const val = (masvVal || '').trim();
            svHistory = [];
            selMh.innerHTML = '<option value="">-- Môn --</option>';
            selMh.disabled = true;
            selLan.innerHTML = '<option value="">-- Lần --</option>';
            selLan.disabled = true;

            // Xóa vùng hiển thị kết quả thi cũ khi thay đổi hoặc có lỗi sinh viên
            const xbtArea = document.getElementById('xbtArea');
            if (xbtArea) {
                xbtArea.innerHTML = UI.showEmpty('', 'Chọn thông tin và nhấn Xem');
            }

            if (!val) return;

            try {
                const res = await API.getLichSuThiSV(val);
                if (res && res.success) {
                    if (res.data && res.data.length > 0) {
                        svHistory = res.data;
                        const uniqueMhs = [];
                        const seen = new Set();
                        svHistory.forEach(item => {
                            if (!seen.has(item.MAMH)) {
                                seen.add(item.MAMH);
                                uniqueMhs.push({ MAMH: item.MAMH, TENMH: item.TENMH });
                            }
                        });

                        selMh.innerHTML = '<option value="">-- Môn --</option>' + UI.selectOptions(uniqueMhs, 'MAMH', 'TENMH');
                        selMh.disabled = false;
                    } else {
                        UI.toast('Sinh viên này chưa thi môn nào!', 'info');
                    }
                } else {
                    UI.toast(res?.message || 'Không tìm thấy thông tin sinh viên!', 'error');
                }
            } catch (err) {
                console.error(err);
                UI.toast('Lỗi khi tải lịch sử thi của sinh viên!', 'error');
            }
        };

        if (window.APP_ROLE === 'Sinhvien') {
            if (masv) {
                await updateSVHistory(masv);
            }
        } else {
            let debounceTimer = null;
            inpMasv?.addEventListener('input', () => {
                if (debounceTimer) clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    updateSVHistory(inpMasv.value);
                }, 300);
            });
        }

        selMh?.addEventListener('change', () => {
            const selectedMamh = selMh.value;
            selLan.innerHTML = '<option value="">-- Lần --</option>';
            selLan.disabled = true;

            if (!selectedMamh) return;

            const filteredLans = svHistory.filter(item => item.MAMH?.trim() === selectedMamh.trim());
            if (filteredLans.length > 0) {
                selLan.innerHTML += filteredLans.map(item => `<option value="${item.LAN}">Lần ${item.LAN}</option>`).join('');
                selLan.disabled = false;
            }
        });
    },

    async loadBaiThi() {
        const masv = document.getElementById('xbt_masv').value.trim();
        const mamh = document.getElementById('xbt_mamh').value;
        const lan = document.getElementById('xbt_lan').value;

        if (!masv || !mamh || !lan) return UI.toast('Vui lòng chọn đầy đủ Mã SV, Môn học và Lần thi!', 'error');

        const res = await API.xemBaiThi(masv, mamh, lan);

        if (!res?.success || !res.data || res.data.length === 0) {
            document.getElementById('xbtArea').innerHTML = UI.showEmpty('', 'Không tìm thấy kết quả thi!');
            return;
        }

        const info = res.data[0];
        const details = res.details || [];

        const soCauDung = details.filter(d => Number(d.Dung) === 1).length;
        const tongSoCau = details.length;

        const rowsHtml = details.map((d, i) => {
            const svAns = d.TraLoiSV?.trim() || '';
            const correctAns = d.DapAnDung?.trim() || '';
            const isCorrect = Number(d.Dung) === 1;
            return `<tr>
                <td style="text-align:center">${i + 1}</td>
                <td>${d.NOIDUNG?.trim() || ''}</td>
                <td>${d.A?.trim() || ''}</td>
                <td>${d.B?.trim() || ''}</td>
                <td>${d.C?.trim() || ''}</td>
                <td>${d.D?.trim() || ''}</td>
                <td style="text-align:center;font-weight:bold;color:${svAns ? (isCorrect ? '#2a7d2a' : '#c00') : '#888'}">${svAns || '-'}</td>
                <td style="text-align:center;font-weight:bold;color:#2a7d2a">${correctAns}</td>
            </tr>`;
        }).join('');

        const infoHtml = `
        <div style="margin-bottom:20px;padding:16px;background:rgba(255,255,255,0.03);border-radius:8px;">
            <strong>${info.HO?.trim()} ${info.TEN?.trim()}</strong> (${info.MASV?.trim()}) — Lớp: ${info.TENLOP?.trim()}<br>
            Môn: ${info.TENMH?.trim()} — Lần ${info.LAN} — Ngày: ${info.NGAYTHI ? new Date(info.NGAYTHI).toLocaleDateString('vi-VN') : ''}<br>
            <span style="font-size:20px;font-weight:700;color:var(--accent-light);">Điểm: ${info.DIEM}</span>
        </div>
        <div class="table-wrapper">
            <table>
                <thead><tr>
                    <th>Câu số</th>
                    <th>Nội dung câu hỏi</th>
                    <th>A</th><th>B</th><th>C</th><th>D</th>
                    <th>Trả lời của SV</th>
                    <th>Đáp án</th>
                </tr></thead>
                <tbody>${rowsHtml || '<tr><td colspan="8" style="text-align:center;color:#888">Không có dữ liệu chi tiết bài thi.</td></tr>'}</tbody>
            </table>
        </div>
        <div style="margin-top:12px;padding:12px 16px;border-top:1px solid rgba(255,255,255,0.08);">
            <strong>Số câu đúng:</strong> ${soCauDung} / ${tongSoCau}
        </div>`;

        document.getElementById('xbtArea').innerHTML = infoHtml;
    },

    async resumeExam(mamh, lan, malop) {
        this.examMode = 'real';
        this.masv = window.APP_MASV;
        this.mamh = mamh?.trim();
        this.lan = lan;

        UI.showLoading();

        // Lấy danh sách đăng ký thi để hiển thị tên môn học chính xác
        const dkRes = await API.getDangKyThiSV(this.masv);
        const dkList = dkRes?.data || [];
        const dk = dkList.find(d => d.MAMH?.trim() === this.mamh && d.LAN === this.lan);
        this.tenmh = dk ? dk.TENMH?.trim() : this.mamh;

        // Lấy đề thi từ database (SP tự nhận diện là đang resumed)
        const res = await API.layDe({
            mamh: this.mamh,
            malop: malop?.trim(),
            lan: this.lan,
            masv: this.masv
        });

        if (!res?.success) {
            UI.toast(res?.message || 'Lỗi khôi phục đề thi!', 'error');
            this.showExamSetup();
            return;
        }

        this.questions = res.questions || [];
        this.examInfo = res.examInfo;
        this.answers = {};
        this.questions.forEach(q => {
            if (q.TRALOI_SV) {
                this.answers[q.CAUHOI] = q.TRALOI_SV.trim();
            }
        });
        this.currentQuestionId = this.questions.length > 0 ? this.questions[0].CAUHOI : null;

        if (this.examInfo?.THOIGIAN_GIAY !== undefined) {
            this.timeLeft = this.examInfo.THOIGIAN_GIAY;
        } else {
            this.timeLeft = (this.examInfo?.THOIGIAN || 30) * 60;
        }

        if (this.examInfo?.IS_RESUMED) {
            UI.toast('Đã khôi phục bài thi đang làm dở!', 'info');
        }

        this.renderExam();
        this.startTimer();
    },

    async showResumedExamResult(mamh, lan) {
        this.setExamOnlyMode(false);
        UI.setTitle('Bài thi đã tự động nộp');
        UI.showLoading();

        const res = await API.xemBaiThi(window.APP_MASV, mamh, lan);
        if (!res?.success || !res.data || res.data.length === 0) {
            UI.showContent(`<div class="card"><p style="color:var(--danger)">Không tìm thấy kết quả bài thi tự động nộp.</p></div>`);
            return;
        }

        const info = res.data[0];
        const details = res.details || [];
        const soCauDung = details.filter(d => Number(d.Dung) === 1).length;
        const tongSoCau = details.length;

        let rows = '';
        details.forEach((d, i) => {
            const svAns = d.TraLoiSV?.trim() || '';
            const correctAns = d.DapAnDung?.trim() || '';
            const isCorrect = Number(d.Dung) === 1;
            rows += '<tr>' +
                '<td style="text-align:center">' + (i + 1) + '</td>' +
                '<td>' + (d.NOIDUNG?.trim() || '') + '</td>' +
                '<td>' + (d.A?.trim() || '') + '</td>' +
                '<td>' + (d.B?.trim() || '') + '</td>' +
                '<td>' + (d.C?.trim() || '') + '</td>' +
                '<td>' + (d.D?.trim() || '') + '</td>' +
                '<td style="text-align:center;font-weight:bold;color:' + (svAns ? (isCorrect ? '#2a7d2a' : '#c00') : '#888') + '">' + (svAns || '-') + '</td>' +
                '<td style="text-align:center;font-weight:bold;color:#2a7d2a">' + correctAns + '</td>' +
                '</tr>';
        });

        const diem = info.DIEM ?? '?';
        const diemChu = typeof soThanhChu === 'function' ? soThanhChu(diem) : '';
        const ngayThi = info.NGAYTHI ? new Date(info.NGAYTHI).toLocaleDateString('vi-VN') : '';

        const html =
            '<div class="card">' +
            '<div style="padding:16px;background:rgba(217, 83, 79, 0.1);border:1px solid var(--danger);border-radius:8px;margin:16px">' +
            '<h4 style="color:var(--danger);margin:0 0 8px 0">Thời gian thi đã hết!</h4>' +
            '<p style="margin:0">Bài thi của bạn đã được hệ thống tự động nộp thành công với các câu trả lời đã lưu trước đó.</p>' +
            '</div>' +
            '<div style="padding:16px">' +
            '<p><strong>Lớp</strong> : ' + (info.TENLOP?.trim() || '') + '</p>' +
            '<p><strong>Họ tên</strong> : ' + (info.HO?.trim() + ' ' + info.TEN?.trim()) + '&nbsp;&nbsp;&nbsp;&nbsp;<strong>Mã số SV:</strong> ' + info.MASV + '</p>' +
            '<br>' +
            '<p><strong>Môn thi</strong> : ' + (info.TENMH?.trim() || '') + '</p>' +
            '<p><strong>Ngày thi</strong> : ' + ngayThi + '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<strong>Lần thi:</strong> ' + (info.LAN || '') + '</p>' +
            '</div>' +
            '<div class="table-wrapper">' +
            '<table>' +
            '<thead><tr>' +
            '<th>Câu số</th>' +
            '<th>Nội dung câu hỏi</th>' +
            '<th>A</th><th>B</th><th>C</th><th>D</th>' +
            '<th>Trả lời của SV</th>' +
            '<th>Đáp án</th>' +
            '</tr></thead>' +
            '<tbody>' + rows + '</tbody>' +
            '</table>' +
            '</div>' +
            '<div style="padding:16px;border-top:1px solid #ddd">' +
            '<p><strong>Số câu đúng:</strong> ' + soCauDung + ' / ' + tongSoCau + '</p>' +
            '<p style="font-size:18px"><strong>Điểm: ' + diem + '</strong>' +
            (diemChu ? ' &nbsp;(' + diemChu + ')' : '') +
            '</p>' +
            '</div>' +
            '</div>' +
            '<div style="text-align:center;padding:20px;">' +
            '<button class="btn btn-secondary" onclick="Exam.showExamSetup()">← Quay lại Trang chính</button>' +
            '</div>';

        UI.showContent(html);
    }
};

// Gửi heartbeat cuối cùng bằng sendBeacon khi reload/đóng trang
window.addEventListener('beforeunload', () => {
    if (Exam.examMode === 'real' && Exam.timeLeft > 0 && Exam.masv && Exam.mamh && Exam.lan) {
        const payload = JSON.stringify({
            masv: Exam.masv,
            mamh: Exam.mamh,
            lan: Exam.lan,
            timeLeft: Exam.timeLeft
        });
        const blob = new Blob([payload], { type: 'application/json' });
        navigator.sendBeacon('/api/thi/heartbeat', blob);
    }
});
