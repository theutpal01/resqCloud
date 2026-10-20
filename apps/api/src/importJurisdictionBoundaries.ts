import { readFile } from "node:fs/promises";
import { db, Jurisdiction, JurisdictionBoundary, migrate } from "./database.js";
import { isBoundaryGeometry } from "./jurisdictionRouting.js";

type GeoJsonFeature = {
  type: "Feature";
  properties: Record<string, unknown> | null;
  geometry: unknown;
};

const [file, sourceVersion] = process.argv.slice(2);
if (!file || !sourceVersion) {
  console.error(
    "Usage: npm run boundaries:import -- <EPSG:4326 GeoJSON file> <source-version>",
  );
  process.exitCode = 2;
} else {
  try {
    if (sourceVersion.length > 80)
      throw new Error("Source version must be 80 characters or fewer");
    await migrate();
    const parsed: unknown = JSON.parse(await readFile(file, "utf8"));
    if (
      !parsed ||
      typeof parsed !== "object" ||
      (parsed as { type?: unknown }).type !== "FeatureCollection" ||
      !Array.isArray((parsed as { features?: unknown }).features)
    )
      throw new Error("Input must be a GeoJSON FeatureCollection");

    const features = (parsed as { features: GeoJsonFeature[] }).features;
    if (!features.length) throw new Error("Input has no district features");
    const seen = new Set<string>();
    const retrievedAt = new Date();
    await db.transaction(async (transaction) => {
      for (const feature of features) {
        const code = feature.properties?.jurisdictionCode;
        if (
          typeof code !== "string" ||
          !/^IN-[A-Z]{2,3}[A-Z0-9]{1,3}$/.test(code)
        )
          throw new Error(
            "Every feature needs a jurisdictionCode property in the app's stable code format",
          );
        if (seen.has(code))
          throw new Error(`Duplicate district feature for ${code}`);
        seen.add(code);
        if (!isBoundaryGeometry(feature.geometry))
          throw new Error(`Invalid Polygon/MultiPolygon geometry for ${code}`);
        const jurisdiction = await Jurisdiction.findByPk(code, { transaction });
        if (!jurisdiction || jurisdiction.get().kind !== "district")
          throw new Error(
            `No district jurisdiction exists for ${code}; map source IDs explicitly before importing`,
          );

        const row = await JurisdictionBoundary.findByPk(code, { transaction });
        const values = {
          geometry: feature.geometry,
          sourceName: "Survey of India Administrative Boundary Database",
          sourceUrl:
            "https://surveyofindia.gov.in/documents/State_District_Subdistrict_PAN%20INDIA.rar",
          sourceVersion: sourceVersion.slice(0, 80),
          retrievedAt,
          reviewStatus: "candidate" as const,
          approvalReference: null,
          approvedBy: null,
          approvedAt: null,
        };
        if (row) await row.update(values, { transaction });
        else
          await JurisdictionBoundary.create(
            { jurisdictionCode: code, ...values },
            { transaction },
          );
      }
    });
    console.log(
      `Imported ${seen.size} candidate district boundaries. None were approved for routing.`,
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await db.close();
  }
}
