import { Receipt, Calculator, Info } from 'lucide-react';

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const USAGE_LABEL = {
  RESIDENTIAL: 'Residential', COMMERCIAL: 'Commercial', PARKING: 'Parking', VACANT_LAND: 'Vacant land',
};

// Renders a computed tax breakdown so anyone can see exactly how it was derived.
// Shared by the admin review panel and the citizen tax page.
export default function TaxBreakdown({ breakdown }) {
  if (!breakdown) return null;
  const b = breakdown;

  return (
    <div className="space-y-5">
      {/* Headline */}
      <div className="rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900 p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-blue-600 dark:text-blue-400">Total Tax · {b.assessment_year}</p>
          <p className="text-3xl font-extrabold text-blue-700 dark:text-blue-300">{inr(b.total_annual)}</p>
        </div>
        <div className="text-right text-xs text-gray-500 dark:text-gray-400">
          <p>ARV: <span className="font-semibold text-gray-700 dark:text-gray-300">{inr(b.arv_total)}</span></p>
          <p className="mt-0.5">{b.property?.property_type}{b.property?.property_subtype ? ` / ${b.property.property_subtype}` : ''}</p>
          {b.property?.property_code && <p className="font-mono">{b.property.property_code}</p>}
        </div>
      </div>

      {/* Taxable spaces → ARV */}
      <div>
        <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
          <Calculator className="w-3.5 h-3.5" /> Rateable value (how ARV is built)
        </p>
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900/60 text-gray-500 dark:text-gray-400 text-[11px] uppercase">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Space</th>
                <th className="text-left px-3 py-2 font-medium">Use</th>
                <th className="text-right px-3 py-2 font-medium">Area m²</th>
                <th className="text-right px-3 py-2 font-medium">Rate/m²</th>
                <th className="text-right px-3 py-2 font-medium" title="Construction × Occupancy">C × O</th>
                <th className="text-right px-3 py-2 font-medium">MRV</th>
                <th className="text-right px-3 py-2 font-medium">ARV (×12)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {b.spaces?.map((s, i) => (
                <tr key={i}>
                  <td className="px-3 py-2 text-gray-800 dark:text-gray-200">{s.label}</td>
                  <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{USAGE_LABEL[s.usage] || s.usage}</td>
                  <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">{s.area_sqm}</td>
                  <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">{inr(s.base_rate)}</td>
                  <td className="px-3 py-2 text-right text-gray-500 dark:text-gray-400">{s.construction_factor}×{s.occupancy_factor}</td>
                  <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">{inr(s.mrv_monthly)}</td>
                  <td className="px-3 py-2 text-right font-medium text-gray-900 dark:text-gray-100">{inr(s.arv)}</td>
                </tr>
              ))}
              {!b.spaces?.length && (
                <tr><td colSpan={7} className="px-3 py-4 text-center text-gray-400 dark:text-gray-500">No taxable space captured.</td></tr>
              )}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 dark:bg-gray-900/60 font-semibold">
                <td colSpan={6} className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">Annual Rateable Value (ARV)</td>
                <td className="px-3 py-2 text-right text-gray-900 dark:text-gray-100">{inr(b.arv_total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Tax heads */}
      <div>
        <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
          <Receipt className="w-3.5 h-3.5" /> Tax heads (of ARV)
        </p>
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
          {b.heads?.map((h) => (
            <div key={h.key} className="px-3 py-2 flex items-center justify-between text-sm">
              <span className={h.applicable ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500 line-through'}>
                {h.label} <span className="text-xs text-gray-400 dark:text-gray-500">({(h.rate * 100).toFixed(1)}%)</span>
              </span>
              <span className={`font-medium ${h.applicable ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'}`}>
                {h.applicable ? inr(h.amount) : 'N/A'}
              </span>
            </div>
          ))}
          <div className="px-3 py-2 flex items-center justify-between text-sm">
            <span className="text-gray-700 dark:text-gray-300">Subtotal</span>
            <span className="font-medium text-gray-900 dark:text-gray-100">{inr(b.subtotal)}</span>
          </div>
          {b.rebate?.amount > 0 && (
            <div className="px-3 py-2 flex items-center justify-between text-sm">
              <span className="text-green-600 dark:text-green-400">Rebate — {b.rebate.reason} ({(b.rebate.rate * 100).toFixed(0)}%)</span>
              <span className="font-medium text-green-600 dark:text-green-400">− {inr(b.rebate.amount)}</span>
            </div>
          )}
          <div className="px-3 py-3 flex items-center justify-between bg-gray-50 dark:bg-gray-900/60">
            <span className="font-bold text-gray-900 dark:text-gray-100">Total Payable ({b.assessment_year})</span>
            <span className="text-lg font-extrabold text-blue-700 dark:text-blue-400">{inr(b.total_annual)}</span>
          </div>
        </div>
      </div>

      {b.notes?.length > 0 && (
        <div className="flex items-start gap-2 text-[11px] text-gray-400 dark:text-gray-500">
          <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <ul className="space-y-0.5">
            {b.notes.map((n, i) => <li key={i}>{n}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
