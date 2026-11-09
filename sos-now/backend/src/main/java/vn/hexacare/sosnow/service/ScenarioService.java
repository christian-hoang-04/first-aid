package vn.hexacare.sosnow.service;

import org.springframework.stereotype.Service;
import java.util.List;
import java.util.Map;

@Service
public class ScenarioService {
    public List<Map<String, Object>> all() {
        return List.of(
            scenario("cardiac", "Bất tỉnh / Ngừng thở", "CPR", List.of("Kiểm tra phản ứng", "Gọi 115", "Bắt đầu ép ngực 100–120 lần/phút")),
            scenario("choking", "Hóc / Nghẹn", "Đường thở", List.of("Khuyến khích ho", "5 vỗ lưng", "5 ép bụng")),
            scenario("stroke", "Dấu hiệu đột quỵ", "FAST", List.of("Kiểm tra mặt", "Kiểm tra tay", "Kiểm tra lời nói", "Gọi 115")),
            scenario("bleeding", "Chảy máu nhiều", "Cầm máu", List.of("Dùng vải sạch", "Ép trực tiếp", "Gọi 115 nếu chảy nhiều"))
        );
    }
    private Map<String, Object> scenario(String id, String title, String code, List<String> steps) {
        return Map.of("id", id, "title", title, "code", code, "steps", steps);
    }
}
