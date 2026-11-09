const problems = {
  stroke: {
    title: "Có dấu hiệu đột quỵ?",
    intro: "Hãy nghĩ đến F.A.S.T. và gọi trợ giúp ngay nếu có một trong các dấu hiệu này.",
    steps: ["Mặt lệch hoặc yếu một bên", "Một tay yếu, không giơ đều được", "Nói khó, nói ngọng hoặc lú lẫn", "Gọi 115 ngay — thời gian rất quan trọng"]
  },
  electric: {
    title: "Điện giật",
    intro: "Đừng chạm vào người khi nguồn điện chưa được ngắt và hiện trường chưa an toàn.",
    steps: ["Đứng cách xa nguồn điện", "Ngắt nguồn nếu có thể làm an toàn", "Gọi 115 hoặc nhờ người khác gọi", "Chỉ tiếp cận khi khu vực đã an toàn"]
  },
  bleeding: {
    title: "Chảy máu nhiều",
    intro: "Gọi trợ giúp sớm và chỉ ép trực tiếp khi bạn có thể làm điều đó an toàn.",
    steps: ["Dùng gạc hoặc vải sạch ép lên vết thương", "Không tự rút dị vật đang cắm", "Gọi 115 nếu máu chảy nhiều hoặc không dừng", "Làm theo hướng dẫn của nhân viên cấp cứu"]
  }
};

const modePanel = document.querySelector("#mode-panel");

function choicePanel(mode) {
  if (mode === "voice") {
    return `<div class="panel-heading"><span class="panel-icon panel-icon--voice">◌</span><div><p class="eyebrow">Chế độ giọng nói</p><h3>Bạn có thể nói ngắn gọn điều đang xảy ra.</h3></div></div><div class="voice-state"><span class="voice-pulse"></span><strong>Sẵn sàng lắng nghe</strong><small>Ví dụ: “Một người bị điện giật.”</small></div><p class="panel-footnote">Bản demo này chưa kết nối microphone. Khi phát triển thật, màn hình này sẽ bắt đầu nhận giọng nói của bạn.</p>`;
  }

  if (mode === "chat") {
    return `<div class="panel-heading"><span class="panel-icon">•••</span><div><p class="eyebrow">Chế độ trò chuyện</p><h3>Bắt đầu bằng một câu đơn giản.</h3></div></div><p class="panel-copy">Bạn có thể chọn một câu gợi ý để hình dung luồng trò chuyện:</p><div class="prompt-list"><button type="button" data-prompt="Có người bị ngất">Có người bị ngất</button><button type="button" data-prompt="Tôi không biết phải làm gì">Tôi không biết phải làm gì</button><button type="button" data-prompt="Hiện trường không an toàn">Hiện trường không an toàn</button></div><p class="panel-response" id="panel-response" aria-live="polite">Chọn một câu để xem phản hồi mẫu.</p>`;
  }

  return `<div class="panel-heading"><span class="panel-icon panel-icon--plus">+</span><div><p class="eyebrow">Chọn vấn đề</p><h3>Điều gì đang xảy ra?</h3></div></div><p class="panel-copy">Chọn tình huống gần nhất. Bạn sẽ thấy những việc đầu tiên cần lưu ý.</p><div class="problem-list"><button type="button" data-problem="stroke"><strong>Đột quỵ</strong><small>Mặt, tay, lời nói thay đổi</small><span>→</span></button><button type="button" data-problem="electric"><strong>Điện giật</strong><small>Ngắt nguồn trước khi chạm</small><span>→</span></button><button type="button" data-problem="bleeding"><strong>Chảy máu nhiều</strong><small>Ép trực tiếp nếu an toàn</small><span>→</span></button></div><div class="problem-result" id="problem-result" aria-live="polite"></div>`;
}

function renderMode(mode) {
  document.querySelectorAll(".choice-card").forEach((card) => card.classList.toggle("is-selected", card.dataset.mode === mode));
  modePanel.innerHTML = choicePanel(mode);
  modePanel.classList.add("is-visible");
  modePanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
  bindPanelInteractions();
}

function renderProblem(key) {
  const problem = problems[key];
  const result = document.querySelector("#problem-result");
  if (!problem || !result) return;
  result.innerHTML = `<div class="result-header"><span class="eyebrow">Bước đầu tiên</span><h4>${problem.title}</h4><p>${problem.intro}</p></div><ol>${problem.steps.map((step) => `<li>${step}</li>`).join("")}</ol><a class="result-call" href="tel:115">Gọi 115 nếu cần trợ giúp y tế <span>↗</span></a>`;
  result.classList.add("is-visible");
}

function bindPanelInteractions() {
  document.querySelectorAll("[data-prompt]").forEach((button) => {
    button.addEventListener("click", () => {
      const response = document.querySelector("#panel-response");
      response.textContent = `Bạn chọn: “${button.dataset.prompt}” — Hãy bắt đầu bằng việc kiểm tra hiện trường và gọi trợ giúp nếu cần.`;
      document.querySelectorAll("[data-prompt]").forEach((item) => item.classList.toggle("is-selected", item === button));
    });
  });
  document.querySelectorAll("[data-problem]").forEach((button) => {
    button.addEventListener("click", () => {
      renderProblem(button.dataset.problem);
      document.querySelectorAll("[data-problem]").forEach((item) => item.classList.toggle("is-selected", item === button));
    });
  });
}

document.querySelectorAll(".choice-card").forEach((card) => {
  card.addEventListener("click", () => renderMode(card.dataset.mode));
});

const locationStatus = document.querySelector("#location-status");
const facilityResults = document.querySelector("#facility-results");
const facilityMap = document.querySelector("#facility-map");
const facilityMapNote = document.querySelector("#facility-map-note");
const facilityMapView = document.querySelector("#facility-map-view");
let facilityLeafletMap = null;
let facilityLeafletTiles = null;
let facilityLeafletMarkers = null;
let facilityMapLibreMap = null;
let facilityMapLibreMarkers = [];
let facilityTileLoads = 0;
let facilityTileErrors = 0;
let facilityTileFallbackTimer = null;
let facilityMapTilesUnavailable = false;
let facilityMapBasemapMode = null;
let latestFacilityMapRequest = null;
let roadGraphPromise = null;
let roadGraphIndex = null;
let routeWorker = null;
let routeRequestId = 0;
let activeRoutePosition = null;

function updateLocationStatus(message) {
  if (locationStatus) locationStatus.textContent = message;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>\"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character]);
}

function formatDistance(distanceKm) {
  if (distanceKm < 1) return `${Math.round(distanceKm * 1000)} m`;
  return `${distanceKm.toFixed(1)} km`;
}

const facilityMapWidth = 1000;
const facilityMapHeight = 620;
const facilityMapTileUrl = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const facilityMapStyleUrl = "https://tiles.openfreemap.org/styles/liberty";

function facilityMapBoundsFor(position, facilities) {
  const points = [position, ...facilities];
  const latitudes = points.map((point) => point.latitude);
  const longitudes = points.map((point) => point.longitude);
  const minLatitude = Math.min(...latitudes);
  const maxLatitude = Math.max(...latitudes);
  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);
  const centerLatitude = (minLatitude + maxLatitude) / 2;
  const centerLongitude = (minLongitude + maxLongitude) / 2;
  const kilometersPerLatitude = 111.32;
  const kilometersPerLongitude = kilometersPerLatitude * Math.max(0.1, Math.cos(centerLatitude * Math.PI / 180));
  let heightKm = Math.max((maxLatitude - minLatitude) * kilometersPerLatitude, 2.5) * 1.28;
  let widthKm = Math.max((maxLongitude - minLongitude) * kilometersPerLongitude, 2.5) * 1.28;
  const aspectRatio = facilityMapWidth / facilityMapHeight;
  if (widthKm / heightKm < aspectRatio) widthKm = heightKm * aspectRatio;
  else heightKm = widthKm / aspectRatio;
  const latitudeSpan = heightKm / kilometersPerLatitude;
  const longitudeSpan = widthKm / kilometersPerLongitude;
  return {
    minLatitude: centerLatitude - latitudeSpan / 2,
    maxLatitude: centerLatitude + latitudeSpan / 2,
    minLongitude: centerLongitude - longitudeSpan / 2,
    maxLongitude: centerLongitude + longitudeSpan / 2
  };
}

