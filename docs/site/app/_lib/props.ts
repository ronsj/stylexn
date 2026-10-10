/**
 * Props tables for the Elements page, read from the elements' TypeScript
 * source at build time: `elements/types.ts` holds the shared prop types and
 * comments, `elements/web.ts` how each element combines them.
 */
import ts from "typescript";
import { readRepoFile } from "./repo";

export type PropRow = Readonly<{ name: string; type: string; required: boolean; doc: string }>;

const TYPES = "stylexn/stylexn/src/elements/types.ts";
const WEB = "stylexn/stylexn/src/elements/web.ts";

/** Props the element types add inline, without a doc comment in the source. */
const INLINE_DOCS: Readonly<Record<string, string>> = {
  sx: "Styles from stylex.create: a rule, or an array of rules in which falsy entries are skipped.",
  contentSx: "Styles for the content container inside the scroll view (contentContainerStyle).",
  children: "",
  ref: "A handle with the methods listed below.",
};

type Source = Readonly<{
  file: ts.SourceFile;
  aliases: ReadonlyMap<string, ts.TypeAliasDeclaration>;
}>;

function load(path: string): Source {
  const file = ts.createSourceFile(path, readRepoFile(path), ts.ScriptTarget.Latest, true);
  const aliases = new Map<string, ts.TypeAliasDeclaration>();
  file.forEachChild((node) => {
    if (ts.isTypeAliasDeclaration(node)) aliases.set(node.name.text, node);
  });
  return { file, aliases };
}

let cache: readonly [Source, Source] | null = null;
const sources = () => (cache ??= [load(TYPES), load(WEB)]);

function findAlias(
  name: string,
): Readonly<{ alias: ts.TypeAliasDeclaration; file: ts.SourceFile }> {
  for (const source of sources()) {
    const alias = source.aliases.get(name);
    if (alias) return { alias, file: source.file };
  }
  throw new Error(`docs: no type ${name} in the elements source`);
}

function docOf(node: ts.Node): string {
  return ts
    .getJSDocCommentsAndTags(node)
    .map((doc) => (ts.isJSDoc(doc) ? (ts.getTextOfJSDocComment(doc.comment) ?? "") : ""))
    .join(" ")
    .trim();
}

function nameOf(name: ts.PropertyName): string {
  return ts.isIdentifier(name) || ts.isStringLiteral(name) ? name.text : name.getText();
}

function rows(type: ts.TypeNode, file: ts.SourceFile, skip: ReadonlySet<string>): PropRow[] {
  if (ts.isTypeLiteralNode(type)) {
    return type.members.flatMap((member): PropRow[] => {
      if (!member.name) return [];
      const name = nameOf(member.name);
      if (ts.isPropertySignature(member) && member.type) {
        return [
          {
            name,
            type: member.type.getText(file),
            required: !member.questionToken,
            doc: docOf(member) || (INLINE_DOCS[name] ?? ""),
          },
        ];
      }
      if (ts.isMethodSignature(member)) {
        const params = member.parameters.map((p) => p.getText(file)).join(", ");
        return [
          {
            name: `${name}()`,
            type: `(${params}) => ${member.type?.getText(file) ?? "void"}`,
            required: true,
            doc: docOf(member),
          },
        ];
      }
      return [];
    });
  }
  if (ts.isIntersectionTypeNode(type)) return type.types.flatMap((t) => rows(t, file, skip));
  if (ts.isTypeReferenceNode(type)) {
    const name = type.typeName.getText(file);
    if (name === "Readonly" && type.typeArguments?.[0]) {
      return rows(type.typeArguments[0], file, skip);
    }
    if (skip.has(name)) return [];
    const found = findAlias(name);
    return rows(found.alias.type, found.file, skip);
  }
  return [];
}

/** The props of `<Element>` (its `ElementProps` type), without the common props. */
export function elementProps(element: string): PropRow[] {
  const { alias, file } = findAlias(`${element}Props`);
  return rows(alias.type, file, new Set(["CommonProps", "A11yProps"]));
}

/** The props every element takes: `role`, the `aria-*` attributes and `testID`. */
export function commonProps(): PropRow[] {
  const { alias, file } = findAlias("CommonProps");
  return rows(alias.type, file, new Set());
}

/** The methods of a ref handle type such as `TextInputHandle`. */
export function handleMethods(handle: string): PropRow[] {
  const { alias, file } = findAlias(handle);
  return rows(alias.type, file, new Set());
}

/** The members of a union of string literals, such as `KeyboardType`. */
export function unionValues(name: string): string[] {
  const { alias } = findAlias(name);
  if (!ts.isUnionTypeNode(alias.type)) return [];
  return alias.type.types.flatMap((t) =>
    ts.isLiteralTypeNode(t) && ts.isStringLiteral(t.literal) ? [t.literal.text] : [],
  );
}

/** The doc comment on a type alias, e.g. `ImageSource`. */
export function typeDoc(name: string): string {
  return docOf(findAlias(name).alias);
}
