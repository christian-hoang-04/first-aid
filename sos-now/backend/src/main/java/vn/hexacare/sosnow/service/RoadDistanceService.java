package vn.hexacare.sosnow.service;

import com.fasterxml.jackson.core.JsonFactory;
import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.JsonToken;
import org.springframework.stereotype.Service;
import vn.hexacare.sosnow.dto.FacilityResponse;

import java.io.IOException;
import java.io.InputStream;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.PriorityQueue;
import java.util.zip.GZIPInputStream;

@Service
public class RoadDistanceService {
    private static final String GRAPH_RESOURCE = "/routing/saigon-road-graph.json.gz";
    private static final int GRAPH_FORMAT = 1;
    private static final double CELL_SIZE = 0.002;
    private static final int ORIGIN_SNAP_LIMIT = 8;
    private static final int FACILITY_SNAP_LIMIT = 24;

    private final RoadGraph graph;
    private final SpatialIndex index;

    public RoadDistanceService() {
        graph = loadGraph();
        index = new SpatialIndex(graph);
    }

    /** Returns road-network distances aligned to the supplied facility list; null means no route exists. */
    public List<Long> distancesMeters(double originLat, double originLng, List<FacilityResponse> facilities) {
        if (facilities.isEmpty()) return List.of();
        if (!graph.contains(originLat, originLng)) return Arrays.asList(new Long[facilities.size()]);

        List<Snap> origins = index.nearest(originLat, originLng, ORIGIN_SNAP_LIMIT);
        if (origins.isEmpty()) return Arrays.asList(new Long[facilities.size()]);

        List<List<Snap>> destinations = facilities.stream()
                .map(facility -> graph.contains(facility.latitude(), facility.longitude())
                        ? index.nearest(facility.latitude(), facility.longitude(), FACILITY_SNAP_LIMIT)
                        : List.<Snap>of())
                .toList();
        double[] distances = shortestPaths(origins);

        Long[] result = new Long[facilities.size()];
        for (int facilityIndex = 0; facilityIndex < facilities.size(); facilityIndex++) {
            FacilityResponse facility = facilities.get(facilityIndex);
            if (originLat == facility.latitude() && originLng == facility.longitude()) {
                result[facilityIndex] = 0L;
                continue;
            }

            double best = Double.POSITIVE_INFINITY;
            for (Snap destination : destinations.get(facilityIndex)) {
                double route = distances[destination.node()] + destination.connectorMeters();
                if (route < best) best = route;
            }
            if (Double.isFinite(best)) result[facilityIndex] = Math.round(best);
        }
        return Arrays.asList(result);
    }

    static double geodesicDistanceMeters(double firstLat, double firstLng, double secondLat, double secondLng) {
        double deltaLat = Math.toRadians(secondLat - firstLat);
        double deltaLng = Math.toRadians(secondLng - firstLng);
        double a = Math.pow(Math.sin(deltaLat / 2), 2)
                + Math.cos(Math.toRadians(firstLat)) * Math.cos(Math.toRadians(secondLat))
                * Math.pow(Math.sin(deltaLng / 2), 2);
        return 6_371_008.8 * 2 * Math.asin(Math.sqrt(Math.clamp(a, 0, 1)));
    }

    private double[] shortestPaths(List<Snap> origins) {
        double[] distances = new double[graph.nodeCount()];
        Arrays.fill(distances, Double.POSITIVE_INFINITY);
        MinHeap pending = new MinHeap();
        for (Snap origin : origins) {
            if (origin.connectorMeters() < distances[origin.node()]) {
                distances[origin.node()] = origin.connectorMeters();
                pending.push(origin.node(), origin.connectorMeters());
            }
        }

        while (pending.pop()) {
            int node = pending.poppedNode;
            double distance = pending.poppedDistance;
            if (distance != distances[node]) continue;
            for (int edge = graph.offsets[node]; edge < graph.offsets[node + 1]; edge++) {
                int target = graph.targets[edge];
                double candidate = distance + graph.edgeMeters[edge];
                if (candidate < distances[target]) {
                    distances[target] = candidate;
                    pending.push(target, candidate);
                }
            }
        }
        return distances;
    }

