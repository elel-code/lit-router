import { browserDocument, browserWindow } from "./browser-env.ts";

type HistoryMode = "push" | "replace";
type MaybePromise<T> = T | Promise<T>;
export type NavigationDirection = "forward" | "backward" | "none";

export type RouteComponentFactory = (detail: RouterChangeDetail) => HTMLElement;
export type RouteParamValue = string | number | boolean;
export type RouteParamsInput = Record<
  string,
  RouteParamValue | null | undefined
>;
export type RouteQueryValue = string | number | boolean;
export type RouteQueryInit =
  | string
  | URLSearchParams
  | Record<
    string,
    RouteQueryValue | RouteQueryValue[] | null | undefined
  >;
export interface RouteLocation {
  name: string;
  params?: RouteParamsInput;
  query?: RouteQueryInit;
  hash?: string;
}

export interface RouteResolveOptions {
  params?: RouteParamsInput;
  query?: RouteQueryInit;
  hash?: string;
}

export interface RouterLinkOptions {
  replace?: boolean;
}

export interface RouterLinkAttributes {
  href: string;
  "data-router-replace"?: "";
}

type GuardRedirect =
  | string
  | URL
  | {
    to: string | URL;
    replace?: boolean;
  };

export type RouteGuardResult = boolean | void | GuardRedirect;
export type RouteGuard = (
  detail: RouterChangeDetail & {
    from: RouterChangeDetail | null;
    router: Router;
    signal: AbortSignal;
  },
) => MaybePromise<RouteGuardResult>;
export type RouteLeaveGuard = (
  detail: RouterChangeDetail & {
    to: RouterChangeDetail | null;
    router: Router;
    signal: AbortSignal;
  },
) => MaybePromise<RouteGuardResult>;

export interface RouteLoadContext {
  signal: AbortSignal;
}

export type RouteMeta = Record<string, unknown>;

export interface RouteDefinition {
  id?: string;
  name?: string;
  path: string;
  title?: string;
  viewTransitionName?: string;
  /**
   * 路由组件。
   * 如果当前路由声明了 `children`，组件模板中需要提供
   * `<slot name="..."></slot>` 作为子路由出口。
   * 默认 slot 名为 `route-child`，也可以通过 router-view 的 `child-slot`
   * 属性修改。
   */
  component?: string | RouteComponentFactory;
  children?: RouteDefinition[];
  guard?: RouteGuard;
  beforeLeave?: RouteLeaveGuard;
  load?: (context?: RouteLoadContext) => Promise<unknown>;
  meta?: RouteMeta;
  props?: Record<string, unknown>;
}

export type ReadonlyRouteDefinition = Readonly<
  Omit<RouteDefinition, "children" | "meta" | "props"> & {
    children?: readonly ReadonlyRouteDefinition[];
    meta?: Readonly<RouteMeta>;
    props?: Readonly<Record<string, unknown>>;
  }
>;

interface NavigationApiLike extends EventTarget {
  navigate: (url: string, options?: { history?: HistoryMode }) => unknown;
  currentEntry?: {
    key?: string;
  };
}

interface NavigationDestinationLike {
  url: string;
  key?: string;
}

interface NavigateEventLike extends Event {
  canIntercept?: boolean;
  destination: NavigationDestinationLike;
  downloadRequest?: string | null;
  formData?: FormData | null;
  intercept?: (options: {
    handler: () => Promise<void> | void;
    scroll?: "manual" | "after-transition";
  }) => void;
}

interface RedirectInstruction {
  to: URL;
  replace: boolean;
}

interface RouteTransitionOptions {
  history: HistoryMode | "none";
  skipIfSame?: boolean;
  redirectDepth?: number;
}

interface ActiveNavigation {
  id: number;
  url: URL;
  history: HistoryMode | "none";
  historyKey?: string;
  detail: RouterChangeDetail | null;
  abortController: AbortController;
}

interface RouteRecord {
  route: RouteDefinition;
  params: Record<string, string>;
}

type NamedRouteBranch = RouteDefinition[];

interface CompiledRouteDefinition {
  route: RouteDefinition;
  normalizedPath: string;
  pattern: URLPattern | null;
  children: CompiledRouteDefinition[];
  minSegments: number;
  maxSegments: number;
  specificity: number[];
  sortIndex: number;
}

export interface RouterChangeDetail {
  pathname: string;
  localPathname: string;
  basePath: string;
  search: string;
  query: URLSearchParams;
  hash: string;
  params: Record<string, string>;
  branch: RouteDefinition[];
  leaf?: RouteDefinition;
  url: URL;
  historyKey: string;
  direction: NavigationDirection;
}

export interface RouteContext {
  detail: RouterChangeDetail;
  params: Record<string, string>;
}

export interface RouteContextReceiver {
  routeContext?: RouteContext;
  setRouteContext?: (context: RouteContext) => void;
}

export interface RouteNotFoundDetail {
  url: URL;
  basePath: string;
  direction: NavigationDirection;
}

export interface RouteErrorDetail {
  url: URL;
  error: unknown;
  phase: "guard" | "load" | "commit" | "unknown";
  direction: NavigationDirection;
}

export interface RouteLoadingDetail {
  url: URL;
  branch: RouteDefinition[];
  pending: number;
  direction: NavigationDirection;
}

export interface RouterOptions {
  routes?: RouteDefinition[];
  basePath?: string;
  beforeRoute?: RouteGuard;
  autoStart?: boolean;
}

export interface RouteInsertOptions {
  parentId?: string;
  parentName?: string;
  index?: number;
}

export interface RouteSelector {
  id?: string;
  name?: string;
}

export interface RouteTreeChangeDetail {
  reason: "replace" | "insert" | "remove" | "batch";
  routeCount: number;
  routes: readonly ReadonlyRouteDefinition[];
}

export interface RouterEventMap {
  "route-change": RouterChangeDetail;
  "route-error": RouteErrorDetail;
  "route-loading-start": RouteLoadingDetail;
  "route-loading-end": RouteLoadingDetail;
  "route-not-found": RouteNotFoundDetail;
  "route-tree-change": RouteTreeChangeDetail;
}

export type RouterEvent<K extends keyof RouterEventMap = keyof RouterEventMap> =
  CustomEvent<RouterEventMap[K]>;

export type RouterEventListener<K extends keyof RouterEventMap> = (
  this: Router,
  event: RouterEvent<K>,
) => void;

function resolveRouteSelector(
  selector: string | RouteSelector,
): { type: "id" | "name"; value: string } {
  if (typeof selector === "string") {
    return { type: "name", value: normalizeRouteName(selector) };
  }

  if (selector.id && selector.name) {
    throw new Error("Route selector must not include both id and name.");
  }

  if (selector.id) {
    return { type: "id", value: normalizeRouteId(selector.id) };
  }

  if (selector.name) {
    return { type: "name", value: normalizeRouteName(selector.name) };
  }

  throw new Error(
    "Route selector must include either a route id or route name.",
  );
}

const ROOT_PATH = "/";
const ROUTE_TOKEN_PATTERN = /:([A-Za-z0-9_-]+)(\([^)]*\))?([?+*])?/g;
const HISTORY_ENTRY_KEY = "__litRouterEntryKey";
const EXACT_PATH_END_SPECIFICITY = 3;
const MAX_HISTORY_ENTRY_ORDERS = 256;
const HISTORY_ENTRY_ORDER_PRUNE_TO = 128;
const MAX_IGNORED_POP_STATES = 8;

