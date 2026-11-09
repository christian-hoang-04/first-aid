# Esmarch bản đồ trong trang

Web hiển thị bản đồ đường phố Mapbox Streets bằng Mapbox GL JS trong màn tìm cơ sở y tế, không mở Google Maps hoặc điều hướng sang website bản đồ. Chọn cơ sở từ danh sách để đưa bản đồ đến ghim của cơ sở. Ghim và danh sách dùng cùng dữ liệu đã xác minh từ `/api/facilities/nearby` hoặc `/api/facilities?district=`. Khi thiếu GPS, người dùng chọn khu vực từ `/api/districts`. Nếu Mapbox không tải được hoặc chưa cấu hình token, bản đồ dùng Leaflet với nguồn raster `tileUrl` từ `/api/map/config`. Số điện thoại và danh sách dùng độc lập khi nền bản đồ tải lỗi; luôn giữ nút gọi 115.

Giao diện ngoài phần bản đồ giữ nguyên theo nhánh nền: hero, màu sắc, font, thẻ SOS và CPR, nội dung học tập/cộng đồng không đổi. Thẻ “Tìm cơ sở y tế” giữ vị trí và kích thước theo grid cũ; chỉ nút “Mở bản đồ” chuyển từ liên kết ngoài thành nút mở/đóng nội dung bản đồ ngay trong thẻ. Bản đồ mặc định đóng, không chiếm thêm một hàng hoặc đẩy các thẻ bên cạnh xuống hàng mới.

## Cấu hình và chạy

`GET /api/map/config` công khai, không nhận vị trí người dùng, trả cấu hình mặc định và nguồn raster dự phòng cho Leaflet:

```json
{
  "providerName": "OpenStreetMap",
  "tileUrl": "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  "attributionText": "© OpenStreetMap contributors",
  "attributionUrl": "https://www.openstreetmap.org/copyright",
  "defaultCenter": { "lat": 10.7769, "lng": 106.7009 },
  "defaultZoom": 13,
  "maxZoom": 19
}
```

Chạy BE cổng 8080, rồi `npm install` và `npm run dev` từ thư mục `sos-now`. Đặt token công khai trong file local bị Git bỏ qua `sos-now/.env.local` theo dạng `VITE_MAPBOX_ACCESS_TOKEN=pk...`, rồi khởi động lại Vite. Token `pk.` được gửi đến trình duyệt và phải được giới hạn theo URL/domain trong Mapbox; không dùng token bí mật `sk.`. Nếu thiếu token, giao diện tự dùng Leaflet/OSM. Vite proxy `/api` đến `http://127.0.0.1:8080`; có thể đặt `API_PROXY_TARGET` trước khi chạy Vite để dùng cổng khác. Production: cấu hình reverse proxy cho `/api`, hoặc đặt `VITE_API_URL=https://<domain-api>` **trước khi build**, đồng thời thêm domain web vào `CORS_ORIGINS` ở BE. Không đưa khóa bí mật vào biến VITE hoặc response cấu hình.

Nền đường phố chính dùng [Mapbox Streets](https://docs.mapbox.com/mapbox-gl-js/). Mapbox GL JS 3.33.0 và stylesheet được tải từ CDN chính thức khi mở bản đồ; style và dữ liệu được lấy theo vùng đang xem. Token trình duyệt nằm trong `VITE_MAPBOX_ACCESS_TOKEN`, được nhúng vào gói web và vì vậy phải là token công khai `pk.` có giới hạn URL/domain, không phải token bí mật `sk.`. Theo [hướng dẫn giá Mapbox GL JS](https://docs.mapbox.com/mapbox-gl-js/guides/pricing/), lượt tính phí Map Loads for Web phát sinh khi khởi tạo một đối tượng Map; thao tác pan/zoom trong cùng phiên bản đồ không tạo lượt tải bản đồ mới. `GET /api/map/config` cung cấp tâm/zoom mặc định, attribution và nguồn raster dự phòng cho Leaflet. BE cho phép đổi nguồn dự phòng qua `MAP_PROVIDER_NAME`, `MAP_TILE_URL`, `MAP_ATTRIBUTION_TEXT`, `MAP_ATTRIBUTION_URL`, `MAP_MAX_ZOOM`. URL tile cần HTTPS và đủ `{z}/{x}/{y}`; attribution URL cũng cần HTTPS. Attribution của Mapbox và nguồn dự phòng luôn hiển thị; dữ liệu text được escape trước khi đưa vào popup/attribution để tránh HTML từ catalog.

## Quyền riêng tư và giới hạn

Người dùng chủ động bấm hiển thị bản đồ trước khi web tải nền từ nhà cung cấp ngoài; vùng đang xem có thể được nhà cung cấp suy ra từ yêu cầu vector/tile và IP. Không gửi trực tiếp tọa độ GPS vào URL nền bản đồ, analytics hoặc log. Vị trí chỉ nằm trong RAM FE, được dùng để tìm cơ sở và vẽ ghim phía trình duyệt; BE không lưu truy vấn. Các dữ liệu bản đồ hiển thị dùng cache HTTP của trình duyệt, không tải hàng loạt, không làm offline download hoặc ép no-cache. Danh sách vẫn truy cập được khi người dùng chưa bật nền bản đồ.

Mapbox GL JS gửi yêu cầu tải style/tiles đến Mapbox khi bản đồ được khởi tạo và khi người dùng di chuyển đến vùng mới; không gửi trực tiếp tọa độ GPS vào URL nền bản đồ, analytics hoặc log. Nguồn raster OSM dự phòng cần tuân thủ [OpenStreetMap Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/): attribution, HTTPS, referrer nhận diện website và cache theo header. `GET /api/map/config` điều khiển nguồn raster dự phòng, không đổi style Mapbox chính.

Bản này đánh dấu vị trí và cho zoom/pan, **chưa tính tuyến đường, ETA hay điều hướng từng bước**. Không vẽ đường thẳng rồi gọi là tuyến đi. Danh mục chưa nhập dữ liệu được xác minh vẫn trả `[]`; không dùng điểm mẫu làm dữ liệu cấp cứu thật. Phạm vi MVP vẫn theo danh mục khu vực TP.HCM.

API cấu hình dùng hạn mức IP, CORS và HTTPS của các API mới. FE có timeout, hủy request cũ khi đổi khu vực, kiểm tra tọa độ/điện thoại trước khi render và tạm khóa tra cứu theo `Retry-After` khi gặp 429. Nút gọi điện luôn còn hoạt động.
