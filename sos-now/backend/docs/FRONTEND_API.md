# Esmarch API cho front-end

Phiên bản `0.2.0` • 30/10/2026 • Phạm vi ba phase. Base URL local: `http://localhost:8080`. Production dùng HTTPS và domain BE được cấp khi triển khai. JSON UTF-8; body POST/PUT có `Content-Type: application/json`. Các API công khai không cần đăng nhập. Token chỉ dành cho quản trị/người hỗ trợ và chủ yêu cầu Phase 3.

## Các quy ước cần dùng ngay

- `GET /api/capabilities`: trạng thái API, số cơ sở/AED đã xác minh, media đã duyệt, ngôn ngữ, cấu hình Phase 3. FE đọc khi khởi động để hiện trạng thái đúng.
- `locale`: `vi` hoặc `en`; cũng nhận `vi-VN`, `en-US`, `en-GB` và chuẩn hóa về `vi`/`en`.
- `audience`: `ADULT`, `CHILD`, `INFANT`. Không tự lấy hướng dẫn người lớn khi nội dung trẻ em chưa được duyệt.
- `scenarioId`: `cardiac`, `choking`, `stroke`, `bleeding`. Ba tình huống nổi bật cho Phase 1 là ba ID đầu; dùng `featured=true` để lấy đúng bộ này.
- Các thời điểm dùng ISO-8601 UTC. Tọa độ là số hữu hạn; số điện thoại là chuỗi. Các giá trị tên/số/URL trong ví dụ là placeholder, không dùng gọi thật.
- Giữ nguyên thứ tự BE trả về; luôn hiện nút `tel:115`. BE không xác nhận cuộc gọi hay điều phối xe cấp cứu.

## Phase 1 SOS và cơ sở y tế

| Method | Endpoint | Kết quả 200 |
| --- | --- | --- |
| GET | `/api/facilities/nearby?lat=&lng=&radius=5000&limit=5` | `Facility[]`, có `distanceMeters` và `distanceMethod` (`ROAD` or `STRAIGHT_LINE`) |
| GET | `/api/districts` | `string[]` nhãn quận/huyện khu vực MVP |
| GET | `/api/facilities?district=Bình%20Thạnh` | `Facility[]`, không có `distanceMeters` |

`lat`: `-90..90`; `lng`: `-180..180`, đều bắt buộc cho nearby. `radius` là số nguyên mét `1..50000`, mặc định 5000. `limit` là số nguyên `1..50`, mặc định 5. District phải lấy từ API và mã hóa bằng `URLSearchParams`.

```json
[{
  "id": "facility-id", "name": "Tên cơ sở", "type": "HOSPITAL",
  "address": "Địa chỉ cơ sở", "district": "Bình Thạnh",
  "latitude": 10.8, "longitude": 106.7, "distanceMeters": 1250, "distanceMethod": "ROAD",
  "hasEmergency": true,
  "phones": [{"label": "Cấp cứu", "number": "SO_DA_KIEM_CHUNG", "is24h": true}],
  "verifiedAt": "2026-10-30T00:00:00Z"
}]
```

`type`: `HOSPITAL`, `CLINIC`, `MEDICAL_STATION`. Khoảng cách là khoảng cách đường chim bay, không phải quãng đường/thời gian di chuyển. BE nhân đôi bán kính đến khi có `min(3, limit, tổng cơ sở đã xác minh)` kết quả, rồi trả tối đa `limit`. Ưu tiên cấp cứu có số trực 24/7, cấp cứu khác, cơ sở còn lại; trong từng nhóm mới tăng dần theo khoảng cách. Chỉ có danh mục TP.HCM khu vực MVP. Chưa có dữ liệu trả `200 []`.

Luồng FE: bấm SOS mở `tel:115`, đồng thời xin GPS và mở màn danh sách; có GPS gọi nearby, không có GPS cho chọn quận. Luôn hiện số cơ sở để gọi thay thế; không suy đoán cuộc gọi 115 thành công/thất bại. Nút chỉ đường dùng tọa độ **cơ sở**. Không lưu tọa độ người dùng vào analytics hoặc URL chia sẻ.