    private static RoadGraph loadGraph() {
        try (InputStream resource = RoadDistanceService.class.getResourceAsStream(GRAPH_RESOURCE)) {
            if (resource == null) throw new IllegalStateException("Saved Saigon road graph is missing.");
            try (GZIPInputStream gzip = new GZIPInputStream(resource);
                 JsonParser parser = new JsonFactory().createParser(gzip)) {
                int format = -1;
                double[] bbox = null;
                double[] coordinates = null;
                int[] offsets = null;
                int[] targets = null;
                double[] edgeMeters = null;

                if (parser.nextToken() != JsonToken.START_OBJECT) throw new IOException("Invalid road graph root.");
                while (parser.nextToken() != JsonToken.END_OBJECT) {
                    if (parser.currentToken() != JsonToken.FIELD_NAME) throw new IOException("Invalid road graph field.");
                    String field = parser.currentName();
                    JsonToken value = parser.nextToken();
                    switch (field) {
                        case "format" -> format = parser.getIntValue();
                        case "bbox" -> bbox = readDoubles(parser, value);
                        case "coordinates" -> coordinates = readDoubles(parser, value);
                        case "offsets" -> offsets = readIntegers(parser, value);
                        case "targets" -> targets = readIntegers(parser, value);
                        case "distances" -> edgeMeters = readDoubles(parser, value);
                        default -> parser.skipChildren();
                    }
                }

                if (format != GRAPH_FORMAT || bbox == null || bbox.length != 4 || coordinates == null
                        || coordinates.length % 2 != 0 || offsets == null || targets == null || edgeMeters == null
                        || targets.length != edgeMeters.length || offsets.length != coordinates.length / 2 + 1
                        || offsets[0] != 0 || offsets[offsets.length - 1] != targets.length) {
                    throw new IOException("Saved road graph has an unsupported or incomplete format.");
                }
                if (bbox[0] >= bbox[2] || bbox[1] >= bbox[3]) throw new IOException("Road graph bounds are invalid.");
                for (int node = 0; node < coordinates.length / 2; node++) {
                    double lat = coordinates[node * 2];
                    double lng = coordinates[node * 2 + 1];
                    if (!Double.isFinite(lat) || !Double.isFinite(lng) || offsets[node] < 0
                            || offsets[node] > offsets[node + 1] || offsets[node + 1] > targets.length) {
                        throw new IOException("Road graph node or adjacency index is invalid.");
                    }
                }
                for (int edge = 0; edge < targets.length; edge++) {
                    int target = targets[edge];
                    if (target < 0 || target >= coordinates.length / 2) throw new IOException("Road graph edge is invalid.");
                    if (!Double.isFinite(edgeMeters[edge]) || edgeMeters[edge] < 0) {
                        throw new IOException("Road graph distance is invalid.");
                    }
                }
                return new RoadGraph(bbox, coordinates, offsets, targets, edgeMeters);
            }
        } catch (IOException exception) {
            throw new IllegalStateException("Unable to load the saved Saigon road graph.", exception);
        }
    }

    private static double[] readDoubles(JsonParser parser, JsonToken token) throws IOException {
        if (token != JsonToken.START_ARRAY) throw new IOException("Expected a road graph number array.");
        DoubleBuilder values = new DoubleBuilder();
        while (parser.nextToken() != JsonToken.END_ARRAY) values.add(parser.getDoubleValue());
        return values.toArray();
    }

    private static int[] readIntegers(JsonParser parser, JsonToken token) throws IOException {
        if (token != JsonToken.START_ARRAY) throw new IOException("Expected a road graph integer array.");
        IntBuilder values = new IntBuilder();
        while (parser.nextToken() != JsonToken.END_ARRAY) values.add(parser.getIntValue());
        return values.toArray();
    }

    private record Snap(int node, double connectorMeters) {}

    private static final class RoadGraph {
        private final double[] bbox;
        private final double[] coordinates;
        private final int[] offsets;
        private final int[] targets;
        private final double[] edgeMeters;

        private RoadGraph(double[] bbox, double[] coordinates, int[] offsets, int[] targets, double[] edgeMeters) {
            this.bbox = bbox;
            this.coordinates = coordinates;
            this.offsets = offsets;
            this.targets = targets;
            this.edgeMeters = edgeMeters;
        }

        private int nodeCount() { return coordinates.length / 2; }

        private boolean contains(double lat, double lng) {
            return lat >= bbox[0] && lng >= bbox[1] && lat <= bbox[2] && lng <= bbox[3];
        }
    }

    private static final class SpatialIndex {
        private final RoadGraph graph;
        private final int minLatitudeCell;
        private final int minLongitudeCell;
        private final int width;
        private final int height;
        private final int[] cellOffsets;
        private final int[] cellNodes;