function renderFacilityMapFallback(facilities, userLocation, mapData = null) {
  if (!facilityMap || !facilityMapNote || !facilityMapView || !userLocation) return;
  const bounds = mapData?.bounds || facilityMapBoundsFor(userLocation, facilities);
  const width = mapData?.width || facilityMapWidth;
  const height = mapData?.height || facilityMapHeight;
  const project = (point) => ({
    x: (point.longitude - bounds.minLongitude) / (bounds.maxLongitude - bounds.minLongitude) * width,
    y: height - (point.latitude - bounds.minLatitude) / (bounds.maxLatitude - bounds.minLatitude) * height
  });
  const userPoint = project(userLocation);
  const roads = mapData?.roadPath ? `<path class="facility-map-roads" d="${mapData.roadPath}"/>` : "";
  const gridPath = [200, 400, 600, 800].map((x) => `M${x} 0V${height}`).concat([155, 310, 465].map((y) => `M0 ${y}H${width}`)).join("");
  const markerMarkup = facilities.map((facility, index) => {
    const point = project(facility);
    const distance = facility.distanceMode === "preview" ? `~${formatDistance(facility.estimatedDistanceKm)}`
      : facility.distanceMode === "straight-line" ? `~${formatDistance(facility.estimatedDistanceKm)}`
        : formatDistance(facility.estimatedDistanceKm);
    const label = `${String(index + 1).padStart(2, "0")} · ${distance}`;
    const labelWidth = 112;
    const labelX = Math.max(6, Math.min(width - labelWidth - 6, point.x < width * .72 ? point.x + 15 : point.x - labelWidth - 15));
    const labelY = Math.max(6, Math.min(height - 27, point.y + (index % 2 ? 16 : -27)));
    return `<g class="facility-map-marker facility-map-marker--facility" data-facility-index="${index}" tabindex="0" role="button" aria-label="${escapeHtml(facility.name)}, ${escapeHtml(distance)}" transform="translate(${point.x.toFixed(1)} ${point.y.toFixed(1)})"><title>${escapeHtml(facility.name)}</title><circle r="13"></circle><text y=".5">${String(index + 1).padStart(2, "0")}</text></g><g transform="translate(${labelX.toFixed(1)} ${labelY.toFixed(1)})"><rect class="facility-map-label" width="${labelWidth}" height="22" rx="6"></rect><text class="facility-map-label-text" x="8" y="15">${label}</text></g>`;
  }).join("");
  const userLabelX = Math.max(6, Math.min(width - 52, userPoint.x + 14));
  const userLabelY = Math.max(6, Math.min(height - 25, userPoint.y - 12));
  const note = facilities.some((facility) => facility.distanceMode === "preview")
    ? "Khoảng cách tạm tính · đang hoàn thiện tuyến đường"
    : facilities.some((facility) => facility.distanceMode === "straight-line")
      ? mapData?.withinSavedArea === false
        ? "Ngoài vùng đường lưu · khoảng cách đường thẳng ước tính"
        : mapData?.withinSavedArea === true
          ? "Tuyến đường lưu chưa khả dụng · khoảng cách đường thẳng ước tính"
          : "Khoảng cách đường thẳng ước tính · bản đồ lưu chưa sẵn sàng"
      : mapData?.roadPath
        ? "Theo mạng đường lưu · không gồm giao thông thời gian thực"
        : "Vị trí tương đối · nền đường lưu chưa khả dụng";
  facilityMapNote.textContent = note;
  facilityMapView.setAttribute("aria-label", `Bản đồ vị trí của bạn và ${facilities.length} cơ sở gần nhất. ${facilities.map((facility, index) => `${index + 1}: ${facility.name}, ${formatDistance(facility.estimatedDistanceKm)}`).join("; ")}`);
  facilityMapView.classList.add("facility-map-view--fallback");
  facilityMapView.innerHTML = `<div class="facility-map-fallback-controls" role="group" aria-label="Điều khiển thu phóng bản đồ"><button type="button" data-map-zoom="in" aria-label="Phóng to bản đồ" title="Phóng to">+</button><button type="button" data-map-zoom="out" aria-label="Thu nhỏ bản đồ" title="Thu nhỏ">−</button></div><svg viewBox="0 0 ${width} ${height}"><rect class="facility-map-background" width="${width}" height="${height}"></rect><path class="facility-map-grid" d="${gridPath}"></path>${roads}<g class="facility-map-marker facility-map-marker--you" transform="translate(${userPoint.x.toFixed(1)} ${userPoint.y.toFixed(1)})"><circle r="12"></circle><text y=".5">U</text></g><g transform="translate(${userLabelX.toFixed(1)} ${userLabelY.toFixed(1)})"><rect class="facility-map-label" width="48" height="22" rx="6"></rect><text class="facility-map-label-text" x="8" y="15">Bạn</text></g>${markerMarkup}</svg><div class="facility-map-place-card" hidden role="region" aria-live="polite"></div>`;
  const fallbackSvg = facilityMapView.querySelector("svg");
  const zoomButtons = [...facilityMapView.querySelectorAll("[data-map-zoom]")];
  const placeCard = facilityMapView.querySelector(".facility-map-place-card");
  const minZoom = 1;
  const maxZoom = 4;
  let zoom = minZoom;
  let viewBox = { x: 0, y: 0, width, height };
  let activePointer = null;
  const updateFallbackView = () => {
    fallbackSvg.setAttribute("viewBox", `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`);
    zoomButtons.forEach((button) => {
      button.disabled = button.dataset.mapZoom === "in" ? zoom >= maxZoom : zoom <= minZoom;
    });
  };
  const setFallbackZoom = (nextZoom, anchorX = .5, anchorY = .5) => {
    zoom = Math.max(minZoom, Math.min(maxZoom, nextZoom));
    const anchorMapX = viewBox.x + viewBox.width * anchorX;
    const anchorMapY = viewBox.y + viewBox.height * anchorY;
    viewBox = {
      x: anchorMapX - width / zoom * anchorX,
      y: anchorMapY - height / zoom * anchorY,
      width: width / zoom,
      height: height / zoom
    };
    updateFallbackView();
  };
  const showFallbackPlace = (index) => {
    const facility = facilities[index];
    if (!facility) return;
    const address = facility.address
      ? `<p>${escapeHtml(facility.address)}</p>`
      : `<p>Chưa có địa chỉ.</p>`;
    const directions = `<a class="facility-map-link" href="${escapeHtml(facilityMapUrl(facility))}" target="_blank" rel="noopener noreferrer">Chỉ đường</a>`;
    placeCard.innerHTML = `<button class="facility-map-place-close" type="button" aria-label="Đóng thông tin địa điểm">×</button><strong>${escapeHtml(facility.name)}</strong><span>${escapeHtml(facilityDistanceLabel(facility))}</span>${address}<div class="facility-map-place-actions">${facilityPhoneLink(facility.phone)}${directions}</div>`;
    placeCard.hidden = false;
    placeCard.querySelector(".facility-map-place-close").addEventListener("click", () => { placeCard.hidden = true; });
  };
  zoomButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setFallbackZoom(button.dataset.mapZoom === "in" ? zoom * 1.25 : zoom / 1.25);
    });
  });
  fallbackSvg.addEventListener("wheel", (event) => {
    event.preventDefault();
    const rect = fallbackSvg.getBoundingClientRect();
    const anchorX = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const anchorY = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
    setFallbackZoom(zoom * (event.deltaY < 0 ? 1.15 : 1 / 1.15), anchorX, anchorY);
  }, { passive: false });
  fallbackSvg.addEventListener("pointerdown", (event) => {
    if (!event.isPrimary || event.button !== 0) return;
    activePointer = { id: event.pointerId, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, target: event.target, moved: false };
    facilityMapView.classList.add("is-panning");
    fallbackSvg.setPointerCapture(event.pointerId);
    event.preventDefault();
  });
  fallbackSvg.addEventListener("pointermove", (event) => {
    if (!activePointer || activePointer.id !== event.pointerId) return;
    const deltaX = event.clientX - activePointer.x;
    const deltaY = event.clientY - activePointer.y;
    if (Math.abs(event.clientX - activePointer.startX) > 4 || Math.abs(event.clientY - activePointer.startY) > 4) activePointer.moved = true;
    const rect = fallbackSvg.getBoundingClientRect();
    viewBox.x -= deltaX / rect.width * viewBox.width;
    viewBox.y -= deltaY / rect.height * viewBox.height;
    activePointer.x = event.clientX;
    activePointer.y = event.clientY;
    updateFallbackView();
  });
  const finishFallbackPointer = (event, selectPlace) => {
    if (!activePointer || activePointer.id !== event.pointerId) return;
    const pointer = activePointer;
    activePointer = null;
    facilityMapView.classList.remove("is-panning");
    if (selectPlace && !pointer.moved) {
      const marker = pointer.target.closest?.("[data-facility-index]");
      if (marker) showFallbackPlace(Number(marker.dataset.facilityIndex));
    }
    if (fallbackSvg.hasPointerCapture(event.pointerId)) fallbackSvg.releasePointerCapture(event.pointerId);
  };
  fallbackSvg.addEventListener("pointerup", (event) => finishFallbackPointer(event, true));
  fallbackSvg.addEventListener("pointercancel", (event) => finishFallbackPointer(event, false));
  fallbackSvg.addEventListener("keydown", (event) => {
    const marker = event.target.closest?.("[data-facility-index]");
    if (marker && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      showFallbackPlace(Number(marker.dataset.facilityIndex));
    }
  });
  updateFallbackView();
  facilityMap.hidden = false;
}

