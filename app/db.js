const sql = require('mssql');

// Cache connection pools theo username
const poolCache = new Map();

const BASE_CONFIG = {
    server: 'localhost',       // Đổi thành tên server SQL của bạn, ví dụ: 'localhost\\SQLEXPRESS'
    database: 'THITRACNGHIEM',
    options: {
        encrypt: false,
        trustServerCertificate: true
    },
    pool: {
        max: 5,
        min: 0,
        idleTimeoutMillis: 30000
    }
};

/**
 * Lấy hoặc tạo connection pool theo credentials của user
 */
async function getPool(userCredentials) {
    const { username, password } = userCredentials;
    const key = `${username}:${password}`;

    if (poolCache.has(key)) {
        const cached = poolCache.get(key);
        if (cached.connected) return cached;
        // Pool bị đóng, xóa cache
        poolCache.delete(key);
    }

    const config = {
        ...BASE_CONFIG,
        user: username,
        password: password
    };

    try {
        const pool = new sql.ConnectionPool(config);
        await pool.connect();
        poolCache.set(key, pool);

        // Tự dọn cache khi pool bị đóng
        pool.on('close', () => {
            poolCache.delete(key);
        });

        return pool;
    } catch (err) {
        poolCache.delete(key);
        throw err;
    }
}

/**
 * Thực thi Stored Procedure — HÀM DUY NHẤT để gọi DB
 * App KHÔNG được viết raw SQL, chỉ dùng hàm này.
 *
 * @param {string} spName - Tên stored procedure (ví dụ: 'SP_LayDanhSachMonHoc')
 * @param {Object} params - Object chứa các tham số, ví dụ: { MAMH: { type: sql.NChar(5), value: 'CSDL' } }
 * @param {Object} userCredentials - { username, password }
 * @returns {Object} - { recordsets, recordset, output, rowsAffected }
 */
async function executeStoredProc(spName, params = {}, userCredentials) {
    const pool = await getPool(userCredentials);
    const request = pool.request();

    // Gán tham số
    for (const [name, param] of Object.entries(params)) {
        if (param.type) {
            request.input(name, param.type, param.value);
        } else {
            request.input(name, param.value !== undefined ? param.value : param);
        }
    }

    const result = await request.execute(`dbo.${spName}`);
    return result;
}

/**
 * Test kết nối (dùng cho đăng nhập)
 */
async function testConnection(username, password) {
    const pool = await getPool({ username, password });
    return pool.connected;
}

/**
 * Đóng pool của một user
 */
async function closePool(username) {
    if (poolCache.has(username)) {
        const pool = poolCache.get(username);
        await pool.close();
        poolCache.delete(`${username}:${password}`);
    }
}

module.exports = {
    sql,
    executeStoredProc,
    testConnection,
    closePool,
    getPool
};
