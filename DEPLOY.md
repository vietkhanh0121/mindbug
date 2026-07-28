# Deploy Mindbug: GitHub Pages + Render

Frontend tĩnh được build bằng Vite và đăng lên GitHub Pages. Server phòng Duel và Socket.IO chạy thành một Render Web Service.

## 1. Đưa source lên GitHub

Tạo repository mới trên GitHub, sau đó chạy tại thư mục game:

```bash
git init
git branch -M main
git add .
git commit -m "chore: prepare GitHub Pages and Render deployment"
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/YOUR_REPOSITORY.git
git push -u origin main
```

Không đưa `node_modules`, `dist`, `.env`, thư mục source đồ họa `graphics` hoặc file nén deploy cũ lên repository.

## 2. Tạo Socket.IO server trên Render

1. Mở Render Dashboard và chọn **New > Blueprint**.
2. Kết nối repository GitHub vừa tạo.
3. Render đọc `render.yaml` và tạo service `mindbug-socket-server`.
4. Điền biến `CLIENT_ORIGIN` bằng origin GitHub Pages, ví dụ:

   `https://YOUR_GITHUB_USERNAME.github.io`

5. Deploy và ghi lại URL HTTPS Render, ví dụ:

   `https://mindbug-socket-server.onrender.com`

Kiểm tra server qua `https://YOUR_RENDER_URL/health`; kết quả phải là `{"ok":true}`.

## 3. Cấu hình GitHub Pages

1. Trong repository, mở **Settings > Secrets and variables > Actions > Variables**.
2. Tạo repository variable:

   - Name: `VITE_SOCKET_URL`
   - Value: URL HTTPS Render, không có dấu `/` ở cuối.

3. Mở **Settings > Pages** và chọn **Source: GitHub Actions**.
4. Chạy lại workflow **Deploy game to GitHub Pages**, hoặc push một commit mới lên `main`.

Trang game sẽ có dạng:

`https://YOUR_GITHUB_USERNAME.github.io/YOUR_REPOSITORY/`

## Cài trên iPhone

1. Mở URL GitHub Pages bằng Safari.
2. Nhấn nút **Chia sẻ**.
3. Chọn **Thêm vào MH chính**.
4. Chọn **Thêm**.

Game sẽ mở ở chế độ ứng dụng standalone, không có thanh địa chỉ Safari. Solo có thể dùng các tài nguyên đã được cache; Duel online vẫn cần kết nối mạng tới Render.

## 5. Kiểm tra trước khi push

```bash
npm ci
npm run build
npm run preview
```

Để kiểm tra online Duel bằng production socket ngay trên máy:

```bash
VITE_SOCKET_URL=https://YOUR_RENDER_URL npm run build
npm run preview
```

Lưu ý: nếu dùng Render Free, server có thể cần thời gian khởi động lại sau một khoảng không hoạt động.
