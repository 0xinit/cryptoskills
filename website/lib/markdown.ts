import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypePrettyCode from "rehype-pretty-code";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";

// Extend sanitize schema to allow rehype-pretty-code attributes
const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: [
      ...(defaultSchema.attributes?.code || []),
      "data-language",
      "data-theme",
    ],
    pre: [...(defaultSchema.attributes?.pre || []), "data-language", "data-theme"],
    span: [
      ...(defaultSchema.attributes?.span || []),
      "data-line",
      "style",
    ],
    figure: [
      ...(defaultSchema.attributes?.figure || []),
      "data-rehype-pretty-code-figure",
    ],
  },
};

export async function renderMarkdown(content: string): Promise<string> {
  const result = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeSlug)
    .use(rehypeAutolinkHeadings, { behavior: "wrap" })
    .use(rehypePrettyCode, {
      theme: "github-dark",
      keepBackground: true,
    })
    .use(rehypeSanitize, sanitizeSchema)
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(content);

  return String(result);
}

export function stripFrontmatter(content: string): string {
  return content.replace(/^---\n[\s\S]*?\n---\n/, "");
}