function facilityDistanceLabel(facility) {
  const isEstimate = facility.distanceMode === "preview" || facility.distanceMode === "straight-line";
  return `${isEstimate ? "~" : ""}${formatDistance(facility.estimatedDistanceKm)}`;
}

function facilityMapDistanceNote(facilities, mapData) {
  if (facilities.some((facility) => facility.distanceMode === "preview")) {
    return "Khoảng cách tạm tính · đang hoàn thiện tuyến đường";
  }
  if (facilities.some((facility) => facility.distanceMode === "straight-line")) {
    return mapData?.withinSavedArea === false
      ? "Ngoài vùng đường lưu · khoảng cách đường thẳng ước tính"
      : "Khoảng cách đường thẳng ước tính";
  }
  return "Khoảng cách theo mạng đường lưu · không gồm giao thông thời gian thực";
}

function showSavedMapAfterTileFailure() {
  facilityTileFallbackTimer = null;
  if (facilityTileLoads > 0 || !latestFacilityMapRequest) return;

  facilityMapTilesUnavailable = true;
  facilityMapLibreMarkers.forEach((marker) => marker.remove());
  facilityMapLibreMarkers = [];
  if (facilityMapLibreMap) facilityMapLibreMap.remove();
  facilityMapLibreMap = null;
  if (facilityLeafletMap) facilityLeafletMap.remove();
  facilityLeafletMap = null;
  facilityLeafletTiles = null;
  facilityLeafletMarkers = null;

  const { facilities, userLocation, mapData } = latestFacilityMapRequest;
  renderFacilityMapFallback(facilities, userLocation, mapData);
  facilityMapNote.textContent = "Kh\u00f4ng t\u1ea3i \u0111\u01b0\u1ee3c n\u1ec1n \u0111\u01b0\u1eddng ph\u1ed1 \u00b7 hi\u1ec3n th\u1ecb b\u1ea3n \u0111\u1ed3 \u0111\u01b0\u1eddng l\u01b0u c\u1ee5c b\u1ed9";
}

function markFacilityBasemapReady() {
  facilityTileLoads += 1;
  if (facilityTileFallbackTimer) {
    window.clearTimeout(facilityTileFallbackTimer);
    facilityTileFallbackTimer = null;
  }
  if (facilityMapNote?.dataset.distanceNote) {
    facilityMapNote.textContent = facilityMapNote.dataset.distanceNote;
  }
}

function facilityMapPopupContent(facility) {
  const distance = facilityDistanceLabel(facility);
  const address = facility.address
    ? `<small class="facility-map-popup-address">${escapeHtml(facility.address)}</small>`
    : `<small class="facility-map-popup-address">Ch\u01b0a c\u00f3 \u0111\u1ecba ch\u1ec9.</small>`;
  const directions = `<a class="facility-map-link" href="${escapeHtml(facilityMapUrl(facility))}" target="_blank" rel="noopener noreferrer">Ch\u1ec9 \u0111\u01b0\u1eddng</a>`;
  return `<strong>${escapeHtml(facility.name)}</strong><span>${escapeHtml(distance)}</span>${address}<div class="facility-map-popup-actions">${facilityPhoneLink(facility.phone)}${directions}</div>`;
}

