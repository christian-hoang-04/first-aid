# SOS NOW · HexaCare MVP

Monorepo cho bản MVP trợ lý sơ cấp cứu của nhóm HexaCare:

- `src/`: React/Vite frontend — giao diện khẩn cấp, hướng dẫn giọng nói, CPR metronome, vị trí, quiz và cộng đồng demo.
- `backend/`: Java 21 + Spring Boot REST API — tình huống sơ cứu và tín hiệu SOS mẫu.
- `ai-service/`: Python + FastAPI — nhận diện tình huống theo từ khóa, có cấu trúc sẵn để thay bằng mô hình NLP/RAG.

## Chạy frontend

```bash
npm install
npm run dev
```

## Chạy backend

```bash
cd backend
mvn spring-boot:run
```

## Chạy AI service

```bash
cd ai-service
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt
.venv/Scripts/uvicorn app.main:app --reload
```

Đặt `VITE_AI_API_URL=http://localhost:8000` khi muốn frontend gọi dịch vụ AI; nếu không, frontend tự dùng bộ nhận diện dự phòng nên bản demo deploy vẫn hoạt động.

> Nội dung y khoa trong MVP là dữ liệu minh họa, phải được chuyên gia y tế thẩm định trước khi dùng trong thực tế.