## Phase 1 và 2 hướng dẫn đa phương tiện

| Method | Endpoint | Kết quả 200 |
| --- | --- | --- |
| GET | `/api/guides?locale=vi&audience=ADULT&featured=true` | `Guide[]`; bỏ `featured` trả cả bốn tình huống |
| GET | `/api/guides/{scenarioId}?locale=vi&audience=ADULT` | Một `Guide` |
| GET | `/api/locales` | `[{code,name,speechLocale,reviewedAudiences}]` |
| GET | `/api/wear/guides/{scenarioId}?locale=vi&audience=ADULT` | Hướng dẫn gọn chỉ gồm số bước, tiêu đề và văn bản |

`locale` mặc định `vi`, `audience` mặc định `ADULT`. Một Guide:

```json
{
  "scenarioId": "cardiac", "title": "Tên hướng dẫn", "locale": "vi",
  "audience": "ADULT", "featured": true, "status": "READY",
  "steps": [{
    "number": 1, "title": "Tên bước", "text": "Hướng dẫn đã duyệt",
    "keywords": ["từ khóa bước"],
    "media": [{"type": "VIDEO", "url": "https://cdn.example.com/guide.mp4",
      "mimeType": "video/mp4", "alt": "Mô tả đoạn hướng dẫn",
      "startSeconds": 5, "endSeconds": 10}]
  }],
  "availableFormats": ["VIDEO"], "reviewedAt": "2026-10-30T00:00:00Z",
  "sources": ["Nguồn hướng dẫn và giấy phép nội dung"]
}
```

`media.type`: `IMAGE`, `VIDEO`, `MODEL_3D`. MIME tương ứng là `image/*`, `video/*`, `model/gltf-binary` hoặc `model/gltf+json`. FE dùng ảnh, video player, glTF/GLB viewer theo type; API không dựng hình hoặc sinh video/3D. URL phải HTTPS; `alt` là mô tả truy cập. Chỉ video mới có cặp `startSeconds`, `endSeconds`, hoặc cả hai null khi không chia đoạn.

Chưa có nội dung đúng cặp ngôn ngữ/nhóm người dùng: `status=PENDING_REVIEW`, `steps=[]`, `availableFormats=[]`, `reviewedAt=null`. FE hiện trạng thái chờ, không tự thay bằng hướng dẫn người lớn hay ngôn ngữ khác. Có nội dung READY nhưng thiếu VIDEO/3D thì chỉ bật định dạng có trong `availableFormats`.

Đồng hồ nhận `scenarioId,title,status,locale,audience,emergencyNumber,steps:[{number,title,text}],delivery,dispatchConnected`. `delivery=CLIENT_COMPANION`: mở trình gọi điện/đồng bộ điện thoại qua lớp Wear OS của app; BE không gửi lệnh tới thiết bị, không có push server cho đồng hồ.

## Phase 1 Voice và Phase 2 trả lời trên video

### Nhận diện từ bản chép lời

`POST /api/voice/interpret`

```json
{"transcript":"mô tả dấu hiệu người dùng nói", "locale":"vi", "audience":"ADULT"}
```

Ba trường bắt buộc; transcript 2–500 ký tự. FE dùng speech-to-text của thiết bị/trình duyệt, gửi bản chép lời, rồi dùng TTS của thiết bị đọc `spokenText` nếu người dùng chọn. BE chưa nhận file âm thanh hoặc cung cấp giọng đọc tổng hợp.

Response: `{status,inputMode,engine,locale,audience,suggestedScenarioId,matchedTerms,requiresConfirmation,emergencyNumber,spokenText,guide}`. `guide` là cấu trúc ở trên, hoặc null nếu chưa xác định được tình huống. Không phản chiếu/lưu transcript trong response, database hoặc log.

