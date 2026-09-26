/**
 * StyleXN compatibility table: the single source of truth for what StyleX
 * styles do on React Native. Every enforcement layer (types, lint, Babel
 * plugin, runtime) reads this file and nothing else.
 *
 * Ground truth for `supported`/`partial` is React Native's own style types
 * (react-native/Libraries/StyleSheet/StyleSheetTypes.d.ts) for RN_TARGET.
 * React Strict DOM's native implementation informed the `polyfilled` set.
 *
 * Statuses describe StyleXN's target behavior. `polyfilled` entries are
 * implemented incrementally; the runtime's tests are the record of which
 * ones exist today.
 *
 * Keys are camelCase CSS property names, exactly as written in
 * `stylex.create`. Values in `partial` entries are keywords, function names,
 * or `<token>` patterns (`<length>`, `<percentage>`, `<color>`, ...).
 */

import type { Entry, RNVersion, Table } from "./types.ts";

export const RN_TARGET: RNVersion = "0.86";

// ---------------------------------------------------------------------------
// Small constructors to keep the table readable.
// ---------------------------------------------------------------------------

type Extra = Omit<Entry, "status">;

// Constructors keep `status` and `values` as literal types so the Layer 1
// types (src/types) can derive property and value unions from this table.
const ok = <const E extends Extra = Record<never, never>>(extra?: E) =>
  ({ status: "supported", ...extra }) as { readonly status: "supported" } & E;
const poly = <const E extends Extra = Record<never, never>>(note: string, extra?: E) =>
  ({ status: "polyfilled", note, ...extra }) as {
    readonly status: "polyfilled";
    readonly note: string;
  } & E;
const some = <const V extends readonly string[], const E extends Extra = Record<never, never>>(
  values: V,
  note: string,
  extra?: E,
) =>
  ({ status: "partial", values, note, ...extra }) as {
    readonly status: "partial";
    readonly values: V;
    readonly note: string;
  } & E;
const web = <const E extends Extra = Record<never, never>>(note: string, extra?: E) =>
  ({ status: "web-only", note, ...extra }) as {
    readonly status: "web-only";
    readonly note: string;
  } & E;
const no = <const E extends Extra = Record<never, never>>(note: string, extra?: E) =>
  ({ status: "unsupported", note, ...extra }) as {
    readonly status: "unsupported";
    readonly note: string;
  } & E;

const LENGTH = ["<length>", "<percentage>"] as const;
const SIZE = [...LENGTH, "auto"] as const;
const ALIGN = ["flex-start", "flex-end", "center", "stretch", "baseline"] as const;

const NO_FLOW = "React Native has no CSS flow layout; only flexbox.";
const NO_GRID = "React Native has no grid layout.";
const NO_ANIM = "Run by the StyleXN runtime with Animated (JS driver).";
const UNITLESS = "Length keywords other than auto are not supported.";

// ---------------------------------------------------------------------------
// Properties
// ---------------------------------------------------------------------------

