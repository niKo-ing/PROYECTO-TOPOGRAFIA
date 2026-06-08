"use client";

import { useMemo, useState } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import {
  AreaChart,
  Area,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download, FileUp, FileSpreadsheet, Loader2 } from "lucide-react";
import { DashboardShell } from "@/features/dashboard/components/DashboardShell";

export function ControlGeometricoDashboard({ user }) {
  const [landXmlFile, setLandXmlFile] = useState(null);
  const [terrainFile, setTerrainFile] = useState(null);
  const [isXmlDragging, setIsXmlDragging] = useState(false);
  const [isTerrainDragging, setIsTerrainDragging] = useState(false);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [meta, setMeta] = useState(null);
  const [results, setResults] = useState([]);

  const chartData = useMemo(() => {
    return (results ?? []).map((row) => ({
      ...row,
      pkLabel: formatPk(row.pk),
    }));
  }, [results]);

  async function onProcess() {
    if (!landXmlFile || !terrainFile || status === "loading") return;

    setStatus("loading");
    setError("");
    setInfoMessage("");

    try {
      const formData = new FormData();
      formData.append("landXml", landXmlFile);
      formData.append("terrainCsv", terrainFile);

      const response = await fetch("/api/process-control", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error ?? `Error procesando control geometrico (HTTP ${response.status})`);
      }

      setMeta(payload?.meta ?? null);
      setResults(Array.isArray(payload?.results) ? payload.results : []);
      setInfoMessage(
        Array.isArray(payload?.warnings) && payload.warnings.length > 0 ? payload.warnings[0] : "",
      );
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "No se pudo procesar el control geometrico");
    }
  }

  function exportCsv() {
    if (!results.length) return;
    const lines = [
      ["Punto", "Pk", "Offset", "Cota Real", "Cota Diseno", "Delta H"].join(","),
      ...results.map((row) =>
        [
          escapeCsv(row.id),
          row.pk,
          row.offset,
          row.z_real,
          row.z_diseno,
          row.delta_h,
        ].join(","),
      ),
    ];

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    downloadBlob(blob, "Control_Geometrico_Resultados.csv");
  }

  async function exportarPDF() {
    const container = document.getElementById("reporte-graficos");
    if (!container || !results.length) return;

    const canvas = await html2canvas(container, {
      scale: 2,
      backgroundColor: "#0f172a",
      useCORS: true,
    });

    const imageData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 12;

    pdf.setFontSize(16);
    pdf.text("Reporte Control Geometrico de Obra", margin, 16);
    pdf.setFontSize(10);
    pdf.text(`Fecha: ${new Date().toLocaleString("es-CL")}`, margin, 23);
    if (meta?.landXmlName) pdf.text(`LandXML: ${meta.landXmlName}`, margin, 29);
    if (meta?.terrainName) pdf.text(`CSV/TXT: ${meta.terrainName}`, margin, 35);

    const imageWidth = pageWidth - margin * 2;
    const imageHeight = Math.min(120, (canvas.height * imageWidth) / canvas.width);
    pdf.addImage(imageData, "PNG", margin, 40, imageWidth, imageHeight);

    pdf.setFontSize(11);
    pdf.text("Muestra de resultados", margin, 40 + imageHeight + 10);
    pdf.setFontSize(9);

    const previewRows = results.slice(0, 8);
    let y = 40 + imageHeight + 16;
    previewRows.forEach((row) => {
      const line = `${row.id} | PK ${row.pk} | Off ${row.offset} | Zr ${row.z_real} | Zd ${row.z_diseno} | dH ${row.delta_h}`;
      if (y <= pageHeight - 10) {
        pdf.text(line, margin, y);
        y += 6;
      }
    });

    pdf.save("Reporte_Control_Geometrico.pdf");
  }

  return (
    <DashboardShell
      user={user}
      title="Control Geometrico de Obra"
      description="Cruza LandXML y puntos de terreno para calcular PK, offset, cota de diseno y delta H."
      maxWidth="max-w-[1500px]"
    >
      <section className="grid gap-6 xl:grid-cols-12">
        <div className="grid gap-6 xl:col-span-8 md:grid-cols-2">
          <FileDropCard
            title="LandXML de diseno"
            subtitle=".xml con Alignment y Profile"
            file={landXmlFile}
            accept=".xml,text/xml,application/xml"
            isDragging={isXmlDragging}
            setIsDragging={setIsXmlDragging}
            onFile={setLandXmlFile}
          />
          <FileDropCard
            title="Puntos de terreno"
            subtitle=".csv o .txt con ID, X, Y, Z"
            file={terrainFile}
            accept=".csv,.txt,text/csv,text/plain"
            isDragging={isTerrainDragging}
            setIsDragging={setIsTerrainDragging}
            onFile={setTerrainFile}
          />
        </div>

        <div className="xl:col-span-4">
          <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm transition-colors duration-300 dark:border-slate-700/50 dark:bg-slate-800">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300/80">
              Flujo
            </p>
            <h2 className="mt-2 text-lg font-semibold">Procesar Control Geometrico</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300/80">
              Calcula progresiva, offset, cota de diseno y delta H para cada punto del terreno.
            </p>

            <button
              type="button"
              onClick={onProcess}
              disabled={!landXmlFile || !terrainFile || status === "loading"}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
              Procesar Control Geometrico
            </button>

            <div className="mt-5 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
              <MetricCard label="Puntos" value={String(results.length)} />
              <MetricCard label="LandXML" value={landXmlFile ? "Cargado" : "Pendiente"} />
              <MetricCard label="CSV/TXT" value={terrainFile ? "Cargado" : "Pendiente"} />
            </div>
          </div>
        </div>
      </section>

      {infoMessage ? (
        <section className="rounded-2xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-200">
          {infoMessage}
        </section>
      ) : null}

      {error ? (
        <section className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </section>
      ) : null}

      {results.length ? (
        <>
          <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/70 bg-white px-5 py-4 shadow-sm transition-colors duration-300 dark:border-slate-700/50 dark:bg-slate-800">
            <div>
              <h2 className="text-sm font-semibold">Resultados calculados</h2>
              <p className="text-xs text-slate-600 dark:text-slate-300/80">
                {meta?.count ?? results.length} puntos procesados.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={exportCsv}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50 dark:border-slate-700/50 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700/40"
              >
                <Download className="h-4 w-4" />
                Exportar a CSV
              </button>
              <button
                type="button"
                onClick={exportarPDF}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-600/20 transition-colors hover:bg-emerald-500"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Generar Reporte PDF
              </button>
            </div>
          </section>

          <section
            id="reporte-graficos"
            className="grid gap-6 rounded-2xl border border-slate-200/70 bg-slate-950 p-5 shadow-sm transition-colors duration-300 dark:border-slate-700/50"
          >
            <ChartCard title="Grafico 1: Planta (PK vs Offset)">
              <ResponsiveContainer width="100%" height={280}>
                <ScatterChart syncId="pk-sync">
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="pk" name="PK" stroke="#cbd5e1" />
                  <YAxis dataKey="offset" name="Offset" stroke="#cbd5e1" />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Scatter data={chartData} fill="#38bdf8" />
                </ScatterChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Grafico 2: Perfil (PK vs Cota Real / Cota Diseno)">
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chartData} syncId="pk-sync">
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="pk" stroke="#cbd5e1" />
                  <YAxis stroke="#cbd5e1" />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend />
                  <Line type="monotone" dataKey="z_real" name="Cota Real" stroke="#38bdf8" dot={false} strokeWidth={2} />
                  {meta?.hasVerticalProfile ? (
                    <Line type="monotone" dataKey="z_diseno" name="Cota Diseno" stroke="#22c55e" dot={false} strokeWidth={2} />
                  ) : null}
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Grafico 3: Control de Nivelacion (PK vs Delta H)">
              {meta?.hasVerticalProfile ? (
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={chartData} syncId="pk-sync">
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="pk" stroke="#cbd5e1" />
                    <YAxis stroke="#cbd5e1" />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Area type="monotone" dataKey="delta_h" name="Delta H" stroke="#f59e0b" fill="#f59e0b33" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-[280px] items-center justify-center rounded-xl border border-slate-800 bg-slate-950/60 px-6 text-center text-sm text-slate-400">
                  No hay perfil vertical en el LandXML. Delta H no esta disponible para este archivo.
                </div>
              )}
            </ChartCard>
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm transition-colors duration-300 dark:border-slate-700/50 dark:bg-slate-800">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-600 transition-colors duration-300 dark:bg-slate-900/40 dark:text-slate-300/80">
                  <tr>
                    <th className="px-4 py-3">Punto</th>
                    <th className="px-4 py-3">X</th>
                    <th className="px-4 py-3">Y</th>
                    <th className="px-4 py-3">Cota Real</th>
                    <th className="px-4 py-3">PK</th>
                    <th className="px-4 py-3">Offset</th>
                    <th className="px-4 py-3">Cota Diseno</th>
                    <th className="px-4 py-3">Delta H</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 transition-colors duration-300 dark:divide-slate-700/50">
                  {results.map((row) => (
                    <tr key={`${row.id}-${row.pk}`}>
                      <td className="px-4 py-3 font-semibold">{row.id}</td>
                      <td className="px-4 py-3">{row.x}</td>
                      <td className="px-4 py-3">{row.y}</td>
                      <td className="px-4 py-3">{row.z_real}</td>
                      <td className="px-4 py-3">{formatPk(row.pk)}</td>
                      <td className="px-4 py-3">{row.offset}</td>
                      <td className="px-4 py-3">{row.z_diseno ?? "-"}</td>
                      <td className={`px-4 py-3 font-semibold ${row.delta_h === null ? "text-slate-400" : row.delta_h >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                        {row.delta_h ?? "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </DashboardShell>
  );
}

function FileDropCard({ title, subtitle, file, accept, isDragging, setIsDragging, onFile }) {
  return (
    <label className="block">
      <input
        type="file"
        accept={accept}
        className="hidden"
        onChange={(event) => {
          const nextFile = event.target.files?.[0];
          if (!nextFile) return;
          onFile(nextFile);
          event.target.value = "";
        }}
      />
      <div
        className={[
          "rounded-2xl border-2 border-dashed p-6 transition-all duration-200",
          isDragging
            ? "border-blue-500 bg-blue-600/10 scale-[1.01]"
            : "border-slate-700/50 bg-slate-900/40 hover:border-blue-400/70 hover:bg-blue-500/10",
          "cursor-pointer",
        ].join(" ")}
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setIsDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          const nextFile = event.dataTransfer?.files?.[0];
          if (nextFile) onFile(nextFile);
        }}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-800 text-slate-100">
            <FileUp className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">{title}</h2>
            <p className="text-sm text-slate-400">{subtitle}</p>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950 px-4 py-5">
          <p className="text-sm font-medium text-slate-100">
            {file ? file.name : "Arrastra el archivo aqui o haz clic para seleccionarlo"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {file ? `${Math.round(file.size / 1024)} KB` : "Solo se procesa un archivo por tipo a la vez."}
          </p>
        </div>
      </div>
    </label>
  );
}

function MetricCard({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200/70 bg-slate-50 px-4 py-3 transition-colors duration-300 dark:border-slate-700/50 dark:bg-slate-900/40">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300/80">
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold">{value}</p>
    </div>
  );
}

function ChartCard({ title, children }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-100">{title}</h3>
      {children}
    </div>
  );
}

function formatPk(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "-";
  return num.toFixed(3);
}

function escapeCsv(value) {
  const text = String(value ?? "");
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replace(/"/g, "\"\"")}"`;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

const tooltipStyle = {
  backgroundColor: "#0f172a",
  border: "1px solid #334155",
  borderRadius: "12px",
  color: "#e2e8f0",
};
