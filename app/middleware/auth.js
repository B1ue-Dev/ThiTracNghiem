/**
 * Middleware kiểm tra đã đăng nhập chưa
 */
function requireLogin(req, res, next) {
    if (!req.session || !req.session.user) {
        if (req.xhr || req.headers.accept?.includes('application/json')) {
            return res.status(401).json({ success: false, message: 'Chưa đăng nhập!' });
        }
        return res.redirect('/login');
    }
    next();
}

/**
 * Middleware kiểm tra role
 * @param  {...string} roles - Danh sách role được phép
 */
function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.session || !req.session.user) {
            if (req.xhr || req.headers.accept?.includes('application/json')) {
                return res.status(401).json({ success: false, message: 'Chưa đăng nhập!' });
            }
            return res.redirect('/login');
        }

        const userRole = req.session.user.role;
        if (roles.includes(userRole)) {
            if (req.xhr || req.headers.accept?.includes('application/json')) {
                return res.status(403).json({ success: false, message: 'Bạn không có quyền truy cập!' });
            }
            return res.status(403).send('Bạn không có quyền truy cập chức năng này!');
        }
        next();
    };
}

/**
 * Helper: Lấy credentials từ session để gọi SP
 */
function getCredentials(req) {
    if (!req.session || !req.session.user) return null;
    return {
        username: req.session.user.username,
        password: req.session.user.password
    };
}

module.exports = { requireLogin, requireRole, getCredentials };
