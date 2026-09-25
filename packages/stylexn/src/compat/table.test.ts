import { describe, expect, test } from "vitest";
import {
  apis,
  atRules,
  functions,
  mediaFeatures,
  properties,
  pseudoClasses,
  pseudoElements,
  rnOnlyKeys,
  units,
} from "./table.ts";
import { STATUSES, type Entry, type Table } from "./types.ts";

const tables: Record<string, Table> = {
  properties,
  pseudoClasses,
  pseudoElements,
  atRules,
  mediaFeatures,
  units,
  functions,
  apis,
};

const entries = (table: Table): [string, Entry][] => Object.entries(table);

describe.each(Object.entries(tables))("%s table", (_name, table) => {
  test("every entry has a valid status", () => {
    for (const [key, entry] of entries(table)) {
      expect(STATUSES, key).toContain(entry.status);
    }
  });

  test("every non-supported entry explains itself", () => {
    for (const [key, entry] of entries(table)) {
      if (entry.status === "supported") continue;
      expect(entry.note, `${key} needs a note`).toBeTruthy();
    }
  });

  test("partial entries list accepted values", () => {
    for (const [key, entry] of entries(table)) {
      if (entry.status !== "partial") continue;
      expect(entry.values?.length, `${key} needs values`).toBeGreaterThan(0);
    }
  });

  test("since versions are major.minor", () => {
    for (const [key, entry] of entries(table)) {
      if (entry.since) expect(entry.since, key).toMatch(/^\d+\.\d+$/);
    }
  });

  test("unsupported entries carry no native mapping", () => {
    for (const [key, entry] of entries(table)) {
      if (entry.status !== "unsupported" && entry.status !== "web-only") continue;
      expect(entry.native, key).toBeUndefined();
      expect(entry.prop, key).toBeUndefined();
      expect(entry.expandsTo, key).toBeUndefined();
    }
  });
});

describe("properties", () => {
  test("keys are camelCase CSS names (or the --* pattern)", () => {
    for (const key of Object.keys(properties)) {
      if (key === "--*") continue;
      expect(key, key).toMatch(/^[A-Za-z][A-Za-z0-9]*$/);
    }
  });

  test("shorthand expansions and native renames point at known keys", () => {
    for (const [key, entry] of entries(properties)) {
      const targets = [...(entry.expandsTo ?? []), ...(entry.native ? [entry.native] : [])];
      for (const target of targets) {
        expect(
          target in properties || rnOnlyKeys.has(target),
          `${key} targets unknown key ${target}`,
        ).toBe(true);
      }
    }
  });

  test("rnOnlyKeys never shadow a CSS property entry", () => {
    for (const key of rnOnlyKeys) expect(key in properties, key).toBe(false);
  });

  test("a property never expands to itself", () => {
    for (const [key, entry] of entries(properties)) {
      expect(entry.expandsTo ?? [], key).not.toContain(key);
    }
  });

  test("native renames never target a key with its own entry of a different status", () => {
    for (const [key, entry] of entries(properties)) {
      if (!entry.native || !(entry.native in properties)) continue;
      const target = properties[entry.native as keyof typeof properties];
      expect(target.status, `${key} -> ${entry.native}`).not.toBe("unsupported");
    }
  });

  test("known React Native facts (RN 0.86)", () => {
    expect(properties.display.values).toEqual(["flex", "none", "contents"]);
    expect(properties.position.values).not.toContain("sticky");
    expect(properties.position.values).not.toContain("fixed");
    expect(properties.overflow.values).not.toContain("auto");
    expect(properties.boxShadow.since).toBe("0.76");
    expect(properties.borderInlineStartWidth.native).toBe("borderStartWidth");
    expect(properties.backgroundImage.native).toBe("experimental_backgroundImage");
    expect(properties.caretColor.prop).toBe("cursorColor");
    expect(properties.textOverflow.prop).toBe("ellipsizeMode");
    expect(properties.transform.values).not.toContain("translate");
    expect(properties.transform.values).toContain("translateX");
  });
});

describe("conditions", () => {
  test("interaction pseudo-classes are polyfilled, structural ones are not", () => {
    expect(pseudoClasses[":hover"].status).toBe("polyfilled");
    expect(pseudoClasses[":active"].status).toBe("polyfilled");
    expect(pseudoClasses[":focus"].status).toBe("polyfilled");
    expect(pseudoClasses[":first-child"].status).toBe("unsupported");
  });

  test("::placeholder becomes placeholderTextColor and only supports color", () => {
    expect(pseudoElements["::placeholder"]).toMatchObject({
      status: "partial",
      values: ["color"],
      prop: "placeholderTextColor",
    });
  });

  test("every @media feature listed as accepted has a mediaFeatures entry", () => {
    for (const feature of atRules["@media"].values ?? []) {
      expect(mediaFeatures[feature as keyof typeof mediaFeatures], feature).toBeDefined();
    }
  });

  test("container queries are unsupported, @supports is web-only", () => {
    expect(atRules["@container"].status).toBe("unsupported");
    expect(atRules["@supports"].status).toBe("web-only");
  });
});

describe("units and functions", () => {
  test("relative units are polyfilled, font-metric units are not", () => {
    expect(units.rem.status).toBe("polyfilled");
    expect(units.em.status).toBe("polyfilled");
    expect(units.vw.status).toBe("polyfilled");
    expect(units.ch.status).toBe("unsupported");
  });

  test("function keys end with ()", () => {
    for (const key of Object.keys(functions)) expect(key).toMatch(/\(\)$/);
  });

  test("var() is polyfilled and calc() is partial", () => {
    expect(functions["var()"].status).toBe("polyfilled");
    expect(functions["calc()"].status).toBe("partial");
  });
});

describe("apis", () => {
  test("selector-dependent APIs are unsupported", () => {
    expect(apis.when.status).toBe("unsupported");
    expect(apis.positionTry.status).toBe("unsupported");
    expect(apis.defineMarker.status).toBe("unsupported");
  });
});
