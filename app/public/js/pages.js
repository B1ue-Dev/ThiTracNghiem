/**
 * PAGES — Render trang cho từng chức năng
 */

/**
 * UndoManager — Quản lý stack phục hồi thao tác DB (Thêm/Sửa/Xóa)
 * Mỗi entry: { description: string, undoFn: async () => void }
 * Stack bị xóa khi chuyển tab.
 */
const UndoManager = {
    _stack: [],
    _maxSize: 20,

    push(entry) {
        this._stack.push(entry);
        if (this._stack.length > this._maxSize) this._stack.shift();
    },

    clear() { this._stack = []; },

    canUndo(tabName) {
        if (!tabName) return this._stack.length > 0;
        return this._stack.some(entry => entry.tab === tabName);
    },

    peek(tabName) {
        if (!tabName) return this._stack[this._stack.length - 1] || null;
        for (let i = this._stack.length - 1; i >= 0; i--) {
            if (this._stack[i].tab === tabName) return this._stack[i];
        }
        return null;
    },

    async undo(tabName) {
        if (!this.canUndo(tabName)) {
            UI.toast('Không có thao tác nào để phục hồi!', 'info');
            return false;
        }

        let index = -1;
        if (!tabName) {
            index = this._stack.length - 1;
        } else {
            for (let i = this._stack.length - 1; i >= 0; i--) {
                if (this._stack[i].tab === tabName) {
                    index = i;
                    break;
                }
            }
        }

        if (index === -1) return false;

        const entry = this._stack[index];
        if (!UI.confirm(`Phục hồi: ${entry.description}?`)) {
            return false;
        }

        this._stack.splice(index, 1);

        try {
            await entry.undoFn();
            UI.toast(`Đã phục hồi: ${entry.description}`, 'success');
            return true;
        } catch (err) {
            UI.toast(`Lỗi phục hồi: ${err.message}`, 'error');
            this._stack.splice(index, 0, entry);
            return false;
        }
    }
};

// Hàm chuyển số thành chữ tiếng Việt (VD: 9.75 → "chín chấm bảy năm")
function soThanhChu(num) {
    if (num == null) return '';
    const digits = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
    const str = String(num);
    const parts = str.split('.');
    let result = '';
    // Phần nguyên
    const intPart = parts[0];
    if (intPart.length === 2) {
        const chuc = parseInt(intPart[0]);
        const donvi = parseInt(intPart[1]);
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
        result = digits[parseInt(intPart)];
    }
    // Phần thập phân
    if (parts[1]) {
        result += ' chấm';
        for (const c of parts[1]) {
            result += ' ' + digits[parseInt(c)];
        }
    }
    return result;
}

const Pages = {
    escapeHtml(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
};