        private SpatialIndex(RoadGraph graph) {
            this.graph = graph;
            int minLatitudeCell = Integer.MAX_VALUE;
            int minLongitudeCell = Integer.MAX_VALUE;
            int maxLatitudeCell = Integer.MIN_VALUE;
            int maxLongitudeCell = Integer.MIN_VALUE;
            for (int node = 0; node < graph.nodeCount(); node++) {
                int latitudeCell = (int) Math.floor(graph.coordinates[node * 2] / CELL_SIZE);
                int longitudeCell = (int) Math.floor(graph.coordinates[node * 2 + 1] / CELL_SIZE);
                minLatitudeCell = Math.min(minLatitudeCell, latitudeCell);
                minLongitudeCell = Math.min(minLongitudeCell, longitudeCell);
                maxLatitudeCell = Math.max(maxLatitudeCell, latitudeCell);
                maxLongitudeCell = Math.max(maxLongitudeCell, longitudeCell);
            }
            this.minLatitudeCell = minLatitudeCell;
            this.minLongitudeCell = minLongitudeCell;
            width = maxLongitudeCell - minLongitudeCell + 1;
            height = maxLatitudeCell - minLatitudeCell + 1;
            int cellCount = width * height;
            int[] counts = new int[cellCount];
            for (int node = 0; node < graph.nodeCount(); node++) counts[cellForNode(node)]++;

            cellOffsets = new int[cellCount + 1];
            for (int cell = 0; cell < cellCount; cell++) cellOffsets[cell + 1] = cellOffsets[cell] + counts[cell];
            int[] next = Arrays.copyOf(cellOffsets, cellCount);
            cellNodes = new int[graph.nodeCount()];
            for (int node = 0; node < graph.nodeCount(); node++) cellNodes[next[cellForNode(node)]++] = node;
        }

        private int cellForNode(int node) {
            int latitudeCell = (int) Math.floor(graph.coordinates[node * 2] / CELL_SIZE) - minLatitudeCell;
            int longitudeCell = (int) Math.floor(graph.coordinates[node * 2 + 1] / CELL_SIZE) - minLongitudeCell;
            return latitudeCell * width + longitudeCell;
        }

        private List<Snap> nearest(double lat, double lng, int limit) {
            int centerRow = (int) Math.floor(lat / CELL_SIZE) - minLatitudeCell;
            int centerColumn = (int) Math.floor(lng / CELL_SIZE) - minLongitudeCell;
            PriorityQueue<Snap> nearest = new PriorityQueue<>(limit,
                    Comparator.comparingDouble(Snap::connectorMeters).reversed());
            for (int rowOffset = -4; rowOffset <= 4; rowOffset++) {
                int row = centerRow + rowOffset;
                if (row < 0 || row >= height) continue;
                for (int columnOffset = -4; columnOffset <= 4; columnOffset++) {
                    int column = centerColumn + columnOffset;
                    if (column < 0 || column >= width) continue;
                    int cell = row * width + column;
                    for (int cursor = cellOffsets[cell]; cursor < cellOffsets[cell + 1]; cursor++) {
                        int node = cellNodes[cursor];
                        double nodeLat = graph.coordinates[node * 2];
                        double nodeLng = graph.coordinates[node * 2 + 1];
                        double connectorMeters = geodesicDistanceMeters(lat, lng, nodeLat, nodeLng);
                        if (nearest.size() < limit) nearest.add(new Snap(node, connectorMeters));
                        else if (connectorMeters < nearest.peek().connectorMeters()) {
                            nearest.remove();
                            nearest.add(new Snap(node, connectorMeters));
                        }
                    }
                }
            }
            return nearest.stream().sorted(Comparator.comparingDouble(Snap::connectorMeters)).toList();
        }
    }

    private static final class MinHeap {
        private int[] nodes = new int[1024];
        private double[] distances = new double[1024];
        private int size;
        private int poppedNode;
        private double poppedDistance;

        private void push(int node, double distance) {
            if (size == nodes.length) {
                nodes = Arrays.copyOf(nodes, size * 2);
                distances = Arrays.copyOf(distances, size * 2);
            }
            int cursor = size++;
            while (cursor > 0) {
                int parent = (cursor - 1) / 2;
                if (distances[parent] <= distance) break;
                nodes[cursor] = nodes[parent];
                distances[cursor] = distances[parent];
                cursor = parent;
            }
            nodes[cursor] = node;
            distances[cursor] = distance;
        }

        private boolean pop() {
            if (size == 0) return false;
            poppedNode = nodes[0];
            poppedDistance = distances[0];
            int lastNode = nodes[--size];
            double lastDistance = distances[size];
            if (size == 0) return true;
            int cursor = 0;
            while (true) {
                int child = cursor * 2 + 1;
                if (child >= size) break;
                if (child + 1 < size && distances[child + 1] < distances[child]) child++;
                if (distances[child] >= lastDistance) break;
                nodes[cursor] = nodes[child];
                distances[cursor] = distances[child];
                cursor = child;
            }
            nodes[cursor] = lastNode;
            distances[cursor] = lastDistance;
            return true;
        }
    }

    private static final class DoubleBuilder {
        private double[] values = new double[1024];
        private int size;
        private void add(double value) {
            if (size == values.length) values = Arrays.copyOf(values, size * 2);
            values[size++] = value;
        }
        private double[] toArray() { return Arrays.copyOf(values, size); }
    }

    private static final class IntBuilder {
        private int[] values = new int[1024];
        private int size;
        private void add(int value) {
            if (size == values.length) values = Arrays.copyOf(values, size * 2);
            values[size++] = value;
        }
        private int[] toArray() { return Arrays.copyOf(values, size); }
    }
}