function renderFacilityMapLibreMarkers(facilities, userLocation, fitBounds = true) {
  if (!facilityMapLibreMap) return;
  facilityMapLibreMarkers.forEach((marker) => marker.remove());
  facilityMapLibreMarkers = [];

  const userIcon = document.createElement("div");
  userIcon.className = "facility-leaflet-icon";
  userIcon.innerHTML = '<span class="facility-leaflet-marker-content"><span class="facility-leaflet-pin facility-leaflet-pin--you"><span>U</span></span><span class="facility-leaflet-label">B\u1ea1n</span></span>';
  userIcon.setAttribute("aria-label", "V\u1ecb tr\u00ed c\u1ee7a b\u1ea1n");
  userIcon.title = "V\u1ecb tr\u00ed c\u1ee7a b\u1ea1n";
  facilityMapLibreMarkers.push(new window.maplibregl.Marker({
    element: userIcon,
    anchor: "bottom-left",
    offset: [-15, 0]
  }).setLngLat([userLocation.longitude, userLocation.latitude])
    .setPopup(new window.maplibregl.Popup({ offset: 24 }).setHTML("<strong>V\u1ecb tr\u00ed c\u1ee7a b\u1ea1n</strong>"))
    .addTo(facilityMapLibreMap));

  const threshold = facilityMapLibreMap.getZoom() < 14 ? 110 : facilityMapLibreMap.getZoom() < 15 ? 72 : 42;
  const groups = [];
  facilities.forEach((facility, index) => {
    const point = facilityMapLibreMap.project([facility.longitude, facility.latitude]);
    const entry = { facility, index, point };
    const group = groups.find((candidate) => candidate.some((member) => Math.hypot(member.point.x - point.x, member.point.y - point.y) < threshold));
    if (group) group.push(entry);
    else groups.push([entry]);
  });

  groups.forEach((group) => {
    const clustered = group.length > 1;
    const first = group[0];
    const facility = first.facility;
    const number = String(first.index + 1).padStart(2, "0");
    const icon = document.createElement("div");
    icon.className = "facility-leaflet-icon";
    if (clustered) {
      icon.innerHTML = `<span class="facility-leaflet-marker-content"><span class="facility-leaflet-pin facility-leaflet-pin--facility"><span>${group.length}</span></span><span class="facility-leaflet-label">${group.length} c\u01a1 s\u1edf</span></span>`;
    } else {
      const distance = facilityDistanceLabel(facility);
      icon.innerHTML = `<span class="facility-leaflet-marker-content"><span class="facility-leaflet-pin facility-leaflet-pin--facility"><span>${number}</span></span><span class="facility-leaflet-label">${distance}</span></span>`;
    }
    const titles = group.map((entry) => entry.facility.name).join(", ");
    icon.setAttribute("aria-label", clustered ? `${group.length} c\u01a1 s\u1edf h\u1ed7 tr\u1ee3 g\u1ea7n nhau: ${titles}` : `${facility.name} \u00b7 ${facilityDistanceLabel(facility)}`);
    icon.title = clustered ? `${group.length} c\u01a1 s\u1edf h\u1ed7 tr\u1ee3 g\u1ea7n nhau: ${titles}` : `${facility.name} \u00b7 ${facilityDistanceLabel(facility)}`;

    const popup = clustered
      ? `<strong>${group.length} c\u01a1 s\u1edf h\u1ed7 tr\u1ee3 g\u1ea7n nhau</strong><div class="facility-map-cluster-list">${group.map((entry) => `<section>${facilityMapPopupContent(entry.facility)}</section>`).join("")}</div>`
      : facilityMapPopupContent(facility);
    const longitude = group.reduce((total, entry) => total + entry.facility.longitude, 0) / group.length;
    const latitude = group.reduce((total, entry) => total + entry.facility.latitude, 0) / group.length;
    facilityMapLibreMarkers.push(new window.maplibregl.Marker({
      element: icon,
      anchor: "bottom-left",
      offset: [-15, 0]
    }).setLngLat([longitude, latitude])
      .setPopup(new window.maplibregl.Popup({ offset: 24, maxWidth: clustered ? "340px" : "300px" }).setHTML(popup))
      .addTo(facilityMapLibreMap));
  });

  if (fitBounds) {
    const bounds = new window.maplibregl.LngLatBounds();
    [userLocation, ...facilities].forEach((point) => bounds.extend([point.longitude, point.latitude]));
    facilityMapLibreMap.fitBounds(bounds, {
      padding: { top: 48, bottom: 48, left: 48, right: 132 },
      maxZoom: 14,
      duration: 0
    });
  }
}
function renderFacilityLeafletMarkers(facilities, userLocation) {
  if (!facilityLeafletMap || !facilityLeafletMarkers) return;
  facilityLeafletMarkers.clearLayers();
  const userIcon = window.L.divIcon({
    className: "facility-leaflet-icon",
    html: '<span class="facility-leaflet-marker-content"><span class="facility-leaflet-pin facility-leaflet-pin--you"><span>U</span></span><span class="facility-leaflet-label">B\u1ea1n</span></span>',
    iconSize: [70, 40],
    iconAnchor: [15, 37],
    popupAnchor: [0, -35]
  });
  window.L.marker([userLocation.latitude, userLocation.longitude], {
    icon: userIcon,
    title: "V\u1ecb tr\u00ed c\u1ee7a b\u1ea1n",
    keyboard: true,
    zIndexOffset: 1000
  }).bindPopup("<strong>V\u1ecb tr\u00ed c\u1ee7a b\u1ea1n</strong>").addTo(facilityLeafletMarkers);

  facilities.forEach((facility, index) => {
    const distance = facilityDistanceLabel(facility);
    const number = String(index + 1).padStart(2, "0");
    const icon = window.L.divIcon({
      className: "facility-leaflet-icon",
      html: `<span class="facility-leaflet-marker-content"><span class="facility-leaflet-pin facility-leaflet-pin--facility"><span>${number}</span></span><span class="facility-leaflet-label">${distance}</span></span>`,
      iconSize: [116, 40],
      iconAnchor: [15, 37],
      popupAnchor: [0, -35]
    });
    const address = facility.address ? `<small class="facility-map-popup-address">${escapeHtml(facility.address)}</small>` : `<small class="facility-map-popup-address">Ch\u01b0a c\u00f3 \u0111\u1ecba ch\u1ec9.</small>`;
    const directions = `<a class="facility-map-link" href="${escapeHtml(facilityMapUrl(facility))}" target="_blank" rel="noopener noreferrer">Ch\u1ec9 \u0111\u01b0\u1eddng</a>`;
    const popup = `<strong>${escapeHtml(facility.name)}</strong><span>${escapeHtml(distance)}</span>${address}<div class="facility-map-popup-actions">${facilityPhoneLink(facility.phone)}${directions}</div>`;
    window.L.marker([facility.latitude, facility.longitude], {
      icon,
      title: `${facility.name} \u00b7 ${distance}`,
      keyboard: true
    }).bindTooltip(escapeHtml(facility.name), { direction: "top", offset: [15, -34], opacity: .98 }).bindPopup(popup).addTo(facilityLeafletMarkers);
  });

  const points = [userLocation, ...facilities].map((point) => [point.latitude, point.longitude]);
  const bounds = window.L.latLngBounds(points).pad(0.18);
  window.requestAnimationFrame(() => {
    if (!facilityLeafletMap) return;
    facilityLeafletMap.invalidateSize({ pan: false });
    facilityLeafletMap.fitBounds(bounds, { padding: [28, 28], maxZoom: 15, animate: false });
  });
}

function useFacilityRasterBasemap() {
  if (facilityMapBasemapMode === "raster" || facilityMapTilesUnavailable || !latestFacilityMapRequest) return;
  facilityMapBasemapMode = "raster";
  if (facilityTileFallbackTimer) {
    window.clearTimeout(facilityTileFallbackTimer);
    facilityTileFallbackTimer = null;
  }
  facilityMapLibreMarkers.forEach((marker) => marker.remove());
  facilityMapLibreMarkers = [];
  if (facilityMapLibreMap) facilityMapLibreMap.remove();
  facilityMapLibreMap = null;
  if (facilityLeafletTiles && facilityLeafletMap) facilityLeafletMap.removeLayer(facilityLeafletTiles);

  const { userLocation, facilities } = latestFacilityMapRequest;
  if (!facilityLeafletMap) {
    facilityLeafletMap = window.L.map(facilityMapView, {
      dragging: true,
      zoomControl: true,
      scrollWheelZoom: true,
      keyboard: true,
      maxZoom: 19,
      minZoom: 3
    }).setView([userLocation.latitude, userLocation.longitude], 13);
    facilityLeafletMarkers = window.L.layerGroup().addTo(facilityLeafletMap);
  }

  facilityTileLoads = 0;
  facilityTileErrors = 0;
  facilityMapNote.textContent = "\u0110ang t\u1ea3i n\u1ec1n b\u1ea3n \u0111\u1ed3 \u0111\u01b0\u1eddng ph\u1ed1\u2026";
  facilityLeafletTiles = window.L.tileLayer(facilityMapTileUrl, {
    maxZoom: 19,
    minZoom: 3,
    updateWhenIdle: true,
    keepBuffer: 1,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  });
  facilityLeafletTiles.on("tileload", markFacilityBasemapReady);
  facilityLeafletTiles.on("tileerror", () => {
    facilityTileErrors += 1;
    if (facilityTileLoads === 0 && facilityTileErrors >= 4 && !facilityTileFallbackTimer) {
      facilityTileFallbackTimer = window.setTimeout(showSavedMapAfterTileFailure, 800);
    }
  });
  facilityLeafletTiles.addTo(facilityLeafletMap);
  facilityTileFallbackTimer = window.setTimeout(showSavedMapAfterTileFailure, 9000);
  renderFacilityLeafletMarkers(facilities, userLocation);
}

