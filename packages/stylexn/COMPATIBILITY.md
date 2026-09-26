# StyleXN compatibility

<!-- Generated from src/compat/table.ts by scripts/compat-docs.ts. Do not edit by hand: run `pnpm compat:docs`. -->

What StyleX styles do when StyleXN renders them on React Native. The target is React Native **0.86**; a **Since** version marks behaviour that needs at least that React Native, and `stylexn check --rn-version` and the Babel plugin evaluate entries against the installed version.

This file is rendered from `src/compat/table.ts`, the table that the types, the lint rule, the Babel plugin and the runtime all read, so the documentation and the tooling cannot disagree.

## Statuses

| Status        | Meaning                                                                                                    |
| ------------- | ---------------------------------------------------------------------------------------------------------- |
| `supported`   | Maps directly to React Native, possibly under another style key or after compile-time shorthand expansion. |
| `polyfilled`  | StyleXN emulates it, at compile time or at runtime.                                                        |
| `partial`     | Only the listed values are accepted.                                                                       |
| `web-only`    | Valid on web, deliberately ignored on native. Not an error; `web({ })` marks it as intentional.            |
| `unsupported` | No reasonable native behaviour. An error in strict builds (`CI`).                                          |

## Summary

| Table           | Entries | supported | polyfilled | partial | web-only | unsupported |
| --------------- | ------- | --------- | ---------- | ------- | -------- | ----------- |
| Properties      | 302     | 33        | 54         | 98      | 23       | 94          |
| Pseudo-classes  | 35      | 0         | 7          | 0       | 6        | 22          |
| Pseudo-elements | 11      | 0         | 0          | 1       | 4        | 6           |
| At-rules        | 4       | 0         | 0          | 1       | 2        | 1           |
| Media features  | 28      | 0         | 20         | 0       | 5        | 3           |
| Units           | 39      | 6         | 23         | 1       | 0        | 9           |
| Functions       | 30      | 7         | 11         | 4       | 0        | 8           |
| StyleX API      | 14      | 6         | 4          | 0       | 1        | 3           |

## Properties

Keys are camelCase CSS property names, as written in `stylex.create`. Custom properties (`--*`) share one entry.

### Custom properties

| Property | Status     | Notes                                                                 |
| -------- | ---------- | --------------------------------------------------------------------- |
| `--*`    | polyfilled | CSS variables resolve through React context (defineVars/createTheme). |

### Box model / layout

| Property           | Status      | Notes                                                                                                                                           |
| ------------------ | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `display`          | partial     | React Native has no CSS flow layout; only flexbox. block/inline/grid are not available. Values: `flex`, `none`, `contents`.                     |
| `position`         | partial     | fixed and sticky have no native equivalent. Values: `relative`, `absolute`, `static`.                                                           |
| `top`              | partial     | Length keywords other than auto are not supported. Values: `<length>`, `<percentage>`, `auto`.                                                  |
| `right`            | partial     | Length keywords other than auto are not supported. Values: `<length>`, `<percentage>`, `auto`.                                                  |
| `bottom`           | partial     | Length keywords other than auto are not supported. Values: `<length>`, `<percentage>`, `auto`.                                                  |
| `left`             | partial     | Length keywords other than auto are not supported. Values: `<length>`, `<percentage>`, `auto`.                                                  |
| `inset`            | partial     | Length keywords other than auto are not supported. Values: `<length>`, `<percentage>`, `auto`. Expands to `top`, `right`, `bottom`, `left`.     |
| `insetBlock`       | partial     | Length keywords other than auto are not supported. Values: `<length>`, `<percentage>`, `auto`. Expands to `insetBlockStart`, `insetBlockEnd`.   |
| `insetBlockStart`  | partial     | Length keywords other than auto are not supported. Values: `<length>`, `<percentage>`, `auto`.                                                  |
| `insetBlockEnd`    | partial     | Length keywords other than auto are not supported. Values: `<length>`, `<percentage>`, `auto`.                                                  |
| `insetInline`      | partial     | Length keywords other than auto are not supported. Values: `<length>`, `<percentage>`, `auto`. Expands to `insetInlineStart`, `insetInlineEnd`. |
| `insetInlineStart` | partial     | Length keywords other than auto are not supported. Values: `<length>`, `<percentage>`, `auto`.                                                  |
| `insetInlineEnd`   | partial     | Length keywords other than auto are not supported. Values: `<length>`, `<percentage>`, `auto`.                                                  |
| `zIndex`           | supported   |                                                                                                                                                 |
| `boxSizing`        | supported   |                                                                                                                                                 |
| `width`            | partial     | Length keywords other than auto are not supported. No fit-content/min-content/max-content. Values: `<length>`, `<percentage>`, `auto`.          |
| `height`           | partial     | Length keywords other than auto are not supported. No fit-content/min-content/max-content. Values: `<length>`, `<percentage>`, `auto`.          |
| `minWidth`         | partial     | Length keywords other than auto are not supported. Values: `<length>`, `<percentage>`, `auto`.                                                  |
| `minHeight`        | partial     | Length keywords other than auto are not supported. Values: `<length>`, `<percentage>`, `auto`.                                                  |
| `maxWidth`         | partial     | Length keywords other than auto are not supported. Values: `<length>`, `<percentage>`, `auto`.                                                  |
| `maxHeight`        | partial     | Length keywords other than auto are not supported. Values: `<length>`, `<percentage>`, `auto`.                                                  |
| `inlineSize`       | partial     | Renamed to width (horizontal writing mode assumed). Values: `<length>`, `<percentage>`, `auto`. React Native key: `width`.                      |
| `blockSize`        | partial     | Renamed to height (horizontal writing mode assumed). Values: `<length>`, `<percentage>`, `auto`. React Native key: `height`.                    |
| `minInlineSize`    | partial     | Renamed to minWidth. Values: `<length>`, `<percentage>`, `auto`. React Native key: `minWidth`.                                                  |
| `minBlockSize`     | partial     | Renamed to minHeight. Values: `<length>`, `<percentage>`, `auto`. React Native key: `minHeight`.                                                |
| `maxInlineSize`    | partial     | Renamed to maxWidth. Values: `<length>`, `<percentage>`, `auto`. React Native key: `maxWidth`.                                                  |
| `maxBlockSize`     | partial     | Renamed to maxHeight. Values: `<length>`, `<percentage>`, `auto`. React Native key: `maxHeight`.                                                |
| `aspectRatio`      | supported   |                                                                                                                                                 |
| `overflow`         | partial     | auto and clip are not supported. Values: `visible`, `hidden`, `scroll`.                                                                         |
| `overflowX`        | unsupported | React Native has no per-axis overflow.                                                                                                          |
| `overflowY`        | unsupported | React Native has no per-axis overflow.                                                                                                          |
| `overflowBlock`    | unsupported | React Native has no per-axis overflow.                                                                                                          |
| `overflowInline`   | unsupported | React Native has no per-axis overflow.                                                                                                          |
| `visibility`       | polyfilled  | hidden is emulated with opacity: 0 and pointerEvents: none.                                                                                     |
| `direction`        | supported   |                                                                                                                                                 |
| `float`            | unsupported | React Native has no CSS flow layout; only flexbox.                                                                                              |
| `clear`            | unsupported | React Native has no CSS flow layout; only flexbox.                                                                                              |

