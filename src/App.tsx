import { useState, useEffect, useMemo, useRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
  useMapEvents,
  GeoJSON,
  LayersControl,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  Map as MapIcon,
  Search,
  Home,
  School,
  Hospital,
  TowerControl as Government,
  Mountain,
  Factory,
  Church,
  ChevronRight,
  ChevronLeft,
  Check,
  Building2,
  Handshake,
  Landmark,
  LucideIcon,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/src/lib/utils";

// @ts-ignore Leaflet default icon URL resolver does not work in Vite bundles.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

const MUNICIPALITY_CENTER: [number, number] = [27.42, 85.05];

type DataRecord = Record<string, string | number | boolean | null | undefined>;

interface MapPoint {
  id: string;
  name: string;
  category: string;
  categoryLabel: string;
  lat: number;
  lng: number;
  altitude?: string | number | boolean | null;
  details: DataRecord;
  source: "municipal" | "house";
}

interface HouseBucket {
  id: string;
  count: number;
  lat: number;
  lng: number;
  points: MapPoint[];
}

const MUNICIPAL_LAYERS = [
  {
    id: "administrative",
    sheet: "Prasasan_bhawan",
    label: "Administrative Buildings / प्रशासन भवन",
    icon: Building2,
    color: "#10B981",
    glyph: "A",
  },
  {
    id: "school",
    sheet: "school",
    label: "Schools",
    icon: School,
    color: "#F59E0B",
    glyph: "Sc",
  },
  {
    id: "health",
    sheet: "Health Post",
    label: "Health Post",
    icon: Hospital,
    color: "#EF4444",
    glyph: "H",
  },
  {
    id: "tourism",
    sheet: "Tourism_data",
    label: "Tourism Data",
    icon: Mountain,
    color: "#06B6D4",
    glyph: "Tr",
  },
  {
    id: "temple",
    sheet: "Temple",
    label: "Temple",
    icon: Church,
    color: "#F97316",
    glyph: "T",
  },
  {
    id: "industry",
    sheet: "IND",
    label: "Industry",
    icon: Factory,
    color: "#8B5CF6",
    glyph: "I",
  },
  {
    id: "other_government",
    sheet: "Other Government Office",
    label: "Other Governmental Offices",
    icon: Government,
    color: "#3B82F6",
    glyph: "G",
  },
  {
    id: "sahakari",
    sheet: "sahakari Data",
    label: "Co-operatives / सहकारी",
    icon: Handshake,
    color: "#14B8A6",
    glyph: "S",
  },
];

const CATEGORY_COLORS: Record<string, string> = Object.fromEntries(
  MUNICIPAL_LAYERS.map((layer) => [layer.id, layer.color]),
);
CATEGORY_COLORS.houses = "#2563EB";

const CATEGORY_GLYPHS: Record<string, string> = Object.fromEntries(
  MUNICIPAL_LAYERS.map((layer) => [layer.id, layer.glyph]),
);
CATEGORY_GLYPHS.houses = "H";

const FIELD_LABELS: Record<string, string> = {
  _location_: "Latitude",
  _locatio_1: "Longitude",
  _locatio_2: "Altitude",
  SN: "SN",
  sn: "SN",
  latitude: "Latitude",
  longitude: "Longitude",
  altitude: "Altitude",
  Latitude: "Latitude",
  Longitude: "Longitude",
  Altitude: "Altitude",
  Name: "Name",
  "English Name": "English Name",
  "Nepali Name": "Nepali Name",
  "Name in Nepali": "Nepali Name",
  "Name In Nepali": "Nepali Name",
  "Name of School": "School Name",
  "Name of School in Nepali": "School Name in Nepali",
  "Name of Health Care Facility": "Health Care Facility",
  "Type of Health Care Facility": "Type of Health Care Facility",
  "Avg No. of Patients Per Day": "Avg. Patients Per Day",
  "Available Vaccinations": "Available Vaccinations",
  "Common Diseases / Health Issues": "Common Diseases / Health Issues",
  "Name of Religious Site": "Religious Site",
  "God/Goddess": "God/Goddess",
  "Establishment Date (in B.S)": "Establishment Date (B.S)",
  "Establishment Date (In A.D)": "Establishment Date (A.D)",
  Type: "Type",
  "Number of Employee": "Number of Employees",
  "School Nam": "School Name",
  "Name of He": "Health Post Name",
  "Name of re": "Name",
  "Name in Ne": "Nepali Name",
  "other gove": "Name",
  namee: "Nepali Name",
  name_I: "Nepali Name",
  Name_N: "Nepali Name",
  name_nep: "Nepali Name",
  "Major Attr": "Major Attribute",
  "Explain ab": "Description",
  "Explain th": "Description",
  "Number of Buildings": "Number of Buildings",
  "Number of Structures": "Number of Structures",
  "Type of building": "Type of Building",
  "Building Material": "Building Material",
  "Building Structure": "Building Structure",
  "No of storey": "No. of Storey",
  "No of storeys": "No. of Storeys",
  "Type of Building Registration": "Building Registration",
  "Use of bui": "Building Use",
  "Use of building": "Building Use",
  "Total memb": "Total Members",
  "Total No. of Family Member": "Total Family Members",
  "Gender: Male": "Male Members",
  "Gender: Female": "Female Members",
  "Gender: Others": "Other Gender Members",
  "Physically Disabled": "Physically Disabled",
  "Source of Income": "Source of Income",
  "Average sa": "Average Salary",
  "Crops harvest": "Crops Harvest",
  "Crops Harvest": "Crops Harvest",
  "Irrigation Facility": "Irrigation Facility",
  Electricit: "Electricity",
  "Electricity Facility": "Electricity Facility",
  "Road Acces": "Road Access",
  "Road Access": "Road Access",
  "Health fac": "Health Facility",
  "Nearest Health Facility": "Nearest Health Facility",
  "Animal Hus": "Animal Husbandry",
  "Animal Husbandary": "Animal Husbandry",
  "Literacy ,": "Literacy",
  "No of old": "No. of Elderly",
  "No. of old member": "No. of Elderly Members",
};

const BASE_LAYERS = [
  {
    id: "osm",
    label: "OSM Standard",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "&copy; OpenStreetMap contributors",
    checked: true,
  },
  {
    id: "carto",
    label: "Light",
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution: "&copy; OpenStreetMap &copy; CARTO",
  },
  {
    id: "satellite",
    label: "Satellite",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri",
  },
  {
    id: "google_hybrid",
    label: "Google Satellite Hybrid",
    url: "https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",
    attribution: "Map data &copy; Google",
  },
  {
    id: "terrain",
    label: "Topo Terrain",
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution: "&copy; OpenTopoMap contributors",
  },
];

const HOUSE_AGGREGATION = {
  // Keep household summaries broad until users zoom close enough to inspect houses.
  detailedZoom: 16,
  cellSizeByZoom: [
    { minZoom: 15, cellSize: 74 },
    { minZoom: 14, cellSize: 82 },
    { minZoom: 13, cellSize: 94 },
    { minZoom: 12, cellSize: 108 },
    { minZoom: 0, cellSize: 124 },
  ],
  markerSizeByZoom: [
    { minZoom: 15, minSize: 24, maxSize: 38 },
    { minZoom: 14, minSize: 26, maxSize: 42 },
    { minZoom: 13, minSize: 28, maxSize: 46 },
    { minZoom: 12, minSize: 30, maxSize: 48 },
    { minZoom: 0, minSize: 32, maxSize: 50 },
  ],
};

const getZoomSetting = <T extends { minZoom: number }>(
  settings: T[],
  zoom: number,
) =>
  settings.find((setting) => zoom >= setting.minZoom) ??
  settings[settings.length - 1];

const isBlank = (value: unknown) =>
  value === undefined || value === null || String(value).trim() === "";

const toNumber = (value: unknown) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const parsed = Number(String(value ?? "").trim());
  return Number.isFinite(parsed) ? parsed : null;
};