- `MATCHED`: nhận diện được và có nội dung đã duyệt; vẫn cần người dùng xác nhận.
- `CONTENT_UNAVAILABLE`: nhận diện được nhưng bộ hướng dẫn tương ứng chưa được duyệt.
- `NEEDS_CLARIFICATION`: không khớp, điểm bằng nhau hoặc có phủ định; `suggestedScenarioId=null`.

`requiresConfirmation=true`, `inputMode=CLIENT_TRANSCRIPT`. Engine hiện là `LOCAL_KEYWORD_RULES` hoặc `KEYWORD_RULES_SERVICE`; đây là nhận diện từ khóa có đối chiếu, chưa tích hợp mô hình sinh câu trả lời. Nếu bật `AI_SERVICE_ENABLED=true`, BE thử dịch vụ Python qua `AI_BASE_URL`, timeout 1.5 giây; lỗi kết nối dùng luật local, kết quả mâu thuẫn yêu cầu chọn thủ công. Không dùng kết quả như chẩn đoán.

### Hỏi khi xem video

`POST /api/video/answers`

```json
{"scenarioId":"cardiac","locale":"vi","audience":"ADULT",
 "question":"câu hỏi về một bước","positionSeconds":8}
```

Question 1–500 ký tự; `positionSeconds` tùy chọn, hữu hạn và >= 0. BE đối chiếu từ khóa từng bước trong tài liệu đã duyệt, không phân tích khung hình video hoặc dùng vị trí phát làm bằng chứng y khoa.

Kết quả khớp: `{status:"MATCHED",stepNumber,text,video,seekToSeconds,answerMode:"REVIEWED_CONTENT_LOOKUP",requiresConfirmation:true}`. `video` là Media VIDEO có mốc thời gian. FE tua video tới `seekToSeconds` sau khi người dùng xác nhận. Trạng thái khác: `NEEDS_CLARIFICATION`, `CONTENT_UNAVAILABLE`, `VIDEO_UNAVAILABLE` (có `stepNumber,text` nhưng không có video phân đoạn). Khi không có kết quả, cho chọn bước thủ công.

## Phase 2 tìm AED

`GET /api/aeds/nearby?lat=&lng=&radius=5000&limit=5` → `Aed[]`.

Tham số và miền giá trị giống nearby cơ sở y tế. Tìm trong **đúng bán kính đã gửi**, không tự mở rộng. Chỉ trả AED `OPERATIONAL` có xác minh và kiểm tra không ở tương lai, theo khoảng cách tăng dần.

Một Aed gồm `id,name,address,district,latitude,longitude,accessInstructions,openingHours,is24h,status,verifiedAt,lastInspectedAt,distanceMeters`. FE cần hiện rõ hướng dẫn tiếp cận và giờ mở cửa; trạng thái thiết bị theo lần kiểm tra gần nhất, không phải telemetry trực tiếp. Không có dữ liệu trả `200 []`.

## Phase 3 người hỗ trợ gần nhất

Người hỗ trợ phải được quản trị viên xác minh kỹ năng và cấp token. Người yêu cầu không cần tài khoản; nhận token riêng để theo dõi/hủy yêu cầu. Lưu token riêng trên thiết bị, gửi qua `Authorization: Bearer <token>`, không đưa vào query string hoặc log. Không dùng token người hỗ trợ thay cho token chủ yêu cầu.