### Flexbox

| Property         | Status      | Notes                                                                                                                                               |
| ---------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `flex`           | supported   | Numbers keep React Native semantics; multi-value strings expand to CSS longhands. Expands to `flexGrow`, `flexShrink`, `flexBasis`.                 |
| `flexBasis`      | partial     | Length keywords other than auto are not supported. Values: `<length>`, `<percentage>`, `auto`.                                                      |
| `flexDirection`  | supported   |                                                                                                                                                     |
| `flexGrow`       | supported   |                                                                                                                                                     |
| `flexShrink`     | supported   |                                                                                                                                                     |
| `flexWrap`       | supported   |                                                                                                                                                     |
| `flexFlow`       | polyfilled  | Expanded to flexDirection and flexWrap. Expands to `flexDirection`, `flexWrap`.                                                                     |
| `order`          | unsupported | Yoga does not implement flex order.                                                                                                                 |
| `alignContent`   | partial     | start/end/normal are not supported. Values: `flex-start`, `flex-end`, `center`, `stretch`, `space-between`, `space-around`, `space-evenly`.         |
| `alignItems`     | partial     | start/end/normal/self-start/self-end are not supported. Values: `flex-start`, `flex-end`, `center`, `stretch`, `baseline`.                          |
| `alignSelf`      | partial     | start/end/normal are not supported. Values: `auto`, `flex-start`, `flex-end`, `center`, `stretch`, `baseline`.                                      |
| `justifyContent` | partial     | start/end/left/right/normal/stretch are not supported. Values: `flex-start`, `flex-end`, `center`, `space-between`, `space-around`, `space-evenly`. |
| `justifyItems`   | unsupported | Only meaningful in grid layout.                                                                                                                     |
| `justifySelf`    | unsupported | Only meaningful in grid layout.                                                                                                                     |
| `placeContent`   | polyfilled  | Expanded to alignContent and justifyContent. Expands to `alignContent`, `justifyContent`.                                                           |
| `placeItems`     | unsupported | Only meaningful in grid layout.                                                                                                                     |
| `placeSelf`      | unsupported | Only meaningful in grid layout.                                                                                                                     |
| `gap`            | partial     | Length or percentage only; expanded when multi-value. Values: `<length>`, `<percentage>`. Expands to `rowGap`, `columnGap`.                         |
| `rowGap`         | partial     | Length or percentage only. Values: `<length>`, `<percentage>`.                                                                                      |
| `columnGap`      | partial     | Length or percentage only. Values: `<length>`, `<percentage>`.                                                                                      |

### Grid / multi-column / table / lists (none of these exist)

| Property              | Status      | Notes                                      |
| --------------------- | ----------- | ------------------------------------------ |
| `grid`                | unsupported | React Native has no grid layout.           |
| `gridArea`            | unsupported | React Native has no grid layout.           |
| `gridAutoColumns`     | unsupported | React Native has no grid layout.           |
| `gridAutoFlow`        | unsupported | React Native has no grid layout.           |
| `gridAutoRows`        | unsupported | React Native has no grid layout.           |
| `gridColumn`          | unsupported | React Native has no grid layout.           |
| `gridColumnEnd`       | unsupported | React Native has no grid layout.           |
| `gridColumnStart`     | unsupported | React Native has no grid layout.           |
| `gridRow`             | unsupported | React Native has no grid layout.           |
| `gridRowEnd`          | unsupported | React Native has no grid layout.           |
| `gridRowStart`        | unsupported | React Native has no grid layout.           |
| `gridTemplate`        | unsupported | React Native has no grid layout.           |
| `gridTemplateAreas`   | unsupported | React Native has no grid layout.           |
| `gridTemplateColumns` | unsupported | React Native has no grid layout.           |
| `gridTemplateRows`    | unsupported | React Native has no grid layout.           |
| `columns`             | unsupported | No multi-column layout.                    |
| `columnCount`         | unsupported | No multi-column layout.                    |
| `columnWidth`         | unsupported | No multi-column layout.                    |
| `columnRule`          | unsupported | No multi-column layout.                    |
| `columnSpan`          | unsupported | No multi-column layout.                    |
| `tableLayout`         | unsupported | No table layout.                           |
| `borderCollapse`      | unsupported | No table layout.                           |
| `borderSpacing`       | unsupported | No table layout.                           |
| `captionSide`         | unsupported | No table layout.                           |
| `emptyCells`          | unsupported | No table layout.                           |
| `listStyle`           | unsupported | No list layout; render markers explicitly. |
| `listStyleType`       | unsupported | No list layout; render markers explicitly. |
| `listStylePosition`   | unsupported | No list layout; render markers explicitly. |
| `listStyleImage`      | unsupported | No list layout; render markers explicitly. |

### Margin

| Property            | Status  | Notes                                                                                                                                                           |
| ------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `margin`            | partial | Multi-value strings are expanded to longhands. Values: `<length>`, `<percentage>`, `auto`. Expands to `marginTop`, `marginRight`, `marginBottom`, `marginLeft`. |
| `marginTop`         | partial | Length keywords other than auto are not supported. Values: `<length>`, `<percentage>`, `auto`.                                                                  |
| `marginRight`       | partial | Length keywords other than auto are not supported. Values: `<length>`, `<percentage>`, `auto`.                                                                  |
| `marginBottom`      | partial | Length keywords other than auto are not supported. Values: `<length>`, `<percentage>`, `auto`.                                                                  |
| `marginLeft`        | partial | Length keywords other than auto are not supported. Values: `<length>`, `<percentage>`, `auto`.                                                                  |
| `marginBlock`       | partial | Length keywords other than auto are not supported. Values: `<length>`, `<percentage>`, `auto`. Expands to `marginBlockStart`, `marginBlockEnd`.                 |
| `marginBlockStart`  | partial | Length keywords other than auto are not supported. Values: `<length>`, `<percentage>`, `auto`.                                                                  |
| `marginBlockEnd`    | partial | Length keywords other than auto are not supported. Values: `<length>`, `<percentage>`, `auto`.                                                                  |
| `marginInline`      | partial | Length keywords other than auto are not supported. Values: `<length>`, `<percentage>`, `auto`. Expands to `marginInlineStart`, `marginInlineEnd`.               |
| `marginInlineStart` | partial | Length keywords other than auto are not supported. Values: `<length>`, `<percentage>`, `auto`.                                                                  |
| `marginInlineEnd`   | partial | Length keywords other than auto are not supported. Values: `<length>`, `<percentage>`, `auto`.                                                                  |

### Padding

