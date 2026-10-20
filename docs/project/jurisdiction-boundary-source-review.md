# India boundary source review

**Status:** Tamil Nadu candidate geometry imported into the local demo database; not approved for routing or production use.

## Candidate source

Survey of India (SoI) publishes an **Administrative Boundary Database (ABDB)** with state, district and sub-district boundary data. Its catalogue lists country-wide and state-level Shapefile products up to district level, at 1:1M scale. The catalogue lists the products at ₹0, and the Online Maps Portal FAQ says ABDB is among the datasets available through Quick Access without registration. The FAQ also says access is subject to the user category and applicable policies.

- [SoI Administrative Boundary Database page](https://surveyofindia.gov.in/pages/administrative-boundary-data-base-abdb-)
- [SoI Online Maps product catalogue](https://onlinemaps.surveyofindia.gov.in/Digital_Products.aspx)
- [SoI Online Maps FAQ](https://onlinemaps.surveyofindia.gov.in/FAQs.aspx)

The SoI page links a country-wide State/District/Sub-district archive. The public page and catalogue reviewed here do not identify a dataset release/version date or state a clear downstream production redistribution license. The nominally free price and direct download are not treated as proof of permission to bundle, redistribute, or use the data for operational emergency routing.

The archive was retrieved on 2026-10-20. Its HTTP `Last-Modified` value was 2026-05-12, but that does not establish the data epoch. The archive extractor reported a RAR integrity error. The extracted district `.shp` declared the same byte length as the extracted file and contained 808 shape records, matching the 808 district DBF records. This supports using the Tamil Nadu subset for candidate review, but it does not replace publisher checksums or authority validation. The extracted district shapefile's SHA-256 is `05efac0a02c113f25cd55df3f01a4aee7201bfc9b299f73bb3e273b9aa7e3740`.

## Implementation status

The local `.env.demo` database now has all 38 Tamil Nadu district polygons as candidate boundaries. The source `DIST_LGD` identifiers were mapped explicitly to stable local codes of the form `IN-TN<LGD>`, and matching district records were created inactive. The supplied `LCC_WGS84` PolygonZ coordinates were converted to WGS84 longitude/latitude; separate exterior rings and holes were retained. No other state's boundaries were imported. The data remains in the ignored local SQLite demo database; the converted GeoJSON and source archive are not checked into the repository.

The application has a candidate-only GeoJSON import command, stores the source URL/name, source version and retrieval time, and provides an advisory point-suggestion endpoint. The import records the SoI source and `Last-Modified` value as `SoI Last-Modified 2026-05-12; release epoch unknown`; this is provenance, not a claimed dataset edition. All 38 rows remain `candidate`, and all imported district records remain inactive. They are excluded from suggestions until separately activated and approved. An administrator can approve a district boundary with a recorded approval reference; approval does not validate agency ownership. Reports continue to use the reporter's selected jurisdiction.

To import a prepared WGS84 GeoJSON FeatureCollection, run `npm run boundaries:import -w @resq/api -- ./districts.geojson soi-edition-id`. Replace the example edition ID with the version recorded in source metadata. The local Tamil Nadu import used the HTTP modification date while explicitly marking the dataset epoch unknown. It has not passed boundary-owner validation, production reuse approval, or agency-coverage approval.

## Decision for this codebase

Do not publish the archive's geometry, infer incident jurisdiction automatically, or use it for agency dispatch. Candidate geometry may be loaded for review, but the app excludes it from suggestions until an administrator records the relevant approval reference. A 1:1M administrative outline can be a location hint; by itself it does not establish which agency accepts or owns an emergency report.

The next safe implementation after source approval should keep coordinate matching advisory. It should persist the dataset identifier/version and source, return `suggested`, `ambiguous`, or `outside` outcomes, treat points on a shared boundary as ambiguous, and keep the reporter's selected jurisdiction until an authorized operator confirms or corrects it. Agency routing must remain governed by separately approved jurisdiction-to-agency coverage.

## Evidence required before import

1. Obtain the archive through the official SoI portal and retain its accompanying metadata/readme, retrieval date, and publisher checksum; the retrieved archive currently has an integrity warning and no accompanying edition metadata.
2. Confirm the archive's edition/data epoch, coordinate reference system, district identifiers, geometry validity, and whether state-specific extracts remain available. The extracted `.prj` identified `LCC_WGS84`, and the Tamil Nadu `DIST_LGD` values were mapped to `IN-TN<LGD>` codes, but these mappings still need authority review.
3. Obtain written confirmation of production use, storage, display, and redistribution terms for the intended deployment.
4. Have the participating state/UT authority validate the district names, boundaries, changes, and agency ownership/coverage.
5. Record the approved source/version and validation owner in the deployment's coverage register. Do not mark a jurisdiction operational merely because a polygon has been imported.

Until these checks are complete, the product remains an explicitly selected reporting-area demo. Candidate polygons are present only in the local demo database. Coordinate matching stays advisory and cannot change incident ownership.