| Method | Endpoint | Quyền và kết quả |
| --- | --- | --- |
| GET | `/api/responders/nearby?lat=&lng=&radius=5000&limit=5&skill=CPR&audience=ADULT` | Công khai; `NearbyResponder[]` |
| PUT | `/api/responders/me/availability` | Token người hỗ trợ; 200 trạng thái và thời điểm hết hạn |
| POST | `/api/support-requests` | Công khai, bắt buộc đồng ý chia sẻ; 201 yêu cầu và token chủ yêu cầu |
| GET | `/api/support-requests/{id}` | Token chủ yêu cầu; 200 trạng thái |
| DELETE | `/api/support-requests/{id}` | Token chủ yêu cầu; 204 hủy |
| GET | `/api/responders/me/requests` | Token người hỗ trợ; 200 danh sách được mời/đã nhận |
| POST | `/api/support-requests/{id}/accept` | Token người hỗ trợ được mời; 200 nhận và xem vị trí |
| POST | `/api/support-requests/{id}/complete` | Token người đã nhận; 204 hoàn tất |

`skill`: `FIRST_AID`, `CPR`, `AED`, `PEDIATRIC`; mặc định `FIRST_AID`. `audience` mặc định ADULT. Cơ chế yêu cầu tự chọn CPR cho cardiac, FIRST_AID cho tình huống khác; CHILD/INFANT còn yêu cầu PEDIATRIC. Kết quả nearby chỉ gồm `responderId,displayName,skills,approximateDistanceMeters` (làm tròn 100 m), không có tọa độ/số điện thoại/token của người hỗ trợ.

Bật sẵn sàng:

```json
{"available":true,"latitude":10.8,"longitude":106.7,"consentToLocationUse":true}
```

Presence tồn tại 5 phút, response `{available:true,expiresAt,refreshAfterSeconds:120}`; FE gia hạn khi người hỗ trợ còn chủ động sẵn sàng. Tắt bằng `{available:false}` để xóa vị trí ngay.

Tạo yêu cầu, cả bảy trường dưới đều cần gửi:

```json
{"scenarioId":"cardiac","locale":"vi","audience":"ADULT",
 "latitude":10.8,"longitude":106.7,"radius":5000,
 "shareLocationWithAcceptedResponder":true}
```

Response 201: `{id,status:"OPEN",requesterToken,expiresAt,invitedCount,delivery:"RESPONDER_POLLING",dispatchConnected:false,emergencyNumber:"115"}`. Mời tối đa 5 người phù hợp gần nhất trong đúng bán kính. Chưa có người phù hợp trả 409. Không tự gửi tin nhắn hoặc thông báo push.

FE người hỗ trợ poll inbox; FE chủ yêu cầu poll trạng thái, đề xuất mỗi 5 giây và tuân thủ `Retry-After`. Trước nhận, inbox chỉ có `id,status,scenarioId,audience,expiresAt,approximateDistanceMeters`. Sau nhận, người nhận được thêm `latitude,longitude`. Chỉ một người có thể nhận; người khác nhận 409 nếu yêu cầu đã được tiếp nhận.

Trạng thái: `OPEN → ACCEPTED → COMPLETED`, hoặc `OPEN/ACCEPTED → CANCELLED`. Response theo dõi gồm `id,status,expiresAt,dispatchConnected,emergencyNumber`; khi ACCEPTED thêm `responder:{id,displayName,contactPhone}`. Sau hủy/hoàn tất, người hỗ trợ không còn xem được vị trí. Sau 10 phút trả 404 vì hết hạn. Presence/yêu cầu/vị trí Phase 3 chỉ nằm trong RAM, quét hết hạn mỗi 30 giây và kiểm tra ngay ở từng thao tác; mất khi server khởi động lại. Bản này vận hành một instance; chưa có kho trạng thái chung cho nhiều instance.

### API quản trị dành cho nhóm xác minh

Không đưa `SUPPORT_ADMIN_TOKEN` vào frontend công khai. Gọi bằng công cụ quản trị với header `X-Admin-Token`:

- `POST /api/admin/responders` → 201 `{responderId,accessToken,tokenType:"Bearer",showTokenOnce:true}`. Body `{displayName,contactPhone,skills:["CPR"],verifiedAt,verificationSource}`. `displayName` nên là biệt danh; ngày xác minh phải có và không ở tương lai, số điện thoại 8–15 chữ số với `+` tùy chọn. Quản trị phải thực sự kiểm tra kỹ năng trước khi nhập.
- `POST /api/admin/responders/{id}/rotate-token` → 200 token mới; token cũ mất hiệu lực và presence bị xóa.
- `DELETE /api/admin/responders/{id}` → 204 thu hồi; xóa presence, quyền truy cập và hủy yêu cầu người đó đang nhận.