const getFieldValue = (row: DataRecord, key: string) => {
  if (Object.prototype.hasOwnProperty.call(row, key)) return row[key];
  const normalizedKey = key.trim().toLowerCase();
  const matchedKey = Object.keys(row).find(
    (rowKey) => rowKey.trim().toLowerCase() === normalizedKey,
  );
  return matchedKey ? row[matchedKey] : undefined;
};

const getFirstValue = (row: DataRecord, keys: string[]) => {
  for (const key of keys) {
    const value = getFieldValue(row, key);
    if (!isBlank(value)) return value;
  }
  return "";
};

const getPointName = (row: DataRecord, fallback: string) => {
  const value = getFirstValue(row, [
    "Name",
    "English Name",
    "Name of School",
    "Name of Health Care Facility",
    "Name of Religious Site",
    "School Nam",
    "Name of He",
    "Name of re",
    "Name in Ne",
    "Name in Nepali",
    "Name In Nepali",
    "Nepali Name",
    "other gove",
    "namee",
    "name_I",
    "Name_N",
    "name_nep",
    "Water serv",
    "SN",
    "sn",
  ]);
  return isBlank(value) ? fallback : String(value);
};

const recordMatchesSearch = (point: MapPoint, query: string) => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return [point.name, point.categoryLabel]
    .filter((value) => !isBlank(value))
    .some((value) => String(value).toLowerCase().includes(normalized));
};