| Property             | Status  | Notes                                                                                                                                                       |
| -------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `padding`            | partial | Multi-value strings are expanded to longhands. Values: `<length>`, `<percentage>`. Expands to `paddingTop`, `paddingRight`, `paddingBottom`, `paddingLeft`. |
| `paddingTop`         | partial | Length keywords other than auto are not supported. Values: `<length>`, `<percentage>`.                                                                      |
| `paddingRight`       | partial | Length keywords other than auto are not supported. Values: `<length>`, `<percentage>`.                                                                      |
| `paddingBottom`      | partial | Length keywords other than auto are not supported. Values: `<length>`, `<percentage>`.                                                                      |
| `paddingLeft`        | partial | Length keywords other than auto are not supported. Values: `<length>`, `<percentage>`.                                                                      |
| `paddingBlock`       | partial | Length keywords other than auto are not supported. Values: `<length>`, `<percentage>`. Expands to `paddingBlockStart`, `paddingBlockEnd`.                   |
| `paddingBlockStart`  | partial | Length keywords other than auto are not supported. Values: `<length>`, `<percentage>`.                                                                      |
| `paddingBlockEnd`    | partial | Length keywords other than auto are not supported. Values: `<length>`, `<percentage>`.                                                                      |
| `paddingInline`      | partial | Length keywords other than auto are not supported. Values: `<length>`, `<percentage>`. Expands to `paddingInlineStart`, `paddingInlineEnd`.                 |
| `paddingInlineStart` | partial | Length keywords other than auto are not supported. Values: `<length>`, `<percentage>`.                                                                      |
| `paddingInlineEnd`   | partial | Length keywords other than auto are not supported. Values: `<length>`, `<percentage>`.                                                                      |

### Border: width

| Property                 | Status     | Notes                                                                                                                                                 |
| ------------------------ | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `borderWidth`            | partial    | Numbers only; expanded when multi-value. Values: `<length>`. Expands to `borderTopWidth`, `borderRightWidth`, `borderBottomWidth`, `borderLeftWidth`. |
| `borderTopWidth`         | partial    | Numbers only; no thin/medium/thick. Values: `<length>`.                                                                                               |
| `borderRightWidth`       | partial    | Numbers only; no thin/medium/thick. Values: `<length>`.                                                                                               |
| `borderBottomWidth`      | partial    | Numbers only; no thin/medium/thick. Values: `<length>`.                                                                                               |
| `borderLeftWidth`        | partial    | Numbers only; no thin/medium/thick. Values: `<length>`.                                                                                               |
| `borderBlockWidth`       | polyfilled | Expanded to top and bottom widths. Expands to `borderTopWidth`, `borderBottomWidth`.                                                                  |
| `borderBlockStartWidth`  | partial    | Renamed to borderTopWidth. Values: `<length>`. React Native key: `borderTopWidth`.                                                                    |
| `borderBlockEndWidth`    | partial    | Renamed to borderBottomWidth. Values: `<length>`. React Native key: `borderBottomWidth`.                                                              |
| `borderInlineWidth`      | polyfilled | Expanded to start and end widths. Expands to `borderStartWidth`, `borderEndWidth`.                                                                    |
| `borderInlineStartWidth` | partial    | Renamed to borderStartWidth. Values: `<length>`. React Native key: `borderStartWidth`.                                                                |
| `borderInlineEndWidth`   | partial    | Renamed to borderEndWidth. Values: `<length>`. React Native key: `borderEndWidth`.                                                                    |

### Border: color

| Property                 | Status     | Notes                                                                                                                                  |
| ------------------------ | ---------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `borderColor`            | partial    | Expanded when multi-value. Values: `<color>`. Expands to `borderTopColor`, `borderRightColor`, `borderBottomColor`, `borderLeftColor`. |
| `borderTopColor`         | supported  |                                                                                                                                        |
| `borderRightColor`       | supported  |                                                                                                                                        |
| `borderBottomColor`      | supported  |                                                                                                                                        |
| `borderLeftColor`        | supported  |                                                                                                                                        |
| `borderBlockColor`       | supported  | Expands to `borderBlockStartColor`, `borderBlockEndColor`.                                                                             |
| `borderBlockStartColor`  | supported  |                                                                                                                                        |
| `borderBlockEndColor`    | supported  |                                                                                                                                        |
| `borderInlineColor`      | polyfilled | Expanded to start and end colors. Expands to `borderStartColor`, `borderEndColor`.                                                     |
| `borderInlineStartColor` | supported  | React Native key: `borderStartColor`.                                                                                                  |
| `borderInlineEndColor`   | supported  | React Native key: `borderEndColor`.                                                                                                    |

### Border: style

| Property                 | Status     | Notes                                                                                                                                                                       |
| ------------------------ | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `borderStyle`            | partial    | none is emulated with borderWidth: 0. Values: `solid`, `dotted`, `dashed`, `none`. Expands to `borderTopStyle`, `borderRightStyle`, `borderBottomStyle`, `borderLeftStyle`. |
| `borderTopStyle`         | polyfilled | React Native has one borderStyle for all sides; per-side styles are merged.                                                                                                 |
| `borderRightStyle`       | polyfilled | React Native has one borderStyle for all sides; per-side styles are merged.                                                                                                 |
| `borderBottomStyle`      | polyfilled | React Native has one borderStyle for all sides; per-side styles are merged.                                                                                                 |
| `borderLeftStyle`        | polyfilled | React Native has one borderStyle for all sides; per-side styles are merged.                                                                                                 |
| `borderBlockStyle`       | polyfilled | React Native has one borderStyle for all sides; per-side styles are merged. Expands to `borderBlockStartStyle`, `borderBlockEndStyle`.                                      |
| `borderBlockStartStyle`  | polyfilled | React Native has one borderStyle for all sides; per-side styles are merged.                                                                                                 |
| `borderBlockEndStyle`    | polyfilled | React Native has one borderStyle for all sides; per-side styles are merged.                                                                                                 |
| `borderInlineStyle`      | polyfilled | React Native has one borderStyle for all sides; per-side styles are merged. Expands to `borderInlineStartStyle`, `borderInlineEndStyle`.                                    |
| `borderInlineStartStyle` | polyfilled | React Native has one borderStyle for all sides; per-side styles are merged.                                                                                                 |
| `borderInlineEndStyle`   | polyfilled | React Native has one borderStyle for all sides; per-side styles are merged.                                                                                                 |

### Border: shorthands

