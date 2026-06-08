import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionFromCookieStore } from "@/shared/lib/auth/session";
import { processControlFiles } from "@/shared/lib/control-geometrico/processControl";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request) {
  const cookieStore = await cookies();
  const session = getSessionFromCookieStore(cookieStore);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const landXmlFile = formData.get("landXml");
    const terrainFile = formData.get("terrainCsv");

    if (!landXmlFile || typeof landXmlFile === "string") {
      return NextResponse.json({ error: "Archivo LandXML requerido (field: landXml)" }, { status: 400 });
    }
    if (!terrainFile || typeof terrainFile === "string") {
      return NextResponse.json({ error: "Archivo CSV/TXT requerido (field: terrainCsv)" }, { status: 400 });
    }

    const [landXmlText, terrainCsvText] = await Promise.all([
      landXmlFile.text(),
      terrainFile.text(),
    ]);

    const { results, warnings, hasVerticalProfile } = await processControlFiles({
      landXmlText,
      terrainCsvText,
    });

    return NextResponse.json(
      {
        ok: true,
        meta: {
          userEmail: session.email,
          landXmlName: landXmlFile.name,
          terrainName: terrainFile.name,
          count: results.length,
          hasVerticalProfile,
        },
        warnings: warnings ?? [],
        results,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("ERROR PROCESS CONTROL:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Error procesando control geometrico",
      },
      { status: 500 },
    );
  }
}
