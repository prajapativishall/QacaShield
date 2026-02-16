import https from "https";
import http from "http";

export async function fetchBestRoutePolyline(origin, destination) {
  try {
    // 1. Geocode Origin
    const originCoords = await geocodeNominatim(origin);
    if (!originCoords) return { polyline: null, raw: null, route_path: [] };

    // 2. Geocode Destination
    const destCoords = await geocodeNominatim(destination);
    if (!destCoords) return { polyline: null, raw: null, route_path: [] };

    // 3. Get Route from OSRM
    const routeData = await getOsrmRoute(originCoords, destCoords);
    if (!routeData || !routeData.routes || routeData.routes.length === 0) return { polyline: null, raw: null, route_path: [] };

    const encodedPolyline = routeData.routes[0].geometry;
    
    // Decode for frontend display (Leaflet needs [lat, lon] array)
    const route_path = decodePolyline(encodedPolyline);

    return { 
        polyline: encodedPolyline, 
        raw: routeData,
        route_path
    };

  } catch (err) {
    console.error("Routing error:", err);
    return { polyline: null, raw: null, route_path: [] };
  }
}

export async function geocodeAddress(query) {
    return await geocodeNominatim(query);
}

export async function geocodeSuggestions(query) {
    const headers = { "User-Agent": "QacaShield-Dev/1.0" };
    const base = "https://nominatim.openstreetmap.org/search";
    const trimmed = query.trim();
    if (!trimmed) {
        return [];
    }

    const tokens = trimmed.split(/\s+/);
    let numericPart = null;
    let cityName = null;

    for (const t of tokens) {
        const lowerToken = t.toLowerCase();
        if (!numericPart && /^(\d{1,3})$/.test(t)) {
            numericPart = t;
        }
        if (!cityName) {
            if (lowerToken === "noida") {
                cityName = "Noida";
            } else if (lowerToken === "delhi") {
                cityName = "Delhi";
            }
        }
    }

    const urls = [];
    const addUrl = (url) => {
        if (!urls.includes(url)) {
            urls.push(url);
        }
    };

    if (cityName && numericPart && cityName === "Noida") {
        const sector = numericPart;
        const structured = `${base}?street=${encodeURIComponent("Sector " + sector)}&city=${encodeURIComponent("Noida")}&state=${encodeURIComponent("Uttar Pradesh")}&country=${encodeURIComponent("India")}&format=json&limit=5&addressdetails=1&countrycodes=in&accept-language=en`;
        addUrl(structured);

        const alt1 = `${base}?q=${encodeURIComponent("Sector " + sector + ", Noida, Uttar Pradesh, India")}&format=json&limit=5&addressdetails=1&countrycodes=in&accept-language=en`;
        const alt2 = `${base}?q=${encodeURIComponent("Noida Sector " + sector + ", Uttar Pradesh, India")}&format=json&limit=5&addressdetails=1&countrycodes=in&accept-language=en`;
        const alt3 = `${base}?q=${encodeURIComponent("Sector " + sector + ", Noida")}&format=json&limit=5&addressdetails=1&countrycodes=in&accept-language=en`;
        addUrl(alt1);
        addUrl(alt2);
        addUrl(alt3);
    }

    const generic1 = `${base}?q=${encodeURIComponent(trimmed)}&format=json&limit=5&addressdetails=1&countrycodes=in&accept-language=en`;
    const generic2 = `${base}?q=${encodeURIComponent(trimmed + ", India")}&format=json&limit=5&addressdetails=1&countrycodes=in&accept-language=en`;
    addUrl(generic1);
    addUrl(generic2);

    const results = [];
    const seenCoords = new Set();

    for (const url of urls) {
        const data = await httpGetJson(url, headers);
        if (Array.isArray(data)) {
            for (const item of data) {
                const key = `${item.lat},${item.lon}`;
                if (!seenCoords.has(key)) {
                    seenCoords.add(key);
                    results.push(item);
                    if (results.length >= 10) {
                        break;
                    }
                }
            }
        }
        if (results.length >= 10) {
            break;
        }
    }

    return results.map((item) => ({
        lat: item.lat,
        lon: item.lon,
        display_name: item.display_name
    }));
}

export async function getRouteFromCoords(originLat, originLng, destLat, destLng) {
    try {
        const start = { lat: originLat, lon: originLng };
        const end = { lat: destLat, lon: destLng };
        
        const routeData = await getOsrmRoute(start, end);
        if (!routeData || !routeData.routes || routeData.routes.length === 0) return { polyline: null, raw: null, route_path: [] };

        const encodedPolyline = routeData.routes[0].geometry;
        const route_path = decodePolyline(encodedPolyline);

        return { 
            polyline: encodedPolyline, 
            raw: routeData,
            route_path
        };
    } catch (err) {
        console.error("Routing error:", err);
        return { polyline: null, raw: null, route_path: [] };
    }
}

async function geocodeNominatim(query) {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
    // User-Agent is required by Nominatim
    const headers = { "User-Agent": "QacaShield-Dev/1.0" };
    
    const data = await httpGetJson(url, headers);
    if (data && data.length > 0) {
        return { lat: data[0].lat, lon: data[0].lon };
    }
    return null;
}

async function getOsrmRoute(start, end) {
    // OSRM Public API: geometries=polyline is default, but let's be explicit
    const url = `http://router.project-osrm.org/route/v1/driving/${start.lon},${start.lat};${end.lon},${end.lat}?overview=full&geometries=polyline`;
    return await httpGetJson(url);
}

function decodePolyline(str, precision) {
    var index = 0,
        lat = 0,
        lng = 0,
        coordinates = [],
        shift = 0,
        result = 0,
        byte = null,
        latitude_change,
        longitude_change,
        factor = Math.pow(10, precision || 5);

    while (index < str.length) {
        byte = null;
        shift = 0;
        result = 0;

        do {
            byte = str.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
        } while (byte >= 0x20);

        latitude_change = ((result & 1) ? ~(result >> 1) : (result >> 1));

        shift = result = 0;

        do {
            byte = str.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
        } while (byte >= 0x20);

        longitude_change = ((result & 1) ? ~(result >> 1) : (result >> 1));

        lat += latitude_change;
        lng += longitude_change;

        coordinates.push([lat / factor, lng / factor]);
    }

    return coordinates;
}

function httpGetJson(url, headers = {}) {
  const lib = url.startsWith("https") ? https : http;
  return new Promise((resolve, reject) => {
    lib.get(url, { headers }, (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(e);
          }
        });
      })
      .on("error", reject);
  });
}