| Property            | Status     | Notes                                                                                                                                   |
| ------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `border`            | polyfilled | Parsed and expanded to width, style and color. Expands to `borderWidth`, `borderStyle`, `borderColor`.                                  |
| `borderTop`         | polyfilled | Parsed and expanded to width, style and color. Expands to `borderTopWidth`, `borderTopStyle`, `borderTopColor`.                         |
| `borderRight`       | polyfilled | Parsed and expanded to width, style and color. Expands to `borderRightWidth`, `borderRightStyle`, `borderRightColor`.                   |
| `borderBottom`      | polyfilled | Parsed and expanded to width, style and color. Expands to `borderBottomWidth`, `borderBottomStyle`, `borderBottomColor`.                |
| `borderLeft`        | polyfilled | Parsed and expanded to width, style and color. Expands to `borderLeftWidth`, `borderLeftStyle`, `borderLeftColor`.                      |
| `borderBlock`       | polyfilled | Parsed and expanded to width, style and color. Expands to `borderBlockWidth`, `borderBlockStyle`, `borderBlockColor`.                   |
| `borderBlockStart`  | polyfilled | Parsed and expanded to width, style and color. Expands to `borderBlockStartWidth`, `borderBlockStartStyle`, `borderBlockStartColor`.    |
| `borderBlockEnd`    | polyfilled | Parsed and expanded to width, style and color. Expands to `borderBlockEndWidth`, `borderBlockEndStyle`, `borderBlockEndColor`.          |
| `borderInline`      | polyfilled | Parsed and expanded to width, style and color. Expands to `borderInlineWidth`, `borderInlineStyle`, `borderInlineColor`.                |
| `borderInlineStart` | polyfilled | Parsed and expanded to width, style and color. Expands to `borderInlineStartWidth`, `borderInlineStartStyle`, `borderInlineStartColor`. |
| `borderInlineEnd`   | polyfilled | Parsed and expanded to width, style and color. Expands to `borderInlineEndWidth`, `borderInlineEndStyle`, `borderInlineEndColor`.       |

### Border: radius

| Property                  | Status      | Notes                                                                                                                                                                                                    |
| ------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `borderRadius`            | partial     | Single value or expanded per corner; no slash syntax. Values: `<length>`, `<percentage>`. Expands to `borderTopLeftRadius`, `borderTopRightRadius`, `borderBottomRightRadius`, `borderBottomLeftRadius`. |
| `borderTopLeftRadius`     | partial     | No elliptical (two-value) radii. Values: `<length>`, `<percentage>`.                                                                                                                                     |
| `borderTopRightRadius`    | partial     | No elliptical (two-value) radii. Values: `<length>`, `<percentage>`.                                                                                                                                     |
| `borderBottomRightRadius` | partial     | No elliptical (two-value) radii. Values: `<length>`, `<percentage>`.                                                                                                                                     |
| `borderBottomLeftRadius`  | partial     | No elliptical (two-value) radii. Values: `<length>`, `<percentage>`.                                                                                                                                     |
| `borderStartStartRadius`  | partial     | No elliptical (two-value) radii. Values: `<length>`, `<percentage>`.                                                                                                                                     |
| `borderStartEndRadius`    | partial     | No elliptical (two-value) radii. Values: `<length>`, `<percentage>`.                                                                                                                                     |
| `borderEndStartRadius`    | partial     | No elliptical (two-value) radii. Values: `<length>`, `<percentage>`.                                                                                                                                     |
| `borderEndEndRadius`      | partial     | No elliptical (two-value) radii. Values: `<length>`, `<percentage>`.                                                                                                                                     |
| `borderImage`             | unsupported | No border images.                                                                                                                                                                                        |
| `borderImageSource`       | unsupported | No border images.                                                                                                                                                                                        |
| `borderImageSlice`        | unsupported | No border images.                                                                                                                                                                                        |
| `borderImageWidth`        | unsupported | No border images.                                                                                                                                                                                        |
| `borderImageOutset`       | unsupported | No border images.                                                                                                                                                                                        |
| `borderImageRepeat`       | unsupported | No border images.                                                                                                                                                                                        |

### Outline

| Property        | Status     | Notes                                                                                                     |
| --------------- | ---------- | --------------------------------------------------------------------------------------------------------- |
| `outline`       | polyfilled | Parsed and expanded to width, style and color. Expands to `outlineWidth`, `outlineStyle`, `outlineColor`. |
| `outlineWidth`  | partial    | Numbers only. Values: `<length>`.                                                                         |
| `outlineStyle`  | partial    | none is emulated with outlineWidth: 0. Values: `solid`, `dotted`, `dashed`, `none`.                       |
| `outlineColor`  | supported  |                                                                                                           |
| `outlineOffset` | supported  |                                                                                                           |

### Background

| Property               | Status      | Notes                                                                                                                                                                               |
| ---------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `background`           | partial     | Only a single color; expanded to backgroundColor. Values: `<color>`. Expands to `backgroundColor`.                                                                                  |
| `backgroundColor`      | supported   |                                                                                                                                                                                     |
| `backgroundImage`      | partial     | Gradients only, via the experimental React Native API; url() images need `<Image>`. Values: `linear-gradient`, `radial-gradient`. React Native key: `experimental_backgroundImage`. |
| `backgroundSize`       | partial     | Experimental React Native API; cover/contain not supported. Values: `<length>`, `<percentage>`, `auto`. React Native key: `experimental_backgroundSize`.                            |
| `backgroundPosition`   | partial     | Experimental React Native API. Values: `<length>`, `<percentage>`, `top`, `right`, `bottom`, `left`, `center`. React Native key: `experimental_backgroundPosition`.                 |
| `backgroundRepeat`     | partial     | Experimental React Native API. Values: `repeat`, `no-repeat`, `space`, `round`. React Native key: `experimental_backgroundRepeat`.                                                  |
| `backgroundClip`       | unsupported | No background clipping.                                                                                                                                                             |
| `backgroundOrigin`     | unsupported | No background origin.                                                                                                                                                               |
| `backgroundAttachment` | unsupported | No scroll-attached backgrounds.                                                                                                                                                     |
| `backgroundBlendMode`  | unsupported | No background blend modes.                                                                                                                                                          |

### Visual effects

| Property             | Status      | Since | Notes                                                                                                                                                          |
| -------------------- | ----------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `opacity`            | supported   |       |                                                                                                                                                                |
| `boxShadow`          | supported   | 0.76  | CSS string syntax, including inset and multiple shadows.                                                                                                       |
| `filter`             | partial     | 0.76  | url() filters are not supported. Values: `blur`, `brightness`, `contrast`, `drop-shadow`, `grayscale`, `hue-rotate`, `invert`, `opacity`, `saturate`, `sepia`. |
| `backdropFilter`     | unsupported |       | No backdrop filters.                                                                                                                                           |
| `mixBlendMode`       | supported   | 0.76  |                                                                                                                                                                |
| `isolation`          | supported   | 0.76  |                                                                                                                                                                |
| `backfaceVisibility` | supported   |       |                                                                                                                                                                |
| `clipPath`           | unsupported |       | No clip paths; use overflow: hidden with borderRadius.                                                                                                         |
| `maskImage`          | unsupported |       | No CSS masks.                                                                                                                                                  |
| `maskSize`           | unsupported |       | No CSS masks.                                                                                                                                                  |
| `maskPosition`       | unsupported |       | No CSS masks.                                                                                                                                                  |
| `maskRepeat`         | unsupported |       | No CSS masks.                                                                                                                                                  |
| `boxDecorationBreak` | unsupported |       | No fragmentation.                                                                                                                                              |
| `imageRendering`     | web-only    |       | Rendering hints have no native equivalent.                                                                                                                     |
| `colorScheme`        | web-only    |       | Color scheme is an app-level setting on native.                                                                                                                |
| `forcedColorAdjust`  | web-only    |       | Forced colors mode does not exist on native.                                                                                                                   |
| `printColorAdjust`   | web-only    |       | No printing on native.                                                                                                                                         |
| `willChange`         | web-only    |       | Performance hint only.                                                                                                                                         |
| `contain`            | web-only    |       | Containment is a rendering hint only.                                                                                                                          |
| `contentVisibility`  | web-only    |       | Rendering hint only.                                                                                                                                           |

