import "server-only";
import { getPublicEventInfo, type PublicEventInfo } from "@/lib/services/event";

/**
 * Landing-page variant that never throws: if the database is unreachable the
 * page still renders, with registration shown as not yet available.
 */
export async function getPublicEventInfoSafe(): Promise<PublicEventInfo> {
  try {
    return await getPublicEventInfo();
  } catch (err) {
    console.error("[public-info] falling back:", (err as Error).message);
    return {
      availability: { state: "not_configured" },
      feeKobo: null,
      feeCovers: null,
      refundPolicy: null,
      minimumAge: null,
      guardianConsentAge: 18,
    };
  }
}
