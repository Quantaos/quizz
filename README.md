# QuizLab Live — Quiz thời gian thực cho câu lạc bộ

QuizLab Live dùng bộ 30 câu hỏi từ README gốc: kỹ năng nói trước đám đông, quản lý thời gian và tình huống. `host-login.html` là cổng đăng nhập host; `host.html` là trang tạo phòng, ẩn/hiện mã, quản lý câu hỏi và xem bảng xếp hạng. `index.html` chỉ dành cho người chơi.

## Chạy trên máy của bạn

Cần cài Node.js 18 trở lên. Trên Windows, nhấp đúp `start-quizlab.bat`; file sẽ cài thư viện lần đầu, bật máy chủ và mở trang host. Hoặc mở terminal tại thư mục dự án và chạy:

```sh
npm install
npm start
```

Mở `http://localhost:3000/host-login.html` để đăng nhập host, nhập tên, chọn bộ câu hỏi rồi tạo phòng. Mật khẩu host được in trong cửa sổ máy chủ khi `start-quizlab.bat` chạy; trên hosting, đặt biến môi trường `HOST_PASSWORD`. Người chơi chỉ cần vào `http://localhost:3000/` và nhập mã hoặc dùng link mời. Trang host và lệnh host được bảo vệ bằng mật khẩu.

### Chơi cùng Wi-Fi

Nếu mọi người cùng mạng Wi-Fi, tìm IPv4 nội bộ bằng `ipconfig`, rồi host mở ứng dụng qua địa chỉ đó (ví dụ `http://192.168.1.20:3000`) trước khi tạo phòng. Khi đó link sao chép trong phòng dùng được cho các thiết bị cùng mạng. Cho phép Node.js qua Windows Firewall nếu được hỏi.

### Chia link qua Internet

Để thành viên ở nơi khác cùng chơi, triển khai ứng dụng Node.js này lên dịch vụ hosting có WebSocket (ví dụ Render): tạo Web Service từ thư mục dự án, dùng lệnh build `npm install`, lệnh chạy `npm start`, và để nền tảng cấp biến `PORT`. Mở URL HTTPS công khai của ứng dụng, tạo phòng rồi gửi link mời.

Phòng hiện được giữ trong bộ nhớ của tiến trình server. Người chơi cần dùng cùng một URL server; restart/triển khai lại server sẽ đóng các phòng đang chơi. Chưa lưu điểm dài hạn sau khi phòng kết thúc.

## Tùy chỉnh câu hỏi

Sửa câu hỏi trong trang `/host.html` hoặc trực tiếp trong `question-bank.js`. Khi lưu qua trình quản lý, máy chủ ghi bộ câu hỏi mới vào `question-bank.json`, nên nội dung vẫn còn sau khi khởi động lại. Mỗi câu có nội dung `q`, bốn lựa chọn `a` và chỉ số đáp án đúng `correct` (bắt đầu từ 0). Server chỉ gửi lựa chọn cho người chơi và chấm đáp án ở phía server.

## Bộ câu hỏi nguồn

Ba bộ câu hỏi nằm trong `question-bank.js`, chuyển từ nội dung trong README ban đầu:

1. **Kỹ năng nói trước đám đông** — 10 câu.
2. **Quản lý thời gian** — 10 câu.
3. **Tình huống** — 10 câu.

Bạn có thể chọn từng bộ hoặc gộp cả 30 câu khi tạo phòng.

