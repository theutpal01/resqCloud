"use client";
import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { EmptyState } from "../../components/ui/EmptyState";
import { Badge } from "../../components/ui/Badge";
interface MapPoint {
  id?: string;
  trackingId: string;
  latitude: number;
  longitude: number;
  severity: string;
  status: string;
}
export default function IncidentMap({ points }: { points: MapPoint[] }) {
  const container = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  useEffect(() => {
    if (!token || !container.current) return;
    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: container.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: [79.14, 12.96],
      zoom: 11,
    });
    map.addControl(new mapboxgl.NavigationControl());
    map.on("error", () =>
      setError("Map tiles are unavailable. Coordinates are listed below."),
    );
    points.forEach((p) => {
      const popup = document.createElement("p");
      popup.textContent = `${p.trackingId}: ${p.severity} · ${p.status}`;
      new mapboxgl.Marker({
        color: p.severity === "critical" ? "#b42318" : "#1d4ed8",
      })
        .setLngLat([p.longitude, p.latitude])
        .setPopup(new mapboxgl.Popup().setDOMContent(popup))
        .addTo(map);
    });
    return () => map.remove();
  }, [token, points]);
  return (
    <section className="panel">
      <h2>Incident locations</h2>
      {token ? (
        <div
          ref={container}
          className="map-container"
          aria-label="Interactive incident map"
        />
      ) : (
        <div className="map-unconfigured" role="status">
          {/* <span className="map-unconfigured-icon"> */}
            {/* <MapIcon size={22} aria-hidden="true" /> */}
          {/* </span> */}
          <div>
            <h3>Interactive map unavailable</h3>
            <p>
              {points.length
                ? `${points.length} approved incident ${points.length === 1 ? "location is" : "locations are"} listed below. A Mapbox public token is needed to display the map.`
                : "Approved incident locations will appear here when available. A Mapbox public token is needed to display the interactive map."}
            </p>
          </div>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
      {points.length ? (
        <div className="table-wrap incident-location-table">
          <table>
            <caption className="sr-only">Approved incident coordinates</caption>
            <thead>
              <tr>
                <th>Incident</th>
                <th>Severity</th>
                <th>Latitude</th>
                <th>Longitude</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.trackingId}>
                  <td>
                    <span className="location-id">
                      <MapPin size={15} aria-hidden="true" /> {p.trackingId}
                    </span>
                  </td>
                  <td><Badge variant={p.severity as "critical" | "high" | "medium" | "low"}>{p.severity}</Badge></td>
                  <td>{p.latitude}</td>
                  <td>{p.longitude}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title="No approved locations yet"
          description="Approved incident coordinates will be listed here when they are available."
        />
      )}
    </section>
  );
}
