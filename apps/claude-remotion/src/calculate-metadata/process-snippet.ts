import { highlight } from "codehike/code";
import { createTwoslashFromCDN } from "twoslash-cdn";
import { CompilerOptions, JsxEmit, ModuleKind, ScriptTarget } from "typescript";
import { PublicFolderFile } from "./get-files";
import { Theme } from "./theme";

const compilerOptions: CompilerOptions = {
  lib: ["dom", "es2023"],
  jsx: JsxEmit.ReactJSX,
  target: ScriptTarget.ES2023,
  module: ModuleKind.ESNext,
};

const twoslash = createTwoslashFromCDN({
  compilerOptions,
});

export const processSnippet = async (step: PublicFolderFile, theme: Theme) => {
  const splitted = step.filename.split(".");
  const extension = splitted[splitted.length - 1];

  // ⚠️ Twoslash fetches TypeScript's lib files from a CDN, so this is the ONE network call in the
  // composition. It runs only for .ts/.tsx and only adds type callouts (`^?`) and inline error
  // markers. If it fails — offline, a blocked CDN, a slow runner — the snippet still renders:
  // Code Hike's highlighting is local, so you lose the callouts and keep the video. That failure
  // is caught here rather than left to reject the whole render.
  let twoslashResult: Awaited<ReturnType<typeof twoslash.run>> | null = null;
  if (extension === "ts" || extension === "tsx") {
    try {
      twoslashResult = await twoslash.run(step.value, extension, { compilerOptions });
    } catch {
      twoslashResult = null;
    }
  }

  const highlighted = await highlight(
    {
      lang: extension,
      meta: "",
      value: twoslashResult ? twoslashResult.code : step.value,
    },
    theme,
  );

  if (!twoslashResult) {
    return highlighted;
  }

  // If it is TypeScript code, let's also generate callouts (^?) and errors
  for (const { text, line, character, length } of twoslashResult.queries) {
    const codeblock = await highlight(
      { value: text, lang: "ts", meta: "callout" },
      theme,
    );
    highlighted.annotations.push({
      name: "callout",
      query: text,
      lineNumber: line + 1,
      data: {
        character,
        codeblock,
      },
      fromColumn: character,
      toColumn: character + length,
    });
  }

  for (const { text, line, character, length } of twoslashResult.errors) {
    highlighted.annotations.push({
      name: "error",
      query: text,
      lineNumber: line + 1,
      data: { character },
      fromColumn: character,
      toColumn: character + length,
    });
  }

  return highlighted;
};