function normalizePathname(pathname: string): string {
  if (!pathname || pathname === ROOT_PATH) {
    return ROOT_PATH;
  }

  const trimmed = pathname.replace(/\/+$/, "");
  return trimmed.startsWith(ROOT_PATH) ? trimmed : `${ROOT_PATH}${trimmed}`;
}

function normalizeBasePath(basePath: string): string {
  return normalizePathname(basePath || ROOT_PATH);
}

function stripBasePath(pathname: string, basePath: string): string | null {
  const normalizedPathname = normalizePathname(pathname);
  const normalizedBase = normalizeBasePath(basePath);

  if (normalizedBase === ROOT_PATH) {
    return normalizedPathname;
  }

  if (normalizedPathname === normalizedBase) {
    return ROOT_PATH;
  }

  if (!normalizedPathname.startsWith(`${normalizedBase}/`)) {
    return null;
  }

  return normalizePathname(normalizedPathname.slice(normalizedBase.length));
}

function splitSegments(pathname: string): string[] {
  const normalized = normalizePathname(pathname);
  return normalized === ROOT_PATH
    ? []
    : normalized.slice(1).split("/").filter(Boolean);
}

function normalizeRoutePath(path: string): string {
  if (!path || path === ROOT_PATH) {
    return ROOT_PATH;
  }

  if (path === "*") {
    return "*";
  }

  return normalizePathname(path.startsWith(ROOT_PATH) ? path : `/${path}`);
}

function normalizeRouteName(name: string): string {
  const normalized = name.trim();
  if (!normalized) {
    throw new Error("Route name must be a non-empty string.");
  }
  return normalized;
}

function normalizeRouteId(id: string): string {
  const normalized = id.trim();
  if (!normalized) {
    throw new Error("Route id must be a non-empty string.");
  }
  return normalized;
}

function candidatePath(segments: string[], count: number): string {
  if (count === 0) {
    return ROOT_PATH;
  }
  return `/${segments.slice(0, count).join("/")}`;
}

function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function hasUrlPatternSupport(): boolean {
  return typeof URLPattern !== "undefined";
}

