"use client";

import React, { useState, useMemo, useCallback } from "react";
import { useI18n } from "@/providers/I18nProvider";

interface ConversionRecord {
  date: number;
  direction: string;
  jpyAmount: number;
  usdcAmount: number;
  rate: number;
  fee: number;
  status: string;
}

interface ConversionTableProps {
  records: ConversionRecord[];
}

function StatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    completed: "bg-emerald-500/15 text-emerald-400",
    pending: "bg-amber-500/15 text-amber-400",
    failed: "bg-red-500/15 text-red-400",
    processing: "bg-blue-500/15 text-blue-400",
  };
  const cls = colorMap[status.toLowerCase()] ?? "bg-slate-700 text-slate-400";

  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${cls}`}>
      {status}
    </span>
  );
}

export function ConversionTable({ records }: ConversionTableProps) {
  const { t } = useI18n();
  const [directionFilter, setDirectionFilter] = useState<string>("all");

  const directions = useMemo(() => {
    const set = new Set(records.map((r) => r.direction));
    return ["all", ...Array.from(set)];
  }, [records]);

  const filteredRecords = useMemo(() => {
    if (directionFilter === "all") return records;
    return records.filter((r) => r.direction === directionFilter);
  }, [records, directionFilter]);

  const formatDate = (ts: number) => {
    return new Date(ts).toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const exportCsv = useCallback(() => {
    const header = "Date,Direction,JPY Amount,USDC Amount,Rate,Fee,Status";
    const rows = filteredRecords.map((r) =>
      [
        formatDate(r.date),
        r.direction,
        r.jpyAmount,
        r.usdcAmount,
        r.rate,
        r.fee,
        r.status,
      ].join(",")
    );
    const csv = [header, ...rows].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `exodus_conversions_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [filteredRecords]);

  return (
    <div className="rounded-2xl border border-slate-700 bg-[#0a1628] p-6 shadow-xl">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-bold text-amber-400">
          {t("history.conversionsTitle", "Conversion History")}
        </h2>
        <div className="flex items-center gap-3">
          {/* Direction Filter */}
          <select
            value={directionFilter}
            onChange={(e) => setDirectionFilter(e.target.value)}
            className="rounded-lg border border-slate-700 bg-[#0d1d35] px-3 py-2 text-sm text-slate-200 outline-none focus:border-amber-500"
          >
            {directions.map((dir) => (
              <option key={dir} value={dir}>
                {dir === "all"
                  ? t("history.allDirections", "All Directions")
                  : dir}
              </option>
            ))}
          </select>

          {/* Export CSV */}
          <button
            type="button"
            onClick={exportCsv}
            className="rounded-lg border border-slate-600 bg-transparent px-4 py-2 text-sm font-semibold text-slate-300 transition-all hover:border-amber-500 hover:text-amber-400"
          >
            {t("history.exportCsv", "Export CSV")}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700 bg-[#0d1d35]">
              <th className="px-4 py-3 text-left font-medium text-slate-400">
                {t("history.date", "Date")}
              </th>
              <th className="px-4 py-3 text-left font-medium text-slate-400">
                {t("history.direction", "Direction")}
              </th>
              <th className="px-4 py-3 text-right font-medium text-slate-400">
                {t("history.jpyAmount", "JPY Amount")}
              </th>
              <th className="px-4 py-3 text-right font-medium text-slate-400">
                {t("history.usdcAmount", "USDC Amount")}
              </th>
              <th className="px-4 py-3 text-right font-medium text-slate-400">
                {t("history.rate", "Rate")}
              </th>
              <th className="px-4 py-3 text-right font-medium text-slate-400">
                {t("history.fee", "Fee")}
              </th>
              <th className="px-4 py-3 text-center font-medium text-slate-400">
                {t("history.status", "Status")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {filteredRecords.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-slate-500"
                >
                  {t("history.noRecords", "No conversion records found.")}
                </td>
              </tr>
            ) : (
              filteredRecords.map((record, idx) => (
                <tr
                  key={idx}
                  className="bg-[#0a1628] transition-colors hover:bg-[#0d1d35]"
                >
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-slate-300">
                    {formatDate(record.date)}
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    {record.direction}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-slate-200">
                    {record.jpyAmount.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-slate-200">
                    {record.usdcAmount.toFixed(4)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-slate-200">
                    {record.rate.toFixed(4)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-slate-200">
                    {record.fee.toFixed(4)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <StatusBadge status={record.status} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Record Count */}
      <p className="mt-3 text-xs text-slate-500">
        {t("history.showing", "Showing")} {filteredRecords.length}{" "}
        {t("history.of", "of")} {records.length}{" "}
        {t("history.records", "records")}
      </p>
    </div>
  );
}