export const properties = {
  // --- Custom properties -------------------------------------------------
  // Keys starting with "--" are matched by lookupProperty() against this entry.
  "--*": poly("CSS variables resolve through React context (defineVars/createTheme)."),

  // --- Box model / layout ------------------------------------------------
  display: some(["flex", "none", "contents"], `${NO_FLOW} block/inline/grid are not available.`),
  position: some(["relative", "absolute", "static"], "fixed and sticky have no native equivalent."),
  top: some(SIZE, UNITLESS),
  right: some(SIZE, UNITLESS),
  bottom: some(SIZE, UNITLESS),
  left: some(SIZE, UNITLESS),
  inset: some(SIZE, UNITLESS, { expandsTo: ["top", "right", "bottom", "left"] }),
  insetBlock: some(SIZE, UNITLESS, { expandsTo: ["insetBlockStart", "insetBlockEnd"] }),
  insetBlockStart: some(SIZE, UNITLESS),
  insetBlockEnd: some(SIZE, UNITLESS),
  insetInline: some(SIZE, UNITLESS, { expandsTo: ["insetInlineStart", "insetInlineEnd"] }),
  insetInlineStart: some(SIZE, UNITLESS),
  insetInlineEnd: some(SIZE, UNITLESS),
  zIndex: ok(),
  boxSizing: ok(),
  width: some(SIZE, `${UNITLESS} No fit-content/min-content/max-content.`),
  height: some(SIZE, `${UNITLESS} No fit-content/min-content/max-content.`),
  minWidth: some(SIZE, UNITLESS),
  minHeight: some(SIZE, UNITLESS),
  maxWidth: some(SIZE, UNITLESS),
  maxHeight: some(SIZE, UNITLESS),
  inlineSize: some(SIZE, "Renamed to width (horizontal writing mode assumed).", {
    native: "width",
  }),
  blockSize: some(SIZE, "Renamed to height (horizontal writing mode assumed).", {
    native: "height",
  }),
  minInlineSize: some(SIZE, "Renamed to minWidth.", { native: "minWidth" }),
  minBlockSize: some(SIZE, "Renamed to minHeight.", { native: "minHeight" }),
  maxInlineSize: some(SIZE, "Renamed to maxWidth.", { native: "maxWidth" }),
  maxBlockSize: some(SIZE, "Renamed to maxHeight.", { native: "maxHeight" }),
  aspectRatio: ok(),
  overflow: some(["visible", "hidden", "scroll"], "auto and clip are not supported."),
  overflowX: no("React Native has no per-axis overflow."),
  overflowY: no("React Native has no per-axis overflow."),
  overflowBlock: no("React Native has no per-axis overflow."),
  overflowInline: no("React Native has no per-axis overflow."),
  visibility: poly("hidden is emulated with opacity: 0 and pointerEvents: none."),
  direction: ok(),
  float: no(NO_FLOW),
  clear: no(NO_FLOW),

  // --- Flexbox -----------------------------------------------------------
  flex: ok({
    note: "Numbers keep React Native semantics; multi-value strings expand to CSS longhands.",
    expandsTo: ["flexGrow", "flexShrink", "flexBasis"],
  }),
  flexBasis: some(SIZE, UNITLESS),
  flexDirection: ok(),
  flexGrow: ok(),
  flexShrink: ok(),
  flexWrap: ok(),
  flexFlow: poly("Expanded to flexDirection and flexWrap.", {
    expandsTo: ["flexDirection", "flexWrap"],
  }),
  order: no("Yoga does not implement flex order."),
  alignContent: some(
    [
      "flex-start",
      "flex-end",
      "center",
      "stretch",
      "space-between",
      "space-around",
      "space-evenly",
    ],
    "start/end/normal are not supported.",
  ),
  alignItems: some(ALIGN, "start/end/normal/self-start/self-end are not supported."),
  alignSelf: some(["auto", ...ALIGN], "start/end/normal are not supported."),
  justifyContent: some(
    ["flex-start", "flex-end", "center", "space-between", "space-around", "space-evenly"],
    "start/end/left/right/normal/stretch are not supported.",
  ),
  justifyItems: no("Only meaningful in grid layout."),
  justifySelf: no("Only meaningful in grid layout."),
  placeContent: poly("Expanded to alignContent and justifyContent.", {
    expandsTo: ["alignContent", "justifyContent"],
  }),
  placeItems: no("Only meaningful in grid layout."),
  placeSelf: no("Only meaningful in grid layout."),
  gap: some(LENGTH, "Length or percentage only; expanded when multi-value.", {
    expandsTo: ["rowGap", "columnGap"],
  }),
  rowGap: some(LENGTH, "Length or percentage only."),
  columnGap: some(LENGTH, "Length or percentage only."),

  // --- Grid / multi-column / table / lists (none of these exist) ----------
  grid: no(NO_GRID),
  gridArea: no(NO_GRID),
  gridAutoColumns: no(NO_GRID),
  gridAutoFlow: no(NO_GRID),
  gridAutoRows: no(NO_GRID),
  gridColumn: no(NO_GRID),
  gridColumnEnd: no(NO_GRID),
  gridColumnStart: no(NO_GRID),
  gridRow: no(NO_GRID),
  gridRowEnd: no(NO_GRID),
  gridRowStart: no(NO_GRID),
  gridTemplate: no(NO_GRID),
  gridTemplateAreas: no(NO_GRID),
  gridTemplateColumns: no(NO_GRID),
  gridTemplateRows: no(NO_GRID),
  columns: no("No multi-column layout."),
  columnCount: no("No multi-column layout."),
  columnWidth: no("No multi-column layout."),
  columnRule: no("No multi-column layout."),
  columnSpan: no("No multi-column layout."),
  tableLayout: no("No table layout."),
  borderCollapse: no("No table layout."),
  borderSpacing: no("No table layout."),
  captionSide: no("No table layout."),
  emptyCells: no("No table layout."),
  listStyle: no("No list layout; render markers explicitly."),
  listStyleType: no("No list layout; render markers explicitly."),
  listStylePosition: no("No list layout; render markers explicitly."),
  listStyleImage: no("No list layout; render markers explicitly."),

  // --- Margin --------------------------------------------------------------
  margin: some(SIZE, "Multi-value strings are expanded to longhands.", {
    expandsTo: ["marginTop", "marginRight", "marginBottom", "marginLeft"],
  }),
  marginTop: some(SIZE, UNITLESS),
  marginRight: some(SIZE, UNITLESS),
  marginBottom: some(SIZE, UNITLESS),
  marginLeft: some(SIZE, UNITLESS),
  marginBlock: some(SIZE, UNITLESS, { expandsTo: ["marginBlockStart", "marginBlockEnd"] }),
  marginBlockStart: some(SIZE, UNITLESS),
  marginBlockEnd: some(SIZE, UNITLESS),
  marginInline: some(SIZE, UNITLESS, { expandsTo: ["marginInlineStart", "marginInlineEnd"] }),
  marginInlineStart: some(SIZE, UNITLESS),
  marginInlineEnd: some(SIZE, UNITLESS),

  // --- Padding -------------------------------------------------------------
  padding: some(LENGTH, "Multi-value strings are expanded to longhands.", {
    expandsTo: ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft"],
  }),
  paddingTop: some(LENGTH, UNITLESS),
  paddingRight: some(LENGTH, UNITLESS),
  paddingBottom: some(LENGTH, UNITLESS),
  paddingLeft: some(LENGTH, UNITLESS),
  paddingBlock: some(LENGTH, UNITLESS, { expandsTo: ["paddingBlockStart", "paddingBlockEnd"] }),
  paddingBlockStart: some(LENGTH, UNITLESS),
  paddingBlockEnd: some(LENGTH, UNITLESS),
  paddingInline: some(LENGTH, UNITLESS, { expandsTo: ["paddingInlineStart", "paddingInlineEnd"] }),
  paddingInlineStart: some(LENGTH, UNITLESS),
  paddingInlineEnd: some(LENGTH, UNITLESS),

  // --- Border: width -------------------------------------------------------
  borderWidth: some(["<length>"], "Numbers only; expanded when multi-value.", {
    expandsTo: ["borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth"],
  }),
  borderTopWidth: some(["<length>"], "Numbers only; no thin/medium/thick."),
  borderRightWidth: some(["<length>"], "Numbers only; no thin/medium/thick."),
  borderBottomWidth: some(["<length>"], "Numbers only; no thin/medium/thick."),
  borderLeftWidth: some(["<length>"], "Numbers only; no thin/medium/thick."),
  borderBlockWidth: poly("Expanded to top and bottom widths.", {
    expandsTo: ["borderTopWidth", "borderBottomWidth"],
  }),
  borderBlockStartWidth: some(["<length>"], "Renamed to borderTopWidth.", {
    native: "borderTopWidth",
  }),
  borderBlockEndWidth: some(["<length>"], "Renamed to borderBottomWidth.", {
    native: "borderBottomWidth",
  }),
  borderInlineWidth: poly("Expanded to start and end widths.", {
    expandsTo: ["borderStartWidth", "borderEndWidth"],
  }),
  borderInlineStartWidth: some(["<length>"], "Renamed to borderStartWidth.", {
    native: "borderStartWidth",
  }),
  borderInlineEndWidth: some(["<length>"], "Renamed to borderEndWidth.", {
    native: "borderEndWidth",
  }),

  // --- Border: color -------------------------------------------------------
  borderColor: some(["<color>"], "Expanded when multi-value.", {
    expandsTo: ["borderTopColor", "borderRightColor", "borderBottomColor", "borderLeftColor"],
  }),
  borderTopColor: ok(),
  borderRightColor: ok(),
  borderBottomColor: ok(),
  borderLeftColor: ok(),
  borderBlockColor: ok({ expandsTo: ["borderBlockStartColor", "borderBlockEndColor"] }),
  borderBlockStartColor: ok(),
  borderBlockEndColor: ok(),
  borderInlineColor: poly("Expanded to start and end colors.", {
    expandsTo: ["borderStartColor", "borderEndColor"],
  }),
  borderInlineStartColor: ok({ native: "borderStartColor" }),
  borderInlineEndColor: ok({ native: "borderEndColor" }),

  // --- Border: style -------------------------------------------------------
  borderStyle: some(
    ["solid", "dotted", "dashed", "none"],
    "none is emulated with borderWidth: 0.",
    {
      expandsTo: ["borderTopStyle", "borderRightStyle", "borderBottomStyle", "borderLeftStyle"],
    },
  ),
  borderTopStyle: poly(
    "React Native has one borderStyle for all sides; per-side styles are merged.",
  ),
  borderRightStyle: poly(
    "React Native has one borderStyle for all sides; per-side styles are merged.",
  ),
  borderBottomStyle: poly(
    "React Native has one borderStyle for all sides; per-side styles are merged.",
  ),
  borderLeftStyle: poly(
    "React Native has one borderStyle for all sides; per-side styles are merged.",
  ),
  borderBlockStyle: poly(
    "React Native has one borderStyle for all sides; per-side styles are merged.",
    { expandsTo: ["borderBlockStartStyle", "borderBlockEndStyle"] },
  ),
  borderBlockStartStyle: poly(
    "React Native has one borderStyle for all sides; per-side styles are merged.",
  ),
  borderBlockEndStyle: poly(
    "React Native has one borderStyle for all sides; per-side styles are merged.",
  ),
  borderInlineStyle: poly(
    "React Native has one borderStyle for all sides; per-side styles are merged.",
    { expandsTo: ["borderInlineStartStyle", "borderInlineEndStyle"] },
  ),
  borderInlineStartStyle: poly(
    "React Native has one borderStyle for all sides; per-side styles are merged.",
  ),
  borderInlineEndStyle: poly(
    "React Native has one borderStyle for all sides; per-side styles are merged.",
  ),

  // --- Border: shorthands --------------------------------------------------
  border: poly("Parsed and expanded to width, style and color.", {
    expandsTo: ["borderWidth", "borderStyle", "borderColor"],
  }),
  borderTop: poly("Parsed and expanded to width, style and color.", {
    expandsTo: ["borderTopWidth", "borderTopStyle", "borderTopColor"],
  }),
  borderRight: poly("Parsed and expanded to width, style and color.", {
    expandsTo: ["borderRightWidth", "borderRightStyle", "borderRightColor"],
  }),
  borderBottom: poly("Parsed and expanded to width, style and color.", {
    expandsTo: ["borderBottomWidth", "borderBottomStyle", "borderBottomColor"],
  }),
  borderLeft: poly("Parsed and expanded to width, style and color.", {
    expandsTo: ["borderLeftWidth", "borderLeftStyle", "borderLeftColor"],
  }),
  borderBlock: poly("Parsed and expanded to width, style and color.", {
    expandsTo: ["borderBlockWidth", "borderBlockStyle", "borderBlockColor"],
  }),
  borderBlockStart: poly("Parsed and expanded to width, style and color.", {
    expandsTo: ["borderBlockStartWidth", "borderBlockStartStyle", "borderBlockStartColor"],
  }),
  borderBlockEnd: poly("Parsed and expanded to width, style and color.", {
    expandsTo: ["borderBlockEndWidth", "borderBlockEndStyle", "borderBlockEndColor"],
  }),
  borderInline: poly("Parsed and expanded to width, style and color.", {
    expandsTo: ["borderInlineWidth", "borderInlineStyle", "borderInlineColor"],
  }),
  borderInlineStart: poly("Parsed and expanded to width, style and color.", {
    expandsTo: ["borderInlineStartWidth", "borderInlineStartStyle", "borderInlineStartColor"],
  }),
  borderInlineEnd: poly("Parsed and expanded to width, style and color.", {
    expandsTo: ["borderInlineEndWidth", "borderInlineEndStyle", "borderInlineEndColor"],
  }),

  // --- Border: radius ------------------------------------------------------
  borderRadius: some(LENGTH, "Single value or expanded per corner; no slash syntax.", {
    expandsTo: [
      "borderTopLeftRadius",
      "borderTopRightRadius",
      "borderBottomRightRadius",
      "borderBottomLeftRadius",
    ],
  }),
  borderTopLeftRadius: some(LENGTH, "No elliptical (two-value) radii."),
  borderTopRightRadius: some(LENGTH, "No elliptical (two-value) radii."),
  borderBottomRightRadius: some(LENGTH, "No elliptical (two-value) radii."),
  borderBottomLeftRadius: some(LENGTH, "No elliptical (two-value) radii."),
  borderStartStartRadius: some(LENGTH, "No elliptical (two-value) radii."),
  borderStartEndRadius: some(LENGTH, "No elliptical (two-value) radii."),
  borderEndStartRadius: some(LENGTH, "No elliptical (two-value) radii."),
  borderEndEndRadius: some(LENGTH, "No elliptical (two-value) radii."),
  borderImage: no("No border images."),
  borderImageSource: no("No border images."),
  borderImageSlice: no("No border images."),
  borderImageWidth: no("No border images."),
  borderImageOutset: no("No border images."),
  borderImageRepeat: no("No border images."),

  // --- Outline -------------------------------------------------------------
  outline: poly("Parsed and expanded to width, style and color.", {
    expandsTo: ["outlineWidth", "outlineStyle", "outlineColor"],
  }),
  outlineWidth: some(["<length>"], "Numbers only."),
  outlineStyle: some(
    ["solid", "dotted", "dashed", "none"],
    "none is emulated with outlineWidth: 0.",
  ),
  outlineColor: ok(),
  outlineOffset: ok(),

  // --- Background ----------------------------------------------------------
  background: some(["<color>"], "Only a single color; expanded to backgroundColor.", {
    expandsTo: ["backgroundColor"],
  }),
  backgroundColor: ok(),
  backgroundImage: some(
    ["linear-gradient", "radial-gradient"],
    "Gradients only, via the experimental React Native API; url() images need <Image>.",
    { native: "experimental_backgroundImage" },
  ),
  backgroundSize: some(
    ["<length>", "<percentage>", "auto"],
    "Experimental React Native API; cover/contain not supported.",
    { native: "experimental_backgroundSize" },
  ),
  backgroundPosition: some(
    ["<length>", "<percentage>", "top", "right", "bottom", "left", "center"],
    "Experimental React Native API.",
    { native: "experimental_backgroundPosition" },
  ),
  backgroundRepeat: some(
    ["repeat", "no-repeat", "space", "round"],
    "Experimental React Native API.",
    { native: "experimental_backgroundRepeat" },
  ),
  backgroundClip: no("No background clipping."),
  backgroundOrigin: no("No background origin."),
  backgroundAttachment: no("No scroll-attached backgrounds."),
  backgroundBlendMode: no("No background blend modes."),

  // --- Visual effects ------------------------------------------------------
  opacity: ok(),
  boxShadow: ok({
    since: "0.76",
    note: "CSS string syntax, including inset and multiple shadows.",
  }),
  filter: some(
    [
      "blur",
      "brightness",
      "contrast",
      "drop-shadow",
      "grayscale",
      "hue-rotate",
      "invert",
      "opacity",
      "saturate",
      "sepia",
    ],
    "url() filters are not supported.",
    { since: "0.76" },
  ),
  backdropFilter: no("No backdrop filters."),
  mixBlendMode: ok({ since: "0.76" }),
  isolation: ok({ since: "0.76" }),
  backfaceVisibility: ok(),
  clipPath: no("No clip paths; use overflow: hidden with borderRadius."),
  maskImage: no("No CSS masks."),
  maskSize: no("No CSS masks."),
  maskPosition: no("No CSS masks."),
  maskRepeat: no("No CSS masks."),
  boxDecorationBreak: no("No fragmentation."),
  imageRendering: web("Rendering hints have no native equivalent."),
  colorScheme: web("Color scheme is an app-level setting on native."),
  forcedColorAdjust: web("Forced colors mode does not exist on native."),
  printColorAdjust: web("No printing on native."),
  willChange: web("Performance hint only."),
  contain: web("Containment is a rendering hint only."),
  contentVisibility: web("Rendering hint only."),

  // --- Transforms ----------------------------------------------------------
  transform: some(
    [
      "perspective",
      "rotate",
      "rotateX",
      "rotateY",
      "rotateZ",
      "scale",
      "scaleX",
      "scaleY",
      "translateX",
      "translateY",
      "skewX",
      "skewY",
      "matrix",
    ],
    "No 3d translate/scale, rotate3d, matrix3d, or two-argument translate()/skew().",
  ),
  transformOrigin: ok(),
  transformStyle: no("No preserve-3d."),
  perspective: no("Use perspective() inside transform."),
  perspectiveOrigin: no("No perspective origin."),
  rotate: poly("Folded into transform at compile time."),
  scale: poly("Folded into transform at compile time."),
  translate: poly("Folded into transform at compile time."),

  // --- Transitions & animations ---------------------------------------------
  transition: poly(`${NO_ANIM} Expanded to longhands.`, {
    expandsTo: [
      "transitionProperty",
      "transitionDuration",
      "transitionTimingFunction",
      "transitionDelay",
    ],
  }),
  transitionProperty: poly(NO_ANIM),
  transitionDuration: poly(NO_ANIM),
  transitionTimingFunction: poly(`${NO_ANIM} steps() falls back to linear.`),
  transitionDelay: poly(NO_ANIM),
  transitionBehavior: web("Discrete transitions have no native meaning."),
  animation: poly(`${NO_ANIM} Expanded to longhands.`, {
    expandsTo: [
      "animationName",
      "animationDuration",
      "animationTimingFunction",
      "animationDelay",
      "animationIterationCount",
      "animationDirection",
      "animationFillMode",
      "animationPlayState",
    ],
  }),
  animationName: poly(`${NO_ANIM} The name must come from stylex.keyframes().`),
  animationDuration: poly(NO_ANIM),
  animationTimingFunction: poly(`${NO_ANIM} steps() falls back to linear.`),
  animationDelay: poly(NO_ANIM),
  animationIterationCount: poly(NO_ANIM),
  animationDirection: poly(NO_ANIM),
  animationFillMode: poly(NO_ANIM),
  animationPlayState: poly(NO_ANIM),
  animationComposition: no("No animation composition."),
  animationTimeline: no("No scroll-driven animations."),
  viewTransitionName: web("View transitions are a web API."),

  // --- Text ----------------------------------------------------------------
  color: ok(),
  fontFamily: some(["<string>"], "One family name; fallback lists use the first entry."),
  fontSize: some(["<length>"], "Numbers only; no keyword sizes."),
  fontStyle: some(["normal", "italic"], "oblique is treated as italic."),
  fontWeight: some(
    ["<number>", "normal", "bold", "100", "200", "300", "400", "500", "600", "700", "800", "900"],
    "bolder/lighter are not supported.",
  ),
  fontVariant: poly("Space-separated string converted to React Native's array form."),
  fontVariantNumeric: poly("Merged into fontVariant.", { native: "fontVariant" }),
  fontVariantLigatures: poly("Merged into fontVariant.", { native: "fontVariant" }),
  fontVariantCaps: some(["normal", "small-caps"], "Merged into fontVariant.", {
    native: "fontVariant",
  }),
  fontFeatureSettings: no("No OpenType feature settings API."),
  fontStretch: no("Font stretch is not exposed by React Native."),
  fontKerning: no("Kerning is not exposed by React Native."),
  fontOpticalSizing: no("Not exposed by React Native."),
  fontSynthesis: no("Not exposed by React Native."),
  font: no("Expand to longhands; the font shorthand grammar is not parsed."),
  letterSpacing: some(["<length>"], "Numbers only; normal is 0."),
  lineHeight: poly("Unitless multipliers are resolved against fontSize; lengths pass through."),
  textAlign: some(
    ["auto", "left", "right", "center", "justify"],
    "start/end are mapped via direction.",
  ),
  textAlignLast: no("Not supported by React Native text layout."),
  textDecoration: poly("Parsed and expanded to line, style and color.", {
    expandsTo: ["textDecorationLine", "textDecorationStyle", "textDecorationColor"],
  }),
  textDecorationLine: some(
    ["none", "underline", "line-through", "underline line-through"],
    "overline is not supported.",
  ),
  textDecorationStyle: some(["solid", "double", "dotted", "dashed"], "iOS only.", {
    platform: "ios",
  }),
  textDecorationColor: ok({ platform: "ios", note: "iOS only." }),
  textDecorationThickness: no("Not supported by React Native."),
  textUnderlineOffset: no("Not supported by React Native."),
  textShadow: poly("Parsed and expanded to React Native's textShadow* keys.", {
    expandsTo: ["textShadowOffsetX", "textShadowOffsetY", "textShadowRadius", "textShadowColor"],
  }),
  textTransform: ok(),
  textIndent: no("Not supported by React Native text layout."),
  textOverflow: some(["ellipsis", "clip"], "Becomes the ellipsizeMode prop on <Text>.", {
    prop: "ellipsizeMode",
  }),
  textWrap: no("Not supported by React Native text layout."),
  whiteSpace: no("Not supported; text wraps by default, nowrap needs numberOfLines."),
  wordBreak: no("Not supported by React Native text layout."),
  overflowWrap: no("Not supported by React Native text layout."),
  wordWrap: no("Not supported by React Native text layout."),
  hyphens: no("Not supported by React Native text layout."),
  lineClamp: poly("Becomes the numberOfLines prop on <Text>.", { prop: "numberOfLines" }),
  WebkitLineClamp: poly("Becomes the numberOfLines prop on <Text>.", { prop: "numberOfLines" }),
  verticalAlign: some(["auto", "top", "bottom", "middle"], "Android only.", {
    platform: "android",
  }),
  userSelect: ok(),
  textRendering: web("Rendering hint only."),
  WebkitFontSmoothing: web("Rendering hint only."),
  MozOsxFontSmoothing: web("Rendering hint only."),
  tabSize: web("No tab rendering control on native."),
  writingMode: no("Vertical writing modes are not supported."),
  unicodeBidi: no("Not exposed by React Native."),
  wordSpacing: no("Not exposed by React Native."),
  textSizeAdjust: web("Handled by allowFontScaling on native."),

  // --- Interaction / UI ----------------------------------------------------
  cursor: some(["auto", "pointer"], "Other cursors are not supported."),
  pointerEvents: some(["auto", "none", "box-none", "box-only"], "Other values are not supported."),
  touchAction: no("Gesture handling is imperative on native."),
  caretColor: ok({ prop: "cursorColor", note: "Becomes the cursorColor prop on <TextInput>." }),
  accentColor: no("No accent color; style controls explicitly."),
  appearance: web("No native form-control appearance switch."),
  resize: web("No resizable elements."),
  scrollBehavior: web("Use scrollTo({ animated }) on native."),
  scrollSnapType: no("Use pagingEnabled/snapToInterval props on ScrollView."),
  scrollSnapAlign: no("Use pagingEnabled/snapToInterval props on ScrollView."),
  scrollSnapStop: no("Use pagingEnabled/snapToInterval props on ScrollView."),
  scrollMargin: no("Not supported."),
  scrollPadding: no("Not supported."),
  overscrollBehavior: no("Use bounces/overScrollMode props on ScrollView."),
  scrollbarWidth: web("Use showsVerticalScrollIndicator on native."),
  scrollbarColor: web("Use indicatorStyle on native."),
  scrollbarGutter: web("No scrollbar gutters on native."),

  // --- Images / replaced elements -------------------------------------------
  objectFit: ok({ note: "Applies to <Image> only." }),
  objectPosition: no("Not supported by <Image>."),

  // --- Generated content / misc ---------------------------------------------
  content: no("No pseudo-element content; render children."),
  quotes: web("Generated content is web-only."),
  counterReset: web("Generated content is web-only."),
  counterIncrement: web("Generated content is web-only."),
  containerType: no("Container queries are not supported."),
  containerName: no("Container queries are not supported."),
  all: no("Cannot reset all properties."),
} as const satisfies Table;

