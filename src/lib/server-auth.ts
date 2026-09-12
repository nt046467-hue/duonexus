import { adminAuth } from "@/lib/firebase-admin";

export interface AuthenticatedUser {
  uid: "nabin" | "karu";
  role: "nabin" | "karu";
  name: string;
  partnerId: "nabin" | "karu";
  partnerName: string;
}

/**
 * Validates Firebase ID token from the Authorization header.
 * Strict check: UID must be either "nabin" or "karu".
 */
export async function verifyServerAuth(req: Request): Promise<AuthenticatedUser | null> {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return null;
    }

    const idToken = authHeader.substring(7).trim();
    if (!idToken) return null;

    const decoded = await adminAuth.verifyIdToken(idToken);
    const uid = decoded.uid;

    if (uid !== "nabin" && uid !== "karu") {
      console.warn(`[verifyServerAuth] Unauthorized UID attempted server access: ${uid}`);
      return null;
    }

    const isNabin = uid === "nabin";
    return {
      uid: isNabin ? "nabin" : "karu",
      role: isNabin ? "nabin" : "karu",
      name: isNabin ? "Nabin" : "Karu",
      partnerId: isNabin ? "karu" : "nabin",
      partnerName: isNabin ? "Karu" : "Nabin",
    };
  } catch (err) {
    console.warn("[verifyServerAuth] Token verification failed:", err);
    return null;
  }
}