function initializeFacilityMap(userLocation) {
  if (typeof window.L === "undefined" || typeof window.maplibregl === "undefined" || !facilityMapView) return false;
  if (facilityMapLibreMap || facilityLeafletMap || facilityMapBasemapMode === "vector-loading") return true;

  facilityMapView.classList.remove("facility-map-view--fallback", "is-panning");
  facilityTileLoads = 0;
  facilityTileErrors = 0;
  facilityMapBasemapMode = "vector-loading";
  facilityTileFallbackTimer = window.setTimeout(useFacilityRasterBasemap, 9000);
  fetch(facilityMapStyleUrl)
    .then((response) => {
      if (!response.ok) throw new Error("Map style request failed");
      return response.json();
    })
    .then((style) => {
      if (facilityMapBasemapMode !== "vector-loading" || !facilityMapView) return;
      style.layers = style.layers.filter((layer) => layer.id !== "natural_earth");
      facilityMapLibreMap = new window.maplibregl.Map({
        container: facilityMapView,
        style,
        center: [userLocation.longitude, userLocation.latitude],
        zoom: 13,
        minZoom: 3,
        maxZoom: 19,
        attributionControl: true
      });
      facilityMapBasemapMode = "vector";
      facilityMapLibreMap.addControl(new window.maplibregl.NavigationControl({ showCompass: false }), "top-left");
      facilityMapLibreMap.on("load", markFacilityBasemapReady);
      facilityMapLibreMap.on("error", () => {
        facilityTileErrors += 1;
        if (facilityTileLoads === 0 && facilityTileErrors >= 4) useFacilityRasterBasemap();
      });
      facilityMapLibreMap.on("zoomend", () => {
        if (latestFacilityMapRequest) {
          renderFacilityMapLibreMarkers(latestFacilityMapRequest.facilities, latestFacilityMapRequest.userLocation, false);
        }
      });
      if (latestFacilityMapRequest) {
        renderFacilityMapLibreMarkers(latestFacilityMapRequest.facilities, latestFacilityMapRequest.userLocation);
      }
    })
    .catch(() => useFacilityRasterBasemap());
  return true;
}

function renderFacilityMap(facilities, userLocation, mapData = null) {
  if (!facilityMap || !facilityMapNote || !facilityMapView || !userLocation) return;
  latestFacilityMapRequest = { facilities, userLocation, mapData };
  facilityMap.hidden = false;
  facilityMapNote.dataset.distanceNote = facilityMapDistanceNote(facilities, mapData);
  facilityMapNote.textContent = facilityMapNote.dataset.distanceNote;
  facilityMapView.setAttribute("aria-label", `B\u1ea3n \u0111\u1ed3 \u0111\u01b0\u1eddng ph\u1ed1 t\u01b0\u01a1ng t\u00e1c. V\u1ecb tr\u00ed c\u1ee7a b\u1ea1n v\u00e0 ${facilities.length} c\u01a1 s\u1edf h\u1ed7 tr\u1ee3 g\u1ea7n nh\u1ea5t. D\u00f9ng n\u00fat c\u1ed9ng tr\u1eeb ho\u1eb7c con l\u0103n \u0111\u1ec3 thu ph\u00f3ng, k\u00e9o \u0111\u1ec3 di chuy\u1ec3n. ${facilities.map((facility, index) => `${index + 1}: ${facility.name}, ${facilityDistanceLabel(facility)}`).join("; ")}`);

  if (facilityMapTilesUnavailable) {
    renderFacilityMapFallback(facilities, userLocation, mapData);
    facilityMapNote.textContent = "Kh\u00f4ng t\u1ea3i \u0111\u01b0\u1ee3c n\u1ec1n \u0111\u01b0\u1eddng ph\u1ed1 \u00b7 hi\u1ec3n th\u1ecb b\u1ea3n \u0111\u1ed3 \u0111\u01b0\u1eddng l\u01b0u c\u1ee5c b\u1ed9";
    return;
  }
  if (!initializeFacilityMap(userLocation)) {
    renderFacilityMapFallback(facilities, userLocation, mapData);
    return;
  }

  if (facilityMapLibreMap) renderFacilityMapLibreMarkers(facilities, userLocation);
  if (facilityLeafletMap) renderFacilityLeafletMarkers(facilities, userLocation);
}
function distanceBetween(first, second) {
  const earthRadiusKm = 6371;
  const latitudeDelta = (second.latitude - first.latitude) * Math.PI / 180;
  const longitudeDelta = (second.longitude - first.longitude) * Math.PI / 180;
  const firstLatitude = first.latitude * Math.PI / 180;
  const secondLatitude = second.latitude * Math.PI / 180;
  const haversine = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(firstLatitude) * Math.cos(secondLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function loadRoadGraph() {
  if (!roadGraphPromise) {
    roadGraphPromise = fetch("map-data/saigon-road-graph.json")
      .then((response) => {
        if (!response.ok) throw new Error(`Local map responded with ${response.status}`);
        return response.json();
      });
  }
  return roadGraphPromise;
}

function pointInsideMap(point, graph) {
  const [minLatitude, minLongitude, maxLatitude, maxLongitude] = graph.bbox;
  return point.latitude >= minLatitude && point.latitude <= maxLatitude && point.longitude >= minLongitude && point.longitude <= maxLongitude;
}

function buildMapNodeIndex(graph) {
  const cellSize = 0.002;
  const cells = new Map();
  for (let node = 0; node < graph.offsets.length - 1; node += 1) {
    const key = `${Math.floor(graph.coordinates[node * 2] / cellSize)}:${Math.floor(graph.coordinates[node * 2 + 1] / cellSize)}`;
    const cell = cells.get(key);
    if (cell) cell.push(node);
    else cells.set(key, [node]);
  }
  return { cellSize, cells };
}

function findNearbyMapNodes(graph, index, point, limit = 24) {
  const cellLatitude = Math.floor(point.latitude / index.cellSize);
  const cellLongitude = Math.floor(point.longitude / index.cellSize);
  const candidates = new Map();
  for (let latitudeOffset = -4; latitudeOffset <= 4; latitudeOffset += 1) {
    for (let longitudeOffset = -4; longitudeOffset <= 4; longitudeOffset += 1) {
      const nodes = index.cells.get(`${cellLatitude + latitudeOffset}:${cellLongitude + longitudeOffset}`) || [];
      nodes.forEach((node) => {
        const candidate = { latitude: graph.coordinates[node * 2], longitude: graph.coordinates[node * 2 + 1] };
        const distance = distanceBetween(point, candidate);
        const previous = candidates.get(node);
        if (!previous || distance < previous.distanceMeters / 1000) candidates.set(node, { node, distanceMeters: distance * 1000 });
      });
    }
  }
  return [...candidates.values()].sort((first, second) => first.distanceMeters - second.distanceMeters).slice(0, limit);
}

function findNearestMapNode(graph, index, point) {
  return findNearbyMapNodes(graph, index, point, 1)[0] || null;
}

function findReachableMapNode(graph, index, point, distances) {
  return findNearbyMapNodes(graph, index, point).find((candidate) => Number.isFinite(distances[candidate.node])) || null;
}

class RouteMinHeap {
  constructor() {
    this.items = [];
  }

  push(distance, node) {
    const item = [distance, node];
    this.items.push(item);
    let index = this.items.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.items[parent][0] <= item[0]) break;
      this.items[index] = this.items[parent];
      index = parent;
    }
    this.items[index] = item;
  }

  pop() {
    if (!this.items.length) return null;
    const first = this.items[0];
    const last = this.items.pop();
    if (this.items.length) {
      let index = 0;
      while (true) {
        let child = index * 2 + 1;
        if (child >= this.items.length) break;
        if (child + 1 < this.items.length && this.items[child + 1][0] < this.items[child][0]) child += 1;
        if (this.items[child][0] >= last[0]) break;
        this.items[index] = this.items[child];
        index = child;
      }
      this.items[index] = last;
    }
    return first;
  }

  peekDistance() {
    return this.items.length ? this.items[0][0] : Infinity;
  }
}

