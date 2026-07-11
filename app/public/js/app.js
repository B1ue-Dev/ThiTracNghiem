/**
 * APP BOOTSTRAP — Khởi tạo ứng dụng, render sidebar theo role
 */

// Menu items theo role
const MENUS = {
    PGV: [
        {
            section: 'Quản lý', items: [
                { icon: '', label: 'Môn học', action: 'Pages.monhoc()' },
                { icon: '', label: 'Lớp & Sinh viên', action: 'Pages.sinhvien()' },
                { icon: '', label: 'Giảng viên', action: 'Pages.giaovien()' },
            ]
        },
        {
            section: 'Đề thi', items: [
                { icon: '', label: 'Câu hỏi', action: 'Pages.cauhoi()' },
                { icon: '', label: 'Đăng ký thi', action: 'Pages.dangkythi()' },
            ]
        },
        {
            section: 'Thi', items: [
                { icon: '', label: 'Thi thử', action: 'Exam.showTrialSetup()' },
            ]
        },
        {
            section: 'Kết quả', items: [
                { icon: '', label: 'Bảng điểm', action: 'Pages.bangdiem()' },
                { icon: '', label: 'Xem bài thi', action: 'Exam.xemBaiThi()' },
            ]
        },
        {
            section: 'Hệ thống', items: [
                { icon: '', label: 'Tạo tài khoản', action: 'Pages.taoTaiKhoan()' },
            ]
        },
    ],
    Giangvien: [
        {
            section: 'Đề thi', items: [
                { icon: '', label: 'Câu hỏi', action: 'Pages.cauhoi()' },
                { icon: '', label: 'Đăng ký thi', action: 'Pages.dangkythi()' },
            ]
        },
        {
            section: 'Thi', items: [
                { icon: '', label: 'Thi thử', action: 'Exam.showTrialSetup()' },
            ]
        },
        {
            section: 'Kết quả', items: [
                { icon: '', label: 'Bảng điểm', action: 'Pages.bangdiem()' },
                { icon: '', label: 'Xem bài thi SV', action: 'Exam.xemBaiThi()' },
            ]
        },
        {
            section: 'Tra cứu', items: [
                { icon: '', label: 'Môn học', action: 'Pages.monhoc()' },
                { icon: '', label: 'Lớp & Sinh viên', action: 'Pages.sinhvien()' },
                { icon: '', label: 'Giảng viên', action: 'Pages.giaovien()' },
            ]
        },
    ],
    Sinhvien: [
        {
            section: 'Thi', items: [
                { icon: '', label: 'Thi trắc nghiệm', action: 'Exam.showExamSetup()' },
            ]
        },
        {
            section: 'Kết quả', items: [
                { icon: '', label: 'Xem lại bài thi', action: 'Exam.xemBaiThi()' },
            ]
        },
    ]
};

// Nhãn hiển thị cho role
const ROLE_LABELS = {
    PGV: 'Phòng Giáo vụ',
    Giangvien: 'Giảng viên',
    Sinhvien: 'Sinh viên'
};

/**
 * Khởi tạo app
 */
async function initApp() {
    const res = await API.getMe();
    if (!res?.success) {
        window.location.href = '/login';
        return;
    }

    window.APP_ROLE = res.role;
    window.APP_USERNAME = res.username;
    window.APP_MASV = res.masv;
    window.APP_MAGV = res.magv;
    window.APP_HOTEN = res.hoTen;

    // Render sidebar
    renderSidebar(res.role);

    // Render user info
    let userHtml = '';
    if (res.role === 'Sinhvien' && res.hoTen) {
        userHtml = `
            <strong>${res.hoTen}</strong>
            MASV: ${res.masv}<br>
            Lớp: ${res.tenLop || res.maLop || ''}<br>
            Ngày sinh: ${res.ngaySinh || ''}
        `;
    } else if ((res.role === 'Giangvien' || res.role === 'PGV') && (res.hoTen || res.magv)) {
        userHtml = `
            <strong>${res.hoTen || res.username}</strong>
            MAGV: ${res.magv || ''}<br>
            SĐT: ${res.soDT || ''}<br>
            Địa chỉ: ${res.diaChi || ''}
        `;
    } else {
        userHtml = `<strong>${res.username}</strong>`;
    }
    document.getElementById('userInfo').innerHTML = userHtml;

    // Render role tag
    const roleTag = document.getElementById('roleTag');
    roleTag.textContent = ROLE_LABELS[res.role] || res.role;

    // Tự động kiểm tra bài thi đang làm dở cho Sinh viên
    if (res.role === 'Sinhvien') {
        try {
            const checkRes = await API.kiemTraBaiThiDangDo();
            if (checkRes?.success && checkRes.data && checkRes.data.HasPending === 1) {
                const pending = checkRes.data;
                if (pending.IsValid === 1) {
                    // Còn thời gian -> Vào thẳng trang thi
                    Exam.resumeExam(pending.MAMH, pending.LAN, pending.MALOP);
                    return;
                } else {
                    // Hết thời gian -> Đã tự động nộp, chuyển sang màn hình kết quả
                    Exam.showResumedExamResult(pending.MAMH, pending.LAN);
                    return;
                }
            }
        } catch (err) {
            console.error('Lỗi kiểm tra bài thi dở:', err);
        }
    }

    // Tự động vào trang đầu tiên hiển thị ở sidebar cho tất cả các role (nếu Sinh viên không có bài thi dở)
    const firstNavItem = document.querySelector('.nav-item');
    if (firstNavItem) {
        firstNavItem.click();
    }
}

function renderSidebar(role) {
    const nav = document.getElementById('sidebarNav');
    const menus = MENUS[role] || [];
    let html = '';

    menus.forEach(section => {
        html += `<div class="nav-section">
            <div class="nav-section-title">${section.section}</div>`;
        section.items.forEach(item => {
            html += `<div class="nav-item" onclick="navigateTo(this, () => ${item.action})">
                <span class="icon">${item.icon}</span>
                <span>${item.label}</span>
            </div>`;
        });
        html += '</div>';
    });

    nav.innerHTML = html;
}

function navigateTo(el, actionFn) {
    // Highlight active nav
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    if (el) el.classList.add('active');


    // Clear exam timer if running
    if (Exam.timer) {
        clearInterval(Exam.timer);
        Exam.timer = null;
    }
    if (typeof Exam.stopHeartbeat === 'function') {
        Exam.stopHeartbeat();
    }

    // Execute action
    actionFn();
}

async function handleLogout() {
    await API.logout();
    window.location.href = '/login';
}

// Boot
document.addEventListener('DOMContentLoaded', initApp);
