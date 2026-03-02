import com.github.tomakehurst.wiremock.extension.TemplateHelperProviderExtension;
import wiremock.com.github.jknack.handlebars.Helper;
import wiremock.com.github.jknack.handlebars.Options;

import java.io.IOException;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/**
 * WireMock extension that provides a {{geo}} Handlebars helper for
 * location-based product pricing.
 *
 * The helper determines a region from lat/lng coordinates, applies a
 * geo-discount, and returns the requested field.
 *
 * Usage in response templates:
 *   {{geo request.query.lat request.query.lng field='price'  basePrice=99.99}}
 *   {{geo request.query.lat request.query.lng field='region'}}
 *   {{geo request.query.lat request.query.lng field='discount'}}
 *
 * Regions and discounts:
 *   Europe        15%    (Amsterdam 52.37/4.90, Berlin 52.52/13.40)
 *   Asia          20%    (Tokyo 35.68/139.69, Singapore 1.35/103.82)
 *   South America 30%    (São Paulo -23.55/-46.63)
 *   North America  5%    (New York 40.71/-74.01, San Francisco 37.77/-122.42)
 *   Oceania       18%    (Sydney -33.87/151.21)
 *   Africa        25%    (Cape Town -33.92/18.42)
 *   Unknown        0%    (fallback)
 */
public class GeoDiscountExtension implements TemplateHelperProviderExtension {

    @Override
    public String getName() {
        return "geo-discount";
    }

    @Override
    public Map<String, Helper<?>> provideTemplateHelpers() {
        Map<String, Helper<?>> helpers = new HashMap<>();
        helpers.put("geo", new GeoHelper());
        return helpers;
    }

    // ── inner helper ────────────────────────────────────────────────

    static class GeoHelper implements Helper<Object> {

        @Override
        public Object apply(Object context, Options options) throws IOException {
            double lat = toDouble(context);
            double lng = toDouble(options.params.length > 0 ? options.param(0) : null);
            String field = options.hash("field", "price");

            Region region = Region.detect(lat, lng);

            switch (field) {
                case "region":
                    return region.label;
                case "discount":
                    return String.valueOf((int) (region.discount * 100));
                case "price":
                default:
                    double basePrice = toDouble(options.hash("basePrice", "99.99"));
                    double finalPrice = basePrice * (1.0 - region.discount);
                    return String.format(Locale.US, "%.2f", finalPrice);
            }
        }

        private static double toDouble(Object v) {
            if (v == null) return 0.0;
            try { return Double.parseDouble(v.toString().trim()); }
            catch (NumberFormatException e) { return 0.0; }
        }
    }

    // ── region lookup ───────────────────────────────────────────────

    enum Region {
        EUROPE       ("Europe",        0.15,  35,  72, -12,  40),
        ASIA         ("Asia",          0.20, -10,  60,  60, 150),
        SOUTH_AMERICA("South America", 0.30, -56,  15, -82, -34),
        NORTH_AMERICA("North America", 0.05,  15,  72,-170, -50),
        OCEANIA      ("Oceania",       0.18, -50,  -8, 110, 180),
        AFRICA       ("Africa",        0.25, -35,  38, -20,  55),
        UNKNOWN      ("Unknown",       0.00, 0,0,0,0);

        final String label;
        final double discount;
        final double latMin, latMax, lngMin, lngMax;

        Region(String label, double discount,
               double latMin, double latMax, double lngMin, double lngMax) {
            this.label    = label;
            this.discount = discount;
            this.latMin   = latMin;
            this.latMax   = latMax;
            this.lngMin   = lngMin;
            this.lngMax   = lngMax;
        }

        boolean contains(double lat, double lng) {
            return lat >= latMin && lat <= latMax
                && lng >= lngMin && lng <= lngMax;
        }

        static Region detect(double lat, double lng) {
            for (Region r : values()) {
                if (r == UNKNOWN) continue;
                if (r.contains(lat, lng)) return r;
            }
            return UNKNOWN;
        }
    }
}
