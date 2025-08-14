import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import "./index.css";


const DEFAULT_STATE = {
  ip: "8.8.8.8",
  isp: "Google LLC",
  city: "Seattle",
  region: "WA",
  coordinates: [47.7, -122.33],
  postalCode: "98103",
  timezone: "-07:00",
  statusText: "",
};

export default function App() {
  const [ip, setIp] = useState(DEFAULT_STATE.ip);
  const [isp, setIsp] = useState(DEFAULT_STATE.isp);
  const [city, setCity] = useState(DEFAULT_STATE.city);
  const [region, setRegion] = useState(DEFAULT_STATE.region);
  const [coordinates, setCoordinates] = useState(DEFAULT_STATE.coordinates);
  const [postalCode, setPostalCode] = useState(DEFAULT_STATE.postalCode);
  const [timezone, setTimezone] = useState(DEFAULT_STATE.timezone);
  const [statusText, setStatusText] = useState(DEFAULT_STATE.statusText);

  // Keep a plain object around when we want "the whole state" for logging
  const State = useRef({ ...DEFAULT_STATE });

  // Search elements as React state
  const [searchText, setSearchText] = useState("");

  // Leaflet refs
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const mapContainerRef = useRef(null);

  // now using refs
  function loadMap({ lat, lng }) {
    if (!mapRef.current) {
      // init map once
      mapRef.current = L.map(mapContainerRef.current).setView([lat, lng], 13);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution:
          '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(mapRef.current);
      markerRef.current = L.marker([lat, lng]).addTo(mapRef.current);
      return;
    }
    // update existing
    markerRef.current.setLatLng([lat, lng]);
    mapRef.current.panTo([lat, lng]);
  }

  // Regex helpers
  function isIpAddress(input) {
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Regex =
      /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$|^::$/;
    return ipv4Regex.test(input) || ipv6Regex.test(input);
  }
  function getInputType(input) {
    return isIpAddress(input) ? "ip" : "domain";
  }

  // Basic validation
  function validateInput(input) {
    if (!input) return { valid: false, message: "Please enter something" };
    if (input.includes(" "))
      return { valid: false, message: "Remove any spaces" };
    if (input.length < 4 || input.length > 255)
      return { valid: false, message: "Input seems too short or too long" };
    setStatusText("");
    return { valid: true, inputType: getInputType(input) };
  }

  // IPify call (uses Vite env when available)
  async function callIpify({ mock, searchText, inputType }) {
    const apiKey = import.meta.env.VITE_IPIFY_KEY || "at_s06Hu3X7sUEL16DmvpUpvwYzcXjwQ"; // dev fallback

    const handleResponse = (data) => {
      const { ip: _ip, isp: _isp, location } = data;
      const { city, region, lat, lng, postalCode, timezone } = location;

      // Update React state
      setIp(_ip);
      setIsp(_isp);
      setCity(city);
      setRegion(region);
      setCoordinates([lat, lng]);
      setPostalCode(postalCode);
      setTimezone(timezone);

      // Keep a mirror for logging (nice for debugging)
      State.current = {
        ip: _ip,
        isp: _isp,
        city,
        region,
        coordinates: [lat, lng],
        postalCode,
        timezone,
        statusText: "",
      };
      // move map
      loadMap({ lat, lng });
    };

    try {
      if (searchText && inputType) {
        const urlWithParams =
          inputType === "ip"
            ? `https://geo.ipify.org/api/v2/country,city?apiKey=${apiKey}&ipAddress=${searchText}`
            : `https://geo.ipify.org/api/v2/country,city?apiKey=${apiKey}&domain=${searchText}`;

        const res = await fetch(urlWithParams);
        if (!res.ok) {
          const errorData = await res.json();
          const msg = errorData.messages || `HTTP error! status: ${res.status}`;
          setStatusText(msg);
          throw new Error(msg);
        }
        const json = await res.json();
        await handleResponse(json);
        return;
      }

      if (mock) {
        // Mock = show defaults and initialize map
        handleResponse({
          ip: DEFAULT_STATE.ip,
          isp: DEFAULT_STATE.isp,
          location: {
            city: DEFAULT_STATE.city,
            region: DEFAULT_STATE.region,
            lat: DEFAULT_STATE.coordinates[0],
            lng: DEFAULT_STATE.coordinates[1],
            postalCode: DEFAULT_STATE.postalCode,
            timezone: DEFAULT_STATE.timezone,
          },
        });
        return;
      }

      // Initial real request
      const res = await fetch(
        `https://geo.ipify.org/api/v2/country,city?apiKey=${apiKey}`
      );
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const json = await res.json();
      await handleResponse(json);
    } catch (err) {
      console.error("Error fetching location data:", err);
      if (!statusText) setStatusText("Network error or service unavailable");
    }
  }

  function handleSearch() {
    const { valid, message, inputType } = validateInput(searchText.trim());
    if (!valid) {
      setStatusText(message);
      return;
    }
    callIpify({ searchText, inputType });
  }

  // On mount: populate mock data + init map once
  useEffect(() => {
    callIpify({ mock: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main>
      <div className="container">
        <div id="home" style={{
          backgroundImage: "url('/src/assets/pattern-bg-desktop.png')",
          backgroundSize: "cover",}} className="page active">
          <div style={{ textAlign: "center", color: "white" }}>
            <h1 style={{ color: "white" }}>IP Address Tracker</h1>
            <button className="button" onClick={() => callIpify({ mock: true })}>
              Load Sample Data
            </button>
          </div>

          {/* Search bar */}
          <div id="search-container" className="search-container">
            <input
              type="text"
              id="search-input"
              placeholder="Search for any IP address or domain"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <button id="search-button" onClick={handleSearch}>Search</button>
          </div>

          <div id="status-div">{statusText}</div>

          {/* Data display grid (IDs kept) */}
          <div id="data-display">
            <div className="data-section">
              <div>IP ADDRESS</div>
              <div id="ip-address" className="data-value">{ip}</div>
            </div>

            <div className="divider"></div>

            <div className="data-section">
              <div>LOCATION</div>
              <div id="location" className="data-value">
                {city}, {region} {postalCode}
              </div>
            </div>

            <div className="divider"></div>

            <div className="data-section">
              <div>TIMEZONE</div>
              <div id="timezone" className="data-value">UTC {timezone}</div>
            </div>

            <div className="divider"></div>

            <div className="data-section">
              <div>ISP</div>
              <div id="isp" className="data-value">{isp}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Leaflet map container */}
      <div id="map" ref={mapContainerRef}></div>
    </main>
  );
}
