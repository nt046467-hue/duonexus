import { POST as verifyPinPOST } from "@/app/api/verify-pin/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// HTTPS API endpoint for session token minting via PIN verification
export const POST = verifyPinPOST;