### Transforms

| Property            | Status      | Notes                                                                                                                                                                                                                                 |
| ------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `transform`         | partial     | No 3d translate/scale, rotate3d, matrix3d, or two-argument translate()/skew(). Values: `perspective`, `rotate`, `rotateX`, `rotateY`, `rotateZ`, `scale`, `scaleX`, `scaleY`, `translateX`, `translateY`, `skewX`, `skewY`, `matrix`. |
| `transformOrigin`   | supported   |                                                                                                                                                                                                                                       |
| `transformStyle`    | unsupported | No preserve-3d.                                                                                                                                                                                                                       |
| `perspective`       | unsupported | Use perspective() inside transform.                                                                                                                                                                                                   |
| `perspectiveOrigin` | unsupported | No perspective origin.                                                                                                                                                                                                                |
| `rotate`            | polyfilled  | Folded into transform at compile time.                                                                                                                                                                                                |
| `scale`             | polyfilled  | Folded into transform at compile time.                                                                                                                                                                                                |
| `translate`         | polyfilled  | Folded into transform at compile time.                                                                                                                                                                                                |

### Transitions & animations

| Property                   | Status      | Notes                                                                                                                                                                                                                                                                  |
| -------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `transition`               | polyfilled  | Run by the StyleXN runtime with Animated (JS driver). Expanded to longhands. Expands to `transitionProperty`, `transitionDuration`, `transitionTimingFunction`, `transitionDelay`.                                                                                     |
| `transitionProperty`       | polyfilled  | Run by the StyleXN runtime with Animated (JS driver).                                                                                                                                                                                                                  |
| `transitionDuration`       | polyfilled  | Run by the StyleXN runtime with Animated (JS driver).                                                                                                                                                                                                                  |
| `transitionTimingFunction` | polyfilled  | Run by the StyleXN runtime with Animated (JS driver).                                                                                                                                                                                                                  |
| `transitionDelay`          | polyfilled  | Run by the StyleXN runtime with Animated (JS driver).                                                                                                                                                                                                                  |
| `transitionBehavior`       | web-only    | Discrete transitions have no native meaning.                                                                                                                                                                                                                           |
| `animation`                | polyfilled  | Run by the StyleXN runtime with Animated (JS driver). Expanded to longhands. Expands to `animationName`, `animationDuration`, `animationTimingFunction`, `animationDelay`, `animationIterationCount`, `animationDirection`, `animationFillMode`, `animationPlayState`. |
| `animationName`            | polyfilled  | Run by the StyleXN runtime with Animated (JS driver). The name must come from stylex.keyframes().                                                                                                                                                                      |
| `animationDuration`        | polyfilled  | Run by the StyleXN runtime with Animated (JS driver).                                                                                                                                                                                                                  |
| `animationTimingFunction`  | polyfilled  | Run by the StyleXN runtime with Animated (JS driver).                                                                                                                                                                                                                  |
| `animationDelay`           | polyfilled  | Run by the StyleXN runtime with Animated (JS driver).                                                                                                                                                                                                                  |
| `animationIterationCount`  | polyfilled  | Run by the StyleXN runtime with Animated (JS driver).                                                                                                                                                                                                                  |
| `animationDirection`       | polyfilled  | Run by the StyleXN runtime with Animated (JS driver).                                                                                                                                                                                                                  |
| `animationFillMode`        | polyfilled  | Run by the StyleXN runtime with Animated (JS driver).                                                                                                                                                                                                                  |
| `animationPlayState`       | polyfilled  | Run by the StyleXN runtime with Animated (JS driver).                                                                                                                                                                                                                  |
| `animationComposition`     | unsupported | No animation composition.                                                                                                                                                                                                                                              |
| `animationTimeline`        | unsupported | No scroll-driven animations.                                                                                                                                                                                                                                           |
| `viewTransitionName`       | web-only    | View transitions are a web API.                                                                                                                                                                                                                                        |

### Text