function createHistoryEntryKey(): string {
  const cryptoApi = (
    browserWindow() as Window & {
      crypto?: Crypto;
    }
  ).crypto;
  if (cryptoApi?.randomUUID) {
    return cryptoApi.randomUUID();
  }

  return `entry-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function readHistoryEntryKey(state: unknown): string | null {
  if (!state || typeof state !== "object") {
    return null;
  }

  const candidate = (state as Record<string, unknown>)[HISTORY_ENTRY_KEY];
  return typeof candidate === "string" && candidate ? candidate : null;
}

function withHistoryEntryKey(
  state: unknown,
  key: string,
): Record<string, unknown> {
  if (state && typeof state === "object" && !Array.isArray(state)) {
    return {
      ...(state as Record<string, unknown>),
      [HISTORY_ENTRY_KEY]: key,
    };
  }

  return {
    [HISTORY_ENTRY_KEY]: key,
  };
}

function createPattern(
  path: string,
  routePatternCache: Map<string, URLPattern | null>,
): URLPattern | null {
  const normalizedPath = path === "*" ? "*" : normalizeRoutePath(path);
  const cachedPattern = routePatternCache.get(normalizedPath);
  if (cachedPattern !== undefined) {
    return cachedPattern;
  }

  if (!hasUrlPatternSupport()) {
    return null;
  }

  try {
    const pattern = new URLPattern({
      pathname: normalizedPath,
    });
    routePatternCache.set(normalizedPath, pattern);
    return pattern;
  } catch {
    routePatternCache.set(normalizedPath, null);
    return null;
  }
}

interface PatternMatch {
  consumedCount: number;
  params: Record<string, string>;
}

interface PendingRouteLoad {
  promise: Promise<void>;
  signal: AbortSignal;
}

function routeSegmentRange(
  path: string,
): { minSegments: number; maxSegments: number } {
  const normalizedPath = normalizeRoutePath(path);
  if (normalizedPath === ROOT_PATH) {
    return { minSegments: 0, maxSegments: 0 };
  }

  if (normalizedPath === "*") {
    return { minSegments: 0, maxSegments: Number.POSITIVE_INFINITY };
  }

  let minSegments = 0;
  let maxSegments = 0;

  for (const segment of splitSegments(normalizedPath)) {
    const tokens = Array.from(segment.matchAll(ROUTE_TOKEN_PATTERN));
    if (tokens.length === 0) {
      minSegments += 1;
      maxSegments += 1;
      continue;
    }

    let hasRequiredContent = false;
    let lastIndex = 0;
    let segmentCanExpand = false;

    for (const match of tokens) {
      const [token, _key, _pattern, modifier] = match;
      const staticPrefix = segment.slice(lastIndex, match.index);
      if (staticPrefix) {
        hasRequiredContent = true;
      }

      if (modifier === "+" || !modifier) {
        hasRequiredContent = true;
      }

      if (modifier === "+" || modifier === "*") {
        segmentCanExpand = true;
      }

      lastIndex = (match.index ?? 0) + token.length;
    }

    if (segment.slice(lastIndex)) {
      hasRequiredContent = true;
    }

    if (hasRequiredContent) {
      minSegments += 1;
    }
    maxSegments = segmentCanExpand ? Number.POSITIVE_INFINITY : maxSegments + 1;
  }

  return { minSegments, maxSegments };
}

function decodePatternParams(
  groups: Record<string, string | undefined>,
): Record<string, string> {
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(groups)) {
    if (value) {
      params[key] = decodeSegment(value);
    }
  }
  return params;
}

function execPatternMatches(
  route: CompiledRouteDefinition,
  remainingSegments: string[],
): PatternMatch[] {
  const normalized = route.normalizedPath;

  if (normalized === "*") {
    return [{
      consumedCount: remainingSegments.length,
      params: { "*": remainingSegments.join("/") },
    }];
  }

  if (!route.pattern) {
    return [];
  }

  const matches: PatternMatch[] = [];
  const maxConsumedCount = Math.min(
    route.maxSegments,
    remainingSegments.length,
  );

  for (
    let consumedCount = route.minSegments;
    consumedCount <= maxConsumedCount;
    consumedCount += 1
  ) {
    const result = route.pattern.exec({
      pathname: candidatePath(remainingSegments, consumedCount),
    });
    if (!result) {
      continue;
    }

    matches.push({
      consumedCount,
      params: decodePatternParams(result.pathname.groups),
    });
  }

  return matches;
}

function shallowEqualRecord(
  left: Record<string, string>,
  right: Record<string, string>,
): boolean {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);

  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  return leftKeys.every((key) => left[key] === right[key]);
}

function isSameDetail(
  current: RouterChangeDetail,
  next: RouterChangeDetail,
): boolean {
  if (
    current.pathname !== next.pathname ||
    current.localPathname !== next.localPathname ||
    current.basePath !== next.basePath ||
    current.search !== next.search ||
    current.hash !== next.hash ||
    current.branch.length !== next.branch.length
  ) {
    return false;
  }

  if (!shallowEqualRecord(current.params, next.params)) {
    return false;
  }

  return current.branch.every((route, index) => route === next.branch[index]);
}

function sharedBranchPrefixLength(
  current: RouteDefinition[],
  next: RouteDefinition[],
): number {
  let index = 0;
  const maxLength = Math.min(current.length, next.length);

  while (index < maxLength && current[index] === next[index]) {
    index += 1;
  }

  return index;
}

function toRedirectInstruction(
  result: Exclude<RouteGuardResult, boolean | void>,
  base: string,
): RedirectInstruction {
  if (result instanceof URL) {
    return { to: result, replace: false };
  }

  if (typeof result === "string") {
    return { to: new URL(result, base), replace: false };
  }

  return {
    to: result.to instanceof URL ? result.to : new URL(result.to, base),
    replace: Boolean(result.replace),
  };
}

function buildNamedRouteIndex(
  routes: RouteDefinition[],
  parentBranch: NamedRouteBranch = [],
  index = new Map<string, NamedRouteBranch>(),
): Map<string, NamedRouteBranch> {
  for (const route of routes) {
    const branch = [...parentBranch, route];

    if (route.name) {
      const name = normalizeRouteName(route.name);
      if (index.has(name)) {
        throw new Error(`Duplicate route name "${name}" detected.`);
      }
      index.set(name, branch);
    }

    if (route.children?.length) {
      buildNamedRouteIndex(route.children, branch, index);
    }
  }

  return index;
}

function buildRouteIdIndex(
  routes: RouteDefinition[],
  parentBranch: NamedRouteBranch = [],
  index = new Map<string, NamedRouteBranch>(),
): Map<string, NamedRouteBranch> {
  for (const route of routes) {
    const branch = [...parentBranch, route];

    if (route.id) {
      const id = normalizeRouteId(route.id);
      if (index.has(id)) {
        throw new Error(`Duplicate route id "${id}" detected.`);
      }
      index.set(id, branch);
    }

    if (route.children?.length) {
      buildRouteIdIndex(route.children, branch, index);
    }
  }

  return index;
}

function segmentSpecificity(segment: string): number {
  if (segment === "*") {
    return 1;
  }

  const tokens = Array.from(segment.matchAll(ROUTE_TOKEN_PATTERN));
  if (tokens.length === 0) {
    return 5;
  }

  if (tokens.some(([, , , modifier]) => modifier === "*" || modifier === "+")) {
    return 1;
  }

  if (tokens.some(([, , , modifier]) => modifier === "?")) {
    return 2;
  }

  return 4;
}

function routeSpecificity(path: string): number[] {
  const normalizedPath = normalizeRoutePath(path);
  if (normalizedPath === ROOT_PATH) {
    return [];
  }

  if (normalizedPath === "*") {
    return [1];
  }

  return splitSegments(normalizedPath).map((segment) =>
    segmentSpecificity(segment)
  );
}

function compareRouteSpecificity(
  left: CompiledRouteDefinition,
  right: CompiledRouteDefinition,
): number {
  const maxLength = Math.max(
    left.specificity.length,
    right.specificity.length,
  );

  for (let index = 0; index < maxLength; index += 1) {
    const leftScore = index < left.specificity.length
      ? left.specificity[index]
      : EXACT_PATH_END_SPECIFICITY;
    const rightScore = index < right.specificity.length
      ? right.specificity[index]
      : EXACT_PATH_END_SPECIFICITY;
    if (leftScore !== rightScore) {
      return rightScore - leftScore;
    }
  }

  return left.sortIndex - right.sortIndex;
}

function buildCompiledRoutes(
  routes: RouteDefinition[],
  routePatternCache: Map<string, URLPattern | null>,
): CompiledRouteDefinition[] {
  return routes.map((route, sortIndex) => {
    const normalizedPath = normalizeRoutePath(route.path);
    const { minSegments, maxSegments } = routeSegmentRange(normalizedPath);
    return {
      route,
      normalizedPath,
      pattern: normalizedPath === "*"
        ? null
        : createPattern(normalizedPath, routePatternCache),
      children: route.children?.length
        ? buildCompiledRoutes(route.children, routePatternCache)
        : [],
      minSegments,
      maxSegments,
      specificity: routeSpecificity(normalizedPath),
      sortIndex,
    };
  }).sort(compareRouteSpecificity);
}

function cloneRouteDefinition(route: RouteDefinition): RouteDefinition {
  return {
    ...route,
    meta: route.meta ? { ...route.meta } : undefined,
    props: route.props ? { ...route.props } : undefined,
    children: route.children?.length
      ? cloneRouteDefinitions(route.children)
      : undefined,
  };
}

function cloneRouteDefinitions(routes: RouteDefinition[]): RouteDefinition[] {
  return routes.map((route) => cloneRouteDefinition(route));
}

function freezeRouteDefinition(
  route: RouteDefinition,
): ReadonlyRouteDefinition {
  const snapshot: ReadonlyRouteDefinition = {
    ...route,
    meta: route.meta ? Object.freeze({ ...route.meta }) : undefined,
    props: route.props ? Object.freeze({ ...route.props }) : undefined,
    children: route.children?.length
      ? freezeRouteDefinitions(route.children)
      : undefined,
  };
  return Object.freeze(snapshot);
}

function freezeRouteDefinitions(
  routes: RouteDefinition[],
): readonly ReadonlyRouteDefinition[] {
  return Object.freeze(routes.map((route) => freezeRouteDefinition(route)));
}

function countRouteDefinitions(routes: RouteDefinition[]): number {
  return routes.reduce(
    (count, route) => count + 1 + countRouteDefinitions(route.children ?? []),
    0,
  );
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    "then" in value &&
    typeof value.then === "function"
  );
}

function normalizeInsertionIndex(
  index: number | undefined,
  length: number,
): number {
  if (index === undefined) {
    return length;
  }

  if (!Number.isInteger(index) || index < 0 || index > length) {
    throw new Error(
      `Route insertion index must be an integer between 0 and ${length}.`,
    );
  }

  return index;
}

function removeNamedRouteFromTree(
  routes: RouteDefinition[],
  name: string,
): boolean {
  const directIndex = routes.findIndex((route) =>
    route.name ? normalizeRouteName(route.name) === name : false
  );
  if (directIndex >= 0) {
    routes.splice(directIndex, 1);
    return true;
  }

  for (const route of routes) {
    if (!route.children?.length) {
      continue;
    }

    if (removeNamedRouteFromTree(route.children, name)) {
      if (route.children.length === 0) {
        route.children = undefined;
      }
      return true;
    }
  }

  return false;
}

function removeRouteByIdFromTree(
  routes: RouteDefinition[],
  id: string,
): boolean {
  const directIndex = routes.findIndex((route) =>
    route.id ? normalizeRouteId(route.id) === id : false
  );
  if (directIndex >= 0) {
    routes.splice(directIndex, 1);
    return true;
  }

  for (const route of routes) {
    if (!route.children?.length) {
      continue;
    }

    if (removeRouteByIdFromTree(route.children, id)) {
      if (route.children.length === 0) {
        route.children = undefined;
      }
      return true;
    }
  }

  return false;
}

function encodeRouteParamValue(
  key: string,
  value: RouteParamValue | null | undefined,
): string {
  if (value === null || value === undefined) {
    throw new Error(`Missing route param "${key}".`);
  }

  return encodeURIComponent(String(value));
}

function expandSplatSegments(
  value: RouteParamValue | null | undefined,
): string[] {
  if (value === null || value === undefined) {
    throw new Error('Missing route param "*".');
  }

  return String(value)
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment));
}

function fillRouteSegment(
  segment: string,
  params: RouteParamsInput,
): string[] {
  if (segment === "*") {
    return expandSplatSegments(params["*"]);
  }

  let supported = false;
  let output = "";
  let lastIndex = 0;

  for (const match of segment.matchAll(ROUTE_TOKEN_PATTERN)) {
    supported = true;
    const [token, key, _pattern, modifier] = match;
    if (modifier && modifier !== "?") {
      throw new Error(
        `Route path segment "${segment}" uses unsupported reverse-routing modifier "${modifier}" in token "${token}".`,
      );
    }

    output += segment.slice(lastIndex, match.index);
    if (
      modifier === "?" && (params[key] === null || params[key] === undefined)
    ) {
      lastIndex = (match.index ?? 0) + token.length;
      continue;
    }
    output += encodeRouteParamValue(key, params[key]);
    lastIndex = (match.index ?? 0) + token.length;
  }

  if (!supported) {
    return [segment];
  }

  output += segment.slice(lastIndex);
  return output ? [output] : [];
}

function buildLocalPathname(
  branch: NamedRouteBranch,
  params: RouteParamsInput = {},
): string {
  const segments: string[] = [];

  for (const route of branch) {
    const normalizedPath = normalizeRoutePath(route.path);
    if (normalizedPath === ROOT_PATH) {
      continue;
    }

    for (const segment of splitSegments(normalizedPath)) {
      segments.push(...fillRouteSegment(segment, params));
    }
  }

  return segments.length ? `/${segments.join("/")}` : ROOT_PATH;
}

function createSearchString(query?: RouteQueryInit): string {
  if (!query) {
    return "";
  }

  const params = typeof query === "string"
    ? new URLSearchParams(query.startsWith("?") ? query.slice(1) : query)
    : query instanceof URLSearchParams
    ? new URLSearchParams(query)
    : (() => {
      const searchParams = new URLSearchParams();

      for (const [key, rawValue] of Object.entries(query)) {
        if (rawValue === null || rawValue === undefined) {
          continue;
        }

        const values = Array.isArray(rawValue) ? rawValue : [rawValue];
        for (const value of values) {
          searchParams.append(key, String(value));
        }
      }

      return searchParams;
    })();

  const search = params.toString();
  return search ? `?${search}` : "";
}

function normalizeHash(hash?: string): string {
  if (!hash) {
    return "";
  }

  return hash.startsWith("#") ? hash : `#${hash}`;
}

