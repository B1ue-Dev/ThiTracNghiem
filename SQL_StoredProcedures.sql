-- =====================================================
-- HỆ THỐNG THI TRẮC NGHIỆM
-- FILE: SQL_StoredProcedures.sql
-- Chứa toàn bộ Stored Procedures + Security Setup
-- Chạy trên SSMS với quyền sysadmin (sa)
-- =====================================================

USE master;
GO
ALTER DATABASE THITRACNGHIEM SET TRUSTWORTHY ON;
GO

USE THITRACNGHIEM;
GO

-- Thêm cột TRANG_THAI vào bảng GIAOVIEN nếu chưa có
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.GIAOVIEN') AND name = 'TRANG_THAI')
BEGIN
    EXEC('ALTER TABLE dbo.GIAOVIEN ADD TRANG_THAI NVARCHAR(20) NOT NULL CONSTRAINT DF_GIAOVIEN_TRANGTHAI DEFAULT (N''Hoạt động'')');
    EXEC('ALTER TABLE dbo.GIAOVIEN ADD CONSTRAINT CK_GIAOVIEN_TRANGTHAI CHECK (TRANG_THAI IN (N''Hoạt động'', N''Khóa''))');
END
GO

-- Thêm cột TRANG_THAI vào bảng SINHVIEN nếu chưa có
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.SINHVIEN') AND name = 'TRANG_THAI')
BEGIN
    EXEC('ALTER TABLE dbo.SINHVIEN ADD TRANG_THAI NVARCHAR(20) NOT NULL CONSTRAINT DF_SINHVIEN_TRANGTHAI DEFAULT (N''Hoạt động'')');
    EXEC('ALTER TABLE dbo.SINHVIEN ADD CONSTRAINT CK_SINHVIEN_TRANGTHAI CHECK (TRANG_THAI IN (N''Hoạt động'', N''Khóa''))');
END
GO

-- =====================================================
-- PHẦN 0: BẢNG LƯU CHI TIẾT BÀI THI
-- =====================================================

IF OBJECT_ID('dbo.CHITIETBAITHI', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.CHITIETBAITHI (
        MASV NCHAR(8) NOT NULL,
        MAMH NCHAR(5) NOT NULL,
        LAN SMALLINT NOT NULL,
        CAUHOI INT NOT NULL,
        STT INT NOT NULL DEFAULT 0,
        NOIDUNG NVARCHAR(MAX) NOT NULL,
        A NVARCHAR(MAX) NOT NULL,
        B NVARCHAR(MAX) NOT NULL,
        C NVARCHAR(MAX) NOT NULL,
        D NVARCHAR(MAX) NOT NULL,
        TRALOI_SV NCHAR(1) NULL,
        DAP_AN_DUNG NCHAR(1) NOT NULL,
        DUNG BIT NOT NULL,
        NGAY_LUU DATETIME NOT NULL CONSTRAINT DF_CHITIETBAITHI_NGAYLUU DEFAULT (GETDATE()),
        CONSTRAINT PK_CHITIETBAITHI PRIMARY KEY (MASV, MAMH, LAN, CAUHOI),
        CONSTRAINT FK_CHITIETBAITHI_BANGDIEM FOREIGN KEY (MASV, MAMH, LAN)
            REFERENCES dbo.BANGDIEM(MASV, MAMH, LAN)
    );

    CREATE INDEX IX_CHITIETBAITHI_LOOKUP ON dbo.CHITIETBAITHI(MASV, MAMH, LAN);
END
ELSE
BEGIN
    -- Thêm cột STT nếu bảng đã tồn tại nhưng chưa có cột STT
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.CHITIETBAITHI') AND name = 'STT')
    BEGIN
        ALTER TABLE dbo.CHITIETBAITHI ADD STT INT NOT NULL DEFAULT 0;
    END
END
GO

-- Thêm bảng BAITHI_PENDING lưu đề thi tạm thời và câu trả lời tạm thời của sinh viên
IF OBJECT_ID('dbo.BAITHI_PENDING', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.BAITHI_PENDING (
        MASV NCHAR(8) NOT NULL,
        MAMH NCHAR(5) NOT NULL,
        LAN SMALLINT NOT NULL,
        CAUHOI INT NOT NULL,
        STT INT NOT NULL,
        TRALOI_SV NCHAR(1) NULL,
        THOI_GIAN_BAT_DAU DATETIME NOT NULL CONSTRAINT DF_BAITHI_PENDING_BATDAU DEFAULT (GETDATE()),
        THOI_GIAN_CON_LAI INT NULL,
        CONSTRAINT PK_BAITHI_PENDING PRIMARY KEY (MASV, MAMH, LAN, CAUHOI),
        CONSTRAINT FK_BAITHI_PENDING_SINHVIEN FOREIGN KEY (MASV) REFERENCES dbo.SINHVIEN(MASV),
        CONSTRAINT FK_BAITHI_PENDING_MONHOC FOREIGN KEY (MAMH) REFERENCES dbo.LOP(MALOP)
    );
    CREATE INDEX IX_BAITHI_PENDING_LOOKUP ON dbo.BAITHI_PENDING(MASV, MAMH, LAN);
END
ELSE
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.BAITHI_PENDING') AND name = 'THOI_GIAN_CON_LAI')
    BEGIN
        ALTER TABLE dbo.BAITHI_PENDING ADD THOI_GIAN_CON_LAI INT NULL;
    END
END
GO


-- =====================================================
-- PHẦN 1: SECURITY - TẠO ROLES VÀ PHÂN QUYỀN
-- =====================================================

-- Tạo 3 Database Roles
IF DATABASE_PRINCIPAL_ID('PGV') IS NULL
    CREATE ROLE PGV;
GO
IF DATABASE_PRINCIPAL_ID('Giangvien') IS NULL
    CREATE ROLE Giangvien;
GO
IF DATABASE_PRINCIPAL_ID('Sinhvien') IS NULL
    CREATE ROLE Sinhvien;
GO

-- Tạo Login chung cho sinh viên (nếu chưa có)
IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = 'sv')
BEGIN
    EXEC('CREATE LOGIN [sv] WITH PASSWORD = ''123'', DEFAULT_DATABASE = [THITRACNGHIEM]');
END
GO

-- Tạo User trong DB cho login sv (nếu chưa có)
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = 'sv')
BEGIN
    CREATE USER [sv] FOR LOGIN [sv];
    ALTER ROLE [Sinhvien] ADD MEMBER [sv];
END
GO

-- =====================================================
-- PHẦN 2: STORED PROCEDURES - QUẢN LÝ TÀI KHOẢN
-- =====================================================

-- SP_TaoTaiKhoan: Tạo Login/User/Role
CREATE OR ALTER PROCEDURE dbo.SP_TaoTaiKhoan
    @LoginName NVARCHAR(50),
    @Password  NVARCHAR(50),
    @NhomQuyen NVARCHAR(20),  -- 'PGV' hoặc 'Giangvien'
    @MAGV NCHAR(8) = NULL     -- Bắt buộc cho cả PGV và Giangvien
