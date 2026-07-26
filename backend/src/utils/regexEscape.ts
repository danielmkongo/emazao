// Escapes regex metacharacters in user-supplied search input before it's used to
// build a RegExp — without this, raw input can inject arbitrary regex logic
// (alternation, anchors) into query matching, or trigger a ReDoS via a crafted
// pattern with nested quantifiers.
export const escapeRegex = (input: string): string => input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