function matchRoutes(
  routes: CompiledRouteDefinition[],
  remainingSegments: string[],
  parentRecords: RouteRecord[] = [],
  parentParams: Record<string, string> = {},
): RouteRecord[] | null {
  for (const route of routes) {
    const normalizedPath = route.normalizedPath;
    const matches = execPatternMatches(route, remainingSegments);
    if (matches.length === 0) {
      continue;
    }

    for (const match of matches) {
      const record: RouteRecord = {
        route: route.route,
        params: {
          ...parentParams,
          ...match.params,
        },
      };

      const nextRemaining = remainingSegments.slice(match.consumedCount);
      const branch = [...parentRecords, record];

      if (route.children.length) {
        const child = matchRoutes(
          route.children,
          nextRemaining,
          branch,
          record.params,
        );
        if (child) {
          return child;
        }
      }

      if (nextRemaining.length === 0 || normalizedPath === "*") {
        return branch;
      }
    }
  }

  return null;
}

export class Router extends EventTarget {
  private static activeRouter?: Router;

  private routeTree: RouteDefinition[] = [];
  basePath: string;
  beforeRoute?: RouteGuard;

  current: RouterChangeDetail = {
    pathname: ROOT_PATH,
    localPathname: ROOT_PATH,
    basePath: ROOT_PATH,
    search: "",
    query: new URLSearchParams(),
    hash: "",
    params: {},
    branch: [],
    url: new URL(browserWindow().location.href),
    historyKey: "",
    direction: "none",
  };

  private readonly loadedRoutes = new WeakSet<RouteDefinition>();
  private readonly pendingRouteLoads = new WeakMap<
    RouteDefinition,
    PendingRouteLoad
  >();
  private readonly routePatternCache = new Map<string, URLPattern | null>();
  private compiledRoutes: CompiledRouteDefinition[] = [];
  private routeIds = new Map<string, NamedRouteBranch>();
  private namedRoutes = new Map<string, NamedRouteBranch>();
  private readonlyRoutes: readonly ReadonlyRouteDefinition[] = Object.freeze(
    [],
  );
  private routeCount = 0;
  private readonly historyEntryOrders = new Map<string, number>();
  private nextHistoryEntryOrder = 0;
  private navigationId = 0;
  private activeNavigation?: ActiveNavigation;
  private readonly maxRedirectDepth = 3;
  private ignoredPopStates = 0;
  private activeRouteLoads = 0;
  private started = false;
  private routeMutationDepth = 0;
  private pendingRouteRefreshSkipIfSame?: boolean;
  private pendingRouteTreeChange = false;
  private lastRouteErrorDetail?: RouteErrorDetail;
  private lastRouteNotFoundDetail?: RouteNotFoundDetail;