export type KnownProperty = keyof typeof properties;

/** The same table with wide `Entry` types, for runtime code that reads any field. */
export const propertyEntries: Table = properties;

/**
 * Keys outside CSS that `native` renames and `expandsTo` expansions may
 * target: React Native-only style keys, plus StyleXN pseudo-longhands that
 * the lowering step folds into React Native shapes (textShadowOffset).
 */
export const rnOnlyKeys: ReadonlySet<string> = new Set([
  "borderStartWidth",
  "borderEndWidth",
  "borderStartColor",
  "borderEndColor",
  "textShadowColor",
  "textShadowOffsetX",
  "textShadowOffsetY",
  "textShadowRadius",
  "experimental_backgroundImage",
  "experimental_backgroundSize",
  "experimental_backgroundPosition",
  "experimental_backgroundRepeat",
]);

// ---------------------------------------------------------------------------
// Pseudo-classes (as StyleX condition keys)
// ---------------------------------------------------------------------------

const INTERACTION = "Tracked at runtime via Pressable/focus state on the styled element.";
const STRUCTURAL = "Structural selectors need sibling context React Native does not expose.";
const FORM_STATE = "Form control state is prop-driven; pass it to the style function instead.";

export const pseudoClasses = {
  ":hover": poly(`${INTERACTION} Only fires with a pointer device.`),
  ":active": poly(INTERACTION),
  ":focus": poly(INTERACTION),
  ":focus-visible": poly(`${INTERACTION} Treated like :focus.`),
  ":focus-within": poly(`${INTERACTION} Requires descendant focus tracking.`),
  ":disabled": poly("Derived from the disabled prop."),
  ":enabled": poly("Derived from the disabled prop."),
  ":checked": no(FORM_STATE),
  ":indeterminate": no(FORM_STATE),
  ":default": no(FORM_STATE),
  ":required": no(FORM_STATE),
  ":optional": no(FORM_STATE),
  ":valid": no(FORM_STATE),
  ":invalid": no(FORM_STATE),
  ":in-range": no(FORM_STATE),
  ":out-of-range": no(FORM_STATE),
  ":read-only": no(FORM_STATE),
  ":read-write": no(FORM_STATE),
  ":placeholder-shown": no(FORM_STATE),
  ":autofill": web("Autofill state is a browser concept."),
  ":first-child": no(STRUCTURAL),
  ":last-child": no(STRUCTURAL),
  ":only-child": no(STRUCTURAL),
  ":first-of-type": no(STRUCTURAL),
  ":last-of-type": no(STRUCTURAL),
  ":only-of-type": no(STRUCTURAL),
  ":nth-child": no(STRUCTURAL),
  ":nth-last-child": no(STRUCTURAL),
  ":nth-of-type": no(STRUCTURAL),
  ":empty": no(STRUCTURAL),
  ":link": web("Link states are a browser concept."),
  ":visited": web("Link states are a browser concept."),
  ":any-link": web("Link states are a browser concept."),
  ":target": web("URL fragments are a browser concept."),
  ":fullscreen": web("Fullscreen API is a browser concept."),
} as const satisfies Table;

