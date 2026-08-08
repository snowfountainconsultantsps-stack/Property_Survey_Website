import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2, ChevronRight, ChevronDown, Search, X, RefreshCw,
  Map as MapIcon, Network, CornerDownLeft,
} from 'lucide-react';
import { useGetLocationTreeQuery } from '../store/api/locationApi';
import Spinner from '../components/Spinner';

// Read-only mindmap of the administrative hierarchy:
//   State → District → [ULB, City] → [Zone] → Ward → Locality
// Nothing is created or edited here — rows are published from the Boundaries
// page (shapefile import), which owns the geometry, so letting this page write
// rows by hand would fork the data.
//
// The tree branches, so ancestry (not column order) drives the layout: City
// hangs off District as a purely geographic label, while the ULB is the
// operational parent that owns zones and wards, and a ward sits directly under
// its ULB when that ULB has no zones.
const LEVELS = {
  root: {
    label: 'Hierarchy', plural: 'Top level', nameField: null, codeField: null,
    accent: 'bg-gray-800 dark:bg-gray-300',
    chip: 'bg-gray-800 text-white dark:bg-gray-200 dark:text-gray-900',
  },
  states: {
    label: 'State', plural: 'States', nameField: 'name', codeField: 'code',
    accent: 'bg-indigo-500',
    chip: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300',
  },
  districts: {
    label: 'District', plural: 'Districts', nameField: 'name', codeField: 'code',
    accent: 'bg-violet-500',
    chip: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
  },
  ulbs: {
    label: 'ULB', plural: 'ULBs', nameField: 'name', codeField: 'code',
    accent: 'bg-blue-500',
    chip: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  },
  cities: {
    label: 'City', plural: 'Cities', nameField: 'name', codeField: 'code',
    accent: 'bg-teal-500',
    chip: 'bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300',
  },
  zones: {
    label: 'Zone', plural: 'Zones', nameField: 'name', codeField: 'code',
    accent: 'bg-amber-500',
    chip: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  },
  wards: {
    label: 'Ward', plural: 'Wards', nameField: 'ward_name', codeField: 'ward_number',
    accent: 'bg-emerald-500',
    chip: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  },
  localities: {
    label: 'Locality', plural: 'Localities', nameField: 'name', codeField: 'code',
    accent: 'bg-rose-500',
    chip: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
  },
};

const LEGEND = ['states', 'districts', 'ulbs', 'cities', 'zones', 'wards', 'localities'];

// One open list at a time, so the map is a single path across the screen: a
// 75-name list never has to sit inside another 75-name list, which is what
// stacked the scrollbars and left the parent card floating in dead space.
const LIST_MAX_H = 320;
const PAGE_SIZE = 200;
const MAX_RESULTS = 60;

const groupBy = (rows, key) => {
  const map = new Map();
  for (const row of rows) {
    if (row[key] == null) continue;
    const k = String(row[key]);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(row);
  }
  return map;
};

const makeNode = (levelKey, row, children = []) => {
  const lvl = LEVELS[levelKey];
  const name = row[lvl.nameField] ?? '(unnamed)';
  const code = row[lvl.codeField] ?? null;
  return {
    key: `${levelKey}:${row.id}`,
    levelKey,
    name: String(name),
    code: code == null ? null : String(code),
    children,
    // Precomputed so search doesn't rebuild strings on every keystroke.
    search: `${name} ${code ?? ''}`.toLowerCase(),
  };
};

// Anything whose parent is missing — a bad import link — so the map never
// silently loses a row.
const makeOrphanNode = (levelKey, rows) => ({
  key: `orphan:${levelKey}`,
  levelKey,
  name: `${LEVELS[levelKey].plural} without a parent`,
  code: null,
  orphanBucket: true,
  children: rows.map((r) => makeNode(levelKey, r)),
  search: `${LEVELS[levelKey].plural} unlinked orphan`.toLowerCase(),
});

function NodeCard({ node, open, hasKids, count, onClick, highlight }) {
  const lvl = LEVELS[node.levelKey];
  const Chevron = open ? ChevronDown : ChevronRight;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-stretch rounded-lg border bg-white dark:bg-gray-800 shadow-sm whitespace-nowrap text-left transition
        ${highlight
          ? 'border-blue-400 dark:border-blue-500 ring-1 ring-blue-300 dark:ring-blue-700'
          : 'border-gray-200 dark:border-gray-700'}
        ${onClick ? 'hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 cursor-pointer' : 'cursor-default'}`}
    >
      <span className={`w-1.5 rounded-l-lg ${lvl.accent}`} />
      <span className="flex items-center gap-2 pl-2.5 pr-3 py-1.5">
        <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${lvl.chip}`}>
          {node.orphanBucket ? 'Unlinked' : lvl.label}
        </span>
        <span className="text-sm font-medium text-gray-800 dark:text-gray-100">{node.name}</span>
        {node.code && (
          <span className="text-xs font-mono text-gray-400 dark:text-gray-500">{node.code}</span>
        )}
        {count > 0 && (
          <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded-full px-1.5 min-w-[20px] text-center">
            {count}
          </span>
        )}
        {hasKids && <Chevron className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />}
      </span>
    </button>
  );
}

