importScripts("facilities.js", "facility-coordinates.js");

let savedGraphPromise = null;
let savedGraph = null;
let savedGraphIndex = null;
let savedFacilities = null;

function distanceBetween(first, second) {
  const earthRadiusKm = 6371;
  const latitudeDelta = (second.latitude - first.latitude) * Math.PI / 180;
  const longitudeDelta = (second.longitude - first.longitude) * Math.PI / 180;
  const firstLatitude = first.latitude * Math.PI / 180;
  const secondLatitude = second.latitude * Math.PI / 180;
  const haversine = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(firstLatitude) * Math.cos(secondLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function pointInsideMap(point, graph) {
  const [minLatitude, minLongitude, maxLatitude, maxLongitude] = graph.bbox;
  return point.latitude >= minLatitude && point.latitude <= maxLatitude && point.longitude >= minLongitude && point.longitude <= maxLongitude;
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

function buildMapNodeIndex(graph) {
  const cellSize = 0.002;
  const cells = new Map();
  for (let node = 0; node < graph.offsets.length - 1; node += 1) {
    const key = `${Math.floor(graph.coordinates[node * 2] / cellSize)}:${Math.floor(graph.coordinates[node * 2 + 1] / cellSize)}`;
    const cell = cells.get(key);
    if (cell) cell.push(node);
    else cells.set(key, [node]);
  }
  return { cellSize, cells, facilityCandidates: new Map() };
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

function findReachableMapNode(graph, index, facility, distances) {
  let candidates = index.facilityCandidates.get(facility.id);
  if (!candidates) {
    candidates = findNearbyMapNodes(graph, index, facility);
    index.facilityCandidates.set(facility.id, candidates);
  }
  return candidates.find((candidate) => Number.isFinite(distances[candidate.node])) || null;
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

function buildFacilityCandidateMap(graph, index, facilities) {
  const candidatesByNode = new Map();
  facilities.forEach((facility, facilityIndex) => {
    let candidates = index.facilityCandidates.get(facility.id);
    if (!candidates) {
      candidates = findNearbyMapNodes(graph, index, facility);
      index.facilityCandidates.set(facility.id, candidates);
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

    const matches = candidatesByNode.get(node) || [];
    matches.forEach(({ facilityIndex, distanceMeters }) => {
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
  if (!savedGraphIndex) savedGraphIndex = buildMapNodeIndex(graph);
  if (!savedFacilities) savedFacilities = trackedFacilities.map(normalizeFacility).filter((facility) => pointInsideMap(facility, graph));
  const candidatesByNode = buildFacilityCandidateMap(graph, savedGraphIndex, savedFacilities);
  const originCandidates = findNearbyMapNodes(graph, savedGraphIndex, position, 8);
  let bestRoutes = [];
  let bestOriginSnap = null;

  for (const originSnap of originCandidates) {
    const routes = nearestFacilitiesByBoundedDijkstra(graph, originSnap.node, originSnap.distanceMeters, savedFacilities, candidatesByNode);

    if (routes.length > bestRoutes.length || (routes.length === bestRoutes.length && (!bestOriginSnap || originSnap.distanceMeters < bestOriginSnap.distanceMeters))) {
      bestRoutes = routes;
      bestOriginSnap = originSnap;
    }
    if (bestRoutes.length >= 4) break;
  }

  return bestRoutes;
}

const mapViewWidth = 1000;
const mapViewHeight = 620;
const mapRoadLimit = 14000;

function mapBoundsFor(position, facilities) {
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
  const aspectRatio = mapViewWidth / mapViewHeight;
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

function forEachVisibleRoad(graph, bounds, callback) {
  const nodeCount = graph.offsets.length - 1;
  for (let source = 0; source < nodeCount; source += 1) {
    const sourceLatitude = graph.coordinates[source * 2];
    const sourceLongitude = graph.coordinates[source * 2 + 1];
    const sourceVisible = sourceLatitude >= bounds.minLatitude && sourceLatitude <= bounds.maxLatitude
      && sourceLongitude >= bounds.minLongitude && sourceLongitude <= bounds.maxLongitude;
    for (let edge = graph.offsets[source]; edge < graph.offsets[source + 1]; edge += 1) {
      const target = graph.targets[edge];
      const targetLatitude = graph.coordinates[target * 2];
      const targetLongitude = graph.coordinates[target * 2 + 1];
      const targetVisible = targetLatitude >= bounds.minLatitude && targetLatitude <= bounds.maxLatitude
        && targetLongitude >= bounds.minLongitude && targetLongitude <= bounds.maxLongitude;
      if (!sourceVisible && !targetVisible) continue;
      callback(sourceLatitude, sourceLongitude, targetLatitude, targetLongitude);
    }
  }
}

function buildRoadPath(graph, bounds) {
  let visibleCount = 0;
  forEachVisibleRoad(graph, bounds, () => { visibleCount += 1; });
  if (!visibleCount) return "";
  const step = Math.max(1, Math.ceil(visibleCount / mapRoadLimit));
  const path = [];
  let index = 0;
  const project = (latitude, longitude) => ({
    x: (longitude - bounds.minLongitude) / (bounds.maxLongitude - bounds.minLongitude) * mapViewWidth,
    y: mapViewHeight - (latitude - bounds.minLatitude) / (bounds.maxLatitude - bounds.minLatitude) * mapViewHeight
  });
  forEachVisibleRoad(graph, bounds, (firstLatitude, firstLongitude, secondLatitude, secondLongitude) => {
    if (index % step === 0) {
      const first = project(firstLatitude, firstLongitude);
      const second = project(secondLatitude, secondLongitude);
      path.push(`M${first.x.toFixed(1)},${first.y.toFixed(1)}L${second.x.toFixed(1)},${second.y.toFixed(1)}`);
    }
    index += 1;
  });
  return path.join("");
}

function nearestFacilitiesByStraightLine(position) {
  return trackedFacilities
    .map(normalizeFacility)
    .filter(Boolean)
    .map((facility) => ({
      ...facility,
      routeDistanceKm: distanceBetween(position, facility),
      distanceMode: "straight-line"
    }))
    .sort((first, second) => first.routeDistanceKm - second.routeDistanceKm)
    .slice(0, 4);
}

function buildMapSnapshot(graph, position, routes) {
  const facilities = routes.length ? routes : nearestFacilitiesByStraightLine(position);
  const bounds = mapBoundsFor(position, facilities);
  return {
    width: mapViewWidth,
    height: mapViewHeight,
    bounds,
    roadPath: pointInsideMap(position, graph) ? buildRoadPath(graph, bounds) : "",
    withinSavedArea: pointInsideMap(position, graph)
  };
}

async function getSavedGraph() {
  if (!savedGraphPromise) {
    savedGraphPromise = fetch("map-data/saigon-road-graph.json")
      .then((response) => {
        if (!response.ok) throw new Error(`Local map responded with ${response.status}`);
        return response.json();
      })
      .then((graph) => {
        savedGraph = graph;
        return graph;
      });
  }
  return savedGraph || savedGraphPromise;
}

self.onmessage = async (event) => {
  const { id, position } = event.data || {};
  if (!id || !position) return;
  try {
    self.postMessage({ id, type: "progress", stage: savedGraph ? "routing" : "loading" });
    const graph = await getSavedGraph();
    if (!savedGraphIndex) self.postMessage({ id, type: "progress", stage: "indexing" });
    self.postMessage({ id, type: "progress", stage: "routing" });
    const routes = routeFacilitiesOnSavedMap(graph, position);
    const map = buildMapSnapshot(graph, position, routes);
    self.postMessage({ id, type: "result", position, routes, map });
  } catch (error) {
    self.postMessage({ id, type: "error", position, message: error instanceof Error ? error.message : String(error) });
  }
};