export const pseudoElements = {
  "::placeholder": some(
    ["color"],
    "Only color, via the placeholderTextColor prop on <TextInput>.",
    {
      prop: "placeholderTextColor",
    },
  ),
  "::selection": web("Selection styling is not exposed on native."),
  "::before": no("No generated content; render an element."),
  "::after": no("No generated content; render an element."),
  "::first-line": no("No line-level styling."),
  "::first-letter": no("No character-level styling."),
  "::marker": no("No list markers."),
  "::backdrop": no("No top-layer backdrop."),
  "::thumb": web("Form control internals are web-only."),
  "::track": web("Form control internals are web-only."),
  "::-webkit-scrollbar": web("Scrollbar styling is web-only."),
} as const satisfies Table;

// ---------------------------------------------------------------------------
// At-rules and media features (as StyleX condition keys)
// ---------------------------------------------------------------------------

export const atRules = {
  "@media": some(
    [
      "width",
      "min-width",
      "max-width",
      "height",
      "min-height",
      "max-height",
      "aspect-ratio",
      "min-aspect-ratio",
      "max-aspect-ratio",
      "orientation",
      "resolution",
      "min-resolution",
      "max-resolution",
      "prefers-color-scheme",
      "prefers-reduced-motion",
      "hover",
      "any-hover",
      "pointer",
      "any-pointer",
    ],
    "Evaluated at runtime against window dimensions, color scheme and accessibility settings.",
  ),
  "@container": no("Container queries need layout measurement StyleXN does not do."),
  "@supports": web("Feature queries evaluate against CSS; native ignores the block."),
  "@starting-style": web("Entry animations are a web API."),
} as const satisfies Table;