| Property                  | Status      | Platform | Notes                                                                                                                                               |
| ------------------------- | ----------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `color`                   | supported   |          |                                                                                                                                                     |
| `fontFamily`              | partial     |          | One family name; fallback lists use the first entry. Values: `<string>`.                                                                            |
| `fontSize`                | partial     |          | No keyword sizes. Percentages and em resolve against the inherited font size at runtime. Values: `<length>`, `<percentage>`.                        |
| `fontStyle`               | partial     |          | oblique is treated as italic. Values: `normal`, `italic`.                                                                                           |
| `fontWeight`              | partial     |          | bolder/lighter are not supported. Values: `<number>`, `normal`, `bold`, `100`, `200`, `300`, `400`, `500`, `600`, `700`, `800`, `900`.              |
| `fontVariant`             | polyfilled  |          | Space-separated string converted to React Native's array form.                                                                                      |
| `fontVariantNumeric`      | polyfilled  |          | Merged into fontVariant. React Native key: `fontVariant`.                                                                                           |
| `fontVariantLigatures`    | polyfilled  |          | Merged into fontVariant. React Native key: `fontVariant`.                                                                                           |
| `fontVariantCaps`         | partial     |          | Merged into fontVariant. Values: `normal`, `small-caps`. React Native key: `fontVariant`.                                                           |
| `fontFeatureSettings`     | unsupported |          | No OpenType feature settings API.                                                                                                                   |
| `fontStretch`             | unsupported |          | Font stretch is not exposed by React Native.                                                                                                        |
| `fontKerning`             | unsupported |          | Kerning is not exposed by React Native.                                                                                                             |
| `fontOpticalSizing`       | unsupported |          | Not exposed by React Native.                                                                                                                        |
| `fontSynthesis`           | unsupported |          | Not exposed by React Native.                                                                                                                        |
| `font`                    | unsupported |          | Expand to longhands; the font shorthand grammar is not parsed.                                                                                      |
| `letterSpacing`           | partial     |          | Numbers only; normal is 0. Values: `<length>`.                                                                                                      |
| `lineHeight`              | polyfilled  |          | Unitless multipliers resolve against the element's font size at runtime and inherit as multipliers, like CSS; lengths pass through.                 |
| `textAlign`               | partial     |          | start/end are mapped via direction. Values: `auto`, `left`, `right`, `center`, `justify`.                                                           |
| `textAlignLast`           | unsupported |          | Not supported by React Native text layout.                                                                                                          |
| `textDecoration`          | polyfilled  |          | Parsed and expanded to line, style and color. Expands to `textDecorationLine`, `textDecorationStyle`, `textDecorationColor`.                        |
| `textDecorationLine`      | partial     |          | overline is not supported. Values: `none`, `underline`, `line-through`, `underline line-through`.                                                   |
| `textDecorationStyle`     | partial     | ios      | iOS only. Values: `solid`, `double`, `dotted`, `dashed`.                                                                                            |
| `textDecorationColor`     | supported   | ios      | iOS only.                                                                                                                                           |
| `textDecorationThickness` | unsupported |          | Not supported by React Native.                                                                                                                      |
| `textUnderlineOffset`     | unsupported |          | Not supported by React Native.                                                                                                                      |
| `textShadow`              | polyfilled  |          | Parsed and expanded to React Native's textShadow* keys. Expands to `textShadowOffsetX`, `textShadowOffsetY`, `textShadowRadius`, `textShadowColor`. |
| `textTransform`           | supported   |          |                                                                                                                                                     |
| `textIndent`              | unsupported |          | Not supported by React Native text layout.                                                                                                          |
| `textOverflow`            | partial     |          | Becomes the ellipsizeMode prop on `<Text>`. Values: `ellipsis`, `clip`. Prop: `ellipsizeMode`.                                                      |
| `textWrap`                | unsupported |          | Not supported by React Native text layout.                                                                                                          |
| `whiteSpace`              | unsupported |          | Not supported; text wraps by default, nowrap needs numberOfLines.                                                                                   |
| `wordBreak`               | unsupported |          | Not supported by React Native text layout.                                                                                                          |
| `overflowWrap`            | unsupported |          | Not supported by React Native text layout.                                                                                                          |
| `wordWrap`                | unsupported |          | Not supported by React Native text layout.                                                                                                          |
| `hyphens`                 | unsupported |          | Not supported by React Native text layout.                                                                                                          |
| `lineClamp`               | polyfilled  |          | Becomes the numberOfLines prop on `<Text>`. Prop: `numberOfLines`.                                                                                  |
| `WebkitLineClamp`         | polyfilled  |          | Becomes the numberOfLines prop on `<Text>`. Prop: `numberOfLines`.                                                                                  |
| `verticalAlign`           | partial     | android  | Android only. Values: `auto`, `top`, `bottom`, `middle`.                                                                                            |
| `userSelect`              | supported   |          |                                                                                                                                                     |
| `textRendering`           | web-only    |          | Rendering hint only.                                                                                                                                |
| `WebkitFontSmoothing`     | web-only    |          | Rendering hint only.                                                                                                                                |
| `MozOsxFontSmoothing`     | web-only    |          | Rendering hint only.                                                                                                                                |
| `tabSize`                 | web-only    |          | No tab rendering control on native.                                                                                                                 |
| `writingMode`             | unsupported |          | Vertical writing modes are not supported.                                                                                                           |
| `unicodeBidi`             | unsupported |          | Not exposed by React Native.                                                                                                                        |
| `wordSpacing`             | unsupported |          | Not exposed by React Native.                                                                                                                        |
| `textSizeAdjust`          | web-only    |          | Handled by allowFontScaling on native.                                                                                                              |

### Interaction / UI

| Property             | Status      | Notes                                                                           |
| -------------------- | ----------- | ------------------------------------------------------------------------------- |
| `cursor`             | partial     | Other cursors are not supported. Values: `auto`, `pointer`.                     |
| `pointerEvents`      | partial     | Other values are not supported. Values: `auto`, `none`, `box-none`, `box-only`. |
| `touchAction`        | unsupported | Gesture handling is imperative on native.                                       |
| `caretColor`         | supported   | Becomes the cursorColor prop on `<TextInput>`. Prop: `cursorColor`.             |
| `accentColor`        | unsupported | No accent color; style controls explicitly.                                     |
| `appearance`         | web-only    | No native form-control appearance switch.                                       |
| `resize`             | web-only    | No resizable elements.                                                          |
| `scrollBehavior`     | web-only    | Use scrollTo({ animated }) on native.                                           |
| `scrollSnapType`     | unsupported | Use pagingEnabled/snapToInterval props on ScrollView.                           |
| `scrollSnapAlign`    | unsupported | Use pagingEnabled/snapToInterval props on ScrollView.                           |
| `scrollSnapStop`     | unsupported | Use pagingEnabled/snapToInterval props on ScrollView.                           |
| `scrollMargin`       | unsupported | Not supported.                                                                  |
| `scrollPadding`      | unsupported | Not supported.                                                                  |
| `overscrollBehavior` | unsupported | Use bounces/overScrollMode props on ScrollView.                                 |
| `scrollbarWidth`     | web-only    | Use showsVerticalScrollIndicator on native.                                     |
| `scrollbarColor`     | web-only    | Use indicatorStyle on native.                                                   |
| `scrollbarGutter`    | web-only    | No scrollbar gutters on native.                                                 |

### Images / replaced elements

| Property         | Status      | Notes                       |
| ---------------- | ----------- | --------------------------- |
| `objectFit`      | supported   | Applies to `<Image>` only.  |
| `objectPosition` | unsupported | Not supported by `<Image>`. |

### Generated content / misc

| Property           | Status      | Notes                                       |
| ------------------ | ----------- | ------------------------------------------- |
| `content`          | unsupported | No pseudo-element content; render children. |
| `quotes`           | web-only    | Generated content is web-only.              |
| `counterReset`     | web-only    | Generated content is web-only.              |
| `counterIncrement` | web-only    | Generated content is web-only.              |
| `containerType`    | unsupported | Container queries are not supported.        |
| `containerName`    | unsupported | Container queries are not supported.        |
| `all`              | unsupported | Cannot reset all properties.                |

## Pseudo-classes

As StyleX condition keys, for example `{ default: 1, ":hover": 0.8 }`.