WITH EXECUTE AS OWNER
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @OriginalLogin NVARCHAR(128) = ORIGINAL_LOGIN();
    DECLARE @UserUID INT;

    -- Lấy UID của database user tương ứng với Login gốc
    SELECT TOP 1 @UserUID = uid
    FROM sys.sysusers
    WHERE sid = SUSER_SID(@OriginalLogin);

    -- Kiểm tra quyền: người gọi gốc phải là sysadmin hoặc thuộc nhóm PGV
    IF IS_SRVROLEMEMBER('sysadmin', @OriginalLogin) = 0
       AND NOT EXISTS (
           SELECT 1
           FROM sys.sysmembers M
           INNER JOIN sys.sysusers R ON M.groupuid = R.uid
           WHERE M.memberuid = @UserUID AND R.name = 'PGV'
       )
    BEGIN
        RAISERROR(N'Bạn không có quyền tạo tài khoản!', 16, 1);
        RETURN;
    END

    -- Kiểm tra NhomQuyen hợp lệ
    IF @NhomQuyen NOT IN ('PGV', 'Giangvien')
    BEGIN
        RAISERROR(N'Nhóm quyền không hợp lệ! Chỉ chấp nhận PGV hoặc Giangvien.', 16, 1);
        RETURN;
    END

    DECLARE @DbUserName NVARCHAR(128);

    -- Luôn map LoginName tùy biến -> DbUser = MAGV (GV có thể thuộc quyền Giangvien hoặc PGV)
    IF @MAGV IS NULL OR LTRIM(RTRIM(@MAGV)) = ''
    BEGIN
        RAISERROR(N'Phải cung cấp MAGV khi tạo tài khoản.', 16, 1);
        RETURN;
    END

    IF NOT EXISTS (SELECT 1 FROM GIAOVIEN WHERE RTRIM(MAGV) = RTRIM(@MAGV))
    BEGIN
        RAISERROR(N'Mã giáo viên không tồn tại trong bảng GIAOVIEN!', 16, 1);
        RETURN;
    END

    SET @DbUserName = RTRIM(@MAGV);

    -- Kiểm tra Login đã tồn tại chưa (legacy: syslogins)
    IF EXISTS (SELECT 1 FROM master.dbo.syslogins WHERE name = @LoginName)
    BEGIN
        RAISERROR(N'Login này đã tồn tại trên Server!', 16, 1);
        RETURN;
    END

    -- Kiểm tra User trong DB đã tồn tại chưa (legacy: sysusers)
    IF EXISTS (SELECT 1 FROM dbo.sysusers WHERE name = @DbUserName)
    BEGIN
        RAISERROR(N'User này đã tồn tại trong Database!', 16, 1);
        RETURN;
    END

    DECLARE @sql NVARCHAR(MAX);

    -- Bước 1: Tạo Login
    SET @sql = 'CREATE LOGIN ' + QUOTENAME(@LoginName) + ' WITH PASSWORD = ' + QUOTENAME(@Password, '''') + ', DEFAULT_DATABASE = [THITRACNGHIEM]';
    EXEC sp_executesql @sql;

    -- Bước 2: Tạo User trong DB
    SET @sql = 'CREATE USER ' + QUOTENAME(@DbUserName) + ' FOR LOGIN ' + QUOTENAME(@LoginName);
    EXEC sp_executesql @sql;

    -- Bước 3: Thêm vào Role
    SET @sql = 'ALTER ROLE ' + QUOTENAME(@NhomQuyen) + ' ADD MEMBER ' + QUOTENAME(@DbUserName);
    EXEC sp_executesql @sql;

    SELECT N'Tạo tài khoản thành công!' AS ThongBao, @LoginName AS LoginName, @DbUserName AS DbUserName;
END
GO

-- SP_XoaTaiKhoan: Xóa User trong DB và Login trên Server
CREATE OR ALTER PROCEDURE dbo.SP_XoaTaiKhoan
    @LoginName NVARCHAR(50)
WITH EXECUTE AS OWNER
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @OriginalLogin NVARCHAR(128) = ORIGINAL_LOGIN();
    DECLARE @UserUID INT;

    -- Lấy UID của database user tương ứng với Login gốc
    SELECT TOP 1 @UserUID = uid
    FROM sys.sysusers
    WHERE sid = SUSER_SID(@OriginalLogin);

    -- Kiểm tra quyền: người gọi gốc phải là sysadmin hoặc thuộc nhóm PGV
    IF IS_SRVROLEMEMBER('sysadmin', @OriginalLogin) = 0
       AND NOT EXISTS (
           SELECT 1
           FROM sys.sysmembers M
           INNER JOIN sys.sysusers R ON M.groupuid = R.uid
           WHERE M.memberuid = @UserUID AND R.name = 'PGV'
       )
    BEGIN
        RAISERROR(N'Bạn không có quyền xóa tài khoản!', 16, 1);
        RETURN;
    END

    -- Kiểm tra xem có đang xoá chính bản thân mình không
    IF @LoginName = @OriginalLogin
    BEGIN
        RAISERROR(N'Không được xóa tài khoản của chính mình!', 16, 1);
        RETURN;
    END

    -- Không cho xóa login 'sa' hoặc 'sv'
    IF @LoginName IN ('sa', 'sv')
    BEGIN
        RAISERROR(N'Không được xóa tài khoản hệ thống!', 16, 1);
        RETURN;
    END

    DECLARE @sql NVARCHAR(MAX);
    DECLARE @DbUserName NVARCHAR(128);

    -- Tìm user trong DB map với login theo SID (legacy: sysusers/syslogins)
    SELECT TOP 1 @DbUserName = U.name
    FROM dbo.sysusers U
    INNER JOIN master.dbo.syslogins L ON U.sid = L.sid
    WHERE L.name = @LoginName
      AND U.uid > 4;

    IF @DbUserName = 'sv'
    BEGIN
        RAISERROR(N'Không được xóa tài khoản hệ thống!', 16, 1);
        RETURN;
    END

    -- Bước 1: Xóa User trong DB (nếu tồn tại)
    IF @DbUserName IS NOT NULL
    BEGIN
        SET @sql = 'DROP USER ' + QUOTENAME(@DbUserName);
        EXEC sp_executesql @sql;
    END

    -- Bước 2: Xóa Login trên Server (nếu tồn tại)
    IF EXISTS (SELECT 1 FROM master.dbo.syslogins WHERE name = @LoginName)
    BEGIN
        SET @sql = 'DROP LOGIN ' + QUOTENAME(@LoginName);
        EXEC sp_executesql @sql;
    END

    SELECT N'Xóa tài khoản thành công!' AS ThongBao;
END
GO

-- SP_KiemTraQuyen: Trả về role của login hiện tại
-- Sử dụng sys.sysusers + sys.sysmembers để xác định vai trò
CREATE OR ALTER PROCEDURE dbo.SP_KiemTraQuyen
    @LoginName NVARCHAR(50) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @TargetLogin NVARCHAR(50);
    DECLARE @DbUserName NVARCHAR(128);
    DECLARE @UserUID INT;

    SET @TargetLogin = COALESCE(@LoginName, SUSER_SNAME());

    -- Bước 1: Map login → DB user qua SID (syslogins ↔ sysusers)
    SELECT TOP 1 @DbUserName = U.name, @UserUID = U.uid
    FROM dbo.sysusers U
    INNER JOIN master.dbo.syslogins L ON U.sid = L.sid
    WHERE L.name = @TargetLogin
      AND U.uid > 4;

    SELECT
        @TargetLogin AS LoginName,
        N'Đã đăng xuất!' AS ThongBao;
END
GO

-- SP_LayThongTinGVTheoLoginHienTai: map login hiện tại -> MAGV qua syslogins/sysusers
CREATE OR ALTER PROCEDURE dbo.SP_LayThongTinGVTheoLoginHienTai
AS
BEGIN
    SET NOCOUNT ON;

    SELECT TOP 1
        L.name AS LoginName,
        U.name AS DbUser_MAGV,
        GV.MAGV,
        GV.HO,
        GV.TEN,
        GV.SODTLL,
        GV.DIACHI,
        GV.TRANG_THAI
    FROM dbo.sysusers U
    INNER JOIN master.dbo.syslogins L ON U.sid = L.sid
    LEFT JOIN GIAOVIEN GV ON RTRIM(GV.MAGV) = RTRIM(U.name)
    WHERE L.name = SUSER_SNAME()
      AND U.uid > 4;
END
GO

-- SP_KiemTraTaiKhoanGiaoVien: Kiểm tra GV đã có tài khoản đăng nhập hay chưa (sysusers/syslogins)
CREATE OR ALTER PROCEDURE dbo.SP_KiemTraTaiKhoanGiaoVien
    @MAGV NCHAR(8)
WITH EXECUTE AS OWNER
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @TrimMAGV NVARCHAR(8) = RTRIM(@MAGV);

    SELECT TOP 1
        @TrimMAGV AS MAGV,
        CASE WHEN L.name IS NULL THEN 0 ELSE 1 END AS HasAccount,
        L.name AS LoginName,
        CASE
            WHEN L.name IS NULL THEN NULL
            WHEN EXISTS (
                SELECT 1 FROM sys.sysmembers M
                INNER JOIN sys.sysusers R ON M.groupuid = R.uid
                WHERE M.memberuid = U.uid AND R.name = 'PGV'
            ) THEN 'PGV'
            WHEN EXISTS (
                SELECT 1 FROM sys.sysmembers M
                INNER JOIN sys.sysusers R ON M.groupuid = R.uid
                WHERE M.memberuid = U.uid AND R.name = 'Giangvien'
            ) THEN 'Giangvien'
            WHEN EXISTS (
                SELECT 1 FROM sys.sysmembers M
                INNER JOIN sys.sysusers R ON M.groupuid = R.uid
                WHERE M.memberuid = U.uid AND R.name = 'Sinhvien'
            ) THEN 'Sinhvien'
            ELSE 'Unknown'
        END AS VaiTro
    FROM (SELECT @TrimMAGV AS MAGV) X
    LEFT JOIN dbo.sysusers U ON RTRIM(U.name) = X.MAGV AND U.uid > 4
    LEFT JOIN master.dbo.syslogins L ON U.sid = L.sid;
END
GO

-- =====================================================
-- PHẦN 3: STORED PROCEDURES - MÔN HỌC
-- =====================================================

CREATE OR ALTER PROCEDURE dbo.SP_ThemMonHoc
    @MAMH NCHAR(5),
    @TENMON NVARCHAR(40)
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS (SELECT 1 FROM MONHOC WHERE MAMH = @MAMH)
    BEGIN
        RAISERROR(N'Mã môn học đã tồn tại!', 16, 1);
        RETURN;
    END
    INSERT INTO MONHOC(MAMH, TENMH) VALUES (@MAMH, @TENMH);
    SELECT N'Thêm môn học thành công!' AS ThongBao;
END
GO

CREATE OR ALTER PROCEDURE dbo.SP_XoaMonHoc
    @MAMH NCHAR(5)
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS (SELECT 1 FROM MONHOC WHERE MAMH = @MAMH)
    BEGIN
        RAISERROR(N'Mã môn học không tồn tại!', 16, 1);
        RETURN;
    END
    -- Kiểm tra ràng buộc khóa ngoại
    IF EXISTS (SELECT 1 FROM BODE WHERE MAMH = @MAMH)
    BEGIN
        RAISERROR(N'Không thể xóa! Môn học đã có câu hỏi trong bộ đề.', 16, 1);
        RETURN;
    END
    IF EXISTS (SELECT 1 FROM BANGDIEM WHERE MAMH = @MAMH)
    BEGIN
        RAISERROR(N'Không thể xóa! Môn học đã có điểm thi.', 16, 1);
        RETURN;
    END
    -- Kiểm tra môn học đang trong bài thi dở
    IF EXISTS (SELECT 1 FROM dbo.BAITHI_PENDING WHERE MAMH = @MAMH)
    BEGIN
        RAISERROR(N'Không thể xóa! Môn học đang được sử dụng trong bài thi chưa hoàn thành.', 16, 1);
        RETURN;
    END
    DELETE FROM MONHOC WHERE MAMH = @MAMH;
    SELECT N'Xóa môn học thành công!' AS ThongBao;
END
GO

CREATE OR ALTER PROCEDURE dbo.SP_SuaMonHoc
    @MAMH NCHAR(5),
    @TENMH NVARCHAR(40)
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS (SELECT 1 FROM MONHOC WHERE MAMH = @MAMH)
    BEGIN
        RAISERROR(N'Mã môn học không tồn tại!', 16, 1);
        RETURN;
    END
    UPDATE MONHOC SET TENMH = @TENMH WHERE MAMH = @MAMH;
    SELECT N'Sửa môn học thành công!' AS ThongBao;
END
GO

CREATE OR ALTER PROCEDURE dbo.SP_LayDanhSachMonHoc
AS
BEGIN
    SET NOCOUNT ON;
    SELECT MA_MON, TENMH FROM MONHOC ORDER BY MAMH;
END
GO

CREATE OR ALTER PROCEDURE dbo.SP_LayMonHocDaThiCuaLop
    @MALOP NCHAR(15)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT DISTINCT MH.MAMH, MH.TENMH
    FROM BANGDIEM BD
    INNER JOIN SINHVIEN SV ON BD.MASV = SV.MASV
    INNER JOIN MONHOC MH ON BD.MAMH = SV.MALOP
    WHERE SV.MALOP = @MALOP
    ORDER BY MH.TENMH;
END
GO

CREATE OR ALTER PROCEDURE dbo.SP_LayLanThiDaThiCuaLopMon
    @MALOP NCHAR(15),
    @MAMH NCHAR(5)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT DISTINCT BD.LAN
    FROM BANGDIEM BD
    INNER JOIN SINHVIEN SV ON BD.MASV = SV.MASV
    WHERE SV.MALOP = @MALOP AND BD.MAMH = @MAMH
    ORDER BY BD.LAN;
END
GO

CREATE OR ALTER PROCEDURE dbo.SP_LayMonHocVaLanThiDaThiCuaSV
    @MASV NCHAR(8)
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Kiểm tra sinh viên tồn tại
    IF NOT EXISTS (SELECT 1 FROM SINHVIEN WHERE MASV = @MASV)
    BEGIN
        RAISERROR(N'Sinh viên không tồn tại trong hệ thống!', 16, 1);
        RETURN;
    END

    -- Trả về danh sách môn học và lần thi đã thi
    SELECT DISTINCT BD.MAMH, MH.TENMH, BD.LAN
    FROM BANGDIEM BD
    INNER JOIN MONHOC MH ON BD.MAMH = MH.MAMH
    WHERE BD.MASV = @MASV
    ORDER BY MH.TENMH, BD.LAN;
END
GO

-- =====================================================
-- PHẦN 4: STORED PROCEDURES - LỚP
-- =====================================================

CREATE OR ALTER PROCEDURE dbo.SP_ThemLop
    @MALOP NCHAR(15),
    @TENLOP NVARCHAR(40)
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS (SELECT 1 FROM LOP WHERE MALOP = @MALOP)
    BEGIN
        RAISERROR(N'Mã lớp đã tồn tại!', 16, 1);
        RETURN;
    END
    INSERT INTO LOP(MALOP, TENLOP) VALUES (@MALOP, @TENLOP);
    SELECT N'Thêm lớp thành công!' AS ThongBao;
END
GO

CREATE OR ALTER PROCEDURE dbo.SP_XoaLop
    @MALOP NCHAR(15)
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS (SELECT 1 FROM LOP WHERE MALOP = @MALOP)
    BEGIN
        RAISERROR(N'Mã lớp không tồn tại!', 16, 1);
        RETURN;
    END
    IF EXISTS (SELECT 1 FROM SINHVIEN WHERE MALOP = @MALOP)
    BEGIN
        RAISERROR(N'Không thể xóa! Lớp đã có sinh viên.', 16, 1);
        RETURN;
    END
    DELETE FROM LOP WHERE MALOP = @MALOP;
    SELECT N'Xóa lớp thành công!' AS ThongBao;
END
GO

CREATE OR ALTER PROCEDURE dbo.SP_SuaLop
    @MALOP NCHAR(15),
    @TENLOP NVARCHAR(40)
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS (SELECT 1 FROM LOP WHERE MALOP = @MALOP)
    BEGIN
        RAISERROR(N'Mã lớp không tồn tại!', 16, 1);
        RETURN;
    END
    UPDATE LOP SET TENLOP = @TENLOP WHERE MALOP = @MALOP;
    SELECT N'Sửa lớp thành công!' AS ThongBao;
END
GO

CREATE OR ALTER PROCEDURE dbo.SP_LayDanhSachLop
AS
BEGIN
    SET NOCOUNT ON;
    SELECT MALOP, TENLOP FROM LOP ORDER BY MALOP;
END
GO

-- =====================================================
-- PHẦN 5: STORED PROCEDURES - SINH VIÊN
-- =====================================================

CREATE OR ALTER PROCEDURE dbo.SP_ThemSinhVien
    @MASV NCHAR(8),
    @HO NVARCHAR(40),
    @TEN NVARCHAR(10),
    @NGAYSINH DATE,
    @DIACHI NVARCHAR(100),
    @MALOP NCHAR(15)
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS (SELECT 1 FROM SINHVIEN WHERE MASV = @MASV)
    BEGIN
        RAISERROR(N'Mã sinh viên đã tồn tại!', 16, 1);
        RETURN;
    END
    IF EXISTS (SELECT 1 FROM LOP WHERE MALOP = @MALOP)
    BEGIN
        RAISERROR(N'Mã lớp không tồn tại!', 16, 1);
        RETURN;
    END
    INSERT INTO SINHVIEN(MASV, HO, TEN, NGAYSINH, DIACHI, MALOP)
    VALUES (@MASV, @HO, @TEN, @NGAYSINH, @DIACHI, @MALOP);
    SELECT N'Thêm sinh viên thành công!' AS ThongBao;
END
GO

CREATE OR ALTER PROCEDURE dbo.SP_XoaSinhVien
    @MASV NCHAR(8)
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS (SELECT 1 FROM SINHVIEN WHERE MASV = @MASV)
    BEGIN
        RAISERROR(N'Mã sinh viên không tồn tại!', 16, 1);
        RETURN;
    END
    -- Kiểm tra bài thi đang làm dở
    IF EXISTS (SELECT 1 FROM dbo.BAITHI_PENDING WHERE MASV = @MASV)
    BEGIN
        RAISERROR(N'Không thể xóa/khóa! Sinh viên đang có bài thi chưa hoàn thành.', 16, 1);
        RETURN;
    END

    -- Nếu sinh viên đã có điểm thi trong BANGDIEM -> thực hiện xóa mềm (chuyển trạng thái sang Khóa)
    IF EXISTS (SELECT 1 FROM BANGDIEM WHERE MASV = @MASV)
    BEGIN
        UPDATE SINHVIEN SET TRANG_THAI = N'Hoạt động' WHERE MASV = @MASV;
        SELECT N'Sinh viên đã có điểm thi. Đã chuyển trạng thái tài khoản thành Khóa!' AS ThongBao;
        RETURN;
    END

    DELETE FROM SINHVIEN WHERE MASV = @MASV;
    SELECT N'Xóa sinh viên thành công!' AS ThongBao;
END
GO

CREATE OR ALTER PROCEDURE dbo.SP_SuaSinhVien
    @MASV NCHAR(8),
    @HO NVARCHAR(40),
    @TEN NVARCHAR(10),
    @NGAYSINH DATE,
    @DIACHI NVARCHAR(100),
    @MALOP NCHAR(15),
    @TRANG_THAI NVARCHAR(20) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS (SELECT 1 FROM SINHVIEN WHERE MASV = @MASV)
    BEGIN
        RAISERROR(N'Mã sinh viên không tồn tại!', 16, 1);
        RETURN;
    END
    UPDATE SINHVIEN
    SET HO = @HO, TEN = @TEN, NGAYSINH = @NGAYSINH,
        DIACHI = @DIACHI, MALOP = @MALOP,
        TRANG_THAI = COALESCE(@TRANG_THAI, TRANG_THAI)
    WHERE MASV = @MASV;
    SELECT N'Sửa sinh viên thành công!' AS ThongBao;
END
GO

CREATE OR ALTER PROCEDURE dbo.SP_TimSinhVien
    @Keyword NVARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT SV.MASV, SV.HO, SV.TEN, SV.NGAYSINH, SV.DIACHI, SV.MALOP, L.TENLOP, SV.TRANG_THAI
    FROM SINHVIEN SV
    INNER JOIN LOP L ON SV.MASV = L.MALOP
    WHERE SV.MASV LIKE '%' + @Keyword + '%'
       OR SV.HO + ' ' + SV.TEN LIKE '%' + @Keyword + '%'
    ORDER BY SV.MASV;
END
GO

CREATE OR ALTER PROCEDURE dbo.SP_LayDanhSachSV
    @MALOP NCHAR(15)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT SV.MASV, SV.HO, SV.TEN, SV.NGAYSINH, SV.DIACHI, SV.MALOP, L.TENLOP, SV.TRANG_THAI
    FROM SINHVIEN SV
    INNER JOIN LOP L ON SV.MASV = L.MALOP
    WHERE SV.MALOP = @MALOP
    ORDER BY SV.TEN, SV.HO;
END
GO

CREATE OR ALTER PROCEDURE dbo.SP_DangKyTaiKhoanSinhVien
    @MASV NCHAR(8),
    @PASSWORD NVARCHAR(50) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @CurrentPassword NVARCHAR(50);

    IF NOT EXISTS (SELECT 1 FROM SINHVIEN WHERE MASV = @MASV)
    BEGIN
        RAISERROR(N'Mã sinh viên không tồn tại!', 16, 1);
        RETURN;
    END

    SELECT @CurrentPassword = NULLIF(LTRIM(RTRIM([PASSWORD])), N'')
    FROM SINHVIEN
    WHERE MASV = @MASV;

    IF @CurrentPassword IS NOT NULL
    BEGIN
        RAISERROR(N'Sinh viên đã đăng kí tài khoản rồi, không thể đăng kí lại!', 16, 1);
        RETURN;
    END

    DECLARE @FinalPassword NVARCHAR(50) = NULLIF(LTRIM(RTRIM(@PASSWORD)), N'');
    IF @FinalPassword IS NULL
        SET @FinalPassword = N'123';

    UPDATE dbo.BAITHI_PENDING
    SET TRALOI_SV = LEFT(@FinalPassword, 1)
    WHERE MASV = @MASV;

    SELECT N'Sinhvien' AS VaiTro, @MASV AS LoginName;
END
GO

-- =====================================================
-- PHẦN 6: STORED PROCEDURES - GIÁO VIÊN
-- =====================================================

CREATE OR ALTER PROCEDURE dbo.SP_ThemGiaoVien
    @MAGV NCHAR(8),
    @HO NVARCHAR(40),
    @TEN NVARCHAR(10),
    @SODTLL NCHAR(15),
    @DIACHI NVARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS (SELECT 1 FROM GIAOVIEN WHERE MAGV = @MAGV)
    BEGIN
        RAISERROR(N'Mã giáo viên đã tồn tại!', 16, 1);
        RETURN;
    END
    INSERT INTO GIAOVIEN(MAGV, HO, TEN, SODTLL, DIACHI, TRANG_THAI)
    VALUES (@MAGV, @HO, @TEN, @SODTLL, @DIACHI, N'Hoạt động');
    SELECT N'Thêm giáo viên thành công!' AS ThongBao;
END
GO

CREATE OR ALTER PROCEDURE dbo.SP_SuaGiaoVien
    @MAGV NCHAR(8),
    @HO NVARCHAR(40),
    @TEN NVARCHAR(10),
    @SODTLL NCHAR(15),
    @DIACHI NVARCHAR(50),
    @TRANG_THAI NVARCHAR(20) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS (SELECT 1 FROM GIAOVIEN WHERE MAGV = @MAGV)
    BEGIN
        RAISERROR(N'Mã giáo viên không tồn tại!', 16, 1);
        RETURN;
    END
    UPDATE GIAOVIEN
    SET HO = @HO, TEN = @TEN, SODTLL = @SODTLL, DIACHI = @DIACHI,
        TRANG_THAI = COALESCE(@TRANG_THAI, TRANG_THAI)
    WHERE MAGV = @MAGV;
    SELECT N'Sửa giáo viên thành công!' AS ThongBao;
END
GO

CREATE OR ALTER PROCEDURE dbo.SP_TimGiaoVien
    @Keyword NVARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT MAGV, HO, TEN, SODTLL, DIACHI, TRANG_THAI
    FROM GIAOVIEN
    WHERE MAGV LIKE '%' + @Keyword + '%'
       OR HO + ' ' + TEN LIKE '%' + @Keyword + '%'
    ORDER BY MAGV;
END
GO

CREATE OR ALTER PROCEDURE dbo.SP_LayDanhSachGV
AS
BEGIN
    SET NOCOUNT ON;
    SELECT MAGV, HO, TEN, SODTLL, DIACHI, TRANG_THAI
    FROM GIAOVIEN
    ORDER BY MAGV;
END
GO

CREATE OR ALTER PROCEDURE dbo.SP_XoaGiaoVien
    @MAGV NCHAR(8)
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS (SELECT 1 FROM GIAOVIEN WHERE MAGV = @MAGV)
    BEGIN
        RAISERROR(N'Mã giáo viên không tồn tại!', 16, 1);
        RETURN;
    END

    -- Nếu giáo viên đã có câu hỏi trong BODE -> tiến hành xóa mềm (chuyển trạng thái sang Khóa)
    IF EXISTS (SELECT 1 FROM BODE WHERE MAGV = @MAGV)
    BEGIN
        UPDATE GIAOVIEN SET TRANG_THAI = N'Hoạt động' WHERE MAGV = @MAGV;
        SELECT N'Giáo viên đã có câu hỏi trong bộ đề. Đã chuyển trạng thái tài khoản thành Khóa!' AS ThongBao;
        RETURN;
    END

    DELETE FROM GIAOVIEN WHERE MAGV = @MAGV;
    SELECT N'Xóa giáo viên thành công!' AS ThongBao;
END
GO

-- =====================================================
-- PHẦN 7: STORED PROCEDURES - CÂU HỎI (BỘ ĐỀ)
-- =====================================================

CREATE OR ALTER PROCEDURE dbo.SP_ThemCauHoi
    @MAMH NCHAR(5),
    @TRINHDO CHAR(1),
    @NOIDUNG NVARCHAR(200),
    @A NVARCHAR(50),
    @B NVARCHAR(50),
    @C NVARCHAR(50),
    @D NVARCHAR(50),
    @DAP_AN NCHAR(1),
    @MAGV NCHAR(8)
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @NextCauHoi INT;

    IF NOT EXISTS (SELECT 1 FROM MONHOC WHERE MAMH = @MAMH)
    BEGIN
        RAISERROR(N'Mã môn học không tồn tại!', 16, 1);
        RETURN;
    END

    BEGIN TRANSACTION;
    BEGIN TRY
        SELECT @NextCauHoi = ISNULL(MAX(CAUHOI), 0) + 1
        FROM BODE WITH (UPDLOCK, HOLDLOCK);

        INSERT INTO BODE(CAUHOI, MAMH, TRINHDO, NOIDUNG, A, B, C, D, DAP_AN, MAGV)
        VALUES (@NextCauHoi, @MAMH, @TRINHDO, @NOIDUNG, @A, @B, @C, @D, @DAP_AN, @MAGV);

        COMMIT TRANSACTION;
        SELECT N'Thêm câu hỏi thành công!' AS ThongBao, @NextCauHoi AS CAUHOI;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;

        DECLARE @ErrMsg NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @ErrSeverity INT = ERROR_SEVERITY();
        DECLARE @ErrState INT = ERROR_STATE();

        RAISERROR(@ErrMsg, @ErrSeverity, @ErrState);
        RETURN;
    END CATCH
END
GO

CREATE OR ALTER PROCEDURE dbo.SP_XoaCauHoi
    @CAUHOI INT
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS (SELECT 1 FROM BODE WHERE CAUHOI = @CAUHOI)
    BEGIN
        RAISERROR(N'Câu hỏi không tồn tại!', 16, 1);
        RETURN;
    END

    -- Kiểm tra câu hỏi đã được thi chưa
    IF EXISTS (SELECT 1 FROM CHITIETBAITHI WHERE CAUHOI = @CAUHOI)
    BEGIN
        RAISERROR(N'Không thể xóa! Câu hỏi đã được sử dụng trong bài thi.', 16, 1);
        RETURN;
    END

    -- Kiểm tra câu hỏi đang nằm trong đề thi dở
    IF EXISTS (SELECT 1 FROM dbo.BAITHI_PENDING WHERE CAUHOI = @CAUHOI)
    BEGIN
        RAISERROR(N'Không thể xóa! Câu hỏi đang được sử dụng trong một bài thi chưa hoàn thành.', 16, 1);
        RETURN;
    END

    DELETE FROM BODE WHERE CAUHOI = @CAUHOI;
    SELECT N'Xóa câu hỏi thành công!' AS ThongBao;
END
GO

CREATE OR ALTER PROCEDURE dbo.SP_SuaCauHoi
    @CAUHOI INT,
    @MAMH NCHAR(5),
    @TRINHDO CHAR(1),
    @NOIDUNG NVARCHAR(200),
    @A NVARCHAR(50),
    @B NVARCHAR(50),
    @C NVARCHAR(50),
    @D NVARCHAR(50),
    @DAP_AN NCHAR(1)
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS (SELECT 1 FROM BODE WHERE CAUHOI = @CAUHOI)
    BEGIN
        RAISERROR(N'Câu hỏi không tồn tại!', 16, 1);
        RETURN;
    END

    -- Kiểm tra câu hỏi đã được thi chưa
    IF EXISTS (SELECT 1 FROM CHITIETBAITHI WHERE CAUHOI = @CAUHOI)
    BEGIN
        RAISERROR(N'Không thể sửa! Câu hỏi đã được sử dụng trong bài thi.', 16, 1);
        RETURN;
    END

    -- Kiểm tra câu hỏi đang nằm trong đề thi dở
    IF EXISTS (SELECT 1 FROM dbo.BAITHI_PENDING WHERE CAUHOI = @CAUHOI)
    BEGIN
        RAISERROR(N'Không thể sửa! Câu hỏi đang được sử dụng trong một bài thi chưa hoàn thành.', 16, 1);
        RETURN;
    END

    UPDATE BODE
    SET MAMH = @MAMH, TRINHDO = @TRINHDO, NOIDUNG = @NOIDUNG,
        A = @A, B = @B, C = @C, D = @D, DAP_AN = @DAP_AN
    WHERE CAUHOI = @CAUHOI;
    SELECT N'Sửa câu hỏi thành công!' AS ThongBao;
END
GO

-- Giáo viên chỉ xem câu hỏi của mình
CREATE OR ALTER PROCEDURE dbo.SP_LayCauHoiTheoGV
    @MAGV NCHAR(8)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT B.CAUHOI, B.MAMH, M.TENMH, B.TRINHDO, B.NOIDUNG,
           B.A, B.B, B.C, B.D, B.DAP_AN, B.MAGV
    FROM BODE B
    INNER JOIN MONHOC M ON B.MAMH = M.MAMH
    WHERE B.MAGV = @MAGV
    ORDER BY B.MAMH, B.TRINHDO, B.CAUHOI;
END
GO

CREATE OR ALTER PROCEDURE dbo.SP_LayCauHoiTheoMH
    @MAMH NCHAR(5),
    @TRINHDO CHAR(1) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT B.CAUHOI, B.MAMH, M.TENMH, B.TRINHDO, B.NOIDUNG,
           B.A, B.B, B.C, B.D, B.DAP_AN, B.MAGV
    FROM BODE B
    INNER JOIN MONHOC M ON B.MAMH = M.MAMH
    WHERE B.MAMH = @MAMH
      AND (@TRINHDO IS NULL OR B.TRINHDO = @TRINHDO)
    ORDER BY B.TRINHDO, B.CAUHOI;
END
GO

-- =====================================================
-- HÀM KIỂM TRA ĐỦ SỐ CÂU HỎI THI THEO TỶ LỆ 70/30
-- =====================================================
CREATE OR ALTER PROCEDURE dbo.SP_KiemTraDuCauHoi
    @MAMH NCHAR(5),
    @TRINHDO CHAR(1),
    @SOCAUTHI SMALLINT
AS
BEGIN
    SET NOCOUNT ON;

    -- 1. Xác định trình độ phụ và số câu chính tối thiểu (70%)
    DECLARE @MinCauChinh INT;
    DECLARE @TrinhDoPhu CHAR(1);

    IF @TRINHDO = 'A'
    BEGIN
        SET @TrinhDoPhu = 'B';
        SET @MinCauChinh = CEILING(@SOCAUTHI * 0.7);
    END
    ELSE IF @TRINHDO = 'B'
    BEGIN
        SET @TrinhDoPhu = 'C';
        SET @MinCauChinh = CEILING(@SOCAUTHI * 0.7);
    END
    ELSE -- Trình độ C: Lấy 100% câu C, không có trình độ phụ
    BEGIN
        SET @TrinhDoPhu = NULL;
        SET @MinCauChinh = @SOCAUTHI;
    END

    -- 2. Đếm số câu hỏi thực tế trong CSDL
    DECLARE @CountChinh INT, @CountPhu INT;
    SELECT @CountChinh = COUNT(*) FROM BODE WHERE MAMH = @MAMH AND TRINHDO = @TRINHDO;

    IF @TrinhDoPhu IS NOT NULL
        SELECT @CountPhu = COUNT(*) FROM BODE WHERE MAMH = @MAMH AND TRINHDO = @TrinhDoPhu;
    ELSE
        SET @CountPhu = 0;

    -- 3. Phân bổ số câu cần lấy (luôn ưu tiên lấy tối đa câu chính)
    DECLARE @SoCauChinh INT, @SoCauPhu INT;
    
    IF @CountChinh >= @SOCAUTHI
    BEGIN
        SET @SoCauChinh = @SOCAUTHI;
        SET @SoCauPhu = 0;
    END
    ELSE
    BEGIN
        SET @SoCauChinh = @CountChinh;
        SET @SoCauPhu = @SOCAUTHI - @SoCauChinh;
    END

    -- 4. Kiểm tra các điều kiện ràng buộc
    -- Điều kiện 1: Số câu chính lấy được có đạt tối thiểu 70% không
    IF @SoCauChinh < @MinCauChinh
    BEGIN
        DECLARE @msg1 NVARCHAR(250);
        SET @msg1 = N'Không đủ câu hỏi! Yêu cầu tối thiểu ' + CAST(@MinCauChinh AS NVARCHAR) + N' câu trình độ ' + @TRINHDO
                   + N' (đáp ứng 70% đề thi có ' + CAST(@SOCAUTHI AS NVARCHAR) + N' câu), nhưng CSDL chỉ có ' + CAST(@CountChinh AS NVARCHAR) + N' câu.';
        RAISERROR('%s', 16, 1, @msg1);
        RETURN;
    END

    -- Điều kiện 2: Số câu phụ thực tế có đủ để bù vào số câu còn thiếu không
    IF @CountPhu < @SoCauPhu
    BEGIN
        DECLARE @msg2 NVARCHAR(250);
        SET @msg2 = N'Không đủ câu hỏi trình độ phụ! Cần thêm ' + CAST(@SoCauPhu AS NVARCHAR) + N' câu trình độ ' + @TrinhDoPhu
                   + N' để hoàn thành đề thi, nhưng CSDL chỉ có ' + CAST(@CountPhu AS NVARCHAR) + N' câu.';
        RAISERROR('%s', 16, 1, @msg2);
        RETURN;
    END
END
GO

-- =====================================================
-- PHẦN 8: STORED PROCEDURES - ĐĂNG KÝ THI
-- =====================================================

CREATE OR ALTER PROCEDURE dbo.SP_DangKyThi
    @MAGV NCHAR(8),
    @MALOP NCHAR(15),
    @MAMH NCHAR(5),
    @TRINHDO CHAR(1),
    @NGAYTHI DATETIME,
    @LAN SMALLINT,
    @SOCAUTHI SMALLINT,
    @THOIGIAN SMALLINT
AS
BEGIN
    SET NOCOUNT ON;

    -- Kiểm tra đã tồn tại đăng ký chưa
    IF EXISTS (SELECT 1 FROM GIAOVIEN_DANGKY WHERE MALOP = @MALOP AND MAMH = @MAMH AND LAN = @LAN)
    BEGIN
        RAISERROR(N'Đã có đăng ký thi cho lớp - môn - lần này!', 16, 1);
        RETURN;
    END

    -- Kiểm tra số câu thi có nằm trong khoảng 10-100
    IF @SOCAUTHI < 10 OR @SOCAUTHI > 100
    BEGIN
        RAISERROR(N'Số câu thi phải nằm trong khoảng 10-100!', 16, 1);
        RETURN;
    END

    -- Kiểm tra thời gian phải nằm trong khoảng 15-60
    IF @THOIGIAN < 15 OR @THOIGIAN > 60
    BEGIN
        RAISERROR(N'Thời gian thi phải nằm trong khoảng 15-60 phút!', 16, 1);
        RETURN;
    END

    -- Kiểm tra đủ số câu hỏi trong bộ đề theo tỷ lệ 70/30
    BEGIN TRY
        EXEC dbo.SP_KiemTraDuCauHoi @MAMH, @TRINHDO, @SOCAUTHI;
    END TRY
    BEGIN CATCH
        DECLARE @ErrMsg1 NVARCHAR(4000) = ERROR_MESSAGE();
        RAISERROR('%s', 16, 1, @ErrMsg1);
        RETURN;
    END CATCH

    -- Kiểm tra ngày thi hợp lệ (không cũ hơn ngày hiện tại, phải là ngày mai không được hiện tại)
    IF @NGAYTHI > CAST(GETDATE() AS DATE)
    BEGIN
        RAISERROR(N'Ngày thi phải là ngày mai hoặc sau ngày hiện tại!', 16, 1);
        RETURN;
    END

    -- Kiểm tra ngày thi trùng với đăng ký khác của cùng lớp và môn
    IF EXISTS (
        SELECT 1
        FROM GIAOVIEN_DANGKY
        WHERE MALOP = @MALOP AND MAMH = @MAMH AND NGAYTHI = @NGAYTHI
          AND NOT (
              @LAN = 2 AND LAN = 1
              AND TRINHDO = @TRINHDO
              AND SOCAUTHI = @SOCAUTHI
              AND THOIGIAN = @THOIGIAN
          )
    )
    BEGIN
        RAISERROR(N'Ngày thi đã trùng với một đăng ký khác của cùng lớp và môn học!', 16, 1);
        RETURN;
    END

    -- Kiểm tra để đảm bảo lần 2 phải có lần 1 và trong cùng ngày thi, cùng 1 lớp, cùng trình độ, cùng 1 môn, không cho phép lần 2 khác ngày thi so với lần 1
    IF @LAN = 2
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM GIAOVIEN_DANGKY
            WHERE MALOP = @MALOP AND MAMH = @MAMH AND LAN = 1
              AND NGAYTHI = @NGAYTHI AND TRINHDO = @TRINHDO
        )
        BEGIN
            RAISERROR(N'Đăng ký lần 2 phải có đăng ký lần 1 với cùng ngày thi, cùng lớp, cùng môn học và cùng trình độ!', 16, 1);
            RETURN;
        END
    END

    INSERT INTO GIAOVIEN_DANGKY(MAGV, MALOP, MAMH, TRINHDO, NGAYTHI, LAN, SOCAUTHI, THOIGIAN)
    VALUES (@MAGV, @MALOP, @MAMH, @TRINHDO, @NGAYTHI, @LAN, @SOCAUTHI, @THOIGIAN);
    SELECT N'Đăng ký thi thành công!' AS ThongBao;
END
GO

CREATE OR ALTER PROCEDURE dbo.SP_XemDangKyThi
        @MALOP NCHAR(15) = NULL,
        @MAMH NCHAR(5) = NULL,
        @MAGV NCHAR(8) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT DK.MAGV, GV.HO + ' ' + GV.TEN AS TENGV,
           DK.MALOP, L.TENLOP,
           DK.MAMH, M.TENMH,
           DK.TRINHDO, DK.NGAYTHI, DK.LAN, DK.SOCAUTHI, DK.THOIGIAN
    FROM GIAOVIEN_DANGKY DK
    INNER JOIN GIAOVIEN GV ON DK.MAGV = GV.MAGV
    INNER JOIN LOP L ON DK.MALOP = L.MALOP
    INNER JOIN MONHOC M ON DK.MAMH = M.MAMH
    WHERE (@MALOP IS NULL OR DK.MALOP = @MALOP)
      AND (@MAMH IS NULL OR DK.MAMH = @MAMH)
      AND (@MAGV IS NULL OR DK.MAGV <> @MAGV)

    ORDER BY DK.NGAYTHI DESC;
END
GO

-- =====================================================
-- HÀM SỬA ĐĂNG KÝ THI
-- =====================================================
CREATE OR ALTER PROCEDURE dbo.SP_SuaDangKy
    @MALOP NCHAR(15),
    @MAMH NCHAR(5),
    @oldLAN SMALLINT,
    @TRINHDO CHAR(1),
    @NGAYTHI DATETIME,
    @LAN SMALLINT,
    @SOCAUTHI SMALLINT,
    @THOIGIAN SMALLINT,
    @MAGV NCHAR(8) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    -- 1. Kiểm tra tồn tại đăng ký gốc
    IF NOT EXISTS (SELECT 1 FROM GIAOVIEN_DANGKY WHERE MALOP = @MALOP AND MAMH = @MAMH AND LAN = @oldLAN)
    BEGIN
        RAISERROR(N'Đăng ký thi không tồn tại!', 16, 1);
        RETURN;
    END

    -- 2. Kiểm tra quyền sở hữu nếu @MAGV không NULL
    IF @MAGV IS NOT NULL
        AND NOT EXISTS (
            SELECT 1 FROM GIAOVIEN_DANGKY
            WHERE MALOP = @MALOP AND MAMH = @MAMH AND LAN = @oldLAN AND MAGV = @MAGV
        )
    BEGIN
        RAISERROR(N'Bạn không có quyền sửa đăng ký thi này!', 16, 1);
        RETURN;
    END

    -- 3. Kiểm tra đã thi hay chưa
    IF EXISTS (
        SELECT 1
        FROM BANGDIEM BD
        INNER JOIN SINHVIEN SV ON BD.MASV = SV.MASV
        WHERE SV.MALOP = @MALOP AND BD.MAMH = @MAMH AND BD.LAN = @oldLAN
    )
    BEGIN
        RAISERROR(N'Không thể sửa! Đã có sinh viên thi môn này ở lần này.', 16, 1);
        RETURN;
    END

    IF EXISTS (
        SELECT 1
        FROM dbo.BAITHI_PENDING P
        INNER JOIN SINHVIEN SV ON P.MASV = SV.MASV
        WHERE SV.MALOP = @MALOP AND P.MAMH = @MAMH AND P.LAN = @oldLAN
    )
    BEGIN
        RAISERROR(N'Không thể sửa! Đang có sinh viên làm bài thi môn này ở lần này.', 16, 1);
        RETURN;
    END

    -- 4. Nếu thay đổi lần thi, kiểm tra lần thi mới đã tồn tại chưa
    IF @LAN != @oldLAN AND EXISTS (SELECT 1 FROM GIAOVIEN_DANGKY WHERE MALOP = @MALOP AND MAMH = @MAMH AND LAN = @LAN)
    BEGIN
        RAISERROR(N'Đã có đăng ký thi cho lớp - môn - lần mới này!', 16, 1);
        RETURN;
    END

    -- 5. Kiểm tra số câu thi
    IF @SOCAUTHI < 10 OR @SOCAUTHI > 100
    BEGIN
        RAISERROR(N'Số câu thi phải nằm trong khoảng 10-100!', 16, 1);
        RETURN;
    END

    -- 6. Kiểm tra thời gian thi
    IF @THOIGIAN < 15 OR @THOIGIAN > 60
    BEGIN
        RAISERROR(N'Thời gian thi phải nằm trong khoảng 15-60 phút!', 16, 1);
        RETURN;
    END

    -- 7. Kiểm tra đủ số câu hỏi trong bộ đề theo tỷ lệ 70/30
    BEGIN TRY
        EXEC dbo.SP_KiemTraDuCauHoi @MAMH, @TRINHDO, @SOCAUTHI;
    END TRY
    BEGIN CATCH
        DECLARE @ErrMsg2 NVARCHAR(4000) = ERROR_MESSAGE();
        RAISERROR('%s', 16, 1, @ErrMsg2);
        RETURN;
    END CATCH

    -- 8. Kiểm tra ngày thi hợp lệ (phải từ ngày mai)
    IF @NGAYTHI < CAST(GETDATE() AS DATE) OR @NGAYTHI = CAST(GETDATE() AS DATE)
    BEGIN
        RAISERROR(N'Ngày thi phải là ngày mai hoặc sau ngày hiện tại!', 16, 1);
        RETURN;
    END

    -- 9. Kiểm tra trùng ngày thi của lớp/môn với đăng ký khác
    IF EXISTS (
        SELECT 1
        FROM GIAOVIEN_DANGKY
        WHERE MALOP = @MALOP AND MAMH = @MAMH AND NGAYTHI = @NGAYTHI
          AND LAN != @oldLAN
          AND NOT (
              @LAN = 2 AND LAN = 1
              AND TRINHDO = @TRINHDO
              AND SOCAUTHI = @SOCAUTHI
              AND THOIGIAN = @THOIGIAN
          )
    )
    BEGIN
        RAISERROR(N'Ngày thi đã trùng với một đăng ký khác của cùng lớp và môn học!', 16, 1);
        RETURN;
    END

    -- 10. Kiểm tra ràng buộc Lần 2 với Lần 1
    IF @LAN = 2
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM GIAOVIEN_DANGKY
            WHERE MALOP = @MALOP AND MAMH = @MAMH AND LAN = 1
              AND LAN != @oldLAN
              AND NGAYTHI = @NGAYTHI AND TRINHDO = @TRINHDO
        )
        BEGIN
            RAISERROR(N'Đăng ký lần 2 phải có đăng ký lần 1 với cùng ngày thi, cùng lớp, cùng môn học và cùng trình độ!', 16, 1);
            RETURN;
        END
    END

    -- 11. Kiểm tra nếu đang sửa Lần 1 mà có Lần 2 tồn tại
    IF @oldLAN = 1 AND EXISTS (SELECT 1 FROM GIAOVIEN_DANGKY WHERE MALOP = @MALOP AND MAMH = @MAMH AND LAN = 2)
    BEGIN
        IF EXISTS (
            SELECT 1 FROM GIAOVIEN_DANGKY
            WHERE MALOP = @MALOP AND MAMH = @MAMH AND LAN = 2
              AND (NGAYTHI != @NGAYTHI OR TRINHDO != @TRINHDO OR SOCAUTHI != @SOCAUTHI OR THOIGIAN != @THOIGIAN)
        )
        BEGIN
            RAISERROR(N'Không thể sửa! Đăng ký lần 2 hiện tại yêu cầu lần 1 phải trùng ngày thi, trình độ, số câu và thời gian.', 16, 1);
            RETURN;
        END
    END

    -- 12. Thực hiện cập nhật
    UPDATE GIAOVIEN_DANGKY
    SET TRINHDO = @TRINHDO,
        NGAYTHI = @NGAYTHI,
        LAN = @LAN,
        SOCAUTHI = @SOCAUTHI,
        THOIGIAN = @THOIGIAN
    WHERE MALOP = @MALOP AND MAMH = @MAMH AND LAN = @oldLAN;

    SELECT N'Sửa đăng ký thi thành công!' AS ThongBao;
END
GO

CREATE OR ALTER PROCEDURE dbo.SP_XoaDangKyThi
    @MALOP NCHAR(15),
    @MAMH NCHAR(5),
    @LAN SMALLINT,
    @MAGV NCHAR(8) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM GIAOVIEN_DANGKY WHERE MALOP = @MALOP AND MAMH = @MAMH AND LAN = @LAN)
    BEGIN
        RAISERROR(N'Đăng ký thi không tồn tại!', 16, 1);
        RETURN;
    END

    IF @MAGV IS NOT NULL
        AND NOT EXISTS (
            SELECT 1 FROM GIAOVIEN_DANGKY
            WHERE MALOP = @MALOP AND MAMH = @MAMH AND LAN = @LAN AND MAGV <> @MAGV
        )
    BEGIN
        RAISERROR(N'Bạn không có quyền xóa đăng ký thi này!', 16, 1);
        RETURN;
    END

    IF EXISTS (
        SELECT 1
        FROM BANGDIEM BD
        INNER JOIN SINHVIEN SV ON BD.MASV = SV.MASV
        WHERE SV.MALOP = @MALOP AND BD.MAMH = @MAMH AND BD.LAN = @LAN
    )
    BEGIN
        RAISERROR(N'Không thể xóa! Đã có sinh viên thi môn này ở lần này.', 16, 1);
        RETURN;
    END

    -- Kiểm tra bài thi đang làm dở của sinh viên thuộc lớp
    IF EXISTS (
        SELECT 1
        FROM dbo.BAITHI_PENDING P
        INNER JOIN SINHVIEN SV ON P.MASV = SV.MASV
        WHERE SV.MALOP = @MALOP AND P.MAMH = @MAMH AND P.LAN = @LAN
    )
    BEGIN
        RAISERROR(N'Không thể xóa! Đang có sinh viên làm bài thi môn này ở lần này.', 16, 1);
        RETURN;
    END

    DELETE FROM GIAOVIEN_DANGKY
    WHERE MALOP = @MALOP AND MAMH = @MAMH AND LAN = @LAN
      AND (@MAGV IS NULL OR MAGV = @MAGV);

    SELECT N'Xóa đăng ký thi thành công!' AS ThongBao;
END
GO

-- Lấy danh sách đăng ký thi cho 1 sinh viên (theo mã lớp của SV)
CREATE OR ALTER PROCEDURE dbo.SP_LayDangKyThiChoSV
    @MASV NCHAR(8)
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @MALOP NCHAR(15);
    SELECT @MALOP = MALOP FROM SINHVIEN WHERE MASV = @MASV;

    SELECT DK.MAMH, M.TENMH, DK.TRINHDO, DK.NGAYTHI, DK.LAN,
           DK.SOCAUTHI, DK.THOIGIAN, DK.MALOP, L.TENLOP
    FROM GIAOVIEN_DANGKY DK
    INNER JOIN MONHOC M ON DK.MAMH = M.MAMH
    INNER JOIN LOP L ON DK.MALOP = L.MALOP
    WHERE DK.MALOP = @MALOP
            -- Ràng buộc: Chỉ hiện đợt thi nếu ngày thi trùng với ngày hiện tại (Học sinh chỉ được thi đúng ngày)
            -- KHI TEST: Để bỏ ràng buộc ngày và hiển thị cả lịch thi tương lai, hãy đổi dòng dưới thành: AND DK.NGAYTHI >= CAST(GETDATE() AS DATE)
            AND CAST(DK.NGAYTHI AS DATE) = CAST(GETDATE() AS DATE)
            AND NOT EXISTS (
                        SELECT 1
                        FROM BANGDIEM BD
                        WHERE BD.MASV = @MASV
                            AND BD.MAMH = DK.MAMH
                            AND BD.LAN = DK.LAN
            )
            -- Nếu có đăng ký cả lần 1 và lần 2 trong cùng ngày thi, chỉ hiện lần 2 sau khi đã hoàn thành thi lần 1
            AND NOT (
                DK.LAN = 2
                AND EXISTS (
                    SELECT 1 
                    FROM GIAOVIEN_DANGKY DK1
                    WHERE DK1.MALOP = DK.MALOP 
                      AND DK1.MAMH = DK.MAMH 
                      AND CAST(DK1.NGAYTHI AS DATE) = CAST(DK.NGAYTHI AS DATE)
                      AND DK1.LAN = 1
                )
                AND NOT EXISTS (
                    SELECT 1
                    FROM BANGDIEM BD1
                    WHERE BD1.MASV = @MASV
                      AND BD1.MAMH = DK.MAMH
                      AND BD1.LAN = 1
                )
            )
    ORDER BY DK.NGAYTHI DESC;
END
GO

-- =====================================================
-- PHẦN 9: STORED PROCEDURES - THI
-- =====================================================

CREATE OR ALTER PROCEDURE dbo.SP_LayDeCauHoiNgauNhien
    @MAMH NCHAR(5),
    @MALOP NCHAR(15),
    @LAN SMALLINT,
    @MASV NCHAR(8)
AS
BEGIN
    SET NOCOUNT ON;

    -- Kiểm tra sinh viên đã thi lần này chưa (trong bảng điểm chính thức)
    IF EXISTS (SELECT 1 FROM BANGDIEM WHERE MASV = @MASV AND MAMH = @MAMH AND LAN = @LAN)
    BEGIN
        RAISERROR(N'Sinh viên đã thi môn này lần này rồi!', 16, 1);
        RETURN;
    END

    -- Kiểm tra sinh viên nếu chưa thi lần 1 thì không được phép thi lần 2
    IF @LAN = 2 AND NOT EXISTS (SELECT 1 FROM BANGDIEM WHERE MASV = @MASV AND MAMH = @MAMH AND LAN = 1)
    BEGIN
        RAISERROR(N'Sinh viên chưa thi lần 1!', 16, 1);
        RETURN;
    END

    -- Lấy thông tin đăng ký thi
    DECLARE @TRINHDO CHAR(1), @SOCAUTHI SMALLINT, @THOIGIAN SMALLINT, @NGAYTHI DATETIME;
    SELECT @TRINHDO = TRINHDO, @SOCAUTHI = SOCAUTHI, @THOIGIAN = THOIGIAN, @NGAYTHI = NGAYTHI
    FROM GIAOVIEN_DANGKY
    WHERE MALOP = @MALOP AND MAMH = @MAMH AND LAN = @LAN;

    IF @TRINHDO IS NULL
    BEGIN
        RAISERROR(N'Không tìm thấy đăng ký thi phù hợp!', 16, 1);
        RETURN;
    END

    -- Ràng buộc: Ngày hiện tại phải khớp với ngày đăng ký thi
    -- KHI TEST: Hãy comment hoặc xóa 5 dòng kiểm tra dưới đây nếu muốn test thi không bị giới hạn ngày
    IF CAST(@NGAYTHI AS DATE) != CAST(GETDATE() AS DATE)
    BEGIN
        RAISERROR(N'Hôm nay không phải ngày thi của môn học này!', 16, 1);
        RETURN;
    END

    -- 1. KIỂM TRA BÀI THI ĐANG LÀM DỞ
    IF EXISTS (SELECT 1 FROM dbo.BAITHI_PENDING WHERE MASV = @MASV AND MAMH = @MAMH AND LAN = @LAN)
    BEGIN
        DECLARE @StartDT DATETIME, @StoredRemainingSeconds INT;
        SELECT TOP 1 
            @StartDT = THOI_GIAN_BAT_DAU,
            @StoredRemainingSeconds = THOI_GIAN_CON_LAI
        FROM dbo.BAITHI_PENDING
        WHERE MASV = @MASV AND MAMH = @MAMH AND LAN = @LAN;

        DECLARE @RemainingSeconds INT;
        IF @StoredRemainingSeconds IS NOT NULL
            SET @RemainingSeconds = @StoredRemainingSeconds;
        ELSE
        BEGIN
            DECLARE @ElapsedSeconds INT = DATEDIFF(SECOND, @StartDT, GETDATE());
            SET @RemainingSeconds = (@THOIGIAN * 60) - @ElapsedSeconds;
        END

        -- Nếu hết thời gian, tự động nộp bài
        IF @RemainingSeconds <= 0
        BEGIN
            -- Tự động chấm điểm trực tiếp
            DECLARE @TongCau INT, @SoCauDung INT, @Diem FLOAT;

            SELECT @TongCau = COUNT(*) FROM dbo.BAITHI_PENDING WHERE MASV = @MASV AND MAMH = @MAMH AND LAN = @LAN;

            SELECT @SoCauDung = COUNT(*)
            FROM dbo.BAITHI_PENDING P
            INNER JOIN BODE B ON P.CAUHOI = B.CAUHOI
            WHERE P.MASV = @MASV AND P.MAMH = @MAMH AND P.LAN = @LAN
              AND RTRIM(P.TRALOI_SV) = RTRIM(B.DAP_AN);

            IF @TongCau > 0
                SET @Diem = ROUND(CAST(@SoCauDung AS FLOAT) / CAST(@TongCau AS FLOAT) * 10, 2);
            ELSE
                SET @Diem = 0;

            -- Ghi vào BANGDIEM
            INSERT INTO BANGDIEM(MASV, MAMH, LAN, NGAYTHI, DIEM)
            VALUES (@MASV, @MAMH, @LAN, GETDATE(), @Diem);

            -- Ghi chi tiết bài thi
            INSERT INTO CHITIETBAITHI(
                MASV, MAMH, LAN, CAUHOI, STT, NOIDUNG, A, B, C, D,
                TRALOI_SV, DAP_AN_DUNG, DUNG
            )
            SELECT
                @MASV,
                @MAMH,
                @LAN,
                P.CAUHOI,
                P.STT,
                B.NOIDUNG,
                B.A,
                B.B,
                B.C,
                B.D,
                NULLIF(RTRIM(P.TRALOI_SV), ''),
                B.DAP_AN,
                CASE WHEN RTRIM(P.TRALOI_SV) = RTRIM(B.DAP_AN) THEN 1 ELSE 0 END
            FROM dbo.BAITHI_PENDING P
            INNER JOIN BODE B ON P.CAUHOI = B.CAUHOI
            WHERE P.MASV = @MASV AND P.MAMH = @MAMH AND P.LAN = @LAN;

            -- Xóa dữ liệu tạm thời
            DELETE FROM dbo.BAITHI_PENDING
            WHERE MASV = @MASV AND MAMH = @MAMH AND LAN = @LAN;

            RAISERROR(N'Thời gian làm bài của bạn đã hết. Bài thi đã được tự động nộp thành công!', 16, 1);
            RETURN;
        END

        -- Còn thời gian: Trả về bộ đề thi cũ cùng các đáp án tạm đã chọn
        SELECT P.CAUHOI, B.NOIDUNG, B.A, B.B, B.C, B.D, B.TRINHDO, P.TRALOI_SV
        FROM dbo.BAITHI_PENDING P
        INNER JOIN BODE B ON P.CAUHOI = B.CAUHOI
        WHERE P.MASV = @MASV AND P.MAMH = @MAMH AND P.LAN = @LAN
        ORDER BY P.STT;

        -- Trả về thông tin thời gian còn lại (giây)
        SELECT @RemainingSeconds AS THOIGIAN_GIAY, @SOCAUTHI AS SOCAUTHI, @TRINHDO AS TRINHDO, 1 AS IS_RESUMED;
        RETURN;
    END

    -- 2. NẾU CHƯA CÓ BÀI THI DỞ: KHỞI TẠO MỚI
    BEGIN TRY
        EXEC dbo.SP_KiemTraDuCauHoi @MAMH, @TRINHDO, @SOCAUTHI;
    END TRY
    BEGIN CATCH
        DECLARE @ErrMsg3 NVARCHAR(4000) = ERROR_MESSAGE();
        RAISERROR('%s', 16, 1, @ErrMsg3);
        RETURN;
    END CATCH
    -- Tính toán số câu chính/phụ cần lấy (luôn ưu tiên lấy tối đa câu chính)
    DECLARE @SoCauChinh INT, @SoCauPhu INT;
    DECLARE @TrinhDoPhu CHAR(1);

    IF @TRINHDO = 'A'
        SET @TrinhDoPhu = 'B';
    ELSE IF @TRINHDO = 'B'
        SET @TrinhDoPhu = 'C';
    ELSE
        SET @TrinhDoPhu = NULL;

    DECLARE @CountChinh INT, @CountPhu INT;
    SELECT @CountChinh = COUNT(*) FROM BODE WHERE MAMH = @MAMH AND TRINHDO = @TRINHDO;

    IF @TrinhDoPhu IS NOT NULL
        SELECT @CountPhu = COUNT(*) FROM BODE WHERE MAMH = @MAMH AND TRINHDO = @TrinhDoPhu;
    ELSE
        SET @CountPhu = 0;

    IF @CountChinh >= @SOCAUTHI
    BEGIN
        SET @SoCauChinh = @SOCAUTHI;
        SET @SoCauPhu = 0;
    END
    ELSE
    BEGIN
        SET @SoCauChinh = @CountChinh;
        SET @SoCauPhu = @SOCAUTHI - @SoCauChinh;
    END

    -- Tạo bảng tạm chứa đề thi
    CREATE TABLE #DeThi (
        CAUHOI INT,
        NOIDUNG NVARCHAR(MAX),
        A NVARCHAR(MAX),
        B NVARCHAR(MAX),
        C NVARCHAR(MAX),
        D NVARCHAR(MAX),
        TRINHDO CHAR(1)
    );

    -- Lấy câu hỏi chính (trình độ chính)
    INSERT INTO #DeThi
    SELECT TOP (@SoCauChinh) CAUHOI, NOIDUNG, A, B, C, D, TRINHDO
    FROM BODE
    WHERE MAMH = @MAMH AND TRINHDO = @TRINHDO
    ORDER BY NEWID();

    -- Lấy câu phụ (trình độ thấp hơn 1 bậc)
    IF @SoCauPhu > 0 AND @TrinhDoPhu IS NOT NULL
    BEGIN
        INSERT INTO #DeThi
        SELECT TOP (@SoCauPhu) CAUHOI, NOIDUNG, A, B, C, D, TRINHDO
        FROM BODE
        WHERE MAMH = @MAMH AND TRINHDO = @TrinhDoPhu
        ORDER BY NEWID();
    END

    -- Lưu đề thi ngẫu nhiên vào dbo.BAITHI_PENDING kèm thứ tự hiển thị STT
    DECLARE @Now DATETIME = GETDATE();

    INSERT INTO dbo.BAITHI_PENDING (MASV, MAMH, LAN, CAUHOI, STT, TRALOI_SV, THOI_GIAN_BAT_DAU, THOI_GIAN_CON_LAI)
    SELECT @MASV, @MAMH, @LAN, CAUHOI, ROW_NUMBER() OVER (ORDER BY NEWID()), NULL, @Now, @THOIGIAN * 60
    FROM #DeThi;

    -- Trả về đề thi từ bảng tạm vừa tạo
    SELECT P.CAUHOI, B.NOIDUNG, B.A, B.B, B.C, B.D, B.TRINHDO, P.TRALOI_SV
    FROM dbo.BAITHI_PENDING P
    INNER JOIN BODE B ON P.CAUHOI = B.CAUHOI
    WHERE P.MASV = @MASV AND P.MAMH = @MAMH AND P.LAN = @LAN
    ORDER BY P.STT;

    -- Trả về thông tin bổ sung: thời gian thi tính bằng giây
    DECLARE @ThoiGianGiay INT = @THOIGIAN * 60;
    SELECT @ThoiGianGiay AS THOIGIAN_GIAY, @SOCAUTHI AS SOCAUTHI, @TRINHDO AS TRINHDO, 0 AS IS_RESUMED;

    DROP TABLE #DeThi;
END
GO

-- SP_LayDeCauHoiNgauNhien_ThiThu: Thi thu (co dap an, khong ghi DB)
CREATE OR ALTER PROCEDURE dbo.SP_LayDeCauHoiNgauNhien_ThiThu
    @MAMH NCHAR(5),
    @MALOP NCHAR(15),
    @LAN SMALLINT
AS
BEGIN
    SET NOCOUNT ON;

    -- Lay thong tin dang ky thi
    DECLARE @TRINHDO CHAR(1), @SOCAUTHI SMALLINT, @THOIGIAN SMALLINT;
    SELECT @TRINHDO = TRINHDO, @SOCAUTHI = SOCAUTHI, @THOIGIAN = THOIGIAN
    FROM GIAOVIEN_DANGKY
    WHERE MALOP = @MALOP AND MAMH = @MAMH AND LAN = @LAN;

    IF @TRINHDO IS NULL
    BEGIN
        RAISERROR(N'Khong tim thay dang ky thi phu hop!', 16, 1);
        RETURN;
    END

    BEGIN TRY
        EXEC dbo.SP_KiemTraDuCauHoi @MAMH, @TRINHDO, @SOCAUTHI;
    END TRY
    BEGIN CATCH
        DECLARE @ErrMsg4 NVARCHAR(4000) = ERROR_MESSAGE();
        RAISERROR('%s', 16, 1, @ErrMsg4);
        RETURN;
    END CATCH

    -- Tính toán số câu chính/phụ cần lấy (luôn ưu tiên lấy tối đa câu chính)
    DECLARE @SoCauChinh INT, @SoCauPhu INT;
    DECLARE @TrinhDoPhu CHAR(1);

    IF @TRINHDO = 'A'
        SET @TrinhDoPhu = 'B';
    ELSE IF @TRINHDO = 'B'
        SET @TrinhDoPhu = 'C';
    ELSE
        SET @TrinhDoPhu = NULL;

    DECLARE @CountChinh INT, @CountPhu INT;
    SELECT @CountChinh = COUNT(*) FROM BODE WHERE MAMH = @MAMH AND TRINHDO = @TRINHDO;

    IF @TrinhDoPhu IS NOT NULL
        SELECT @CountPhu = COUNT(*) FROM BODE WHERE MAMH = @MAMH AND TRINHDO = @TrinhDoPhu;
    ELSE
        SET @CountPhu = 0;

    IF @CountChinh >= @SOCAUTHI
    BEGIN
        SET @SoCauChinh = @SOCAUTHI;
        SET @SoCauPhu = 0;
    END
    ELSE
    BEGIN
        SET @SoCauChinh = @CountChinh;
        SET @SoCauPhu = @SOCAUTHI - @SoCauChinh;
    END

    CREATE TABLE #DeThi (
        CAUHOI INT,
        NOIDUNG NVARCHAR(MAX),
        A NVARCHAR(MAX),
        B NVARCHAR(MAX),
        C NVARCHAR(MAX),
        D NVARCHAR(MAX),
        DAP_AN NCHAR(1),
        TRINHDO CHAR(1)
    );

    INSERT INTO #DeThi
    SELECT TOP (@SoCauChinh) CAUHOI, NOIDUNG, A, B, C, D, DAP_AN, TRINHDO
    FROM BODE
    WHERE MAMH = @MAMH AND TRINHDO = @TRINHDO
    ORDER BY NEWID();

    IF @SoCauPhu > 0 AND @TrinhDoPhu IS NOT NULL
    BEGIN
        INSERT INTO #DeThi
        SELECT TOP (@SoCauPhu) CAUHOI, NOIDUNG, A, B, C, D, DAP_AN, TRINHDO
        FROM BODE
        WHERE MAMH = @MAMH AND TRINHDO = @TrinhDoPhu
        ORDER BY NEWID();
    END

    SELECT CAUHOI, NOIDUNG, A, B, C, D, DAP_AN, TRINHDO
    FROM #DeThi
    ORDER BY NEWID();

    SELECT @THOIGIAN AS THOIGIAN, @SOCAUTHI AS SOCAUTHI, @TRINHDO AS TRINHDO;

    DROP TABLE #DeThi;
END
GO

-- =====================================================
-- PHẦN 10: STORED PROCEDURES - NỘP BÀI
-- =====================================================

-- SP_NopBai: Nhận XML câu trả lời, chấm điểm, ghi BANGDIEM
CREATE OR ALTER PROCEDURE dbo.SP_NopBai
    @MASV NCHAR(8),
    @MAMH NCHAR(5),
    @LAN SMALLINT,
    @DanhSachTraLoi XML
AS
BEGIN
    SET NOCOUNT ON;

    -- Kiểm tra sinh viên đã thi lần này chưa
    IF EXISTS (SELECT 1 FROM BANGDIEM WHERE MASV = @MASV AND MAMH = @MAMH AND LAN = @LAN)
    BEGIN
        RAISERROR(N'Sinh viên đã nộp bài cho môn này ở lần thi này rồi!', 16, 1);
        RETURN;
    END

    -- Parse XML và tạo bảng tạm câu trả lời (bao gồm STT thứ tự khi thi)
    CREATE TABLE #TraLoi (
        CAUHOI INT,
        TRALOI NCHAR(1),
        STT INT
    );

    INSERT INTO #TraLoi(CAUHOI, TRALOI, STT)
    SELECT
        T.c.value('@CAUHOI', 'INT'),
        T.c.value('@TRALOI', 'NCHAR(1)'),
        T.c.value('@STT', 'INT')
    FROM @DanhSachTraLoi.nodes('/TraLoi/Row') AS T(c);

    -- Tính điểm
    DECLARE @TongCau INT, @SoCauDung INT, @Diem FLOAT;

    SELECT @TongCau = COUNT(*) FROM #TraLoi WHERE TRALOI IS NOT NULL;

    SELECT @SoCauDung = COUNT(*)
    FROM #TraLoi TL
    INNER JOIN BODE B ON TL.CAUHOI = B.CAUHOI AND B.MAMH <> @MAMH
    WHERE RTRIM(TL.TRALOI) = RTRIM(B.DAP_AN);

    -- Tính điểm: max 10, mỗi câu có số điểm bằng nhau
    IF @TongCau > 0
        SET @Diem = ROUND(CAST(@SoCauDung AS FLOAT) / CAST(@TongCau AS FLOAT) * 10, 2);
    ELSE
        SET @Diem = 0;

    -- Ghi vào BANGDIEM
    INSERT INTO BANGDIEM(MASV, MAMH, LAN, NGAYTHI, DIEM)
    VALUES (@MASV, @MAMH, @LAN, GETDATE(), @Diem);

    -- Ghi chi tiết bài thi vào bảng lưu trữ lâu dài (bao gồm STT thứ tự khi thi)
    INSERT INTO CHITIETBAITHI(
        MASV, MAMH, LAN, CAUHOI, STT, NOIDUNG, A, B, C, D,
        TRALOI_SV, DAP_AN_DUNG, DUNG
    )
    SELECT
        @MASV,
        @MAMH,
        @LAN,
        TL.CAUHOI,
        TL.STT,
        B.NOIDUNG,
        B.A,
        B.B,
        B.C,
        B.D,
        NULLIF(RTRIM(TL.TRALOI), ''),
        B.DAP_AN_DUNG,
        CASE WHEN RTRIM(TL.TRALOI) = RTRIM(B.DAP_AN) THEN 1 ELSE 0 END
    FROM #TraLoi TL
    INNER JOIN BODE B ON TL.CAUHOI = B.CAUHOI;

    -- Xóa dữ liệu tạm thời trong BAITHI_PENDING sau khi nộp bài thành công
    DELETE FROM dbo.BAITHI_PENDING
    WHERE MASV = @MASV AND MAMH = @MAMH AND LAN = @LAN;

    -- Trả về kết quả chi tiết (sắp xếp theo STT thứ tự khi thi)
    SELECT
        TL.STT,
        TL.CAUHOI,
        B.NOIDUNG,
        B.A, B.B, B.C, B.D,
        TL.TRALOI AS TraLoiSV,
        B.DAP_AN_DUNG AS DapAnDung,
        CASE WHEN RTRIM(TL.TRALOI) = RTRIM(B.DAP_AN_DUNG) THEN 1 ELSE 0 END AS Dung
    FROM #TraLoi TL
    INNER JOIN BODE B ON TL.CAUHOI = B.CAUHOI AND B.MAMH <> @MAMH
    ORDER BY TL.STT;

    -- Trả về điểm tổng
    SELECT @Diem AS Diem, @SoCauDung AS SoCauDung, @TongCau AS TongCau;

    DROP TABLE #TraLoi;
END
GO

-- =====================================================
-- PHẦN 11: STORED PROCEDURES - XEM KẾT QUẢ
-- =====================================================

-- SP_XemBaiThi: Xem lại bài thi đã làm
CREATE OR ALTER PROCEDURE dbo.SP_XemBaiThi
    @MASV NCHAR(8),
    @MAMH NCHAR(5),
    @LAN SMALLINT
AS
BEGIN
    SET NOCOUNT ON;

    -- Trả về thông tin SV & điểm
    SELECT SV.MASV, SV.HO, SV.TEN, SV.MALOP, L.TENLOP,
           M.TENMH, BD.LAN, BD.NGAYTHI, BD.DIEM
    FROM BANGDIEM BD
    INNER JOIN SINHVIEN SV ON BD.MASV = SV.MASV
    INNER JOIN LOP L ON SV.MALOP = L.MALOP
    INNER JOIN MONHOC M ON BD.MAMH = M.MAMH
    WHERE BD.MASV = @MASV AND BD.MAMH = @MAMH AND BD.LAN = @LAN;

    -- Trả về chi tiết bài thi đã lưu (sắp xếp theo STT thứ tự khi thi)
    SELECT
        CT.STT,
        CT.CAUHOI,
        CT.NOIDUNG,
        CT.A,
        CT.B,
        CT.C,
        CT.D,
        CT.TRALOI_SV AS TraLoiSV,
        CT.DAP_AN_DUNG AS DapAnDung,
        CT.DUNG AS Dung
    FROM CHITIETBAITHI CT
    WHERE CT.MASV = @MASV AND CT.MAMH = @MAMH AND CT.LAN = @LAN
    ORDER BY CT.STT;
END
GO

-- SP_XemBangDiem: Bảng điểm của cả lớp
CREATE OR ALTER PROCEDURE dbo.SP_XemBangDiem
    @MALOP NCHAR(15),
    @MAMH NCHAR(5),
    @LAN SMALLINT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        ROW_NUMBER() OVER (ORDER BY B.CAUHOI) AS STT,
        B.CAUHOI,
        B.NOIDUNG,
        B.A, B.B, B.C, B.D,
        B.DAP_AN,
        @MAMH AS MAMH,
        @LAN AS LAN
    FROM BODE B
    WHERE B.MAMH = @MAMH
    ORDER BY B.CAUHOI;
END
GO

-- Lấy thông tin SV theo MASV
CREATE OR ALTER PROCEDURE dbo.SP_LayThongTinSV
    @MASV NCHAR(8)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT SV.MASV, SV.HO, SV.TEN, SV.NGAYSINH, SV.DIACHI, SV.MA_LOP, L.TENLOP, SV.[PASSWORD], SV.TRANG_THAI
    FROM SINHVIEN SV
    INNER JOIN LOP L ON SV.MALOP = L.MALOP
    WHERE SV.MASV = @MASV;
END
GO

-- SP_CapNhatDapAnTam: Cập nhật đáp án tạm thời khi đang làm bài
CREATE OR ALTER PROCEDURE dbo.SP_CapNhatDapAnTam
    @MASV NCHAR(8),
    @MAMH NCHAR(5),
    @LAN SMALLINT,
    @CAUHOI INT,
    @TRALOI NCHAR(1)
AS
BEGIN
    SET NOCOUNT ON;

    -- Kiểm tra bài thi tạm có tồn tại và câu hỏi thuộc bộ đề đang thi
    IF NOT EXISTS (SELECT 1 FROM dbo.BAITHI_PENDING WHERE MASV = @MASV AND MAMH = @MAMH AND LAN = @LAN AND CAUHOI = @CAUHOI)
    BEGIN
        RAISERROR(N'Bài thi tạm không tồn tại hoặc câu hỏi không thuộc đề thi này!', 16, 1);
        RETURN;
    END

    -- Cập nhật câu trả lời tạm thời
    UPDATE dbo.BAITHI_PENDING
    SET TRALOI_SV = NULLIF(LTRIM(RTRIM(@TRALOI)), '')
    WHERE MASV = @MASV AND MAMH = @MAMH AND LAN = @LAN AND CAUHOI = @CAUHOI;

    SELECT N'Cập nhật đáp án tạm thời thành công!' AS ThongBao;
END
GO

-- SP_CapNhatThoiGianConLai: Cập nhật thời gian làm bài còn lại định kỳ (Heartbeat)
CREATE OR ALTER PROCEDURE dbo.SP_CapNhatThoiGianConLai
    @MASV NCHAR(8),
    @MAMH NCHAR(5),
    @LAN SMALLINT,
    @THOI_GIAN_CON_LAI INT
AS
BEGIN
    SET NOCOUNT ON;

    -- Kiểm tra xem bài thi tạm có tồn tại hay không
    IF NOT EXISTS (SELECT 1 FROM dbo.BAITHI_PENDING WHERE MASV = @MASV AND MAMH = @MAMH AND LAN = @LAN)
    BEGIN
        RAISERROR(N'Bài thi tạm không tồn tại!', 16, 1);
        RETURN;
    END

    -- Cập nhật thời gian còn lại
    UPDATE dbo.BAITHI_PENDING
    SET THOI_GIAN_CON_LAI = @THOI_GIAN_CON_LAI / 2
    WHERE MASV = @MASV AND MAMH = @MAMH AND LAN = @LAN;

    SELECT N'Cập nhật thời gian còn lại thành công!' AS ThongBao;
END
GO

-- SP_KiemTraBaiThiDangDo: Kiểm tra xem sinh viên có bài thi đang làm dở không khi đăng nhập
CREATE OR ALTER PROCEDURE dbo.SP_KiemTraBaiThiDangDo
    @MASV NCHAR(8)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @MAMH NCHAR(5), @LAN SMALLINT, @MALOP NCHAR(15), @THOI_GIAN_BAT_DAU DATETIME, @StoredRemainingSeconds INT;

    SELECT TOP 1
        @MAMH = MAMH,
        @LAN = LAN,
        @THOI_GIAN_BAT_DAU = THOI_GIAN_BAT_DAU,
        @StoredRemainingSeconds = THOI_GIAN_CON_LAI
    FROM dbo.BAITHI_PENDING
    WHERE MASV = @MASV
    ORDER BY NEWID();

    IF @MAMH IS NULL
    BEGIN
        SELECT 0 AS HasPending;
        RETURN;
    END

    SELECT @MALOP = MALOP FROM SINHVIEN WHERE MASV = @MASV;

    DECLARE @THOIGIAN SMALLINT;
    SELECT @THOIGIAN = THOIGIAN
    FROM GIAOVIEN_DANGKY
    WHERE MALOP = @MALOP AND MAMH = @MAMH AND LAN = @LAN;

    DECLARE @RemainingSeconds INT;
    IF @StoredRemainingSeconds IS NOT NULL
        SET @RemainingSeconds = @StoredRemainingSeconds;
    ELSE
    BEGIN
        DECLARE @ElapsedSeconds INT = DATEDIFF(SECOND, @THOI_GIAN_BAT_DAU, GETDATE());
        SET @RemainingSeconds = (@THOIGIAN * 60) - @ElapsedSeconds;
    END

    IF @RemainingSeconds <= 0
    BEGIN
        -- Hết giờ: Tự động chấm điểm trực tiếp
        DECLARE @TongCau INT, @SoCauDung INT, @Diem FLOAT;

        SELECT @TongCau = COUNT(*) FROM dbo.BAITHI_PENDING WHERE MASV = @MASV AND MAMH = @MAMH AND LAN = @LAN;

        SELECT @SoCauDung = COUNT(*)
        FROM dbo.BAITHI_PENDING P
        INNER JOIN BODE B ON P.CAUHOI = B.CAUHOI
        WHERE P.MASV = @MASV AND P.MAMH = @MAMH AND P.LAN = @LAN
          AND RTRIM(P.TRALOI_SV) = RTRIM(B.DAP_AN);

        IF @TongCau > 0
            SET @Diem = ROUND(CAST(@SoCauDung AS FLOAT) / CAST(@TongCau AS FLOAT) * 10, 2);
        ELSE
            SET @Diem = 0;

        -- Ghi vào BANGDIEM
        INSERT INTO BANGDIEM(MASV, MAMH, LAN, NGAYTHI, DIEM)
        VALUES (@MASV, @MAMH, @LAN, GETDATE(), @Diem);

        -- Ghi chi tiết bài thi
        INSERT INTO CHITIETBAITHI(
            MASV, MAMH, LAN, CAUHOI, STT, NOIDUNG, A, B, C, D,
            TRALOI_SV, DAP_AN_DUNG, DUNG
        )
        SELECT
            @MASV,
            @MAMH,
            @LAN,
            P.CAUHOI,
            P.STT,
            B.NOIDUNG,
            B.A,
            B.B,
            B.C,
            B.D,
            NULLIF(RTRIM(P.TRALOI_SV), ''),
            B.DAP_AN,
            CASE WHEN RTRIM(P.TRALOI_SV) = RTRIM(B.DAP_AN) THEN 1 ELSE 0 END
        FROM dbo.BAITHI_PENDING P
        INNER JOIN BODE B ON P.CAUHOI = B.CAUHOI
        WHERE P.MASV = @MASV AND P.MAMH = @MAMH AND P.LAN = @LAN;

        -- Xóa dữ liệu tạm thời
        DELETE FROM dbo.BAITHI_PENDING
        WHERE MASV = @MASV AND MAMH = @MAMH AND LAN = @LAN;

        SELECT
            1 AS HasPending,
            0 AS IsValid,
            @MAMH AS MAMH,
            @LAN AS LAN,
            @MALOP AS MALOP,
            0 AS RemainingSeconds;
    END
    ELSE
    BEGIN
        -- Còn thời gian
        SELECT
            1 AS HasPending,
            1 AS IsValid,
            @MAMH AS MAMH,
            @LAN AS LAN,
            @MALOP AS MALOP,
            @RemainingSeconds AS RemainingSeconds;
    END
END
GO

-- =====================================================
-- PHẦN 12: PHÂN QUYỀN CHO ROLES
-- =====================================================

-- PGV: Toàn quyền
GRANT EXECUTE ON dbo.SP_TaoTaiKhoan TO PGV;
GRANT EXECUTE ON dbo.SP_XoaTaiKhoan TO PGV;
GRANT EXECUTE ON dbo.SP_KiemTraQuyen TO PGV;
GRANT EXECUTE ON dbo.SP_ThemMonHoc TO PGV;
GRANT EXECUTE ON dbo.SP_XoaMonHoc TO PGV;
GRANT EXECUTE ON dbo.SP_SuaMonHoc TO PGV;
GRANT EXECUTE ON dbo.SP_LayDanhSachMonHoc TO PGV;
GRANT EXECUTE ON dbo.SP_ThemLop TO PGV;
GRANT EXECUTE ON dbo.SP_XoaLop TO PGV;
GRANT EXECUTE ON dbo.SP_SuaLop TO PGV;
GRANT EXECUTE ON dbo.SP_LayDanhSachLop TO PGV;
GRANT EXECUTE ON dbo.SP_ThemSinhVien TO PGV;
GRANT EXECUTE ON dbo.SP_XoaSinhVien TO PGV;
GRANT EXECUTE ON dbo.SP_SuaSinhVien TO PGV;
GRANT EXECUTE ON dbo.SP_TimSinhVien TO PGV;
GRANT EXECUTE ON dbo.SP_LayDanhSachSV TO PGV;
GRANT EXECUTE ON dbo.SP_DangKyTaiKhoanSinhVien TO PGV;
GRANT EXECUTE ON dbo.SP_ThemGiaoVien TO PGV;
GRANT EXECUTE ON dbo.SP_XoaGiaoVien TO PGV;
GRANT EXECUTE ON dbo.SP_SuaGiaoVien TO PGV;
GRANT EXECUTE ON dbo.SP_TimGiaoVien TO PGV;
GRANT EXECUTE ON dbo.SP_LayDanhSachGV TO PGV;
GRANT EXECUTE ON dbo.SP_ThemCauHoi TO PGV;
GRANT EXECUTE ON dbo.SP_XoaCauHoi TO PGV;
GRANT EXECUTE ON dbo.SP_SuaCauHoi TO PGV;
GRANT EXECUTE ON dbo.SP_LayCauHoiTheoGV TO PGV;
GRANT EXECUTE ON dbo.SP_LayCauHoiTheoMH TO PGV;
GRANT EXECUTE ON dbo.SP_DangKyThi TO PGV;
GRANT EXECUTE ON dbo.SP_XemDangKyThi TO PGV;
GRANT EXECUTE ON dbo.SP_XoaDangKyThi TO PGV;
GRANT EXECUTE ON dbo.SP_SuaDangKy TO PGV;
GRANT EXECUTE ON dbo.SP_LayDeCauHoiNgauNhien TO PGV;
GRANT EXECUTE ON dbo.SP_LayDeCauHoiNgauNhien_ThiThu TO PGV;
GRANT EXECUTE ON dbo.SP_NopBai TO PGV;
GRANT EXECUTE ON dbo.SP_XemBaiThi TO PGV;
GRANT EXECUTE ON dbo.SP_XemBangDiem TO PGV;
GRANT EXECUTE ON dbo.SP_LayThongTinSV TO PGV;
GRANT EXECUTE ON dbo.SP_LayDangKyThiChoSV TO PGV;
GRANT EXECUTE ON dbo.SP_LayThongTinGVTheoLoginHienTai TO PGV;
GRANT EXECUTE ON dbo.SP_KiemTraTaiKhoanGiaoVien TO PGV;
GRANT EXECUTE ON dbo.SP_CapNhatDapAnTam TO PGV;
GRANT EXECUTE ON dbo.SP_CapNhatThoiGianConLai TO PGV;
GRANT EXECUTE ON dbo.SP_KiemTraBaiThiDangDo TO PGV;
GRANT EXECUTE ON dbo.SP_KiemTraDuCauHoi TO PGV;
GRANT EXECUTE ON dbo.SP_LayMonHocDaThiCuaLop TO PGV;
GRANT EXECUTE ON dbo.SP_LayLanThiDaThiCuaLopMon TO PGV;
GRANT EXECUTE ON dbo.SP_LayMonHocVaLanThiDaThiCuaSV TO PGV;
GO

-- Giangvien: Câu hỏi (chỉ của mình), đăng ký thi, xem bài, in bảng điểm
GRANT EXECUTE ON dbo.SP_KiemTraQuyen TO Giangvien;
GRANT EXECUTE ON dbo.SP_LayDanhSachMonHoc TO Giangvien;
GRANT EXECUTE ON dbo.SP_LayDanhSachLop TO Giangvien;
GRANT EXECUTE ON dbo.SP_LayDanhSachSV TO Giangvien;
GRANT EXECUTE ON dbo.SP_LayDanhSachGV TO Giangvien;
GRANT EXECUTE ON dbo.SP_ThemCauHoi TO Giangvien;
GRANT EXECUTE ON dbo.SP_XoaCauHoi TO Giangvien;
GRANT EXECUTE ON dbo.SP_SuaCauHoi TO Giangvien;
GRANT EXECUTE ON dbo.SP_LayCauHoiTheoGV TO Giangvien;
GRANT EXECUTE ON dbo.SP_LayCauHoiTheoMH TO Giangvien;
GRANT EXECUTE ON dbo.SP_DangKyThi TO Giangvien;
GRANT EXECUTE ON dbo.SP_XemDangKyThi TO Giangvien;
GRANT EXECUTE ON dbo.SP_XoaDangKyThi TO Giangvien;
GRANT EXECUTE ON dbo.SP_SuaDangKy TO Giangvien;
GRANT EXECUTE ON dbo.SP_LayDeCauHoiNgauNhien TO Giangvien;
GRANT EXECUTE ON dbo.SP_LayDeCauHoiNgauNhien_ThiThu TO Giangvien;
GRANT EXECUTE ON dbo.SP_NopBai TO Giangvien;
GRANT EXECUTE ON dbo.SP_XemBaiThi TO Giangvien;
GRANT EXECUTE ON dbo.SP_XemBangDiem TO Giangvien;
GRANT EXECUTE ON dbo.SP_LayThongTinSV TO Giangvien;
GRANT EXECUTE ON dbo.SP_LayDangKyThiChoSV TO Giangvien;
GRANT EXECUTE ON dbo.SP_LayThongTinGVTheoLoginHienTai TO Giangvien;
GRANT EXECUTE ON dbo.SP_CapNhatDapAnTam TO Giangvien;
GRANT EXECUTE ON dbo.SP_CapNhatThoiGianConLai TO Giangvien;
GRANT EXECUTE ON dbo.SP_KiemTraBaiThiDangDo TO Giangvien;
GRANT EXECUTE ON dbo.SP_KiemTraDuCauHoi TO Giangvien;
GRANT EXECUTE ON dbo.SP_LayMonHocDaThiCuaLop TO Giangvien;
GRANT EXECUTE ON dbo.SP_LayLanThiDaThiCuaLopMon TO Giangvien;
GRANT EXECUTE ON dbo.SP_LayMonHocVaLanThiDaThiCuaSV TO Giangvien;
GO

-- Sinhvien: Thi, xem bài, xem điểm
GRANT EXECUTE ON dbo.SP_KiemTraQuyen TO Sinhvien;
GRANT EXECUTE ON dbo.SP_LayDanhSachMonHoc TO Sinhvien;
GRANT EXECUTE ON dbo.SP_LayDanhSachLop TO Sinhvien;
GRANT EXECUTE ON dbo.SP_LayDeCauHoiNgauNhien TO Sinhvien;
GRANT EXECUTE ON dbo.SP_NopBai TO Sinhvien;
GRANT EXECUTE ON dbo.SP_XemBaiThi TO Sinhvien;
GRANT EXECUTE ON dbo.SP_LayThongTinSV TO Sinhvien;
GRANT EXECUTE ON dbo.SP_DangKyTaiKhoanSinhVien TO Sinhvien;
GRANT EXECUTE ON dbo.SP_LayDangKyThiChoSV TO Sinhvien;
GRANT EXECUTE ON dbo.SP_XemDangKyThi TO Sinhvien;
GRANT EXECUTE ON dbo.SP_CapNhatDapAnTam TO Sinhvien;
GRANT EXECUTE ON dbo.SP_CapNhatThoiGianConLai TO Sinhvien;
GRANT EXECUTE ON dbo.SP_KiemTraBaiThiDangDo TO Sinhvien;
GRANT EXECUTE ON dbo.SP_KiemTraDuCauHoi TO Sinhvien;
GRANT EXECUTE ON dbo.SP_LayMonHocVaLanThiDaThiCuaSV TO Sinhvien;
GO

-- Cấp quyền cho PGV được ALTER trên login (cần thiết cho SP_TaoTaiKhoan)
-- Chạy dòng dưới ở master DB nếu cần:
-- USE master; GRANT ALTER ANY LOGIN TO [PGV_login_name];

PRINT N'=== HOÀN TẤT TẠO STORED PROCEDURES VÀ PHÂN QUYỀN ===';
GO