/** How each `@media` feature is evaluated on native. */
export const mediaFeatures = {
  width: poly("useWindowDimensions().width"),
  "min-width": poly("useWindowDimensions().width"),
  "max-width": poly("useWindowDimensions().width"),
  height: poly("useWindowDimensions().height"),
  "min-height": poly("useWindowDimensions().height"),
  "max-height": poly("useWindowDimensions().height"),
  "aspect-ratio": poly("useWindowDimensions()"),
  "min-aspect-ratio": poly("useWindowDimensions()"),
  "max-aspect-ratio": poly("useWindowDimensions()"),
  orientation: poly("useWindowDimensions()"),
  resolution: poly("PixelRatio.get()"),
  "min-resolution": poly("PixelRatio.get()"),
  "max-resolution": poly("PixelRatio.get()"),
  "prefers-color-scheme": poly("useColorScheme()"),
  "prefers-reduced-motion": poly("AccessibilityInfo.isReduceMotionEnabled()"),
  hover: poly("Assumed none on touch devices."),
  "any-hover": poly("Assumed none on touch devices."),
  pointer: poly("Assumed coarse on touch devices."),
  "any-pointer": poly("Assumed coarse on touch devices."),
  "prefers-contrast": no("Not exposed cross-platform."),
  "forced-colors": web("Evaluates to false on native."),
  "display-mode": web("Evaluates to false on native."),
  print: web("Evaluates to false on native."),
  screen: web("Evaluates to true on native."),
  scripting: web("Evaluates to enabled on native."),
  "color-gamut": no("Not exposed by React Native."),
  "dynamic-range": no("Not exposed by React Native."),
  "inverted-colors": poly("AccessibilityInfo.isInvertColorsEnabled() (iOS)."),
} as const satisfies Table;