const houseMatchesSearch = (point: MapPoint, query: string) => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return (
    point.name.toLowerCase().includes(normalized) ||
    point.id.toLowerCase().includes(normalized)
  );
};

const renderLayerIconSvg = (Icon: LucideIcon) =>
  renderToStaticMarkup(<Icon size={13} strokeWidth={2.2} color="#ffffff" />);

const createMunicipalIcon = (color: string, iconSvg: string) =>
  new L.DivIcon({
    className: "municipal-marker",
    html: `<div style="display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:14px;background:${color};border:2px solid #fff;box-shadow:0 4px 10px rgba(15,23,42,0.35);">${iconSvg}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });

const createHouseIcon = () =>
  new L.DivIcon({
    className: "house-marker",
    html: `<div style="width:12px;height:12px;border-radius:9999px;background:#2563EB;border:2px solid #fff;box-shadow:0 2px 8px rgba(15,23,42,0.3);"></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });

const createBucketIcon = (count: number, zoom: number) => {
  const { minSize, maxSize } = getZoomSetting(
    HOUSE_AGGREGATION.markerSizeByZoom,
    zoom,
  );
  const size = Math.max(
    minSize,
    Math.min(maxSize, minSize + Math.sqrt(count) * 1.2),
  );
  const fontSize = size >= 44 ? 15 : size >= 34 ? 14 : 12;
  const color = count >= 100 ? "#991B1B" : count >= 50 ? "#B91C1C" : "#DC2626";

  return new L.DivIcon({
    className: "bucket-marker",
    html: `<div style="display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:9999px;background:${color};border:3px solid #fff;box-shadow:0 8px 18px rgba(15,23,42,0.28);color:white;font-size:${fontSize}px;font-weight:900;font-family:Inter,sans-serif;line-height:1;">${count}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};

const Header = ({
  activeTab,
  setActiveTab,
}: {
  activeTab: string;
  setActiveTab: (tab: "map" | "data") => void;
}) => (
  <header className="min-h-20 border-b-4 border-[#003893] bg-white flex flex-wrap items-center justify-between gap-4 px-4 py-3 shadow-sm z-50 shrink-0 lg:px-8">
    <div className="flex min-w-0 items-center gap-3">
      <a
        href="https://www.makawanpurgadhimun.gov.np/"
        className="shrink-0 transition-opacity hover:opacity-85"
        aria-label="Open Makwanpurgadhi Rural Municipality official website"
      >
        <div className="h-12 w-12 shrink-0 flex items-center justify-center overflow-hidden sm:h-16 sm:w-16">
          <img
            src="/Emblem_of_Nepal.svg"
            alt="Government of Nepal"
            className="h-full w-full object-contain"
          />
        </div>
      </a>
      <button
        type="button"
        onClick={() => setActiveTab("map")}
        className="min-w-0 space-y-1 text-left transition-opacity hover:opacity-85"
      >
        <h1 className="font-display text-base font-extrabold leading-tight tracking-normal text-[#003893] sm:text-2xl">
          Makwanpurgadhi Rural Municipality
        </h1>
        <p className="font-display text-[11px] font-semibold leading-snug tracking-[0.04em] text-[#DC143C] sm:text-[13px]">
          Geographic Information System (GIS) Portal
        </p>
      </button>
    </div>
    <nav className="flex shrink-0 gap-2 sm:gap-4">
      <button
        onClick={() => setActiveTab("map")}
        className={cn(
          "px-3 py-2 rounded-none font-display font-bold text-xs tracking-[0.02em] transition-colors sm:px-4 sm:text-sm",
          activeTab === "map"
            ? "bg-[#003893] text-white"
            : "border-2 border-[#003893] text-[#003893] hover:bg-[#F0F0F0]",
        )}
      >
        MUNICIPAL DATA
      </button>
      <button
        onClick={() => setActiveTab("data")}
        className={cn(
          "px-3 py-2 rounded-none font-display font-bold text-xs tracking-[0.02em] transition-colors sm:px-4 sm:text-sm",
          activeTab === "data"
            ? "bg-[#003893] text-white"
            : "border-2 border-[#003893] text-[#003893] hover:bg-[#F0F0F0]",
        )}
      >
        HOUSE DETAILS
      </button>
    </nav>
  </header>
);

const MapControls = ({
  boundary,
}: {
  boundary: GeoJSON.GeoJsonObject | null;
}) => {
  const map = useMap();
  const resetToBoundary = () => {
    if (boundary) {
      const layer = L.geoJSON(boundary as any);
      const bounds = layer.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds.pad(0.06), { animate: true });
        return;
      }
    }
    map.setView(MUNICIPALITY_CENTER, 13);
  };
  return (
    <div className="absolute right-4 top-4 flex flex-col gap-2 z-[1000]">
      <button
        onClick={() => map.zoomIn()}
        className="w-10 h-10 bg-white shadow-xl flex items-center justify-center font-bold text-lg border border-slate-200 hover:bg-[#003893] hover:text-white transition-colors"
      >
        {" "}
        +{" "}
      </button>
      <button
        onClick={() => map.zoomOut()}
        className="w-10 h-10 bg-white shadow-xl flex items-center justify-center font-bold text-lg border border-slate-200 hover:bg-[#003893] hover:text-white transition-colors"
      >
        {" "}
        -{" "}
      </button>
      <button
        onClick={resetToBoundary}
        className="w-10 h-10 bg-white shadow-xl flex items-center justify-center border border-slate-200 hover:bg-[#003893] hover:text-white transition-colors"
      >
        {" "}
        <MapIcon className="h-5 w-5" />{" "}
      </button>
    </div>
  );
};

const FitBoundary = ({
  boundary,
}: {
  boundary: GeoJSON.GeoJsonObject | null;
}) => {
  const map = useMap();
  useEffect(() => {
    if (!boundary) return;
    const layer = L.geoJSON(boundary as any);
    const bounds = layer.getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds.pad(0.06), { animate: true });
    }
  }, [boundary, map]);
  return null;
};

const FlyToSelectedPoint = ({ point }: { point: MapPoint | null }) => {
  const map = useMap();
  useEffect(() => {
    if (!point) return;
    const targetZoom =
      point.source === "house"
        ? Math.max(map.getZoom(), 15)
        : Math.max(map.getZoom(), 14);
    map.flyTo([point.lat, point.lng], targetZoom, {
      animate: true,
      duration: 0.75,
    });
  }, [map, point]);
  return null;
};

const ResizeMapOnLayoutChange = ({ sidebarOpen }: { sidebarOpen: boolean }) => {
  const map = useMap();

  useEffect(() => {
    const timeouts = [80, 260, 420].map((delay) =>
      window.setTimeout(() => map.invalidateSize({ animate: false }), delay),
    );

    return () => {
      timeouts.forEach((timeout) => window.clearTimeout(timeout));
    };
  }, [map, sidebarOpen]);

  useEffect(() => {
    const handleViewportChange = () => {
      map.invalidateSize({ animate: false });
    };

    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("orientationchange", handleViewportChange);

    return () => {
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("orientationchange", handleViewportChange);
    };
  }, [map]);

  return null;
};

const HousePointMarker = ({
  point,
  isSelected,
  onSelectPoint,
}: {
  key?: string;
  point: MapPoint;
  isSelected: boolean;
  onSelectPoint: (point: MapPoint) => void;
}) => {
  const markerRef = useRef<L.Marker>(null);

  useEffect(() => {
    if (isSelected) {
      markerRef.current?.openPopup();
    }
  }, [isSelected]);

  return (
    <Marker
      ref={markerRef}
      position={[point.lat, point.lng]}
      icon={createHouseIcon()}
      eventHandlers={{ click: () => onSelectPoint(point) }}
    >
      <Popup>
        <div className="map-popup map-popup-compact">
          <p className="font-bold text-slate-900">{point.name}</p>
        </div>
      </Popup>
    </Marker>
  );
};

const HouseLayer = ({
  points,
  selectedPoint,
  onSelectPoint,
}: {
  points: MapPoint[];
  selectedPoint: MapPoint | null;
  onSelectPoint: (point: MapPoint) => void;
}) => {
  const map = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom());
  useMapEvents({ zoomend: (event) => setZoom(event.target.getZoom()) });
  const selectedHousePoint =
    selectedPoint?.source === "house"
      ? points.find((point) => point.id === selectedPoint.id)
      : null;

  const buckets = useMemo(() => {
    if (zoom >= HOUSE_AGGREGATION.detailedZoom) return [] as HouseBucket[];
    const { cellSize } = getZoomSetting(HOUSE_AGGREGATION.cellSizeByZoom, zoom);
    const groups = new Map<string, MapPoint[]>();
    for (const point of points) {
      const projected = map.project([point.lat, point.lng], zoom);
      const key = `${Math.floor(projected.x / cellSize)}:${Math.floor(projected.y / cellSize)}`;
      const group = groups.get(key) || [];
      group.push(point);
      groups.set(key, group);
    }
    return Array.from(groups.entries()).map(([id, group]) => {
      const center = group
        .map((point) => map.project([point.lat, point.lng], zoom))
        .reduce((total, projected) => total.add(projected), L.point(0, 0))
        .divideBy(group.length);
      const latLng = map.unproject(center, zoom);

      return {
        id,
        count: group.length,
        lat: latLng.lat,
        lng: latLng.lng,
        points: group,
      };
    });
  }, [map, points, zoom]);

  if (zoom >= HOUSE_AGGREGATION.detailedZoom) {
    return (
      <>
        {points.map((point) => (
          <HousePointMarker
            key={point.id}
            point={point}
            isSelected={selectedPoint?.id === point.id}
            onSelectPoint={onSelectPoint}
          />
        ))}
      </>
    );
  }

  return (
    <>
      {buckets.map((bucket) => (
        <Marker
          key={bucket.id}
          position={[bucket.lat, bucket.lng]}
          icon={createBucketIcon(bucket.count, zoom)}
          zIndexOffset={bucket.count}
        >
          <Popup>
            <div className="text-xs space-y-1">
              <p className="font-bold text-slate-900">
                {bucket.count} house records
              </p>
              <p className="text-slate-600">
                Zoom in to open individual houses
              </p>
            </div>
          </Popup>
        </Marker>
      ))}
      {selectedHousePoint && (
        <HousePointMarker
          point={selectedHousePoint}
          isSelected={true}
          onSelectPoint={onSelectPoint}
        />
      )}
    </>
  );
};

const MunicipalPointMarker = ({
  point,
  isSelected,
  onSelectPoint,
}: {
  key?: string;
  point: MapPoint;
  isSelected: boolean;
  onSelectPoint: (point: MapPoint) => void;
}) => {
  const markerRef = useRef<L.Marker>(null);

  useEffect(() => {
    if (isSelected) {
      markerRef.current?.openPopup();
    }
  }, [isSelected]);

  return (
    <Marker
      ref={markerRef}
      position={[point.lat, point.lng]}
      icon={createMunicipalIcon(
        CATEGORY_COLORS[point.category] || "#64748B",
        renderLayerIconSvg(
          MUNICIPAL_LAYERS.find((layer) => layer.id === point.category)?.icon ||
            Landmark,
        ),
      )}
      eventHandlers={{ click: () => onSelectPoint(point) }}
    >
      <Popup>
        <div className="map-popup w-[176px]">
          <div className="flex items-center gap-2 text-slate-700">
            <span
              className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-white"
              style={{
                backgroundColor: CATEGORY_COLORS[point.category] || "#64748B",
              }}
              dangerouslySetInnerHTML={{
                __html: renderLayerIconSvg(
                  MUNICIPAL_LAYERS.find((layer) => layer.id === point.category)
                    ?.icon || Landmark,
                ),
              }}
            />
            <p className="text-[11px] font-bold leading-tight text-slate-700">
              {point.categoryLabel}
            </p>
          </div>
          <p className="mt-2 text-[12px] font-bold leading-snug text-slate-900">
            {point.name}
          </p>
        </div>
      </Popup>
    </Marker>
  );
};

const MunicipalLayer = ({
  points,
  selectedPoint,
  onSelectPoint,
}: {
  points: MapPoint[];
  selectedPoint: MapPoint | null;
  onSelectPoint: (point: MapPoint) => void;
}) => (
  <>
    {points.map((point) => (
      <MunicipalPointMarker
        key={point.id}
        point={point}
        isSelected={selectedPoint?.id === point.id}
        onSelectPoint={onSelectPoint}
      />
    ))}
  </>
);

const GisMap = ({
  points,
  boundary,
  onSelectPoint,
  activeTab,
  selectedPoint,
  sidebarOpen,
}: {
  points: MapPoint[];
  boundary: GeoJSON.GeoJsonObject | null;
  onSelectPoint: (point: MapPoint) => void;
  activeTab: "map" | "data";
  selectedPoint: MapPoint | null;
  sidebarOpen: boolean;
}) => (
  <MapContainer
    center={MUNICIPALITY_CENTER}
    zoom={13}
    style={{ height: "100%", width: "100%" }}
    zoomControl={false}
  >
    <LayersControl position="topleft">
      {BASE_LAYERS.map((layer) => (
        <LayersControl.BaseLayer
          key={layer.id}
          checked={Boolean(layer.checked)}
          name={layer.label}
        >
          <TileLayer url={layer.url} attribution={layer.attribution} />
        </LayersControl.BaseLayer>
      ))}
    </LayersControl>
    <FitBoundary boundary={boundary} />
    <ResizeMapOnLayoutChange sidebarOpen={sidebarOpen} />
    <FlyToSelectedPoint point={selectedPoint} />
    {boundary && (
      <GeoJSON
        data={boundary}
        style={{
          color: "#003893",
          weight: 2.5,
          fillColor: "#003893",
          fillOpacity: 0.04,
        }}
      />
    )}
    {activeTab === "map" ? (
      <MunicipalLayer
        points={points}
        selectedPoint={selectedPoint}
        onSelectPoint={onSelectPoint}
      />
    ) : (
      <HouseLayer
        points={points}
        selectedPoint={selectedPoint}
        onSelectPoint={onSelectPoint}
      />
    )}
    <MapControls boundary={boundary} />
  </MapContainer>
);

const DetailPanel = ({
  selectedPoint,
  activeTab,
}: {
  selectedPoint: MapPoint | null;
  activeTab: "map" | "data";
}) => {
  const detailRows = selectedPoint
    ? Object.entries(selectedPoint.details)
        .filter(([, value]) => !isBlank(value))
        .filter(
          ([key]) =>
            ![
              "wkt_geom",
              "latitude",
              "longitude",
              "Latitude",
              "Longitude",
              "_location_",
              "_locatio_1",
            ].includes(key),
        )
        .map(([key, value]) => ({
          label: FIELD_LABELS[key] || key,
          value: String(value),
        }))
    : [];

  return (
    <aside className="w-full shrink-0 border-t border-[#CADCF5] bg-gradient-to-b from-[#E8F1FF] via-[#F7FBFF] to-[#FFFFFF] lg:w-[360px] lg:border-l lg:border-t-0 lg:overflow-y-auto custom-scrollbar">
      <div className="p-5 sm:p-6 space-y-5">
        {selectedPoint ? (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="border-b border-[#B6CAE6] pb-4">
              <h2 className="text-xl sm:text-2xl font-display font-extrabold text-[#0B2E5E]">
                Spatial Data Detail
              </h2>
              <p className="text-[11px] text-[#53719A] uppercase tracking-[0.12em] font-bold">
                GIS feature information
              </p>
            </div>
            <div className="rounded-md bg-white border border-[#C9DCF5] p-4 shadow-sm">
              <p className="text-[10px] text-[#0B2E5E] font-black uppercase tracking-widest border-b border-[#D6E4F8] pb-2 flex items-center justify-between">
                Selected Feature
                <Check className="h-3 w-3 text-green-600" />
              </p>
              <h3 className="mt-3 font-display text-lg font-extrabold leading-tight text-[#092243]">
                {selectedPoint.name}
              </h3>
              {selectedPoint.source !== "house" && (
                <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#5E7FA8]">
                  {selectedPoint.categoryLabel}
                </p>
              )}
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="bg-[#F3F8FF] p-3 rounded-sm">
                  <p className="text-[10px] uppercase font-bold text-[#6A87AE]">
                    Latitude
                  </p>
                  <p className="font-mono font-bold text-[#173F70]">
                    {selectedPoint.lat.toFixed(6)}
                  </p>
                </div>
                <div className="bg-[#F3F8FF] p-3 rounded-sm">
                  <p className="text-[10px] uppercase font-bold text-[#6A87AE]">
                    Longitude
                  </p>
                  <p className="font-mono font-bold text-[#173F70]">
                    {selectedPoint.lng.toFixed(6)}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-md bg-white border border-[#C9DCF5] p-4 shadow-sm">
              <p className="text-[10px] text-[#5B7FAF] font-black uppercase tracking-widest mb-3">
                Attribute Categories
              </p>
              <div className="space-y-2">
                {detailRows.map((item, idx) => (
                  <div
                    key={`${item.label}-${idx}`}
                    className="border-b border-[#E1ECFA] pb-2"
                  >
                    <p className="text-[10px] uppercase font-bold text-[#6A87AE]">
                      {item.label}
                    </p>
                    <p className="mt-0.5 text-xs font-semibold leading-relaxed text-[#163A67] break-words">
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-md bg-white border border-[#C9DCF5] p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <img
                src="/Emblem_of_Nepal.svg"
                alt="Emblem of Nepal"
                className="h-14 w-14 object-contain"
              />
              <img
                src="/Flag_of_Nepal.gif"
                alt="Flag of Nepal waving"
                className="h-12 w-12 object-contain"
              />
            </div>
            <p className="text-sm font-display font-extrabold text-[#0B2E5E]">
              Welcome to GIS portal of Makwanpurgadhi Rural Municipality
            </p>
            <p className="text-xs leading-relaxed text-[#355985] font-medium">
              This portal provides a geospatial view of municipal facilities,
              public services, tourism and infrastructure data, and detailed
              household survey locations for planning and monitoring.
            </p>
            <p className="text-xs leading-relaxed text-[#355985] font-medium">
              Select any location on the{" "}
              {activeTab === "map" ? "municipal" : "household"} map to view
              categorized spatial details, coordinates, and related records in
              this panel.
            </p>
          </div>
        )}
      </div>
    </aside>
  );
};

export default function App() {
  const [activeTab, setActiveTab] = useState<"map" | "data">("map");
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [municipalData, setMunicipalData] = useState<MapPoint[]>([]);
  const [houseData, setHouseData] = useState<MapPoint[]>([]);
  const [selectedPoint, setSelectedPoint] = useState<MapPoint | null>(null);
  const [boundary, setBoundary] = useState<GeoJSON.GeoJsonObject | null>(null);
  const [dataStatus, setDataStatus] = useState("Loading data files...");
  const [filters, setFilters] = useState<Record<string, boolean>>(
    Object.fromEntries(MUNICIPAL_LAYERS.map((layer) => [layer.id, true])),
  );

  useEffect(() => {
    const loadData = async () => {
      try {
        const [municipalResponse, houseResponse] = await Promise.all([
          fetch("/municipal-data.json"),
          fetch("/house-data.json"),
        ]);
        if (!municipalResponse.ok)
          throw new Error(
            "municipal-data.json could not be loaded from public folder.",
          );
        if (!houseResponse.ok)
          throw new Error(
            "house-data.json could not be loaded from public folder.",
          );
        const [municipalPoints, housePoints] = await Promise.all([
          municipalResponse.json() as Promise<MapPoint[]>,
          houseResponse.json() as Promise<MapPoint[]>,
        ]);
        setMunicipalData(municipalPoints);
        setHouseData(housePoints);
        setDataStatus(
          `Loaded ${municipalPoints.length} municipal sites and ${housePoints.length} houses.`,
        );
      } catch (error) {
        console.error(error);
        setDataStatus(
          error instanceof Error ? error.message : "Unable to load map data.",
        );
      }
    };
    loadData();
    fetch("/boundary.json")
      .then((res) => res.json())
      .then((data) => setBoundary(data))
      .catch(() => console.log("Boundary GeoJSON not found at /boundary.json"));
  }, []);

  useEffect(() => {
    setSelectedPoint(null);
  }, [activeTab]);

  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  }, []);

  const visibleMunicipalPoints = useMemo(
    () => municipalData.filter((point) => filters[point.category]),
    [municipalData, filters],
  );
  const visibleHousePoints = useMemo(() => houseData, [houseData]);
  const activePoints =
    activeTab === "map" ? visibleMunicipalPoints : visibleHousePoints;
  const totalActivePoints =
    activeTab === "map" ? municipalData.length : houseData.length;
  const searchablePoints = useMemo(
    () =>
      activeTab === "map"
        ? municipalData.filter(
            (point) =>
              filters[point.category] &&
              recordMatchesSearch(point, searchQuery),
          )
        : houseData.filter((point) => houseMatchesSearch(point, searchQuery)),
    [activeTab, municipalData, houseData, filters, searchQuery],
  );
  const searchResults = useMemo(
    () => (searchQuery.trim() ? searchablePoints.slice(0, 8) : []),
    [searchablePoints, searchQuery],
  );

  const selectSearchResult = (point: MapPoint) => {
    setSelectedPoint(point);
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  };

  return (
    <div className="min-h-dvh bg-[#FDFBF7] font-sans selection:bg-[#DC143C]/20 lg:flex lg:h-dvh lg:flex-col lg:overflow-hidden">
      <Header activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="relative flex flex-col lg:min-h-0 lg:flex-1 lg:flex-row lg:overflow-hidden">
        <AnimatePresence initial={false}>
          {isSidebarOpen && (
            <motion.aside
              initial={{ x: -18, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -18, opacity: 0 }}
              className="absolute left-0 top-0 z-40 flex h-[58dvh] min-h-[360px] max-h-[620px] w-[86vw] max-w-[320px] flex-col overflow-hidden border-r-2 border-slate-200 bg-white lg:relative lg:h-auto lg:min-h-0 lg:max-h-none lg:w-[300px] lg:max-w-none"
            >
              <div className="p-4 sm:p-6 space-y-6 flex-1 overflow-y-auto custom-scrollbar">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                    Search
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder={
                        activeTab === "map"
                          ? "Search by name"
                          : "Search household number"
                      }
                      className="w-full border-2 border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm font-semibold text-slate-700 outline-none transition-colors placeholder:text-slate-400 focus:border-[#003893]"
                    />
                  </div>
                  {searchResults.length > 0 && (
                    <div className="max-h-64 overflow-y-auto border border-slate-200 bg-white shadow-sm custom-scrollbar">
                      {searchResults.map((point) => (
                        <button
                          key={point.id}
                          type="button"
                          onClick={() => selectSearchResult(point)}
                          className="w-full border-b border-slate-100 px-3 py-2 text-left transition-colors last:border-b-0 hover:bg-[#F3F8FF]"
                        >
                          <p className="truncate text-xs font-black text-slate-800">
                            {point.name}
                          </p>
                          {activeTab === "map" && (
                            <p className="mt-0.5 truncate text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">
                              {point.categoryLabel}
                            </p>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {activeTab === "map" ? (
                  <div>
                    <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">
                      Municipal Layers
                    </h2>
                    <div className="space-y-3">
                      {MUNICIPAL_LAYERS.map((layer) => {
                        const Icon = layer.icon;
                        const count = municipalData.filter(
                          (point) => point.category === layer.id,
                        ).length;
                        return (
                          <button
                            key={layer.id}
                            onClick={() =>
                              setFilters((current) => ({
                                ...current,
                                [layer.id]: !current[layer.id],
                              }))
                            }
                            className={cn(
                              "w-full flex items-center justify-between p-3 border-l-4 transition-all text-left group",
                              filters[layer.id]
                                ? "bg-[#F5F5F5] opacity-100"
                                : "bg-white opacity-40 hover:opacity-100",
                            )}
                            style={{ borderLeftColor: layer.color }}
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <Icon className="h-4 w-4 shrink-0 text-slate-500" />
                              <span className="text-sm font-bold text-slate-700 leading-snug">
                                {layer.label}
                              </span>
                            </div>
                            <span className="ml-2 text-[10px] font-mono font-bold text-slate-400">
                              {count.toString().padStart(2, "0")}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div>
                    <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">
                      House Layer
                    </h2>
                    <div className="border-l-4 border-blue-600 bg-[#F5F5F5] p-4">
                      <div className="flex items-center gap-3">
                        <Home className="h-5 w-5 text-blue-600" />
                        <div>
                          <p className="text-sm font-black text-slate-800">
                            Household Survey Points
                          </p>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                            {totalActivePoints.toLocaleString()} records
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="pt-5 border-t border-slate-100">
                  <p className="text-[10px] text-slate-500 font-semibold leading-relaxed">
                    {dataStatus}
                  </p>
                </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        <button
          onClick={() => setSidebarOpen(!isSidebarOpen)}
          className={cn(
            "absolute top-24 z-50 rounded-full border border-slate-200 bg-white p-2 shadow-xl transition-all hover:scale-110 hover:bg-orange-50 active:scale-90 lg:top-1/2 lg:-translate-y-1/2",
            isSidebarOpen
              ? "left-[calc(min(86vw,320px)+12px)] lg:left-[304px]"
              : "left-3",
          )}
        >
          {isSidebarOpen ? (
            <ChevronLeft className="h-5 w-5 text-slate-700" />
          ) : (
            <ChevronRight className="h-5 w-5 text-slate-700" />
          )}
        </button>

        <div className="relative h-[58dvh] min-h-[360px] max-h-[620px] shrink-0 bg-slate-100 lg:h-auto lg:min-h-0 lg:max-h-none lg:flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full w-full relative z-0"
            >
              <GisMap
                points={activePoints}
                boundary={boundary}
                onSelectPoint={setSelectedPoint}
                activeTab={activeTab}
                selectedPoint={selectedPoint}
                sidebarOpen={isSidebarOpen}
              />
            </motion.div>
          </AnimatePresence>
        </div>

        <DetailPanel selectedPoint={selectedPoint} activeTab={activeTab} />
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0, 56, 147, 0.16); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(0, 56, 147, 0.3); }
        .leaflet-popup-content-wrapper { border-radius: 10px; box-shadow: 0 8px 22px rgba(15, 23, 42, 0.18); }
        .leaflet-popup-content { margin: 10px 12px; width: auto !important; }
        .leaflet-popup-close-button { top: 4px !important; right: 6px !important; color: #64748B !important; }
        .map-popup { font-family: Inter, sans-serif; font-size: 12px; line-height: 1.22; padding-right: 10px; }
        .map-popup-compact { min-width: 112px; max-width: 190px; }
      `}</style>
    </div>
  );
}
