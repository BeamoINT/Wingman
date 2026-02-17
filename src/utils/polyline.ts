/**
 * Decode an encoded polyline string into latitude/longitude coordinates.
 * Compatible with Google Maps encoded polyline format.
 */
export function decodePolyline(encoded: string): Array<{ latitude: number; longitude: number }> {
  const coordinates: Array<{ latitude: number; longitude: number }> = [];

  if (!encoded || typeof encoded !== 'string') {
    return coordinates;
  }

  let index = 0;
  const length = encoded.length;
  let latitude = 0;
  let longitude = 0;

  while (index < length) {
    let result = 0;
    let shift = 0;
    let byte = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < length + 1);

    const deltaLat = (result & 1) !== 0 ? ~(result >> 1) : (result >> 1);
    latitude += deltaLat;

    result = 0;
    shift = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < length + 1);

    const deltaLng = (result & 1) !== 0 ? ~(result >> 1) : (result >> 1);
    longitude += deltaLng;

    coordinates.push({
      latitude: latitude / 1e5,
      longitude: longitude / 1e5,
    });
  }

  return coordinates;
}