// ---------------------------------------------------------------------------
// Units and value functions
// ---------------------------------------------------------------------------

export const units = {
  "<number>": ok(),
  px: ok({ note: "Converted to a plain number." }),
  "%": some(["<percentage>"], "Accepted where React Native accepts percentages."),
  rem: poly("Multiplied by the configured root font size (default 16)."),
  em: poly("Resolved against the inherited font size at runtime."),
  vw: poly("Resolved against window width at runtime."),
  vh: poly("Resolved against window height at runtime."),
  vmin: poly("Resolved against window dimensions at runtime."),
  vmax: poly("Resolved against window dimensions at runtime."),
  dvw: poly("Treated as vw."),
  dvh: poly("Treated as vh."),
  svw: poly("Treated as vw."),
  svh: poly("Treated as vh."),
  lvw: poly("Treated as vw."),
  lvh: poly("Treated as vh."),
  pt: poly("Converted to px at compile time (1pt = 4/3px)."),
  pc: poly("Converted to px at compile time."),
  in: poly("Converted to px at compile time (1in = 96px)."),
  cm: poly("Converted to px at compile time."),
  mm: poly("Converted to px at compile time."),
  q: poly("Converted to px at compile time."),
  ch: no("Font metrics are not exposed."),
  ex: no("Font metrics are not exposed."),
  cap: no("Font metrics are not exposed."),
  ic: no("Font metrics are not exposed."),
  lh: no("Line height metrics are not exposed."),
  rlh: no("Line height metrics are not exposed."),
  cqw: no("Container queries are not supported."),
  cqh: no("Container queries are not supported."),
  deg: ok({ note: "In transforms and gradients." }),
  rad: ok({ note: "In transforms." }),
  turn: poly("Converted to deg at compile time."),
  grad: poly("Converted to deg at compile time."),
  ms: ok({ note: "In transitions and animations." }),
  s: ok({ note: "In transitions and animations." }),
  fr: no(NO_GRID),
  dpi: poly("Media queries only."),
  dppx: poly("Media queries only."),
  x: poly("Media queries only."),
} as const satisfies Table;

