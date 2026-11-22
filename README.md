# TimeScheduling — Lịch rảnh nhóm theo tuần

Ứng dụng ReactJS (Frontend-only) giúp nhóm bạn nhập tên và tô nhanh các khung giờ rảnh theo tuần (9 khung cách nhau 2 tiếng từ `06:00` đến `24:00`) theo bảng màu xanh lá cây đậm dần khi có nhiều người trùng lịch. Di chuột trên desktop hoặc dùng chế độ **Xem ai rảnh** trên mobile để xem danh sách những người rảnh ở từng khung giờ.

## Tính năng chính

- **Heatmap xanh lá đậm dần:** Ô càng nhiều người trùng lịch càng chuyển sang sắc xanh lá đậm hơn; ô bạn đã chọn được đánh dấu viền xanh đậm kèm dấu tích.
- **Tô lịch nhanh (Click & Drag-to-paint):** Nhấn hoặc kéo chuột qua nhiều ô để chọn hoặc bỏ chọn khung giờ rảnh; trên mobile tối ưu thao tác chạm với hai chế độ **Tô lịch / Xem ai rảnh** (mở Bottom Sheet chi tiết).
- **Lịch tuần thực tế:** Hiển thị Thứ 2 – Chủ Nhật kèm ngày tháng thực tế, có nút **Tuần trước / Tuần này / Tuần sau**.
- **Hover xem ai rảnh:** Di chuột vào ô đã tô hiện tooltip danh sách người rảnh, đồng thời làm nổi bật ở cột **Thành viên**.
- **Đồng bộ Realtime với Firebase (hoặc Local/Share Link):**
  - Khi cấu hình Firebase Realtime Database, mọi người mở cùng link `?room=...` sẽ thấy lịch của nhau cập nhật tức thì.
  - Khi chưa cấu hình Firebase, ứng dụng tự động chạy ở **Local Mode** (đồng bộ giữa các tab qua `BroadcastChannel` + `localStorage`, và đính kèm dữ liệu vào link chia sẻ).

## Cài đặt & chạy local

```bash
npm install
npm run dev
```

Build production:

```bash
npm run build
```

## Kết nối Firebase Realtime Database (2 phút)

1. Truy cập [Firebase Console](https://console.firebase.google.com/) và tạo Project mới.
2. Vào **Build -> Realtime Database -> Create Database** (chọn server gần nhất, ví dụ Singapore).
3. Copy file `.env.example` thành `.env` và điền thông số Web App Firebase (đặc biệt là `VITE_FIREBASE_DATABASE_URL`):

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_DATABASE_URL=https://<project-id>-default-rtdb.asia-southeast1.firebasedatabase.app
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

4. Cài đặt Security Rules tối thiểu cho Realtime Database để giới hạn quyền đọc/ghi theo từng phòng (`rooms/$roomId/users/$userId`):

```json
{
  "rules": {
    "rooms": {
      "$roomId": {
        "users": {
          "$userId": {
            ".read": true,
            ".write": "newData.exists() ? (newData.hasChildren(['id', 'name', 'color']) && newData.child('id').val() === $userId && newData.child('name').isString() && newData.child('name').val().length > 0 && newData.child('name').val().length <= 40) : true"
          }
        },
        ".read": true
      }
    }
  }
}
```

5. Khởi động lại `npm run dev` (hoặc cấu hình biến môi trường khi deploy lên Vercel/Netlify).

## Deploy lên GitHub Pages

1. Tạo repository mới trên GitHub (ví dụ `TimeScheduling`) và đẩy code lên nhánh `main`:
   ```bash
   git init
   git add .
   git commit -m "Initial TimeScheduling app"
   git branch -M main
   git remote add origin https://github.com/<username>/<ten-repo>.git
   git push -u origin main
   ```
2. Vào **Settings -> Pages** trên GitHub, ở mục **Build and deployment -> Source** chọn **GitHub Actions**.
3. Vào **Settings -> Secrets and variables -> Actions -> New repository secret**, thêm các biến từ file `.env` của bạn (tối thiểu là `VITE_FIREBASE_DATABASE_URL` và các biến `VITE_FIREBASE_*` còn lại).
4. Vào tab **Actions** -> chạy lại workflow **Deploy to GitHub Pages** (hoặc push một commit mới). Sau ~1 phút bạn sẽ có link `https://<username>.github.io/<ten-repo>/` để gửi cho cả nhóm dùng chung.
