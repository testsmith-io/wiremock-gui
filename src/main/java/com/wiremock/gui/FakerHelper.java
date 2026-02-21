package com.wiremock.gui;

import net.datafaker.Faker;
import com.github.jknack.handlebars.Helper;
import com.github.jknack.handlebars.Options;

import java.io.IOException;
import java.util.Locale;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Handlebars template helper that generates fake data using DataFaker.
 *
 * Usage in WireMock response templates:
 *   {{random 'Name.firstName'}}
 *   {{random 'Internet.emailAddress'}}
 *   {{random 'Address.city'}}
 *   {{random 'NL.bsn'}}
 *
 * Supports an optional locale hash parameter:
 *   {{random 'Name.firstName' locale='nl'}}
 */
public class FakerHelper implements Helper<Object> {

    private static final Faker DEFAULT_FAKER = new Faker(Locale.US);

    @Override
    public Object apply(Object context, Options options) throws IOException {
        String expression;
        if (context instanceof String) {
            expression = (String) context;
        } else if (options.params.length > 0) {
            expression = options.param(0).toString();
        } else {
            return "";
        }

        // Handle custom expressions not available in DataFaker's expression API
        if (expression.equalsIgnoreCase("NL.bsn")) {
            return generateDutchBsn();
        }

        try {
            String localeStr = options.hash("locale");
            Faker faker = (localeStr != null)
                    ? new Faker(Locale.forLanguageTag(localeStr))
                    : DEFAULT_FAKER;

            return faker.expression("#{" + expression + "}");
        } catch (Exception e) {
            return "";
        }
    }

    /**
     * Generates a valid Dutch BSN (Burgerservicenummer).
     * A BSN is a 9-digit number that passes the "11-proof" check:
     * (9*d1 + 8*d2 + 7*d3 + 6*d4 + 5*d5 + 4*d6 + 3*d7 + 2*d8 - 1*d9) % 11 == 0
     * and the result must not be 0 unless all digits are 0.
     */
    private static String generateDutchBsn() {
        ThreadLocalRandom rng = ThreadLocalRandom.current();
        while (true) {
            int[] d = new int[9];
            // First digit 1-9 to avoid leading zeros
            d[0] = rng.nextInt(1, 10);
            for (int i = 1; i < 8; i++) {
                d[i] = rng.nextInt(0, 10);
            }
            // Calculate d[8] to satisfy the 11-proof check
            int sum = 0;
            for (int i = 0; i < 8; i++) {
                sum += (9 - i) * d[i];
            }
            // We need (sum - d[8]) % 11 == 0, so d[8] = sum % 11
            int check = sum % 11;
            if (check <= 9) {
                d[8] = check;
                StringBuilder sb = new StringBuilder(9);
                for (int digit : d) {
                    sb.append(digit);
                }
                return sb.toString();
            }
            // If check == 10, no valid single digit exists, retry
        }
    }
}
