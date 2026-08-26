// Single source of truth for public location and contact details.
export const SITE_URL = "https://cafe1luton.co.uk";
export const CONTACT_EMAIL = "info@cafe1luton.co.uk";
export const CONTACT_TELEPHONE = "+44 1582 484802";

export const LOCATIONS = [
  {
    id: "luton-crown-court",
    siteCode: "LUTON_CROWN_COURT",
    name: "Café 1 Luton Crown Court",
    shortName: "Luton Crown Court",
    legalName: "Café 1 (UK) Ltd",
    url: SITE_URL,
    email: CONTACT_EMAIL,
    telephone: CONTACT_TELEPHONE,
    streetAddress: "Crown Court, 7–9 George Street",
    addressLocality: "Luton",
    addressRegion: "Bedfordshire",
    postalCode: "LU1 2AA",
    addressCountry: "GB",
    latitude: 51.878105,
    longitude: -0.41412,
    hoursLabel: "Monday–Friday · 9:00–17:00",
    openingHours: [
      {
        days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        opens: "09:00",
        closes: "17:00",
      },
    ],
  },
  {
    id: "futures-house",
    siteCode: "FUTURES_HOUSE",
    name: "Café 1 Futures House",
    shortName: "Futures House, Marsh Farm",
    legalName: "Café 1 (UK) Ltd",
    url: SITE_URL,
    email: CONTACT_EMAIL,
    telephone: CONTACT_TELEPHONE,
    streetAddress: "Futures House, The Moakes, Marsh Farm",
    addressLocality: "Luton",
    addressRegion: "Bedfordshire",
    postalCode: "LU3 3QB",
    addressCountry: "GB",
    latitude: 51.918627,
    longitude: -0.454438,
    hoursLabel: "Monday–Friday · 9:00–17:00 · Saturday–Sunday · 10:00–18:00",
    openingHours: [
      {
        days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        opens: "09:00",
        closes: "17:00",
      },
      { days: ["Saturday", "Sunday"], opens: "10:00", closes: "18:00" },
    ],
  },
] as const;

export type CafeLocationId = (typeof LOCATIONS)[number]["id"];

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

/** Browser-safe branch hours for ordering and live open/closed calculations. */
export function orderingHoursForLocation(id: CafeLocationId) {
  const location = locationById(id);
  return WEEKDAYS.map((day, day_of_week) => {
    const period = location.openingHours.find((entry) =>
      (entry.days as readonly string[]).includes(day),
    );
    return {
      day_of_week,
      open_time: period?.opens ?? "00:00",
      close_time: period?.closes ?? "00:00",
      closed: !period,
    };
  });
}

// Backwards-compatible primary NAP used by existing components.
export const NAP = {
  ...LOCATIONS[0],
  priceRange: "££",
  cuisines: ["Coffee", "Breakfast", "British", "Halal", "Desi", "Sandwiches"],
  openTime: "09:00",
  closeTime: "17:00",
  weekdays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
} as const;

export function locationById(id: CafeLocationId | undefined) {
  return LOCATIONS.find((location) => location.id === id) ?? LOCATIONS[0];
}

export function localBusinessJsonLd(image: string) {
  return {
    "@context": "https://schema.org",
    "@graph": LOCATIONS.map((location) => ({
      "@type": "Restaurant",
      "@id": `${SITE_URL}/#${location.id}`,
      name: location.name,
      legalName: location.legalName,
      url: SITE_URL,
      image,
      logo: `${SITE_URL}/icon-512.png`,
      email: location.email,
      telephone: location.telephone,
      description:
        "Café 1 is a 100% halal Luton café serving coffee, all-day breakfasts, British classics and Desi favourites for dine-in and takeaway.",
      servesCuisine: [...NAP.cuisines],
      priceRange: NAP.priceRange,
      currenciesAccepted: "GBP",
      paymentAccepted: "Cash, Credit Card, Debit Card",
      hasMenu: `${SITE_URL}/menu`,
      acceptsReservations: false,
      publicAccess: true,
      smokingAllowed: false,
      sameAs: [
        "https://www.facebook.com/Cafe1luton",
        "https://www.instagram.com/cafe1luton/",
        "https://www.tiktok.com/@cafe1.luton",
      ],
      hasMap:
        "https://www.google.com/maps/search/?api=1&query=" +
        encodeURIComponent(`${location.name}, ${location.postalCode}`),
      address: {
        "@type": "PostalAddress",
        streetAddress: location.streetAddress,
        addressLocality: location.addressLocality,
        addressRegion: location.addressRegion,
        postalCode: location.postalCode,
        addressCountry: location.addressCountry,
      },
      geo: {
        "@type": "GeoCoordinates",
        latitude: location.latitude,
        longitude: location.longitude,
      },
      openingHoursSpecification: location.openingHours.map((hours) => ({
        "@type": "OpeningHoursSpecification",
        dayOfWeek: [...hours.days],
        opens: hours.opens,
        closes: hours.closes,
      })),
      potentialAction: {
        "@type": "OrderAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${SITE_URL}/menu`,
          inLanguage: "en-GB",
          actionPlatform: [
            "http://schema.org/DesktopWebPlatform",
            "http://schema.org/IOSPlatform",
            "http://schema.org/AndroidPlatform",
          ],
        },
        deliveryMethod: "http://purl.org/goodrelations/v1#DeliveryModePickUp",
      },
    })),
  };
}
