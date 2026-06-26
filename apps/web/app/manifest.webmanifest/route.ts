import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    name: "BakersMania CRM",
    short_name: "BakersMania",
    description: "Bakery CRM and operations PWA.",
    start_url: "/bakery",
    scope: "/",
    display: "standalone",
    background_color: "#f7f4ef",
    theme_color: "#2f7d6f",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" }
    ]
  });
}
