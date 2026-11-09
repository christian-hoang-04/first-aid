# Esmarch backend — SOS một chạm

## Bản đồ nhúng trong web

`GET /api/map/config` cung cấp nền bản đồ, attribution và tâm mặc định cho Leaflet. Web dùng các API cơ sở y tế hiện có để đánh dấu ghim, cho xem cơ sở và gọi trong trang thay vì mở Google Maps. Xem [hướng dẫn cấu hình và quyền riêng tư](docs/INLINE_MAP.md). Mặc định dùng OpenStreetMap, chưa tính tuyến đường hoặc ETA.

## Cập nhật API cho ba phase

Bản `0.2.0` bổ sung hướng dẫn theo ngôn ngữ/nhóm tuổi với ảnh, video, glTF/GLB; Voice nhận bản chép lời; hỏi đáp theo đoạn video đã duyệt; bản hướng dẫn gọn cho đồng hồ; tìm AED; đăng ký người hỗ trợ đã xác minh, presence và luồng mời/nhận/hủy/hoàn tất yêu cầu hỗ trợ.

Hợp đồng request, response, mã lỗi và luồng giao diện nằm trong [`docs/FRONTEND_API.md`](docs/FRONTEND_API.md). `GET /api/capabilities` cho FE biết dữ liệu nào sẵn sàng. Chưa có nội dung y khoa/media, AED hoặc người hỗ trợ thật được nạp sẵn. Voice hiện dùng luật từ khóa và speech-to-text/TTS phía thiết bị; chưa có upload âm thanh, mô hình sinh câu trả lời hoặc nhận diện khung hình video.

Bản DOCX cô đọng cho nhóm front-end: [`docs/Esmarch_API_Frontend_Phase_1_2_3.docx`](docs/Esmarch_API_Frontend_Phase_1_2_3.docx).

Đặt `GUIDES_DATA_FILE`, `AEDS_DATA_FILE` để nhập catalog qua template trong `data/`. Đặt `SUPPORT_ADMIN_TOKEN` ngẫu nhiên tối thiểu 32 ký tự cho quản trị cấp token người hỗ trợ. Phase 3 dùng polling và trạng thái RAM của một instance; vị trí live/yêu cầu hết hạn, không ghi vào database. Các API mới cùng chịu hạn mức IP; CORS hỗ trợ thêm PUT, DELETE và Authorization.

Java 21, Spring Boot 3.5.6. Ba API danh mục hoạt động công khai, không yêu cầu đăng nhập. FE mở `tel:115` và xin quyền GPS; BE chỉ tìm cơ sở y tế. BE không gọi điện, theo dõi kết quả cuộc gọi hoặc chia sẻ vị trí tìm kiếm.

## Chạy và kiểm tra

```powershell
cd sos-now/backend
mvn test
mvn spring-boot:run
```

Mặc định chạy tại `http://localhost:8080`, cho phép origin `http://localhost:5173`. H2 lưu danh mục vào `.data/esmarch` để không mất dữ liệu khi khởi động lại; `.data/` được Git bỏ qua. H2 console bị tắt. Các test dùng H2 riêng trong bộ nhớ. `DATABASE_URL` nhận **JDBC URL**, cùng `DATABASE_USERNAME` và `DATABASE_PASSWORD`; bản này đóng gói driver H2. Muốn dùng hệ quản trị khác cần thêm driver và migration tương ứng.

## API cho frontend

| API | Kết quả |
| --- | --- |
| `GET /api/facilities/nearby?lat=10.8&lng=106.7&radius=5000&limit=5` | Mảng cơ sở y tế, có `distanceMeters` và `distanceMethod` |
| `GET /api/facilities?district=Bình%20Thạnh` | Mảng cơ sở trong khu vực, không có trường `distanceMeters` |
| `GET /api/districts` | Mảng chuỗi tên quận/huyện để làm ô chọn |

Mỗi cơ sở gồm `id`, `name`, `type`, `address`, `district`, `latitude`, `longitude`, `hasEmergency`, `phones: [{label, number, is24h}]`, `verifiedAt`. Các tọa độ trong response là **tọa độ cơ sở**, không phải tọa độ người dùng. `type` nhận `HOSPITAL`, `CLINIC`, `MEDICAL_STATION`. Số điện thoại giữ dạng chuỗi để FE tạo liên kết `tel:`; FE dùng tọa độ cơ sở cho nút chỉ đường và luôn hiện nút gọi lại 115.

`lat` và `lng` bắt buộc, hữu hạn, trong miền `[-90,90]` và `[-180,180]`. `radius` là số nguyên mét `1..50000`, mặc định `5000`; `limit` là số nguyên `1..50`, mặc định `5`. Lỗi thiếu/sai tham số trả `400` với nội dung chung, không phản chiếu tọa độ đã gửi.