function shortestMapDistances(graph, startNode) {
  const distances = new Float64Array(graph.offsets.length - 1);
  distances.fill(Infinity);
  const heap = new RouteMinHeap();
  distances[startNode] = 0;
  heap.push(0, startNode);
  while (true) {
    const current = heap.pop();
    if (!current) break;
    const [distance, node] = current;
    if (distance !== distances[node]) continue;
    for (let edge = graph.offsets[node]; edge < graph.offsets[node + 1]; edge += 1) {
      const target = graph.targets[edge];
      const nextDistance = distance + graph.distances[edge];
      if (nextDistance < distances[target]) {
        distances[target] = nextDistance;
        heap.push(nextDistance, target);
      }
    }
  }
  return distances;
}

function routeFacilitiesOnSavedMapLegacy(graph, position) {
  if (!pointInsideMap(position, graph)) return [];
  if (!roadGraphIndex) roadGraphIndex = buildMapNodeIndex(graph);
  const nodeIndex = roadGraphIndex;
  const facilities = trackedFacilities.map(normalizeFacility).filter((facility) => pointInsideMap(facility, graph));
  const originCandidates = findNearbyMapNodes(graph, nodeIndex, position, 8);
  let bestRoutes = [];
  let bestOriginSnap = null;

  for (const originSnap of originCandidates) {
    const distances = shortestMapDistances(graph, originSnap.node);
    const routes = facilities.map((facility) => {
      const facilitySnap = findReachableMapNode(graph, nodeIndex, facility, distances);
      if (!facilitySnap) return null;
      return {
        ...facility,
        routeDistanceKm: (distances[facilitySnap.node] + originSnap.distanceMeters + facilitySnap.distanceMeters) / 1000,
        distanceMode: "saved-road"
      };
    }).filter(Boolean);

    if (routes.length > bestRoutes.length || (routes.length === bestRoutes.length && (!bestOriginSnap || originSnap.distanceMeters < bestOriginSnap.distanceMeters))) {
      bestRoutes = routes;
      bestOriginSnap = originSnap;
    }
    if (bestRoutes.length >= 12) break;
  }

  return bestRoutes;
}

function buildFacilityCandidateMap(graph, index, facilities) {
  const candidatesByNode = new Map();
  facilities.forEach((facility, facilityIndex) => {
    let candidates = index.facilityCandidates?.get(facility.id);
    if (!candidates) {
      candidates = findNearbyMapNodes(graph, index, facility);
      if (index.facilityCandidates) index.facilityCandidates.set(facility.id, candidates);
    }
    candidates.forEach((candidate) => {
      const matches = candidatesByNode.get(candidate.node);
      const match = { facilityIndex, distanceMeters: candidate.distanceMeters };
      if (matches) matches.push(match);
      else candidatesByNode.set(candidate.node, [match]);
    });
  });
  return candidatesByNode;
}

function nearestFacilitiesByBoundedDijkstra(graph, startNode, originDistanceMeters, facilities, candidatesByNode) {
  const distances = new Float64Array(graph.offsets.length - 1);
  distances.fill(Infinity);
  const heap = new RouteMinHeap();
  const bestByFacility = new Map();
  distances[startNode] = 0;
  heap.push(0, startNode);

  while (true) {
    const current = heap.pop();
    if (!current) break;
    const [distance, node] = current;
    if (distance !== distances[node]) continue;

    (candidatesByNode.get(node) || []).forEach(({ facilityIndex, distanceMeters }) => {
      const routeDistanceKm = (distance + originDistanceMeters + distanceMeters) / 1000;
      const previous = bestByFacility.get(facilityIndex);
      if (!previous || routeDistanceKm < previous.routeDistanceKm) {
        bestByFacility.set(facilityIndex, {
          ...facilities[facilityIndex],
          routeDistanceKm,
          distanceMode: "saved-road"
        });
      }
    });

    if (bestByFacility.size >= 4) {
      const sorted = [...bestByFacility.values()].sort((first, second) => first.routeDistanceKm - second.routeDistanceKm);
      const fourthRouteMeters = sorted[3].routeDistanceKm * 1000;
      if (heap.peekDistance() + originDistanceMeters >= fourthRouteMeters) break;
    }

    for (let edge = graph.offsets[node]; edge < graph.offsets[node + 1]; edge += 1) {
      const target = graph.targets[edge];
      const nextDistance = distance + graph.distances[edge];
      if (nextDistance < distances[target]) {
        distances[target] = nextDistance;
        heap.push(nextDistance, target);
      }
    }
  }

  return [...bestByFacility.values()].sort((first, second) => first.routeDistanceKm - second.routeDistanceKm);
}

function routeFacilitiesOnSavedMap(graph, position) {
  if (!pointInsideMap(position, graph)) return [];
  if (!roadGraphIndex) roadGraphIndex = buildMapNodeIndex(graph);
  if (!roadGraphIndex.facilityCandidates) roadGraphIndex.facilityCandidates = new Map();
  const facilities = trackedFacilities.map(normalizeFacility).filter((facility) => pointInsideMap(facility, graph));
  const candidatesByNode = buildFacilityCandidateMap(graph, roadGraphIndex, facilities);
  const originCandidates = findNearbyMapNodes(graph, roadGraphIndex, position, 8);
  let bestRoutes = [];

  for (const originSnap of originCandidates) {
    const routes = nearestFacilitiesByBoundedDijkstra(graph, originSnap.node, originSnap.distanceMeters, facilities, candidatesByNode);
    if (routes.length > bestRoutes.length) bestRoutes = routes;
    if (bestRoutes.length >= 4) break;
  }

  return bestRoutes;
}

function routeFacilitiesByStraightLine(position, distanceMode = "straight-line") {
  return trackedFacilities
    .map(normalizeFacility)
    .filter(Boolean)
    .map((facility) => ({
      ...facility,
      routeDistanceKm: distanceBetween(position, facility),
      distanceMode
    }))
    .sort((first, second) => first.routeDistanceKm - second.routeDistanceKm);
}

function normalizeOsmFacility(element) {
  const latitude = Number(element.lat ?? element.center?.lat);
  const longitude = Number(element.lon ?? element.center?.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const tags = element.tags || {};
  const phone = "";
  return {
    id: `${element.type}-${element.id}`,
    latitude,
    longitude,
    name: tags.name || tags["official_name"] || "Cơ sở cấp cứu",
    phone: String(phone).split(/[;,]/)[0].trim()
  };
}

function facilityMapUrlLegacy(facility) {
  const query = encodeURIComponent(`${facility.name} ${facility.latitude},${facility.longitude}`);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

function facilityPhoneLinkLegacy(phone) {
  const dialable = phone.replace(/[^\d+]/g, "");
  if (!dialable) return `<span class="facility-no-phone">Chưa có số điện thoại</span>`;
  return `<a class="facility-phone" href="tel:${escapeHtml(dialable)}">☎ ${escapeHtml(phone)}</a>`;
}

function renderFacilityState(message, className = "") {
  if (facilityMap) facilityMap.hidden = true;
  if (!facilityResults) return;
  facilityResults.innerHTML = `<p class="facility-state ${className}">${escapeHtml(message)}</p>`;
}

function renderFacilitiesLegacy(elements, userLocation) {
  if (!facilityResults) return;
  const facilities = elements.map(normalizeFacility).filter(Boolean).filter((facility) => Number.isFinite(facility.routeDistanceKm));
  const uniqueFacilities = [...new Map(facilities.map((facility) => [facility.id, facility])).values()]
    .map((facility) => ({ ...facility, distanceKm: distanceBetween(userLocation, facility) }))
    .sort((first, second) => first.distanceKm - second.distanceKm)
    .slice(0, 4);

  if (!uniqueFacilities.length) {
    renderFacilityState("Chưa tìm thấy cơ sở trong bán kính 10 km. Hãy dùng bản đồ để tìm rộng hơn.", "facility-state--quiet");
    return;
  }

  facilityResults.innerHTML = `<div class="facility-results-heading"><span>CƠ SỞ GẦN BẠN</span><small>Khoảng cách ước tính · dữ liệu OpenStreetMap</small></div>${uniqueFacilities.map((facility, index) => `<article class="facility-card"><div class="facility-card-heading"><span class="facility-index">${String(index + 1).padStart(2, "0")}</span><div><h3>${escapeHtml(facility.name)}</h3><p>${formatDistance(facility.distanceKm)}</p></div></div><div class="facility-card-actions">${facilityPhoneLink(facility.phone)}</div></article>`).join("")}<p class="facility-attribution">Dữ liệu bản đồ © OpenStreetMap contributors. Số điện thoại có thể chưa được cập nhật.</p>`;
}

function normalizeFacilityName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[Đđ]/g, "D")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "");
}

