package vn.hexacare.sosnow.phase;

import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/voice")
public class VoiceController {
    private final VoiceService voice;
    public VoiceController(VoiceService voice) { this.voice = voice; }
    @PostMapping("/interpret")
    public VoiceService.Response interpret(@RequestBody VoiceService.Request request) { return voice.interpret(request); }
}