export const functions = {
  "var()": poly("Resolved from React context at runtime."),
  "calc()": some(
    ["<length>", "<percentage>", "<number>"],
    "Constant-folded at compile time when every operand is static and unit-compatible; otherwise rejected.",
  ),
  "min()": some(["<length>", "<number>"], "Constant-folded at compile time when static."),
  "max()": some(["<length>", "<number>"], "Constant-folded at compile time when static."),
  "clamp()": some(["<length>", "<number>"], "Constant-folded at compile time when static."),
  "env()": no("Safe-area insets come from react-native-safe-area-context, not styles."),
  "attr()": no("No attribute access from styles."),
  "counter()": no("No generated content."),
  "url()": no("Not supported in styles; use <Image source>."),
  "rgb()": ok(),
  "rgba()": ok(),
  "hsl()": ok(),
  "hsla()": ok(),
  "hwb()": ok(),
  "lab()": poly("Converted to rgb at compile time when static."),
  "lch()": poly("Converted to rgb at compile time when static."),
  "oklab()": poly("Converted to rgb at compile time when static."),
  "oklch()": poly("Converted to rgb at compile time when static."),
  "color()": poly("Converted to rgb at compile time when static."),
  "color-mix()": poly("Converted to rgb at compile time when static."),
  "light-dark()": poly("Rewritten to a prefers-color-scheme condition at compile time."),
  "linear-gradient()": ok({ note: "Via backgroundImage." }),
  "radial-gradient()": ok({ note: "Via backgroundImage." }),
  "conic-gradient()": no("Not supported by React Native backgrounds."),
  "repeating-linear-gradient()": no("Not supported by React Native backgrounds."),
  "repeating-radial-gradient()": no("Not supported by React Native backgrounds."),
  "image-set()": no("Use <Image source> with scale variants."),
  "cubic-bezier()": poly("Mapped to Easing.bezier()."),
  "steps()": no("No step easing in Animated."),
  "linear()": no("No linear() easing in Animated."),
} as const satisfies Table;

// ---------------------------------------------------------------------------
// StyleX API surface
// ---------------------------------------------------------------------------

export const apis = {
  create: ok(),
  props: ok({ note: "Returns { style, ...props }; extra props come from entries with `prop`." }),
  attrs: ok({ note: "Alias of props on native." }),
  defineVars: poly("Variables become a React context value."),
  defineConsts: ok({ note: "Inlined at compile time." }),
  createTheme: poly("Themes become a context provider for the subtree."),
  keyframes: poly(NO_ANIM),
  firstThatWorks: poly("Picks the first value the compat table accepts, at compile time."),
  positionTry: no("Anchor positioning does not exist on native."),
  viewTransitionClass: web("View transitions are a web API."),
  defineMarker: no("Markers depend on CSS selectors."),
  when: no("Ancestor/sibling conditions (stylex.when.*) depend on CSS selectors."),
  types: ok({ note: "Typed variables are compile-time only." }),
  env: ok({ note: "Compile-time constants." }),
} as const satisfies Table;