| Pseudo-class         | Status      | Notes                                                                                                   |
| -------------------- | ----------- | ------------------------------------------------------------------------------------------------------- |
| `:hover`             | polyfilled  | Tracked at runtime via Pressable/focus state on the styled element. Only fires with a pointer device.   |
| `:active`            | polyfilled  | Tracked at runtime via Pressable/focus state on the styled element.                                     |
| `:focus`             | polyfilled  | Tracked at runtime via Pressable/focus state on the styled element.                                     |
| `:focus-visible`     | polyfilled  | Tracked at runtime via Pressable/focus state on the styled element. Treated like :focus.                |
| `:focus-within`      | polyfilled  | Tracked at runtime via Pressable/focus state on the styled element. Requires descendant focus tracking. |
| `:disabled`          | polyfilled  | Derived from the disabled prop.                                                                         |
| `:enabled`           | polyfilled  | Derived from the disabled prop.                                                                         |
| `:checked`           | unsupported | Form control state is prop-driven; pass it to the style function instead.                               |
| `:indeterminate`     | unsupported | Form control state is prop-driven; pass it to the style function instead.                               |
| `:default`           | unsupported | Form control state is prop-driven; pass it to the style function instead.                               |
| `:required`          | unsupported | Form control state is prop-driven; pass it to the style function instead.                               |
| `:optional`          | unsupported | Form control state is prop-driven; pass it to the style function instead.                               |
| `:valid`             | unsupported | Form control state is prop-driven; pass it to the style function instead.                               |
| `:invalid`           | unsupported | Form control state is prop-driven; pass it to the style function instead.                               |
| `:in-range`          | unsupported | Form control state is prop-driven; pass it to the style function instead.                               |
| `:out-of-range`      | unsupported | Form control state is prop-driven; pass it to the style function instead.                               |
| `:read-only`         | unsupported | Form control state is prop-driven; pass it to the style function instead.                               |
| `:read-write`        | unsupported | Form control state is prop-driven; pass it to the style function instead.                               |
| `:placeholder-shown` | unsupported | Form control state is prop-driven; pass it to the style function instead.                               |
| `:autofill`          | web-only    | Autofill state is a browser concept.                                                                    |
| `:first-child`       | unsupported | Structural selectors need sibling context React Native does not expose.                                 |
| `:last-child`        | unsupported | Structural selectors need sibling context React Native does not expose.                                 |
| `:only-child`        | unsupported | Structural selectors need sibling context React Native does not expose.                                 |
| `:first-of-type`     | unsupported | Structural selectors need sibling context React Native does not expose.                                 |
| `:last-of-type`      | unsupported | Structural selectors need sibling context React Native does not expose.                                 |
| `:only-of-type`      | unsupported | Structural selectors need sibling context React Native does not expose.                                 |
| `:nth-child`         | unsupported | Structural selectors need sibling context React Native does not expose.                                 |
| `:nth-last-child`    | unsupported | Structural selectors need sibling context React Native does not expose.                                 |
| `:nth-of-type`       | unsupported | Structural selectors need sibling context React Native does not expose.                                 |
| `:empty`             | unsupported | Structural selectors need sibling context React Native does not expose.                                 |
| `:link`              | web-only    | Link states are a browser concept.                                                                      |
| `:visited`           | web-only    | Link states are a browser concept.                                                                      |
| `:any-link`          | web-only    | Link states are a browser concept.                                                                      |
| `:target`            | web-only    | URL fragments are a browser concept.                                                                    |
| `:fullscreen`        | web-only    | Fullscreen API is a browser concept.                                                                    |

## Pseudo-elements

| Pseudo-element        | Status      | Notes                                                                                                          |
| --------------------- | ----------- | -------------------------------------------------------------------------------------------------------------- |
| `::placeholder`       | partial     | Only color, via the placeholderTextColor prop on `<TextInput>`. Values: `color`. Prop: `placeholderTextColor`. |
| `::selection`         | web-only    | Selection styling is not exposed on native.                                                                    |
| `::before`            | unsupported | No generated content; render an element.                                                                       |
| `::after`             | unsupported | No generated content; render an element.                                                                       |
| `::first-line`        | unsupported | No line-level styling.                                                                                         |
| `::first-letter`      | unsupported | No character-level styling.                                                                                    |
| `::marker`            | unsupported | No list markers.                                                                                               |
| `::backdrop`          | unsupported | No top-layer backdrop.                                                                                         |
| `::thumb`             | web-only    | Form control internals are web-only.                                                                           |
| `::track`             | web-only    | Form control internals are web-only.                                                                           |
| `::-webkit-scrollbar` | web-only    | Scrollbar styling is web-only.                                                                                 |

## At-rules

As StyleX condition keys, for example `"@media (min-width: 800px)"`.

