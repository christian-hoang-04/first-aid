# Saigon road graph

`saigon-road-graph.json.gz` is the format 1 directed road graph bundled for nearby-facility distance calculations.

- Source: [BBBike Saigon OpenStreetMap extract](https://download.bbbike.org/osm/bbbike/Saigon/)
- Snapshot downloaded: 2026-09-30
- Bounding box: latitude `10.6564..10.8931`, longitude `106.5444..106.8545`
- Source database: © OpenStreetMap contributors, available under the [Open Database License 1.0](https://opendatacommons.org/licenses/odbl/1-0/); see [OpenStreetMap copyright](https://www.openstreetmap.org/copyright).

The graph is distributed separately from application source under ODbL 1.0. Distances use shortest paths over its directed edges after snapping each endpoint to nearby graph nodes. It does not include live traffic, current road closures, ETA, or turn-by-turn guidance. Refresh and revalidate this resource before extending coverage or publishing updated road data.
