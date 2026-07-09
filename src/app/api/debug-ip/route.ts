import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const headers = Object.fromEntries(req.headers.entries());

  return Response.json(
    {
      // The values that matter most
      detectedIp:
        req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
        req.headers.get("x-real-ip") ||
        "not found",

      "x-forwarded-for": req.headers.get("x-forwarded-for"),
      "x-real-ip": req.headers.get("x-real-ip"),
      "cf-connecting-ip": req.headers.get("cf-connecting-ip"),
      "x-forwarded-proto": req.headers.get("x-forwarded-proto"),
      "x-forwarded-host": req.headers.get("x-forwarded-host"),

      // Full dump so nothing is hidden
      allHeaders: headers,
    },
    { status: 200 }
  );
}