  addEventListener<K extends keyof RouterEventMap>(
    type: K,
    listener: RouterEventListener<K> | null,
    options?: boolean | AddEventListenerOptions,
  ): void;
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ): void;
  addEventListener(
    type: string,
    listener:
      | EventListenerOrEventListenerObject
      | RouterEventListener<keyof RouterEventMap>
      | null,
    options?: boolean | AddEventListenerOptions,
  ): void {
    super.addEventListener(
      type,
      listener as EventListenerOrEventListenerObject | null,
      options,
    );
  }

  removeEventListener<K extends keyof RouterEventMap>(
    type: K,
    listener: RouterEventListener<K> | null,
    options?: boolean | EventListenerOptions,
  ): void;
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | EventListenerOptions,
  ): void;
  removeEventListener(
    type: string,
    listener:
      | EventListenerOrEventListenerObject
      | RouterEventListener<keyof RouterEventMap>
      | null,
    options?: boolean | EventListenerOptions,
  ): void {
    super.removeEventListener(
      type,
      listener as EventListenerOrEventListenerObject | null,
      options,
    );
  }

  private readonly onPopState = () => {
    if (this.ignoredPopStates > 0) {
      this.ignoredPopStates = Math.max(0, this.ignoredPopStates - 1);
      return;
    }

    void this.routeTo(new URL(browserWindow().location.href), {
      history: "none",
    });
  };

  private readonly onDocumentClick = (event: MouseEvent) => {
    const path = event.composedPath();
    const anchor = path.find((item) => this.isNavigableAnchor(item)) as
      | Element
      | undefined;

    if (!anchor) {
      return;
    }

    if (event.defaultPrevented || event.button !== 0) {
      return;
    }

    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }

    const target = anchor.getAttribute("target");
    if (target && target !== "_self") {
      return;
    }

    if (anchor.hasAttribute("download")) {
      return;
    }

    const href = this.getAnchorHref(anchor);
    if (!href || href.startsWith("#")) {
      return;
    }

    const browser = browserWindow();
    const url = new URL(href, browser.location.href);
    if (url.origin !== browser.location.origin) {
      return;
    }

    if (!this.managesUrl(url)) {
      return;
    }

    const shouldReplace = anchor.hasAttribute("data-router-replace");
    if (this.navigationApi && !shouldReplace) {
      return;
    }

    event.preventDefault();
    this.navigate(url, shouldReplace ? "replace" : "push");
  };

  private readonly onNavigate = (event: Event) => {
    const navigateEvent = event as NavigateEventLike;

    if (!navigateEvent.canIntercept || !navigateEvent.intercept) {
      return;
    }

    if (navigateEvent.downloadRequest || navigateEvent.formData) {
      return;
    }

    const nextUrl = new URL(navigateEvent.destination.url);
    if (nextUrl.origin !== browserWindow().location.origin) {
      return;
    }

    if (!this.managesUrl(nextUrl)) {
      return;
    }

    navigateEvent.intercept({
      scroll: "manual",
      handler: async () => {
        await this.routeTo(nextUrl, {
          history: "none",
          historyKey: navigateEvent.destination.key,
        });
      },
    });
  };

  constructor(options: RouterOptions = {}) {
    super();
    this.routeTree = cloneRouteDefinitions(options.routes ?? []);
    this.basePath = normalizeBasePath(options.basePath ?? ROOT_PATH);
    this.beforeRoute = options.beforeRoute;
    this.rebuildRouteState();

    if (options.autoStart !== false) {
      this.start();
    }
  }

  get routes(): readonly ReadonlyRouteDefinition[] {
    return this.readonlyRoutes;
  }

  set routes(routes: RouteDefinition[]) {
    this.replaceRouteTree(routes, {
      skipIfSame: false,
      reason: "replace",
    });
  }

  start(): void {
    if (this.started) {
      return;
    }

    if (!hasUrlPatternSupport()) {
      throw new Error(
        "Router requires URLPattern support. Use a modern browser or provide a URLPattern polyfill before starting the router.",
      );
    }

    if (Router.activeRouter && Router.activeRouter !== this) {
      throw new Error(
        "Only one Router instance can be started at a time in single-router mode.",
      );
    }

    this.ensureHistoryEntryOrder(this.ensureCurrentHistoryEntryKey());
    this.started = true;
    Router.activeRouter = this;
    browserDocument().addEventListener("click", this.onDocumentClick);
    if (this.navigationApi) {
      this.navigationApi.addEventListener("navigate", this.onNavigate);
    } else {
      browserWindow().addEventListener("popstate", this.onPopState);
    }
    void this.routeTo(new URL(browserWindow().location.href), {
      history: "none",
      skipIfSame: false,
    });
  }

  stop(): void {
    if (!this.started) {
      return;
    }

    this.activeNavigation?.abortController.abort();
    this.navigationId += 1;
    this.activeNavigation = undefined;
    this.started = false;
    if (Router.activeRouter === this) {
      Router.activeRouter = undefined;
    }
    browserDocument().removeEventListener("click", this.onDocumentClick);
    if (this.navigationApi) {
      this.navigationApi.removeEventListener("navigate", this.onNavigate);
    } else {
      browserWindow().removeEventListener("popstate", this.onPopState);
    }
  }

  configure(
    options: Pick<RouterOptions, "routes" | "basePath" | "beforeRoute">,
  ): void {
    if ("routes" in options) {
      this.routeTree = cloneRouteDefinitions(options.routes ?? []);
      this.rebuildRouteState();
      this.notifyRouteTreeChanged("replace");
    }

    if (options.basePath !== undefined) {
      this.basePath = normalizeBasePath(options.basePath);
    }

    if ("beforeRoute" in options) {
      this.beforeRoute = options.beforeRoute;
    }

    this.requestRouteRefresh(false);
  }

  setRoutes(routes: RouteDefinition[]): void {
    this.replaceRouteTree(routes, {
      skipIfSame: false,
      reason: "replace",
    });
  }

  insertRoutes(
    routes: RouteDefinition[],
    options: RouteInsertOptions = {},
  ): void {
    if (routes.length === 0) {
      return;
    }

    const additions = cloneRouteDefinitions(routes);
    const insertedIds = buildRouteIdIndex(additions);
    const insertedNames = buildNamedRouteIndex(additions);
    for (const id of insertedIds.keys()) {
      if (this.routeIds.has(id)) {
        throw new Error(`Duplicate route id "${id}" detected.`);
      }
    }
    for (const name of insertedNames.keys()) {
      if (this.namedRoutes.has(name)) {
        throw new Error(`Duplicate route name "${name}" detected.`);
      }
    }

    let siblings = this.routeTree;
    if (options.parentId && options.parentName) {
      throw new Error("Provide either parentId or parentName, not both.");
    }

    if (options.parentId || options.parentName) {
      const parent = this.resolveRouteBranch({
        id: options.parentId,
        name: options.parentName,
      }).at(-1);
      if (!parent) {
        throw new Error("Unknown parent route.");
      }
      siblings = parent.children ??= [];
    }

    const insertionIndex = normalizeInsertionIndex(
      options.index,
      siblings.length,
    );

    siblings.splice(insertionIndex, 0, ...additions);
    this.rebuildRouteState();
    this.notifyRouteTreeChanged("insert");
    this.requestRouteRefresh(true);
  }

  removeRoute(selector: string | RouteSelector): boolean {
    const resolvedSelector = resolveRouteSelector(selector);
    const removed = resolvedSelector.type === "id"
      ? removeRouteByIdFromTree(this.routeTree, resolvedSelector.value)
      : removeNamedRouteFromTree(this.routeTree, resolvedSelector.value);
    if (!removed) {
      return false;
    }

    this.rebuildRouteState();
    this.notifyRouteTreeChanged("remove");
    this.requestRouteRefresh(true);
    return true;
  }

  batchRouteUpdates(update: () => void): void {
    const isOutermostBatch = this.routeMutationDepth === 0;
    const snapshot = isOutermostBatch
      ? {
        routeTree: cloneRouteDefinitions(this.routeTree),
        basePath: this.basePath,
        beforeRoute: this.beforeRoute,
      }
      : undefined;

    this.routeMutationDepth += 1;
    try {
      const result = update();
      if (isPromiseLike(result)) {
        throw new Error("batchRouteUpdates callback must be synchronous.");
      }
    } catch (error) {
      if (isOutermostBatch && snapshot) {
        this.routeTree = snapshot.routeTree;
        this.basePath = snapshot.basePath;
        this.beforeRoute = snapshot.beforeRoute;
        this.rebuildRouteState();
        this.pendingRouteTreeChange = false;
        this.pendingRouteRefreshSkipIfSame = undefined;
      }
      throw error;
    } finally {
      this.routeMutationDepth -= 1;
    }

    if (this.routeMutationDepth > 0) {
      return;
    }

    const pendingRouteTreeChange = this.pendingRouteTreeChange;
    const pendingRouteRefreshSkipIfSame = this.pendingRouteRefreshSkipIfSame;
    this.pendingRouteTreeChange = false;
    this.pendingRouteRefreshSkipIfSame = undefined;

    if (pendingRouteTreeChange) {
      this.dispatchRouteTreeChange("batch");
    }

    if (pendingRouteRefreshSkipIfSame !== undefined) {
      this.requestRouteRefresh(pendingRouteRefreshSkipIfSame);
    }
  }

  push(url: string | URL | RouteLocation): void {
    this.navigate(url, "push");
  }

  replace(url: string | URL | RouteLocation): void {
    this.navigate(url, "replace");
  }

  resolveUrl(target: string | URL): RouterChangeDetail | null {
    const url = target instanceof URL
      ? new URL(target.href)
      : new URL(target, browserWindow().location.href);
    return this.resolveMatched(url);
  }

  resolveNamed(
    name: string,
    options: RouteResolveOptions = {},
  ): RouterChangeDetail | null {
    return this.resolveMatched(this.toUrl({ name, ...options }));
  }

  link(location: RouteLocation): string {
    const url = this.toUrl(location);
    return `${url.pathname}${url.search}${url.hash}`;
  }

  linkAttributes(
    location: RouteLocation,
    options: RouterLinkOptions = {},
  ): RouterLinkAttributes {
    const href = this.link(location);
    return options.replace ? { href, "data-router-replace": "" } : { href };
  }

  cloneRoutes(): RouteDefinition[] {
    return cloneRouteDefinitions(this.routeTree);
  }

  get lastError(): RouteErrorDetail | undefined {
    return this.lastRouteErrorDetail;
  }

  get lastNotFound(): RouteNotFoundDetail | undefined {
    return this.lastRouteNotFoundDetail;
  }

  private replaceRouteTree(
    routes: RouteDefinition[],
    options: {
      skipIfSame: boolean;
      reason: RouteTreeChangeDetail["reason"];
    },
  ): void {
    this.routeTree = cloneRouteDefinitions(routes);
    this.rebuildRouteState();
    this.notifyRouteTreeChanged(options.reason);
    this.requestRouteRefresh(options.skipIfSame);
  }

  private get navigationApi(): NavigationApiLike | undefined {
    return (
      browserWindow() as Window & {
        navigation?: NavigationApiLike;
      }
    ).navigation;
  }

  private isNavigableAnchor(item: unknown): item is Element {
    return item instanceof Element && item.tagName.toUpperCase() === "A";
  }

  private getAnchorHref(anchor: Element): string | null {
    return anchor.getAttribute("href") ?? anchor.getAttribute("xlink:href");
  }

  private ensureHistoryEntryOrder(key: string): number {
    const existingOrder = this.historyEntryOrders.get(key);
    if (existingOrder !== undefined) {
      return existingOrder;
    }

    const nextOrder = this.nextHistoryEntryOrder;
    this.historyEntryOrders.set(key, nextOrder);
    this.nextHistoryEntryOrder += 1;
    this.pruneHistoryEntryOrders();
    return nextOrder;
  }

  private pruneHistoryEntryOrders(): void {
    if (this.historyEntryOrders.size <= MAX_HISTORY_ENTRY_ORDERS) {
      return;
    }

    const currentKey = this.current.historyKey;
    const keepThreshold = this.nextHistoryEntryOrder -
      HISTORY_ENTRY_ORDER_PRUNE_TO;

    for (const [key, order] of this.historyEntryOrders) {
      if (this.historyEntryOrders.size <= HISTORY_ENTRY_ORDER_PRUNE_TO) {
        break;
      }

      if (key === currentKey || order >= keepThreshold) {
        continue;
      }

      this.historyEntryOrders.delete(key);
    }
  }

  private getCurrentHistoryEntryKey(): string {
    const navigationEntryKey = this.navigationApi?.currentEntry?.key;
    if (navigationEntryKey) {
      return navigationEntryKey;
    }

    const historyStateKey = readHistoryEntryKey(browserWindow().history.state);
    if (historyStateKey) {
      return historyStateKey;
    }

    return this.ensureCurrentHistoryEntryKey();
  }

  private ensureCurrentHistoryEntryKey(): string {
    const existingKey = readHistoryEntryKey(browserWindow().history.state);
    if (existingKey) {
      return existingKey;
    }

    const navigationEntryKey = this.navigationApi?.currentEntry?.key;
    if (navigationEntryKey) {
      return navigationEntryKey;
    }

    const key = createHistoryEntryKey();
    browserWindow().history.replaceState(
      withHistoryEntryKey(browserWindow().history.state, key),
      "",
      `${browserWindow().location.pathname}${browserWindow().location.search}${browserWindow().location.hash}`,
    );
    return key;
  }

  private resolveNavigationDirection(
    history: HistoryMode | "none",
    nextHistoryKey: string,
  ): NavigationDirection {
    if (history === "push") {
      return "forward";
    }

    if (history === "replace" || !this.current.historyKey) {
      return "none";
    }

    if (this.current.historyKey === nextHistoryKey) {
      return "none";
    }

    const currentOrder = this.historyEntryOrders.get(this.current.historyKey);
    const nextOrder = this.historyEntryOrders.get(nextHistoryKey);
    if (
      currentOrder === undefined ||
      nextOrder === undefined ||
      currentOrder === nextOrder
    ) {
      return "none";
    }

    return nextOrder > currentOrder ? "forward" : "backward";
  }

  private resolveAttemptDirection(
    history: HistoryMode | "none",
    historyKey?: string,
  ): NavigationDirection {
    if (history === "push") {
      return "forward";
    }

    if (history === "replace") {
      return "none";
    }

    const nextHistoryKey = historyKey || this.getCurrentHistoryEntryKey();
    this.ensureHistoryEntryOrder(nextHistoryKey);
    return this.resolveNavigationDirection("none", nextHistoryKey);
  }

  private navigate(
    target: string | URL | RouteLocation,
    mode: HistoryMode,
  ): void {
    const url = this.toUrl(target);
    const href = `${url.pathname}${url.search}${url.hash}`;

    if (this.navigationApi) {
      this.navigationApi.navigate(href, { history: mode });
      return;
    }

    void this.routeTo(url, { history: mode });
  }

  private toUrl(target: string | URL | RouteLocation): URL {
    if (target instanceof URL) {
      return target;
    }

    if (typeof target === "string") {
      return new URL(target, browserWindow().location.href);
    }

    const branch = this.resolveNamedRouteBranch(target.name);
    const localPathname = buildLocalPathname(branch, target.params);
    const pathname = this.withBasePath(localPathname);
    const href = `${pathname}${createSearchString(target.query)}${
      normalizeHash(target.hash)
    }`;

    return new URL(href, browserWindow().location.origin);
  }

  private resolveMatched(url: URL): RouterChangeDetail | null {
    const detail = this.resolve(url);
    return detail && detail.branch.length > 0 ? detail : null;
  }

  private resolveNamedRouteBranch(name: string): NamedRouteBranch {
    const normalizedName = normalizeRouteName(name);
    const branch = this.namedRoutes.get(normalizedName);
    if (!branch) {
      throw new Error(`Unknown route name "${normalizedName}".`);
    }

    return branch;
  }

  private resolveRouteIdBranch(id: string): NamedRouteBranch {
    const normalizedId = normalizeRouteId(id);
    const branch = this.routeIds.get(normalizedId);
    if (!branch) {
      throw new Error(`Unknown route id "${normalizedId}".`);
    }

    return branch;
  }

  private resolveRouteBranch(selector: RouteSelector): NamedRouteBranch {
    if (selector.id && selector.name) {
      throw new Error("Route selector must not include both id and name.");
    }

    if (selector.id) {
      return this.resolveRouteIdBranch(selector.id);
    }

    if (selector.name) {
      return this.resolveNamedRouteBranch(selector.name);
    }

    throw new Error(
      "Route selector must include either a route id or route name.",
    );
  }

  private withBasePath(localPathname: string): string {
    if (this.basePath === ROOT_PATH) {
      return localPathname;
    }

    return localPathname === ROOT_PATH
      ? this.basePath
      : `${this.basePath}${localPathname}`;
  }

  private resolve(url: URL): RouterChangeDetail | null {
    const pathname = normalizePathname(url.pathname);
    const localPathname = stripBasePath(pathname, this.basePath);

    if (localPathname === null) {
      return null;
    }

    const branch =
      matchRoutes(this.compiledRoutes, splitSegments(localPathname)) ??
        [];
    const leaf = branch.at(-1)?.route;
    const params = branch.at(-1)?.params ?? {};

    return {
      pathname,
      localPathname,
      basePath: normalizeBasePath(this.basePath),
      search: url.search,
      query: new URLSearchParams(url.search),
      hash: url.hash,
      params,
      branch: branch.map((record) => record.route),
      leaf,
      url,
      historyKey: this.getCurrentHistoryEntryKey(),
      direction: "none",
    };
  }

  private managesUrl(url: URL): boolean {
    return stripBasePath(url.pathname, this.basePath) !== null;
  }

  private rebuildRouteState(): void {
    this.compiledRoutes = buildCompiledRoutes(
      this.routeTree,
      this.routePatternCache,
    );
    this.routeIds = buildRouteIdIndex(this.routeTree);
    this.namedRoutes = buildNamedRouteIndex(this.routeTree);
    this.readonlyRoutes = freezeRouteDefinitions(this.routeTree);
    this.routeCount = countRouteDefinitions(this.routeTree);
  }

  private notifyRouteTreeChanged(
    reason: RouteTreeChangeDetail["reason"],
  ): void {
    if (!this.started) {
      return;
    }

    if (this.routeMutationDepth > 0) {
      this.pendingRouteTreeChange = true;
      return;
    }

    this.dispatchRouteTreeChange(reason);
  }

  private dispatchRouteTreeChange(
    reason: RouteTreeChangeDetail["reason"],
  ): void {
    const detail: RouteTreeChangeDetail = {
      reason,
      routeCount: this.routeCount,
      routes: this.readonlyRoutes,
    };

    this.dispatchEvent(
      new CustomEvent<RouteTreeChangeDetail>("route-tree-change", {
        detail,
      }),
    );
  }

  private requestRouteRefresh(skipIfSame: boolean): void {
    if (!this.started) {
      return;
    }

    if (this.routeMutationDepth > 0) {
      this.pendingRouteRefreshSkipIfSame =
        this.pendingRouteRefreshSkipIfSame === undefined
          ? skipIfSame
          : this.pendingRouteRefreshSkipIfSame && skipIfSame;
      return;
    }

    const activeNavigation = this.activeNavigation;
    if (activeNavigation && activeNavigation.id === this.navigationId) {
      const nextDetail = this.resolve(activeNavigation.url);

      if (skipIfSame) {
        if (
          activeNavigation.detail &&
          nextDetail &&
          isSameDetail(activeNavigation.detail, nextDetail)
        ) {
          return;
        }

        if (!activeNavigation.detail && !nextDetail) {
          return;
        }
      }

      void this.routeTo(new URL(activeNavigation.url.href), {
        history: activeNavigation.history,
        historyKey: activeNavigation.historyKey,
      });
      return;
    }

    const currentUrl = new URL(browserWindow().location.href);
    if (skipIfSame) {
      const nextDetail = this.resolve(currentUrl);
      if (
        nextDetail &&
        this.current.branch.length > 0 &&
        isSameDetail(this.current, nextDetail)
      ) {
        return;
      }

      if (
        !nextDetail &&
        this.lastRouteNotFoundDetail?.url.href === currentUrl.href
      ) {
        return;
      }
    }

    void this.routeTo(currentUrl, {
      history: "none",
      skipIfSame,
    });
  }

  private updateActiveNavigationDetail(
    navigationId: number,
    detail: RouterChangeDetail | null,
  ): void {
    if (this.activeNavigation?.id !== navigationId) {
      return;
    }

    this.activeNavigation.detail = detail;
  }

  private async routeTo(
    url: URL,
    options: RouteTransitionOptions & { historyKey?: string },
  ): Promise<void> {
    if (this.activeNavigation?.url.href !== url.href) {
      this.activeNavigation?.abortController.abort();
    }
    const currentNavigationId = ++this.navigationId;
    const abortController = new AbortController();
    const direction = this.resolveAttemptDirection(
      options.history,
      options.historyKey,
    );
    this.activeNavigation = {
      id: currentNavigationId,
      url: new URL(url.href),
      history: options.history,
      historyKey: options.historyKey,
      detail: null,
      abortController,
    };
    const signal = abortController.signal;
    const redirectDepth = options.redirectDepth ?? 0;

    try {
      const detail = this.resolve(url);
      this.updateActiveNavigationDetail(currentNavigationId, detail);

      const decision = await this.evaluateGuards(
        url,
        detail,
        direction,
        signal,
      );
      if (!decision) {
        return;
      }

      if (signal.aborted || this.isNavigationStale(currentNavigationId)) {
        return;
      }

      if (await this.followRedirect(url, decision, redirectDepth, direction)) {
        return;
      }

      if (!decision.allowed) {
        this.restoreCancelledNavigation(
          url,
          detail?.historyKey || options.historyKey,
          direction,
        );
        return;
      }

      if (!detail || detail.branch.length === 0) {
        this.dispatchRouteNotFound(url, direction);
        return;
      }

      if (this.shouldSkipNavigation(detail, options)) {
        return;
      }

      if (
        !(await this.loadBranchForNavigation(
          url,
          detail,
          currentNavigationId,
          direction,
          signal,
        ))
      ) {
        return;
      }

      this.commitNavigation(detail, options.history, options.historyKey);
    } finally {
      if (this.activeNavigation?.id === currentNavigationId) {
        this.activeNavigation = undefined;
      }
    }
  }

  private async evaluateGuards(
    url: URL,
    detail: RouterChangeDetail | null,
    direction: NavigationDirection,
    signal: AbortSignal,
  ): Promise<Awaited<ReturnType<Router["runGuards"]>> | null> {
    try {
      const result = await this.runGuards(detail, signal);
      return signal.aborted ? null : result;
    } catch (error) {
      if (signal.aborted) {
        return null;
      }
      this.dispatchRouteError(url, error, "guard", direction);
      return null;
    }
  }

  private async followRedirect(
    url: URL,
    decision: Awaited<ReturnType<Router["runGuards"]>>,
    redirectDepth: number,
    direction: NavigationDirection,
  ): Promise<boolean> {
    if (!decision.redirect) {
      return false;
    }

    const nextRedirectDepth = redirectDepth + 1;
    if (nextRedirectDepth > this.maxRedirectDepth) {
      this.dispatchRouteError(
        url,
        new Error("Redirect loop detected"),
        "guard",
        direction,
      );
      return true;
    }

    await this.routeTo(decision.redirect.to, {
      history: decision.redirect.replace ? "replace" : "push",
      redirectDepth: nextRedirectDepth,
    });
    return true;
  }

  private shouldSkipNavigation(
    detail: RouterChangeDetail,
    options: RouteTransitionOptions,
  ): boolean {
    if (
      options.history === "none" &&
      this.current.historyKey &&
      detail.historyKey !== this.current.historyKey
    ) {
      return false;
    }

    return options.skipIfSame !== false && isSameDetail(this.current, detail);
  }

  private async loadBranchForNavigation(
    url: URL,
    detail: RouterChangeDetail,
    navigationId: number,
    direction: NavigationDirection,
    signal: AbortSignal,
  ): Promise<boolean> {
    const shouldDispatchLoading = this.branchNeedsLoading(detail.branch);
    if (shouldDispatchLoading) {
      this.dispatchRouteLoading(
        "route-loading-start",
        detail.url,
        detail.branch,
        direction,
      );
    }

    try {
      await this.loadBranch(detail.branch, signal);
    } catch (error) {
      if (signal.aborted) {
        return false;
      }
      this.dispatchRouteError(url, error, "load", direction);
      return false;
    } finally {
      if (shouldDispatchLoading) {
        this.dispatchRouteLoading(
          "route-loading-end",
          detail.url,
          detail.branch,
          direction,
        );
      }
    }

    return !signal.aborted && !this.isNavigationStale(navigationId);
  }

  private commitNavigation(
    detail: RouterChangeDetail,
    history: HistoryMode | "none",
    historyKey?: string,
  ): void {
    const nextHistoryKey = this.updateHistory(detail.url, history, historyKey);
    const committedDetail: RouterChangeDetail = {
      ...detail,
      historyKey: nextHistoryKey,
      direction: this.resolveNavigationDirection(
        history,
        nextHistoryKey,
      ),
    };
    this.current = committedDetail;
    this.lastRouteErrorDetail = undefined;
    this.lastRouteNotFoundDetail = undefined;
    this.dispatchEvent(
      new CustomEvent<RouterChangeDetail>("route-change", {
        detail: committedDetail,
      }),
    );
  }

  private updateHistory(
    url: URL,
    history: HistoryMode | "none",
    historyKey?: string,
  ): string {
    if (history === "replace") {
      const nextKey = historyKey || this.getCurrentHistoryEntryKey();
      this.ensureHistoryEntryOrder(nextKey);
      browserWindow().history.replaceState(
        withHistoryEntryKey(browserWindow().history.state, nextKey),
        "",
        `${url.pathname}${url.search}${url.hash}`,
      );
      return nextKey;
    }

    if (history === "push") {
      const nextKey = historyKey || createHistoryEntryKey();
      this.ensureHistoryEntryOrder(nextKey);
      browserWindow().history.pushState(
        withHistoryEntryKey(null, nextKey),
        "",
        `${url.pathname}${url.search}${url.hash}`,
      );
      return nextKey;
    }

    const nextKey = historyKey || this.getCurrentHistoryEntryKey();
    this.ensureHistoryEntryOrder(nextKey);
    return nextKey;
  }

  private async runGuards(
    detail: RouterChangeDetail | null,
    signal: AbortSignal,
  ): Promise<{
    allowed: boolean;
    redirect?: RedirectInstruction;
  }> {
    const from = this.current.branch.length ? this.current : null;

    if (from) {
      const leavingRoutes = from.branch.slice(
        sharedBranchPrefixLength(from.branch, detail?.branch ?? []),
      ).reverse();

      for (const route of leavingRoutes) {
        if (signal.aborted) {
          return { allowed: false };
        }

        if (!route.beforeLeave) {
          continue;
        }

        const result = await route.beforeLeave({
          ...from,
          to: detail,
          router: this,
          signal,
        });
        if (signal.aborted) {
          return { allowed: false };
        }
        if (result === false) {
          return { allowed: false };
        }
        if (result && result !== true) {
          return {
            allowed: false,
            redirect: toRedirectInstruction(result, from.url.href),
          };
        }
      }
    }

    if (!detail) {
      return { allowed: true };
    }

    if (this.beforeRoute) {
      if (signal.aborted) {
        return { allowed: false };
      }

      const result = await this.beforeRoute({
        ...detail,
        from,
        router: this,
        signal,
      });
      if (signal.aborted) {
        return { allowed: false };
      }
      if (result === false) {
        return { allowed: false };
      }
      if (result && result !== true) {
        return {
          allowed: false,
          redirect: toRedirectInstruction(result, detail.url.href),
        };
      }
    }

    for (const route of detail.branch) {
      if (signal.aborted) {
        return { allowed: false };
      }

      if (!route.guard) {
        continue;
      }

      const result = await route.guard({
        ...detail,
        from,
        router: this,
        signal,
      });
      if (signal.aborted) {
        return { allowed: false };
      }
      if (result === false) {
        return { allowed: false };
      }
      if (result && result !== true) {
        return {
          allowed: false,
          redirect: toRedirectInstruction(result, detail.url.href),
        };
      }
    }

    return { allowed: true };
  }

  private branchNeedsLoading(branch: RouteDefinition[]): boolean {
    return branch.some((route) =>
      Boolean(
        route.load &&
          (!this.loadedRoutes.has(route) || this.pendingRouteLoads.has(route)),
      )
    );
  }

  private async loadBranch(
    branch: RouteDefinition[],
    signal: AbortSignal,
  ): Promise<void> {
    for (const route of branch) {
      if (signal.aborted) {
        return;
      }

      if (!route.load || this.loadedRoutes.has(route)) {
        continue;
      }

      const pendingLoad = this.pendingRouteLoads.get(route);
      if (pendingLoad && !pendingLoad.signal.aborted) {
        await pendingLoad.promise;
        continue;
      }

      const loadPromise = Promise.resolve()
        .then(() => route.load?.({ signal }))
        .then(() => {
          this.loadedRoutes.add(route);
        })
        .finally(() => {
          if (this.pendingRouteLoads.get(route)?.promise === loadPromise) {
            this.pendingRouteLoads.delete(route);
          }
        });

      this.pendingRouteLoads.set(route, { promise: loadPromise, signal });
      await loadPromise;
    }
  }

  private isNavigationStale(navigationId: number): boolean {
    return navigationId !== this.navigationId;
  }

  private ignoreNextPopState(): void {
    this.ignoredPopStates = Math.min(
      MAX_IGNORED_POP_STATES,
      this.ignoredPopStates + 1,
    );
  }

  private restoreCancelledNavigation(
    attemptedUrl: URL,
    attemptedHistoryKey: string | undefined,
    direction: NavigationDirection,
  ): void {
    if (
      direction === "none" ||
      !this.current.branch.length ||
      attemptedUrl.href !== browserWindow().location.href ||
      attemptedUrl.href === this.current.url.href
    ) {
      return;
    }

    const currentOrder = this.historyEntryOrders.get(this.current.historyKey);
    const attemptedOrder = attemptedHistoryKey
      ? this.historyEntryOrders.get(attemptedHistoryKey)
      : undefined;
    if (
      currentOrder !== undefined &&
      attemptedOrder !== undefined &&
      currentOrder !== attemptedOrder
    ) {
      if (this.restoreCancelledNavigationWithNavigationApi()) {
        return;
      }

      this.ignoreNextPopState();
      browserWindow().history.go(currentOrder - attemptedOrder);
      return;
    }

    if (this.restoreCancelledNavigationWithNavigationApi()) {
      return;
    }

    browserWindow().history.replaceState(
      withHistoryEntryKey(
        browserWindow().history.state,
        this.current.historyKey,
      ),
      "",
      `${this.current.url.pathname}${this.current.url.search}${this.current.url.hash}`,
    );
  }

  private restoreCancelledNavigationWithNavigationApi(): boolean {
    if (!this.navigationApi) {
      return false;
    }

    const href =
      `${this.current.url.pathname}${this.current.url.search}${this.current.url.hash}`;
    try {
      this.navigationApi.navigate(href, { history: "replace" });
      return true;
    } catch {
      return false;
    }
  }

  private dispatchRouteLoading(
    type: "route-loading-start" | "route-loading-end",
    url: URL,
    branch: RouteDefinition[],
    direction: NavigationDirection,
  ): void {
    this.activeRouteLoads = type === "route-loading-start"
      ? this.activeRouteLoads + 1
      : Math.max(0, this.activeRouteLoads - 1);
    this.dispatchEvent(
      new CustomEvent<RouteLoadingDetail>(type, {
        detail: {
          url,
          branch: [...branch],
          pending: this.activeRouteLoads,
          direction,
        },
      }),
    );
  }

  private dispatchRouteNotFound(
    url: URL,
    direction: NavigationDirection,
  ): void {
    const detail: RouteNotFoundDetail = {
      url,
      basePath: normalizeBasePath(this.basePath),
      direction,
    };
    this.lastRouteErrorDetail = undefined;
    this.lastRouteNotFoundDetail = detail;
    this.dispatchEvent(
      new CustomEvent<RouteNotFoundDetail>("route-not-found", {
        detail,
      }),
    );
    console.warn(`[router] No route matched for ${url.pathname}`);
  }

  private dispatchRouteError(
    url: URL,
    error: unknown,
    phase: RouteErrorDetail["phase"],
    direction: NavigationDirection,
  ): void {
    const detail: RouteErrorDetail = {
      url,
      error,
      phase,
      direction,
    };
    this.lastRouteNotFoundDetail = undefined;
    this.lastRouteErrorDetail = detail;
    this.dispatchEvent(
      new CustomEvent<RouteErrorDetail>("route-error", {
        detail,
      }),
    );
    console.error("[router] Route transition failed", error);
  }
}