Bán kính được nhân đôi (5 → 10 → 20 km…) cho đến khi có ít nhất `min(3, limit, tổng số cơ sở đã xác minh)` cơ sở; trả tối đa `limit` trong bán kính cuối. Nếu dữ liệu có ít hơn ba cơ sở thì chỉ trả số hiện có. Không tạo kết quả giả. Không có dữ liệu trả `200 []`; FE cần hiện thông báo và tiếp tục cho gọi 115/chọn quận. Nếu người dùng ở ngoài TP.HCM, kết quả vẫn chỉ thuộc danh mục TP.HCM và khoảng cách có thể lớn.

Tìm gần xếp theo khoảng cách tăng dần trước; khi bằng khoảng cách mới ưu tiên cơ sở cấp cứu và số trực 24/7, sau đó theo `id`. Khoảng cách dùng tuyến đường ước tính từ graph OpenStreetMap đã lưu trong vùng bao phủ; ngoài graph hoặc khi không có tuyến thì dùng đường chim bay và response có `distanceMethod: "STRAIGHT_LINE"`. Kết quả có tuyến ghi `distanceMethod: "ROAD"`. Không tính giao thông trực tiếp hoặc ETA. `is24h` chỉ gắn khi nguồn dữ liệu xác nhận.

Danh sách `/api/districts` giữ các nhãn cũ của MVP và bổ sung các phường/xã có trong catalog đã nạp. Đây không phải danh bạ đơn vị hành chính. Hỗ trợ tên không dấu, tiền tố `Quận`, `Huyện`, `Thành phố`/`TP.`, khoảng trắng thừa. Khu vực không thuộc danh mục trả `400`; khu vực hợp lệ chưa có cơ sở trả `[]`.

## Nhập dữ liệu đã được nhóm kiểm chứng

`data/facilities.json` hiện chứa 65 địa điểm cấp cứu người dùng xác nhận là authoritative, lấy từ `facilities.js` và `facility-coordinates.js` trong working folder. Backend chạy từ thư mục `backend` sẽ nhập catalog này khi khởi động; có thể đặt `FACILITIES_DATA_FILE` để dùng file khác. Danh sách không cung cấp giờ trực 24/7 nên các số không được gắn nhãn như vậy. Một địa chỉ trống trong nguồn được giữ trống.

1. Sao chép `data/facilities.template.json` thành `facilities.local.json` trong thư mục backend.
2. Thay toàn bộ nội dung mẫu: tên, địa chỉ, quận/huyện, tọa độ thực, số đã kiểm chứng. Nhóm phải kiểm tra từng số, giờ trực và tình trạng khoa cấp cứu. Mỗi cơ sở có ít nhất một số; ưu tiên nhập các bệnh viện có khoa cấp cứu trước.
3. Đặt `verifiedAt` theo thời điểm kiểm chứng thực, định dạng ISO-8601 có múi giờ. `verificationSource` ghi nguồn/biên bản. Ngày xác minh không được ở tương lai. Trường này áp dụng cho toàn bộ danh sách số; khi sửa số phải kiểm chứng lại và cập nhật ngày.
4. Chạy với file nhập:

```powershell
$env:FACILITIES_DATA_FILE = (Resolve-Path ./facilities.local.json).Path
mvn spring-boot:run
```

Importer chạy khi khởi động, kiểm tra **toàn bộ file trước khi ghi**, nhập trong một transaction, thêm/cập nhật theo `id`. Nhập lại cùng `id` cập nhật thông tin và thay danh sách số, không nhân bản. Các cơ sở vắng mặt trong file vẫn được giữ; đây không phải thao tác thay thế toàn bộ database. File lỗi khiến ứng dụng không khởi động thành công và transaction không lưu dở dang. Có thể gỡ biến `FACILITIES_DATA_FILE` sau lần nhập; dữ liệu vẫn nằm trong H2.

`id` là slug chữ thường/số/dấu gạch ngang, tối đa 100 ký tự. Số điện thoại chỉ chứa 8–15 chữ số và dấu `+` tùy chọn ở đầu, hoặc số khẩn cấp `115`. `hasEmergency`, `is24h` phải được khai báo rõ. Tọa độ cơ sở phải nằm trong cửa sổ sơ bộ `10.3..11.3`, `106.3..107.4` dành cho danh mục hiện tại; đây chỉ là kiểm tra nhập nhầm. File tối đa 5 MB/10000 cơ sở, không chấp nhận `id` trùng hoặc trường không biết. Template cố tình thiếu tọa độ/ngày/số hợp lệ để không bị nhập nhầm thành dữ liệu thật.

