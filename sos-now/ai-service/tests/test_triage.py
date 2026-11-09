from app.main import classify
from fastapi.testclient import TestClient
from app.main import app

def test_detects_stroke():
    assert classify("Bố tôi bị méo miệng và nói khó").scenario_id == "stroke"

def test_detects_choking():
    assert classify("Một người đang bị hóc nghẹn").scenario_id == "choking"

def test_unknown_does_not_default_to_cardiac():
    result = classify("xin chào tôi cần thông tin")
    assert result.scenario_id is None
    assert result.confidence == 0

def test_ambiguous_and_negated_input_requires_confirmation():
    assert classify("ngừng tim và chảy máu").scenario_id is None
    assert classify("không bị đột quỵ").scenario_id is None

def test_english_and_unaccented_input():
    assert classify("he is not breathing", "en").scenario_id == "cardiac"
    assert classify("meo mieng noi kho").scenario_id == "stroke"
    assert classify("unchoking", "en").scenario_id is None

def test_api_is_backwards_compatible_and_accepts_locale():
    client = TestClient(app)
    assert client.post("/triage", json={"text": "bị hóc nghẹn"}).json()["scenario_id"] == "choking"
    assert client.post("/triage", json={"text": "slurred speech", "locale": "en"}).json()["scenario_id"] == "stroke"
    assert client.post("/triage", json={"text": "hello", "locale": "fr"}).status_code == 422