| At-rule           | Status      | Notes                                                                                                                                                                                                                                                                                                                                                                                                |
| ----------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@media`          | partial     | Evaluated at runtime against window dimensions, color scheme and accessibility settings. Values: `width`, `min-width`, `max-width`, `height`, `min-height`, `max-height`, `aspect-ratio`, `min-aspect-ratio`, `max-aspect-ratio`, `orientation`, `resolution`, `min-resolution`, `max-resolution`, `prefers-color-scheme`, `prefers-reduced-motion`, `hover`, `any-hover`, `pointer`, `any-pointer`. |
| `@container`      | unsupported | Container queries need layout measurement StyleXN does not do.                                                                                                                                                                                                                                                                                                                                       |
| `@supports`       | web-only    | Feature queries evaluate against CSS; native ignores the block.                                                                                                                                                                                                                                                                                                                                      |
| `@starting-style` | web-only    | Entry animations are a web API.                                                                                                                                                                                                                                                                                                                                                                      |

## Media features

How each feature inside `@media` is evaluated on native.

| Feature                  | Status      | Notes                                            |
| ------------------------ | ----------- | ------------------------------------------------ |
| `width`                  | polyfilled  | useWindowDimensions().width                      |
| `min-width`              | polyfilled  | useWindowDimensions().width                      |
| `max-width`              | polyfilled  | useWindowDimensions().width                      |
| `height`                 | polyfilled  | useWindowDimensions().height                     |
| `min-height`             | polyfilled  | useWindowDimensions().height                     |
| `max-height`             | polyfilled  | useWindowDimensions().height                     |
| `aspect-ratio`           | polyfilled  | useWindowDimensions()                            |
| `min-aspect-ratio`       | polyfilled  | useWindowDimensions()                            |
| `max-aspect-ratio`       | polyfilled  | useWindowDimensions()                            |
| `orientation`            | polyfilled  | useWindowDimensions()                            |
| `resolution`             | polyfilled  | PixelRatio.get()                                 |
| `min-resolution`         | polyfilled  | PixelRatio.get()                                 |
| `max-resolution`         | polyfilled  | PixelRatio.get()                                 |
| `prefers-color-scheme`   | polyfilled  | useColorScheme()                                 |
| `prefers-reduced-motion` | polyfilled  | AccessibilityInfo.isReduceMotionEnabled()        |
| `hover`                  | polyfilled  | Assumed none on touch devices.                   |
| `any-hover`              | polyfilled  | Assumed none on touch devices.                   |
| `pointer`                | polyfilled  | Assumed coarse on touch devices.                 |
| `any-pointer`            | polyfilled  | Assumed coarse on touch devices.                 |
| `prefers-contrast`       | unsupported | Not exposed cross-platform.                      |
| `forced-colors`          | web-only    | Evaluates to false on native.                    |
| `display-mode`           | web-only    | Evaluates to false on native.                    |
| `print`                  | web-only    | Evaluates to false on native.                    |
| `screen`                 | web-only    | Evaluates to true on native.                     |
| `scripting`              | web-only    | Evaluates to enabled on native.                  |
| `color-gamut`            | unsupported | Not exposed by React Native.                     |
| `dynamic-range`          | unsupported | Not exposed by React Native.                     |
| `inverted-colors`        | polyfilled  | AccessibilityInfo.isInvertColorsEnabled() (iOS). |

## Units

`<number>` is a unitless number.

| Unit       | Status      | Notes                                                                    |
| ---------- | ----------- | ------------------------------------------------------------------------ |
| `<number>` | supported   |                                                                          |
| `px`       | supported   | Converted to a plain number.                                             |
| `%`        | partial     | Accepted where React Native accepts percentages. Values: `<percentage>`. |
| `rem`      | polyfilled  | Multiplied by the configured root font size (default 16).                |
| `em`       | polyfilled  | Resolved against the inherited font size at runtime.                     |
| `vw`       | polyfilled  | Resolved against window width at runtime.                                |
| `vh`       | polyfilled  | Resolved against window height at runtime.                               |
| `vmin`     | polyfilled  | Resolved against window dimensions at runtime.                           |
| `vmax`     | polyfilled  | Resolved against window dimensions at runtime.                           |
| `dvw`      | polyfilled  | Treated as vw.                                                           |
| `dvh`      | polyfilled  | Treated as vh.                                                           |
| `svw`      | polyfilled  | Treated as vw.                                                           |
| `svh`      | polyfilled  | Treated as vh.                                                           |
| `lvw`      | polyfilled  | Treated as vw.                                                           |
| `lvh`      | polyfilled  | Treated as vh.                                                           |
| `pt`       | polyfilled  | Converted to px at compile time (1pt = 4/3px).                           |
| `pc`       | polyfilled  | Converted to px at compile time.                                         |
| `in`       | polyfilled  | Converted to px at compile time (1in = 96px).                            |
| `cm`       | polyfilled  | Converted to px at compile time.                                         |
| `mm`       | polyfilled  | Converted to px at compile time.                                         |
| `q`        | polyfilled  | Converted to px at compile time.                                         |
| `ch`       | unsupported | Font metrics are not exposed.                                            |
| `ex`       | unsupported | Font metrics are not exposed.                                            |
| `cap`      | unsupported | Font metrics are not exposed.                                            |
| `ic`       | unsupported | Font metrics are not exposed.                                            |
| `lh`       | unsupported | Line height metrics are not exposed.                                     |
| `rlh`      | unsupported | Line height metrics are not exposed.                                     |
| `cqw`      | unsupported | Container queries are not supported.                                     |
| `cqh`      | unsupported | Container queries are not supported.                                     |
| `deg`      | supported   | In transforms and gradients.                                             |
| `rad`      | supported   | In transforms.                                                           |
| `turn`     | polyfilled  | Converted to deg at compile time.                                        |
| `grad`     | polyfilled  | Converted to deg at compile time.                                        |
| `ms`       | supported   | In transitions and animations.                                           |
| `s`        | supported   | In transitions and animations.                                           |
| `fr`       | unsupported | React Native has no grid layout.                                         |
| `dpi`      | polyfilled  | Media queries only.                                                      |
| `dppx`     | polyfilled  | Media queries only.                                                      |
| `x`        | polyfilled  | Media queries only.                                                      |

## Functions

Value functions inside strings, such as `calc()` or `linear-gradient()`.

| Function                      | Status      | Notes                                                                                                                                                                   |
| ----------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `var()`                       | polyfilled  | Resolved from React context at runtime.                                                                                                                                 |
| `calc()`                      | partial     | Constant-folded at compile time; relative units and var() fold at runtime. Mixing percentages with lengths is rejected. Values: `<length>`, `<percentage>`, `<number>`. |
| `min()`                       | partial     | Folded at compile time, or at runtime for relative units and var(). Values: `<length>`, `<number>`.                                                                     |
| `max()`                       | partial     | Folded at compile time, or at runtime for relative units and var(). Values: `<length>`, `<number>`.                                                                     |
| `clamp()`                     | partial     | Folded at compile time, or at runtime for relative units and var(). Values: `<length>`, `<number>`.                                                                     |
| `env()`                       | unsupported | Safe-area insets come from react-native-safe-area-context, not styles.                                                                                                  |
| `attr()`                      | unsupported | No attribute access from styles.                                                                                                                                        |
| `counter()`                   | unsupported | No generated content.                                                                                                                                                   |
| `url()`                       | unsupported | Not supported in styles; use `<Image source>`.                                                                                                                          |
| `rgb()`                       | supported   |                                                                                                                                                                         |
| `rgba()`                      | supported   |                                                                                                                                                                         |
| `hsl()`                       | supported   |                                                                                                                                                                         |
| `hsla()`                      | supported   |                                                                                                                                                                         |
| `hwb()`                       | supported   |                                                                                                                                                                         |
| `lab()`                       | polyfilled  | Converted to rgb at compile time when static.                                                                                                                           |
| `lch()`                       | polyfilled  | Converted to rgb at compile time when static.                                                                                                                           |
| `oklab()`                     | polyfilled  | Converted to rgb at compile time when static.                                                                                                                           |
| `oklch()`                     | polyfilled  | Converted to rgb at compile time when static.                                                                                                                           |
| `color()`                     | polyfilled  | Converted to rgb at compile time when static.                                                                                                                           |
| `color-mix()`                 | polyfilled  | Converted to rgb at compile time (hex, functional and named colors).                                                                                                    |
| `light-dark()`                | polyfilled  | Rewritten to a prefers-color-scheme condition at compile time.                                                                                                          |
| `linear-gradient()`           | supported   | Via backgroundImage.                                                                                                                                                    |
| `radial-gradient()`           | supported   | Via backgroundImage.                                                                                                                                                    |
| `conic-gradient()`            | unsupported | Not supported by React Native backgrounds.                                                                                                                              |
| `repeating-linear-gradient()` | unsupported | Not supported by React Native backgrounds.                                                                                                                              |
| `repeating-radial-gradient()` | unsupported | Not supported by React Native backgrounds.                                                                                                                              |
| `image-set()`                 | unsupported | Use `<Image source>` with scale variants.                                                                                                                               |
| `cubic-bezier()`              | polyfilled  | Mapped to Easing.bezier().                                                                                                                                              |
| `steps()`                     | polyfilled  | Run as a JS easing function (start, end, jump-* positions).                                                                                                             |
| `linear()`                    | polyfilled  | Piecewise-linear easing, run as a JS easing function.                                                                                                                   |

## StyleX API

The `stylex.*` functions themselves.

| API                   | Status      | Notes                                                                   |
| --------------------- | ----------- | ----------------------------------------------------------------------- |
| `create`              | supported   |                                                                         |
| `props`               | supported   | Returns { style, ...props }; extra props come from entries with `prop`. |
| `attrs`               | supported   | Alias of props on native.                                               |
| `defineVars`          | polyfilled  | Variables become a React context value.                                 |
| `defineConsts`        | supported   | Inlined at compile time.                                                |
| `createTheme`         | polyfilled  | Themes become a context provider for the subtree.                       |
| `keyframes`           | polyfilled  | Run by the StyleXN runtime with Animated (JS driver).                   |
| `firstThatWorks`      | polyfilled  | Picks the first value the compat table accepts, at compile time.        |
| `positionTry`         | unsupported | Anchor positioning does not exist on native.                            |
| `viewTransitionClass` | web-only    | View transitions are a web API.                                         |
| `defineMarker`        | unsupported | Markers depend on CSS selectors.                                        |
| `when`                | unsupported | Ancestor/sibling conditions (stylex.when.*) depend on CSS selectors.    |
| `types`               | supported   | Typed variables are compile-time only.                                  |
| `env`                 | supported   | Compile-time constants.                                                 |