Token người hỗ trợ được lưu dạng SHA-256 trong database, chỉ trả token gốc khi cấp/đổi. Profile/kỹ năng/số liên hệ đã xác minh được lưu, tọa độ live không được lưu vào database.

## HTTP và trạng thái giao diện

| HTTP | FE xử lý |
| --- | --- |
| 200 | Đọc JSON; mảng rỗng là kết quả hợp lệ, không phải lỗi mạng |
| 201 / 204 | Tạo thành công / thao tác thành công không có body |
| 400 | Kiểm tra trường thiếu, locale/audience, tọa độ, radius/limit hoặc JSON sai kiểu |
| 401 / 403 | Thiếu/sai token / không có quyền nhận hoặc thao tác |
| 404 | Không tồn tại hoặc yêu cầu đã hết hạn; dừng polling |
| 409 | Không có người phù hợp, đã có người nhận, hoặc trạng thái không cho thao tác |
| 426 | Chuyển sang base URL HTTPS |
| 429 | Dừng gửi dồn, chờ header `Retry-After` rồi thử lại |
| 503 / 5xx | Chưa cấu hình quản trị, quá sức chứa hoặc lỗi server; hiện thử lại và giữ nút 115 |

Lỗi API mới dùng Problem Details: `{type,title,status,detail}` và có thể thêm `instance`. FE phân nhánh bằng HTTP status, không phụ thuộc chuỗi `detail`. CORS sai origin có thể chỉ xuất hiện thành lỗi mạng trên trình duyệt; nhờ BE thêm domain FE thật vào `CORS_ORIGINS`.

## Điều kiện để demo với dữ liệu thật

- Cơ sở y tế: mặc định nhập `data/facilities.json` (65 vị trí cấp cứu do người dùng xác nhận); có thể thay bằng `FACILITIES_DATA_FILE`. Nearby response cung cấp `distanceMethod` (`ROAD` hoặc `STRAIGHT_LINE`) để FE không gắn nhãn đường bộ cho khoảng cách fallback.
- Hướng dẫn: `GUIDES_DATA_FILE`, dùng `data/guides.template.json`, lặp theo scenarioId/locale/audience. Chỉ nhập khi chuyên gia đã duyệt hướng dẫn và quyền dùng media. Template cố tình không hợp lệ để tránh xuất bản nhầm. API không tự dịch hoặc tự tạo hướng dẫn trẻ em.
- AED: `AEDS_DATA_FILE`, dùng `data/aeds.template.json`; phải xác minh địa điểm, điều kiện tiếp cận, tình trạng hoạt động và lần kiểm tra thiết bị.
- Người hỗ trợ: `SUPPORT_ADMIN_TOKEN` ít nhất 32 ký tự ngẫu nhiên; quản trị xác minh và cấp token, người hỗ trợ bật sẵn sàng. Mặc định chưa cấu hình quản trị nên endpoint admin trả 503.
- Ba API danh mục SOS trước đây được giữ. `/api/scenarios` vẫn là dữ liệu sơ cứu mẫu cũ; frontend mới dùng `/api/guides` có trạng thái duyệt. `/api/alerts` là SOS Bump cũ có lưu vị trí, không dùng để thay thế luồng mới.
- Production bật profile `prod`, HTTPS, CORS origin thật. Mọi API mới dùng chung giới hạn mặc định 60 request/phút/IP; chỉ `/api/health` và API alerts cũ được miễn. FE có thể lưu danh sách cơ sở gần nhất cho mạng yếu, không lưu/gửi transcript, tọa độ hoặc token lên analytics.