// One node of the open path: its card, then the branch it leads to. The branch
// is either the full list of its children (this node is the tip of the path)
// or the single child that was picked, which keeps the whole map one level
// tall per step instead of nesting lists inside lists.
function Branch({ depth, path, byKey, onPick, onCollapse }) {
  const [limit, setLimit] = useState(PAGE_SIZE);

  const node = byKey.get(path[depth]);
  if (!node) return null;

  const kids = node.children;
  const nextKey = path[depth + 1];
  const drilled = nextKey != null;

  const heading = [...new Set(kids.map((k) => LEVELS[k.levelKey].plural))].join(' · ');
  const slice = kids.slice(0, limit);

  return (
    <div className="flex items-center">
      <NodeCard
        node={node}
        open={kids.length > 0}
        hasKids={kids.length > 0}
        count={kids.length}
        highlight={depth > 0}
        // Clicking a node already on the path steps back out of it.
        onClick={depth > 0 ? () => onCollapse(depth) : undefined}
      />

      {kids.length > 0 && (
        <>
          <span className="w-6 h-px bg-gray-300 dark:bg-gray-600 flex-shrink-0" />
          <div className="w-max rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 shadow-sm">
            <div className="flex items-center gap-2 px-2.5 py-1.5 border-b border-gray-200 dark:border-gray-700">
              <span className="text-[11px] font-semibold text-gray-600 dark:text-gray-300 whitespace-nowrap">
                {heading}
              </span>
              <span className="text-[11px] text-gray-400 dark:text-gray-500 whitespace-nowrap">
                {drilled ? `1 of ${kids.length}` : kids.length}
              </span>
              {drilled && (
                <button
                  onClick={() => onCollapse(depth + 1)}
                  className="ml-auto text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
                >
                  Show all {kids.length}
                </button>
              )}
            </div>

            {drilled ? (
              // Only the picked child, so this level adds one row — no second
              // scrollbar, no tall empty column beside the parent card.
              <div className="p-1">
                <Branch depth={depth + 1} path={path} byKey={byKey} onPick={onPick} onCollapse={onCollapse} />
              </div>
            ) : (
              <div
                className="w-max overflow-y-auto overscroll-contain p-1"
                style={{ maxHeight: LIST_MAX_H, scrollbarWidth: 'thin' }}
              >
                {slice.map((kid) => (
                  <div key={kid.key} className="py-0.5 pr-1">
                    <NodeCard
                      node={kid}
                      open={false}
                      hasKids={kid.children.length > 0}
                      count={kid.children.length}
                      onClick={() => onPick(depth, kid.key)}
                    />
                  </div>
                ))}
                {kids.length > slice.length && (
                  <button
                    onClick={() => setLimit((n) => n + PAGE_SIZE)}
                    className="w-full mt-1 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded"
                  >
                    Show {Math.min(PAGE_SIZE, kids.length - slice.length)} more of {kids.length}
                  </button>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function LocationManagerPage() {
  const { data, isLoading, isError, isFetching, refetch } = useGetLocationTreeQuery();
  // Keys from the root down to whatever is open. path[0] is always the root,
  // and the last entry is the level currently listing all of its names.
  const [path, setPath] = useState(['root']);
  const [query, setQuery] = useState('');

  const tree = data?.data;

  const { byKey, parentOf, flat, counts, isEmpty } = useMemo(() => {
    const t = tree || {};
    // Every published row is on the map — the hierarchy is shown as it exists.
    const states = t.states || [];
    const districts = t.districts || [];
    const cities = t.cities || [];
    const ulbs = t.ulbs || [];
    const zones = t.zones || [];
    const wards = t.wards || [];
    const localities = t.localities || [];

    const districtsByState = groupBy(districts, 'state_id');
    const citiesByDistrict = groupBy(cities, 'district_id');
    const ulbsByDistrict = groupBy(ulbs, 'district_id');
    const zonesByUlb = groupBy(zones, 'ulb_id');
    const wardsByUlb = groupBy(wards, 'ulb_id');
    const wardsByZone = groupBy(wards, 'zone_id');
    const localitiesByWard = groupBy(localities, 'ward_id');

    const zoneIds = new Set(zones.map((z) => String(z.id)));
    // A ward with a zone_id belongs under that zone; one without (or pointing
    // at a zone that isn't here) hangs directly off its ULB.
    const wardHasZone = (w) => w.zone_id != null && zoneIds.has(String(w.zone_id));

    const wardNode = (w) =>
      makeNode('wards', w, (localitiesByWard.get(String(w.id)) || []).map((l) => makeNode('localities', l)));

    const zoneNode = (z) =>
      makeNode('zones', z, (wardsByZone.get(String(z.id)) || []).filter(wardHasZone).map(wardNode));

    const ulbNode = (u) =>
      makeNode('ulbs', u, [
        ...(zonesByUlb.get(String(u.id)) || []).map(zoneNode),
        ...(wardsByUlb.get(String(u.id)) || []).filter((w) => !wardHasZone(w)).map(wardNode),
      ]);

    const districtNode = (d) =>
      makeNode('districts', d, [
        ...(ulbsByDistrict.get(String(d.id)) || []).map(ulbNode),
        ...(citiesByDistrict.get(String(d.id)) || []).map((c) => makeNode('cities', c)),
      ]);

    const stateNodes = states.map((s) =>
      makeNode('states', s, (districtsByState.get(String(s.id)) || []).map(districtNode))
    );

    const idsOf = (rows) => new Set(rows.map((r) => String(r.id)));
    const stateIds = idsOf(states);
    const districtIds = idsOf(districts);
    const ulbIds = idsOf(ulbs);
    const wardIds = idsOf(wards);
    const lost = (rows, key, parentIds) =>
      rows.filter((r) => r[key] == null || !parentIds.has(String(r[key])));

    const orphans = [
      ['districts', lost(districts, 'state_id', stateIds)],
      ['ulbs', lost(ulbs, 'district_id', districtIds)],
      ['cities', lost(cities, 'district_id', districtIds)],
      ['zones', lost(zones, 'ulb_id', ulbIds)],
      ['wards', lost(wards, 'ulb_id', ulbIds)],
      ['localities', lost(localities, 'ward_id', wardIds)],
    ]
      .filter(([, rows]) => rows.length > 0)
      .map(([levelKey, rows]) => makeOrphanNode(levelKey, rows));

    const rootNode = {
      key: 'root',
      levelKey: 'root',
      name: 'All Locations',
      code: null,
      children: [...stateNodes, ...orphans],
      search: 'all locations',
    };

    // Flattened once so search can look at every level at any depth, and so a
    // hit can be traced back up to build the path that opens it.
    const keyMap = new Map();
    const parents = new Map();
    const all = [];
    const walk = (n, parentKey) => {
      keyMap.set(n.key, n);
      if (parentKey) parents.set(n.key, parentKey);
      if (parentKey) all.push(n);
      n.children.forEach((c) => walk(c, n.key));
    };
    walk(rootNode, null);

    return {
      byKey: keyMap,
      parentOf: parents,
      flat: all,
      counts: {
        states: states.length,
        districts: districts.length,
        ulbs: ulbs.length,
        cities: cities.length,
        zones: zones.length,
        wards: wards.length,
        localities: localities.length,
      },
      isEmpty: states.length === 0 && orphans.length === 0,
    };
  }, [tree]);

  // A stale path (data refreshed, a row vanished) is trimmed at the first key
  // that no longer resolves rather than blanking the map.
  const livePath = useMemo(() => {
    const out = [];
    for (const key of path) {
      if (!byKey.has(key)) break;
      out.push(key);
    }
    return out.length > 0 ? out : ['root'];
  }, [path, byKey]);

  const q = query.trim().toLowerCase();

  const results = useMemo(() => {
    if (q.length < 2) return [];
    const hits = [];
    for (const n of flat) {
      if (n.search.includes(q)) {
        hits.push(n);
        if (hits.length >= MAX_RESULTS) break;
      }
    }
    return hits;
  }, [flat, q]);

  const trailOf = (key) => {
    const trail = [];
    let cur = parentOf.get(key);
    while (cur) {
      trail.unshift(cur);
      cur = parentOf.get(cur);
    }
    return trail;
  };

  // Jumping to a search hit opens every level above it, so the map lands on
  // the name in context instead of just filtering it into view.
  const jumpTo = (key) => {
    setPath([...trailOf(key), key]);
    setQuery('');
  };

  const pick = (depth, key) => setPath([...livePath.slice(0, depth + 1), key]);
  const collapse = (depth) => setPath(livePath.slice(0, depth));
  const reset = () => setPath(['root']);

  const crumbs = livePath.map((k) => byKey.get(k)).filter(Boolean);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4 flex items-start justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Network className="w-7 h-7 text-blue-600 dark:text-blue-400" />
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Location Hierarchy</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                State → District → ULB → Zone → Ward → Locality · City is a geographic label on the District
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
              View only
            </span>
            <Link
              to="/admin/boundaries"
              className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
            >
              <MapIcon className="w-4 h-4" />
              Add via Boundaries
            </Link>
          </div>
        </div>

        {/* Level totals double as the legend — the swatch is the same colour
            the node cards use in the map below. */}
        <div className="px-6 pb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          {LEGEND.map((key) => (
            <span key={key} className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
              <span className={`w-2.5 h-2.5 rounded-sm ${LEVELS[key].accent}`} />
              {LEVELS[key].plural}
              <span className="font-semibold text-gray-900 dark:text-gray-100">{counts[key] ?? 0}</span>
            </span>
          ))}
        </div>
      </header>

      <div className="p-6">
        {isLoading && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 py-16 text-center">
            <Spinner className="w-6 h-6" label="Loading hierarchy…" />
          </div>
        )}
        {isError && (
          <p className="text-red-600 dark:text-red-400">Failed to load locations. Is the backend running?</p>
        )}

        {!isLoading && !isError && (
          <>
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search any level…"
                  className="w-72 pl-8 pr-8 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none"
                />
                {query && (
                  <button
                    onClick={() => setQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}

                {/* Results carry their full trail, so two wards with the same
                    number are still telling apart at a glance. */}
                {q.length >= 2 && (
                  <div
                    className="absolute z-20 mt-1 w-[34rem] max-w-[80vw] rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg overflow-y-auto"
                    style={{ maxHeight: 360, scrollbarWidth: 'thin' }}
                  >
                    {results.length === 0 ? (
                      <p className="px-3 py-3 text-sm text-gray-400 dark:text-gray-500">No names match “{query}”.</p>
                    ) : (
                      results.map((n) => (
                        <button
                          key={n.key}
                          onClick={() => jumpTo(n.key)}
                          className="w-full text-left px-3 py-2 hover:bg-blue-50 dark:hover:bg-blue-950/40 border-b border-gray-100 dark:border-gray-700/50 last:border-0"
                        >
                          <span className="flex items-center gap-2">
                            <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${LEVELS[n.levelKey].chip}`}>
                              {LEVELS[n.levelKey].label}
                            </span>
                            <span className="text-sm font-medium text-gray-800 dark:text-gray-100">{n.name}</span>
                            {n.code && (
                              <span className="text-xs font-mono text-gray-400 dark:text-gray-500">{n.code}</span>
                            )}
                          </span>
                          <span className="block text-[11px] text-gray-400 dark:text-gray-500 truncate mt-0.5">
                            {trailOf(n.key).slice(1).map((k) => byKey.get(k)?.name).filter(Boolean).join(' › ') || 'Top level'}
                          </span>
                        </button>
                      ))
                    )}
                    {results.length >= MAX_RESULTS && (
                      <p className="px-3 py-2 text-[11px] text-gray-400 dark:text-gray-500">
                        Showing the first {MAX_RESULTS} matches — keep typing to narrow it down.
                      </p>
                    )}
                  </div>
                )}
              </div>

              <button
                onClick={reset}
                disabled={livePath.length <= 1}
                className="flex items-center gap-1.5 text-sm px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <CornerDownLeft className="w-3.5 h-3.5" /> Back to top
              </button>
              <button
                onClick={refetch}
                className="flex items-center gap-1.5 text-sm px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} /> Refresh
              </button>

              {crumbs.length > 1 && (
                <nav className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 flex-wrap ml-1">
                  {crumbs.map((n, i) => (
                    <span key={n.key} className="flex items-center gap-1">
                      {i > 0 && <span className="text-gray-300 dark:text-gray-600">›</span>}
                      <button
                        onClick={() => collapse(i + 1)}
                        className={`hover:text-blue-600 dark:hover:text-blue-400 ${
                          i === crumbs.length - 1 ? 'font-semibold text-gray-700 dark:text-gray-200' : ''
                        }`}
                      >
                        {n.name}
                      </button>
                    </span>
                  ))}
                </nav>
              )}
            </div>

            {isEmpty ? (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-10 text-center">
                <Building2 className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                <p className="text-gray-700 dark:text-gray-200 font-medium">No locations published yet</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-4">
                  Levels appear here once they are imported from a shapefile.
                </p>
                <Link
                  to="/admin/boundaries"
                  className="inline-flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <MapIcon className="w-4 h-4" /> Go to Boundaries
                </Link>
              </div>
            ) : (
              // Only horizontal overflow: the map is one path deep, so its
              // height stays near the tallest single list and the box hugs it.
              <div
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-x-auto p-6"
                style={{ scrollbarWidth: 'thin' }}
              >
                <div className="w-max">
                  <Branch
                    key={livePath.join('|')}
                    depth={0}
                    path={livePath}
                    byKey={byKey}
                    onPick={pick}
                    onCollapse={collapse}
                  />
                </div>
              </div>
            )}

            <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
              Click a name to open it — the list collapses to that one name and its children appear to the right.
              Click an opened card, a breadcrumb, or “Show all” to step back out.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
