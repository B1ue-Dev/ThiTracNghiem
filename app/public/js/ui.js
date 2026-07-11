/**
 * UI Helper functions
 */
const UI = {
    setTitle(title) {
        document.getElementById('pageTitle').textContent = title;
    },

    showLoading() {
        document.getElementById('contentArea').innerHTML = `
            <div class="loading">
                <div class="spinner"></div>
                <p>Đang tải...</p>
            </div>`;
    },

    showEmpty(icon = '', msg = 'Không có dữ liệu') {
        return `<div class="empty-state"><div class="icon">${icon}</div><p>${msg}</p></div>`;
    },

    showContent(html) {
        document.getElementById('contentArea').innerHTML = html;
    },

    toast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    },

    showModal(html) {
        const overlay = document.getElementById('modalOverlay');
        const content = document.getElementById('modalContent');
        content.innerHTML = html;
        overlay.style.display = 'flex';
        overlay.onclick = (e) => {
            if (e.target === overlay) this.closeModal();
        };
    },

    closeModal() {
        document.getElementById('modalOverlay').style.display = 'none';
    },

    confirm(msg) {
        return window.confirm(msg);
    },

    buildTable(columns, rows, actions = null) {
        if (!rows || rows.length === 0) {
            return this.showEmpty('', 'Không có dữ liệu');
        }

        let html = '<div class="table-wrapper"><table><thead><tr>';
        columns.forEach(col => {
            html += `<th>${col.label}</th>`;
        });
        if (actions) html += '<th>Thao tác</th>';
        html += '</tr></thead><tbody>';

        rows.forEach((row, idx) => {
            html += '<tr>';
            columns.forEach(col => {
                let val = row[col.key];
                if (col.format) val = col.format(val, row);
                if (typeof val === 'string') val = val.trim();
                html += `<td>${val ?? ''}</td>`;
            });
            if (actions) {
                const actionHtml = (actions(row, idx) || '').trim();
                html += `<td>${actionHtml ? `<div class="btn-group">${actionHtml}</div>` : ''}</td>`;
            }
            html += '</tr>';
        });

        html += '</tbody></table></div>';
        return html;
    },

    selectOptions(items, valueKey, labelKey, selected = null) {
        return items.map(item => {
            const v = typeof item === 'string' ? item : item[valueKey];
            const l = typeof item === 'string' ? item : item[labelKey];
            const sel = (v === selected || (v && selected && v.trim() === selected.trim())) ? 'selected' : '';
            return `<option value="${v}" ${sel}>${l}</option>`;
        }).join('');
    }
};