const trackedFacilityRecords = trackedFacilities.map((facility) => ({
  ...facility,
  key: normalizeFacilityName(facility.name)
}));

function findTrackedFacility(osmName) {
  const key = normalizeFacilityName(osmName);
  if (!key) return null;
  return trackedFacilityRecords.find((facility) => facility.key === key || (key.length > 12 && (key.includes(facility.key) || facility.key.includes(key)))) || null;
}

function normalizeOsmFacility(element) {
  const latitude = Number(element.lat ?? element.center?.lat);
  const longitude = Number(element.lon ?? element.center?.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const tags = element.tags || {};
  const tracked = findTrackedFacility(tags.name || tags["name:vi"] || tags.official_name);
  if (!tracked) return null;
  return {
    id: tracked.name,
    latitude,
    longitude,
    name: tracked.name,
    address: tracked.address,
    phone: tracked.phone
  };
}

function facilityMapUrl(facility) {
  const query = encodeURIComponent(`${facility.name}, ${facility.address}`);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

function facilityPhoneLink(phone) {
  const phoneOptions = String(phone || "").split(/\s+hoặc\s+/i);
  const preferredPhone = phoneOptions.find((option) => {
    const digits = option.replace(/\D/g, "");
    return digits.length >= 7 && digits !== "115";
  }) || phoneOptions[0] || "";
  const dialable = preferredPhone.replace(/[^\d+]/g, "");
  if (!dialable) return `<span class="facility-no-phone">Chưa có số điện thoại</span>`;
  return `<a class="facility-phone" href="tel:${escapeHtml(dialable)}">☎ ${escapeHtml(phone)}</a>`;
}

function normalizeFacility(facility) {
  const coordinates = trackedFacilityCoordinates[facility.name];
  if (!coordinates || !Number.isFinite(coordinates.latitude) || !Number.isFinite(coordinates.longitude)) return null;
  return {
    ...facility,
    id: facility.name,
    latitude: coordinates.latitude,
    longitude: coordinates.longitude
  };
}

function renderFacilitiesSavedRoadLegacy(elements, userLocation) {
  if (!facilityResults) return;
  const facilities = elements.map(normalizeFacility).filter(Boolean).filter((facility) => Number.isFinite(facility.routeDistanceKm));
  const uniqueFacilities = [...new Map(facilities.map((facility) => [facility.id, facility])).values()]
    .map((facility) => ({
      ...facility,
      distanceKm: distanceBetween(userLocation, facility),
      estimatedRoadDistanceKm: facility.routeDistanceKm,
      distanceMode: facility.distanceMode || "saved-road"
    }))
    .sort((first, second) => first.estimatedRoadDistanceKm - second.estimatedRoadDistanceKm)
    .slice(0, 4);

  if (!uniqueFacilities.length) {
    renderFacilityState("Không có tuyến trong bản đồ lưu cho vị trí này. Hãy gọi 115 nếu cấp bách.", "facility-state--quiet");
    return;
  }

  facilityResults.innerHTML = `<div class="facility-results-heading"><span>CƠ SỞ GẦN BẠN</span></div>${uniqueFacilities.map((facility, index) => `<article class="facility-card"><div class="facility-card-heading"><span class="facility-index">${String(index + 1).padStart(2, "0")}</span><div><h3>${escapeHtml(facility.name)}</h3><p>${formatDistance(facility.estimatedRoadDistanceKm)}</p></div></div><div class="facility-card-actions">${facilityPhoneLink(facility.phone)}</div></article>`).join("")}<p class="facility-attribution">Khoảng cách theo mạng đường trong snapshot lưu, không gồm giao thông thời gian thực.</p>`;
}

function renderFacilitiesCurrentLegacy(elements, userLocation) {
  if (!facilityResults) return;
  const facilities = elements.map(normalizeFacility).filter(Boolean).filter((facility) => Number.isFinite(facility.routeDistanceKm));
  const uniqueFacilities = [...new Map(facilities.map((facility) => [facility.id, facility])).values()]
    .map((facility) => ({
      ...facility,
      distanceKm: distanceBetween(userLocation, facility),
      estimatedDistanceKm: facility.routeDistanceKm,
      distanceMode: facility.distanceMode || "saved-road"
    }))
    .sort((first, second) => first.estimatedDistanceKm - second.estimatedDistanceKm)
    .slice(0, 4);

  if (!uniqueFacilities.length) {
    renderFacilityState("Không tìm thấy cơ sở phù hợp. Hãy gọi 115 nếu cấp bách.", "facility-state--quiet");
    return;
  }

  const usesStraightLine = uniqueFacilities.some((facility) => facility.distanceMode === "straight-line");
  const distanceSource = usesStraightLine ? "Khoảng cách đường thẳng ước tính · ngoài vùng bản đồ lưu" : "";
  const attribution = usesStraightLine
    ? "Ước tính đường thẳng để vẫn hiển thị cơ sở gần bạn."
    : "Khoảng cách theo mạng đường trong snapshot lưu, không gồm giao thông thời gian thực.";
  facilityResults.innerHTML = `<div class="facility-results-heading"><span>CƠ SỞ GẦN BẠN</span>${distanceSource ? `<small>${distanceSource}</small>` : ""}</div>${uniqueFacilities.map((facility, index) => {
    const distanceText = facility.distanceMode === "straight-line"
      ? `${formatDistance(facility.estimatedDistanceKm)} theo đường thẳng (ước tính) từ vị trí của bạn`
      : formatDistance(facility.estimatedDistanceKm);
    return `<article class="facility-card"><div class="facility-card-heading"><span class="facility-index">${String(index + 1).padStart(2, "0")}</span><div><h3>${escapeHtml(facility.name)}</h3><p>${distanceText}</p></div></div><div class="facility-card-actions">${facilityPhoneLink(facility.phone)}</div></article>`;
  }).join("")}<p class="facility-attribution">${attribution}</p>`;
}

function renderFacilities(elements, userLocation, mapData = null) {
  if (!facilityResults) return;
  const facilities = elements.map(normalizeFacility).filter(Boolean).filter((facility) => Number.isFinite(facility.routeDistanceKm));
  const uniqueFacilities = [...new Map(facilities.map((facility) => [facility.id, facility])).values()]
    .map((facility) => ({
      ...facility,
      estimatedDistanceKm: facility.routeDistanceKm,
      distanceMode: facility.distanceMode || "saved-road"
    }))
    .sort((first, second) => first.estimatedDistanceKm - second.estimatedDistanceKm)
    .slice(0, 4);

  if (!uniqueFacilities.length) {
    renderFacilityState("Không tìm thấy cơ sở phù hợp. Hãy gọi 115 nếu cấp bách.", "facility-state--quiet");
    return;
  }

  renderFacilityMap(uniqueFacilities, userLocation, mapData);

  const usesPreview = uniqueFacilities.some((facility) => facility.distanceMode === "preview");
  const usesStraightLine = uniqueFacilities.some((facility) => facility.distanceMode === "straight-line");
  const distanceSource = usesPreview
    ? "Đang tính tuyến chính xác · kết quả tạm thời"
    : usesStraightLine
      ? "Khoảng cách đường thẳng ước tính · ngoài vùng bản đồ lưu"
      : "";
  const attribution = usesPreview
    ? "Đang thay thế khoảng cách ước tính bằng tuyến đường trong snapshot lưu."
    : usesStraightLine
      ? "Ước tính đường thẳng để vẫn hiển thị cơ sở gần bạn."
      : "Khoảng cách theo mạng đường trong snapshot lưu, không gồm giao thông thời gian thực.";
  facilityResults.innerHTML = `<div class="facility-results-heading"><span>CƠ SỞ GẦN BẠN</span>${distanceSource ? `<small>${distanceSource}</small>` : ""}</div>${uniqueFacilities.map((facility, index) => {
    const distanceText = facility.distanceMode === "preview"
      ? `${formatDistance(facility.estimatedDistanceKm)} (đang xử lý tuyến chính xác)`
      : facility.distanceMode === "straight-line"
        ? `${formatDistance(facility.estimatedDistanceKm)} theo đường thẳng (ước tính) từ vị trí của bạn`
        : formatDistance(facility.estimatedDistanceKm);
    const addressText = facility.address ? `<p>${escapeHtml(facility.address)}</p>` : "";
    return `<article class="facility-card"><div class="facility-card-heading"><span class="facility-index">${String(index + 1).padStart(2, "0")}</span><div><h3>${escapeHtml(facility.name)}</h3>${addressText}<p>${distanceText}</p></div></div><div class="facility-card-actions">${facilityPhoneLink(facility.phone)}</div></article>`;
  }).join("")}<p class="facility-attribution">${attribution}</p>`;
}

function loadNearbyFacilitiesLegacy(position) {
  renderFacilityState("Đang tính tuyến trên bản đồ lưu…", "facility-state--quiet");
  loadRoadGraph()
    .then((graph) => {
      const userLocation = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      const savedRoutes = routeFacilitiesOnSavedMap(graph, userLocation);
      renderFacilities(savedRoutes.length ? savedRoutes : routeFacilitiesByStraightLine(userLocation), userLocation);
    })
    .catch((error) => {
      console.error("Unable to calculate routes on the saved map", error);
      const userLocation = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      renderFacilities(routeFacilitiesByStraightLine(userLocation), userLocation);
    });
}

function renderMainThreadRoute(userLocation, requestId) {
  loadRoadGraph()
    .then((graph) => {
      if (requestId !== routeRequestId) return;
      const savedRoutes = routeFacilitiesOnSavedMap(graph, userLocation);
      renderFacilities(savedRoutes.length ? savedRoutes : routeFacilitiesByStraightLine(userLocation), userLocation);
      updateLocationStatus("\u0110\u00e3 s\u1eb5n s\u00e0ng. C\u00e1c c\u01a1 s\u1edf g\u1ea7n b\u1ea1n \u0111ang hi\u1ec7n b\u00ean d\u01b0\u1edbi.");
    })
    .catch((error) => {
      console.error("Unable to calculate routes on the saved map", error);
      if (requestId !== routeRequestId) return;
      renderFacilities(routeFacilitiesByStraightLine(userLocation), userLocation);
      updateLocationStatus("\u0110ang hi\u1ec7n c\u01a1 s\u1edf g\u1ea7n b\u1ea1n theo kho\u1ea3ng c\u00e1ch \u01b0\u1edbc t\u00ednh.");
    });
}

function showRouteFallback(requestId, userLocation) {
  if (requestId !== routeRequestId || !userLocation) return;
  renderFacilities(routeFacilitiesByStraightLine(userLocation), userLocation);
  updateLocationStatus("\u0110ang hi\u1ec7n c\u01a1 s\u1edf g\u1ea7n b\u1ea1n theo kho\u1ea3ng c\u00e1ch \u01b0\u1edbc t\u00ednh.");
}

function handleRouteWorkerMessage(event) {
  const message = event.data || {};
  if (message.id !== routeRequestId) return;
  if (message.type === "progress") {
    updateLocationStatus(message.stage === "loading"
      ? "\u0110ang n\u1ea1p b\u1ea3n \u0111\u1ed3 l\u01b0u; k\u1ebft qu\u1ea3 t\u1ea1m th\u1eddi \u0111ang hi\u1ec7n b\u00ean d\u01b0\u1edbi."
      : "\u0110ang ho\u00e0n thi\u1ec7n tuy\u1ebfn ch\u00ednh x\u00e1c.");
    return;
  }
  if (message.type === "result") {
    const userLocation = message.position || activeRoutePosition;
    const savedRoutes = Array.isArray(message.routes) ? message.routes : [];
    renderFacilities(savedRoutes.length ? savedRoutes : routeFacilitiesByStraightLine(userLocation), userLocation, message.map || null);
    updateLocationStatus("\u0110\u00e3 s\u1eb5n s\u00e0ng. C\u00e1c c\u01a1 s\u1edf g\u1ea7n b\u1ea1n \u0111ang hi\u1ec7n b\u00ean d\u01b0\u1edbi.");
    return;
  }
  if (message.type === "error") showRouteFallback(message.id, message.position || activeRoutePosition);
}

function handleRouteWorkerError(error) {
  console.error("Unable to calculate routes in the saved-map worker", error);
  if (routeWorker) routeWorker.terminate();
  routeWorker = null;
  showRouteFallback(routeRequestId, activeRoutePosition);
}

function loadNearbyFacilities(position) {
  const userLocation = { latitude: position.coords.latitude, longitude: position.coords.longitude };
  const requestId = ++routeRequestId;
  activeRoutePosition = userLocation;
  renderFacilities(routeFacilitiesByStraightLine(userLocation, "preview"), userLocation);
  updateLocationStatus("\u0110\u00e3 s\u1eb5n s\u00e0ng. \u0110ang t\u00ednh tuy\u1ebfn ch\u00ednh x\u00e1c.");

  if (typeof Worker === "undefined") {
    renderMainThreadRoute(userLocation, requestId);
    return;
  }

  try {
    if (!routeWorker) {
      routeWorker = new Worker("route-worker.js?v=street-info-20261031");
      routeWorker.addEventListener("message", handleRouteWorkerMessage);
      routeWorker.addEventListener("error", handleRouteWorkerError);
    }
    routeWorker.postMessage({ id: requestId, position: userLocation });
  } catch (error) {
    console.error("Unable to start the saved-map worker", error);
    handleRouteWorkerError(error);
  }
}

function useLocationForEmergencySearch(position) {
  updateLocationStatus("");
  loadNearbyFacilities(position);
}

function keepGeneralEmergencySearch(error) {
  renderFacilityState("Cho phép vị trí để xem khoảng cách và số điện thoại của cơ sở gần bạn.", "facility-state--quiet");
  if (error && error.code === error.PERMISSION_DENIED) {
    updateLocationStatus("Bạn đã tắt vị trí. Hãy bật lại để xem cơ sở cấp cứu gần bạn.");
    return;
  }
  updateLocationStatus("Không lấy được vị trí. Hãy thử lại để tính khoảng cách đến cơ sở gần bạn.");
}

function requestLocationPermission() {
  if (!navigator.geolocation) {
    keepGeneralEmergencySearch();
    return;
  }
  updateLocationStatus("Đang xin quyền vị trí để tìm cơ sở cấp cứu gần bạn…");
  renderFacilityState("Đang xin quyền vị trí để hiển thị cơ sở gần bạn…", "facility-state--quiet");
  navigator.geolocation.getCurrentPosition(useLocationForEmergencySearch, keepGeneralEmergencySearch, {
    enableHighAccuracy: true,
    maximumAge: 60000,
    timeout: 15000
  });
}

requestLocationPermission();

document.querySelectorAll("a[href^='#']").forEach((link) => {
  link.addEventListener("click", (event) => {
    const target = document.querySelector(link.getAttribute("href"));
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  });
});