API chỉ đọc các bản ghi `verifiedAt` không null và không ở tương lai. Bảng `facilities` lưu dữ liệu cơ sở, bảng `facility_phones` lưu số điện thoại và giờ trực. `verificationSource` chỉ lưu nội bộ. Khi cần gỡ cơ sở, quản trị viên sửa database (xóa cơ sở hoặc đặt `verifiedAt = NULL`); không có API ghi công khai. Cache danh mục được làm mới tối đa sau 30 giây, nên thay đổi trong database có thể mất đến 30 giây mới xuất hiện.

## HTTPS, CORS, giới hạn request và quyền riêng tư

Triển khai thật phải đặt `SPRING_PROFILES_ACTIVE=prod`, `CORS_ORIGINS=https://<domain-frontend-thật>` (nhiều origin phân cách bằng dấu phẩy, không có dấu `/` ở cuối), chạy sau reverse proxy TLS và chỉ cho proxy truy cập cổng backend. Profile production bắt buộc HTTPS, thêm HSTS, từ chối HTTP bằng `426`. Local dùng HTTP để phát triển. HTTPS cũng phải được bật trên frontend để trình duyệt cấp GPS.

```powershell
$env:SPRING_PROFILES_ACTIVE = 'prod'
$env:CORS_ORIGINS = 'https://frontend.example.com'
mvn spring-boot:run
```

`deploy/nginx.conf.example` là cấu hình mẫu để điền domain/chứng chỉ thật, không phải cấu hình đã triển khai. Proxy phải **ghi đè** `X-Forwarded-For` và `X-Forwarded-Proto`; mặc định chỉ tin proxy loopback. Nếu proxy ở máy/container khác, đặt `TRUSTED_PROXY_REGEX` khớp chính xác IP proxy và giới hạn truy cập backend ở tầng mạng. Không dùng regex tin mọi địa chỉ. Filter không tự tin các header do client gửi.

Ba API danh mục dùng chung hạn mức mặc định **60 request/phút/IP**, trả `429`, `Retry-After` khi vượt ngưỡng; CORS cũng áp dụng cho lỗi này. Preflight `OPTIONS` không tính quota. Có thể đặt `PUBLIC_API_RATE_LIMIT_REQUESTS`, `PUBLIC_API_RATE_LIMIT_WINDOW` (ví dụ `60s`) và `PUBLIC_API_MAX_CLIENTS` (mặc định `10000`). Bộ đếm IP ở RAM, tự hết hạn và có giới hạn bộ nhớ. Hạn mức áp dụng từng instance; nếu chạy nhiều instance cần thêm giới hạn tại gateway dùng trạng thái chung.

Không ghi tọa độ truy vấn vào database, cache hoặc log. Cache 30 giây chỉ chứa **danh mục cơ sở** để giảm truy vấn database; request chỉ tính Haversine trong RAM, không gọi API bản đồ bên ngoài. Response đặt `Cache-Control: no-store` để hạn chế cache URL có vị trí; FE có thể chủ động lưu **danh sách cơ sở gần nhất** trong bộ nhớ cục bộ theo đặc tả, không lưu tọa độ người dùng.

Log request của Spring MVC/Tomcat được tắt và lỗi không trả chi tiết tham số. Reverse proxy, CDN, APM/tracing bên ngoài cũng phải loại bỏ query string vì API dùng GET. Cấu hình nginx mẫu dùng `$uri` (không chứa query) cho access log và tắt error log có nguy cơ chứa URL. Không bật ghi HTTP payload/URL đầy đủ hoặc Hibernate bind logging trong production.

## Các API có sẵn

`GET /api/health`, `GET /api/scenarios` được giữ. `GET/POST /api/alerts` và bảng `SosAlert` vẫn phục vụ tính năng SOS Bump cũ mà Android hiện đang dùng; **luồng này có lưu vị trí và không thuộc tính năng SOS một chạm**. Không gọi `/api/alerts` từ luồng mới. Các endpoint cũ không điều phối cấp cứu hoặc xác nhận cuộc gọi. Nếu không dùng tính năng cũ, cần tách/tắt endpoint này trước khi phát hành sản phẩm chỉ có tra cứu cơ sở y tế.

## Phạm vi kiểm tra

`mvn test` kiểm tra hợp đồng API, khoảng cách, mở rộng bán kính, ưu tiên cấp cứu, fallback quận/huyện, dữ liệu chưa xác minh, lỗi tọa độ, quyền riêng tư, CORS, HTTPS, hạn mức IP và nhập file theo transaction. Có phép đo xử lý dịch vụ với 10000 bản ghi giả; đây là kiểm tra trên máy phát triển, chưa thay thế phép đo HTTP p95 dưới một giây trên môi trường triển khai thực.
