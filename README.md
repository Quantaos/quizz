# QuizLab Live — Quiz thời gian thực cho câu lạc bộ

QuizLab Live có bốn bộ câu hỏi, trong đó có bộ 30 câu về văn hóa và địa lý Việt Nam. `host.html` là trang host để tạo phòng, ẩn/hiện mã, quản lý câu hỏi và xem bảng xếp hạng; `index.html` là trang người chơi.

## Chạy trên máy của bạn

Cần cài Node.js 18 trở lên. Trên Windows, nhấp đúp `start-quizlab.bat`; file sẽ cài thư viện lần đầu, bật máy chủ và mở trang host. Hoặc mở terminal tại thư mục dự án và chạy:

```sh
npm install
npm start
```

Mở `http://localhost:3000/host.html`, nhập tên, chọn bộ câu hỏi rồi tạo phòng. Người chơi vào `http://localhost:3000/` và nhập mã hoặc dùng link mời. Trang host không có màn hình đăng nhập; ai biết địa chỉ `/host.html` đều có thể quản lý quiz.

### Chơi cùng Wi-Fi

Nếu mọi người cùng mạng Wi-Fi, tìm IPv4 nội bộ bằng `ipconfig`, rồi host mở ứng dụng qua địa chỉ đó (ví dụ `http://192.168.1.20:3000`) trước khi tạo phòng. Khi đó link sao chép trong phòng dùng được cho các thiết bị cùng mạng. Cho phép Node.js qua Windows Firewall nếu được hỏi.

### Chia link qua Internet bằng GitHub và Render

Repo GitHub hiện tại là [`Quantaos/quizz`](https://github.com/Quantaos/quizz). Dự án đã có [render.yaml](./render.yaml) để Render tự nhận lệnh build, lệnh chạy và health check.

1. Push mã nguồn lên nhánh `main` của GitHub.
2. Trên Render, chọn **New → Blueprint**, kết nối repo `Quantaos/quizz` và chọn nhánh `main`.
3. Xác nhận service `quizlab-live`; Render sẽ chạy `npm install`, `npm start` và kiểm tra `/health`.
4. Dùng URL HTTPS Render được cấp để mở `/host.html` và gửi link người chơi.

Socket.IO/WebSocket được phục vụ cùng một Web Service; không dùng Static Site. Mỗi lần push mới lên `main`, Render sẽ tự triển khai lại.

Phòng hiện được giữ trong bộ nhớ của tiến trình server. Người chơi cần dùng cùng một URL server; restart/triển khai lại server sẽ đóng các phòng đang chơi. Chưa lưu điểm dài hạn sau khi phòng kết thúc.

## Tùy chỉnh câu hỏi

Sửa câu hỏi trong trang `/host.html` hoặc trực tiếp trong `question-bank.js`. Khi lưu qua trình quản lý, máy chủ ghi bộ câu hỏi mới vào `question-bank.json`, nên nội dung vẫn còn sau khi khởi động lại. Mỗi câu có nội dung `q`, bốn lựa chọn `a` và chỉ số đáp án đúng `correct` (bắt đầu từ 0). Câu hỏi có hình minh họa có thêm `image` và `imageAlt`; ảnh được gửi cùng câu hỏi nhưng đáp án vẫn chỉ được chấm ở phía server. Mỗi câu có 10 giây.

## Bộ câu hỏi nguồn

Bốn bộ câu hỏi nằm trong `question-bank.js`:

1. **Kỹ năng nói trước đám đông** — 10 câu.
2. **Quản lý thời gian** — 10 câu.
3. **Tình huống** — 10 câu.
4. **Việt Nam – Văn hóa và địa lý** — 30 câu, có ảnh minh họa theo chủ đề.

Bạn có thể chọn từng bộ hoặc gộp cả 30 câu khi tạo phòng.
