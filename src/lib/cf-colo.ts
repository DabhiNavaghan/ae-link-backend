/**
 * Cloudflare edge-datacenter ("colo") → approximate location.
 *
 * The suffix of `cf-ray` is the IATA code of the PoP that served the request,
 * e.g. `a1ea4e419a9cff6d-BOM` → BOM → Mumbai. Cloudflare sends this on every
 * request with no configuration, which makes it the only location signal
 * available before the "Add visitor location headers" Managed Transform is
 * enabled.
 *
 * IMPORTANT — this is the *edge*, not the user. Cloudflare routes to the
 * nearest healthy PoP by BGP anycast, so it is a coarse proxy for the visitor's
 * metro and can be badly wrong: a user in Ahmedabad serves from Mumbai (~500km),
 * and during a PoP drain or with some carriers traffic lands in another country
 * entirely. Treat it as a hint of last resort, never as the stored location when
 * a real geo source is available.
 */

export interface ColoLocation {
  city: string;
  country: string;
  countryCode: string;
  latitude: number;
  longitude: number;
}

/**
 * Not exhaustive — Cloudflare runs 300+ PoPs. Covers India (our primary market)
 * plus the majors we actually see traffic from; unknown codes fall through to a
 * null location while still reporting the raw code.
 */
const COLOS: Record<string, ColoLocation> = {
  // India
  BOM: { city: 'Mumbai', country: 'India', countryCode: 'IN', latitude: 19.0896, longitude: 72.8656 },
  DEL: { city: 'New Delhi', country: 'India', countryCode: 'IN', latitude: 28.5562, longitude: 77.1000 },
  MAA: { city: 'Chennai', country: 'India', countryCode: 'IN', latitude: 12.9941, longitude: 80.1709 },
  BLR: { city: 'Bengaluru', country: 'India', countryCode: 'IN', latitude: 13.1979, longitude: 77.7063 },
  HYD: { city: 'Hyderabad', country: 'India', countryCode: 'IN', latitude: 17.2403, longitude: 78.4294 },
  CCU: { city: 'Kolkata', country: 'India', countryCode: 'IN', latitude: 22.6547, longitude: 88.4467 },
  AMD: { city: 'Ahmedabad', country: 'India', countryCode: 'IN', latitude: 23.0772, longitude: 72.6347 },
  PNQ: { city: 'Pune', country: 'India', countryCode: 'IN', latitude: 18.5821, longitude: 73.9197 },
  NAG: { city: 'Nagpur', country: 'India', countryCode: 'IN', latitude: 21.0922, longitude: 79.0472 },
  COK: { city: 'Kochi', country: 'India', countryCode: 'IN', latitude: 10.1520, longitude: 76.4019 },
  JAI: { city: 'Jaipur', country: 'India', countryCode: 'IN', latitude: 26.8242, longitude: 75.8122 },
  IXC: { city: 'Chandigarh', country: 'India', countryCode: 'IN', latitude: 30.6735, longitude: 76.7885 },
  ATQ: { city: 'Amritsar', country: 'India', countryCode: 'IN', latitude: 31.7096, longitude: 74.7973 },
  BBI: { city: 'Bhubaneswar', country: 'India', countryCode: 'IN', latitude: 20.2444, longitude: 85.8178 },
  PAT: { city: 'Patna', country: 'India', countryCode: 'IN', latitude: 25.5913, longitude: 85.0880 },
  IDR: { city: 'Indore', country: 'India', countryCode: 'IN', latitude: 22.7218, longitude: 75.8011 },

  // South & South-East Asia
  CMB: { city: 'Colombo', country: 'Sri Lanka', countryCode: 'LK', latitude: 7.1808, longitude: 79.8841 },
  KTM: { city: 'Kathmandu', country: 'Nepal', countryCode: 'NP', latitude: 27.6966, longitude: 85.3591 },
  DAC: { city: 'Dhaka', country: 'Bangladesh', countryCode: 'BD', latitude: 23.8433, longitude: 90.3978 },
  SIN: { city: 'Singapore', country: 'Singapore', countryCode: 'SG', latitude: 1.3644, longitude: 103.9915 },
  BKK: { city: 'Bangkok', country: 'Thailand', countryCode: 'TH', latitude: 13.6900, longitude: 100.7501 },
  KUL: { city: 'Kuala Lumpur', country: 'Malaysia', countryCode: 'MY', latitude: 2.7456, longitude: 101.7099 },
  CGK: { city: 'Jakarta', country: 'Indonesia', countryCode: 'ID', latitude: -6.1256, longitude: 106.6558 },
  MNL: { city: 'Manila', country: 'Philippines', countryCode: 'PH', latitude: 14.5086, longitude: 121.0194 },
  HAN: { city: 'Hanoi', country: 'Vietnam', countryCode: 'VN', latitude: 21.2212, longitude: 105.8072 },
  SGN: { city: 'Ho Chi Minh City', country: 'Vietnam', countryCode: 'VN', latitude: 10.8188, longitude: 106.6520 },

  // Middle East
  DXB: { city: 'Dubai', country: 'United Arab Emirates', countryCode: 'AE', latitude: 25.2532, longitude: 55.3657 },
  DOH: { city: 'Doha', country: 'Qatar', countryCode: 'QA', latitude: 25.2609, longitude: 51.6138 },
  RUH: { city: 'Riyadh', country: 'Saudi Arabia', countryCode: 'SA', latitude: 24.9576, longitude: 46.6988 },
  TLV: { city: 'Tel Aviv', country: 'Israel', countryCode: 'IL', latitude: 32.0114, longitude: 34.8867 },

  // East Asia & Oceania
  HKG: { city: 'Hong Kong', country: 'Hong Kong', countryCode: 'HK', latitude: 22.3080, longitude: 113.9185 },
  NRT: { city: 'Tokyo', country: 'Japan', countryCode: 'JP', latitude: 35.7720, longitude: 140.3929 },
  ICN: { city: 'Seoul', country: 'South Korea', countryCode: 'KR', latitude: 37.4602, longitude: 126.4407 },
  TPE: { city: 'Taipei', country: 'Taiwan', countryCode: 'TW', latitude: 25.0777, longitude: 121.2328 },
  SYD: { city: 'Sydney', country: 'Australia', countryCode: 'AU', latitude: -33.9399, longitude: 151.1753 },
  MEL: { city: 'Melbourne', country: 'Australia', countryCode: 'AU', latitude: -37.6690, longitude: 144.8410 },
  AKL: { city: 'Auckland', country: 'New Zealand', countryCode: 'NZ', latitude: -37.0082, longitude: 174.7850 },

  // Europe
  LHR: { city: 'London', country: 'United Kingdom', countryCode: 'GB', latitude: 51.4700, longitude: -0.4543 },
  MAN: { city: 'Manchester', country: 'United Kingdom', countryCode: 'GB', latitude: 53.3654, longitude: -2.2725 },
  CDG: { city: 'Paris', country: 'France', countryCode: 'FR', latitude: 49.0097, longitude: 2.5479 },
  FRA: { city: 'Frankfurt', country: 'Germany', countryCode: 'DE', latitude: 50.0379, longitude: 8.5622 },
  AMS: { city: 'Amsterdam', country: 'Netherlands', countryCode: 'NL', latitude: 52.3105, longitude: 4.7683 },
  MAD: { city: 'Madrid', country: 'Spain', countryCode: 'ES', latitude: 40.4936, longitude: -3.5668 },
  MXP: { city: 'Milan', country: 'Italy', countryCode: 'IT', latitude: 45.6306, longitude: 8.7281 },
  ARN: { city: 'Stockholm', country: 'Sweden', countryCode: 'SE', latitude: 59.6519, longitude: 17.9186 },
  WAW: { city: 'Warsaw', country: 'Poland', countryCode: 'PL', latitude: 52.1657, longitude: 20.9671 },
  IST: { city: 'Istanbul', country: 'Turkey', countryCode: 'TR', latitude: 41.2753, longitude: 28.7519 },
  DUB: { city: 'Dublin', country: 'Ireland', countryCode: 'IE', latitude: 53.4213, longitude: -6.2701 },
  ZRH: { city: 'Zurich', country: 'Switzerland', countryCode: 'CH', latitude: 47.4647, longitude: 8.5492 },

  // Americas
  IAD: { city: 'Ashburn', country: 'United States', countryCode: 'US', latitude: 38.9445, longitude: -77.4558 },
  EWR: { city: 'Newark', country: 'United States', countryCode: 'US', latitude: 40.6895, longitude: -74.1745 },
  ORD: { city: 'Chicago', country: 'United States', countryCode: 'US', latitude: 41.9742, longitude: -87.9073 },
  DFW: { city: 'Dallas', country: 'United States', countryCode: 'US', latitude: 32.8998, longitude: -97.0403 },
  LAX: { city: 'Los Angeles', country: 'United States', countryCode: 'US', latitude: 33.9416, longitude: -118.4085 },
  SJC: { city: 'San Jose', country: 'United States', countryCode: 'US', latitude: 37.3639, longitude: -121.9289 },
  SEA: { city: 'Seattle', country: 'United States', countryCode: 'US', latitude: 47.4502, longitude: -122.3088 },
  MIA: { city: 'Miami', country: 'United States', countryCode: 'US', latitude: 25.7959, longitude: -80.2871 },
  ATL: { city: 'Atlanta', country: 'United States', countryCode: 'US', latitude: 33.6407, longitude: -84.4277 },
  YYZ: { city: 'Toronto', country: 'Canada', countryCode: 'CA', latitude: 43.6777, longitude: -79.6248 },
  GRU: { city: 'Sao Paulo', country: 'Brazil', countryCode: 'BR', latitude: -23.4356, longitude: -46.4731 },
  MEX: { city: 'Mexico City', country: 'Mexico', countryCode: 'MX', latitude: 19.4363, longitude: -99.0721 },
  SCL: { city: 'Santiago', country: 'Chile', countryCode: 'CL', latitude: -33.3930, longitude: -70.7858 },

  // Africa
  JNB: { city: 'Johannesburg', country: 'South Africa', countryCode: 'ZA', latitude: -26.1367, longitude: 28.2411 },
  CPT: { city: 'Cape Town', country: 'South Africa', countryCode: 'ZA', latitude: -33.9715, longitude: 18.6021 },
  LOS: { city: 'Lagos', country: 'Nigeria', countryCode: 'NG', latitude: 6.5774, longitude: 3.3212 },
  NBO: { city: 'Nairobi', country: 'Kenya', countryCode: 'KE', latitude: -1.3192, longitude: 36.9278 },
  CAI: { city: 'Cairo', country: 'Egypt', countryCode: 'EG', latitude: 30.1219, longitude: 31.4056 },
};

/** `a1ea4e419a9cff6d-BOM` → `BOM`. Null when the header is absent or malformed. */
export function parseColoCode(cfRay: string | null | undefined): string | null {
  if (!cfRay) return null;
  const code = cfRay.split('-').pop()?.trim().toUpperCase();
  return code && /^[A-Z]{3}$/.test(code) ? code : null;
}

/** Approximate location of a Cloudflare edge datacenter. Null if unrecognised. */
export function lookupColo(code: string | null): ColoLocation | null {
  return code ? COLOS[code] ?? null : null;
}
